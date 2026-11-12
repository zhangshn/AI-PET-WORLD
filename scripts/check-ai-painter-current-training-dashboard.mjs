// Compatibility notice only. Original checker bytes are preserved in the registered cold archive.
console.error(JSON.stringify({
  "schemaVersion": "retired-engineering-check-v1",
  "status": "not_applicable_retired_interface",
  "passed": false,
  "reason": "The former ai-painter-progress training dashboard is retired. This command does not validate the current ai-console.",
  "currentSpecification": "docs/ai-console/AI_CONSOLE_ARCHITECTURE_SPEC.md",
  "historicalSource": {
    "path": "cold/runs/retired-training-dashboard-check-20261111-0225/check-ai-painter-current-training-dashboard.mjs",
    "sha256": "dc90821920243f87234aaf9787cfbec05d13f04b2d62f56062de169a9aadc535"
  },
  "suggestedCurrentCheck": "node scripts/check-ai-console-structure.mjs"
}, null, 2));
process.exitCode = 2;
