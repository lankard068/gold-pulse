const fallbackEvents = [
  { time: "—", date: "รอข้อมูลสด", title: "ยังโหลดข่าวจริงไม่สำเร็จ", short: "ลองกดรีเฟรชเพื่อโหลดข้อมูลจากแหล่งอ้างอิงอีกครั้ง", why: "ระบบจะไม่แต่งตัวเลขขึ้นเอง หากแหล่งข้อมูลภายนอกตอบกลับช้า", expected: "—", impact: "medium", direction: "volatile", directionLabel: "รอตรวจสอบ", sourceLabel: "Gold Pulse", sourceUrl: "https://lankard068.github.io/gold-pulse/" }
];

const fallbackNews = [
  { icon: "◌", label: "SYSTEM", title: "กำลังรอข้อมูลข่าวจริง", body: "ระบบจะดึงข่าวจากฟีดที่มีต้นทางและแสดงลิงก์ต้นฉบับทุกครั้ง", tone: "รอตรวจสอบ", time: "—", sourceUrl: "https://lankard068.github.io/gold-pulse/" }
];

let liveData = null;
let events = fallbackEvents;
let activeFilter = "all";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function formatToday() {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
}

function signed(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${Number(value) >= 0 ? "+" : "−"}${Math.abs(Number(value)).toFixed(digits)}`;
}

function toneClass(value) {
  return Number(value) < 0 ? "positive" : Number(value) > 0 ? "negative" : "muted-label";
}

function thaiTitle(title = "") {
  const patterns = [
    [/Treasury.*bond-market intervention.*working/i, "มาตรการแทรกแซงตลาดพันธบัตรของสหรัฐฯ ยังไม่ช่วยคลายแรงกดดัน แล้วต่อไปจะเกิดอะไรขึ้น?"],
    [/retaliatory tariffs.*U\.S\. goods.*trade talks break down/i, "แคนาดาประกาศตอบโต้ด้วยภาษีสินค้านำเข้าจากสหรัฐฯ หลังการเจรจาการค้าล้มเหลว"],
    [/vows.*dollar for dollar.*50% tariffs/i, "แคนาดาประกาศตอบโต้แบบดอลลาร์ต่อดอลลาร์ หลังสหรัฐฯ เก็บภาษีสินค้าบางรายการ 50%"],
    [/AUD\/USD Price Forecast.*YTD high.*breakout/i, "คาดการณ์ AUD/USD: ฝั่งซื้อเล็งจุดสูงสุดของปี หลังราคาทะลุแนวต้าน"],
    [/USD\/CHF Price Forecast.*reclaim.*recovery stalls/i, "คาดการณ์ USD/CHF: ฝั่งซื้อกลับมายืนเหนือ 0.8000 แต่การฟื้นตัวยังชะลอ"],
    [/US Treasury yields.*Services PMI beats estimates/i, "ยีลด์พันธบัตรสหรัฐฯ ฟื้นต่อ หลังดัชนี PMI ภาคบริการออกมาดีกว่าคาด"],
    [/Forecasting the upcoming week.*inflation test a soft US Dollar/i, "มองสัปดาห์หน้า: Jackson Hole และเงินเฟ้อสหรัฐฯ จะทดสอบดอลลาร์ที่อ่อนลง"],
    [/Malaysian Ringgit.*US Dollar/i, "ริงกิตมาเลเซียยังได้แรงหนุนจากดอลลาร์สหรัฐฯ ที่อ่อนลงและพื้นฐานเศรษฐกิจแข็งแรง"],
    [/Trump.*trade war/i, "ทรัมป์ตอบโต้หลังการเจรจาสหรัฐฯ–แคนาดากลายเป็นสงครามการค้า"],
    [/Jumpy bond markets.*debt crisis/i, "ตลาดพันธบัตรผันผวน สะท้อนความเสี่ยงที่สหรัฐฯ อาจเผชิญวิกฤตหนี้"]
  ];
  const match = patterns.find(([pattern]) => pattern.test(title));
  if (match) return match[1];
  if (/gold|xau|bullion|precious metal/i.test(title)) return "ข่าวทองคำและปัจจัยที่อาจทำให้ XAUUSD เคลื่อนไหว";
  if (/yield|treasury|dollar|usd|inflation|cpi|fed|interest rate/i.test(title)) return "ข่าวเศรษฐกิจสหรัฐฯ ที่อาจกระทบดอลลาร์ ยีลด์ และราคาทอง";
  return "ข่าวตลาดล่าสุดที่ควรติดตามประกอบการดูราคาทอง";
}

function thaiSummary(item) {
  const text = `${item.title || ""} ${item.body || ""}`;
  if (/tariff|trade war|geopolit|conflict|war/i.test(text)) return "ความตึงเครียดด้านการค้าและภูมิรัฐศาสตร์เพิ่มขึ้น อาจหนุนแรงซื้อสินทรัพย์ปลอดภัยอย่างทอง แต่ควรดูดอลลาร์ร่วมด้วย";
  if (/bond|treasury|yield|debt crisis/i.test(text)) return "ข่าวพันธบัตรและหนี้สหรัฐฯ อาจทำให้ยีลด์กับดอลลาร์แกว่ง ซึ่งเป็นตัวแปรสำคัญต่อ XAUUSD";
  if (/inflation|cpi|fed|interest rate|pmi|payroll|unemployment/i.test(text)) return "ข้อมูลเศรษฐกิจและท่าที Fed มีผลต่อดอกเบี้ย ดอลลาร์ และต้นทุนการถือทอง";
  if (/dollar|usd|aud\/usd|usd\/chf/i.test(text)) return "ดอลลาร์อ่อนมักช่วยพยุงทอง แต่ควรยืนยันกับกราฟและข้อมูลตลาดจริง";
  return "ข่าวนี้ถูกคัดมาเพราะมีปัจจัยที่อาจทำให้ทองผันผวน ควรเปิดอ่านต้นฉบับประกอบ";
}

function renderEvents() {
  const visibleEvents = activeFilter === "all" ? events : events.filter((event) => event.direction === activeFilter);
  $("#eventCount").textContent = `${visibleEvents.length} เหตุการณ์`;
  $("#eventList").innerHTML = visibleEvents.map((event, index) => `
    <article class="event-card ${escapeHtml(event.direction)}" data-index="${index}" tabindex="0" role="button" aria-expanded="false">
      <div class="event-time">${escapeHtml(event.time)}<small>${escapeHtml(event.date)}</small></div>
      <div class="event-main">
        <strong>${escapeHtml(event.titleTh || thaiTitle(event.title))}</strong>
        <p>${escapeHtml(event.shortTh || thaiSummary(event))}</p>
        <div class="event-meta"><span class="event-tag">${escapeHtml(event.expected || "ข่าวจริง")}</span><span class="impact-tag ${escapeHtml(event.impact)}">${event.impact === "high" ? "สำคัญมาก" : "สำคัญ"}</span></div>
      </div>
      <div class="event-direction"><strong>${escapeHtml(event.directionLabel)}</strong><small>กดดูเหตุผล ↘</small></div>
      <div class="event-detail"><b>ทำไมต้องดู:</b> ${escapeHtml(event.why)} <a class="event-source" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.sourceLabel || "แหล่งข้อมูล")} ↗</a></div>
    </article>
  `).join("");

  document.querySelectorAll(".event-card").forEach((card) => {
    const toggle = () => { const open = card.classList.toggle("open"); card.setAttribute("aria-expanded", String(open)); };
    card.addEventListener("click", (event) => { if (!event.target.closest("a")) toggle(); });
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
  });
}

function renderNews(news) {
  $("#newsGrid").innerHTML = news.map((item, index) => {
    const visualClass = `news-art-${index % 4}`;
    const visual = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="ภาพประกอบข่าว: ${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`
      : `<span class="thumb-symbol">${escapeHtml(item.icon || "◌")}</span><span class="thumb-label">ภาพประกอบ</span>`;
    const sourceLink = item.sourceUrl ? `<a class="news-source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">ต้นฉบับ ↗</a>` : "";
    return `
      <article class="news-card">
        <div class="news-thumb ${visualClass}">${visual}</div>
        <div class="news-card-body">
          <p class="section-kicker">${escapeHtml(item.label || item.source || "NEWS")}</p>
          <h3>${escapeHtml(item.titleTh || thaiTitle(item.title))}</h3>
          <p>${escapeHtml(item.bodyTh || item.body || thaiSummary(item))}</p>
          <footer><span>${escapeHtml(item.tone || "ต้องจับตา")}</span><span>${escapeHtml(item.time || "—")}</span>${sourceLink}</footer>
        </div>
      </article>
    `;
  }).join("");
}

