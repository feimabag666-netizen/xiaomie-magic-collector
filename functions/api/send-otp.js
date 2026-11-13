import { connect } from "cloudflare:sockets";

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

async function sendSmtpEmail({ host, port, user, pass, to, subject, textBody }) {
  const socket = connect({ hostname: host, port }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  let buffer = "";
  async function readLine() {
    while (true) {
      const idx = buffer.indexOf("\n");
      if (idx !== -1) {
        const line = buffer.slice(0, idx + 1);
        buffer = buffer.slice(idx + 1);
        return line;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP connection closed unexpectedly");
      buffer += dec.decode(value, { stream: true });
    }
  }

  async function readResponse() {
    let full = "";
    while (true) {
      const line = await readLine();
      full += line;
      if (/^\d{3} /.test(line)) break;
    }
    const code = parseInt(full.slice(0, 3), 10);
    if (code >= 400) throw new Error(`SMTP error ${code}: ${full.trim()}`);
    return full;
  }

  async function cmd(line) {
    await writer.write(enc.encode(line + "\r\n"));
    return readResponse();
  }

  try {
    await readResponse(); // 220 greeting
    await cmd("EHLO xiaomie.tools");
    await cmd("AUTH LOGIN");
    await cmd(btoa(user));
    await cmd(btoa(pass));
    await cmd(`MAIL FROM:<${user}>`);
    await cmd(`RCPT TO:<${to}>`);
    await cmd("DATA");
    const msg = [
      `From: "Xiaomie Magic Collector" <${user}>`,
      `To: <${to}>`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      textBody,
      `.`,
    ].join("\r\n");
    await writer.write(enc.encode(msg + "\r\n"));
    await readResponse();
    await cmd("QUIT");
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { await socket.close(); } catch {}
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const lang = String(body.lang || "zh-CN");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Invalid email address" }, 400);
    }

    const smtpPass = context.env.PURELYMAIL_PASSWORD || "";
    const otpSecret = context.env.OTP_SECRET || smtpPass || "xiaomie-default-otp-secret-2026";
    if (!smtpPass) {
      return json({ ok: false, error: "SMTP service not configured (PURELYMAIL_PASSWORD missing)" }, 503);
    }

    const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)));
    const exp = Date.now() + 10 * 60 * 1000; // 10 minutes
    const payload = btoa(JSON.stringify({ email, code, exp }));
    const sig = await hmacSign(otpSecret, payload);
    const token = `${payload}.${sig}`;

    const isZh = lang.startsWith("zh");
    const subject = isZh
      ? `【小咩魔法采集】您的登录验证码：${code}`
      : `[Xiaomie Magic Collector] Your Verification Code: ${code}`;
    const textBody = isZh
      ? `您好！\n\n您正在登录「小咩魔法采集 (Xiaomie Magic Collector)」，验证码为：\n\n  ${code}\n\n验证码 10 分钟内有效，请勿泄露给他人。\n\n官方客服邮箱：info@xiaomie.tools\n官网：https://xiaomie-magic-collector.pages.dev`
      : `Hello!\n\nYour verification code for Xiaomie Magic Collector is:\n\n  ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nSupport: info@xiaomie.tools`;

    await sendSmtpEmail({
      host: "smtp.purelymail.com",
      port: 465,
      user: "info@xiaomie.tools",
      pass: smtpPass,
      to: email,
      subject,
      textBody,
    });

    return json({ ok: true, token, expiresIn: 600 });
  } catch (err) {
    return json({ ok: false, error: err?.message || "Failed to send OTP" }, 500);
  }
}
