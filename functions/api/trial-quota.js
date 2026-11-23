// Cloudflare Pages Function: /api/trial-quota
// 防止卸载重装 Chrome/Edge 扩展后免费 20 次试用额度归零
// 三重持久化：HMAC签名 HttpOnly Cookie（卸载插件不清除） + Cloudflare Edge Cache（按设备指纹） + 可选 KV（TRIAL_QUOTA_KV）

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

function jsonResp(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...buildCorsHeaders(request),
      ...extraHeaders,
    },
  });
}

async function hmacSign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseCookies(cookieHeader) {
  const out = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

async function readSignedCookieUsed(request, secret, expectedFp) {
  try {
    const cookies = parseCookies(request.headers.get("Cookie"));
    const raw = cookies.xm_tq;
    if (!raw) return 0;
    const parts = raw.split(".");
    if (parts.length !== 3) return 0;
    const [fpHash, usedStr, sig] = parts;
    const payload = `${fpHash}.${usedStr}`;
    const expectedSig = await hmacSign(secret, payload);
    if (sig !== expectedSig) return 0;
    const used = parseInt(usedStr, 10);
    if (!Number.isFinite(used) || used < 0) return 0;
    // 同浏览器即便设备指纹略有差异，Cookie 本身代表同一浏览器实例，同样取高值防刷
    if (expectedFp && fpHash !== expectedFp.slice(0, 16)) {
      return Math.min(20, used);
    }
    return Math.min(20, used);
  } catch {
    return 0;
  }
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

  const deviceFp = String(body.deviceFp || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!deviceFp || deviceFp.length < 8) {
    return jsonResp(request, { ok: false, error: "Missing deviceFp" }, 400);
  }

  const localUsed = Math.max(0, Math.min(20, parseInt(body.usedCount, 10) || 0));
  const secret = String(env.OTP_SECRET || env.TRIAL_QUOTA_SECRET || "xm-magic-collector-trial-guard-2026");

  // 1) 读取浏览器持久 HttpOnly Cookie 中的试用计数（卸载插件不会清除站点 Cookie）
  const cookieUsed = await readSignedCookieUsed(request, secret, deviceFp);

  // 2) 读取可选 KV（若已绑定 env.TRIAL_QUOTA_KV）
  let kvUsed = 0;
  const kv = env.TRIAL_QUOTA_KV || env.QUOTA_KV || null;
  if (kv && typeof kv.get === "function") {
    try {
      const val = await kv.get(`fp:${deviceFp}`);
      if (val) kvUsed = Math.max(0, Math.min(20, parseInt(val, 10) || 0));
    } catch {}
  }

  // 3) 读取 Cloudflare Edge Cache（同一机房边缘持久缓存，按设备指纹共享）
  let cacheUsed = 0;
  const cacheKeyUrl = `https://quota.xiaomie.tools/v1/fp/${deviceFp}`;
  const cache = caches.default;
  try {
    const cachedResp = await cache.match(cacheKeyUrl);
    if (cachedResp) {
      const cj = await cachedResp.json();
      cacheUsed = Math.max(0, Math.min(20, parseInt(cj?.usedCount, 10) || 0));
    }
  } catch {}

  // 只增不减：取四方最大值
  const finalUsed = Math.max(localUsed, cookieUsed, kvUsed, cacheUsed);

  // 4) 回写 KV 与 Edge Cache
  if (kv && typeof kv.put === "function" && finalUsed > kvUsed) {
    try {
      await kv.put(`fp:${deviceFp}`, String(finalUsed));
    } catch {}
  }
  if (finalUsed > cacheUsed) {
    try {
      const storeResp = new Response(JSON.stringify({ usedCount: finalUsed, updatedAt: Date.now() }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=31536000",
        },
      });
      await cache.put(cacheKeyUrl, storeResp);
    } catch {}
  }

  // 5) 签发 1 年有效期的 HttpOnly + Secure + SameSite=None Cookie
  const fpShort = deviceFp.slice(0, 16);
  const payload = `${fpShort}.${finalUsed}`;
  const sig = await hmacSign(secret, payload);
  const cookieVal = `xm_tq=${payload}.${sig}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=None`;

  return jsonResp(
    request,
    { ok: true, usedCount: finalUsed, remaining: Math.max(0, 20 - finalUsed) },
    200,
    { "Set-Cookie": cookieVal }
  );
}