function renderQuote(data) {
  const quote = data?.quote;
  const dollar = data?.drivers?.dollar;
  const yield10y = data?.drivers?.yield10y;
  $("#quoteGold").textContent = quote?.price ? formatNumber(quote.price) : "—";
  $("#quoteGoldChange").textContent = quote?.stale ? "หน่วง" : "สด";
  $("#quoteGoldChange").className = quote?.stale ? "muted-label" : "up";
  $("#quoteDollar").textContent = dollar ? formatNumber(dollar.value) : "—";
  $("#quoteDollarChange").textContent = dollar ? signed(dollar.change) : "—";
  $("#quoteDollarChange").className = toneClass(dollar?.change);
  $("#quoteYield").textContent = yield10y ? `${formatNumber(yield10y.value)}%` : "—";
  $("#quoteYieldChange").textContent = yield10y ? signed(yield10y.change) : "—";
  $("#quoteYieldChange").className = toneClass(yield10y?.change);
  $("#quoteStatus").textContent = quote ? `${quote.provider} · ${quote.stale ? "หน่วง" : "สด"}` : "ไม่มีข้อมูล";
  $("#dataNote").textContent = quote ? `อัปเดต ${formatDateTime(data.generatedAt)} · ราคาอ้างอิงจาก ${quote.provider} · ดอลลาร์/ยีลด์จาก FRED` : "ยังไม่มีข้อมูลสดจากแหล่งภายนอก";
}

