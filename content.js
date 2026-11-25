// 1688商品页深度内容提取：主图/详情图/SKU高清原图/视频/标题/全量商品属性与跨境箱规参数
(function () {
  const JUNK_IMG_RE = /(?:avatar|logo|icon|sprite|qrcode|qr-code|1x1|spacer|blank\.gif|lazyload|loading|tb1.*blank|payment|badge)/i;

  function norm(u) {
    if (!u) return null;
    u = String(u).trim().replace(/^url\(["']?|["']?\)$/gi, "").trim();
    if (!u || /^data:|^javascript:|^about:/i.test(u)) return null;
    if (u.startsWith("//")) u = "https:" + u;
    if (!/^https?:/i.test(u) || JUNK_IMG_RE.test(u)) return null;

    // 1) 剥离阿里系 OSS / CDN 缩略图查询参数（如 ?x-oss-process=image/resize,w_60,h_60 或 ?imageView2/...）
    try {
      const parsed = new URL(u);
      const dropParams = [
        "x-oss-process", "imageView2", "imageMogr2", "x-amz-process",
        "width", "height", "w", "h", "size", "resize", "fit", "crop", "quality", "q", "imwidth", "imheight", "tps"
      ];
      for (const k of dropParams) parsed.searchParams.delete(k);
      for (const k of [...parsed.searchParams.keys()]) {
        if (/^(?:imageView|imageMogr|x-oss-process)/i.test(k)) parsed.searchParams.delete(k);
      }
      u = parsed.href;
    } catch (e) {}
    u = u.replace(/\?(?:imageView2|imageMogr2|x-oss-process)[^#]*$/i, "");

    // 2) 循环剥离多层缩略图后缀（如 .60x60xz.jpg_60x60q90.jpg_.webp -> .jpg）
    for (let pass = 0; pass < 3; pass++) {
      const prev = u;
      u = u.replace(/_.webp(?=[?#]|$)/i, "");
      u = u.replace(/(\.(?:jpg|jpeg|png|gif|webp))\.(?:webp|avif)(?=[?#]|$)/i, "$1");
      u = u.replace(/(\.(?:jpg|jpeg|png|webp|gif))_(?:\d+x\d+[^/?#]*|sum|summ|m|b|s|q\d+|search\d*|b1|xz)(?:\.(?:jpg|jpeg|png|webp|gif))?(?=[?#]|$)/i, "$1");
      u = u.replace(/(?:_\d+x\d+[a-z0-9_]*|\.\d+x\d+[a-z0-9_]*|_(?:sum|summ|m|b|s|q\d+|search\d*|b1|xz)|\.(?:sum|summ|m|b|s|q\d+|search\d*|b1|xz))(?=\.(?:jpg|jpeg|png|webp|gif)(?:[?#]|$))/i, "");
      u = u.replace(/(_\d+x\d+[^/?#]*|_search\d*|_b1|_sum|_summ|_m|_q\d+)(?=[?#]|$)/i, "");
      if (u === prev) break;
    }
    return u;
  }

  function push(list, u) {
    u = norm(u);
    if (u && !list.includes(u) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(u)) list.push(u);
  }

  function pickBestFromSrcset(srcset) {
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
  }

  function imgSrc(el) {
    if (!el) return "";
    const bestSrcset = pickBestFromSrcset(el.getAttribute?.("srcset") || el.getAttribute?.("data-srcset") || "");
    const candidates = [
      el.getAttribute?.("data-original"),
      el.getAttribute?.("data-zoom-image"),
      el.getAttribute?.("data-large_image"),
      el.getAttribute?.("data-large-image"),
      el.getAttribute?.("data-hi-res-src"),
      el.getAttribute?.("data-origin-src"),
      el.getAttribute?.("data-image"),
      el.getAttribute?.("data-src"),
      el.getAttribute?.("data-lazy-src"),
      el.getAttribute?.("data-lazyload-src"),
      el.getAttribute?.("data-ks-lazyload"),
      el.getAttribute?.("o-src"),
      bestSrcset,
      el.currentSrc,
      el.src,
    ];
    for (const c of candidates) {
      if (c && !JUNK_IMG_RE.test(c) && !String(c).startsWith("data:")) return c;
    }
    return "";
  }

  function decodeJsonString(s) {
    try { return JSON.parse('"' + s + '"'); } catch (e) { return s; }
  }

  function productName(html) {
    const candidates = [];
    const subjectRe = /"(?:subject|offerSubject|title)"\s*:\s*"((?:\\.|[^"\\]){4,200})"/g;
    let m;
    while ((m = subjectRe.exec(html)) && candidates.length < 12) {
      const s = decodeJsonString(m[1]);
      if (s && !/^(?:1688|阿里巴巴|商品详情|首页)$/i.test(s.trim())) candidates.push(s);
    }
    const h1 = document.querySelector(".title-text, [class*='title-content'] h1, h1");
    if (h1 && h1.innerText) candidates.push(h1.innerText);
    const og = document.querySelector("meta[property='og:title']");
    if (og && og.content) candidates.push(og.content);
    if (document.title) candidates.push(document.title.replace(/\s*[-_|]\s*阿里巴巴.*$/i, "").replace(/[-_].*1688.*$/i, ""));
    const clean = s => String(s || "").replace(/\s+/g, " ").trim().replace(/[\r\n]/g, "").slice(0, 120);
    const usable = candidates.map(clean).filter(s => s.length >= 2);
    const notFactory = usable.find(s => !/(有限公司|有限责任公司|工厂|厂址|店铺|旗舰店|供应商|加工厂|经营部)$/.test(s));
    return notFactory || usable[0] || "未命名商品";
  }

  function extract() {
    // 自动展开被折叠的“展开全部属性/更多参数”按钮
    try {
      document.querySelectorAll(
        "[data-module*='attribute'] button, [data-module*='attribute'] [class*='more'], [data-module*='attribute'] [class*='expand'], " +
        ".od-pc-attribute [class*='more'], .od-pc-attribute [class*='expand'], .offer-attr-switch, [class*='attr-switch']"
      ).forEach(btn => {
        const t = (btn.innerText || "").trim();
        if (/^(?:展开|展开全部|查看更多|全部属性|更多属性|更多参数)$/i.test(t)) {
          try { btn.click(); } catch (e) {}
        }
      });
    } catch (e) {}

    const html = document.documentElement.innerHTML;
    const title = productName(html);

    const main = [];
    const mainSels = [
      ".od-gallery img", ".od-gallery-img-content img", ".main-slider img",
      ".main-slider--wrap img", ".img-list-wrapper img", ".detail-gallery img",
      "[class*='mainGallery'] img", "[class*='gallery-img'] img", "[class*='gallery'] img"
    ];
    for (const sel of mainSels) {
      document.querySelectorAll(sel).forEach(el => push(main, imgSrc(el)));
    }
    if (main.length === 0) {
      const m = html.match(/"(?:images|imageList|galleryImages)"\s*:\s*\[([^\]]{50,8000})\]/);
      if (m) (m[1].match(/"([^"]+alicdn[^"]+)"/g) || [])
        .forEach(s => push(main, decodeJsonString(s.slice(1, -1))));
    }

    const detail = [];
    const detSels = [
      "#desc-lazyload-container img", ".content-detail img",
      "#de_description_detail img", "[class*='desc-content'] img",
      "[class*='detail-content'] img", "#detailContentContainer img",
      ".od-pc-detail-description img"
    ];
    for (const sel of detSels) {
      document.querySelectorAll(sel).forEach(el => push(detail, imgSrc(el)));
    }
    if (detail.length === 0) {
      const m = html.match(/"content"\s*:\s*"((?:\\.|[^"\\]){200,})"/);
      if (m) {
        try {
          const txt = JSON.parse('"' + m[1] + '"');
          (txt.match(/(?:src|data-src|data-lazyload-src)=["']([^"']+)["']/g) || [])
            .forEach(s => push(detail, s.replace(/^(?:src|data-src|data-lazyload-src)=["']/, "").replace(/["']$/, "")));
        } catch (e) {}
      }
    }

    const videos = [];
    const pushVideo = u => {
      if (!u) return;
      let v = String(u).trim();
      if (v.startsWith("//")) v = "https:" + v;
      if (/^https?:/i.test(v) && !/^blob:/i.test(v) && !videos.includes(v)) videos.push(v);
    };
    document.querySelectorAll("video").forEach(v => {
      pushVideo(v.currentSrc || v.src || (v.querySelector("source") || {}).src);
    });
    if (videos.length === 0) {
      (html.match(/https?:[^"'\\ ]+?\.mp4(\?[^"'\\ ]*)?/g) || [])
        .filter(u => /video|vod|cloud|alicdn|tbcdn/i.test(u))
        .forEach(u => pushVideo(decodeJsonString(u)));
    }

    const attrs = {};
    const sku = [];
    const skuNames = [];
    const putAttr = (rawK, rawV) => {
      const k = String(rawK || "").replace(/\s+/g, " ").replace(/^[:：\s•·▪-]+|[:：\s]+$/g, "").trim();
      const v = String(rawV ?? "").replace(/\s+/g, " ").trim();
      if (!k || !v || k.length > 36 || v.length > 400 || k === v) return;
      if (/^(?:商品属性|跨境属性|包装信息|展开|收起|更多|查看详情|预览|查看|详情|图片|大图|视频|数量|客服|评价|收藏|举报|登录|注册|选择|全部)$/i.test(k)) return;
      if (/^(?:预览|查看|展开|收起|更多|查看详情|详情|图片|大图|视频|登录|注册|选择|举报)$/i.test(v)) return;
      if (/^(?:是|否|无|有|支持|不支持|可|不可|\d+(?:\.\d+)?%?)$/.test(k)) return;
      if (attrs[v] === k) return;
      if (skuNames.includes(k) && /^\d+\s*(?:件|个|支|卡|套|盒|双|只|可售)?$/.test(v)) return;
      if (!attrs[k]) attrs[k] = v;
    };

    // 1) 从 1688 内嵌 JSON skuProps 提取高清原图 imageUrl 与规格名称
    let searchFrom = 0;
    while (searchFrom < html.length) {
      const skuIdx = html.indexOf('"skuProps"', searchFrom);
      if (skuIdx < 0) break;
      searchFrom = skuIdx + 10;
      const arrStart = html.indexOf("[", skuIdx);
      if (arrStart > 0 && arrStart - skuIdx < 40) {
        let depth = 0, inStr = false, esc = false, arrEnd = -1;
        for (let i = arrStart; i < Math.min(html.length, arrStart + 80000); i++) {
          const ch = html[i];
          if (esc) { esc = false; continue; }
          if (ch === "\\") { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (!inStr) {
            if (ch === "[") depth++;
            else if (ch === "]") {
              depth--;
              if (depth === 0) { arrEnd = i + 1; break; }
            }
          }
        }
        if (arrEnd > arrStart) {
          try {
            JSON.parse(html.slice(arrStart, arrEnd)).forEach(o => {
              if (o && Array.isArray(o.value)) {
                const vals = [];
                o.value.forEach(v => {
                  if (!v) return;
                  const nm = String(v.name || "").trim();
                  if (nm) {
                    vals.push(nm);
                    if (!skuNames.includes(nm)) skuNames.push(nm);
                  }
                  const hiRes = v.imageUrl || v.imgUrl || v.image || v.propImage || "";
                  if (hiRes) push(sku, hiRes);
                });
                if (o.prop && vals.length) {
                  putAttr(o.prop, vals.join(" / "));
                  if (!attrs["规格"]) putAttr("规格", vals.join(" / "));
                }
              }
            });
          } catch (e) {}
        }
      }
    }

    // 2) 从 JSON 中带 imageUrl 的规格对象补充高清 SKU 原图
    const skuImgJsonRe = /"(?:imageUrl|propImage|skuImageUrl)"\s*:\s*"((?:\\.|[^"\\]){12,300})"/g;
    let sim;
    while ((sim = skuImgJsonRe.exec(html))) {
      push(sku, decodeJsonString(sim[1]));
    }

    // 3) 从 DOM 规格选择区提取图片（含 data-* 与 CSS background-image）及规格文字
    const skuSels = [
      ".sku-item", ".sku-item-image", ".od-sku-property",
      "[class*='sku'] [class*='value']", "[class*='sku'] [class*='item']",
      "[class*='prop-item']", "[class*='sku-prop']"
    ];
    for (const sel of skuSels) {
      document.querySelectorAll(sel).forEach(el => {
        el.querySelectorAll("img").forEach(img => push(sku, imgSrc(img)));
        if (el.tagName === "IMG") push(sku, imgSrc(el));
        const dataImg = el.getAttribute("data-image") || el.getAttribute("data-src") || el.getAttribute("data-large-image");
        if (dataImg) push(sku, dataImg);
        try {
          const bg = getComputedStyle(el).backgroundImage || el.style?.backgroundImage || "";
          for (const match of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) push(sku, match[1]);
        } catch (e) {}
        const label = (el.getAttribute("title") || el.getAttribute("alt") || el.querySelector("[class*='name'], [class*='text'], span")?.innerText || "").replace(/\s+/g, " ").trim();
        if (label && label.length <= 40 && !/^(?:颜色|尺码|规格|款式|选择)/.test(label) && !skuNames.includes(label)) {
          skuNames.push(label);
        }
      });
    }
    if (sku.length === 0) {
      (html.match(/https?:[^"'\\ ]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\ ]*)?/gi) || [])
        .filter(u => /sku|prop|spec/i.test(u))
        .forEach(u => push(sku, decodeJsonString(u)));
    }
    if (skuNames.length && !attrs["规格"]) {
      putAttr("规格", skuNames.slice(0, 30).join(" / "));
    }

    // 价格与阶梯起批量提取（自动修复 1688 拆分小数点 ¥ 4 . 20 -> ¥4.20，并解析 XXX数量多少钱 与 多规格 SKU 价格）
    const cleanPriceText = (raw) => String(raw || "")
      .replace(/(\d)\s*\.\s*(\d)/g, "$1.$2")
      .replace(/([¥￥$€£])\s+(\d)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
    const priceTiers = [];
    const seenTierKey = new Set();
    const pushTier = (minQty, maxQty, qtyLabel, priceNum, currency = "¥") => {
      const p = parseFloat(priceNum);
      if (!Number.isFinite(p) || p <= 0) return;
      const mq = Math.max(1, parseInt(minQty, 10) || 1);
      const xq = maxQty && parseInt(maxQty, 10) >= mq ? parseInt(maxQty, 10) : 0;
      const lbl = qtyLabel || (xq ? `${mq}-${xq}件` : `${mq}件起`);
      const k = `${mq}_${xq}_${p.toFixed(2)}`;
      if (seenTierKey.has(k)) return;
      seenTierKey.add(k);
      priceTiers.push({ minQty: mq, maxQty: xq, qtyLabel: lbl, price: p, currency });
    };

    // A) 优先从 1688 页面 DOM 阶梯价区块提取（如 2-99个 ¥6.50 / 100-499个 ¥5.20 / ≥500个 ¥4.20）
    try {
      const tierContainers = document.querySelectorAll(".price-column, .step-price-item, [class*='step-price'] [class*='item'], [class*='price-box'] [class*='item'], .od-pc-offer-price-contain [class*='price-item']");
      tierContainers.forEach(el => {
        const txt = cleanPriceText(el.innerText || "");
        const pm = txt.match(/([¥￥$€£])?\s*(\d+(?:\.\d{1,2})?)/);
        const qRange = txt.match(/(\d+)\s*[-~—至]\s*(\d+)\s*(?:个|件|只|套|支|盒|箱|双|PCS|pcs)?/);
        const qMin = txt.match(/(?:≥|>=|满|起批|起订)?\s*(\d+)\s*(?:个|件|只|套|支|盒|箱|双|PCS|pcs)?\s*(?:起|以上|及以上|\+)/);
        if (pm) {
          const cur = pm[1] || "¥";
          const priceVal = pm[2];
          if (qRange) {
            pushTier(qRange[1], qRange[2], `${qRange[1]}-${qRange[2]}件`, priceVal, cur);
          } else if (qMin) {
            pushTier(qMin[1], 0, `${qMin[1]}件以上`, priceVal, cur);
          }
        }
      });
    } catch {}

    // B) 从页面脚本 JSON 中提取 priceRange / skuInfoMap（含多规格价格与阶梯价）
    const variantsData = [];
    try {
      const htmlRaw = document.documentElement?.innerHTML || "";
      if (!priceTiers.length) {
        const prMatch = htmlRaw.match(/"priceRange"\s*:\s*(\[\s*\[[\s\S]{4,400}?\]\s*\])/);
        if (prMatch) {
          const arr = JSON.parse(prMatch[1]);
          if (Array.isArray(arr)) {
            arr.forEach((pair, idx) => {
              if (Array.isArray(pair) && pair.length >= 2) {
                const mq = parseInt(pair[0], 10) || 1;
                const nextMq = (arr[idx + 1] && parseInt(arr[idx + 1][0], 10)) ? parseInt(arr[idx + 1][0], 10) - 1 : 0;
                pushTier(mq, nextMq, nextMq >= mq ? `${mq}-${nextMq}件` : `${mq}件以上`, pair[1], "¥");
              }
            });
          }
        }
      }
      const skuMapMatch = htmlRaw.match(/"skuInfoMap"\s*:\s*(\{[\s\S]{10,18000}?\})\s*,\s*"[a-zA-Z]/);
      if (skuMapMatch) {
        try {
          const sm = JSON.parse(skuMapMatch[1]);
          const seenSpec = new Set();
          for (const [k, info] of Object.entries(sm || {})) {
            if (!info || typeof info !== "object") continue;
            const specName = cleanPriceText(k.replace(/&gt;/g, " / ").replace(/>/g, " / "));
            if (!specName || seenSpec.has(specName)) continue;
            seenSpec.add(specName);
            const pVal = parseFloat(info.discountPrice || info.price || "");
            variantsData.push({
              spec: specName,
              model: String(info.skuCode || info.cargoNumber || "").trim(),
              price: Number.isFinite(pVal) && pVal > 0 ? pVal : 0,
              currency: "¥",
            });
            if (variantsData.length >= 20) break;
          }
        } catch {}
      }
    } catch {}

    // C) 兜底单价提取（确保修复拆分小数点，绝不输出 ¥ 5.20 . 26）
    if (priceTiers.length) {
      priceTiers.sort((a, b) => a.minQty - b.minQty);
      putAttr("价格", priceTiers.map(t => `${t.qtyLabel} ${t.currency}${t.price.toFixed(2).replace(/\.00$/, "")}`).join("，"));
    } else {
      const priceEl = document.querySelector(".price-text, .od-pc-offer-price-contain, [class*='price-num'], [class*='price-info']");
      if (priceEl && priceEl.innerText) {
        const pTxt = cleanPriceText(priceEl.innerText).slice(0, 80);
        if (/\d/.test(pTxt)) putAttr("价格", pTxt);
      }
    }

    // 1) 经典属性项与表格行（含跨境属性/包装信息表格）
    document.querySelectorAll(
      "[class*='attr'] [class*='item'], .obj-content tr, [class*='property'] [class*='item'], " +
      "[class*='offer-attr'] [class*='item'], .offer-attr-item, .od-pc-attribute-item, .ant-descriptions-item"
    ).forEach(el => {
      const nameEl = el.querySelector("[class*='name'], [class*='label'], [class*='title'], dt, th");
      const valEl = el.querySelector("[class*='value'], [class*='val'], [class*='content'], dd, td");
      if (nameEl && valEl && nameEl !== valEl) {
        putAttr(nameEl.innerText, valEl.innerText);
        return;
      }
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      const kv = t.split(/[:：]/);
      if (kv.length >= 2 && kv[0].trim().length <= 28) {
        putAttr(kv[0], kv.slice(1).join(":"));
      } else if (el.children.length === 2) {
        putAttr(el.children[0].innerText, el.children[1].innerText);
      }
    });

    // 1b) 优先解析 1688「包装信息 / 商品件重尺」列式表格（同时支持单 table 与 Ant/Next 拆分布局的固定表头双 table）
    const columnarTables = new Set();
    const packSpecs = [];
    const parseColumnarRows = (rows, markEls = []) => {
      if (rows.length < 2) return false;
      const hdr = rows[0];
      const labelCol = hdr.findIndex(h => /^(?:颜色|规格|款式|型号|名称|品类|尺码|color|spec|size|model)/i.test(h));
      const weightCol = hdr.findIndex(h => /^(?:重量|单件重量|单品重量|产品重量|克重|weight)(?:\s*[\(（]\s*(?:kg|g|克|千克|公斤|lb|oz)\s*[\)）])?$/i.test(h));
      const lenCol = hdr.findIndex(h => /^长(?:度)?(?:\s*[\(（]\s*(?:cm|mm|m)\s*[\)）])?$/i.test(h));
      const widCol = hdr.findIndex(h => /^宽(?:度)?(?:\s*[\(（]\s*(?:cm|mm|m)\s*[\)）])?$/i.test(h));
      const heiCol = hdr.findIndex(h => /^高(?:度)?(?:\s*[\(（]\s*(?:cm|mm|m)\s*[\)）])?$/i.test(h));
      const cartonCol = hdr.findIndex(h => /^(?:箱规|外箱|装箱规格|外箱信息)$/i.test(h));
      if (weightCol < 0 && !(lenCol >= 0 && widCol >= 0 && heiCol >= 0)) return false;
      markEls.forEach(el => { if (el) columnarTables.add(el); });
      const wUnitM = weightCol >= 0 ? hdr[weightCol].match(/[\(（]\s*(kg|g|克|千克|公斤|lb|oz)\s*[\)）]/i) : null;
      const wUnit = wUnitM ? wUnitM[1] : "g";
      const dUnitM = lenCol >= 0 ? hdr[lenCol].match(/[\(（]\s*(cm|mm|m)\s*[\)）]/i) : (widCol >= 0 ? hdr[widCol].match(/[\(（]\s*(cm|mm|m)\s*[\)）]/i) : null);
      const dUnit = dUnitM ? dUnitM[1] : "cm";
      const weights = [], dims = [], ctnSizes = [], ctnQtys = [], ctnWeights = [];
      for (let ri = 1; ri < rows.length; ri++) {
        const r = rows[ri];
        let rowW = "", rowDim = "", rowCtnSize = "", rowCtnQty = "", rowCtnWeight = "";
        if (weightCol >= 0 && r[weightCol]) {
          const rawW = r[weightCol].trim();
          if (/^\d+(?:\.\d+)?(?:\s*(?:g|kg|克|千克|公斤|lb|oz))?$/i.test(rawW) && parseFloat(rawW) > 0) {
            rowW = /[a-zA-Z克斤两]/.test(rawW) ? rawW : `${rawW}${wUnit}`;
            if (!weights.includes(rowW)) weights.push(rowW);
          }
        }
        if (lenCol >= 0 && widCol >= 0 && heiCol >= 0 && r[lenCol] && r[widCol] && r[heiCol]) {
          const l = r[lenCol].replace(/[^\d.]/g, ""), w = r[widCol].replace(/[^\d.]/g, ""), h = r[heiCol].replace(/[^\d.]/g, "");
          if (l && w && h) {
            rowDim = `${l}×${w}×${h}${dUnit}`;
            if (!dims.includes(rowDim)) dims.push(rowDim);
          }
        }
        if (cartonCol >= 0 && r[cartonCol]) {
          const cTxt = r[cartonCol];
          const cm = cTxt.match(/(?:外箱|箱规|尺寸)?\s*[:：]?\s*(\d+(?:\.\d+)?\s*[*×xX]\s*\d+(?:\.\d+)?\s*[*×xX]\s*\d+(?:\.\d+)?\s*(?:cm|mm|m)?)/i);
          if (cm) {
            rowCtnSize = cm[1].replace(/[*xX]/g, "×").replace(/\s+/g, "").trim();
            if (!/[a-zA-Z]$/.test(rowCtnSize)) rowCtnSize += "cm";
            if (!ctnSizes.includes(rowCtnSize)) ctnSizes.push(rowCtnSize);
          }
          const qm = cTxt.match(/(?:数量|装箱数)?\s*[:：]?\s*(\d+\s*[件个只套支双条袋盒]?\/箱)/i);
          if (qm) {
            rowCtnQty = qm[1].replace(/\s+/g, "").trim();
            if (!ctnQtys.includes(rowCtnQty)) ctnQtys.push(rowCtnQty);
          }
          const wMatches = [...cTxt.matchAll(/(毛重|净重)\s*[:：]\s*(\d+(?:\.\d+)?\s*(?:kg|g|千克|公斤))/gi)];
          if (wMatches.length) {
            rowCtnWeight = wMatches.map(m => `${m[1]} ${m[2].replace(/\s+/g, "")}`).join(" / ");
            if (!ctnWeights.includes(rowCtnWeight)) ctnWeights.push(rowCtnWeight);
          }
        }
        const rowLabel = (labelCol >= 0 ? r[labelCol] : r[0] || "").trim();
        if (rowW || rowDim || rowCtnSize || rowCtnQty || rowCtnWeight) {
          packSpecs.push({
            label: rowLabel,
            size: rowDim,
            weight: rowW,
            cartonSize: rowCtnSize,
            cartonQty: rowCtnQty,
            cartonWeight: rowCtnWeight,
          });
        }
      }
      if (weights.length) putAttr("单件重量", weights.slice(0, 4).join(" / "));
      if (dims.length && !attrs["产品尺寸"]) putAttr("产品尺寸", dims.slice(0, 4).join(" / "));
      if (ctnSizes.length && !attrs["箱子尺寸"]) putAttr("箱子尺寸", ctnSizes.slice(0, 3).join(" / "));
      if (ctnQtys.length && !attrs["每箱多少个"]) putAttr("每箱多少个", ctnQtys.slice(0, 3).join(" / "));
      if (ctnWeights.length && !attrs["箱子毛净重"]) putAttr("箱子毛净重", ctnWeights.slice(0, 3).join(" / "));
      return true;
    };

    const readRowsFromEl = el => [...el.querySelectorAll("tr, [role='row']")]
      .map(r => [...r.querySelectorAll("th, td, [role='columnheader'], [role='cell']")].map(x => (x.innerText || "").replace(/\s+/g, " ").trim()))
      .filter(cells => cells.some(Boolean));

    // 1b-1) 先查拆分布局的固定表头容器（.ant-table / .next-table / 含多个 table 的包裹容器）
    document.querySelectorAll(".ant-table, .next-table, [class*='table-wrapper'], [class*='table-container'], [class*='pack']").forEach(wrap => {
      const tbls = [...wrap.querySelectorAll("table")];
      if (tbls.length >= 2) {
        const hdrRows = readRowsFromEl(tbls[0]);
        const bodyRows = readRowsFromEl(tbls[1]);
        if (hdrRows.length >= 1 && bodyRows.length >= 1) {
          parseColumnarRows([hdrRows[0], ...bodyRows], tbls);
        }
      }
    });

    // 1b-2) 再查单 table / [role='table']
    document.querySelectorAll("table, [role='table']").forEach(tbl => {
      if (columnarTables.has(tbl)) return;
      parseColumnarRows(readRowsFromEl(tbl), [tbl]);
    });

    // 1c) 兜底：若 1688「商品件重尺」采用 div/非标准表格布局，先剔除箱规内容再按表头提取单件重量
    if (!attrs["单件重量"]) {
      const bodyTxt = (document.body?.innerText || "");
      const packSecIdx = bodyTxt.indexOf("商品件重尺");
      if (packSecIdx >= 0) {
        const rawChunk = bodyTxt.slice(packSecIdx, packSecIdx + 1200);
        // 严禁把箱规里的「外箱:60*60*50cm / 数量:80 件/箱 / 净重:51.4 kg」当成单件重量
        const cleanChunk = rawChunk
          .replace(/外箱\s*[:：][^\n]{0,60}/g, "")
          .replace(/数量\s*[:：]\s*\d+[^\n]{0,30}/g, "")
          .replace(/(?:毛重|净重)\s*[:：]\s*\d+(?:\.\d+)?\s*(?:kg|g|千克|公斤)/gi, "");
        const lines = cleanChunk.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        const wHdrIdx = lines.findIndex(x => /^重量(?:\s*[\(（]\s*(?:kg|g|克|千克|公斤)\s*[\)）])?$/i.test(x));
        if (wHdrIdx >= 0) {
          const wUnitM = lines[wHdrIdx].match(/[\(（]\s*(kg|g|克|千克|公斤)\s*[\)）]/i);
          const wUnit = wUnitM ? wUnitM[1] : "g";
          let startIdx = wHdrIdx + 1;
          if (lines[startIdx] && /^(?:箱规|外箱|装箱规格)$/i.test(lines[startIdx])) startIdx++;
          const rowNums = lines.slice(startIdx, startIdx + 10).filter(t => /^\d+(?:\.\d+)?$/.test(t));
          // 通常数据行数字为：长、宽、高、体积、重量（重量是第5个或最后一个数字）
          const wNum = rowNums.length >= 5 ? rowNums[4] : rowNums[rowNums.length - 1];
          if (wNum && parseFloat(wNum) > 0) putAttr("单件重量", `${wNum}${wUnit}`);
        }
      }
    }

    document.querySelectorAll("table tr").forEach(row => {
      const parentTbl = row.closest("table");
      if (parentTbl && columnarTables.has(parentTbl)) return;
      const cells = [...row.querySelectorAll("th,td")].map(x => (x.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      if (cells.length === 2) {
        putAttr(cells[0], cells[1]);
      } else if (cells.length >= 4 && cells.length % 2 === 0 && cells.every((c, i) => i % 2 === 1 || c.length <= 28)) {
        for (let i = 0; i + 1 < cells.length; i += 2) putAttr(cells[i], cells[i + 1]);
      } else if (cells.length >= 2) {
        putAttr(cells[0], cells.slice(1).join(" / "));
      }
    });

    // 2) 新版页面：商品属性与跨境包装 DOM 区块（od_product_attributes / od_cross_border 等）
    document.querySelectorAll("[data-module='od_product_attributes'], .module-od-product-attributes, [data-module*='attribute'], [data-module*='cross'], .od-pc-attribute, .od-pc-offer-cross").forEach(box => {
      let pairCount = 0;
      box.querySelectorAll("*").forEach(el => {
        if (el.children.length === 2 && el.children[0].children.length === 0 && el.children[1].children.length <= 1) {
          const k = (el.children[0].innerText || "").trim();
          const v = (el.children[1].innerText || "").trim();
          if (k && v && k.length <= 28) { putAttr(k, v); pairCount++; }
        }
      });
      if (pairCount === 0) {
        const lines = (box.innerText || "").split(/\n+/)
          .map(x => x.replace(/\t/g, "").trim()).filter(Boolean)
          .filter(x => !/^(?:商品属性|跨境属性|包装信息|物流参数|展开|收起|查看更多)$/.test(x));
        for (let i = 0; i + 1 < lines.length; i += 2) {
          if (lines[i].length <= 28 && lines[i + 1]) putAttr(lines[i], lines[i + 1]);
        }
      }
    });

    // 3) 页面内嵌 JSON 属性数组：兼容正序(name->value)、倒序(value->name)、中间夹带数组(values:[...])及转义 JSON (\"name\":\"...\")
    const scanHtmlVariants = [html];
    if (html.includes('\\"')) {
      scanHtmlVariants.push(html.replace(/\\"/g, '"'));
    }
    for (const hSrc of scanHtmlVariants) {
      // 3a) 括号配平提取 productFeatureList / featureAttributes / offerAttributes 数组
      for (const listKey of ['"productFeatureList"', '"featureAttributes"', '"offerAttributes"', '"subjectAttributes"']) {
        let pos = 0;
        while (pos < hSrc.length) {
          const idx = hSrc.indexOf(listKey, pos);
          if (idx < 0) break;
          pos = idx + listKey.length;
          const aStart = hSrc.indexOf("[", idx);
          if (aStart > 0 && aStart - idx < 40) {
            let depth = 0, inStr = false, esc = false, aEnd = -1;
            for (let i = aStart; i < Math.min(hSrc.length, aStart + 120000); i++) {
              const ch = hSrc[i];
              if (esc) { esc = false; continue; }
              if (ch === "\\") { esc = true; continue; }
              if (ch === '"') { inStr = !inStr; continue; }
              if (!inStr) {
                if (ch === "[") depth++;
                else if (ch === "]") {
                  depth--;
                  if (depth === 0) { aEnd = i + 1; break; }
                }
              }
            }
            if (aEnd > aStart) {
              try {
                const arr = JSON.parse(hSrc.slice(aStart, aEnd));
                if (Array.isArray(arr)) {
                  arr.forEach(item => {
                    if (!item || typeof item !== "object") return;
                    const k = item.name || item.attrName || item.propName || item.label || item.title || "";
                    let v = item.value ?? item.attrValue ?? item.propValue ?? item.text ?? "";
                    if (!v && Array.isArray(item.values)) v = item.values.join(" / ");
                    if (k && v !== undefined && v !== null && String(v).trim()) {
                      putAttr(String(k), String(v));
                    }
                  });
                }
              } catch (e) {}
            }
          }
        }
      }

      // 3b) 对象级正则：在单个大括号对象 {...} 内同时支持 name 在前或 value 在前
      const objBlockRe = /\{[^{}]{6,600}\}/g;
      let om;
      while ((om = objBlockRe.exec(hSrc)) && Object.keys(attrs).length < 200) {
        const blk = om[0];
        if (!/(?:attrName|propName|"name"|"label")/.test(blk) || !/(?:attrValue|propValue|"value"|"values"|"text")/.test(blk)) continue;
        const km = blk.match(/"(?:attrName|name|propName|label)"\s*:\s*"((?:\\.|[^"\\]){1,32})"/);
        const vm = blk.match(/"(?:attrValue|value|propValue|text)"\s*:\s*"((?:\\.|[^"\\]){1,260})"/);
        if (km && vm) {
          putAttr(decodeJsonString(km[1]), decodeJsonString(vm[1]));
        } else if (km) {
          const vam = blk.match(/"values"\s*:\s*\[\s*"((?:\\.|[^"\\]){1,180})"/);
          if (vam) putAttr(decodeJsonString(km[1]), decodeJsonString(vam[1]));
        }
      }
    }

    // 4) 1688 跨境与物流包装内嵌 JSON 字段提取（单件重量/外箱尺寸/毛重/净重/装箱数/发货地）
    const logisticsPatterns = [
      [/"(?:unitWeight|pieceWeight)"\s*:\s*"?([0-9.]+(?:\s*(?:kg|g))?)"?/i, "单件重量", v => /^\d+(\.\d+)?$/.test(v) ? `${v}kg` : v],
      [/"(?:grossWeight|cartonGrossWeight)"\s*:\s*"?([0-9.]+(?:\s*(?:kg|g))?)"?/i, "箱子毛重", v => /^\d+(\.\d+)?$/.test(v) ? `${v}kg` : v],
      [/"(?:suttleWeight|netWeight|cartonNetWeight)"\s*:\s*"?([0-9.]+(?:\s*(?:kg|g))?)"?/i, "箱子净重", v => /^\d+(\.\d+)?$/.test(v) ? `${v}kg` : v],
      [/"(?:packageSize|boxSize|cartonSize)"\s*:\s*"([0-9.xX*×\s]+(?:cm|mm)?)"/i, "箱子尺寸", v => v],
      [/"(?:packingQuantity|pcsPerCarton|cartonQty)"\s*:\s*"?(\d+)"?/i, "装箱数", v => `${v}个/箱`],
      [/"(?:sendGoodsAddressText|location|AddressText)"\s*:\s*"((?:\\.|[^"\\]){2,40})"/i, "产地", v => decodeJsonString(v)],
    ];
    for (const hSrc of scanHtmlVariants) {
      for (const [re, key, fmt] of logisticsPatterns) {
        if (attrs[key]) continue;
        const m = hSrc.match(re);
        if (m && m[1] && Number(String(m[1]).replace(/[^\d.]/g, "")) > 0) {
          putAttr(key, fmt(m[1].trim()));
        }
      }
    }

    let descContainerText = "";
    try {
      const descSelectors = [
        "#desc-lazyload-container", ".od-pc-detail-description", ".detail-desc-decorate-richtext",
        "#de_description_detail", "[class*='desc-content']", "[class*='detail-content']", "#detailContentContainer"
      ];
      const chunks = [];
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        const t = (el?.innerText || "").trim();
        if (t && t.length >= 4 && !chunks.includes(t)) chunks.push(t);
      }
      descContainerText = chunks.join("\n").slice(0, 12000);
    } catch {}
    const bodyText = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 20000);
    const pageText = descContainerText && !bodyText.includes(descContainerText.slice(0, 40))
      ? `${bodyText}\n【商品详情介绍】\n${descContainerText}`
      : bodyText;

    // 5) 兜底：若后台第N个标签页因懒渲染未挂载属性表格，自动从标题与可见文本/详情介绍提取核心材质/容量/尺寸/重量/包装方式，确保字段绝不为空
    if (title) {
      putAttr("产品名称", title);
      const searchScope = title + " " + pageText.slice(0, 6000) + " " + descContainerText;
      const matMatch = searchScope.match(/(316L?不锈钢|304不锈钢|201不锈钢|食品级(?:硅胶|PP|PC|Tritan)|液态硅胶|高硼硅玻璃|铝合金|钛合金|纯钛|ABS|PP塑料|PC塑料|牛津布|帆布|真皮|PU皮|纯棉|涤纶|尼龙|陶瓷|实木|竹木|黄铜|碳纤维)/i);
      if (matMatch && !attrs["材质"]) putAttr("材质", matMatch[1]);
      const capMatch = title.match(/\b(\d+(?:\.\d+)?\s*(?:ml|l|oz|毫升|升|加仑))\b/i);
      if (capMatch && !attrs["容量"]) putAttr("容量", capMatch[1]);
      const dimMatch = searchScope.match(/\b(\d+(?:\.\d+)?\s*[×xX*]\s*\d+(?:\.\d+)?(?:\s*[×xX*]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|厘米|毫米))\b/i);
      if (dimMatch && !attrs["产品尺寸"]) putAttr("产品尺寸", dimMatch[1]);
      const wtMatch = searchScope.match(/(?:重量|净重|克重|单重)\s*[:：]?\s*(\d+(?:\.\d+)?\s*(?:g|kg|克|千克|公斤))\b/i);
      if (wtMatch && !attrs["单件重量"]) putAttr("单件重量", wtMatch[1]);
      const packMatch = searchScope.match(/(?:包装方式|内包装|单品包装|包装)\s*[:：]\s*([^\n\r;；,，。]{2,24})/i)
        || searchScope.match(/((?:单个|独立|透明|加厚|定制)?(?:OPP袋|PE袋|CPE袋|自封袋|磨砂袋|气泡袋|防尘袋|无纺布袋|绒布袋|编织袋|彩盒|白盒|牛皮纸盒|瓦楞盒|天地盖盒|礼盒|纸盒|吸塑卡|吸塑盒|吊卡|纸箱|袋装|盒装|散装)(?:独立)?(?:包装|装)?)/i);
      if (packMatch && packMatch[1] && !attrs["包装方式"]) putAttr("包装方式", packMatch[1].trim());
    }
    return { url: location.href, title, pageLang: document.documentElement?.lang || "", isEcommerce: true, main, detail, sku, videos, attrs, pageText, priceTiers, variantsData, packSpecs };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "EXTRACT") {
      const r = extract();
      const m = document.documentElement.innerHTML.match(/"(?:detailUrl|descUrl)"\s*:\s*"((?:\\.|[^"\\])+)"/);
      if (m) { try { r.detailUrl = JSON.parse('"' + m[1] + '"'); } catch (e) {} }
      sendResponse(r);
    }
    return true;
  });
})();
