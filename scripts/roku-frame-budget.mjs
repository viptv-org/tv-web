import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";

const [trace, output] = process.argv.slice(2);
if (!trace) throw new Error("Usage: node scripts/roku-frame-budget.mjs trace.perfetto-trace [report.json]");
const sql = `
WITH frames AS (
  SELECT s.track_id, s.name, s.ts, s.dur
  FROM slice s JOIN thread_track tt ON tt.id=s.track_id JOIN thread th ON th.utid=tt.utid
  WHERE th.name='RenderThr:Main' AND s.name IN ('render','swapBuffers') AND s.dur>=0
), renders AS (
  SELECT *, lead(ts) OVER (PARTITION BY track_id ORDER BY ts) AS next_ts,
    row_number() OVER (PARTITION BY track_id ORDER BY ts DESC) AS from_end
  FROM frames WHERE name='render'
)
SELECT r.ts AS ts, r.dur/1000000.0 AS render_ms,
  (SELECT b.dur/1000000.0 FROM frames b WHERE b.name='swapBuffers' AND b.track_id=r.track_id
    AND b.ts>=r.ts+r.dur AND (r.next_ts IS NULL OR b.ts<r.next_ts) ORDER BY b.ts LIMIT 1) AS swap_ms,
  (r.next_ts-r.ts)/1000000.0 AS delta_ms, r.from_end
FROM renders r ORDER BY r.ts`;
const csv = execFileSync(process.env.TRACE_PROCESSOR ?? "trace_processor", [
  "query", "--no-agent", "--format", "csv", trace, sql,
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const captured = csv.trim().split("\n").slice(1).map(line => line.split(",").map(value => value.replaceAll('"', "")));
const incomplete = captured.filter(row => !row[2] || row[2] === "[NULL]");
if (incomplete.some(row => row[4] !== "1"))
  throw new Error("Trace has an unpaired interior frame; refusing frame-budget qualification.");
// Stopping a recording can capture its final render before swapBuffers starts.
// Exclude that boundary only; never pair it with another frame's swap.
const rows = captured.filter(row => row[2] && row[2] !== "[NULL]");
if (rows.length < 10)
  throw new Error("Trace lacks paired render/swapBuffers samples; refusing frame-budget qualification.");
const work = rows.map(row => Number(row[1]) + Number(row[2]));
if (work.some(value => !Number.isFinite(value))) throw new Error("Invalid native frame duration");
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const budget = 1000 / 60;
const report = {
  trace: basename(trace), qualification: "native-render-work-budget", frames: work.length,
  incompleteBoundaryFrames: incomplete.length,
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
