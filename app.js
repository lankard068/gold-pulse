const fallbackEvents = [
  { time: "19:30", date: "วันนี้", title: "เงินเฟ้อสหรัฐฯ (CPI)", short: "ตัวเลขที่ตลาดใช้ดูทิศทางดอกเบี้ย Fed", why: "ถ้าออกมาสูงกว่าคาด ตลาดอาจมองว่าดอกเบี้ยจะสูงนานขึ้น ซึ่งมักกดดันทอง แต่ถ้าต่ำกว่าคาด ทองอาจได้แรงหนุน", expected: "คาดการณ์ 3.1%", impact: "high", direction: "volatile", directionLabel: "เหวี่ยงแรง", sourceLabel: "BLS", sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm" },
  { time: "21:00", date: "วันนี้", title: "ถ้อยแถลงเจ้าหน้าที่ Fed", short: "ตลาดจับคำว่าเข้มงวดหรือผ่อนคลาย", why: "คำพูดที่ชี้ว่าจะลดดอกเบี้ยเร็วขึ้นมักเป็นบวกต่อทอง ส่วนคำพูดที่เน้นสู้เงินเฟ้อนาน ๆ มักกดดันทอง", expected: "รอติดตามน้ำเสียง", impact: "high", direction: "volatile", directionLabel: "ผันผวน", sourceLabel: "Federal Reserve", sourceUrl: "https://www.federalreserve.gov/newsevents/calendar.htm" },
  { time: "ตลอดวัน", date: "ติดตามต่อเนื่อง", title: "ดอลลาร์และบอนด์ยีลด์", short: "สองตัวแปรที่ทองมักแพ้ทาง", why: "ดอลลาร์อ่อนหรือยีลด์ลดลงมักช่วยให้ทองดูน่าสนใจขึ้น แต่ถ้าทั้งคู่ดีดแรง ทองอาจถูกกดดัน", expected: "ดูทิศทางระหว่างวัน", impact: "medium", direction: "bullish", directionLabel: "หนุนทอง", sourceLabel: "FRED", sourceUrl: "https://fred.stlouisfed.org/" },
  { time: "ตามข่าว", date: "ติดตามต่อเนื่อง", title: "ความเสี่ยงภูมิรัฐศาสตร์", short: "แรงซื้อสินทรัพย์ปลอดภัยอาจกลับมา", why: "เมื่อความไม่แน่นอนเพิ่ม นักลงทุนบางส่วนอาจหันมาถือทอง แต่ถ้าดอลลาร์แข็งพร้อมกัน ผลกระทบอาจหักล้างกันได้", expected: "ไม่มีตัวเลขคาดการณ์", impact: "medium", direction: "bullish", directionLabel: "มีแรงหนุน", sourceLabel: "ติดตามข่าวต้นทาง", sourceUrl: "https://www.reuters.com/markets/commodities/" }
];

const fallbackNews = [
  { icon: "◌", label: "SCENARIO", title: "ถ้า CPI สูงกว่าคาด ทองจะเจออะไร?", body: "ตลาดอาจเลื่อนความหวังเรื่องลดดอกเบี้ยออกไป ทำให้ดอลลาร์และยีลด์มีโอกาสเด้งขึ้น ทองจึงอาจย่อตัวในช่วงแรก", tone: "กดดันทอง", time: "อ่าน 1 นาที" },
  { icon: "↗", label: "SAFE HAVEN", title: "ทำไมข่าวเสี่ยงโลกถึงดันทอง?", body: "ทองไม่มีดอกเบี้ย แต่คนมักใช้เป็นสินทรัพย์พักเงินเวลาความไม่แน่นอนเพิ่มขึ้น จึงมีแรงซื้อป้องกันความเสี่ยงเข้ามา", tone: "หนุนทอง", time: "อ่าน 1 นาที" },
  { icon: "◍", label: "BOND YIELD", title: "ยีลด์ลง ทองได้ประโยชน์อย่างไร?", body: "เมื่อผลตอบแทนพันธบัตรลดลง ต้นทุนค่าเสียโอกาสของการถือทองก็ลดลง ทองจึงดูน่าสนใจขึ้นเมื่อเทียบกัน", tone: "หนุนทอง", time: "อ่าน 1 นาที" },
  { icon: "≋", label: "REMINDER", title: "ข่าวเดียวไม่ได้บอกทิศทางทั้งหมด", body: "ให้ดู Actual เทียบ Forecast และดูปฏิกิริยาของดอลลาร์กับยีลด์ประกอบ อย่าตัดสินจากพาดหัวเพียงอย่างเดียว", tone: "เช็กให้ครบ", time: "อ่าน 1 นาที" }
];

let events = fallbackEvents;
let activeFilter = "all";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function formatToday() {
  const now = new Date();
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(now);
}

function renderEvents() {
  const visibleEvents = activeFilter === "all" ? events : events.filter((event) => event.direction === activeFilter);
  $("#eventCount").textContent = `${visibleEvents.length} เหตุการณ์`;
  $("#eventList").innerHTML = visibleEvents.map((event, index) => `
    <article class="event-card ${escapeHtml(event.direction)}" data-index="${index}" tabindex="0" role="button" aria-expanded="false">
      <div class="event-time">${escapeHtml(event.time)}<small>${escapeHtml(event.date)}</small></div>
      <div class="event-main">
        <strong>${escapeHtml(event.title)}</strong>
        <p>${escapeHtml(event.short)}</p>
        <div class="event-meta"><span class="event-tag">คาดการณ์: ${escapeHtml(event.expected)}</span><span class="impact-tag ${escapeHtml(event.impact)}">${event.impact === "high" ? "สำคัญมาก" : "สำคัญ"}</span></div>
      </div>
      <div class="event-direction"><strong>${escapeHtml(event.directionLabel)}</strong><small>กดดูเหตุผล ↘</small></div>
      <div class="event-detail"><b>ทำไมต้องดู:</b> ${escapeHtml(event.why)} <a class="event-source" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">แหล่งข้อมูล ↗</a></div>
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
      ? `<img src="${escapeHtml(item.image)}" alt="ภาพประกอบข่าว: ${escapeHtml(item.title)}" loading="lazy" />`
      : `<span class="thumb-symbol">${escapeHtml(item.icon)}</span><span class="thumb-label">ภาพประกอบ</span>`;
    return `
      <article class="news-card">
        <div class="news-thumb ${visualClass}">${visual}</div>
        <div class="news-card-body">
          <p class="section-kicker">${escapeHtml(item.label)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
          <footer><span>${escapeHtml(item.tone)}</span><span>${escapeHtml(item.time)}</span></footer>
        </div>
      </article>
    `;
  }).join("");
}

async function loadData() {
  try {
    const [eventsResponse, newsResponse] = await Promise.all([fetch("data/events.json"), fetch("data/news.json")]);
    if (eventsResponse.ok) events = await eventsResponse.json();
    if (newsResponse.ok) renderNews(await newsResponse.json()); else renderNews(fallbackNews);
  } catch (error) {
    renderNews(fallbackNews);
  }
  renderEvents();
  $("#todayDate").textContent = formatToday();
}

document.querySelectorAll(".filter-tab").forEach((tab) => tab.addEventListener("click", () => {
  activeFilter = tab.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("active", item === tab));
  renderEvents();
}));

function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600); }

$("#refreshButton").addEventListener("click", () => { $("#refreshButton").animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 500 }); showToast("โหลดข้อมูลอ้างอิงใหม่แล้ว"); loadData(); });
$("#alertButton").addEventListener("click", (event) => { event.currentTarget.classList.toggle("active"); event.currentTarget.textContent = event.currentTarget.classList.contains("active") ? "เปิดแล้ว ✓" : "เปิดแจ้งเตือน"; showToast(event.currentTarget.classList.contains("active") ? "เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว" : "ปิดการแจ้งเตือนแล้ว"); });
$("#shareButton").addEventListener("click", async () => { const summary = `Gold Pulse — ${formatToday()}\nภาพรวม: ผันผวนสูง / เอนเอียงบวกเล็กน้อย\nเช็กข่าวสำคัญก่อนดูกราฟ XAUUSD`; try { await navigator.clipboard.writeText(summary); showToast("คัดลอกสรุปวันนี้แล้ว"); } catch (error) { showToast("เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกอัตโนมัติ"); } });

loadData();