function renderPulse(data) {
  const analyst = data?.analyst;
  const score = Number(analyst?.score);
  const label = analyst?.label || "กำลังโหลด";
  $("#pulseScore").textContent = Number.isFinite(score) ? score : "—";
  $("#pulseDirection").textContent = label;
  $("#pulseCopy").textContent = analyst?.note || "กำลังรวมราคาทอง ข่าว และตัวชี้วัดเศรษฐกิจ...";
  $("#pulseMeter").style.width = `${Number.isFinite(score) ? score : 0}%`;
  $("#pulseMeterWrap").setAttribute("aria-label", `คะแนนแรงส่งทอง ${Number.isFinite(score) ? score : "ยังไม่มี"} จาก 100`);
  $("#pulseRisk").textContent = analyst?.direction === "volatile" ? "ผันผวนสูง" : analyst?.direction === "bullish" ? "เอนเอียงบวก" : "เอนเอียงลบ";
  $("#pulseNotice").textContent = data?.news?.length ? `มีข่าวจริง ${data.news.length} รายการ · อ่านต้นฉบับก่อนตัดสินใจ` : "ยังไม่มีข่าวจริงจากฟีดที่ตอบกลับ";
}

function renderAnalyst(data) {
  const analyst = data?.analyst;
  $("#analystScore").textContent = Number.isFinite(Number(analyst?.score)) ? analyst.score : "—";
  $("#analystLabel").textContent = analyst?.label || "กำลังโหลด";
  $("#analystNote").textContent = analyst?.note || "คะแนนจะคำนวณจากดอลลาร์ ยีลด์ และข่าวที่มีต้นทาง";
  $("#analystStatus").innerHTML = `<span class="status-dot"></span> ${analyst ? "อัปเดตจากข้อมูลจริง" : "รอข้อมูล"}`;
  $("#analystReasons").innerHTML = (analyst?.reasons || []).map((reason) => `
    <div class="reason-row"><span class="reason-mark ${escapeHtml(reason.tone)}">${escapeHtml(reason.mark)}</span><div><strong>${escapeHtml(reason.title)} <em class="mini-source">${escapeHtml(reason.source)}</em></strong><small>${escapeHtml(reason.note)}</small></div><b class="${escapeHtml(reason.tone)}">${reason.tone === "positive" ? "หนุน" : reason.tone === "negative" ? "กดดัน" : "เสี่ยง"}</b></div>
  `).join("");
  const sourceLinks = (analyst?.sources || []).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)} <span>↗</span></a>`).join("");
  $("#analystSources").innerHTML = `<p class="section-kicker">แหล่งอ้างอิงหลัก</p>${sourceLinks}<small>ระบบคำนวณมุมมองจากข้อมูล ไม่ใช่คำแนะนำซื้อขาย</small>`;
}

function formatDateTime(value) {
  if (!value) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function updateMarketStatus() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const totalMinutes = hour * 60 + minute;
  const weekendClosed = day === "Sat" || (day === "Sun" && totalMinutes < 18 * 60 + 5) || (day === "Fri" && totalMinutes >= 16 * 60 + 59);
  const status = $("#marketStatus");
  if (!status) return;
  const state = weekendClosed ? "closed" : "open";
  status.className = `market-status ${state}`;
  status.innerHTML = `<span class="market-status-dot"></span> ${state === "open" ? "ตลาดเปิด" : "ตลาดปิด"}`;
  status.title = "อิงเวลาซื้อขาย XAU/USD ของ OANDA; เวลาโบรกเกอร์อาจแตกต่างกันเล็กน้อย";
}

async function loadData(showMessage = false) {
  try {
    const response = await fetch(`data/live.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("live data unavailable");
    const data = await response.json();
    liveData = data?.mode === "live" ? data : null;
    events = liveData?.events?.length ? liveData.events : fallbackEvents;
    renderNews(liveData?.news?.length ? liveData.news : fallbackNews);
    renderQuote(liveData);
    renderPulse(liveData);
    renderAnalyst(liveData);
    $("#liveStatus").innerHTML = `<span class="status-dot"></span> ${liveData ? "LIVE · อัปเดตอัตโนมัติ" : "รอข้อมูลภายนอก"}`;
    $("#lastUpdated").textContent = liveData ? `อัปเดตล่าสุด ${formatDateTime(liveData.generatedAt)}` : "ยังไม่พบข้อมูลสด";
    if (showMessage) showToast(liveData ? "โหลดข้อมูลจริงล่าสุดแล้ว" : "ยังโหลดข้อมูลภายนอกไม่ได้");
  } catch (error) {
    events = fallbackEvents;
    renderEvents();
    renderNews(fallbackNews);
    $("#lastUpdated").textContent = "โหลดข้อมูลสดไม่สำเร็จ · กดรีเฟรชอีกครั้ง";
    if (showMessage) showToast("โหลดข้อมูลไม่สำเร็จ");
  }
  renderEvents();
  $("#todayDate").textContent = formatToday();
  updateMarketStatus();
}

