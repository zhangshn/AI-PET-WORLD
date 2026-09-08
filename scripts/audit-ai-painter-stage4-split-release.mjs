import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { auditSplitRelease, auditSplitReleaseExposure, replayHistoricalGeometry, sha256 } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { indexArtifact, closeStorageCatalog } from "./lib/ai-pet-world-storage-catalog.mjs";
import { adjudicateStage4SplitData } from "./lib/ai-painter-stage4-split-data-adjudication.mjs";

export function persistAudit(root, report) {
  const data = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const hash = sha256(data);
  const logical = `.runtime/ai-painter/dataset-release-checks/${hash}/report.json`;
  const runtime = fs.realpathSync(path.join(root, ".runtime"));
  let physicalParent = runtime;
  for (const part of ["ai-painter", "dataset-release-checks"]) {
    const next = path.join(physicalParent, part);
    if (!fs.existsSync(next)) fs.mkdirSync(next);
    physicalParent = fs.realpathSync(next);
    const relative = path.relative(runtime, physicalParent);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("audit output escapes runtime");
  }
  const directory = path.join(physicalParent, hash);
  // Content-addressed directory is exclusive; do not overwrite or recover old evidence.
  fs.mkdirSync(directory);
  const target = path.join(directory, "report.json");
  const fd = fs.openSync(target, "wx");
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const stat = fs.statSync(target);
  try {
    indexArtifact({ logicalPath: logical, physicalUri: pathToFileURL(target).href,
      storageLayer: "hot", runId: hash, artifactType: "stage4_split_risk_audit",
      byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash });
  } catch (error) {
    throw new Error(`Audit file retained but catalog indexing failed: ${logical}: ${error.message}`);
  } finally { closeStorageCatalog(); }
  return { path: logical, sha256: hash };
}

async function main() {
  const { values } = parseArgs({ options: {
    manifest: { type: "string" }, sha256: { type: "string" }, write: { type: "boolean", default: false },
    "geometry-baseline": { type: "string" }, "baseline-sha256": { type: "string" },
    "exposure-only": { type: "boolean", default: false },
    "adjudicate-data": { type: "boolean", default: false },
    "preflight-smoke": { type: "boolean", default: false },
    "component-contract": { type: "string" }, "component-sha256": { type: "string" },
    "cpu-evidence": { type: "string" }, "cpu-sha256": { type: "string" },
    "risk-report": { type: "string" }, "risk-sha256": { type: "string" },
    "geometry-report": { type: "string" }, "geometry-sha256": { type: "string" },
    "exposure-report": { type: "string" }, "exposure-sha256": { type: "string" },
  } });
  const adjudicationKeys = ["risk-report", "risk-sha256", "geometry-report", "geometry-sha256", "exposure-report", "exposure-sha256"];
  const smokeKeys = ["component-contract", "component-sha256", "cpu-evidence", "cpu-sha256"];
  if (values["adjudicate-data"] || values["preflight-smoke"]) {
    if (values["adjudicate-data"] && values["preflight-smoke"])
      throw new Error("Data adjudication and Smoke preflight cannot be mixed");
    if (values["geometry-baseline"] || values["baseline-sha256"] || values["exposure-only"])
      throw new Error("Data adjudication cannot be mixed with another audit mode");
    const bound = (file, hash) => {
      if (!values[file] || !/^[a-f0-9]{64}$/u.test(values[hash] ?? "")) throw new Error(`Explicit --${file} and --${hash} are required`);
      return { path: values[file], sha256: values[hash] };
    };
    let result;
    if (values["preflight-smoke"]) {
      if (values.manifest || values.sha256) throw new Error("Smoke dataset comes only from its explicit component contract");
      const { preflightSplitSmoke } = await import("./lib/ai-painter-stage4-split-smoke-preflight.mjs");
      result = preflightSplitSmoke({ root: process.cwd(), componentContractBinding: bound("component-contract", "component-sha256"),
        cpuEvidenceBinding: bound("cpu-evidence", "cpu-sha256"), dataEvidenceBindings: {
          baselineBinding: bound("risk-report", "risk-sha256"), geometryBinding: bound("geometry-report", "geometry-sha256"),
          exposureBinding: bound("exposure-report", "exposure-sha256"),
        } });
    } else {
      if (smokeKeys.some(key => values[key] !== undefined)) throw new Error("Smoke evidence inputs require --preflight-smoke");
      result = adjudicateStage4SplitData({ root: process.cwd(), manifestBinding: bound("manifest", "sha256"),
        baselineBinding: bound("risk-report", "risk-sha256"), geometryBinding: bound("geometry-report", "geometry-sha256"),
        exposureBinding: bound("exposure-report", "exposure-sha256"),
        progress: phase => process.stderr.write(`${new Date().toISOString()} ${phase}\n`) });
    }
    const evidence = values.write ? persistAudit(process.cwd(), result) : null;
    process.stdout.write(`${JSON.stringify({ status: result.status, blockers: result.blockers.map(b => ({ code: b.code, scope: b.scope,
      ...(/invalid_or_stale|changed_during_read/u.test(b.code) ? { details: b.details } : {}) })), findings: result.findings ?? result.dataAdjudication?.findings,
      checks: result.checks, planCandidateId: result.planCandidate?.planCandidateId,
      qualification: result.qualification, evidence }, null, 2)}\n`);
    // A completed diagnostic is not a successful training preflight.
    process.exitCode = result.status === "unknown_or_stale" ? 1 : 2;
    return;
  }
  if (adjudicationKeys.some(key => values[key] !== undefined)) throw new Error("Data evidence inputs require --adjudicate-data");
  if (smokeKeys.some(key => values[key] !== undefined)) throw new Error("Smoke evidence inputs require --preflight-smoke");
  const geometryMode = values["geometry-baseline"] !== undefined || values["baseline-sha256"] !== undefined;
  if (geometryMode && (values["exposure-only"] || values.manifest || values.sha256 || !values["geometry-baseline"]
    || !/^[a-f0-9]{64}$/.test(values["baseline-sha256"] ?? ""))) {
    throw new Error("Geometry replay requires only --geometry-baseline and --baseline-sha256; cannot mix dataset audit inputs");
  }
  if (!geometryMode && (!values.manifest || !/^[a-f0-9]{64}$/.test(values.sha256 ?? ""))) {
    throw new Error("Explicit --manifest and --sha256 are required; no latest/default dataset selection");
  }
  const progress = (phase) => process.stderr.write(`${new Date().toISOString()} ${phase}\n`);
  const report = geometryMode ? replayHistoricalGeometry({ root: process.cwd(),
    baselineBinding: { path: values["geometry-baseline"], sha256: values["baseline-sha256"] }, progress })
    : values["exposure-only"] ? auditSplitReleaseExposure({ root: process.cwd(),
      manifestBinding: { path: values.manifest, sha256: values.sha256 }, progress })
    : await auditSplitRelease({ root: process.cwd(),
    manifestBinding: { path: values.manifest, sha256: values.sha256 },
    progress });
  const evidence = values.write ? persistAudit(process.cwd(), report) : null;
  process.stdout.write(`${JSON.stringify({ status: report.status, summary: report.summary,
    qualification: report.qualification, evidence, remainingCoverage: report.remainingCoverage }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
