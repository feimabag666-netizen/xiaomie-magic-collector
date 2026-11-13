import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANGUAGES, PAYMENTS_BY_LANG, SITE_BASE_URL, TRANSLATIONS } from "./i18n-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SITE_DIR = path.join(ROOT_DIR, "site");

const ZIP_FILENAME = "小咩魔法采集-chrome-v1.0.8.zip";
const DOWNLOAD_URL = `/downloads/${encodeURIComponent(ZIP_FILENAME)}`;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageUrlFor(lang) {
  return lang.slug ? `${SITE_BASE_URL}/${lang.slug}/` : `${SITE_BASE_URL}/`;
}

function relPathFor(lang) {
  return lang.slug ? `/${lang.slug}/` : `/`;
}

function buildJsonLd(lang, t) {
  const url = pageUrlFor(lang);
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "小咩魔法采集 (Xiaomie Magic Collector)",
    "alternateName": "Xiaomie Magic Collector",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Chrome, Microsoft Edge (Manifest V3, Windows / macOS)",
    "softwareVersion": "1.0.8",
    "url": url,
    "downloadUrl": `${SITE_BASE_URL}${DOWNLOAD_URL}`,
    "image": `${SITE_BASE_URL}/assets/cat-logo.jpg`,
    "description": t.description,
    "inLanguage": lang.code,
    "offers": [
      {
        "@type": "Offer",
        "name": t.plans[0].name,
        "price": "0",
        "priceCurrency": "USD"
      },
      {
        "@type": "Offer",
        "name": t.plans[1].name,
        "price": "69",
        "priceCurrency": "USD"
      },
      {
        "@type": "Offer",
        "name": t.plans[2].name,
        "price": "139",
        "priceCurrency": "USD"
      }
    ]
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": t.faqs.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return `${JSON.stringify(softwareSchema)}\n</script>\n<script type="application/ld+json">\n${JSON.stringify(faqSchema)}`;
}

