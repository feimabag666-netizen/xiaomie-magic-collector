// 仅在用户主动点击扩展图标/按钮后执行：通过 activeTab 临时读取当前浏览页，不持续监控其他网站。
async function extractCurrentPage() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const origX = window.scrollX || 0, origY = window.scrollY || 0;
  try {
    const docHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    );
    const maxScroll = Math.min(docHeight, 30000);
    for (let y = 800; y < maxScroll; y += 1400) {
      window.scrollTo(0, y);
      try { window.dispatchEvent(new Event("scroll")); } catch {}
      await sleep(30);
    }
    const detailAnchors = document.querySelectorAll(
      "#desc-lazyload-container, #productDescription, #aplus, #J-detail-content, .product-description, .product-detail, " +
      "article, .post-content, .entry-content, .article-content, .rich_media_content, .Post-RichTextContainer, #content_views, " +
      "[class*='detail-content'], [id*='detail']"
    );
    for (const el of [...detailAnchors].slice(0, 4)) {
      try { el.scrollIntoView({ block: "center" }); await sleep(40); } catch {}
    }
    // 自动展开页面中折叠的“展开全部属性/更多参数/阅读全文”按钮，防止部分商品资料或长文漏采
    document.querySelectorAll(
      "[data-module*='attribute'] button, [data-module*='attribute'] [class*='more'], [data-module*='attribute'] [class*='expand'], " +
      ".od-pc-attribute [class*='more'], .od-pc-attribute [class*='expand'], .offer-attr-switch, [class*='attr-switch'], [class*='spec'] [class*='more'], " +
      "#wt-content-toggle-product-details-read-more, .read-more-btn, [class*='expand-all']"
    ).forEach(btn => {
      const t = (btn.innerText || "").trim();
      if (/^(?:展开|展开全部|查看更多|全部属性|更多属性|更多参数|展开阅读全文|阅读全文|Show\s*More|See\s*More|Read\s*More)$/i.test(t)) {
        try { btn.click(); } catch {}
      }
    });
  } catch {} finally {
    try { window.scrollTo(origX, origY); } catch {}
  }

  // 收集主文档、开放 Shadow DOM 与同源详情 iframe
  const roots = [document];
  try {
    const walkShadow = root => {
      root.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot && !roots.includes(el.shadowRoot)) {
          roots.push(el.shadowRoot);
          walkShadow(el.shadowRoot);
        }
      });
    };
    walkShadow(document);
    document.querySelectorAll("iframe").forEach(ifr => {
      try {
        if (ifr.contentDocument && ifr.contentDocument.body && !roots.includes(ifr.contentDocument)) {
          roots.push(ifr.contentDocument);
        }
      } catch {}
    });
  } catch {}

  const queryAllDeep = sel => {
    const out = [];
    for (const r of roots) {
      try { out.push(...r.querySelectorAll(sel)); } catch {}
    }
    return out;
  };

  const absolute = raw => {
    if (!raw) return "";
    let s = String(raw).trim().replace(/^url\(["']?|["']?\)$/gi, "").replace(/&amp;/gi, "&").trim();
    if (!s || /^data:|^javascript:|^about:|^mailto:|^tel:/i.test(s)) return "";
    if (s.startsWith("//")) s = location.protocol + s;
    try { return new URL(s, location.href).href; } catch { return ""; }
  };

  const pickBestFromSrcset = srcset => {
    if (!srcset) return "";
    const items = [];
    const re = /([^\s,]+(?:\s+\d+(?:\.\d+)?[wx])?)(?:\s*,\s*|$)/g;
    let m;
    while ((m = re.exec(String(srcset).trim()))) {
      const chunk = m[1].trim();
      if (!chunk) continue;
      const parts = chunk.split(/\s+/);
      const url = parts[0];
      const desc = parts[1] || "";
      let score = 1;
      if (/^(\d+(?:\.\d+)?)w$/i.test(desc)) score = parseFloat(desc) || 1;
      else if (/^(\d+(?:\.\d+)?)x$/i.test(desc)) score = (parseFloat(desc) || 1) * 1000;
      items.push({ url, score });
    }
    items.sort((a, b) => b.score - a.score);
    return items[0]?.url || "";
  };

  // 全平台自适应高清原图还原引擎（覆盖 1688/淘宝/天猫/京东/Amazon/速卖通/Shopify/WooCommerce/eBay/Etsy 及微信/知乎/CSDN/掘金/B站/Medium/小红书等博客）
  const upgradeImageUrl = raw => {
    let u = absolute(raw);
    if (!u || !/^https?:/i.test(u)) return "";
    try {
      const parsed = new URL(u);
      // 解包 Next.js / Vercel / WordPress Jetpack Photon 代理链接
      if (/\/_next\/image$/i.test(parsed.pathname) && parsed.searchParams.get("url")) {
        const inner = absolute(parsed.searchParams.get("url"));
        if (inner && /^https?:/i.test(inner)) u = inner;
      } else if (/^i[0-3]\.wp\.com$/i.test(parsed.hostname)) {
        parsed.searchParams.delete("resize");
        parsed.searchParams.delete("fit");
        parsed.searchParams.delete("w");
        parsed.searchParams.delete("h");
        u = parsed.href;
      }

      const p2 = new URL(u);
      // 微信公众号图片：保留 wx_fmt，剥离 tp=webp 强制获取原格式高清图
      if (/mmbiz\.qpic\.cn|mmbiz\.qlogo\.cn/i.test(p2.hostname)) {
        p2.searchParams.delete("tp");
        p2.searchParams.delete("wxfrom");
        p2.searchParams.delete("wx_lazy");
        return p2.href;
      }
      // 保护带 HMAC 签名的受保护 CDN 链接（如带 Signature / x-oss-signature / X-Amz-Signature / token / sign 的链接），防止删参数导致 403
      const isSignedUrl = ["Signature", "x-oss-signature", "X-Amz-Signature", "OSSAccessKeyId", "sig", "sign", "token", "auth_key", "Policy"]
        .some(k => p2.searchParams.has(k) || p2.searchParams.has(k.toLowerCase()));
      if (!isSignedUrl) {
        const dropParams = [
          "x-oss-process", "imageView2", "imageMogr2", "x-amz-process",
          "imwidth", "imheight", "tps", "resize", "fit", "crop"
        ];
        const isEcomOrBlogCdn = /alicdn\.com|tbcdn\.cn|aliimg\.com|1688\.com|cdn\.shopify\.com|\/cdn\/shop\/|myqcloud\.com|aliyuncs\.com|jd\.com|360buyimg\.com|ozon|coupang|rakuten|csdnimg\.cn|jianshu\.io|byteimg\.com|zhimg\.com|hdslb\.com/i.test(u);
        if (isEcomOrBlogCdn) {
          dropParams.push("width", "height", "w", "h", "size", "quality", "q");
        } else {
          for (const dimKey of ["width", "height", "w", "h"]) {
            const val = parseInt(p2.searchParams.get(dimKey) || "", 10);
            if (val > 0 && val <= 720) dropParams.push(dimKey);
          }
        }
        for (const k of dropParams) p2.searchParams.delete(k);
        for (const k of [...p2.searchParams.keys()]) {
          if (/^(?:imageView|imageMogr|x-oss-process|watermark)/i.test(k)) p2.searchParams.delete(k);
        }
        u = p2.href;
      }
    } catch {}
    u = u.replace(/\?(?:imageView2|imageMogr2|x-oss-process)[^#]*$/i, "");

    // 知乎专栏/回答图片：/80/v2-xxx_720w.webp -> /v2-xxx_r.jpg
    if (/zhimg\.com/i.test(u)) {
      u = u.replace(/\/\d{2}\/(v2-[a-z0-9]+)/i, "/$1")
        .replace(/_(?:720w|b|hd|l|xs|is|qhd|1440w)\.(jpg|jpeg|png|webp|gif)(?=[?#]|$)/i, "_r.$1")
        .replace(/\.webp(?=[?#]|$)/i, ".jpg");
    }
    // B站专栏/图文：xxx.jpg@1256w_708h_!web-article-pic.avif -> xxx.jpg
    if (/hdslb\.com/i.test(u)) {
      u = u.replace(/(\.(?:jpg|jpeg|png|webp|gif))@[^/?#]+(?=[?#]|$)/i, "$1");
    }
    // 掘金 / 字节系 byteimg：剥离 ~tplv 缩略水印后缀
    if (/byteimg\.com/i.test(u) && u.includes("~tplv-")) {
      u = u.replace(/~tplv-[^/?#]+(?=[?#]|$)/i, "");
    }
    // Medium 博客配图升级为 2000px 高清图
    if (/miro\.medium\.com\/v2\/resize:fit:\d+\//i.test(u)) {
      u = u.replace(/\/resize:fit:\d+\//i, "/resize:fit:2000/").replace(/\/format:webp/i, "");
    }

    // 多轮剥离电商复合缩略图后缀（如 .60x60xz.jpg_60x60q90.jpg_.webp -> .jpg）
    for (let pass = 0; pass < 3; pass++) {
      const prev = u;
      // 京东缩略图还原（优先处理 !cc_54x54.jpg 等后缀，防止被通用 _54x54 规则截断为 !cc.jpg）
      if (/360buyimg\.com/i.test(u)) {
        u = u.replace(/\/n(?:[2-9]|1[0-2])\//, "/n1/")
          .replace(/\/s\d+x\d+_jfs\//i, "/jfs/")
          .replace(/!(?:cc_\d+x\d+|q\d+)(?:\.[a-z0-9]+)?(?=[?#]|$)/i, "");
      }
      u = u.replace(/_.webp(?=[?#]|$)/i, "");
      u = u.replace(/(\.(?:jpg|jpeg|png|gif|webp))\.(?:webp|avif)(?=[?#]|$)/i, "$1");
      u = u.replace(/(\.(?:jpg|jpeg|png|webp|gif))_(?:\d+x\d+[^/?#]*|sum|summ|m|b|s|q\d+|search\d*|b1|xz)(?:\.(?:jpg|jpeg|png|webp|gif))?(?=[?#]|$)/i, "$1");
      u = u.replace(/(?:_\d+x\d+[a-z0-9_]*|\.\d+x\d+[a-z0-9_]*|_(?:sum|summ|m|b|s|q\d+|search\d*|b1|xz)|\.(?:sum|summ|m|b|s|q\d+|search\d*|b1|xz))(?=\.(?:jpg|jpeg|png|webp|gif)(?:[?#]|$))/i, "");
      if (/alicdn\.com|tbcdn\.cn|aliimg\.com|1688\.com/i.test(u)) {
        u = u.replace(/(_\d+x\d+[^/?#]*|_search\d*|_b1|_sum|_summ|_m|_q\d+)(?=[?#]|$)/i, "");
      }
      // Amazon 全系列缩略图后缀（如 ._AC_SL1500_.jpg / ._AC_SR38,50_.jpg / ._SX679_.jpg / ._SS40_.jpg / ._AC_US40_.jpg）
      u = u.replace(/\._[A-Z0-9_,+-]+_(?=\.(?:jpg|jpeg|png|webp|gif)(?:[?#]|$))/i, "");
      // Shopify 缩略图还原
      if (/cdn\.shopify\.com|\/cdn\/shop\//i.test(u)) {
        u = u.replace(/_(?:small|medium|large|grande|compact|pico|icon|thumb|\d+x\d*|\d*x\d+)(?:_crop_[a-z]+)?(?=\.(?:jpg|jpeg|png|webp)(?:[?#]|$))/i, "");
      }
      // WooCommerce / WordPress 上传目录缩略图
      if (/\/wp-content\/uploads\//i.test(u)) {
        u = u.replace(/-\d+x\d+(?=\.(?:jpg|jpeg|png|webp|gif)(?:[?#]|$))/i, "");
      }
      if (u === prev) break;
    }
    if (/i\.ebayimg\.com/i.test(u)) {
      u = u.replace(/\/s-l\d+(?=\.(?:jpg|jpeg|png|webp))/i, "/s-l1600");
    }
    if (/i\.etsystatic\.com/i.test(u)) {
      u = u.replace(/\/il_\d+x[\dN]+\./i, "/il_fullxfull.");
    }
    if (/rakuten\.co\.jp|r10s\.jp/i.test(u)) {
      u = u.replace(/\?_ex=\d+x\d+.*$/i, "");
    }
    return u;
  };

  const cleanTitle = raw => String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/\s*[-_|–—]\s*(?:阿里巴巴|1688\.com|淘宝网|天猫.*|京东.*|Amazon\..*|AliExpress.*|Alibaba\.com.*|eBay.*|Etsy.*|Shopee.*|Walmart.*|Ozon.*|Wildberries.*|Rakuten.*|Coupang.*|Mercado\s*Libre.*|知乎|知乎专栏|CSDN博客|CSDN|稀土掘金|掘金|简书|博客园|小红书|哔哩哔哩|bilibili|微信公众号|Medium|Substack|Dev\.to).*$/i, "")
    .trim();

  const attrs = {};
  const JUNK_KEY_RE = /^(?:客服|举报|分享|收藏|登录|注册|评价|累计评价|销量|成交|优惠|领券|运费|物流|发货至|配送|服务|保障|数量|操作|促销|浏览|扫一扫|为您推荐|猜你喜欢|看了又看|目录|导航|搜索|评论|回复|点赞|关注|转发|版权|声明|免责声明|上一篇|下一篇|相关文章|热门标签|分类专栏|Customer Reviews|Best Sellers Rank|ASIN|Date First Available|Feedback|Share|Add to Cart|Buy Now|Sponsored|Related|Menu|Navigation|Search|Cookie|Privacy|Terms|Copyright|\d+\s*stars?|\d+%)$/i;
  const MULTI_LANG_KEY_MAP = {
    "brand": "品牌", "brand name": "品牌", "марка": "品牌", "бренд": "品牌", "ブランド": "品牌", "브랜드": "品牌", "marca": "品牌", "marque": "品牌", "marke": "品牌",
    "model": "型号", "model number": "型号", "item model number": "型号", "part number": "型号", "mpn": "型号", "артикул": "型号", "модель": "型号", "型番": "型号", "모델": "型号", "modelo": "型号", "modèle": "型号", "modell": "型号",
    "material": "材质", "fabric": "材质", "material type": "材质", "материал": "材质", "素材": "材质", "材質": "材质", "재질": "材质", "소재": "材质", "matériau": "材质", "matière": "材质", "werkstoff": "材质",
    "color": "颜色", "colour": "颜色", "цвет": "颜色", "カラー": "颜色", "色": "颜色", "색상": "颜色", "cor": "颜色", "couleur": "颜色", "farbe": "颜色",
    "size": "产品尺寸", "dimensions": "产品尺寸", "product dimensions": "产品尺寸", "item dimensions": "产品尺寸", "item dimensions lxwxh": "产品尺寸", "product size": "产品尺寸", "размер": "产品尺寸", "габариты": "产品尺寸", "サイズ": "产品尺寸", "寸法": "产品尺寸", "크기": "产品尺寸", "사이즈": "产品尺寸", "dimensiones": "产品尺寸", "tamaño": "产品尺寸", "dimensões": "产品尺寸", "tamanho": "产品尺寸", "abmessungen": "产品尺寸", "maße": "产品尺寸",
    "weight": "产品重量", "item weight": "产品重量", "product weight": "产品重量", "unit weight": "单件重量", "вес": "产品重量", "重量": "产品重量", "重さ": "产品重量", "중량": "产品重量", "무게": "产品重量", "peso": "产品重量", "poids": "产品重量", "gewicht": "产品重量",
    "capacity": "容量", "volume": "容量", "объем": "容量", "емкость": "容量", "용량": "容量", "capacidad": "容量", "capacidade": "容量", "capacité": "容量", "kapazität": "容量",
    "power": "功率", "wattage": "功率", "мощность": "功率", "消費電力": "功率", "소비전력": "功率", "potencia": "功率", "potência": "功率", "puissance": "功率", "leistung": "功率",
    "voltage": "电压", "напряжение": "电压", "電圧": "电压", "전압": "电压", "voltaje": "电压", "tensão": "电压", "tension": "电压", "spannung": "电压",
    "origin": "产地", "country of origin": "产地", "place of origin": "产地", "страна производства": "产地", "原産国": "产地", "生産国": "产地", "원산지": "产地", "origen": "产地", "origem": "产地", "origine": "产地", "herkunftsland": "产地",
    "moq": "起订量", "minimum order quantity": "起订量", "min. order": "起订量", "минимальный заказ": "起订量", "最小注文数": "起订量", "최소주문수량": "起订量",
    "lead time": "交期", "delivery time": "交期", "срок поставки": "交期", "納期": "交期", "납기": "交期",
    "qty/ctn": "装箱数", "pcs/ctn": "装箱数", "carton qty": "装箱数", "carton quantity": "装箱数", "quantity per carton": "装箱数", "packing": "装箱数", "packing qty": "装箱数", "packing quantity": "装箱数", "pkg qty": "装箱数", "units per carton": "装箱数", "кол-во в коробке": "装箱数", "штук в коробке": "装箱数", "入数": "装箱数", "カートン入数": "装箱数", "박스당 입수량": "装箱数", "입수량": "装箱数", "unidades por caja": "装箱数", "qtd/caixa": "装箱数", "qté/carton": "装箱数", "stück/karton": "装箱数",
    "gross weight": "箱子毛重", "g.w.": "箱子毛重", "g.w": "箱子毛重", "gw": "箱子毛重", "carton gross weight": "箱子毛重", "вес брутто": "箱子毛重", "総重量": "箱子毛重", "총중량": "箱子毛重", "peso bruto": "箱子毛重", "poids brut": "箱子毛重", "bruttogewicht": "箱子毛重",
    "net weight": "箱子净重", "n.w.": "箱子净重", "n.w": "箱子净重", "nw": "箱子净重", "carton net weight": "箱子净重", "вес нетто": "箱子净重", "純重量": "箱子净重", "순중량": "箱子净重", "peso neto": "箱子净重", "peso líquido": "箱子净重", "poids net": "箱子净重", "nettogewicht": "箱子净重",
    "carton size": "箱子尺寸", "carton dimensions": "箱子尺寸", "package dimensions": "箱子尺寸", "master carton dimensions": "箱子尺寸", "meas": "箱子尺寸", "ctn size": "箱子尺寸", "габариты короба": "箱子尺寸", "размер коробки": "箱子尺寸", "外箱サイズ": "箱子尺寸", "カートンサイズ": "箱子尺寸", "박스 크기": "箱子尺寸", "카톤 사이즈": "箱子尺寸", "dimensiones de la caja": "箱子尺寸", "medidas da caixa": "箱子尺寸", "dimensions du carton": "箱子尺寸", "kartonabmessungen": "箱子尺寸", "umkartonmaß": "箱子尺寸",
  };

  const put = (rawKey, rawVal) => {
    let key = String(rawKey || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").replace(/^[:：\s•·▪-]+|[:：\s]+$/g, "").trim();
    let value = String(rawVal ?? "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
    if (!key || !value || key.length > 42 || value.length > 360 || key === value) return;
    if (/^https?:\/\//i.test(key) || /^[{[]/.test(key) || /^[{[]/.test(value)) return;
    if (JUNK_KEY_RE.test(key) || /^(?:登录|咨询客服|查看详情|展开|收起|更多|点击|立即|暂无|待定|未知|不详|无规格|无尺寸|见详情|见图片|详见详情|略|Please|Click|Sign in|javascript:|undefined|null|true|false|n\/a|none)$/i.test(value)) return;
    if (/^[/\\\-—–_.*·•~、，,.;:：|？?]+$/.test(value)) return;
    if (/(?:\d+\+?\s*(?:人好评|人评价|人付款|人想买|人收藏|人关注|人看过|条评价|条评论|笔成交|件可售|件起批)|好评率|回头率|复购率|揽收率|物流体验|买家保障|先采后付|退货包运费|加入进货单|立即购买|加入购物车)/i.test(value)) return;
    if (/^(?:产品尺寸|单品尺寸|外形尺寸|规格尺寸|单件重量|单品重量|产品重量|单重|容量|容积)$/i.test(key) && !/\d/.test(value) && !/^(?:XS|S|M|L|XL|XXL|2XL|3XL|均码)$/i.test(value)) return;
    if (/^(?:容量|容积)$/i.test(key) && /(?:人|好评|评价|付款|成交|销量|可售|库存|元|¥|￥|\$|折|天|小时)/.test(value)) return;
    if (!attrs[key]) attrs[key] = value;
  };

  let ldTitle = "";
  let ldAuthor = "";
  let ldDate = "";
  let hasLdProduct = false;
  let hasLdArticle = false;
  let hasProductJson = false;
  const ldMainImages = [];
  const ldSkuImages = [];
  const ldVideos = [];
  const skuNames = [];
  const walkProduct = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walkProduct); return; }
    const type = [].concat(node["@type"] || []).join(" ").toLowerCase();
    if (/videoobject/.test(type)) {
      const vu = node.contentUrl || node.embedUrl || node.url;
      if (vu) ldVideos.push(vu);
    }
    if (/\b(?:article|blogposting|newsarticle|techarticle|report|scholarlyarticle|socialmediaposting|discussionforumposting|webpage)\b/.test(type) && !/product/.test(type)) {
      if (!/webpage/.test(type)) hasLdArticle = true;
      if (node.headline && !ldTitle) ldTitle = cleanTitle(node.headline);
      const au = typeof node.author === "string" ? node.author : (Array.isArray(node.author) ? node.author[0]?.name : node.author?.name);
      if (au && !ldAuthor) ldAuthor = String(au).trim();
      if ((node.datePublished || node.dateCreated) && !ldDate) ldDate = String(node.datePublished || node.dateCreated).slice(0, 19);
    }
    if (/product/.test(type)) {
      hasLdProduct = true;
      if (node.name && !ldTitle) ldTitle = cleanTitle(node.name);
      const isZhLd = /^zh\b/i.test(document.documentElement?.lang || "") || /[\u4e00-\u9fff]/.test(node.name || document.title || "");
      put(isZhLd ? "产品名称" : "Product Name", node.name);
      put(isZhLd ? "品牌" : "Brand", typeof node.brand === "string" ? node.brand : node.brand?.name);
      put(isZhLd ? "型号" : "Model", node.model || node.mpn || node.sku);
      put("SKU", node.sku);
      put(isZhLd ? "颜色" : "Color", node.color);
      put(isZhLd ? "材质" : "Material", node.material);
      put(isZhLd ? "产品描述" : "Description", node.description);
      put(isZhLd ? "产品尺寸" : "Dimensions", typeof node.size === "string" ? node.size : "");
      put(isZhLd ? "产品重量" : "Weight", typeof node.weight === "string" ? node.weight : (node.weight?.value ? `${node.weight.value}${node.weight.unitCode || node.weight.unitText || ""}` : ""));
      const imgs = Array.isArray(node.image) ? node.image : (node.image ? [node.image] : []);
      imgs.forEach(im => {
        const u = typeof im === "string" ? im : (im?.url || im?.contentUrl || "");
        if (u) ldMainImages.push(u);
      });
      (Array.isArray(node.additionalProperty) ? node.additionalProperty : []).forEach(x => put(x?.name, x?.value));
      (Array.isArray(node.hasVariant) ? node.hasVariant : []).forEach(v => {
        if (v?.name && !skuNames.includes(v.name)) skuNames.push(v.name);
        const vImg = typeof v?.image === "string" ? v.image : v?.image?.url;
        if (vImg) ldSkuImages.push(vImg);
      });
    }
    Object.values(node).forEach(walkProduct);
  };
  queryAllDeep('script[type="application/ld+json"]').forEach(script => {
    try { walkProduct(JSON.parse(script.textContent)); } catch {}
  });

  // Shopify / 独立站 ProductJson 与 WooCommerce data-product_variations 提取
  queryAllDeep('script[type="application/json"][id*="ProductJson"], script[data-product-json], script[id*="product-json"]').forEach(script => {
    try {
      const prod = JSON.parse(script.textContent);
      if (prod && typeof prod === "object" && (prod.variants || prod.images || prod.vendor)) {
        hasProductJson = true;
        if (prod.title && !ldTitle) ldTitle = cleanTitle(prod.title);
        const isZhProd = /^zh\b/i.test(document.documentElement?.lang || "") || /[\u4e00-\u9fff]/.test(prod.title || document.title || "");
        if (prod.vendor) put(isZhProd ? "品牌" : "Brand", prod.vendor);
        if (prod.type) put(isZhProd ? "品类" : "Category", prod.type);
        (Array.isArray(prod.images) ? prod.images : []).forEach(u => {
          if (typeof u === "string") ldMainImages.push(u);
          else if (u?.src) ldMainImages.push(u.src);
        });
        (Array.isArray(prod.variants) ? prod.variants : []).forEach(v => {
          if (v?.title && v.title !== "Default Title" && !skuNames.includes(v.title)) skuNames.push(v.title);
          const vImg = v?.featured_image?.src || v?.featured_media?.preview_image?.src || (typeof v?.image === "string" ? v.image : "");
          if (vImg) ldSkuImages.push(vImg);
        });
      }
    } catch {}
  });
  queryAllDeep("form.variations_form[data-product_variations], [data-product_variations]").forEach(form => {
    try {
      const vars = JSON.parse(form.getAttribute("data-product_variations") || "[]");
      if (Array.isArray(vars) && vars.length) {
        hasProductJson = true;
        vars.forEach(v => {
          const imgUrl = v?.image?.full_src || v?.image?.src || v?.image?.url || "";
          if (imgUrl) ldSkuImages.push(imgUrl);
          if (v?.attributes && typeof v.attributes === "object") {
            const label = Object.values(v.attributes).filter(Boolean).join(" / ");
            if (label && !skuNames.includes(label)) skuNames.push(label);
          }
        });
      }
    } catch {}
  });

  // 判定当前页是「电商商品页」还是「非电商网页（博客/公众号/知乎/CSDN/掘金/小红书/资讯/评测/文档）」
  const CONTENT_HOST_RE = /(?:^|\.)(?:mp\.weixin\.qq\.com|zhuanlan\.zhihu\.com|zhihu\.com|blog\.csdn\.net|csdn\.net|juejin\.cn|jianshu\.com|cnblogs\.com|medium\.com|substack\.com|dev\.to|hashnode\.com|wordpress\.com|blogspot\.com|ghost\.io|36kr\.com|huxiu\.com|infoq\.cn|oschina\.net|segmentfault\.com|sspai\.com|bilibili\.com|xiaohongshu\.com|toutiao\.com|sohu\.com|163\.com|sina\.com\.cn|wikipedia\.org|baike\.baidu\.com|github\.com|notion\.site|yuque\.com|v2ex\.com|reddit\.com)$/i;
  const ECOM_HOST_RE = /(?:^|\.)(?:1688\.com|taobao\.com|tmall\.com|tmall\.hk|jd\.com|jd\.hk|yangkeduo\.com|pinduoduo\.com|vip\.com|suning\.com|dangdang\.com|amazon\.[a-z.]+|aliexpress\.[a-z.]+|alibaba\.com|ebay\.[a-z.]+|etsy\.com|walmart\.com|target\.com|bestbuy\.com|wayfair\.com|newegg\.com|overstock\.com|shopee\.[a-z.]+|lazada\.[a-z.]+|tokopedia\.com|bukalapak\.com|tiki\.vn|ozon\.ru|wildberries\.ru|lamoda\.ru|rakuten\.co\.jp|shopping\.yahoo\.co\.jp|zozo\.jp|qoo10\.jp|coupang\.com|gmarket\.co\.kr|11st\.co\.kr|mercadolivre\.[a-z.]+|mercadolibre\.[a-z.]+|cdiscount\.com|fnac\.com|otto\.de|kaufland\.de|zalando\.[a-z.]+|bol\.com|allegro\.pl|temu\.com|shein\.[a-z.]+|dhgate\.com|made-in-china\.com|globalsources\.com|indiamart\.com)$/i;
  const BLOG_PATH_RE = /\/(?:blogs?|posts?|articles?|news|press|wiki|docs|documentation|guides?|tutorials?|stories|magazine|journal|forum|community|zhuanlan|column|read|explore|notes?)(?:\/|$|\?)/i;
  const ECOM_PATH_RE = /\/(?:products?|item|offer|dp|gp\/product|goods|shop|store|buy|listing|sku)\b/i;

  const isKnownEcomHost = ECOM_HOST_RE.test(location.hostname);
  const isKnownContentHost = CONTENT_HOST_RE.test(location.hostname);
  const isBlogPath = BLOG_PATH_RE.test(location.pathname);
  const isEcomPath = !isKnownContentHost && ECOM_PATH_RE.test(location.pathname);

  // 从电商页面内嵌脚本提取 1688/淘宝/速卖通/京东/Amazon 原图与结构化商品属性（严禁在博客或普通脚本中盲目正则匹配通用 name/value）
  if (!isKnownContentHost && !isBlogPath) {
    try {
      const rawHtml = document.documentElement?.innerHTML || "";
      const skuImgRe = /"(?:imageUrl|propImage|skuImageUrl)"\s*:\s*"((?:\\.|[^"\\]){12,300})"/g;
      let m;
      while ((m = skuImgRe.exec(rawHtml)) && ldSkuImages.length < 80) {
        try { ldSkuImages.push(JSON.parse('"' + m[1] + '"')); } catch {}
      }
      const amzHiResRe = /"hiRes"\s*:\s*"(https?:[^"\\]+)"/g;
      while ((m = amzHiResRe.exec(rawHtml)) && ldMainImages.length < 40) {
        ldMainImages.push(m[1]);
      }
      const aeListMatch = rawHtml.match(/"imagePathList"\s*:\s*\[([^\]]{20,4000})\]/);
      if (aeListMatch) {
        for (const im of aeListMatch[1].matchAll(/"(https?:[^"\\]+)"/g)) {
          ldMainImages.push(im[1]);
        }
      }
      const jdListMatch = rawHtml.match(/imageList\s*:\s*\[([^\]]{10,3000})\]/);
      if (jdListMatch && /jd\.com|jd\.hk/i.test(location.hostname)) {
        for (const im of jdListMatch[1].matchAll(/"([^"\\]+\.(?:jpg|png|webp|avif))"/gi)) {
          ldMainImages.push(`https://img14.360buyimg.com/n1/${im[1].replace(/^\/+/, "")}`);
        }
      }
      const htmlVariants = [rawHtml];
      if (rawHtml.includes('\\"')) htmlVariants.push(rawHtml.replace(/\\"/g, '"'));
      for (const hSrc of htmlVariants) {
        const strictAttrRe = /\{[^{}]{6,420}\}/g;
        let om;
        while ((om = strictAttrRe.exec(hSrc)) && Object.keys(attrs).length < 160) {
          const blk = om[0];
          if (!/(?:attrName|propName)/.test(blk) || !/(?:attrValue|propValue)/.test(blk)) continue;
          const km = blk.match(/"(?:attrName|propName)"\s*:\s*"((?:\\.|[^"\\]){1,32})"/);
          const vm = blk.match(/"(?:attrValue|propValue)"\s*:\s*"((?:\\.|[^"\\]){1,240})"/);
          if (km && vm) {
            try { put(JSON.parse('"' + km[1] + '"'), JSON.parse('"' + vm[1] + '"')); } catch {}
          }
        }
      }
    } catch {}
  }

  // 标题提取：兼容各大电商与微信/知乎/CSDN/掘金/Medium/小红书等博客标题
  const titleCandidates = [
    ldTitle,
    document.querySelector(
      "#productTitle, #activity-name, .Post-Title, .QuestionHeader-title, #articleContentId, .title-article, .article-title, " +
      ".sku-name, .ItemHeader--mainTitle, .tb-main-title, .product-title, [class*='title-text'], [data-testid*='title'], article h1, h1"
    )?.innerText,
    document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content,
    document.title,
  ].map(cleanTitle).filter(s => s && s.length >= 2);
  const title = titleCandidates.find(s => !/(?:有限公司|有限责任公司|工厂|旗舰店|专营店|官方店)$/.test(s)) || titleCandidates[0] || location.hostname;

  const author = ldAuthor || (
    document.querySelector("#js_name, .AuthorInfo-name, .follow-nickName, .author-name, [rel='author'], [itemprop='author'], meta[name='author']")?.getAttribute?.("content") ||
    document.querySelector("#js_name, .AuthorInfo-name, .follow-nickName, .author-name, [rel='author'], [itemprop='author']")?.innerText ||
    ""
  ).replace(/\s+/g, " ").trim().slice(0, 60);
  const publishTime = ldDate || (
    document.querySelector("#publish_time, time[datetime], meta[property='article:published_time'], .Post-Time, .time, .publish-time, .post-date")?.getAttribute?.("datetime") ||
    document.querySelector("meta[property='article:published_time']")?.getAttribute?.("content") ||
    document.querySelector("#publish_time, .Post-Time, .publish-time, .post-date")?.innerText ||
    ""
  ).replace(/\s+/g, " ").trim().slice(0, 40);

  const NOISE_SEL = "header, footer, nav, aside, [role='navigation'], [role='banner'], [role='contentinfo'], " +
    "[class*='recommend'], [class*='related'], [class*='similar'], [class*='sponsored'], [class*='hot-sale'], " +
    "[class*='review'], [class*='comment'], [class*='buyer'], [class*='avatar'], [class*='qrcode'], [class*='footer'], " +
    "[class*='sidebar'], [class*=' navbar'], [class*='breadcrumb'], " +
    "[id*='recommend'], [id*='related'], [id*='reviews'], [id*='comment'], [id*='sp_detail'], #Histogram, #reviewsMedley";
  const NOISE_TEXT_RE = /猜你喜欢|看了又看|掌柜推荐|相关推荐|相似商品|同店推荐|买家评价|商品评价|晒图|Customer Reviews|Customers also viewed|Related products|Sponsored products|You may also like|Frequently bought together/i;
  const isInNoise = el => {
    if (!el || !el.closest) return false;
    if (el.closest(NOISE_SEL)) return true;
    let cur = el.parentElement;
    for (let depth = 0; cur && depth < 4; depth++, cur = cur.parentElement) {
      if (cur === document.body || cur === document.documentElement || cur.tagName === "MAIN" || cur.querySelector?.("h1")) break;
      const heading = cur.querySelector?.(":scope > h2, :scope > h3, :scope > h4, :scope > [class*='title'], :scope > [class*='header']");
      if (heading && NOISE_TEXT_RE.test((heading.innerText || "").slice(0, 80))) return true;
    }
    return false;
  };

  if (!isKnownContentHost && !isBlogPath) {
    const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]')?.content || "";
    const metaCurr = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]')?.content || "";
    if (metaPrice) {
      put("价格", `${metaCurr ? metaCurr + " " : ""}${metaPrice}`);
    } else {
      const priceDom = document.querySelector(".price-text, .od-pc-offer-price-contain, .a-price .a-offscreen, .p-price .price, [itemprop='price'], .product-price, [class*='product-price']");
      if (priceDom) {
        const pVal = (priceDom.getAttribute("content") || priceDom.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (/\d/.test(pVal)) put("价格", pVal);
      }
    }

    queryAllDeep("table tr").forEach(row => {
      if (isInNoise(row)) return;
      const cells = [...row.querySelectorAll("th,td")].map(x => (x.innerText || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
      if (cells.length === 2) {
        put(cells[0], cells[1]);
      } else if (cells.length >= 4 && cells.length % 2 === 0 && cells.every((c, i) => i % 2 === 1 || c.length <= 28)) {
        for (let i = 0; i + 1 < cells.length; i += 2) put(cells[i], cells[i + 1]);
      }
    });
    queryAllDeep("dl").forEach(dl => {
      if (isInNoise(dl)) return;
      [...dl.querySelectorAll("dt")].forEach(dt => {
        const dd = dt.nextElementSibling || dt.parentElement?.querySelector("dd");
        if (dd && dd.tagName === "DD") put(dt.innerText, dd.innerText);
      });
    });
    queryAllDeep("[itemprop]").forEach(el => {
      if (isInNoise(el)) return;
      const key = el.getAttribute("itemprop");
      if (/^(?:name|brand|sku|model|mpn|material|color|size|weight|capacity|power|voltage|width|height|depth|price)$/i.test(key))
        put(key, el.getAttribute("content") || el.innerText);
    });
    queryAllDeep(
      "[data-module='od_product_attributes'], .module-od-product-attributes, [data-module*='attribute'], [data-module*='cross'], .od-pc-attribute, .od-pc-offer-cross, " +
      "#J_AttrUL li, .attributes-list li, [class*='Attrs--attr'], [class*='emphasisParams'] [class*='item'], " +
      ".parameter2 li, .Ptable-item dl, #detailBullets_feature_div li, #productOverview_feature_div tr, " +
      ".product-prop-list li, [class*='specification--prop'], .do-entry-list dl, .ux-layout-section-evo__item, " +
      ".ant-descriptions-item, [class*='product-attr'] li, [class*='product-spec'] li, [class*='spec-list'] li, [class*='attr-item'], [class*='spec-item'], [class*='param-item']"
    ).forEach(el => {
      if (Object.keys(attrs).length >= 160 || isInNoise(el)) return;
      if (el.matches("[data-module='od_product_attributes'], .module-od-product-attributes, .od-pc-attribute, .od-pc-offer-cross")) {
        let pairCount = 0;
        el.querySelectorAll("*").forEach(ch => {
          if (ch.children.length === 2 && ch.children[0].children.length === 0 && ch.children[1].children.length <= 1) {
            const k = (ch.children[0].innerText || "").trim();
            const v = (ch.children[1].innerText || "").trim();
            if (k && v && k.length <= 28) { put(k, v); pairCount++; }
          }
        });
        if (pairCount === 0) {
          const lines = (el.innerText || "").split(/\n+/).map(x => x.trim()).filter(Boolean).filter(x => !/^(?:商品属性|跨境属性|包装信息|展开|收起)$/.test(x));
          for (let i = 0; i + 1 < lines.length; i += 2) put(lines[i], lines[i + 1]);
        }
        return;
      }
      if (el.children.length > 5) return;
      const text = (el.innerText || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
      const match = text.match(/^([^:：]{1,28})\s*[:：]\s*(.{1,220})$/);
      if (match) {
        put(match[1], match[2]);
      } else if (el.children.length === 2 && el.children[0].children.length <= 1 && el.children[1].children.length <= 2) {
        const k = (el.children[0].innerText || "").trim();
        const v = (el.children[1].innerText || "").trim();
        if (k.length >= 1 && k.length <= 28 && v.length >= 1 && v.length <= 220) put(k, v);
      }
    });
  }

  const ogType = (document.querySelector('meta[property="og:type"]')?.content || "").toLowerCase();
  const hasPriceMeta = Boolean(document.querySelector(
    'meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"], [itemtype*="schema.org/Product"], .woocommerce-product-gallery, #productTitle, #imageBlock, .od-gallery, [data-product-id]'
  ));
  const hasProductAttrs = Object.keys(attrs).some(k => /^(?:材质|产品尺寸|产品重量|容量|功率|电压|起订量|装箱数|箱子尺寸|箱子毛重|箱子净重|品牌|型号|规格)$/.test(k));
  const articleRootEl = document.querySelector(
    "#js_content, .rich_media_content, .Post-RichTextContainer, .RichContent-inner, #content_views, .article-viewer, " +
    "article .post-content, article .entry-content, .article-content, .blog-content, .post-body, .article-body, .note-content, article"
  );
  const hasStrongArticleBody = Boolean(articleRootEl && (articleRootEl.innerText || "").trim().length >= 180);
  const hasArticleMeta = ogType === "article" || ogType === "blog" || hasLdArticle || isBlogPath || isKnownContentHost || hasStrongArticleBody;
  const hasBuyAction = !isKnownContentHost && !isBlogPath && queryAllDeep("button, a, input[type='submit'], input[type='button'], [role='button']").some(el => {
    const t = ((el.innerText || el.value || el.getAttribute("aria-label") || "") + " " + (el.id || "") + " " + (el.className || "")).trim();
    return t.length >= 2 && t.length <= 120 && /(?:add[-_ ]?to[-_ ]?(?:cart|bag|basket)|buy[-_ ]?now|加入购物车|立即购买|立即订购|去结算|立即询价|联系供应商|添加到购物车|放入购物车|В корзину|Купить сейчас|カートに入れる|장바구니)/i.test(t);
  });

  const isEcommerce = Boolean(
    !isKnownContentHost && !isBlogPath && (
      isKnownEcomHost ||
      hasLdProduct ||
      hasProductJson ||
      /product/.test(ogType) ||
      hasPriceMeta ||
      hasBuyAction ||
      isEcomPath ||
      (hasProductAttrs && !hasArticleMeta)
    )
  );

  const main = [], detail = [], sku = [], unknown = [], seen = new Set(), assetCounts = {}, imageDims = {}, imageMeta = {};
  let imageCapReached = false, videoCapReached = false;
  const videos = [], unsupportedMedia = [], addVideo = raw => {
    if (videos.length >= 40) { videoCapReached = true; return; }
    let s = String(raw || "").trim();
    if (!s) return;
    if (/^data:image\/svg\+xml/i.test(s)) {
      if (!videos.includes(s)) videos.push(s);
      return;
    }
    let url = absolute(s);
    if (!url) return;
    if (/\.gifv(?:[?#]|$)/i.test(url)) url = url.replace(/\.gifv([?#]|$)/i, ".mp4$1");
    if (/^blob:/i.test(url) || /\.m3u8(?:[?#]|$)/i.test(url)) {
      unsupportedMedia.push(url.startsWith("blob:") ? "页面使用临时/加密视频流，无法作为普通视频文件下载" : "页面使用 HLS/m3u8 分段流，暂不直接下载");
      return;
    }
    if (/^https?:/i.test(url) && !videos.includes(url)) {
      videos.push(url);
      try { const origin = new URL(url).origin; assetCounts[origin] = (assetCounts[origin] || 0) + 1; } catch {}
    }
  };
  const baseKey = u => u.replace(/[?#].*$/, "").replace(/(?:_\d+x\d+[^/]*|\.\d+x\d+[a-z0-9_]*)(?=\.[a-z]{3,4}$)/i, "");
  const isAnimationAsset = (url, context = "") => {
    if (!url) return false;
    if (/\.(?:gif|apng|gifv|mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url)) return true;
    if (/\.webp(?:[?#]|$)/i.test(url) && /(?:anim|gif|motion|loop|动图|动画)/i.test(url + " " + context)) return true;
    if (/[?&](?:format|fmt|type|wx_fmt)=(?:gif|apng|mp4|webm)\b/i.test(url)) return true;
    return false;
  };
  const isJunkImageUrl = (u, ctx = "") => {
    if (!u || !/^https?:/i.test(u) || /\.(?:svg|ico)(?:[?#]|$)/i.test(u)) return true;
    const pathPart = u.split(/[?#]/)[0];
    if (/(?:^|[\/_.-])(?:spacer|blank|1x1|pixel|empty|lazyload|loading|spinner|placeholder)\.(?:gif|png|jpg|webp)$/i.test(pathPart)) return true;
    if (/(?:^|[\/_.-])(?:avatar|favicon|site-logo|header-logo|footer-logo|sprite|qrcode|qr-code|payment-icon|trustpilot|star-rating|badge-icon)(?:[\/_.-]|$)/i.test(pathPart)) return true;
    if (/\b(?:user-avatar|author-avatar|comment-avatar|site-logo|navbar-brand|qrcode|qr-code|payment-icons?|social-icons?|share-icons?)\b/i.test(ctx)) return true;
    return false;
  };
  const addImage = (raw, kind, context = "", width = 0, height = 0, topY = 9999) => {
    if (seen.size >= 240) { imageCapReached = true; return; }
    const rawAbs = absolute(raw);
    const url = upgradeImageUrl(raw);
    if (isJunkImageUrl(url, context)) return;
    if (isAnimationAsset(url, context)) {
      addVideo(url);
      return;
    }
    const wasUpgraded = Boolean(rawAbs && url && rawAbs !== url);
    if (kind !== "sku" && kind !== "main" && !wasUpgraded && width > 0 && height > 0 && width < 56 && height < 56) return;
    const effectiveW = (wasUpgraded && width < 260) ? 0 : width;
    const effectiveH = (wasUpgraded && height < 260) ? 0 : height;
    if (effectiveW > 0 && effectiveH > 0) {
      const prev = imageDims[url];
      if (!prev || (effectiveW * effectiveH > prev.w * prev.h)) imageDims[url] = { w: effectiveW, h: effectiveH };
    }
    if (!imageMeta[url]) {
      imageMeta[url] = {
        context: String(context || "").slice(0, 320),
        w: effectiveW || 0,
        h: effectiveH || 0,
        topY: topY || 9999,
        kind,
        rawUrl: wasUpgraded ? rawAbs : "",
      };
    } else if (context && !imageMeta[url].context.includes(context.slice(0, 40))) {
      imageMeta[url].context = (imageMeta[url].context + " " + context).slice(0, 360);
    }
    const key = baseKey(url);
    if (seen.has(key)) return;
    seen.add(key);
    try { const origin = new URL(url).origin; assetCounts[origin] = (assetCounts[origin] || 0) + 1; } catch {}
    if (kind === "sku") sku.push(url);
    else if (kind === "main") main.push(url);
    else if (kind === "detail") detail.push(url);
    else unknown.push({ url, width: effectiveW, height: effectiveH, topY, context });
  };

  const pickBestImgUrl = img => {
    const dyn = img.getAttribute("data-a-dynamic-image");
    if (dyn) {
      try {
        const obj = JSON.parse(dyn);
        const best = Object.entries(obj).sort((a, b) => ((b[1]?.[0] || 0) * (b[1]?.[1] || 0)) - ((a[1]?.[0] || 0) * (a[1]?.[1] || 0)))[0];
        if (best?.[0]) return best[0];
      } catch {}
    }
    const bestSrcset = pickBestFromSrcset(img.getAttribute("srcset") || img.getAttribute("data-srcset") || img.getAttribute("data-lazy-srcset") || "");
    const candidates = [
      img.getAttribute("data-old-hires"),
      img.getAttribute("data-zoom-image"),
      img.getAttribute("data-large_image"),
      img.getAttribute("data-large-image"),
      img.getAttribute("data-orig-file"),
      img.getAttribute("data-large-file"),
      img.getAttribute("data-original"),
      img.getAttribute("data-actualsrc"),
      img.getAttribute("data-hi-res-src"),
      img.getAttribute("data-origin-src"),
      img.getAttribute("data-master"),
      img.getAttribute("data-image"),
      img.getAttribute("data-src"),
      img.getAttribute("data-lazy-src"),
      img.getAttribute("data-lazyload-src"),
      img.getAttribute("data-lazy"),
      img.getAttribute("data-ks-lazyload"),
      img.getAttribute("data-echo"),
      img.getAttribute("o-src"),
      bestSrcset,
      img.currentSrc,
      img.src,
    ];
    for (const c of candidates) {
      if (c && !String(c).startsWith("data:") && !/(?:^|[\/_.-])(?:blank|spacer|1x1|lazyload|loading|placeholder)\.(?:gif|png|jpg|webp)/i.test(c)) return c;
    }
    return "";
  };

  const MAIN_SEL = ".od-gallery, .od-gallery-img-content, .main-slider, .img-list-wrapper, .detail-gallery, " +
    "#altImages, #imgTagWrapperId, #imageBlock, #spec-list, #spec-n1, .product-gallery, .product-media, .product-images, " +
    ".woocommerce-product-gallery, .images-view-list, .ux-image-carousel, .ux-image-grid, " +
    "[class*='PicGallery'], [class*='mainGallery'], [class*='product-gallery'], [class*='gallery-'], [class*='Gallery'], [data-testid*='gallery']";
  const SKU_SEL = ".sku-item, .sku-item-image, .od-sku-property, #choose-attrs .item, #variation_color_name li, #variation_size_name li, " +
    "[class*='SkuContent'] [class*='valueItem'], [class*='sku-property-item'], [class*='sku'], [class*='variant'], [class*='swatch'], [id*='variation_'], [data-sku]";
  const DETAIL_SEL = "#desc-lazyload-container, .content-detail, #de_description_detail, #productDescription, #aplus, " +
    "#dpx-aplus-product-description_feature_div, .aplus-v2, #J-detail-content, .detail-content, .product-description, .product-detail, " +
    ".woocommerce-Tabs-panel--description, #product-description, .detail-desc-decorate-richtext, " +
    "#js_content, .rich_media_content, .Post-RichTextContainer, .RichContent-inner, #content_views, .article-viewer, " +
    "article, .post-content, .entry-content, .article-content, .blog-content, .markdown-body, .note-content, " +
    "[class*='detail-content'], [class*='desc-content'], [class*='description'], [id*='desc'], [id*='detail']";

  ldMainImages.forEach(u => addImage(u, "main", "json-ld product image"));
  if (isEcommerce) ldSkuImages.forEach(u => addImage(u, "sku", "json sku hi-res image"));
  queryAllDeep('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => addImage(meta.content, "main", "og main image"));

  // 解析 <noscript> 内嵌的真实 <img>
  queryAllDeep("noscript").forEach(ns => {
    if (isInNoise(ns)) return;
    const html = ns.innerHTML || ns.textContent || "";
    if (!html.includes("<img")) return;
    const inMain = Boolean(ns.closest(MAIN_SEL));
    const inDetail = Boolean(ns.closest(DETAIL_SEL));
    const kind = inMain ? "main" : (inDetail || !isEcommerce ? "detail" : "unknown");
    for (const m of html.matchAll(/\b(?:data-original|data-actualsrc|data-src|src)=["']([^"']+)["']/gi)) {
      addImage(m[1], kind, "noscript-img");
    }
  });

  queryAllDeep("img").forEach(img => {
    if (isInNoise(img)) return;
    const classAndIdCtx = [img.className, img.parentElement?.className, img.parentElement?.parentElement?.className, img.closest("[id]")?.id].filter(Boolean).join(" ").slice(0, 360);
    const rect = img.getBoundingClientRect?.() || { width: 0, height: 0, top: 9999 };
    const hasLazyAttr = Boolean(
      img.getAttribute("data-a-dynamic-image") || img.getAttribute("data-old-hires") ||
      img.getAttribute("data-zoom-image") || img.getAttribute("data-large_image") ||
      img.getAttribute("data-large-image") || img.getAttribute("data-orig-file") ||
      img.getAttribute("data-large-file") || img.getAttribute("data-original") ||
      img.getAttribute("data-actualsrc") || img.getAttribute("data-hi-res-src") ||
      img.getAttribute("data-src") || img.getAttribute("data-lazy-src") ||
      img.getAttribute("data-lazyload-src") || img.getAttribute("data-lazy") ||
      img.getAttribute("data-ks-lazyload") || img.getAttribute("o-src")
    );
    const rawW = (!hasLazyAttr && img.naturalWidth > 0) ? img.naturalWidth : (img.width || Math.round(rect.width) || 0);
    const rawH = (!hasLazyAttr && img.naturalHeight > 0) ? img.naturalHeight : (img.height || Math.round(rect.height) || 0);
    const isTinyPlaceholder = (hasLazyAttr || !img.naturalWidth) && rawW < 64 && rawH < 64;
    const w = isTinyPlaceholder ? 0 : rawW;
    const h = isTinyPlaceholder ? 0 : rawH;
    const topY = Math.round((rect.top || 0) + (window.scrollY || 0));
    let kind = "unknown";
    const skuContainer = isEcommerce ? img.closest(SKU_SEL) : null;
    if (isEcommerce && (skuContainer || /\b(?:sku|variant|swatch)\b|颜色分类|款式选择/i.test(classAndIdCtx))) {
      kind = "sku";
      const label = (img.alt || img.title || skuContainer?.getAttribute("title") || skuContainer?.innerText || "").replace(/\s+/g, " ").trim();
      if (label && label.length <= 36 && !skuNames.includes(label)) skuNames.push(label);
      const containerHiRes = skuContainer?.getAttribute("data-image") || skuContainer?.getAttribute("data-large-image") || skuContainer?.getAttribute("data-zoom-image") || skuContainer?.getAttribute("data-src");
      if (containerHiRes) addImage(containerHiRes, "sku", classAndIdCtx, 0, 0, topY);
    } else if (isEcommerce && (img.closest(MAIN_SEL) || /\b(?:gallery|main[-_ ]?image|product[-_ ]?image|thumb)\b|主图|轮播/i.test(classAndIdCtx))) {
      kind = "main";
    } else if (img.closest(DETAIL_SEL) || !isEcommerce || /\b(?:detail|description|desc|article|post|content)\b|详情|正文/i.test(classAndIdCtx)) {
      kind = "detail";
    }
    addImage(pickBestImgUrl(img), kind, classAndIdCtx, (kind === "sku" || kind === "main") ? 0 : w, (kind === "sku" || kind === "main") ? 0 : h, topY);
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
    const bestSrcset = pickBestFromSrcset(srcset);
    if (bestSrcset) addImage(bestSrcset, kind, classAndIdCtx, (kind === "sku" || kind === "main") ? 0 : w, (kind === "sku" || kind === "main") ? 0 : h, topY);
  });

  if (isEcommerce && skuNames.length && !attrs["规格"] && !attrs["颜色"] && !attrs["Color"] && !attrs["Variants"]) {
    const isZhTitle = /[\u4e00-\u9fff]/.test(title);
    put(isZhTitle ? "规格" : "Variants", skuNames.slice(0, 30).join(" / "));
  }

  queryAllDeep("picture source[srcset]").forEach(source => {
    if (isInNoise(source)) return;
    const context = [source.className, source.parentElement?.className].filter(Boolean).join(" ");
    const bestSrcset = pickBestFromSrcset(source.srcset);
    if (bestSrcset) {
      const kind = (isEcommerce && source.closest(MAIN_SEL)) ? "main" : (source.closest(DETAIL_SEL) || !isEcommerce ? "detail" : "unknown");
      addImage(bestSrcset, kind, context);
    }
  });

  queryAllDeep("[style*='background'], .ssd-module, [class*='image'], [class*='img'], [data-image], [data-large-image]").forEach(el => {
    if (isInNoise(el)) return;
    const context = [el.className, el.id, el.getAttribute("aria-label"), el.parentElement?.className].filter(Boolean).join(" ").slice(0, 400);
    const kind = (isEcommerce && el.closest(SKU_SEL)) ? "sku" : ((isEcommerce && el.closest(MAIN_SEL)) ? "main" : (el.closest(DETAIL_SEL) || el.classList?.contains("ssd-module") ? "detail" : "unknown"));
    const dataImg = el.getAttribute("data-large-image") || el.getAttribute("data-image") || el.getAttribute("data-zoom-image");
    if (dataImg) addImage(dataImg, kind, context);
    let bg = "";
    try { bg = getComputedStyle(el).backgroundImage || ""; } catch {}
    for (const match of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) addImage(match[1], kind, context);
  });

  unknown.forEach(item => {
    const minDim = isEcommerce ? 150 : 75;
    if (item.width && item.height && item.width < minDim && item.height < minDim) return;
    const ratio = (item.width && item.height) ? (item.width / item.height) : 1;
    if (isEcommerce && main.length < 6 && item.topY < 1350 && ratio >= 0.45 && ratio <= 2.2) {
      main.push(item.url);
    } else if (!isEcommerce && main.length === 0 && item.topY < 900 && ratio >= 0.5 && ratio <= 2.5) {
      main.push(item.url);
    } else {
      detail.push(item.url);
    }
  });

  if (main.length > 0 && detail.length > main.length) {
    const mainSet = new Set(main.map(baseKey));
    const dedupDetail = detail.filter(u => !mainSet.has(baseKey(u)));
    if (dedupDetail.length > 0) {
      detail.length = 0;
      detail.push(...dedupDetail);
    }
  }

  ldVideos.forEach(addVideo);
  queryAllDeep("video").forEach(video => {
    addVideo(video.currentSrc || video.src || video.getAttribute("data-src") || video.getAttribute("data-lazy-src"));
    if (video.poster && !isInNoise(video)) addImage(video.poster, "main", "video poster", video.videoWidth, video.videoHeight);
    video.querySelectorAll("source").forEach(source => addVideo(source.src || source.getAttribute("src") || source.getAttribute("data-src")));
  });
  queryAllDeep("[data-video], [data-video-url], [data-video-src], [data-mp4], [data-gif], [data-gifv], [data-animation], [data-anim]").forEach(el => {
    addVideo(
      el.getAttribute("data-video") || el.getAttribute("data-video-url") ||
      el.getAttribute("data-video-src") || el.getAttribute("data-mp4") ||
      el.getAttribute("data-gif") || el.getAttribute("data-gifv") ||
      el.getAttribute("data-animation") || el.getAttribute("data-anim")
    );
  });
  queryAllDeep("lottie-player, dotlottie-player, [data-animation-path], [data-lottie], [data-lottie-url]").forEach(el => {
    addVideo(el.getAttribute("src") || el.getAttribute("data-animation-path") || el.getAttribute("data-lottie") || el.getAttribute("data-lottie-url"));
  });
  queryAllDeep("svg").forEach(svg => {
    if (isInNoise(svg)) return;
    if (!svg.querySelector("animate, animateTransform, animateMotion")) return;
    const rect = svg.getBoundingClientRect?.() || { width: 0, height: 0 };
    if (rect.width < 80 && rect.height < 80) return;
    try {
      const clone = svg.cloneNode(true);
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const rawSvg = new XMLSerializer().serializeToString(clone);
      if (rawSvg && rawSvg.length <= 500000) {
        addVideo("data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSvg));
      }
    } catch {}
  });
  queryAllDeep('meta[property="og:video"], meta[property="og:video:url"], meta[name="twitter:player:stream"]').forEach(meta => addVideo(meta.content));
  queryAllDeep("a[href]").forEach(a => {
    if (/\.(?:mp4|webm|mov|gif|apng)(?:[?#]|$)/i.test(a.href)) addVideo(a.href);
  });

  const extractCleanCopyText = () => {
    const selectors = [
      "#js_content", ".rich_media_content", ".Post-RichTextContainer", ".RichContent-inner",
      "#content_views", ".htmledit_views", ".markdown_views", ".article-viewer", ".markdown-body",
      ".note-content", "#desc-editor", "article .post-content", "article .entry-content",
      ".post-content", ".entry-content", ".article-content", ".blog-content", ".article-body",
      "article", "[role='article']", "#productDescription", ".product-description", "main", "[role='main']", "#content", ".content"
    ];
    let root = null;
    for (const sel of selectors) {
      const cand = document.querySelector(sel);
      if (cand && (cand.innerText || "").trim().length >= 50) {
        root = cand;
        break;
      }
    }
    if (!root) root = document.body;
    if (!root) return "";
    const blocks = [];
    const seenLine = new Set();
    const els = root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, blockquote, pre, li, figcaption, section");
    els.forEach(el => {
      if (isInNoise(el)) return;
      if (el.closest("nav, header, footer, aside, form, script, style, noscript, [class*='comment'], [id*='comment'], [class*='share'], [class*='sidebar'], [class*='recommend'], [class*='reward'], [class*='copyright']")) return;
      if ((el.tagName === "LI" || el.tagName === "P" || el.tagName === "SECTION") && el.querySelector("p, h1, h2, h3, h4, section, ul, ol, pre, blockquote")) return;
      const isPre = el.tagName === "PRE";
      const t = isPre ? (el.innerText || "").trim() : (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!t || t.length < 2) return;
      if (/^(?:登录|注册|分享|点赞|收藏|关注|举报|回复|展开|收起|阅读全文|版权声明|上一篇|下一篇|相关阅读|热门文章|目录|Table of Contents|赞赏|喜欢作者|微信扫一扫)$/i.test(t)) return;
      if (seenLine.has(t)) return;
      seenLine.add(t);
      const tag = el.tagName.toUpperCase();
      if (tag === "H1" && t === title) return;
      if (/^H[1-6]$/.test(tag)) blocks.push(`\n【${t}】`);
      else if (tag === "LI") blocks.push(`• ${t}`);
      else if (tag === "BLOCKQUOTE") blocks.push(`> ${t}`);
      else if (tag === "PRE") blocks.push(`\`\`\`\n${t}\n\`\`\``);
      else blocks.push(t);
    });
    const joined = blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (joined.length >= 50) return joined.slice(0, 35000);
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, nav, header, footer, aside, form, button, svg, [class*='comment'], [id*='comment'], [class*='sidebar'], [class*='recommend']").forEach(n => n.remove());
    return (clone.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 35000);
  };

  const origins = [...new Set([location.origin, ...Object.entries(assetCounts).sort((a, b) => b[1] - a[1]).map(([origin]) => origin)])]
    .map(origin => `${origin}/*`).slice(0, 20);
  const samePlatformLinks = [];
  try {
    queryAllDeep("a[href]").forEach(a => {
      if (samePlatformLinks.length >= 12) return;
      const u = absolute(a.getAttribute("href"));
      if (!u || u === location.href) return;
      try {
        const pu = new URL(u);
        if (pu.hostname === location.hostname && /(?:\/offer\/|\/item|\/product|\/dp\/|\/goods|\/detail|id=\d+)/i.test(pu.pathname + pu.search)) {
          if (!samePlatformLinks.includes(u)) samePlatformLinks.push(u);
        }
      } catch {}
    });
  } catch {}
  const pageText = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 20000);
  const copyText = extractCleanCopyText() || pageText;
  const metaDesc = (document.querySelector('meta[name="description"], meta[property="og:description"]')?.content || "").trim();
  const isZhPageFinal = /^zh\b/i.test(document.documentElement?.lang || "") || /[\u4e00-\u9fff]/.test(title || "");
  if (isEcommerce && title && isZhPageFinal) {
    put("产品名称", title);
    const matMatch = (title + " " + pageText.slice(0, 3000)).match(/(316L?不锈钢|304不锈钢|201不锈钢|食品级(?:硅胶|PP|PC|Tritan)|液态硅胶|高硼硅玻璃|铝合金|钛合金|纯钛|ABS|PP塑料|PC塑料|牛津布|帆布|真皮|PU皮|纯棉|涤纶|尼龙|陶瓷|实木|竹木|黄铜|碳纤维)/i);
    if (matMatch && !attrs["材质"]) put("材质", matMatch[1]);
    const capMatch = title.match(/\b(\d+(?:\.\d+)?\s*(?:ml|l|oz|毫升|升|加仑))(?=$|[^a-zA-Z0-9])/i);
    if (capMatch && !attrs["容量"]) put("容量", capMatch[1]);
    const noCartonText = pageText.slice(0, 4000)
      .replace(/(?:外箱|纸箱|箱规|整箱|大箱|包装箱)\s*[:：]?[^\n。；;]{0,80}/g, " ")
      .replace(/数量\s*[:：]?\s*\d+\s*[件个只套支双条袋盒]?\/箱[^\n。；;]{0,80}/g, " ")
      .replace(/(?:毛重|净重|毛净重|G\.?W\.?|N\.?W\.?)\s*[:：]?\s*\d+(?:\.\d+)?\s*(?:kg|g|千克|公斤)/gi, " ");
    const dimMatch = (title + " " + noCartonText).match(/\b(\d+(?:\.\d+)?\s*[×xX*]\s*\d+(?:\.\d+)?(?:\s*[×xX*]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|厘米|毫米))(?=$|[^a-zA-Z0-9])/i);
    if (dimMatch && !attrs["产品尺寸"]) put("产品尺寸", dimMatch[1]);
    const wtMatch = noCartonText.match(/(?:单件重量|单品重量|产品重量|单重|克重)\s*[:：]?\s*(\d+(?:\.\d+)?\s*(?:g|kg|克|千克|公斤))(?=$|[^a-zA-Z0-9])/i);
    if (wtMatch && !attrs["单件重量"]) put("单件重量", wtMatch[1]);
    if (!attrs["单位"]) {
      const um = pageText.slice(0, 2000).match(/(?:\d+\s*(个|件|套|支|只|盒|条|袋|瓶|杯|把|双|对|张|片|卷|本|副|组|台)\s*(?:起批|起订|及以上)|(?:元|¥|￥)\s*[\d.]+\s*[/／]\s*(个|件|套|支|只|盒|条|袋|瓶|杯|把|双|对|张|片|卷|本|副|组|台)(?=$|[^a-zA-Z\u4e00-\u9fa5]))/);
      const pickedU = um ? (um[1] || um[2] || "").trim() : "";
      if (pickedU) put("单位", pickedU);
    }
  }
  return {
    url: location.href,
    title: title.slice(0, 180),
    author,
    publishTime,
    pageLang: document.documentElement?.lang || "",
    isEcommerce,
    main,
    detail,
    sku,
    videos,
    attrs,
    imageDims,
    imageMeta,
    samePlatformLinks,
    pageText,
    copyText,
    metaDesc,
    unsupportedMedia: [...new Set(unsupportedMedia)],
    assetOrigins: origins,
    imageCapReached,
    videoCapReached,
    capturedAt: Date.now(),
  };
}

const $ = id => document.getElementById(id);

// 初始化弹窗：检测并展示当前标签页信息
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https?:\/\//i.test(tab.url || "")) {
      $("tabTitle").textContent = tab.title || "当前商品网页";
      $("tabUrl").textContent = tab.url;
    } else {
      $("tabTitle").textContent = "当前页面不可直接采集";
      $("tabUrl").textContent = "请切换到 http/https 商品网页后再点采集";
    }
  } catch {}
})();

async function openOrFocusPanelTab(targetUrl) {
  try {
    const panelBase = chrome.runtime.getURL("panel.html");
    const existing = await chrome.tabs.query({ url: `${panelBase}*` });
    if (existing && existing.length > 0) {
      const target = existing[0];
      await chrome.tabs.update(target.id, { url: targetUrl, active: true });
      if (target.windowId) await chrome.windows.update(target.windowId, { focused: true }).catch(() => {});
      return;
    }
  } catch {}
  await chrome.tabs.create({ url: targetUrl });
}

$("panel").onclick = () => openOrFocusPanelTab(chrome.runtime.getURL("panel.html"));

async function triggerCurrentTabCapture(autoStart = false) {
  const msg = $("msg");
  msg.textContent = "正在唤醒页面懒加载并提取图文参数…";
  $("cur").disabled = true;
  if ($("curImmediate")) $("curImmediate").disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("浏览器内部页、扩展页或本地文件页暂不支持，请打开普通商品网页");
    }
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractCurrentPage });
    let capture = results?.[0]?.result;
    if (/\.1688\.com\/.*offer\//i.test(tab.url || "")) {
      const specialized = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT" }).catch(() => null);
      if (specialized) {
        capture = {
          ...capture,
          ...specialized,
          isEcommerce: true,
          url: specialized.url || capture?.url || tab.url,
          title: specialized.title || capture?.title || tab.title,
          main: [...new Set([...(specialized.main || []), ...(capture?.main || [])])],
          detail: [...new Set([...(specialized.detail || []), ...(capture?.detail || [])])],
          sku: [...new Set([...(specialized.sku || []), ...(capture?.sku || [])])],
          videos: [...new Set([...(specialized.videos || []), ...(capture?.videos || [])])],
          attrs: { ...(capture?.attrs || {}), ...(specialized.attrs || {}) },
          imageDims: capture?.imageDims || {},
          packSpecs: (specialized.packSpecs && specialized.packSpecs.length) ? specialized.packSpecs : (capture?.packSpecs || []),
          detailUrl: specialized.detailUrl || capture?.detailUrl || "",
        };
      }
    }
    if (!capture || (!capture.title && !capture.main?.length && !capture.detail?.length && !Object.keys(capture.attrs || {}).length)) {
      throw new Error("当前页没有识别到可采集内容，请等待页面加载完成后重试");
    }
    capture.sourceTabId = tab.id;
    const id = crypto.randomUUID();
    if (chrome.storage?.session) {
      await chrome.storage.session.set({ [`xiaomie-capture:${id}`]: capture });
    }
    await chrome.storage.local.set({ lastCapture: capture });
    const panelUrl = `${chrome.runtime.getURL("panel.html")}#capture=${id}${autoStart ? "&autostart=1" : ""}`;
    await openOrFocusPanelTab(panelUrl);
  } catch (error) {
    msg.textContent = error?.message || "读取失败：请刷新页面后重试";
  } finally {
    $("cur").disabled = false;
    if ($("curImmediate")) $("curImmediate").disabled = false;
  }
}

$("cur").onclick = () => triggerCurrentTabCapture(false);
if ($("curImmediate")) $("curImmediate").onclick = () => triggerCurrentTabCapture(true);
