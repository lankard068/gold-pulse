import { writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LIVE_PATH = new URL("../data/live.json", import.meta.url);
const now = new Date();

const FEEDS = [
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    sourceUrl: "https://www.federalreserve.gov/feeds/feeds.htm",
    official: true
  },
  {
    name: "BLS",
    url: "https://www.bls.gov/feed/bls_latest.rss",
    sourceUrl: "https://www.bls.gov/feed/",
    official: true
  },
  {
    name: "FXStreet",
    url: "https://www.fxstreet.com/rss/news",
    sourceUrl: "https://www.fxstreet.com/news",
    official: false
  },
  {
    name: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
    sourceUrl: "https://www.marketwatch.com/",
    official: false
  },
  {
    name: "The Guardian",
    url: "https://www.theguardian.com/business/rss",
    sourceUrl: "https://www.theguardian.com/business",
    official: false
  }
];

const RELEVANT = /\b(gold|xau|bullion|precious metal|silver|inflation|cpi|fomc|fed|federal reserve|interest rate|yield|treasury|dollar|usd|geopolitics?|war|conflict|tariffs?|trade war|central bank|safe haven|risk-off|debt crisis|bond market|payroll|unemployment)\b/i;
const POSITIVE = /safe haven|geopolit|war|conflict|uncertainty|risk-off|dovish|rate cut|cut rates|lower yield|yields? (fall|drop|slip|decline)|weak(er|ening)? dollar|dollar (fall|drop|slip|weak)/i;
const NEGATIVE = /hawkish|rate hike|higher for longer|strong(er|ing)? dollar|dollar (rise|jump|surge|firm)|higher yield|yields? (rise|jump|surge)|risk-on|hot cpi|strong jobs|payroll beat/i;
const HIGH_IMPACT = /cpi|inflation|fomc|fed|federal reserve|interest rate|yield|payroll|unemployment|war|conflict|tariff/i;

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function clean(value = "") {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return clean(match?.[1] || "");
}

function readAttr(block, tag, attribute) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*\\/?\\s*>`, "i"));
  return decodeEntities(match?.[1] || "").trim();
}

function parseFeed(xml, feed) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const block = match[0];
    const title = readTag(block, "title");
    const description = readTag(block, "description") || readTag(block, "content:encoded");
    const link = readTag(block, "link") || readTag(block, "guid");
    const published = readTag(block, "pubDate") || readTag(block, "dc:date") || readTag(block, "published") || readTag(block, "updated");
    const image = readAttr(block, "media:content", "url") || readAttr(block, "media:thumbnail", "url") || readAttr(block, "enclosure", "url");
    return {
      title,
      description: description.slice(0, 420),
      link,
      image,
      publishedAt: Number.isNaN(Date.parse(published)) ? now.toISOString() : new Date(published).toISOString(),
      source: feed.name,
      sourceUrl: feed.sourceUrl,
      official: feed.official
    };
  }).filter((item) => item.title && item.link);
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "GoldPulse/1.0 (+https://lankard068.github.io/gold-pulse/)" },
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) return response.text();
  } catch {
    // GitHub runners and local sandboxes can expose different TLS/network policies.
  }
  const { stdout } = await execFileAsync("curl", ["-L", "--fail", "--max-time", "20", "-A", "GoldPulse/1.0", "-sS", url], { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (response.ok) return response.json();
  } catch {
    // Fall back to curl below.
  }
  return JSON.parse(await fetchText(url));
}

async function fetchCsvLatest(series) {
  const csv = await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`);
  const rows = csv.split(/\r?\n/).slice(1).map((row) => row.split(",")).filter((row) => row[1] && row[1] !== ".");
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  if (!latest) throw new Error(`No FRED observations for ${series}`);
  const value = Number(latest[1]);
  const previousValue = previous ? Number(previous[1]) : value;
  return { value, previousValue, change: value - previousValue, date: latest[0] };
}

function scoreArticle(article) {
  const text = `${article.title} ${article.description}`;
  const positive = POSITIVE.test(text);
  const negative = NEGATIVE.test(text);
  return positive === negative ? 0 : positive ? 1 : -1;
}

