import assert from "node:assert/strict";
import fs from "node:fs";
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs";

const blocked = enrichTrainingProcessLedgerEvent({
  id: "fixture-blocked",
  status: "blocked",
  kind: "local_autonomous_candidate_planning",
  title: "candidate space exhausted",
});
assert.equal(blocked.autoAnalysisVersion, "ai-painter-training-ledger-auto-analysis-v2");
assert.equal(blocked.canEnterWorld, false);
assert.equal(/owner final review|人工终审/i.test(blocked.finalGameMapMeaning), false);
assert.equal(/owner final review|人工终审/i.test(blocked.finalGameMapMeaningZh), false);
assert.match(blocked.finalGameMapMeaningZh, /能力发布身份/);

const worldReady = enrichTrainingProcessLedgerEvent({
  id: "fixture-world-ready",
  status: "success",
  kind: "runtime_transition",
  title: "world_page_ready",
});
assert.equal(worldReady.canEnterWorld, true);
assert.equal(/owner final review|人工终审/i.test(worldReady.worldEntryMeaning), false);
assert.equal(/owner final review|人工终审/i.test(worldReady.worldEntryMeaningZh), false);
assert.match(worldReady.worldEntryMeaningZh, /本地发布流水线/);

const legacy = enrichTrainingProcessLedgerEvent({
  id: "fixture-legacy",
  status: "info",
  kind: "historical",
  title: "owner review historical record",
});
assert.equal(legacy.resultScope, "legacy_owner_record");
assert.equal(legacy.resultScopeZh, "历史人工记录（非现行发布闸门）");

const page = fs.readFileSync(
  "src/app/ai-painter-progress/training-ledger/page.tsx",
  "utf8",
);
assert.equal(/项目所有者人工终审/.test(page), false);
assert.match(page, /能力发布身份/);

console.log(
  JSON.stringify(
    {
      status: "passed",
      checks: 12,
      ownerPerRunReviewRequired: false,
      autoAnalysisVersion: blocked.autoAnalysisVersion,
    },
    null,
    2,
  ),
);
