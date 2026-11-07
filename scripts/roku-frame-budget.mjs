import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";

const [trace, output] = process.argv.slice(2);
if (!trace) throw new Error("Usage: node scripts/roku-frame-budget.mjs trace.perfetto-trace [report.json]");
const sql = `
WITH frames AS (
  SELECT s.track_id, s.name, s.ts, s.dur,
    row_number() OVER (PARTITION BY s.track_id,s.name ORDER BY s.ts) AS ordinal
  FROM slice s JOIN thread_track tt ON tt.id=s.track_id JOIN thread th ON th.utid=tt.utid
  WHERE th.name='RenderThr:Main' AND s.name IN ('render','swapBuffers') AND s.dur>=0
)
SELECT r.ts, r.dur/1000000.0, b.dur/1000000.0,
  (lead(r.ts) OVER (PARTITION BY r.track_id ORDER BY r.ts)-r.ts)/1000000.0
FROM frames r LEFT JOIN frames b ON b.track_id=r.track_id AND b.ordinal=r.ordinal AND b.name='swapBuffers'
WHERE r.name='render' ORDER BY r.ts`;
const csv = execFileSync(process.env.TRACE_PROCESSOR ?? "trace_processor", [
  "query", "--no-agent", "--format", "csv", trace, sql,
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const rows = csv.trim().split("\n").slice(1).map(line => line.split(",").map(value => value.replaceAll('"', "")));
if (rows.length < 10 || rows.some(row => !row[2] || row[2] === "[NULL]"))
  throw new Error("Trace lacks paired render/swapBuffers samples; refusing FPS qualification.");
const work = rows.map(row => Number(row[1]) + Number(row[2]));
if (work.some(value => !Number.isFinite(value))) throw new Error("Invalid native frame duration");
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const budget = 1000 / 60;
const report = {
  trace: basename(trace), qualification: "native-render-work-budget", frames: work.length,
  renderPlusSwapP50Ms: percentile(work, 0.5), renderPlusSwapP95Ms: percentile(work, 0.95),
  renderPlusSwapP99Ms: percentile(work, 0.99), maxMs: Math.max(...work),
  framesOverBudget: work.filter(value => value > budget).length, budgetMs: budget,
  passed: percentile(work, 0.95) <= budget,
  presentedFps: null,
  limits: "RenderThr:Main render+swap work only. Does not certify sustained presented FPS, key-to-visible latency or idle-suppressed frame intervals. Record a settled workload without screenshots or concurrent builds.",
};
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
