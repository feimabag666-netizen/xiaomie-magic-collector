const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const token = String(body.token || "").trim();

    if (!email || !code || !token || !token.includes(".")) {
      return json({ ok: false, error: "Missing email, code, or verification token" }, 400);
    }

    const [payload, sig] = token.split(".");
    const otpSecret = context.env.OTP_SECRET || context.env.PURELYMAIL_PASSWORD || "xiaomie-default-otp-secret-2026";
    const expectedSig = await hmacSign(otpSecret, payload);
    if (sig !== expectedSig) {
      return json({ ok: false, error: "Invalid verification token signature" }, 401);
    }

    const data = JSON.parse(atob(payload));
    if (Date.now() > data.exp) {
      return json({ ok: false, error: "Verification code expired" }, 401);
    }
    if (data.email !== email || data.code !== code) {
      return json({ ok: false, error: "Incorrect verification code" }, 401);
    }

    return json({
      ok: true,
      email,
      provider: "email_otp",
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json({ ok: false, error: err?.message || "Verification failed" }, 500);
  }
}