document.querySelectorAll(".filter-tab").forEach((tab) => tab.addEventListener("click", () => {
  activeFilter = tab.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("active", item === tab));
  renderEvents();
}));

function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600); }

$("#refreshButton").addEventListener("click", () => { $("#refreshButton").animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 500 }); loadData(true); });
$("#alertButton").addEventListener("click", (event) => { event.currentTarget.classList.toggle("active"); event.currentTarget.textContent = event.currentTarget.classList.contains("active") ? "เปิดแล้ว ✓" : "เปิดแจ้งเตือน"; showToast(event.currentTarget.classList.contains("active") ? "เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว" : "ปิดการแจ้งเตือนแล้ว"); });
$("#shareButton").addEventListener("click", async () => { const score = liveData?.analyst?.score ?? "—"; const summary = `Gold Pulse — ${formatToday()}\nมุมมองจากข้อมูลจริง: ${liveData?.analyst?.label || "รอตรวจสอบ"} (${score}/100)\nเช็กข่าวต้นฉบับก่อนดูกราฟ XAUUSD`; try { await navigator.clipboard.writeText(summary); showToast("คัดลอกสรุปวันนี้แล้ว"); } catch (error) { showToast("เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกอัตโนมัติ"); } });

loadData();
updateMarketStatus();
window.setInterval(updateMarketStatus, 30000);
