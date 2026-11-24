// Cloudflare Pages Function: /api/account-sync
// 跨设备云端账号与权益同步（支持 trial / pack100 / lifetime / free_vip 终身免费白名单）

function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

const PLAN_RANK = { trial: 1, pack100: 2, lifetime: 3, free_vip: 4 };
const DEFAULT_OWNER_FREE_EMAILS = new Set(["feimabag666@gmail.com"]);

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

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResp(request, { ok: false, error: "Invalid email" }, 400);
  }

  const provider = String(body.provider || "email").slice(0, 20);
  const localPlan = ["trial", "pack100", "lifetime", "free_vip"].includes(body.plan) ? body.plan : "trial";
  const localUsed = Math.max(0, parseInt(body.usedCount, 10) || 0);
  const localLimit = Math.max(20, parseInt(body.quotaLimit, 10) || (localPlan === "pack100" ? 100 : 20));
  const deviceFp = String(body.deviceFp || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

  const kv = getKv(env);
  const key = `acct:${email}`;
  let existing = null;

  if (kv && typeof kv.get === "function") {
    try {
      const raw = await kv.get(key);
      if (raw) existing = JSON.parse(raw);
    } catch {}
  }

  const now = Date.now();
  const isOwnerFree = DEFAULT_OWNER_FREE_EMAILS.has(email);
  const base = existing || {
    email,
    provider,
    plan: isOwnerFree ? "free_vip" : "trial",
    usedCount: 0,
    quotaLimit: isOwnerFree ? 999999 : 20,
    paidAmount: "",
    note: isOwnerFree ? "创始人/管理员默认终身免费" : "",
    deviceFp,
    createdAt: now,
    updatedAt: now,
  };
  if (isOwnerFree && !base.adminLocked) {
    base.plan = "free_vip";
    base.quotaLimit = 999999;
  }

  // 若管理员在后台明确指定了该账号为 free_vip / lifetime / pack100，以服务端更高权益为准
  const serverRank = PLAN_RANK[base.plan] || 1;
  const localRank = PLAN_RANK[localPlan] || 1;
  let mergedPlan = base.plan;
  let mergedLimit = base.quotaLimit || 20;

  if (base.adminLocked) {
    mergedPlan = base.plan;
    mergedLimit = base.quotaLimit || (mergedPlan === "pack100" ? 100 : 20);
  } else if (localRank > serverRank) {
    mergedPlan = localPlan;
    mergedLimit = Math.max(base.quotaLimit || 20, localLimit);
  } else if (serverRank >= localRank) {
    mergedPlan = base.plan;
    mergedLimit = Math.max(base.quotaLimit || 20, mergedPlan === "pack100" ? 100 : 20);
  }

  const mergedUsed = Math.max(base.usedCount || 0, localUsed);

  const nextRec = {
    ...base,
    email,
    provider: provider || base.provider || "email",
    plan: mergedPlan,
    usedCount: mergedUsed,
    quotaLimit: mergedPlan === "lifetime" || mergedPlan === "free_vip" ? 999999 : mergedLimit,
    deviceFp: deviceFp || base.deviceFp || "",
    updatedAt: now,
  };

  if (kv && typeof kv.put === "function") {
    try {
      await kv.put(key, JSON.stringify(nextRec));
      const idxRaw = await kv.get("acct_index");
      const idxArr = idxRaw ? JSON.parse(idxRaw) : [];
      if (Array.isArray(idxArr) && !idxArr.includes(email)) {
        idxArr.push(email);
        await kv.put("acct_index", JSON.stringify(idxArr.slice(-5000)));
      }
    } catch {}
  }

  return jsonResp(request, {
    ok: true,
    kvBound: Boolean(kv),
    account: {
      email: nextRec.email,
      plan: nextRec.plan,
      usedCount: nextRec.usedCount,
      quotaLimit: nextRec.quotaLimit,
      paidAmount: nextRec.paidAmount || "",
      note: nextRec.note || "",
    },
  });
}
