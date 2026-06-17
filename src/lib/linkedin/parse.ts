import * as XLSX from "xlsx";

/* Parser for LinkedIn Page analytics exports (.xls). Read-only.
   Stores DAILY series (organic vs sponsored kept separate for future paid
   reporting) so any time window can be recomputed on the client. */

export type RankItem = { label: string; value: number };

export type DailyContent = {
  date: string; // YYYY-MM-DD
  impOrg: number;
  impSpon: number;
  clkOrg: number;
  clkSpon: number;
  reacOrg: number;
  reacSpon: number;
  comOrg: number;
  comSpon: number;
  repOrg: number;
  repSpon: number;
};
export type DailyFollowers = {
  date: string;
  organic: number;
  sponsored: number;
  autoInvited: number;
  total: number;
};
export type DailyVisitors = { date: string; pageViews: number; unique: number };

export type LinkedInPost = {
  title: string;
  link: string;
  created: string;
  impressions: number;
  clicks: number;
  ctr: number;
  likes: number;
  comments: number;
  reposts: number;
  engagementRate: number;
  contentType: string; // "Video" | "Text / Image"
};

export type LinkedInMetrics = {
  generatedAt: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  followersAllTime: number;
  daily: {
    content: DailyContent[];
    followers: DailyFollowers[];
    visitors: DailyVisitors[];
  };
  demographics: {
    location: RankItem[];
    jobFunction: RankItem[];
    seniority: RankItem[];
    industry: RankItem[];
    companySize: RankItem[];
  };
  posts: LinkedInPost[];
};

type Row = (string | number)[];
type Sheets = Record<string, Row[]>;
export type InputFile = { name: string; data: ArrayBuffer | Uint8Array | Buffer };

function readSheets(file: InputFile): { names: string[]; sheets: Sheets } {
  const wb = XLSX.read(file.data, { type: "buffer" });
  const sheets: Sheets = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false }) as Row[];
  }
  return { names: wb.SheetNames, sheets };
}

function headerIndex(rows: Row[], firstCol: RegExp): number {
  return rows.findIndex((r) => typeof r[0] === "string" && firstCol.test(r[0] as string));
}
function col(header: Row, name: string): number {
  return header.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
}
function dateStr(v: unknown): string | null {
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : iso(d);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : iso(d);
}
function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function rankList(rows: Row[], firstColLabel: RegExp, top = 12): RankItem[] {
  const h = headerIndex(rows, firstColLabel);
  if (h < 0) return [];
  const out: RankItem[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const label = String(rows[i][0] ?? "").trim();
    if (label) out.push({ label, value: num(rows[i][1]) });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, top);
}

export function parseFiles(files: InputFile[]): LinkedInMetrics {
  const m: LinkedInMetrics = {
    generatedAt: new Date().toISOString(),
    rangeStart: null,
    rangeEnd: null,
    followersAllTime: 0,
    daily: { content: [], followers: [], visitors: [] },
    demographics: { location: [], jobFunction: [], seniority: [], industry: [], companySize: [] },
    posts: [],
  };

  for (const file of files) {
    const { names, sheets } = readSheets(file);
    if (names.includes("New followers")) parseFollowers(sheets, m);
    if (names.includes("Visitor metrics")) parseVisitors(sheets, m);
    if (names.includes("All posts") || names.includes("Metrics")) parseContent(sheets, m);
  }

  // Date range from content daily.
  const dates = m.daily.content.map((d) => d.date).sort();
  m.rangeStart = dates[0] ?? null;
  m.rangeEnd = dates[dates.length - 1] ?? null;
  m.followersAllTime = m.daily.followers.reduce((n, d) => n + d.total, 0);
  return m;
}

