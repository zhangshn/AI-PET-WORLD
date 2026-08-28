import { materializePostDecodeFailureBoundedPlan } from "./lib/ai-painter-stage4-post-decode-failure-bounded-planner-v1.mjs";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const required = (name) => {
  const result = value(name);
  if (!result) throw new Error(`${name} is required`);
  return result;
};
const result = materializePostDecodeFailureBoundedPlan({
  sourceRunRoot: required("--source-run-root"),
  planningRunId: required("--planning-run-id"),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
