// Cloudflare Pages Function: /api/admin/accounts
// 管理员后台接口：查看所有账号试用/付款/权益情况，指定任意谷歌号或邮箱为「终身免费账号 (free_vip)」或开通套餐（支持自动发开通确认邮件）

import { sendEntitlementEmail } from "../../_lib/smtp.js";

function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Email, X-Admin-Secret",
    "Vary": "Origin",
  };
}

function jsonResp(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...buildCorsHeaders(request),
    },
  });
}

function getKv(env) {
  return env.ACCOUNTS_KV || env.TRIAL_QUOTA_KV || env.QUOTA_KV || null;
}

function getAdminEmails(env) {
  const raw = String(env.ADMIN_EMAILS || "feimabag666@gmail.com,info@xiaomie.tools,2315748@qq.com");
  return raw
    .split(/[,;\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function verifyAdminAuth(request, env, body) {
  const adminEmails = getAdminEmails(env);
  const email = String(request.headers.get("X-Admin-Email") || body?.adminEmail || "").trim().toLowerCase();
  const secret = String(request.headers.get("X-Admin-Secret") || body?.adminSecret || "").trim();
  const expectedSecret = String(env.ADMIN_SECRET || env.OTP_SECRET || "XM-ADMIN-2026");

  if (!email || !adminEmails.includes(email)) {
    return { ok: false, error: `无管理员权限：邮箱 ${email || "(空)"} 不在管理员白名单中` };
  }
  if (!secret || secret !== expectedSecret) {
    return { ok: false, error: "管理员密钥不正确，请核对后重试" };
  }
  return { ok: true, adminEmail: email };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResp(request, { ok: false, error: "Invalid JSON" }, 400);
  }

  const auth = verifyAdminAuth(request, env, body);
  if (!auth.ok) {
    return jsonResp(request, { ok: false, error: auth.error }, 403);
  }

  const kv = getKv(env);
  const action = String(body.action || "list");

  if (!kv || typeof kv.get !== "function") {
    return jsonResp(request, {
      ok: true,
      kvBound: false,
      warning: "尚未在 Cloudflare Pages 后台绑定 KV 命名空间（请绑定变量名 ACCOUNTS_KV）",
      stats: { total: 0, trial: 0, pack100: 0, lifetime: 0, free_vip: 0, totalUsed: 0 },
      accounts: [],
    });
  }

  if (action === "list") {
    const idxRaw = await kv.get("acct_index").catch(() => null);
    const emails = idxRaw ? JSON.parse(idxRaw) : [];
    const accounts = [];
    for (const em of (Array.isArray(emails) ? emails : [])) {
      try {
        const raw = await kv.get(`acct:${em}`);
        if (raw) accounts.push(JSON.parse(raw));
      } catch {}
    }
    accounts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const stats = {
      total: accounts.length,
      trial: accounts.filter(a => a.plan === "trial").length,
      pack100: accounts.filter(a => a.plan === "pack100").length,
      lifetime: accounts.filter(a => a.plan === "lifetime").length,
      free_vip: accounts.filter(a => a.plan === "free_vip").length,
      totalUsed: accounts.reduce((sum, a) => sum + (Number(a.usedCount) || 0), 0),
    };
    return jsonResp(request, { ok: true, kvBound: true, stats, accounts });
  }

  if (action === "upsert") {
    const targetEmail = String(body.email || "").trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return jsonResp(request, { ok: false, error: "请输入有效的谷歌邮箱或电子邮箱地址" }, 400);
    }
    const plan = ["trial", "pack100", "lifetime", "free_vip"].includes(body.plan) ? body.plan : "free_vip";
    const key = `acct:${targetEmail}`;
    let prev = null;
    try {
      const raw = await kv.get(key);
      if (raw) prev = JSON.parse(raw);
    } catch {}

    const now = Date.now();
    const quotaLimit = plan === "lifetime" || plan === "free_vip"
      ? 999999
      : (plan === "pack100" ? Math.max(100, parseInt(body.quotaLimit, 10) || 100) : Math.max(20, parseInt(body.quotaLimit, 10) || 20));
    const usedCount = body.usedCount !== undefined && body.usedCount !== ""
      ? Math.max(0, parseInt(body.usedCount, 10) || 0)
      : (prev?.usedCount || 0);

    const rec = {
      email: targetEmail,
      provider: prev?.provider || (targetEmail.endsWith("@gmail.com") ? "google" : "email"),
      plan,
      usedCount,
      quotaLimit,
      paidAmount: body.paidAmount !== undefined ? String(body.paidAmount).trim().slice(0, 40) : (prev?.paidAmount || (plan === "free_vip" ? "管理员免费授权" : "")),
      note: body.note !== undefined ? String(body.note).trim().slice(0, 120) : (prev?.note || ""),
      deviceFp: prev?.deviceFp || "",
      adminLocked: true,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    };

    await kv.put(key, JSON.stringify(rec));
    const idxRaw = await kv.get("acct_index").catch(() => null);
    const idxArr = idxRaw ? JSON.parse(idxRaw) : [];
    if (Array.isArray(idxArr) && !idxArr.includes(targetEmail)) {
      idxArr.push(targetEmail);
      await kv.put("acct_index", JSON.stringify(idxArr.slice(-5000)));
    }
    let emailSent = false;
    let emailError = "";
    if (body.sendEmail && plan !== "trial") {
      try {
        const mr = await sendEntitlementEmail(env, {
          to: targetEmail,
          plan,
          quotaLimit,
          paidAmount: rec.paidAmount,
          source: "manual",
        });
        emailSent = !!mr.sent;
        if (!mr.sent) emailError = mr.reason || "";
      } catch (e) {
        emailError = e?.message || "SMTP send failed";
      }
    }
    return jsonResp(request, { ok: true, kvBound: true, account: rec, emailSent, emailError });
  }

  if (action === "delete") {
    const targetEmail = String(body.email || "").trim().toLowerCase();
    if (!targetEmail) return jsonResp(request, { ok: false, error: "Missing email" }, 400);
    await kv.delete(`acct:${targetEmail}`).catch(() => {});
    const idxRaw = await kv.get("acct_index").catch(() => null);
    const idxArr = (idxRaw ? JSON.parse(idxRaw) : []).filter(e => e !== targetEmail);
    await kv.put("acct_index", JSON.stringify(idxArr));
    return jsonResp(request, { ok: true, deleted: targetEmail });
  }

  return jsonResp(request, { ok: false, error: "Unknown action" }, 400);
}