function parseContent(sheets: Sheets, m: LinkedInMetrics) {
  const rows = sheets["Metrics"];
  if (rows) {
    const h = headerIndex(rows, /^date$/i);
    if (h >= 0) {
      const hd = rows[h];
      const ci = {
        impOrg: col(hd, "Impressions (organic)"),
        impSpon: col(hd, "Impressions (sponsored)"),
        clkOrg: col(hd, "Clicks (organic)"),
        clkSpon: col(hd, "Clicks (sponsored)"),
        reacOrg: col(hd, "Reactions (organic)"),
        reacSpon: col(hd, "Reactions (sponsored)"),
        comOrg: col(hd, "Comments (organic)"),
        comSpon: col(hd, "Comments (sponsored)"),
        repOrg: col(hd, "Reposts (organic)"),
        repSpon: col(hd, "Reposts (sponsored)"),
      };
      for (const r of rows.slice(h + 1)) {
        const date = dateStr(r[0]);
        if (!date) continue;
        m.daily.content.push({
          date,
          impOrg: num(r[ci.impOrg]),
          impSpon: num(r[ci.impSpon]),
          clkOrg: num(r[ci.clkOrg]),
          clkSpon: num(r[ci.clkSpon]),
          reacOrg: num(r[ci.reacOrg]),
          reacSpon: num(r[ci.reacSpon]),
          comOrg: num(r[ci.comOrg]),
          comSpon: num(r[ci.comSpon]),
          repOrg: num(r[ci.repOrg]),
          repSpon: num(r[ci.repSpon]),
        });
      }
    }
  }

  const posts = sheets["All posts"];
  if (posts) {
    const h = headerIndex(posts, /^post title$/i);
    if (h >= 0) {
      const hd = posts[h];
      const ci = {
        title: col(hd, "Post title"),
        link: col(hd, "Post link"),
        created: col(hd, "Created date"),
        imp: col(hd, "Impressions"),
        clicks: col(hd, "Clicks"),
        ctr: col(hd, "Click through rate (CTR)"),
        likes: col(hd, "Likes"),
        comments: col(hd, "Comments"),
        reposts: col(hd, "Reposts"),
        er: col(hd, "Engagement rate"),
        type: col(hd, "Content Type"),
        ptype: col(hd, "Post type"),
      };
      m.posts = posts.slice(h + 1).map((r) => {
        const title = String(r[ci.title] ?? "").replace(/\s+/g, " ").trim();
        const rawType = String((ci.type >= 0 ? r[ci.type] : "") || "").toLowerCase();
        const contentType = rawType.includes("video") ? "Video" : "Text / Image";
        return {
          title: title.length > 90 ? title.slice(0, 89).trimEnd() + "…" : title || "(untitled)",
          link: String(r[ci.link] ?? ""),
          created: dateStr(r[ci.created]) ?? "",
          impressions: num(r[ci.imp]),
          clicks: num(r[ci.clicks]),
          ctr: num(r[ci.ctr]),
          likes: num(r[ci.likes]),
          comments: num(r[ci.comments]),
          reposts: num(r[ci.reposts]),
          engagementRate: num(r[ci.er]),
          contentType,
        };
      });
    }
  }
}

function parseFollowers(sheets: Sheets, m: LinkedInMetrics) {
  const rows = sheets["New followers"];
  if (rows) {
    const h = headerIndex(rows, /^date$/i);
    if (h >= 0) {
      const hd = rows[h];
      const ci = {
        spon: col(hd, "Sponsored followers"),
        org: col(hd, "Organic followers"),
        auto: col(hd, "Auto-invited followers"),
        total: col(hd, "Total followers"),
      };
      for (const r of rows.slice(h + 1)) {
        const date = dateStr(r[0]);
        if (!date) continue;
        m.daily.followers.push({
          date,
          organic: num(r[ci.org]),
          sponsored: num(r[ci.spon]),
          autoInvited: num(r[ci.auto]),
          total: num(r[ci.total]),
        });
      }
    }
  }
  m.demographics = {
    location: rankList(sheets["Location"] ?? [], /^location$/i),
    jobFunction: rankList(sheets["Job function"] ?? [], /^job function$/i),
    seniority: rankList(sheets["Seniority"] ?? [], /^seniority$/i),
    industry: rankList(sheets["Industry"] ?? [], /^industry$/i),
    companySize: rankList(sheets["Company size"] ?? [], /^company size$/i),
  };
}

function parseVisitors(sheets: Sheets, m: LinkedInMetrics) {
  const rows = sheets["Visitor metrics"];
  if (!rows) return;
  const h = headerIndex(rows, /^date$/i);
  if (h < 0) return;
  const hd = rows[h];
  const ci = {
    views: col(hd, "Total page views (total)"),
    unique: col(hd, "Total unique visitors (total)"),
  };
  for (const r of rows.slice(h + 1)) {
    const date = dateStr(r[0]);
    if (!date) continue;
    m.daily.visitors.push({ date, pageViews: num(r[ci.views]), unique: num(r[ci.unique]) });
  }
}
