import fs from "node:fs";
import path from "node:path";
import { assertSupportedCapabilityScope, FIRST_WEATHER_SCOPED_POLICY_PATH, FIRST_WEATHER_SCOPED_VERSION,
  ROLLING_WEATHER_POLICY_PATH,ROLLING_WEATHER_VERSION,SCHEDULED_WEATHER_POLICY_PATH,SCHEDULED_WEATHER_VERSION } from "./lib/ai-painter-autonomous-package-decision-core-v3.mjs";
import { publishMachineAdjudicatedCapability, reconcilePublishedScopedWeatherLifecycle } from "./lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";
import { WEATHER_POLICY_PATH, WEATHER_VERSION, FIRST_WEATHER_POLICY_PATH, FIRST_WEATHER_VERSION, registerWeatherPolicyCandidate } from "./lib/world-weather-release-policy.mjs";

const args = process.argv.slice(2);
const weatherReconcile = new Map([["--reconcile-first-weather-v3",FIRST_WEATHER_SCOPED_VERSION],["--reconcile-rolling-weather-v4",ROLLING_WEATHER_VERSION],
  ["--reconcile-scheduled-weather-v5",SCHEDULED_WEATHER_VERSION]]);
if (weatherReconcile.has(args[0])) {
  if (args.length !== 1) throw new Error("fixed weather lifecycle reconciliation accepts no arguments");
  const version=weatherReconcile.get(args[0]);
  console.log(JSON.stringify(reconcilePublishedScopedWeatherLifecycle(process.cwd(),version), null, 2));
} else if (args[0] === "--qualify-scheduled-weather-v5") {
  if (args.length !== 1) throw new Error("fixed scheduled weather qualification accepts no arguments");
  const {qualifyScheduledWeatherCandidate}=await import("./lib/world-weather-scheduled-qualification.mjs");
  console.log(JSON.stringify(await qualifyScheduledWeatherCandidate(),null,2));
} else if (args[0] === "--qualify-rolling-weather-v4") {
  if (args.length !== 1) throw new Error("fixed rolling weather qualification accepts no arguments");
  const {qualifyRollingWeatherCandidate}=await import("./lib/world-weather-rolling-qualification.mjs");
  console.log(JSON.stringify(await qualifyRollingWeatherCandidate(),null,2));
} else if (args[0] === "--qualify-first-committed-weather") {
  if (args.length !== 1) throw new Error("fixed committed weather qualification accepts no arguments");
  const {qualifyFirstWeatherCandidate} = await import("./lib/world-weather-v3-qualification.mjs");
  console.log(JSON.stringify(await qualifyFirstWeatherCandidate(), null, 2));
} else if (args[0] === "--verify-weather-regression") {
  if (args.length !== 1) throw new Error("weather regression verifies only the registered checkpoint and dataset");
  const { verifyWeatherRegression } = await import("./lib/world-weather-regression.mjs");
  console.log(JSON.stringify(verifyWeatherRegression(), null, 2));
} else if(args[0] === "--qualify-first-weather-budget") {
  if(args.length!==2 || !["forecast","timeout-probe"].includes(args[1])) throw Error("expected a fixed qualification case");
  const {qualifyFirstWeatherBudget}=await import("./lib/world-weather-first-step.mjs");
  console.log(JSON.stringify(await qualifyFirstWeatherBudget(args[1]),null,2));
} else if (["--register-world-weather-candidate","--register-first-weather-candidate"].includes(args[0])) {
  if (args.length !== 1) throw new Error("fixed weather candidate registration takes no arguments");
  process.stdout.write(JSON.stringify(await registerWeatherPolicyCandidate(process.cwd(),args[0]==="--register-first-weather-candidate"?FIRST_WEATHER_VERSION:WEATHER_VERSION), null, 2) + "\n");
} else if (args[0] === "--prepare-world-weather-target") {
  if (args.length !== 1) throw new Error("preparation takes no publication arguments");
  const { prepareNaturalWorldWeatherTarget } = await import("./lib/world-environment-target-profile.mjs");
  process.stdout.write(JSON.stringify(prepareNaturalWorldWeatherTarget(), null, 2) + "\n");
} else {
  try {
    publish(args);
  } catch (error) {
    if (error.code !== "weather_release_not_admitted") throw error;
    process.stderr.write(JSON.stringify({status:error.code,assessment:error.assessment})+"\n");
    process.exitCode=1;
  }
}

function publish(argv) {
  const options = new Map();
  for (let n=0; n<argv.length; n+=2) {
    const key=argv[n], val=argv[n+1];
    if (!["--draft","--expected-registry-revision","--required-capability-scope"].includes(key)
        || options.has(key) || !val || val.startsWith("--")) throw new Error("unknown, incomplete or duplicate release option");
    options.set(key,val);
  }
  const scope=options.get("--required-capability-scope");
  if (scope === "world_evolution") {
    const weatherDrafts=new Map([[FIRST_WEATHER_SCOPED_POLICY_PATH,FIRST_WEATHER_SCOPED_VERSION],[ROLLING_WEATHER_POLICY_PATH,ROLLING_WEATHER_VERSION],
      [SCHEDULED_WEATHER_POLICY_PATH,SCHEDULED_WEATHER_VERSION]]);
    if (weatherDrafts.has(options.get("--draft"))
        && /^\d+$/.test(options.get("--expected-registry-revision") ?? "")) {
      const version=weatherDrafts.get(options.get("--draft"));
      const result = publishMachineAdjudicatedCapability({capabilityReleaseIdentity:version},
        {root:process.cwd(), expectedRegistryRevision:Number(options.get("--expected-registry-revision")), requiredCapabilityScope:scope});
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return;
    }
    if ([WEATHER_POLICY_PATH,FIRST_WEATHER_POLICY_PATH].includes(options.get("--draft")) && /^\d+$/.test(options.get("--expected-registry-revision") ?? "")) {
      return publishMachineAdjudicatedCapability({capabilityReleaseIdentity:options.get("--draft")===WEATHER_POLICY_PATH?WEATHER_VERSION:FIRST_WEATHER_VERSION},
        {root:process.cwd(), expectedRegistryRevision:Number(options.get("--expected-registry-revision")), requiredCapabilityScope:scope});
    }
  }
  assertSupportedCapabilityScope(scope);
  const draftPath = options.get("--draft");
  const revisionText = options.get("--expected-registry-revision");
  if (!draftPath || !revisionText) throw new Error("draft and expected registry revision are required");
  if (!/^\d+$/.test(revisionText)) throw new Error("expected registry revision must be an integer");
  if (path.isAbsolute(draftPath) || /^[A-Za-z]:[\\/]/.test(draftPath) || draftPath.includes("..")) throw new Error("draft path must be project-relative");
  const absolute = path.resolve(process.cwd(), draftPath);
  if (!absolute.startsWith(`${path.resolve(process.cwd())}${path.sep}`) || !fs.existsSync(absolute)) throw new Error("draft path is invalid or missing");
  const draft = JSON.parse(fs.readFileSync(absolute, "utf8"));
  for (const key of ["capabilityScope","requiredCapabilityScope"]) {
    if (Object.hasOwn(draft,key)) assertSupportedCapabilityScope(draft[key]);
  }
  const result = publishMachineAdjudicatedCapability(draft, { root: process.cwd(), expectedRegistryRevision: Number(revisionText), requiredCapabilityScope: scope });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
