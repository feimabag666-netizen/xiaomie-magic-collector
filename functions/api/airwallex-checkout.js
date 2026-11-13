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

const PLANS = {
  pack100: { amount: 69, currency: "USD", title: "Xiaomie Magic Collector VIP (100 Products)" },
  lifetime: { amount: 139, currency: "USD", title: "Xiaomie Magic Collector SVIP (Lifetime Unlimited)" },
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const planId = String(body.planId || "pack100");
    const plan = PLANS[planId];
    if (!plan) {
      return json({ ok: false, error: "Invalid planId" }, 400);
    }

    const clientId = context.env.AIRWALLEX_CLIENT_ID || "";
    const apiKey = context.env.AIRWALLEX_API_KEY || "";
    if (!clientId || !apiKey) {
      return json({ ok: false, error: "Airwallex API secrets not configured" }, 503);
    }

    const authRes = await fetch("https://api.airwallex.com/api/v1/authentication/login", {
      method: "POST",
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    if (!authRes.ok) {
      const txt = await authRes.text();
      return json({ ok: false, error: `Airwallex auth failed: ${authRes.status} ${txt}` }, 502);
    }
    const { token } = await authRes.json();

    const plRes = await fetch("https://api.airwallex.com/api/v1/pa/payment_links/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        title: plan.title,
        reusable: false,
        default_currency: plan.currency,
        metadata: {
          planId,
          buyerEmail: String(body.email || ""),
        },
      }),
    });

    const plData = await plRes.json();
    if (!plRes.ok || !plData.url) {
      return json({ ok: false, error: plData.message || "Failed to create Airwallex payment link" }, 502);
    }

    return json({ ok: true, checkoutUrl: plData.url, paymentLinkId: plData.id });
  } catch (err) {
    return json({ ok: false, error: err?.message || "Airwallex checkout error" }, 500);
  }
}