function classify(article) {
  const score = scoreArticle(article);
  const direction = score > 0 ? "bullish" : score < 0 ? "bearish" : "volatile";
  const directionLabel = score > 0 ? "หนุนทอง" : score < 0 ? "กดดันทอง" : "ต้องจับตา";
  const impact = HIGH_IMPACT.test(`${article.title} ${article.description}`) ? "high" : "medium";
  return { direction, directionLabel, impact, sentimentScore: score };
}

function relativeTime(dateString) {
  const minutes = Math.max(0, Math.round((now - new Date(dateString)) / 60000));
  if (minutes < 60) return `${minutes || 1} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(dateString));
}

function thaiTime(dateString) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(dateString));
}

function truncate(value, length = 180) {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function makeWhy(article, classification) {
  if (classification.direction === "bullish") return "เนื้อหานี้มีปัจจัยที่มักช่วยหนุนทอง เช่น ความเสี่ยง ดอลลาร์อ่อน หรือยีลด์ลดลง ควรดูการยืนยันจากราคาและข้อมูลต้นทางประกอบ";
  if (classification.direction === "bearish") return "เนื้อหานี้มีปัจจัยที่มักกดดันทอง เช่น ดอลลาร์แข็ง ยีลด์สูง หรือท่าทีเข้มงวด ควรเทียบกับตัวเลขจริงก่อนสรุปทิศทาง";
  return "ข่าวนี้อาจทำให้ตลาดผันผวน แต่ยังสรุปทิศทางเดียวไม่ได้ ต้องดู Actual เทียบคาดการณ์และปฏิกิริยาของดอลลาร์กับยีลด์";
}

function buildNews(articles) {
  return articles.slice(0, 8).map((article, index) => {
    const classification = classify(article);
    return {
      icon: ["↗", "◌", "◍", "≋"][index % 4],
      label: `${article.source}${article.official ? " · ทางการ" : ""}`,
      title: article.title,
      body: truncate(article.description || "เปิดอ่านต้นฉบับเพื่อดูรายละเอียดและตัวเลขเต็ม"),
      tone: classification.directionLabel,
      time: relativeTime(article.publishedAt),
      image: article.image || "",
      source: article.source,
      sourceUrl: article.link,
      publishedAt: article.publishedAt,
      direction: classification.direction,
      impact: classification.impact
    };
  });
}

function buildEvents(articles) {
  return articles.slice(0, 6).map((article) => {
    const classification = classify(article);
    return {
      time: thaiTime(article.publishedAt),
      date: `${article.source} · ${relativeTime(article.publishedAt)}`,
      title: article.title,
      short: truncate(article.description || "เปิดต้นฉบับเพื่อดูรายละเอียดข่าว", 150),
      why: makeWhy(article, classification),
      expected: "ข่าวจริง · ไม่มี Forecast",
      impact: classification.impact,
      direction: classification.direction,
      directionLabel: classification.directionLabel,
      sourceLabel: article.source,
      sourceUrl: article.link
    };
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildAnalyst(dollar, yield10y, articles) {
  let score = 50;
  if (dollar?.change < 0) score += 12;
  if (dollar?.change > 0) score -= 12;
  if (yield10y?.change < 0) score += 12;
  if (yield10y?.change > 0) score -= 12;
  score += articles.slice(0, 5).reduce((total, article) => total + scoreArticle(article) * 3, 0);
  score = clamp(Math.round(score), 20, 80);
  const direction = score >= 58 ? "bullish" : score <= 42 ? "bearish" : "volatile";
  const label = direction === "bullish" ? "บวกเล็กน้อย" : direction === "bearish" ? "ลบเล็กน้อย" : "ผันผวน / รอดูข้อมูล";
  const reasons = [];
  if (dollar) reasons.push({ mark: dollar.change <= 0 ? "+" : "−", tone: dollar.change <= 0 ? "positive" : "negative", title: dollar.change <= 0 ? "ดอลลาร์อ่อนลง" : "ดอลลาร์แข็งขึ้น", source: "FRED", note: `${dollar.value.toFixed(2)} · เปลี่ยนแปลง ${dollar.change >= 0 ? "+" : ""}${dollar.change.toFixed(2)}` });
  if (yield10y) reasons.push({ mark: yield10y.change <= 0 ? "+" : "−", tone: yield10y.change <= 0 ? "positive" : "negative", title: yield10y.change <= 0 ? "ยีลด์ 10Y ลดลง" : "ยีลด์ 10Y สูงขึ้น", source: "FRED", note: `${yield10y.value.toFixed(2)}% · เปลี่ยนแปลง ${yield10y.change >= 0 ? "+" : ""}${yield10y.change.toFixed(2)}` });
  const topArticle = articles[0];
  if (topArticle) reasons.push({ mark: "!", tone: "mixed", title: "ข่าวล่าสุดยังต้องยืนยันด้วยราคา", source: topArticle.source, note: truncate(topArticle.title, 90) });
  return {
    score,
    direction,
    label,
    note: "คะแนนคำนวณจากข้อมูลตลาดรายวันและข่าวที่ดึงได้ ไม่ใช่คำแนะนำซื้อขาย",
    reasons,
    sources: [
      { name: "FRED · Dollar / Yield", url: "https://fred.stlouisfed.org/" },
      { name: "Federal Reserve · RSS", url: "https://www.federalreserve.gov/feeds/feeds.htm" },
      { name: "BLS · RSS", url: "https://www.bls.gov/feed/" }
    ]
  };
}

async function safe(name, task) {
  try {
    return await task();
  } catch (error) {
    console.warn(`[Gold Pulse] ${name}: ${error.message}`);
    return null;
  }
}

const feedResults = await Promise.all(FEEDS.map((feed) => safe(feed.name, async () => parseFeed(await fetchText(feed.url), feed))));
const articles = feedResults.flat().filter(Boolean).filter((article) => RELEVANT.test(article.title));
const uniqueArticles = [...new Map(articles.map((article) => [article.link, article])).values()]
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const quote = await safe("XAU spot", async () => {
  const data = await fetchJson("https://xaus.com/api/v1/spot");
  return { symbol: "XAUUSD", price: Number(data.spot_usd_oz || data.xau?.price), unit: "USD / troy oz", provider: "XAUS", sourceUrl: "https://xaus.com/api/", asOf: now.toISOString(), stale: false };
}) || await safe("XAU spot fallback", async () => {
  const data = await fetchJson("https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT");
  const item = data.symbols?.[0];
  return { symbol: "XAUUSD", price: Number(item.price), unit: "USD / troy oz", provider: "GoldPrice.dev", sourceUrl: "https://goldprice.dev/", asOf: item.computed_at || now.toISOString(), stale: Boolean(item.is_stale) };
});

const dollar = await safe("FRED dollar", () => fetchCsvLatest("DTWEXBGS"));
const yield10y = await safe("FRED 10Y yield", () => fetchCsvLatest("DGS10"));
const selectedArticles = uniqueArticles.slice(0, 12);
const analyst = buildAnalyst(dollar, yield10y, selectedArticles);
const data = {
  version: 2,
  mode: "live",
  generatedAt: now.toISOString(),
  quote,
  drivers: {
    dollar: dollar ? { ...dollar, label: "ดอลลาร์ Broad · FRED", sourceUrl: "https://fred.stlouisfed.org/series/DTWEXBGS" } : null,
    yield10y: yield10y ? { ...yield10y, label: "US 10Y · FRED", sourceUrl: "https://fred.stlouisfed.org/series/DGS10" } : null
  },
  analyst,
  events: buildEvents(selectedArticles),
  news: buildNews(selectedArticles),
  feedStatus: FEEDS.map((feed, index) => ({ name: feed.name, ok: Boolean(feedResults[index]), sourceUrl: feed.sourceUrl }))
};

if (!quote && selectedArticles.length === 0) {
  throw new Error("No live sources returned data; keeping the previous snapshot");
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(LIVE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Gold Pulse live data: ${data.news.length} news, ${data.events.length} events, quote ${quote?.price ?? "unavailable"}`);