function renderHtml(lang, t) {
  const canonical = pageUrlFor(lang);
  const pay = PAYMENTS_BY_LANG[lang.code] || PAYMENTS_BY_LANG["en"];
  const hreflangTags = LANGUAGES.map(
    (l) => `  <link rel="alternate" hreflang="${l.code}" href="${pageUrlFor(l)}" />`
  ).join("\n") + `\n  <link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/" />`;

  const langOptions = LANGUAGES.map(
    (l) => `<option value="${relPathFor(l)}"${l.code === lang.code ? " selected" : ""}>🌐 ${escapeHtml(l.label)}</option>`
  ).join("\n            ");

  const statsHtml = t.stats
    .map(
      (s) => `
        <div class="stat-card">
          <div class="stat-num">${escapeHtml(s.num)}</div>
          <div class="stat-label">${escapeHtml(s.label)}</div>
        </div>`
    )
    .join("");

  const featuresHtml = t.features
    .map(
      (f) => `
        <article class="feature-card">
          <div class="feature-icon" aria-hidden="true">${f.icon}</div>
          <h3>${escapeHtml(f.title)}</h3>
          <p>${escapeHtml(f.desc)}</p>
        </article>`
    )
    .join("");

  const compareRowsHtml = t.compareRows
    .map(
      (r) => `
        <tr>
          <td><strong>${escapeHtml(r[0])}</strong></td>
          <td>${escapeHtml(r[1])}</td>
          <td>✓ ${escapeHtml(r[2])}</td>
        </tr>`
    )
    .join("");

  const pricingHtml = t.plans
    .map(
      (p, idx) => `
        <article class="price-card${p.highlight ? " featured" : ""}">
          ${p.badge ? `<span class="popular-badge">${escapeHtml(p.badge)}</span>` : ""}
          <div>
            <div class="price-name">${escapeHtml(p.name)}</div>
            <div class="price-amount">${escapeHtml(p.price)} <span style="font-size:1rem;font-weight:700;color:var(--primary)">(${escapeHtml(p.usd)})</span></div>
            <div class="price-sub">${escapeHtml(p.period)}</div>
            <p class="price-desc">${escapeHtml(p.desc)}</p>
            <ul class="price-bullets">
              ${p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
            </ul>
          </div>
          ${idx === 0
            ? `<a class="btn btn-secondary" href="${DOWNLOAD_URL}" download>${escapeHtml(p.cta)}</a>`
            : `<button type="button" class="btn ${p.highlight ? "btn-primary" : "btn-secondary"}" data-open-airwallex data-plan="${idx === 1 ? "pack100" : "lifetime"}">${escapeHtml(p.cta)}</button>`}
        </article>`
    )
    .join("");

  const stepsHtml = t.installSteps
    .map(
      (s) => `
        <div class="step-card">
          <div class="step-num">${escapeHtml(s.step)}</div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.desc)}</p>
        </div>`
    )
    .join("");

  const faqsHtml = t.faqs
    .map(
      (q) => `
        <details class="faq-item">
          <summary>${escapeHtml(q.q)}</summary>
          <p>${escapeHtml(q.a)}</p>
        </details>`
    )
    .join("");

  const footerLangLinks = LANGUAGES.map(
    (l) => `<a href="${relPathFor(l)}" hreflang="${l.code}">${escapeHtml(l.label)}</a>`
  ).join("\n          ");

  return `<!doctype html>
<html lang="${lang.code}" dir="${lang.dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t.title)}</title>
  <meta name="description" content="${escapeHtml(t.description)}" />
  <meta name="keywords" content="${escapeHtml(t.keywords)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${canonical}" />
${hreflangTags}
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(t.title)}" />
  <meta property="og:description" content="${escapeHtml(t.description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="${lang.ogLocale}" />
  <meta property="og:image" content="${SITE_BASE_URL}/assets/cat-logo.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(t.title)}" />
  <meta name="twitter:description" content="${escapeHtml(t.description)}" />
  <meta name="twitter:image" content="${SITE_BASE_URL}/assets/cat-logo.jpg" />
  <link rel="icon" type="image/jpeg" href="/assets/cat-logo.jpg" />
  <link rel="stylesheet" href="/assets/style.css" />
  <script type="application/ld+json">
${buildJsonLd(lang, t)}
  </script>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="${relPathFor(lang)}">
        <img src="/assets/cat-logo.jpg" alt="Xiaomie Magic Collector Logo" width="38" height="38" />
        <span>小咩魔法采集 · Xiaomie</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#features">${escapeHtml(t.nav.features)}</a>
        <a href="#compare">${escapeHtml(t.nav.compare)}</a>
        <a href="#pricing">${escapeHtml(t.nav.pricing)}</a>
        <a href="#install">${escapeHtml(t.nav.install)}</a>
        <a href="#faq">${escapeHtml(t.nav.faq)}</a>
      </nav>
      <div class="header-actions">
        <label for="langSwitcher" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Language</label>
        <select id="langSwitcher" class="lang-select" aria-label="Language">
          ${langOptions}
        </select>
        <button type="button" id="btnOpenAccountPortal" class="btn btn-secondary btn-sm">👤 Account / 账号中心</button>
        <a class="btn btn-primary btn-sm" href="${DOWNLOAD_URL}" download>${escapeHtml(t.nav.cta)}</a>
      </div>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="badge-pill">${escapeHtml(t.hero.badge)}</span>
          <h1>${escapeHtml(t.hero.h1)}</h1>
          <p class="hero-sub">${escapeHtml(t.hero.sub)}</p>
          <div class="hero-ctas">
            <a class="btn btn-primary" href="${DOWNLOAD_URL}" download>⬇ ${escapeHtml(t.hero.ctaPrimary)}</a>
            <a class="btn btn-secondary" href="#features">${escapeHtml(t.hero.ctaSecondary)}</a>
          </div>
          <ul class="trust-list">
            ${t.hero.trust.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
        <aside class="hero-card">
          <img class="hero-mascot" src="/assets/cat-logo.jpg" alt="Xiaomie Magic Collector v1.0.8" width="148" height="148" />
          <strong style="font-size:1.1rem;color:var(--primary-dark)">Xiaomie Magic Collector v1.0.8</strong>
          <p style="font-size:0.88rem;color:var(--ink-soft);margin:8px 0 0">Chrome &amp; Microsoft Edge · Manifest V3</p>
          <div class="hero-card-tags">
            <span class="chip">1688 / Taobao</span>
            <span class="chip">Amazon / Shopify</span>
            <span class="chip">WASM SIMD OCR</span>
            <span class="chip">4-Level Carton Specs</span>
            <span class="chip">B2B &amp; ToC AI Copy</span>
          </div>
        </aside>
      </div>
    </section>

    <section class="stats-bar" aria-label="Highlights">
      <div class="container stats-grid">${statsHtml}
      </div>
    </section>

    <section id="features" class="section section-alt">
      <div class="container">
        <div class="section-head">
          <h2>${escapeHtml(t.featuresTitle)}</h2>
          <p>${escapeHtml(t.featuresSub)}</p>
        </div>
        <div class="features-grid">${featuresHtml}
        </div>
      </div>
    </section>

    <section id="compare" class="section">
      <div class="container">
        <div class="section-head">
          <h2>${escapeHtml(t.compareTitle)}</h2>
        </div>
        <div class="table-wrap">
          <table class="compare-table">
            <thead>
              <tr>${t.compareHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
            </thead>
            <tbody>${compareRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="pricing" class="section section-alt">
      <div class="container">
        <div class="section-head">
          <h2>${escapeHtml(t.pricingTitle)}</h2>
          <p>${escapeHtml(t.pricingSub)}</p>
        </div>
        <div class="pricing-grid">${pricingHtml}
        </div>
        <div style="margin-top:40px;text-align:center">
          <h3 style="margin:0 0 6px;font-size:1.25rem">${escapeHtml(pay.title)}</h3>
          <p style="margin:0;color:var(--ink-soft);font-size:0.94rem">${escapeHtml(pay.sub)}</p>
        </div>
        <div class="payment-grid">
          <article class="pay-card live">
            <div>
              <span class="pay-badge live">${escapeHtml(pay.airwallex.badge)}</span>
              <h4 style="margin:10px 0 6px;font-size:1.02rem">${escapeHtml(pay.airwallex.name)}</h4>
              <p style="margin:0;font-size:0.88rem;color:var(--ink-soft)">${escapeHtml(pay.airwallex.desc)}</p>
            </div>
            <div>
              <button type="button" class="btn btn-primary" style="width:100%;margin-bottom:8px" data-open-airwallex data-plan="pack100">${escapeHtml(pay.airwallex.cta)}</button>
              <p class="pay-note">${escapeHtml(pay.airwallex.note)}</p>
            </div>
          </article>
          <article class="pay-card reserved">
            <div>
              <span class="pay-badge reserved">${escapeHtml(pay.wechat.badge)}</span>
              <h4 style="margin:10px 0 6px;font-size:1.02rem">${escapeHtml(pay.wechat.name)}</h4>
              <p style="margin:0;font-size:0.88rem;color:var(--ink-soft)">${escapeHtml(pay.wechat.desc)}</p>
            </div>
            <div class="pay-status-pill">${escapeHtml(pay.wechat.status)}</div>
          </article>
          <article class="pay-card reserved">
            <div>
              <span class="pay-badge reserved">${escapeHtml(pay.alipay.badge)}</span>
              <h4 style="margin:10px 0 6px;font-size:1.02rem">${escapeHtml(pay.alipay.name)}</h4>
              <p style="margin:0;font-size:0.88rem;color:var(--ink-soft)">${escapeHtml(pay.alipay.desc)}</p>
            </div>
            <div class="pay-status-pill">${escapeHtml(pay.alipay.status)}</div>
          </article>
        </div>
      </div>
    </section>

    <section id="install" class="section">
      <div class="container">
        <div class="section-head">
          <h2>${escapeHtml(t.installTitle)}</h2>
        </div>
        <div class="steps-grid">${stepsHtml}
        </div>
      </div>
    </section>

    <section id="faq" class="section section-alt">
      <div class="container">
        <div class="section-head">
          <h2>${escapeHtml(t.faqTitle)}</h2>
        </div>
        <div class="faq-list">${faqsHtml}
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div>${escapeHtml(t.footer)} · <a href="mailto:info@xiaomie.tools" style="color:var(--primary);font-weight:700">info@xiaomie.tools</a></div>
      <div class="footer-langs">
        ${footerLangLinks}
      </div>
    </div>
  </footer>

  <dialog id="accountPortalModal" class="xm-modal">
    <div class="xm-modal-head">
      <strong>👤 Account &amp; Entitlements / 账号与权益后台</strong>
      <button type="button" id="btnCloseAccountPortal" class="btn btn-secondary btn-sm">✕</button>
    </div>
    <div id="portalLoginBox">
      <p style="font-size:0.86rem;color:var(--ink-soft);margin-top:0">Sign in via Email Verification Code (sent from <strong>info@xiaomie.tools</strong>):</p>
      <div class="xm-field">
        <label for="webOtpEmail">Email Address / 邮箱地址</label>
        <div class="xm-row">
          <input id="webOtpEmail" type="email" placeholder="name@example.com" />
          <button type="button" id="btnWebSendOtp" class="btn btn-secondary btn-sm" style="white-space:nowrap">Send Code</button>
        </div>
      </div>
      <div class="xm-field">
        <label for="webOtpCode">6-Digit Code / 邮箱验证码</label>
        <div class="xm-row">
          <input id="webOtpCode" type="text" placeholder="123456" maxlength="6" />
          <button type="button" id="btnWebVerifyOtp" class="btn btn-primary btn-sm" style="white-space:nowrap">Verify &amp; Sign In</button>
        </div>
      </div>
      <div id="webOtpStatus" class="xm-status"></div>
    </div>
    <div id="portalDashBox" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;padding:12px;border-radius:12px;background:var(--surface-alt)">
        <div><small style="color:var(--muted)">Account</small><div id="portalUserEmail" style="font-weight:800;font-size:0.9rem"></div></div>
        <div><small style="color:var(--muted)">Current Plan</small><div id="portalUserPlan" style="font-weight:800;font-size:0.9rem"></div></div>
        <div><small style="color:var(--muted)">Remaining Quota</small><div id="portalUserQuota" style="font-weight:800;font-size:0.9rem;color:var(--primary)"></div></div>
        <div style="display:flex;align-items:end;justify-content:end"><button type="button" id="btnWebLogout" class="btn btn-secondary btn-sm">Sign Out</button></div>
      </div>
      <strong style="font-size:0.88rem;display:block;margin-bottom:6px">Billing &amp; Deduction History / 权益与扣费记录</strong>
      <div id="portalLedgerList" class="ledger-box"></div>
    </div>
  </dialog>

  <dialog id="airwallexModal" class="xm-modal">
    <div class="xm-modal-head">
      <strong>🌐 Airwallex Global Checkout (USD)</strong>
      <button type="button" id="btnCloseAwxModal" class="btn btn-secondary btn-sm">✕</button>
    </div>
    <p style="font-size:0.86rem;color:var(--ink-soft);margin-top:0">Powered by Airwallex (JINHUA CREDIT IMPORT AND EXPORT CO.,LTD). Supports Visa, MasterCard, Amex, Apple Pay &amp; Google Pay.</p>
    <div class="xm-field">
      <label for="awxPlanSelect">Select Plan / 选择方案</label>
      <select id="awxPlanSelect">
        <option value="pack100">⭐ VIP 100-Product Pack — $69.00 USD</option>
        <option value="lifetime">👑 SVIP Lifetime Unlimited — $139.00 USD</option>
      </select>
    </div>
    <div class="xm-field">
      <label for="awxBuyerEmail">Delivery Email / 接收激活码邮箱</label>
      <input id="awxBuyerEmail" type="email" placeholder="you@example.com" />
    </div>
    <button type="button" id="btnSubmitAwxCheckout" class="btn btn-primary" style="width:100%">Proceed to Airwallex Checkout ↗</button>
    <div id="awxCheckoutStatus" class="xm-status"></div>
  </dialog>

  <script src="/assets/app.js" defer></script>
</body>
</html>
`;
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = LANGUAGES.map((lang) => {
    const loc = pageUrlFor(lang);
    const links = LANGUAGES.map(
      (alt) => `    <xhtml:link rel="alternate" hreflang="${alt.code}" href="${pageUrlFor(alt)}" />`
    ).join("\n");
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${lang.slug === "" ? "1.0" : "0.9"}</priority>
${links}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/" />
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: ${SITE_BASE_URL}/sitemap.xml
`;
}

function buildLlmsTxt() {
  return `# Xiaomie Magic Collector (小咩魔法采集) v1.0.8

> Universal Chrome & Microsoft Edge (Manifest V3) extension for e-commerce product & content collection, AI image filtering, anti-freeze local WASM long-image OCR, 4-level carton specification lookup, and B2B/ToC copywriting.

## Canonical URLs by Audience Language
${LANGUAGES.map((l) => `- ${l.label} (${l.code}) [${l.market}]: ${pageUrlFor(l)}`).join("\n")}

## Key Differentiators & Unique Selling Points
1. **Universal E-Commerce & Article Auto-Detection**: Works on 1688, Taobao, Tmall, Amazon, AliExpress, Shopify, and independent stores; automatically switches to clean article/media mode on blogs and review pages.
2. **Anti-Freeze Local Long-Image OCR**: Built-in Tesseract WASM SIMD engine extracts material, sizing, and technical specs from ultra-long supplier detail images locally without freezing browser tabs.
3. **4-Level Carton & Spec Lookup Funnel**: Verifies 5 mandatory product fields and retrieves carton dimensions, weight, and packing quantities across DOM, tables, descriptions, and OCR text.
4. **AI Smart Image Filtering & Video/Animation Capture**: Separates Main, SKU, and Detail images, filters out ads/clutter, and captures Video, GIF, WebP, APNG, Canvas, and Lottie animations.
5. **Pure Single-Language Copy & Story Generator**: Supports B2B Export Wholesale and ToC Authentic Recommendation tones with strict single-language output (no mixed Chinese/English).
6. **Batch Queue & Rate Limiter**: Paste URLs or import .txt files, skip already-collected links, enforce per-minute/hour/day limits, and archive into auto-numbered local folders.

## Pricing (No Monthly Subscription)
- **Free Trial**: $0 / ¥0 — 20 full product/page collections with built-in trial API.
- **VIP 100-Product Pack**: $69 USD / ¥500 CNY — 100 stackable product credits + unlocks custom API Key slot.
- **SVIP Lifetime Unlimited**: $139 USD / ¥999 CNY — Unlimited lifetime collections across all sites + custom API Key slot.
- **Accepted Payments**: PayPal, Visa, MasterCard, Amex, Apple Pay, Google Pay, WeChat Pay, Alipay.
- **Official Support Email**: info@xiaomie.tools
`;
}

function buildHeaders() {
  return `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=86400
`;
}

function main() {
  fs.mkdirSync(SITE_DIR, { recursive: true });
  fs.mkdirSync(path.join(SITE_DIR, "assets"), { recursive: true });
  fs.mkdirSync(path.join(SITE_DIR, "downloads"), { recursive: true });

  // Copy logo & extension zip into site/
  const logoSrc = path.join(ROOT_DIR, "cat-logo.jpg");
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(SITE_DIR, "assets", "cat-logo.jpg"));
  }
  const zipSrc = path.join(ROOT_DIR, ZIP_FILENAME);
  if (fs.existsSync(zipSrc)) {
    fs.copyFileSync(zipSrc, path.join(SITE_DIR, "downloads", ZIP_FILENAME));
  }

  for (const lang of LANGUAGES) {
    const t = TRANSLATIONS[lang.code];
    const outDir = lang.slug ? path.join(SITE_DIR, lang.slug) : SITE_DIR;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), renderHtml(lang, t), "utf8");
  }

  fs.writeFileSync(path.join(SITE_DIR, "sitemap.xml"), buildSitemap(), "utf8");
  fs.writeFileSync(path.join(SITE_DIR, "robots.txt"), buildRobotsTxt(), "utf8");
  fs.writeFileSync(path.join(SITE_DIR, "llms.txt"), buildLlmsTxt(), "utf8");
  fs.writeFileSync(path.join(SITE_DIR, "_headers"), buildHeaders(), "utf8");

  console.log(`Generated ${LANGUAGES.length} localized landing pages in ${SITE_DIR}`);
}

main();
