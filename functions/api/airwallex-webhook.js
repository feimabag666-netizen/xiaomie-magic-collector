// Cloudflare Pages Function: /api/airwallex-webhook
// 接收空中云汇 (Airwallex) 支付成功 Webhook -> 自动开通 ACCOUNTS_KV 权益 -> 自动发送买家确认邮件 & 店主通知邮件

import { sendSmtpEmail, sendEntitlementEmail } from "../_lib/smtp.js";

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function getKv(env) {
  return env.ACCOUNTS_KV || env.TRIAL_QUOTA_KV || env.QUOTA_KV || null;
}

async function verifyAirwallexSignature(rawBody, timestamp, signature, secret) {
  if (!secret) return true; // 若暂未配置 AIRWALLEX_WEBHOOK_SECRET，则跳过签名校验
  if (!timestamp || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}${rawBody}`));
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return expectedHex.toLowerCase() === String(signature).trim().toLowerCase();
}

function pickBuyerEmail(obj) {
  const candidates = [
    obj?.metadata?.buyerEmail,
    obj?.metadata?.email,
    obj?.customer?.email,
    obj?.customer_email,
    obj?.billing_details?.email,
    obj?.latest_payment_attempt?.payment_method?.card?.billing?.email,
    obj?.latest_payment_attempt?.payment_method?.paypal?.email,
    obj?.order?.customer?.email,
  ];
  for (const c of candidates) {
    const s = String(c || "").trim().toLowerCase();
    if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return "";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();

  const secret = env.AIRWALLEX_WEBHOOK_SECRET || "";
  const ts = request.headers.get("x-timestamp") || "";
  const sig = request.headers.get("x-signature") || "";
  if (secret) {
    const valid = await verifyAirwallexSignature(rawBody, ts, sig, secret);
    if (!valid) {
      return jsonResp({ ok: false, error: "Invalid Airwallex webhook signature" }, 401);
    }
  }

  let event = {};
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResp({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const eventName = String(event.name || event.type || "").toLowerCase();
  const supported = [
    "payment_intent.succeeded",
    "payment_link.paid",
    "order.paid",
    "checkout.session.completed",
  ];
  if (!supported.includes(eventName)) {
    return jsonResp({ ok: true, ignored: true, eventName });
  }

  const obj = event?.data?.object || event?.data || {};
  const eventId = String(event.id || obj.id || `${eventName}_${Date.now()}`);
  const kv = getKv(env);

  // 幂等校验：防止 Airwallex 重试推送导致重复叠加百品包额度
  if (kv && typeof kv.get === "function") {
    const processed = await kv.get(`awx_evt:${eventId}`).catch(() => null);
    if (processed) {
      return jsonResp({ ok: true, duplicate: true, eventId });
    }
  }

  const amountNum = Number(obj.amount ?? obj.captured_amount ?? 0);
  const currency = String(obj.currency || "USD").toUpperCase();
  const metaPlan = String(obj?.metadata?.planId || "").trim().toLowerCase();
  const planId = (metaPlan === "lifetime" || metaPlan === "pack100")
    ? metaPlan
    : (amountNum >= 120 ? "lifetime" : "pack100");
  const buyerEmail = pickBuyerEmail(obj);
  const orderId = String(obj.merchant_order_id || obj.id || eventId).slice(0, 80);
  const paidAmount = amountNum > 0 ? `${currency} ${amountNum} (Airwallex)` : `${currency} (Airwallex)`;

  let accountActivated = false;
  let finalQuota = planId === "lifetime" ? 999999 : 100;

  if (buyerEmail && kv && typeof kv.put === "function") {
    const key = `acct:${buyerEmail}`;
    let existing = null;
    try {
      const raw = await kv.get(key);
      if (raw) existing = JSON.parse(raw);
    } catch {}

    const now = Date.now();
    const prevQuota = existing?.plan === "pack100" ? (Number(existing.quotaLimit) || 100) : 0;
    finalQuota = planId === "lifetime" ? 999999 : (prevQuota + 100);
    const nextPlan = (existing?.plan === "free_vip" || existing?.plan === "lifetime") ? existing.plan : planId;
    if (nextPlan === "free_vip" || nextPlan === "lifetime") finalQuota = 999999;

    const record = {
      email: buyerEmail,
      provider: existing?.provider || (buyerEmail.endsWith("@gmail.com") ? "google" : "email"),
      plan: nextPlan,
      usedCount: Number(existing?.usedCount) || 0,
      quotaLimit: finalQuota,
      paidAmount,
      note: `Airwallex 自动开通 (${orderId})`,
      adminLocked: true,
      deviceFp: existing?.deviceFp || "",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await kv.put(key, JSON.stringify(record));

    try {
      const idxRaw = await kv.get("acct_index");
      const list = idxRaw ? JSON.parse(idxRaw) : [];
      if (Array.isArray(list) && !list.includes(buyerEmail)) {
        list.push(buyerEmail);
        await kv.put("acct_index", JSON.stringify(list));
      }
    } catch {}

    accountActivated = true;
  }

  if (kv && typeof kv.put === "function") {
    await kv.put(`awx_evt:${eventId}`, JSON.stringify({ buyerEmail, planId, paidAmount, orderId, at: Date.now() }), {
      expirationTtl: 60 * 60 * 24 * 30,
    }).catch(() => {});
  }

  // 1) 自动给海外买家发送开通确认邮件
  let buyerMailRes = { sent: false };
  if (buyerEmail) {
    try {
      buyerMailRes = await sendEntitlementEmail(env, {
        to: buyerEmail,
        plan: planId,
        quotaLimit: finalQuota,
        paidAmount,
        source: "airwallex",
        orderId,
      });
    } catch (e) {
      buyerMailRes = { sent: false, error: e?.message || "SMTP error" };
    }
  }

  // 2) 自动给店主/客服发送收款成交通知邮件
  const pass = env.PURELYMAIL_NOREPLY_PASSWORD || env.PURELYMAIL_PASSWORD || "";
  if (pass) {
    const notifyTargets = ["info@xiaomie.tools", "feimabag666@gmail.com"];
    const notifyText = [
      `收到一笔新的空中云汇 (Airwallex) 海外付款！`,
      ``,
      `买家邮箱：${buyerEmail || "未填写（请在 Airwallex 后台核对）"}`,
      `购买套餐：${planId === "lifetime" ? "SVIP 终身至尊版 ($139)" : "VIP 百品采集包 ($69)"}`,
      `实付金额：${paidAmount}`,
      `交易单号：${orderId}`,
      `云端自动开通：${accountActivated ? "✅ 已自动开通生效" : "⚠️ 未自动开通（缺少买家邮箱或未绑定 ACCOUNTS_KV）"}`,
      `买家确认邮件：${buyerMailRes.sent ? "✅ 已自动发送" : "⚠️ 未发送"}`,
    ].join("\n");
    for (const target of notifyTargets) {
      try {
        await sendSmtpEmail({
          pass,
          to: target,
          subject: `【收款通知】Airwallex 新订单 ${paidAmount} - ${buyerEmail || orderId}`,
          textBody: notifyText,
        });
      } catch {}
    }
  }

  return jsonResp({
    ok: true,
    eventId,
    buyerEmail,
    planId,
    accountActivated,
    buyerMailSent: !!buyerMailRes.sent,
  });
}
