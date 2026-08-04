import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"

const ROOT = process.cwd()
const FINALIZATION_PATH = ".runtime/ai-painter/v7-bounded-repair-r2-overfit-smoke-finalizations/ai-assisted-v7-r2-overfit-smoke-finalization-reconciled-20260803/finalization-report.json"
const OVERLAY_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const LATEST_PATH = ".runtime/ai-painter/local-ai-failure-learning/latest.json"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase1-20260804/request.json"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase1-20260804/failure-learning-phase1-implementation-consumption.json"
const checks = []
const finalization = readJson(FINALIZATION_PATH)
check(fileHashMatches(finalization.previewReviewPath, finalization.previewReviewSha256), "source preview review hash is immutable")
const review = readJson(finalization.previewReviewPath)
const overlay = readJson(OVERLAY_PATH)
const analysis = analyzeFailureLearningLoop({ review, finalization, overlay, sourcePaths: [] })
check(analysis.summary.previewCount === 7 && analysis.summary.failedPreviewCount === 6 && analysis.summary.passedPreviewCount === 1, "all seven previews and 6/1 machine results are normalized")
check(analysis.summary.finalEpoch === 120 && analysis.summary.finalPreviewPassed === true && analysis.summary.finalPassingStreak === 1, "terminal pass is distinguished from a stable passing window")
const boundary = analysis.issueClusters.find((cluster) => cluster.issueCode === "condition_terrain_path_ground_uncontracted_boundary_contact")
check(boundary?.episodeCount === 2 && boundary.trend === "recurred_then_resolved", "road boundary regression is classified as recurrence")
const rock = analysis.issueClusters.find((cluster) => cluster.issueCode === "condition_object_rock_reference_semantic_mismatch")
check(rock?.lastSeenEpoch === 40 && rock.resolvedByFinal === true, "slow object-rock semantic learning is preserved as evidence")
check(analysis.rootCauseCandidates.some((candidate) => candidate.id === "terminal_pass_without_stability_window" && candidate.confidence === 0.99), "single terminal pass produces a high-confidence stability evidence gap")
check(analysis.repairContract.configurationPatchProposal.status === "proposal_only_not_applied", "training configuration is proposed but not applied")
check(analysis.repairContract.forbiddenChanges.includes("降低或删除现有机器审核阈值"), "repair contract forbids threshold weakening")
check(analysis.repairContract.regressionContract.positive.length > 0 && analysis.repairContract.regressionContract.negative.length > 0, "positive and negative regression contracts are both present")
check(analysis.closure.configurationPatchApplied === false && analysis.closure.trainingStarted === false && analysis.closure.ownerReviewRequired === true, "closed loop stops at Owner review without training")

const latest = readJson(LATEST_PATH)
check(Boolean(latest.runPath && fs.existsSync(resolve(latest.runPath))), "durable failure-learning latest pointer resolves")
const durable = readJson(latest.runPath)
check(durable.schemaVersion === "local-ai-failure-learning-report-v1" && durable.automaticStorage === true, "durable report uses the local failure-learning schema")
check(durable.summary.conclusionZh === analysis.summary.conclusionZh, "durable conclusion matches deterministic re-analysis")
check(fileHashMatches(AUTHORIZATION_PATH, "c869f97bae2fd2cac03a069f4cdb100c6d2ccb3446f4214908f7fef30adb1040"), "bounded non-training authorization hash matches")
const consumption = readJson(CONSUMPTION_PATH)
check(consumption.status === "consumed_before_authorized_write" && consumption.forbiddenActions.includes("model_training"), "authorization was consumed before writes and forbids training")

const serverSource = readText("src/server/ai-painter-local-task-console.ts")
const clientSource = readText("src/app/ai-painter-progress/task-console/task-console.tsx")
check(serverSource.includes("readFailureLearning") && serverSource.includes("local-ai-failure-learning/latest.json"), "task console reads local failure-learning evidence")
check(clientSource.includes("local-ai-failure-learning-panel") && clientSource.includes("机器可读训练配置修复提案"), "task console exposes diagnosis and configuration proposal")

console.log(JSON.stringify({ ok: true, assertionCount: checks.length, checks }, null, 2))

function check(condition, label) { if (!condition) throw new Error(label); checks.push(label) }
function resolve(value) { return path.resolve(ROOT, value) }
function readText(value) { return fs.readFileSync(resolve(value), "utf8") }
function readJson(value) { return JSON.parse(readText(value)) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && sha256File(value) === expected) }
