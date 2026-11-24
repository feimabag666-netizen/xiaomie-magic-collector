import { connect } from "cloudflare:sockets";

export async function sendSmtpEmail({ host = "smtp.purelymail.com", port = 465, user = "noreply@xiaomie.tools", pass, to, subject, textBody }) {
  if (!pass) {
    throw new Error("SMTP password missing (PURELYMAIL_NOREPLY_PASSWORD)");
  }
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
      `Reply-To: <info@xiaomie.tools>`,
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

export async function sendEntitlementEmail(env, { to, plan, quotaLimit, paidAmount, source = "manual", orderId = "" }) {
  const pass = env.PURELYMAIL_NOREPLY_PASSWORD || env.PURELYMAIL_PASSWORD || "";
  if (!pass || !to) return { sent: false, reason: !pass ? "SMTP password not configured" : "missing recipient" };

  const planNames = {
    free_vip: { zh: "终身免费特权账号（全网不限量）", en: "Lifetime Free VIP (Unlimited)" },
    lifetime: { zh: "SVIP 终身至尊版（全网不限量）", en: "SVIP Lifetime Edition (Unlimited)" },
    pack100: { zh: `VIP 百品采集包（当前总额度 ${quotaLimit || 100} 个产品）`, en: `VIP 100-Product Pack (Total Quota: ${quotaLimit || 100})` },
    trial: { zh: "免费试用版（20 个产品）", en: "Free Trial (20 Products)" },
  };
  const p = planNames[plan] || planNames.pack100;
  const isAuto = source === "airwallex";
  const subject = isAuto
    ? `[Xiaomie Magic Collector] Payment Confirmed & ${p.en} Activated / 付款成功，权益已自动开通`
    : `【小咩魔法采集】您的「${p.zh}」授权已开通 / Entitlement Activated`;

  const lines = [
    `您好 / Hello!`,
    ``,
    isAuto
      ? `感谢您的购买！您的空中云汇 (Airwallex) 付款已确认，对应权益已自动开通并绑定至您的账号：`
      : `您好！管理员已为您的账号开通小咩魔法采集授权权益：`,
    ``,
    `  登录账号 / Account : ${to}`,
    `  已开通权益 / Plan  : ${p.zh} (${p.en})`,
    paidAmount ? `  付款金额 / Amount  : ${paidAmount}` : null,
    orderId ? `  订单编号 / Order ID: ${orderId}` : null,
    ``,
    `【如何使用 / How to Use】`,
    `1. 打开 Chrome 浏览器中的「小咩魔法采集」插件。`,
    `2. 使用上述邮箱 (${to}) 登录（Google 登录或邮箱登录均可）；若已登录，刷新插件页面即可自动同步最新权益，无需手动输入激活码。`,
    ``,
    `Open the Xiaomie Magic Collector Chrome extension and sign in with ${to} (or refresh the panel if already signed in). Your new plan syncs automatically across devices.`,
    ``,
    `如有任何疑问，请联系官方客服邮箱：info@xiaomie.tools`,
    `Support: info@xiaomie.tools`,
  ].filter(v => v !== null);

  await sendSmtpEmail({
    pass,
    to,
    subject,
    textBody: lines.join("\n"),
  });
  return { sent: true };
}
