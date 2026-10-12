"""Read-only source/package/live authentication for the ecology execution adapter.

This boundary provides no dispatch, GPU admission, checkpoint promotion, retry,
or cleanup authority. Component CPU receipts are not final-entry qualification.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_v1"
PLAN_SCHEMA = "ecology-regime-managed-plan-v1"
EXECUTION_PROFILE = "factorized_ecology_execution_v1"
SELF = "ml/ai-painter/scripts/ecology_regime_execution_auth.py"
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
SPECIFICATION = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256": "ba943699ca0eee8ad449e3ae1ffa3a0aad171cbe2d032517945227da0d4d5735"}
COMPONENT_ACCEPTANCE = {"path": ".runtime/ai-painter/ecology-lifecycle-cpu-t-q4-70/real/acceptance.json",
    "sha256": "e5aa46e733b907eeaaec2678e595ce9ecf3750d85e8dd1ff01ad8a982e3e79cc"}
ROLE_PATHS = {
    "executionAuth": SELF,
    "managedCheckpoint": "ml/ai-painter/src/ai_painter/complete_world/ecology_regime_managed_checkpoint.py",
    "trainingLifecycle": "ml/ai-painter/scripts/painter_stage4_ecology_regime_lifecycle.py",
    "trainingProfile": "ml/ai-painter/scripts/painter_stage4_ecology_regime_training_profile.py",
    "registration": "scripts/lib/ai-painter-ecology-execution-registration-v1.mjs",
}
PHASES = {"preflight", "execute", "validate", "review", "adjudicate", "finalize"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def same_json(a, b):
    def dump(value):
        return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    try:
        return dump(a) == dump(b)
    except (TypeError, ValueError):
        return False


def exact_binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}
        and type(value["path"]) is str and "\\" not in value["path"] and ":" not in value["path"]
        and all(part not in ("", ".", "..") for part in value["path"].split("/"))
        and type(value["sha256"]) is str and re.fullmatch(r"[a-f0-9]{64}", value["sha256"]) is not None,
        "exact immutable execution binding required")
    return value


def decode(raw):
    require(type(raw) is bytes and len(raw) <= 2 * 1024**2, "bounded JSON bytes required")
    def pairs(rows):
        result = {}
        for key, value in rows:
            require(key not in result, "duplicate JSON identity field")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda value: require(False, "nonfinite JSON value: " + value))


def read_json(reader, binding):
    exact_binding(binding)
    raw = reader.read(binding)
    require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == binding["sha256"],
            "actual immutable bytes differ")
    value = decode(raw)
    require(type(value) is dict, "JSON object required")
    return value


@dataclass(frozen=True)
class ExecutionContext:
    reader: object
    package_binding: dict
    package: dict
    plan: dict
    configuration: dict


def derive_model_metadata(reader, dataset_binding):
    """Recompute the actual fresh CPU graph/state; no inference or updates."""
    import painter_stage4_ecology_regime_training_profile as profile
    from ai_painter.complete_world.object_ecology_regime_conditioned import ARCHITECTURE, NUMERIC_RULE
    manifest = read_json(reader, dataset_binding)
    model, critic = profile.fresh_networks(manifest["identityPayload"]["channelOrder"])
    graph = [{"name": name, "shape": list(p.shape), "elements": p.numel(), "dtype": str(p.dtype)}
        for name, p in model.named_parameters()]
    require(len(graph) == 108 and sum(row["elements"] for row in graph) == 2242687,
        "actual own full parameter graph differs")
    return {"capabilityVersion": CAPABILITY, "architecture": ARCHITECTURE, "numericRule": NUMERIC_RULE,
        "graph": graph, "initialState": {"generator": profile.core.cpu.state_hash(model),
                                        "discriminator": profile.core.cpu.state_hash(critic)}}


def verify_component_evidence(reader, binding):
    """Exact same-model foundation only; never inherited GPU/entry eligibility."""
    require(same_json(binding, COMPONENT_ACCEPTANCE), "own ecology CPU component receipt required")
    acceptance = read_json(reader, binding)
    require(acceptance.get("schema") == "ecology-lifecycle-owned-cpu-acceptance-v1"
        and acceptance.get("status") == "passed", "component acceptance differs")
    report = read_json(reader, acceptance["report"])
    require(report.get("schema") == "ecology-lifecycle-seven-train-cpu-report-v1"
        and report.get("status") == "own_seven_ecology_cpu_passed_not_gpu_qualified"
        and report.get("capabilityVersion") == CAPABILITY
        and same_json(report.get("metadataCounts"), {"train": 48, "validation": 8})
        and same_json(report.get("actualCounts"), {"forwardAttempted": 7, "forwardCompleted": 7,
            "generatorAttempted": 28, "generatorCompleted": 28,
            "discriminatorAttempted": 7, "discriminatorCompleted": 7})
        and type(report.get("optimizerUpdates")) is int and report["optimizerUpdates"] == 0
        and report.get("gpuInitialized") is False
        and report.get("validationRgbRead") is False
        and report.get("challengeContentRead") is False and report.get("regressionContentRead") is False
        and same_json(report.get("initialState"), report.get("finalState")),
        "actual own zero-update CPU component evidence differs")
    request = read_json(reader, acceptance["request"])
    require(same_json(report.get("request"), acceptance["request"])
        and same_json(request.get("formalSpecification"), SPECIFICATION), "component request differs")
    owned = read_json(reader, acceptance["ownedReceipt"])
    proof = owned.get("proof", {})
    require(owned.get("phase") == "cpu" and owned.get("ownerClosed") is True
        and owned.get("cleanupConfirmed") is True and proof.get("assignedBeforeResume") is True
        and proof.get("killOnJobClose") is True and type(proof.get("exitCode")) is int
        and proof["exitCode"] == 0 and type(proof.get("activeProcessesAfterCleanup")) is int
        and proof["activeProcessesAfterCleanup"] == 0 and not proof.get("cleanupError")
        and not proof.get("observationError"), "actual owned CPU release receipt required")
    sources = acceptance.get("programBindings")
    require(type(sources) is list and 1 <= len(sources) <= 256
        and len({b["path"] for b in sources}) == len(sources), "component source closure differs")
    for item in sources:
        exact_binding(item); reader.read(item)
    return report, request, sources


def load_execution_package(reader, package_binding):
    """Read standard local package format, but do not grant execution admission."""
    spec = read_json(reader, package_binding)
    require(spec.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1"
        and spec.get("capabilityVersion") == CAPABILITY
        and spec.get("ownerAuthorizationRequired") is False and spec.get("ownerInStateMachine") is False
        and type(spec.get("maxInfrastructureRecoveryAttempts")) is int
        and spec["maxInfrastructureRecoveryAttempts"] == 0, "own standard package boundary differs")
    package_id = spec.get("packageIdentity")
    require(type(package_id) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", package_id) is not None
        and package_binding["path"] == f".runtime/ai-painter/autonomous-closed-loop-packages/{package_id}/package.json",
        "standard immutable package path differs")
    inputs = spec.get("inputEvidence")
    require(type(inputs) is list and 1 <= len(inputs) <= 512, "bounded package input set required")
    for item in inputs:
        exact_binding(item)
    require(len({b["path"] for b in inputs}) == len(inputs), "duplicate package input source")
    plans = [b for b in inputs if b["path"].endswith("/ecology-plan.json")]
    require(len(plans) == 1, "one explicit ecology plan required")
    plan = read_json(reader, plans[0])
    run_id = plan.get("runId")
    require(type(run_id) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", run_id) is not None
        and run_id != package_id and plan.get("packageId") == package_id
        and plan.get("schema") == PLAN_SCHEMA and plan.get("capabilityVersion") == CAPABILITY
        and plan.get("executionMode") == "managed-training"
        and plan.get("executionProfile") == EXECUTION_PROFILE
        and plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False,
        "managed execution identity differs")
    require(plan.get("outputRoot") == spec.get("outputRoot")
        == ".runtime/ai-painter/ecology-regime-managed-executions/" + run_id
        and plans[0]["path"] == plan["outputRoot"] + "/ecology-plan.json", "same Run output/plan root differs")
    require(same_json(plan.get("formalSpecification"), SPECIFICATION), "frozen model specification differs")
    from ai_painter.complete_world import ecology_regime_managed_checkpoint as codec
    configuration = codec.derive_configuration(reader, plan["sourceCandidate"], plan["formalSpecification"])
    require(same_json(plan.get("configuration"), configuration), "derived frozen configuration differs")
    # A resource successor is not inferred from the predecessor's capability or
    # a caller-supplied wallSeconds. This binding component uses the base limit.
    require("resourcePolicy" not in plan and "effectiveExecutionCeiling" not in plan,
        "resource successor requires its separate authenticated adapter")
    candidate = read_json(reader, plan["sourceCandidate"])
    for key in ("datasetManifest", "trainSplit", "validationSplit"):
        require(same_json(plan.get(key), candidate["frozenBindings"][key]), "original data binding differs: " + key)
        reader.read(plan[key])
    required_inputs = [plan["formalSpecification"], plan["sourceCandidate"],
        plan["componentCpuAcceptance"], plan["datasetManifest"], plan["trainSplit"], plan["validationSplit"],
        plan["modelBinding"]]
    require(all(any(same_json(b, item) for b in inputs) for item in required_inputs),
        "authoritative evidence omitted from package")
    report, request, component_sources = verify_component_evidence(reader, plan["componentCpuAcceptance"])
    require(same_json(request["datasetManifest"], plan["datasetManifest"])
        and same_json(request["trainSplit"], plan["trainSplit"]), "own CPU evidence data differs")
    model_metadata = read_json(reader, plan["modelBinding"])
    expected_metadata = derive_model_metadata(reader, plan["datasetManifest"])
    require(same_json(model_metadata, expected_metadata)
        and same_json(model_metadata["initialState"], report["initialState"]),
        "actual fresh model metadata/state differs from own component proof")
    programs = plan.get("programBindings")
    require(type(programs) is dict and 1 <= len(programs) <= 256
        and set(ROLE_PATHS) <= set(programs) and type(spec.get("programLineage")) is dict
        and set(programs) == set(spec["programLineage"]), "complete explicit program lineage required")
    paths = {}
    for role, item in programs.items():
        exact_binding(item)
        require(type(role) is str and bool(role) and spec["programLineage"][role] == item["sha256"],
            "package program digest differs: " + str(role))
        reader.read(item)
        require(item["path"] not in paths or paths[item["path"]] == item["sha256"], "conflicting source alias")
        paths[item["path"]] = item["sha256"]
    for role, logical in ROLE_PATHS.items():
        require(programs[role]["path"] == logical, "own final adapter role differs: " + role)
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == programs["executionAuth"]["sha256"],
        "actually loaded execution authenticator differs")
    for item in component_sources:
        require(paths.get(item["path"]) == item["sha256"], "component source changed or omitted: " + item["path"])
    phases = spec.get("phaseAdapters")
    require(type(phases) is dict and set(phases) == PHASES, "existing six-phase protocol required")
    for name, item in phases.items():
        require(type(item) is dict and set(item) == {"kind", "path", "sha256", "exportName"}
            and item["kind"] == "project_module_export" and item["exportName"] == name
            and paths.get(item["path"]) == item["sha256"], "phase adapter not in own source closure")
    for item in inputs:
        reader.read(item)
    reader.unchanged()
    return ExecutionContext(reader, dict(package_binding), spec, plan, configuration)


def process_identity(pid):
    # Existing process creation-time reader; no PID-only alive fallback.
    import train_stage4_mvp_structured_object_v18_dry_stage0 as worker
    return worker.process_identity(pid)


def verify_live_context(context):
    """Recheck current registry, immutable lock, process identity, live heartbeat.

    Successful authentication proves identity at this instant, not progress,
    absence of a GPU owner, final-entry acceptance, or training qualification.
    """
    reader, plan, spec = context.reader, context.plan, context.package
    restored = load_execution_package(reader, context.package_binding)
    require(same_json(restored.plan, plan) and same_json(restored.package, spec)
        and same_json(restored.configuration, context.configuration), "context mutated after package authentication")
    reader.unchanged()
    raw = reader.path(REGISTRY).read_bytes()
    current = decode(raw); active = current.get("activeExecution")
    require(type(current.get("registryRevision")) is int and current["registryRevision"] > 0
        and current.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
        and type(active) is dict and active.get("schemaVersion") == "ai-painter-current-active-execution-v1"
        and active.get("executionState") == current.get("executionState") == "executing"
        and same_json(active.get("programLineage"), plan["programBindings"]), "active registered source context differs")
    identity = {"capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": spec["packageIdentity"]}
    require(all(current.get(k) == active.get(k) == v for k, v in identity.items()), "active Run/package/capability differs")
    require(type(active.get("processId")) is int and active["processId"] > 0
        and type(active.get("processStartIdentity")) is str and bool(active["processStartIdentity"]),
        "actual supervisor process identity required")
    pid = active["processId"]; creation = active["processStartIdentity"]
    require(process_identity(pid) == creation, "supervisor exited or PID reused")
    identity.update(processId=pid, processStartIdentity=creation)
    lock_binding = exact_binding(active.get("lock"))
    require(lock_binding["path"] == plan["outputRoot"] + "/execution-lock.json", "same Run lock path differs")
    lock = read_json(reader, lock_binding)
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
        and all(same_json(lock.get(k), v) for k, v in identity.items()), "current immutable lock identity differs")
    hb = active.get("heartbeat")
    require(type(hb) is dict and set(hb) == {"path", "ttlSeconds"}
        and hb["path"] == plan["outputRoot"] + "/heartbeat.json"
        and type(hb["ttlSeconds"]) is int and hb["ttlSeconds"] == 120, "same Run heartbeat binding differs")
    heartbeat = decode(reader.path(hb["path"]).read_bytes())
    require(heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1"
        and heartbeat.get("executionState") == "executing" and type(heartbeat.get("ttlSeconds")) is int
        and heartbeat["ttlSeconds"] == 120 and all(same_json(heartbeat.get(k), v) for k, v in identity.items()),
        "live heartbeat identity differs")
    stamp = datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None, "heartbeat timestamp requires explicit timezone")
    age = (datetime.now(timezone.utc) - stamp).total_seconds()
    require(-300 <= age < 120, "live heartbeat stale or future bound exceeded")
    require(reader.path(REGISTRY).read_bytes() == raw and process_identity(pid) == creation,
        "registry/process changed during authentication")
    reader.unchanged()
    return {"status": "live_identity_authenticated_not_execution_qualified",
        "runId": identity["runId"], "packageId": identity["packageId"], "capabilityVersion": CAPABILITY,
        "registryRevision": current["registryRevision"], "registrySha256": hashlib.sha256(raw).hexdigest(),
        "heartbeatAtUtc": heartbeat["heartbeatAtUtc"], "trainingProgressInferred": False,
        "gpuQualified": False, "productionEntryQualified": False, "cleanupProven": False}
