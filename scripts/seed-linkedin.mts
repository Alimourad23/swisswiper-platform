import fs from "fs";
import os from "os";
import path from "path";
import { parseFiles, type InputFile } from "../src/lib/linkedin/parse.ts";
import {
  windowAgg, popPercent, decisionMakerShare, contentTypeBreakdown, bestByCTR, alfredInsight,
} from "../src/lib/linkedin/compute.ts";

const dir = path.join(os.homedir(), "Downloads");
const names = [
  "swisswiper_content_1781710600322.xls",
  "swisswiper_followers_1781710616688.xls",
  "swisswiper_visitors_1781710608880.xls",
];
const files: InputFile[] = names.map((n) => ({ name: n, data: fs.readFileSync(path.join(dir, n)) }));
const m = parseFiles(files);

fs.writeFileSync(path.join(process.cwd(), "src", "lib", "linkedin", "seed-data.json"), JSON.stringify(m, null, 2));

console.log("range:", m.rangeStart, "→", m.rangeEnd, "| all-time followers:", m.followersAllTime, "| posts:", m.posts.length);
const dm = decisionMakerShare(m);
console.log(`decision-maker share: ${(dm.pct * 100).toFixed(1)}% (${dm.dm}/${dm.total})`);
console.log("content types:", JSON.stringify(contentTypeBreakdown(m.posts).map((t) => ({ type: t.type, n: t.count, eng: +(t.avgEngagement * 100).toFixed(1), ctr: +(t.avgCTR * 100).toFixed(2) }))));
console.log("best by CTR:", bestByCTR(m.posts).map((p) => `${(p.ctr * 100).toFixed(1)}% — ${p.title.slice(0, 40)}`));

for (const days of [7, 30, 365]) {
  const a = windowAgg(m, days);
  const pop = (c: number, p: number) => { const v = popPercent(c, p); return v === null ? "n/a" : (v >= 0 ? "+" : "") + v.toFixed(0) + "%"; };
  console.log(`\n=== ${days} days ===`);
  console.log(`impressions ${a.impressions} (org ${a.impressionsOrganic}/spon ${a.impressionsSponsored}) PoP ${pop(a.impressions, a.prev.impressions)}`);
  console.log(`clicks ${a.clicks} | CTR ${(a.ctr * 100).toFixed(2)}% PoP ${pop(a.clicks, a.prev.clicks)}`);
  console.log(`engagement rate ${(a.engagementRate * 100).toFixed(1)}% | engagements ${a.engagements}`);
  console.log(`new followers ${a.newFollowers} PoP ${pop(a.newFollowers, a.prev.newFollowers)} | page views ${a.pageViews} unique ${a.uniqueVisitors}`);
  console.log(`growth bars: ${JSON.stringify(a.growth)}`);
  console.log(`alfred: ${alfredInsight(m, a, dm, contentTypeBreakdown(m.posts))}`);
}
