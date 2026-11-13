/* 小咩魔法采集 v1.0.8 · 全界面单一语言（中文 / English）切换
 * 规则：页面只能出现一种语言。中文是原始界面；选择 English 后，页面上所有可见文字、
 * 输入框提示、悬浮提示以及运行时动态生成的状态文字，全部译为英文，不留中文。
 * 翻译顺序：内置词典（离线、确定）→ 在线机翻（Google 接口，不通时自动改用 LLM7）。
 */
(function () {
  "use strict";

  const DICT = {
    "➕ 全部加入列表": "➕ Add All to List",
    "⏹ 停止采集": "⏹ Stop Collecting",
    "⏱️ 采集频率控制": "⏱️ Collection Rate Limits",
    "＋ 增加自定义字段": "＋ Add Custom Field",
    "✕ 移除": "✕ Remove",
    "✕": "✕",
    "✨ 采集当前浏览页（进入工作台预览）": "✨ Collect Current Page (Preview in Workbench)",
    "✨ 采集资料预览": "✨ Collected Data Preview",
    "✨ 读取网页": "✨ Read Page",
    "⚡ 一键立即采集并保存当前页": "⚡ Collect & Save Current Page Instantly",
    "① 采集工作台": "① Collection Workbench",
    "② 采集内容与图片筛选": "② Content & Image Filtering",
    "③ 保存路径与编号": "③ Save Path & Numbering",
    "④ 商品参数字段": "④ Product Spec Fields",
    "⑤ 卖点与故事设置": "⑤ Selling Point & Story Settings",
    "B2B 外贸批发": "B2B Export Wholesale",
    "SKU图": "SKU Images",
    "ToC 真实种草": "ToC Authentic Recommendations",
    "🌐 采集语言": "🌐 Collection Language",
    "🌐 已打开网页：": "🌐 Open Pages:",
    "🌐 语言：简体中文": "🌐 Language: Chinese",
    "🌐 语言：English": "🌐 Language: English",
    "🌐 语言：跟随原网站": "🌐 Language: Chinese",
    "🌟 核心服务优势": "🌟 Core Service Advantages",
    "🎯 仅商品图": "🎯 Product Images Only",
    "🎯 文案风格：": "🎯 Copy Style:",
    "💡 独特卖点": "💡 Unique Selling Points",
    "📂 保存目录：": "📂 Save Folder:",
    "📂 打开批量采集与配置工作台": "📂 Open Batch Collection & Settings Workbench",
    "📄 导入 TXT 链接文件": "📄 Import TXT Link File",
    "📄 普通图文/文章页": "📄 Article / Content Page",
    "📌 当前网页预览": "📌 Current Page Preview",
    "📖 独特故事": "📖 Unique Story",
    "🔄 故事角度选择": "🔄 Story Angle Selection",
    "🔄 刷新": "🔄 Refresh",
    "🔄 重新读取": "🔄 Re-read",
    "🔗 网页链接（每行一条）：": "🔗 Page Links (one per line):",
    "🖼️ 其他图也要": "🖼️ Include Other Images",
    "🚀 开始采集": "🚀 Start Collecting",
    "🛒 电商商品页": "🛒 E-commerce Product Page",
    "🤖 AI 智能判断": "🤖 AI Smart Detection",
    "🤖 筛图：AI 智能判断": "🤖 Filter: AI Smart Detection",
    "🤖 筛图：仅商品图": "🤖 Filter: Product Images Only",
    "🤖 筛图：全部图片": "🤖 Filter: All Images",
    "🤖 图片筛选模式": "🤖 Image Filter Mode",
    "🧹 清除记录": "🧹 Clear History",
    "按类别分建子文件夹": "Create subfolders by category",
    "保存目录": "Save Folder",
    "保存页面全部图片": "Save all images on the page",
    "保留商品图与规格图，过滤杂图": "Keep product & spec images, filter out clutter",
    "编号后缀": "Number Suffix",
    "标题：": "Title:",
    "采集": "Collector",
    "产品前缀": "Product Prefix",
    "常用前8个": "Top 8",
    "当前活动网页": "Active Page",
    "递增步长": "Step",
    "点击查看大图": "Click to enlarge",
    "放大小咩猫图片": "Enlarge Xiaomie cat image",
    "个": "items",
    "跟随原网站语言": "Chinese",
    "关闭大图": "Close enlarged image",
    "简体中文": "Chinese",
    "仅保存纯净商品图": "Save clean product images only",
    "来源网址": "Source URL",
    "每分钟": "Per minute",
    "每个商品自动按编号创建独立文件夹归档保存。": "Each product is automatically archived in its own numbered folder.",
    "每天": "Per day",
    "每小时": "Per hour",
    "魔法": "Magic",
    "默认下载目录\\采集": "Default Downloads folder\\Collection",
    "目录含商品标题": "Include product title in folder name",
    "起始编号": "Start Number",
    "清空": "Clear",
    "请打开任意要采集的商品页或图文网页": "Please open any product page or article page to collect",
    "全网商品与图文素材智能采集工具 · 一键保存高清主图、详情图、SKU图、视频及结构化商品资料。": "Smart collector for products and content across the web · Save HD main images, detail images, SKU images, videos and structured product data in one click.",
    "全网通用采集 · 智能筛图 · 卖点故事生成": "Universal Collection · Smart Image Filtering · Selling Point & Story Generation",
    "全选": "Select All",
    "如 501": "e.g. 501",
    "如：水杯": "e.g. Water Bottle",
    "商品参数": "Product Specs",
    "商品模式": "Product Mode",
    "页面与商品资料.txt 统一使用顶部所选语言（中文或英文），不会中英混杂": "The page and the product data file use the language selected at the top only, with no mixing",
    "商品资料语言": "Product Data Language",
    "视频": "Video",
    "视频/动图": "Videos / Animations",
    "输入自定义文案风格要求…": "Enter custom copy style requirements…",
    "跳过已采链接": "Skip collected links",
    "图片最小尺寸：宽或高 ≥": "Minimum image size: width or height ≥",
    "网页标题（可修改）": "Page Title (editable)",
    "网页链接": "Page Link",
    "详情图": "Detail Images",
    "小咩": "Xiaomie",
    "小咩猫": "Xiaomie Cat",
    "小咩猫 Logo": "Xiaomie Cat Logo",
    "小咩猫大图": "Xiaomie Cat Large Image",
    "小咩猫完整照片": "Xiaomie Cat Full Photo",
    "小咩魔法采集": "Xiaomie Magic Collector",
    "小咩魔法采集 · 全网智能采集与内容生成工作台": "Xiaomie Magic Collector · Smart Web Collection & Content Generation Workbench",
    "选填": "Optional",
    "选填：补充具体要求": "Optional: add specific requirements",
    "留空自动使用商品编号": "Leave blank to use the product code",
    "留空自动提取": "Leave blank to auto-extract",
    "必填参数": "Required field",
    "选择本地文件夹": "Choose Local Folder",
    "选择当前浏览器已打开的网页…": "Choose a page open in this browser…",
    "页面文案": "Page Copy",
    "已生成 0 款": "0 generated",
    "粘贴 1 条或多条商品/网页链接（每行一条）…": "Paste one or more product/page links (one per line)…",
    "正在检测当前标签页…": "Detecting current tab…",
    "支持当前网页读取与多链接批量采集": "Supports reading the current page and batch collection from multiple links",
    "支持全网电商商品页、品牌独立站及图文网页一键采集。": "One-click collection for e-commerce product pages, brand sites and article pages across the web.",
    "主图": "Main Images",
    "状态": "Status",
    "准备就绪": "Ready",
    "自定义风格": "Custom Style",
    "自定义": "Custom",
    "用心服务，一对一全程跟进，扣细节扣隐患，极致仔细，想客户所想，独家的预防出错机制，经验丰富，大量避坑，守住质量底线": "Dedicated service, one-on-one follow-up from start to finish, obsessing over details and hidden risks, extremely meticulous, thinking what the client thinks, an exclusive error-prevention mechanism, rich experience, many pitfalls avoided, holding the line on quality",
    "自定义故事角度（多个用逗号分隔）": "Custom story angles (separate with commas)",
    // 字段名
    "型号": "Model / SKU", "装箱数": "Qty / Carton (PCS/CTN)", "箱子毛重": "Carton Gross Weight (G.W.)",
    "箱子净重": "Carton Net Weight (N.W.)", "箱子尺寸": "Carton Dimensions (MEAS)", "交期": "Lead Time",
    "起订量": "MOQ", "材质": "Material", "产地": "Origin", "品牌": "Brand", "产品参数": "Product Specifications",
    "独特卖点": "Unique Selling Points", "独特故事": "Exclusive Product Story",
    // 故事角度
    "复购故事": "Repeat Purchase Story",
    "和客户一起策划品牌": "Building a Brand Together with the Client",
    "此款创新故事": "Innovation Story of This Product",
    "此款避坑故事": "Pitfall-Avoidance Story of This Product",
    "某个国家此款的销量调研": "Sales Research for This Product in a Specific Country",
    "定制故事": "Customization Story",
    "客户第一次尝试购买的沟通全过程（EXW方案）": "Full Communication Process of a Client's First Purchase (EXW Plan)",
    "服务细节故事": "Service Details Story",
    "想客户所想故事": "Thinking What the Client Thinks Story",
    "守住质量底线的故事": "Holding the Line on Quality Story",
    "免费做效果图的故事": "Free Mockup Design Story",
    "大货第一个印刷必须确认的故事": "First Bulk Print Must Be Confirmed Story",
    "维护好客户的私模故事": "Protecting the Client's Private Mold Story",
    "通宵加班帮客户赶活动时间的故事": "Overnight Overtime to Meet the Client's Campaign Deadline Story",
    "为避免色差，连续3天亲自监督工人挑选到货的面料，连饭都忘记吃的故事": "Supervising Fabric Sorting in Person for 3 Days to Avoid Color Difference, Forgetting to Eat Story",
    "完美衔接厂长、客户、第三方和物流，全程无疏漏的故事": "Seamlessly Coordinating Factory Manager, Client, Third Party and Logistics Story",
    "和品牌一起成长的故事": "Growing Together with the Brand Story",
    "客户的事情就是我的事情": "The Client's Business Is My Business",
    "10多年来把客户公司当成自己公司的故事": "Treating the Client's Company as My Own for 10+ Years Story",
    "帮客户踩坑急救的故事": "Emergency Rescue After a Client Hit a Snag Story",
    "遇到无赖，帮客户追货的故事": "Chasing Down Goods for a Client Dealing with a Rogue Supplier Story",
    "解决别人不愿意做的组合定制问题": "Solving Combination Customization Others Refuse to Do",
    "宁可不赚钱，高价请人帮忙，也要严守交期的故事": "Giving Up Profit and Paying Extra Help to Keep the Deadline Story",
    "参加客户婚礼，和客户处成朋友的故事": "Attending the Client's Wedding and Becoming Friends Story",
    "真实使用场景": "Real-Life Use Scenario",
    "小众需求被解决": "Niche Need Solved",
    "送礼与开箱瞬间": "Gifting & Unboxing Moment",
    "材质细节与耐用性": "Material Details & Durability",
    "生活方式种草": "Lifestyle Recommendation",
    "前后对比体验": "Before & After Comparison",
    "一件商品的制作过程": "How a Product Is Made",
    "用户评论改编": "Adapted from User Reviews",
    "旅行或户外使用": "Travel & Outdoor Use",
    "低成本提升幸福感": "Low-Cost Happiness Boost",
    // 底部 API 与 AI 设置 + OCR 检查
    "🔧 检查翻译": "🔧 Check Translation",
    "检测本机哪些翻译接口可用": "Check which translation services are available on this computer",
    "🔑 API 与 AI 设置（免费 Agnes AI）": "🔑 API & AI Settings (Free Agnes AI)",
    "「独特卖点」「独特故事」和「箱规深度搜索」都由插件里的 AI 完成：AI 会自己上网搜索资料，再生成内容。填写自己的 Key 后点击保存。密钥只保存在本机浏览器的插件存储里，不会上传，也不会写进安装包。": "Unique Selling Points, Exclusive Product Story, and Carton Specs Deep Search are all completed by the plugin's AI: the AI searches the web on its own before generating content. Enter your own Key and click Save. Keys are stored only in your local browser extension storage and are never uploaded or packaged.",
    "允许 AI 联网搜索（独特卖点 / 独特故事 / 箱规深度搜索）": "Allow AI Web Search (Unique Selling Points / Exclusive Story / Carton Specs Deep Search)",
    "Agnes AI · 模型配置与注册（免费）": "Agnes AI · Model Configuration & Registration (Free)",
    "① 打开 Agnes AI 注册 / Key 控制台": "① Open Agnes AI Registration / API Key Console",
    "模型 ID": "Model ID",
    "从控制台复制可用模型 ID": "Copy an available Model ID from the console",
    "接口地址": "API Base URL",
    "API Key": "API Key",
    "② 将你创建的 API Key 粘贴到这里": "② Paste the API Key you created here",
    "显示 Key": "Show Key",
    "隐藏 Key": "Hide Key",
    "保存 Agnes 设置": "Save Agnes Settings",
    "点击上方控制台网址，完成注册或登录。": "Click the console link above to register or sign in.",
    "在网站的密钥管理（API Key）中创建密钥，复制后粘贴到上方 API Key 输入框。只粘贴复制的密钥，不用自己加任何文字。": "Create an API Key in Key Management on the website, copy it, and paste it into the API Key box above. Paste only the key itself without adding extra text.",
    "接口地址已填好。模型 ID 预填官方目录中的文本生成模型，以你的控制台为准。": "The API Base URL is pre-filled. The Model ID is pre-filled with the default text generation model; adjust according to your console if needed.",
    "点击“保存 Agnes 设置”，再点下面的“测试 AI 连接与联网搜索”。": "Click 'Save Agnes Settings', then click 'Test AI Connection & Web Search' below.",
    "InternVL3.5-241B-A28B · 备用模型（可选）": "InternVL3.5-241B-A28B · Backup Model (Optional)",
    "① 注册 / 登录书生账号": "① Register / Sign In to InternLM Account",
    "② 官方获取 Token 指南（含控制台入口）": "② Official Token Guide (with Console Link)",
    "API Token": "API Token",
    "③ 将控制台生成的完整 Token 粘贴到这里": "③ Paste the full Token generated in the console here",
    "保存书生设置": "Save InternLM Settings",
    "点击注册入口，按页面提示创建或登录账号。": "Click the registration link and follow the prompts to create an account or sign in.",
    "打开官方指南，点击其中的控制台入口（API Console），创建并复制密钥（网站上叫 Token）。": "Open the official guide, click the API Console link, and create and copy a Token.",
    "将密钥粘贴到上方输入框并保存。Agnes 不可用时，会自动改用这个备用模型。": "Paste the Token into the input box above and save. When Agnes is unavailable, this backup model will be used automatically.",
    "测试 AI 连接与联网搜索": "Test AI Connection & Web Search",
    "检查 OCR 是否已安装": "Check Whether OCR Is Installed",
    "请填写模型 ID、接口地址和 Key": "Please fill in the Model ID, API Base URL, and Key",
    "接口地址须为完整的 https:// 地址": "The API Base URL must be a complete https:// URL",
    "已保存到本机（生成时将优先使用）": "Saved locally (will be used first during generation)",
    "预览：已暂存，刷新后清空；正式插件会保存到本机": "Preview: temporarily saved; the installed extension persists it locally",
    "保存失败，请重试": "Failed to save, please try again",
    "还没有保存任何 API Key。请先填写 Agnes 的 Key 并点“保存 Agnes 设置”。": "No API Key saved yet. Please fill in your Agnes Key and click 'Save Agnes Settings' first.",
    "测试中，请稍候…": "Testing, please wait…",
    "正在检查 OCR…": "Checking OCR…",
    "目录商品标题": "Folder Product Title",
    "请在文件夹与编号区域填写编号": "Please enter the number in the Save Path & Numbering section",
    "🎁 方案：免费试用（剩余 20 个）": "🎁 Plan: Free Trial (20 left)",
    "👑 方案：终身不限量授权": "👑 Plan: Lifetime Unlimited",
    "👤 账号登录与授权方案": "👤 Account Login & Subscription Plan",
    "未登录（默认免费试用模式）": "Not Signed In (Default Free Trial Mode)",
    "🌐 Google 登录": "🌐 Google Sign In",
    "💬 微信登录": "💬 WeChat Sign In",
    "退出登录": "Sign Out",
    "免费试用：已采集 0 / 20 个产品": "Free Trial: Collected 0 / 20 products",
    "免费试用：已采集 0 / 20 个产品（剩余 20 个）": "Free Trial: Collected 0 / 20 products (20 left)",
    "💎 收费方案 / 升级授权": "💎 Pricing & Upgrade",
    "账号登录": "Account Sign In",
    "👤 账号登录": "👤 Account Sign In",
    "🌐 登录官方账号 / Sign In": "🌐 Sign In Official Account",
    "🌐 官方全球账号登录 · Official Sign In": "🌐 Official Global Account Sign In",
    "🌐 Google 官方授权": "🌐 Google Official OAuth",
    "📧 全球官方邮箱登录": "📧 Global Official Email Sign In",
    "登录已有邮箱账号": "Sign In with Existing Email",
    "免费注册新账号": "Register New Account",
    "忘记密码？发送官方重置邮件": "Forgot Password? Send Reset Email",
    "电子邮箱地址 (Email Address)": "Email Address",
    "账号密码 (Password)": "Password",
    "💚 微信支付 (CNY)": "💚 WeChat Pay (CNY)",
    "💙 境内支付宝 (CNY)": "💙 Alipay Domestic (CNY)",
    "🌐 全球海外支付 (USD)": "🌐 Global Payments (USD)",
    "📋 一键复制支付宝账号": "📋 Copy Alipay Account",
    "📋 复制海外收款链接": "📋 Copy Global Payment Link",
    "保存链接": "Save Link",
    "💳 前往 PayPal / 国际信用卡安全收银台付款 ↗": "💳 Pay with PayPal / International Credit Card ↗",
    "选择 百品采集包（¥500 / $69）": "Select 100-Pack (¥500 / $69)",
    "选择 终身不限量授权（¥999 / $139）": "Select Lifetime Unlimited (¥999 / $139)",
    "🔒 免费试用 20 个已用完 · 请先登录账号": "🔒 Free 20-Product Trial Used Up · Please Sign In",
    "🔒 免费试用 20 个已用完 · 请完成官方账号登录": "🔒 Free 20-Product Trial Used Up · Please Sign In",
    "🔒 您的 20 个免费试用产品额度已用完！请先登录您的官方账号（支持 Google 官方授权 或 全球邮箱注册登录）以继续使用或升级套餐。": "🔒 Your 20 free trial products have been used up! Please sign in with your official account (Google OAuth or Global Email) to continue or upgrade.",
    "🌐 Google 账号登录": "🌐 Google Account Sign In",
    "✕ 关闭": "✕ Close",
    "💎 小咩魔法采集 · 收费方案与授权管理": "💎 Xiaomie Magic Collector · Pricing & License Management",
    "🎁 免费试用版": "🎁 Free Trial",
    "/ 20 个产品": "/ 20 Products",
    "免费采集 20 个产品；试用期默认使用管理员内置 API（星号保密且灰色锁定不可修改）。": "Collect 20 products for free; uses built-in Admin API during trial (masked with asterisks and locked).",
    "当前方案": "Current Plan",
    "已升级百品包": "Upgraded to 100-Pack",
    "已升级终身版": "Upgraded to Lifetime",
    "📦 百品采集包": "📦 100-Product Pack",
    "/ 100 个产品": "/ 100 Products",
    "采集 100 个产品；激活后原管理员 API 立即清空销毁，开放底部 API 区域自行填入专属 Key。": "Collect 100 products; upon activation, the Admin API is immediately wiped and destroyed, unlocking the API section below for your own Key.",
    "选择 免费试用版（20个产品）": "Select Free Trial (20 Products)",
    "✅ 当前已选：免费试用（20个产品）": "✅ Selected: Free Trial (20 Products)",
    "选择 ¥500 百品采集包（100个产品）": "Select ¥500 100-Product Pack (100 Products)",
    "✅ 当前已选：¥500 百品包（100个）": "✅ Selected: ¥500 100-Pack (100 Products)",
    "激活 ¥500 百品包（+100额度）": "Activate ¥500 100-Pack (+100 Quota)",
    "👑 终身不限量授权": "👑 Lifetime Unlimited License",
    "/ 终身不限量": "/ Lifetime Unlimited",
    "一次授权长期使用，全网不限量采集（不赠送小咩图片翻译授权）；原管理员 API 清空销毁，自行填入专属 Key。": "One-time payment for lifetime unlimited collection (does not include Xiaomie Image Translator license); Admin API is wiped and destroyed, unlocking your own Key input.",
    "选择 ¥999 终身不限量授权": "Select ¥999 Lifetime Unlimited License",
    "✅ 当前已选：¥999 终身不限量": "✅ Selected: ¥999 Lifetime Unlimited",
    "激活 ¥999 终身不限量授权": "Activate ¥999 Lifetime Unlimited License",
    "🔒 请先登录后选择 ¥500 百品包": "🔒 Sign In First to Select ¥500 100-Pack",
    "🔒 请先登录后选择 ¥999 终身版": "🔒 Sign In First to Select ¥999 Lifetime",
    "🔒 未登录账号前不能选择第二档（¥500 百品采集包）和第三档（¥999 终身不限量授权）支付套餐，请先登录！": "🔒 Please sign in before selecting the 2nd (¥500 100-Product Pack) or 3rd (¥999 Lifetime Unlimited) paid plan!",
    "🔒 未登录账号前不能选择第二档（¥500 百品采集包）和第三档（¥999 终身不限量授权）支付套餐，请先登录账号！": "🔒 Please sign in before selecting the 2nd (¥500 100-Product Pack) or 3rd (¥999 Lifetime Unlimited) paid plan!",
    "👤 立即登录账号": "👤 Sign In Now",
    "支付二维码": "Payment QR Code",
    "支付宝": "Alipay",
    "✅ 核验支付交易单号与激活码，立即激活授权": "✅ Verify Transaction ID & License Key, Activate License",
    "✅ 核验境内支付宝单号与激活码，立即激活授权": "✅ Verify Alipay Order & License Key, Activate License",
    "✅ 核验 PayPal / 国际支付单号与激活码，立即激活授权": "✅ Verify PayPal/Global Payment & License Key, Activate License",
    "官方唯一收款通道：境内支付宝支付（Alipay）": "Domestic Payment Channel: Alipay",
    "官方收款支付宝：": "Official Payee Alipay: ",
    "｜ 客服与授权咨询邮箱：": "| Support & License Email: ",
    "客服与授权咨询邮箱：": "Support & License Email: ",
    "🔒 试用期模式（免费 20 个产品）：当前默认使用管理员内置 API，已做星号保密且灰色锁定无法修改。付费升级后，原管理员 API 将清空销毁，开放此区域供您自行填入 API。": "🔒 Trial Mode (Free 20 Products): Using built-in Admin API by default, masked with asterisks and greyed out (read-only). After paid upgrade, the Admin API is wiped and destroyed, unlocking this section for your own API.",
    "🔓 已激活付费方案：原管理员试用 API 已彻底清空销毁。请在此区域自行填入并保存您的专属 API Key。": "🔓 Paid Plan Activated: The built-in Admin Trial API has been completely wiped and destroyed. Please enter and save your own API Key below.",
    "④ 商品参数字段（核心必填 + 次要可选勾选）": "④ Product Specification Fields (Core Required + Secondary Optional)",
    "🌟 一、最重要核心字段（必填 / 默认必选）": "🌟 1. Core Important Fields (Required / Default Selected)",
    "带": "Items with",
    "为核心必填项，其余核心重要字段可自由勾选或填写默认值": "are required core fields; other core fields can be toggled or preset",
    "＋ 增加自定义核心字段": "+ Add Custom Core Field",
    "自动提取网页商品标题": "Auto-extract product title from webpage",
    "最重要核心必填参数": "Core Required Specification",
    "🧩 二、次要可选字段（可要可不要 · 勾选才写入商品资料.txt）": "🧩 2. Secondary Optional Fields (Check to include in Product Info)",
    "已为您筛出次要字段，需要哪项勾哪项，不勾选的次要字段绝不混入商品资料": "Secondary fields are filtered below; only checked items will be written into Product Info",
    "⭐ 推荐勾选（常用产品属性）": "⭐ Recommended (Common Product Specs)",
    "☑️ 全选次要字段": "☑️ Select All Secondary",
    "☐ 全不选次要（只留核心字段）": "☐ Unselect All Secondary (Core Only)",
    "📦 1. 常用产品次要参数（可要可不要 · 默认勾选）": "📦 1. Common Product Secondary Specs (Optional · Checked by Default)",
    "🚢 2. 外贸定制与资质参数（可要可不要 · 按需勾选）": "🚢 2. Trade & Customization Specs (Optional · Check as Needed)",
    "📊 3. 平台代发与店铺运营数据（如揽收率/铺货数/代发热度 · 默认不勾选，需要时可勾上）": "📊 3. Platform & Dropshipping Metrics (Unchecked by Default · Check if Needed)",
    "🔎 当前网页额外识别到的其他次要字段（可按需勾选）：": "🔎 Extra Secondary Fields Detected on Current Webpage (Check as Needed):",
    "同时保留网页上识别到的其余未列出次要属性（取消勾选则严格只输出上方已勾选字段）": "Also keep other unlisted webpage attributes (uncheck to strictly output only checked fields above)",
    "商品标题": "Product Title",
    "产品尺寸": "Product Dimensions",
    "单件重量": "Unit Weight",
    "容量": "Capacity",
    "功能": "Function",
    "包装方式": "Packaging",
    "包装规格": "Packaging Specs",
    "适用人群": "Target Audience",
    "产品类别": "Product Category",
    "单位": "Unit",
    "风格": "Style",
    "价格": "Price",
    "价格区间": "Price Range",
    "加印LOGO": "Print LOGO",
    "是否支持定制": "Customization Support",
    "主要下游平台": "Main Downstream Platforms",
    "主要销售地区": "Main Sales Regions",
    "产品上市时间": "Product Launch Time",
    "专利类型": "Patent Type",
    "版权": "Copyright",
    "送礼用途": "Gift Purpose",
    "是否跨境出口专供货源": "Cross-border Exclusive Supply",
    "是否进口": "Imported",
    "是否一次性": "Disposable",
    "是否量贩装": "Bulk Pack",
    "24h揽收率": "24h Collection Rate",
    "48h揽收率": "48h Collection Rate",
    "代发品质达标率": "Dropship Quality Rate",
    "近7天代发数量": "7-Day Dropship Volume",
    "近30天代发数量": "30-Day Dropship Volume",
    "下游铺货数": "Downstream Listings",
    "铺货分销商数": "Distributor Count",
    "商家代发热度": "Dropship Popularity",
    // 新增：B2B / B2C 推荐预设、双 Tab 页面采集字段设置、非商品页采集字段与真实登录弹窗词条
    "🏭 B2B 常用字段自动勾选（外贸/批发）": "🏭 B2B Common Fields Preset (Export / Wholesale)",
    "🛍️ B2C 常用字段自动勾选（零售/种草）": "🛍️ B2C Common Fields Preset (Retail / Social)",
    "💡 当前推荐模式：可一键切换【🏭 B2B 外贸批发重中之重】（聚焦规格、尺寸、单重、容量、包装、加印LOGO、定制、专利、出口资质）或【🛍️ B2C 零售种草重中之重】（聚焦规格、颜色、尺寸、重量、容量、功能、适用人群、风格、送礼场景，自动剔除工厂术语）。": "💡 Current Preset Mode: One-click switch between [🏭 B2B Export / Wholesale Priorities] (Specs, Dimensions, Unit Weight, Capacity, Packaging, Print LOGO, Customization, Patent & Export Supply) or [🛍️ B2C Retail / Social Priorities] (Specs, Color, Dimensions, Weight, Capacity, Function, Target Audience, Style & Gift Purpose, excluding factory terms).",
    "💡": "💡",
    "当前推荐模式：": "Current Preset Mode:",
    "可一键切换": "One-click switch between",
    "🏭 B2B 外贸批发重中之重": "🏭 B2B Export & Wholesale Priorities",
    "（聚焦规格/尺寸/单重/容量/包装/加印LOGO/定制/专利/出口资质）或": "(focusing on Specs, Dimensions, Unit Weight, Capacity, Packaging, Print LOGO, Customization, Patent & Export Supply) or",
    "🛍️ B2C 零售种草重中之重": "🛍️ B2C Retail & Social Priorities",
    "（聚焦规格/颜色/尺寸/重量/容量/功能/适用人群/风格/送礼场景，自动剔除工厂术语）。": "(focusing on Specs, Color, Dimensions, Weight, Capacity, Function, Target Audience, Style & Gift Purpose, automatically excluding factory terms).",
    "✅ 当前已启用【🏭 B2B 外贸/批发重中之重】（共 15 项次要 + 全部 12 项核心）：已自动勾选 交期、起订量、规格、颜色、产品尺寸、单件重量、容量、功能、包装方式、包装规格、产品类别、单位、加印LOGO、是否支持定制、主要销售地区、专利类型、版权、是否跨境出口专供货源（自动屏蔽 1688 拿货单价与零售杂项）。": "✅ Activated [🏭 B2B Export / Wholesale Priorities] (16 Secondary + All 12 Core Fields): Automatically checked Lead Time, MOQ, Specs, Color, Product Dimensions, Unit Weight, Capacity, Function, Packaging, Packaging Specs, Product Category, Unit, Print LOGO, Customization Support, Main Sales Regions, Patent Type, Copyright, Cross-border Exclusive Supply (automatically hides 1688 wholesale unit price & retail clutter).",
    "✅ 当前已启用【🛍️ B2C 零售/种草重中之重】（共 14 项次要 + 10 项核心）：已自动勾选 规格、颜色、产品尺寸、单件重量、容量、功能、包装方式、适用人群、产品类别、风格、价格、产品上市时间、送礼用途、是否量贩装（自动剔除起订量、交期、加印LOGO等工厂批发术语）。": "✅ Activated [🛍️ B2C Retail / Social Priorities] (14 Secondary + 10 Core Fields): Automatically checked Specs, Color, Product Dimensions, Unit Weight, Capacity, Function, Packaging, Target Audience, Product Category, Style, Price, Product Launch Time, Gift Purpose, Bulk Pack (automatically excludes MOQ, Lead Time, Print LOGO & other factory wholesale terms).",
    "☑️ 当前已全选所有次要可选字段（含动态识别属性）。": "☑️ Selected all secondary optional fields (including dynamically detected attributes).",
    "☐ 当前已清空所有次要可选字段（仅输出上方核心必填字段）。": "☐ Cleared all secondary optional fields (outputs core required fields only).",
    "④ 页面采集字段设置（商品页面 ／ 非商品页面 Tab 切换）": "④ Page Collection Field Settings (Product Page / Non-Product Page Tabs)",
    "🛒 商品页面勾选字段": "🛒 Product Page Fields",
    "（核心必填 + 次要可选参数）": "(Core Required + Secondary Optional)",
    "🎬 非商品页面采集": "🎬 Non-Product Page Collection",
    "（视频 / 动图 / 图文 / 社媒）": "(Video / GIF / Article / Social Media)",
    "🎬 一、非商品页核心采集项（视频 / 动图 / 配图 / 正文 · 默认必选）": "🎬 1. Non-Product Core Collection Items (Video / GIF / Images / Copy · Default Selected)",
    "适用于抖音/B站/小红书/YouTube/公众号/知乎/博客/素材网等非商品网页，可自由勾选或填写默认值": "For Douyin, Bilibili, Xiaohongshu, YouTube, WeChat Articles, Zhihu, blogs & media pages; toggle or preset freely",
    "＋ 增加自定义采集项": "+ Add Custom Collection Item",
    "🧩 二、非商品页次要可选字段（可要可不要 · 勾选才写入文案.txt）": "🧩 2. Non-Product Secondary Optional Fields (Check to include in Copy.txt)",
    "针对视频参数、社媒互动数据、AI总结与脚本提炼等次要信息，需要哪项勾哪项": "For video specs, social engagement metrics, AI summary & script extraction; check only what you need",
    "⭐ 推荐勾选（常用视频/图文属性）": "⭐ Recommended (Common Video / Article Specs)",
    "☐ 全不选次要（只留核心项）": "☐ Unselect All Secondary (Core Only)",
    "🎬 1. 视频与多媒体附加参数（可要可不要 · 默认勾选常用项）": "🎬 1. Video & Multimedia Parameters (Optional · Common Items Checked)",
    "🔥 2. 社媒互动与传播数据（播放/点赞/评论/粉丝 · 按需勾选）": "🔥 2. Social Media Engagement Metrics (Views / Likes / Comments / Followers · Check as Needed)",
    "🤖 3. AGNES AI 智能提炼与二创（总结/脚本提炼/爆款改写 · 按需勾选）": "🤖 3. AGNES AI Smart Summary & Remix (Summary / Storyboard / Viral Rewrite · Check as Needed)",
    "网页/视频标题": "Page / Video Title",
    "编号/归档号": "Archive Code / ID",
    "网页视频采集": "Web Video Capture",
    "动图与动画采集": "GIF & Animation Capture",
    "视频封面/首图": "Video Cover / Main Image",
    "正文高清配图": "Article HD Images",
    "正文文案提取": "Body Copy Extraction",
    "作者/来源账号": "Author / Channel",
    "发布时间": "Publish Time",
    "话题标签/关键词": "Hashtags / Keywords",
    "视频时长": "Video Duration",
    "分辨率与画幅比例": "Resolution & Aspect Ratio",
    "核心摘要/导语": "Core Summary / Lead",
    "视频原声/BGM信息": "Original Audio / BGM Info",
    "字幕/台词文本": "Subtitles / Transcript",
    "所属频道/分类栏目": "Channel / Category",
    "原始来源网址": "Original Source URL",
    "播放量/阅读量": "Views / Reads",
    "点赞数": "Likes",
    "收藏数": "Favorites",
    "转发/分享数": "Shares / Reposts",
    "评论数": "Comments",
    "弹幕数": "Danmaku Count",
    "高赞神评摘录": "Top Comments Excerpt",
    "作者粉丝数": "Author Followers",
    "作者主页链接": "Author Profile URL",
    "IP属地/发布地点": "IP Location / Region",
    "AI 内容核心总结": "AI Core Summary",
    "AI 视频分镜脚本提炼": "AI Video Storyboard Script",
    "AI 爆款文案改写": "AI Viral Copy Rewrite",
    "留空自动提取网页标题（可填写改写商品标题）": "Leave blank to auto-extract title (or enter custom title)",
    "留空自动提取标题（可填写改写标题）": "Leave blank to auto-extract title (or enter custom title)",
    "自动嗅探 MP4/WebM/流媒体视频（可填备注）": "Auto-detect MP4/WebM/streaming video (optional note)",
    "自动采集 GIF / WebP / APNG / SVG 动图": "Auto-collect GIF / WebP / APNG / SVG animations",
    "自动提取视频封面海报与首图": "Auto-extract video cover poster & lead image",
    "自动采集文章/帖子正文高清插图": "Auto-collect HD illustrations from article body",
    "自动提取正文文案/视频简介写入文案.txt": "Auto-extract body copy / video description into Copy.txt",
    "留空自动提取（可填写指定作者/频道名）": "Leave blank to auto-extract (or specify author/channel)",
    "留空自动提取发布日期": "Leave blank to auto-extract publish date",
    "留空自动提取 #话题标签 / 关键词": "Leave blank to auto-extract #hashtags / keywords",
    "¥0 免费真实验证": "¥0 Free Verified Auth",
    "🌐 Google 真实授权登录": "🌐 Google Verified Sign In",
    "📱 手机号 + 💬 微信扫码登录": "📱 Phone + 💬 WeChat QR Sign In",
    "👤 账号真实授权登录（免费）": "👤 Verified Account Sign In (Free)",
    "🌐 Google 真实授权": "🌐 Google Verified Auth",
    "📱 手机号 + 💬 微信扫码": "📱 Phone + 💬 WeChat QR",
    "方式 ①：一键读取当前 Chrome 已登录的 Google 账号": "Method 1: One-Click Read Chrome Signed-In Google Account",
    "自动检测您当前 Chrome 浏览器已登录的 Google 账号；若浏览器未开启同步，请用下方方式 ② 验证 Gmail 邮箱。": "Detects the Google account signed in to your Chrome browser; if Chrome Sync is off, use Method 2 below to verify your Gmail.",
    "🌐 一键检测并登录 Chrome 的 Google 账号": "🌐 One-Click Detect & Sign In with Chrome Google Account",
    "🚀 真实 Google 官方弹窗授权登录（OAuth 2.0）": "🚀 Real Google Official OAuth 2.0 Sign In",
    "点击下方按钮将直接调起 Google 官方登录窗口（": "Clicking the button below directly launches the Google official sign-in popup (",
    "），在谷歌官方网页完成账号授权，100% 官方真实连接！": "), completing authorization directly on Google's official page with 100% genuine connection!",
    "🚀 调起 Google 官方授权登录窗口（accounts.google.com）": "🚀 Launch Google Official Sign-In Popup (accounts.google.com)",
    "🌐 免弹窗：一键直读当前 Chrome 已登录的 Google 账号": "🌐 Popup-Free: One-Click Read Signed-In Chrome Google Account",
    "⚙️ 官方配置：Google OAuth Client ID 设置（配置一次永久生效）": "⚙️ Official Config: Google OAuth Client ID Settings (Save once, active permanently)",
    "Google 官方要求调用登录弹窗需绑定一个免费 Client ID。您可在": "Google requires a free Client ID to trigger the sign-in popup. You can create one on",
    "Google 云控制台 ↗": "Google Cloud Console ↗",
    "免费创建凭据：": "for free:",
    "当前插件重定向网址 (Redirect URI)：": "Extension Redirect URI:",
    "填入 Google OAuth Client ID（xxxx.apps.googleusercontent.com）": "Enter Google OAuth Client ID (xxxx.apps.googleusercontent.com)",
    "保存配置": "Save Config",
    "已修复微信纯文本拦截：": "WeChat Plain-Text Block Fixed:",
    "现在二维码已升级为": "The QR code is now upgraded to a",
    "微信白名单安全网页链接（https）": "WeChat-whitelisted secure https link",
    "，手机微信扫一扫会": "; scanning with WeChat will",
    "直接打开网页并在顶部搜索框显示 6 位验证码": "open the page and display the 6-digit code in the top search bar",
    "（也可点击下方「直接获取验证码」按钮）。": "(or click the 'Get Code Directly' button below).",
    "第 1 步：输入您的 11 位真实手机号码": "Step 1: Enter Your 11-Digit Phone Number",
    "请输入 11 位手机号（如 19730325611）": "Enter 11-digit phone number (e.g. 19730325611)",
    "🔄 刷新二维码": "🔄 Refresh QR",
    "第 2 步：请先在上方输入 11 位手机号生成微信专属二维码": "Step 2: Enter your 11-digit phone number above to generate your WeChat QR code",
    "⚠️ 请先在第 1 步输入真实的 11 位手机号码，再生成微信专属二维码": "⚠️ Please enter a valid 11-digit phone number in Step 1 first to generate your WeChat QR code",
    "手机微信扫一扫后，自动打开网页并在手机顶部框内显示": "Scan with WeChat to open the webpage showing your",
    "6 位数字验证码": "6-digit verification code",
    "📲 手机不便扫码？点此直接生成并填入 6 位动态验证码": "📲 Can't scan right now? Click here to generate & fill the 6-digit code directly",
    "第 3 步：输入 6 位动态验证码": "Step 3: Enter 6-Digit Dynamic Code",
    "输入微信扫码显示的 6 位数字验证码": "Enter the 6-digit verification code",
    "选填：微信昵称/备注": "Optional: WeChat Nickname",
    "💬 核验 6 位动态码并完成登录": "💬 Verify 6-Digit Code & Sign In",
    "现货500，定制颜色1000": "500 in stock, 1000 for custom color",
    "永康市，浙江省，中国": "Yongkang, Zhejiang, China",
    "待输入 11 位手机号后": "Enter your 11-digit phone number above",
    "自动生成您的微信扫码口令二维码": "to generate your WeChat verification QR code",
    "💳 收银台：📦 百品采集包（100个产品） — 应付 ¥500.00 ($69.00 USD)": "💳 Cashier: 📦 100-Product Pack — Due ¥500.00 ($69.00 USD)",
    "💳 收银台：📦 百品采集包（100个产品额度） — 应付 ¥500.00 ($69.00 USD)": "💳 Cashier: 📦 100-Product Pack — Due ¥500.00 ($69.00 USD)",
    "💳 收银台：👑 终身不限量授权（终身不限次数） — 应付 ¥999.00 ($139.00 USD)": "💳 Cashier: 👑 Lifetime Unlimited License — Due ¥999.00 ($139.00 USD)",
    "支持境内支付宝 / 境外空中快车（Airwallex） / 微信支付": "Supports Domestic Alipay / Cross-Border Airwallex / WeChat Pay",
    "💙 境内支付宝支付（Alipay）": "💙 Domestic Alipay",
    "🌐 境外空中快车支付（Airwallex）": "🌐 Cross-Border Airwallex",
    "💚 境内微信支付（WeChat Pay）": "💚 Domestic WeChat Pay",
    "请使用手机【境内支付宝】扫描左侧二维码完成支付": "Please scan the QR code on the left with Domestic Alipay",
    "请使用手机【境内支付宝 Alipay】扫描左侧二维码完成人民币支付": "Please scan the QR code on the left with Domestic Alipay (CNY)",
    "🌐 境外空中快车（Airwallex）：请扫码或点击下方按钮打开国际收银台（支持 Visa / MasterCard / Apple Pay / 多币种）": "🌐 Cross-Border Airwallex: Scan QR or click the button below to open International Checkout (Visa / MasterCard / Apple Pay / Multi-Currency)",
    "请使用手机【境内微信 WeChat】扫描左侧二维码完成人民币支付": "Please scan the QR code on the left with Domestic WeChat Pay (CNY)",
    "选填：支付宝流水号 / Airwallex 跨境交易单号（加速核验）": "Optional: Alipay Transaction No. / Airwallex Order ID (faster verification)",
    "🌐 打开空中快车在线收银台网页（Visa/MasterCard）": "🌐 Open Airwallex Online Checkout (Visa/MasterCard)",
    "✅ 我已完成境内支付宝支付，立即激活授权": "✅ I Have Paid via Domestic Alipay, Activate License Now",
    "✅ 我已完成境外空中快车（Airwallex）支付，立即激活授权": "✅ I Have Paid via Airwallex, Activate License Now",
    "✅ 我已完成境内微信支付，立即激活授权": "✅ I Have Paid via Domestic WeChat Pay, Activate License Now",
    "境内支付宝支付（Alipay）": "Domestic Alipay",
    "境外空中快车支付（Airwallex 国际信用卡/外币）": "Cross-Border Airwallex (Intl Cards / Foreign Currency)",
    "💳 国际卡与多币种收单通道：支持": "💳 International Card & Multi-Currency Channel: Supports",
    "（SSL 256-bit 跨境加密结算）": "(SSL 256-bit Encrypted Settlement)",
    "防白嫖真实核验机制": "Verified Payment Protection",
    "：扫码或网页支付完成后，请填写您的": ": After paying via QR or web checkout, enter your",
    "支付交易流水号": "Payment Transaction ID",
    "专属加密激活码": "Encrypted License Key",
    "（凭付款截图/单号自动或联系客服秒发），核验通过立即发放额度（百品包支持多次复购累加额度）。": "(obtained with your receipt/order ID) to activate your quota immediately (100-Product Packs stack automatically).",
    "🌐 打开空中快车（Airwallex）在线收银台网页支付（Visa / MasterCard）": "🌐 Open Airwallex Online Checkout Page (Visa / MasterCard)",
    "第 1 项：支付流水号 / Airwallex 交易单号": "1. Payment Transaction No. / Airwallex Order ID",
    "填入支付宝账单号或 Airwallex 单号": "Enter Alipay Transaction No. or Airwallex Order ID",
    "第 2 项：专属加密激活码（License Key）": "2. Encrypted License Key",
    "填入 8 位加密激活码（如 XM8F-39A2）": "Enter 8-char License Key (e.g. XM8F-39A2)",
    "✅ 核验支付单号与激活码，立即激活授权": "✅ Verify Order ID & License Key to Activate",
    "✅ 核验境内支付宝单号与激活码，立即激活授权": "✅ Verify Domestic Alipay Order ID & License Key to Activate",
    "✅ 核验境外空中快车（Airwallex）单号与激活码，立即激活授权": "✅ Verify Airwallex Order ID & License Key to Activate",
    "✅ 核验境内微信支付单号与激活码，立即激活授权": "✅ Verify WeChat Pay Order ID & License Key to Activate",
    "🛡️ 已激活付费套餐（防降级锁定）": "🛡️ Paid Plan Active (Downgrade Locked)",
    "🛡️ 已拥有最高等级终身版": "🛡️ Lifetime Unlimited Active",
    "✅ 当前已选：百品包（点此可续购+100个）": "✅ Active: 100-Pack (Click to Add +100)",
    "应付：¥500.00": "Due: ¥500.00",
    "应付：¥999.00": "Due: ¥999.00",
    "应付：$69.00 (¥500)": "Due: $69.00 (¥500)",
    "应付：$139.00 (¥999)": "Due: $139.00 (¥999)",
    "💙 官方唯一收款通道：境内支付宝支付（Alipay）": "💙 Official Payment Channel: Domestic Alipay",
    "💙 境内支付宝扫码支付（Alipay）": "💙 Domestic Alipay QR Payment",
    "：支付宝扫码付款完成后，请在下方填写您的": ": After scanning with Alipay to pay, enter your",
    "支付宝账单流水号（订单号）": "Alipay Transaction / Order No.",
    "（凭付款截图/单号联系客服秒发），核验通过立即发放额度（百品包支持多次复购累加额度）。": "(obtained with your payment screenshot/order No.) to activate your quota immediately (100-Product Packs stack automatically).",
    "第 1 项：支付宝交易流水号（账单订单号）": "1. Alipay Transaction / Order No.",
    "填入支付宝账单详情中的 16~28 位订单号": "Enter the 16-28 digit Order No. from Alipay bill details",
    "官方支持支付方式：": "Official Payment Method: ",
    "💙 境内支付宝支付（Alipay）": "💙 Domestic Alipay",
    "💳 收款支付宝账号：": "💳 Alipay Payee Account: ",
    "👤 收款人真实姓名：": "👤 Payee Name: ",
    "李建": "Li Jian",
    "（手机支付宝转账时核对姓名为": "(Verify name when transferring: ",
    "📋 一键复制支付宝账号": "📋 One-Click Copy Alipay Account",
    "请使用手机【支付宝】扫码转账，或直接转账至上方账号：2315748@qq.com（李建）": "Please scan QR with Alipay or transfer to account: 2315748@qq.com (Li Jian)",
    "：转账完成后，请在下方填写您的": ": After transferring, enter your",
    "官方收款支付宝：": "Official Alipay Payee: ",
    "🚀 前往支付宝全自动发卡收银台（付完屏幕秒出卡密） ↗": "🚀 Open Alipay Automated Checkout (Instant On-Screen License Key) ↗",
    "🚀 前往海外全自动收银台付款（付完屏幕秒出 License Key） ↗": "🚀 Open Global Automated Checkout (Instant On-Screen License Key) ↗",
    "专属加密激活码 / 自动发卡卡密（License Key）": "Encrypted License Key / Card Code",
    "支付交易流水号（可选 · 直接转账备用核验）": "Payment Transaction No. (Optional / Backup)",
    "✅ 立即自动核验激活码，开通授权": "✅ Verify License Key & Activate Instantly",
    "📦 批量生成 20 个百品包库存卡密 (¥500 / $69)": "📦 Batch Generate 20 100-Pack License Keys (¥500 / $69)",
    "👑 批量生成 20 个终身版库存卡密 (¥999 / $139)": "👑 Batch Generate 20 Lifetime License Keys (¥999 / $139)",
    "📋 一键复制全部卡密库存": "📋 Copy All License Keys to Clipboard",
    "保存发卡链接": "Save Checkout Link",
    "粘贴购买后获得的专属激活卡密": "Paste your License Key obtained after purchase",
    "若为直接转账，可填入支付宝流水号或交易ID": "For direct transfer, enter Alipay Transaction No. or Order ID",
    "输入您的邮箱（如 2315748@qq.com、user@gmail.com 等）": "Enter your email (e.g. 2315748@qq.com, user@gmail.com, etc.)",
    "⭐ VIP 用户（百品采集包）": "⭐ VIP Plan (100 Products)",
    "👑 SVIP 终身至尊用户（全网不限量）": "👑 SVIP Lifetime Plan (Unlimited)",
    "选择 VIP 用户（¥500 / $69）": "Choose VIP Plan (¥500 / $69)",
    "选择 SVIP 终身至尊用户（¥999 / $139）": "Choose SVIP Lifetime Plan (¥999 / $139)",
    "⭐ 批量生成 20 个 VIP 用户卡密 (¥500 / $69)": "⭐ Batch Generate 20 VIP License Keys (¥500 / $69)",
    "👑 批量生成 20 个 SVIP 至尊卡密 (¥999 / $139)": "👑 Batch Generate 20 SVIP License Keys (¥999 / $139)",
    "👑 SVIP 终身至尊用户": "👑 SVIP Lifetime User",
    "⭐ VIP 用户": "⭐ VIP User",
  };

  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
  const CJK_STRICT = /[\u3400-\u9fff\uf900-\ufaff]/;
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];

  /* ---------------- 机翻引擎链 ----------------
   * 多个免费接口依次兜底：谷歌（易被限流 429）→ 百度 → MyMemory → LLM7。
   * 调度：串行排队、最近成功的引擎优先、失败短暂退避并自动重试；全部失败时 15 秒内快速失败，
   * 由调用方保证“一份资料只有一种语言”（整份退回原文语言），而不是半中半英。
   */
  const down = {};
  const LLM_MODELS = ["minimax-m2.7"];
  const ENGINE_MAX = { builtin: 1500, youdao: 800, gtx: 1400, baidu: 1500, mymemory: 450, llm: 1200 };
  const engines = {
    gtx: async (q, lang) => {
      const tl = lang === "en" ? "en" : "zh-CN";
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "q=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) { const e = new Error("gtx " + r.status); e.status = r.status; throw e; }
      const j = await r.json();
      const out = (j[0] || []).map(x => x[0] || "").join("");
      if (!out.trim()) throw new Error("gtx empty");
      return out;
    },
    // 浏览器内置离线翻译（Chrome/Edge 的 Translator API）：模型已下载时不联网、无限流，最稳；未下载则自动跳过
    builtin: async (q, lang) => {
      if (typeof Translator === "undefined") throw new Error("builtin unsupported");
      const tl = lang === "en" ? "en" : "zh";
      const sl = /[\u3400-\u9fff]/.test(q) ? "zh" : "en";
      if (sl === tl) return q;
      const key = sl + ">" + tl;
      if (!engines._tr) engines._tr = {};
      if (!engines._tr[key]) {
        const av = await Translator.availability({ sourceLanguage: sl, targetLanguage: tl });
        if (av !== "available") throw new Error("builtin model " + av);
        engines._tr[key] = await Translator.create({ sourceLanguage: sl, targetLanguage: tl });
      }
      const out = [];
      for (const line of q.split("\n")) out.push(line.trim() ? await engines._tr[key].translate(line) : line);
      return out.join("\n");
    },    // 有道翻译演示接口：国内可直连、免密钥、自动识别语言方向（中→英 / 英→中），多行文本会保留换行
    youdao: async (q, lang) => {
      const to = lang === "en" ? "en" : "zh-CHS";
      const r = await fetch("https://aidemo.youdao.com/trans?from=Auto&to=" + to + "&q=" + encodeURIComponent(q), { signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error("youdao " + r.status);
      const j = await r.json();
      // 102 = 无法识别语言（常见于品牌名/型号这类单个生造词）：原样放行，不必也无法翻译
      if (String(j.errorCode) === "102" && !/\s/.test(q.trim()) && q.length <= 40) return q;
      const out = Array.isArray(j.translation) ? j.translation.join("\n") : "";
      if (!out.trim() || String(j.errorCode) !== "0") throw new Error("youdao code " + j.errorCode);
      if (lang === "en" && /[\u3400-\u9fff]/.test(out)) throw new Error("youdao direction mismatch");
      return out;
    },
    baidu: async (q, lang) => {
      const r = await fetch("https://fanyi.baidu.com/transapi", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `from=auto&to=${lang === "en" ? "en" : "zh"}&source=txt&query=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error("baidu " + r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.data) || !j.data.length) throw new Error("baidu errno " + (j && j.errno));
      return j.data.map(x => x.dst || "").join("\n");
    },    mymemory: async (q, lang) => {
      const pair = lang === "en" ? "Autodetect|en" : "Autodetect|zh-CN";
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw new Error("mymemory " + r.status);
      const j = await r.json();
      const t = j && j.responseData && j.responseData.translatedText;
      if (!t || (j.responseStatus && Number(j.responseStatus) !== 200) || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) throw new Error("mymemory limit");
      return t;
    },
    llm: async (q, lang) => {
      const target = lang === "en" ? "English" : "Simplified Chinese";
      const sys = `You are a translation engine. Translate the user's text into ${target}. Output ONLY the translation, with exactly the same number of lines. Keep emojis, numbers, URLs, model codes and punctuation structure. Never leave any words of the source language untranslated, except brand names and acronyms.`;
      let lastErr;
      // 优先使用面板底部已保存的 Agnes / 书生 Key 进行翻译兜底
      try {
        const s = await chrome.storage.local.get(["agnesModel", "agnesBase", "agnesKey", "internModel", "internBase", "internKey"]).catch(() => ({}));
        for (const p of ["agnes", "intern"]) {
          const base = String(s[p + "Base"] || "").trim().replace(/\/+$/, "");
          const model = String(s[p + "Model"] || "").trim();
          const key = String(s[p + "Key"] || "").trim();
          if (!base || !model || !key || /^\*+$/.test(key) || /^\*+$/.test(base)) continue;
          try {
            const r = await fetch(`${base}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
              body: JSON.stringify({ model, max_tokens: 1800, messages: [{ role: "system", content: sys }, { role: "user", content: q }] }),
              signal: AbortSignal.timeout(12000),
            });
            if (r.ok) {
              const j = await r.json();
              const out = (((j.choices || [])[0] || {}).message || {}).content?.trim() || "";
              if (out) return out;
            }
          } catch (e) { lastErr = e; }
        }
      } catch (e) {}
      for (const model of LLM_MODELS) {
        try {
          const r = await fetch("https://api.llm7.io/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model, max_tokens: 1800,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: q },
              ],
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) { const e = new Error("llm " + r.status); e.status = r.status; throw e; }
          const j = await r.json();
          const out = (((j.choices || [])[0] || {}).message || {}).content?.trim() || "";
          if (!out) throw new Error("llm empty");
          return out;
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error("llm failed");
    },
  };

  // 百度接口会校验 Origin/Referer：为扩展页发出的请求去掉 Origin、补上 Referer（需要 declarativeNetRequest 权限）
  try {
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [90801],
        addRules: [{
          id: 90801, priority: 1,
          action: { type: "modifyHeaders", requestHeaders: [
            { header: "Origin", operation: "remove" },
            { header: "Referer", operation: "set", value: "https://fanyi.baidu.com/" },
          ] },
          condition: { urlFilter: "||fanyi.baidu.com/transapi", resourceTypes: ["xmlhttprequest"] },
        }],
      }).catch(() => {});
    }
  } catch (e) { /* 无权限时百度引擎会失败并自动改用下一个 */ }

  const sleepMs = ms => new Promise(r => setTimeout(r, ms));
  let lastGood = "";
  const errLog = {}; // 各接口最近一次失败原因（供自检/排查）
  let allDownUntil = 0;
  let mtChain = Promise.resolve();

  function splitLong(line, max) {
    if (line.length <= max) return [line];
    const out = [];
    let cur = "";
    for (const p of line.split(/(?<=[。！？!?；;，,.])/)) {
      if ((cur + p).length > max && cur) { out.push(cur); cur = ""; }
      cur += p;
      while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
    }
    if (cur) out.push(cur);
    return out;
  }

  // 按引擎的单次长度上限拆分、逐段翻译，再按原行数拼回
  async function runEngine(name, text, lang) {
    const max = ENGINE_MAX[name] || 1000;
    const lines = text.split(/\r?\n/);
    const groups = [];
    let cur = [], len = 0;
    for (let li = 0; li < lines.length; li++) {
      for (const piece of splitLong(lines[li], max)) {
        if (cur.length && len + piece.length + 1 > max) { groups.push(cur); cur = []; len = 0; }
        cur.push({ li, piece });
        len += piece.length + 1;
      }
    }
    if (cur.length) groups.push(cur);
    const outLines = lines.map(() => []);
    for (const g of groups) {
      const res = await engines[name](g.map(x => x.piece).join("\n"), lang);
      const rl = String(res).split(/\r?\n/);
      if (rl.length === g.length) g.forEach((x, i) => outLines[x.li].push(rl[i]));
      else for (const x of g) outLines[x.li].push(await engines[name](x.piece, lang));
    }
    return outLines.map(a => a.join(lang === "zh" ? "" : " ").trim()).join("\n");
  }

  // 各接口的最小调用间隔：免费接口都有频率限制，放慢一点反而更稳（429/411 就是被限流）
  const MIN_GAP = { builtin: 0, youdao: 1100, gtx: 700, mymemory: 1500, baidu: 700, llm: 1500 };
  const lastCall = {};
  async function paceEngine(name) {
    const wait = (lastCall[name] || 0) + (MIN_GAP[name] || 500) - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall[name] = Date.now();
  }  function engineOrder() {
    const all = ["builtin", "youdao", "gtx", "mymemory", "baidu", "llm"];
    return lastGood ? [lastGood, ...all.filter(x => x !== lastGood)] : all;
  }

  async function mtRawNow(text, lang) {
    if (Date.now() < allDownUntil) throw new Error("mt unavailable (fast fail)");
    let lastErr = new Error("no engine");
    for (let round = 0; round < 2; round++) {
      for (const name of engineOrder()) {
        if (down[name] && Date.now() < down[name]) continue;
        try {
          await paceEngine(name);
          const out = await runEngine(name, text, lang);
          lastGood = name;
          delete down[name];
          return out;
        } catch (e) {
          errLog[name] = String((e && e.message) || e).slice(0, 80);
          // “方向不符”只是这一段文字的问题，不能因此把整个接口停用；限流/网络错误才短暂停用
          if (!(e && /direction mismatch/.test(String(e.message)))) down[name] = Date.now() + ((e && e.status === 429) || /code 411/.test(String((e && e.message) || "")) ? 45000 : 8000 * (round + 1));
          lastErr = e;
        }
      }
      await sleepMs(600);
    }
    allDownUntil = Date.now() + 2000; // 所有接口都失败：短暂快速失败，避免拖慢采集；2 秒后即可重试
    throw lastErr;
  }

  function mtRaw(text, lang) {
    const run = mtChain.then(() => mtRawNow(text, lang));
    mtChain = run.catch(() => {}).then(() => sleepMs(80));
    return run;
  }

  // 翻译服务自检：逐个测试每个接口能否在本机使用，返回 [{name, ok, ms, error}]
  async function diagnose() {
    const res = [];
    for (const name of ["builtin", "youdao", "gtx", "mymemory", "baidu", "llm"]) {
      const t0 = Date.now();
      try {
        const out = await engines[name]("Purple kite flower\nApplicable holidays", "zh");
        res.push({ name, ok: /[\u4e00-\u9fff]/.test(out), ms: Date.now() - t0, error: /[\u4e00-\u9fff]/.test(out) ? "" : "返回内容不是中文: " + String(out).slice(0, 40) });
      } catch (e) {
        res.push({ name, ok: false, ms: Date.now() - t0, error: String((e && e.message) || e) });
      }
    }
    return res;
  }
  // 批量翻译多行（尽量一次请求），行数对不上时逐条重试；返回与输入等长的数组（失败项为 ""）
  async function mtLines(arr, lang) {
    const out = new Array(arr.length).fill("");
    let i = 0;
    while (i < arr.length) {
      const idx = [];
      let len = 0;
      while (i < arr.length && (idx.length === 0 || len + arr[i].length < 1200)) { idx.push(i); len += arr[i].length + 1; i++; }
      const flat = idx.map(k => String(arr[k]).replace(/\s*\n+\s*/g, " "));
      let res = null;
      if (flat.length > 1) {
        try {
          const lines = (await mtRaw(flat.join("\n"), lang)).split(/\r?\n/);
          if (lines.length === flat.length) res = lines;
        } catch (e) { /* 逐条 */ }
      }
      if (!res) {
        res = [];
        for (const s of flat) { try { res.push(await mtRaw(s, lang)); } catch (e) { res.push(""); } }
      }
      idx.forEach((k, j) => { out[k] = String(res[j] || "").trim(); });
    }
    return out;
  }

  /* ---------------- 界面翻译（中文 → English） ---------------- */
  let lang = "zh";
  const cache = new Map();            // 中文原文 → 英文
  const CACHE_KEY = "uiTransCache_en_v115";
  const textRecs = new Map();         // Text node → {orig, tr}
  const attrRecs = new Map();         // Element → {attr: {orig, tr}}
  const valRecs = new Map();          // input → {orig, tr}
  const pending = new Set();
  let flushTimer = 0;
  let observer = null;
  let saveTimer = 0;

  function dictLookup(s) {
    const k = String(s ?? "").trim();
    return DICT[k] || cache.get(k) || "";
  }

  function inToggle(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !!(el && el.closest && el.closest("#langToggle"));
  }

  function queue(s) {
    pending.add(s);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 120);
  }

  async function flush() {
    const items = [...pending].filter(s => !cache.has(s) && !DICT[s]);
    pending.clear();
    if (!items.length) { applyAll(); return; }
    const batches = [];
    let cur = [], len = 0;
    for (const s of items) {
      if (len + s.length > 1400 && cur.length) { batches.push(cur); cur = []; len = 0; }
      cur.push(s); len += s.length + 1;
    }
    if (cur.length) batches.push(cur);
    for (const b of batches) {
      const flat = b.map(s => s.replace(/\s*\n+\s*/g, " "));
      let outs = null;
      try {
        const res = await mtRaw(flat.join("\n"), "en");
        const lines = res.split(/\r?\n/);
        if (lines.length === flat.length) outs = lines;
      } catch (e) { /* 逐条重试 */ }
      if (!outs) {
        outs = [];
        for (const s of flat) {
          try { outs.push(await mtRaw(s, "en")); } catch (e) { outs.push(""); }
        }
      }
      b.forEach((s, i) => { const t = String(outs[i] || "").trim(); if (t && !CJK_STRICT.test(t)) cache.set(s, t); });
    }
    scheduleSave();
    if (lang === "en") applyAll();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const obj = {};
        let n = 0;
        for (const [k, v] of cache) { if (n++ > 3000) break; obj[k] = v; }
        chrome.storage.local.set({ [CACHE_KEY]: obj }).catch(() => {});
      } catch (e) {}
    }, 800);
  }

  function translateStr(raw) {
    const m = String(raw).match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    if (!core || !CJK.test(core)) return null;
    const hit = DICT[core] || cache.get(core);
    if (hit) return m[1] + hit + m[3];
    if (core.includes("、")) {
      const parts = core.split("、").map(p => p.trim()).filter(Boolean);
      if (parts.length > 1 && parts.every(p => DICT[p])) {
        const joined = parts.map(p => DICT[p]).join(", ");
        return m[1] + joined + m[3];
      }
    }
    queue(core);
    return null;
  }

  function processTextNode(n) {
    if (!n.data || !CJK.test(n.data)) return;
    const rec = textRecs.get(n);
    if (rec && rec.tr === n.data) return;
    const t = translateStr(n.data);
    if (t != null && t !== n.data) {
      textRecs.set(n, { orig: n.data, tr: t });
      n.data = t;
    }
  }

  function processElementAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (!v || !CJK.test(v)) continue;
      const recs = attrRecs.get(el) || {};
      if (recs[a] && recs[a].tr === v) continue;
      const t = translateStr(v);
      if (t != null && t !== v) {
        recs[a] = { orig: v, tr: t };
        attrRecs.set(el, recs);
        el.setAttribute(a, t);
      }
    }
    if (el.tagName === "INPUT" && (el.type === "text" || el.type === "search") && el.value && CJK.test(el.value) && (el.value === el.defaultValue || DICT[el.value.trim()])) {
      const rec = valRecs.get(el);
      if (!rec || rec.tr !== el.value) {
        const t = translateStr(el.value);
        if (t != null && t !== el.value) { valRecs.set(el, { orig: el.value, tr: t }); el.value = t; }
      }
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!inToggle(root) && !SKIP_TAGS.has(root.parentElement?.tagName)) processTextNode(root); return; }
    if (root.nodeType !== 1 || inToggle(root)) return;
    processElementAttrs(root);
    if (SKIP_TAGS.has(root.tagName)) return;
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  function applyAll() {
    if (lang !== "en") return;
    walk(document.documentElement);
    if (document.title && CJK.test(document.title)) {
      const t = translateStr(document.title);
      if (t) document.title = t;
    }
  }

  function restoreAll() {
    for (const [n, rec] of textRecs) { if (n.data === rec.tr) n.data = rec.orig; }
    textRecs.clear();
    for (const [el, recs] of attrRecs) {
      for (const a of Object.keys(recs)) { if (el.getAttribute(a) === recs[a].tr) el.setAttribute(a, recs[a].orig); }
    }
    attrRecs.clear();
    for (const [el, rec] of valRecs) { if (el.value === rec.tr) el.value = rec.orig; }
    valRecs.clear();
    if (origTitle) document.title = origTitle;
  }

  let origTitle = "";
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(muts => {
      if (lang !== "en") return;
      for (const m of muts) {
        if (m.type === "characterData") walk(m.target);
        else if (m.type === "attributes") processElementAttrs(m.target);
        else m.addedNodes.forEach(n => walk(n));
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---------------- 切换按钮 ---------------- */
  function buildToggle() {
    if (document.getElementById("langToggle") || !document.body) return;
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;justify-content:flex-end;margin:0 0 8px;";
    const box = document.createElement("div");
    box.id = "langToggle";
    box.setAttribute("role", "group");
    box.style.cssText = "display:inline-flex;border:1px solid #d4c6e6;border-radius:9px;overflow:hidden;background:#fff;";
    for (const [code, label] of [["zh", "中文"], ["en", "English"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lang-btn";
      b.dataset.lang = code;
      b.textContent = label;
      b.style.cssText = "border:0;border-radius:0;padding:5px 14px;font-weight:700;font-size:12.5px;cursor:pointer;margin:0;";
      b.addEventListener("click", () => setLang(code, true));
      box.appendChild(b);
    }
    wrap.appendChild(box);
    document.body.insertBefore(wrap, document.body.firstChild);
    paintToggle();
  }

  function paintToggle() {
    document.querySelectorAll("#langToggle .lang-btn").forEach(b => {
      const on = b.dataset.lang === lang;
      b.style.background = on ? "#7952b3" : "#fff";
      b.style.color = on ? "#fff" : "#292334";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setLang(next, persist) {
    next = next === "en" ? "en" : "zh";
    const changed = next !== lang;
    lang = next;
    document.documentElement.lang = lang;
    const sel = document.getElementById("outputLang");
    if (sel && sel.value !== lang) sel.value = lang;
    paintToggle();
    if (persist) { try { chrome.storage.local.set({ outputLang: lang }).catch(() => {}); } catch (e) {} }
    if (lang === "en") { if (!origTitle) origTitle = document.title; applyAll(); startObserver(); }
    else if (changed) restoreAll();
    if (typeof window.updateLangBadgesUI === "function") { try { window.updateLangBadgesUI(); } catch (e) {} }
    if (typeof window.onXmLangChange === "function") { try { window.onXmLangChange(lang); } catch (e) {} }
  }

  async function init() {
    try {
      const s = await chrome.storage.local.get(["outputLang", CACHE_KEY]);
      const saved = s[CACHE_KEY];
      if (saved && typeof saved === "object") for (const k of Object.keys(saved)) cache.set(k, saved[k]);
      lang = s.outputLang === "en" ? "en" : "zh";
    } catch (e) { lang = "zh"; }
    origTitle = document.title;
    buildToggle();
    setLang(lang, false);
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === "local" && ch.outputLang) {
          const v = ch.outputLang.newValue === "en" ? "en" : "zh";
          if (v !== lang) setLang(v, false);
        }
      });
    } catch (e) {}
  }

  window.XM_I18N = {
    get lang() { return lang; },
    setLang: l => setLang(l, true),
    dictLookup,
    // 单段机翻（供商品资料净化使用）：lang = "en" | "zh"
    mt: (text, l) => mtRaw(text, l),
    mtLines: (arr, l) => mtLines(arr, l),
    diagnose,
    errLog,
    apply: () => { if (lang === "en") applyAll(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
