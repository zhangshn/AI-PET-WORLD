"""Exact RGB parameter0 after-exception state for one independent diagnostic.

Only the unchanged safe decoder and state-copy primitives are reused. No old
runner, saved gradients, RNG state or historical requires-grad flags are used.
"""
import importlib
import json
from pathlib import Path
import sys
from types import ModuleType
import torch
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world.parameter60_causal_restore_v1 import (
    _state_plan, _restore_network, _preserve_current_rng)

CURRENT_SCHEMA = 'ai-painter-parameter0-training-causal-gpu-policy-v1'
SOURCE_ROOT = '.runtime/ai-painter/registered-training-d2o-p0c-v1-executions/d2o-p0c-v1-b1b09f3e-1822-4a4d-b9f7-2f47a4585ad5/'
SOURCE_RUN_ID = 'd2o-p0c-v1-b1b09f3e-1822-4a4d-b9f7-2f47a4585ad5'
SAMPLE_ID = 'ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2'
TARGET_NAME = 'core.core.terrain.base_stem.layers.0.weight'
ARCHIVE_SHA = '39fc29fa80f8f425fcb400a07c45ec1d604b803e98e82c56116b6a96c56c8dcf'
ARCHIVE_BYTES = 50447477
SOURCE_HASHES = {'quality-plan.json': '74cee78715b88c5dba5cd910cf46f912e36b2d5e4154309f16aff607291c9f6a', 'model-identity.json': '190d3b65b5ee8e9b0cc3240d722102e1b904bf4f5c3c04fb7cc95e74e9c193aa', 'worker-terminal.json': 'c0bd95383abc70066728e9b0244bbebe8ca383fd409cf710d55d9113c5c8d343', 'gradient-failure/manifest.json': '43aaa9781a117ab7bef518dd0f2c75620f331488ebbcba1607e2b8675eba4789', 'gradient-failure/primary.json': 'b100bbd1895d248abbe26b2f63326a15d6a03665867a9b449265b5c72b0b0b16', 'capture-execution.json': 'dd42ff1f46425a44943b8db6eb6a6b3b84dee361ef23f45dc09f8da52cbc379e'}
PROFILE_PATH = 'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py'
PROFILE_SHA = 'c3ad26b9b4d766522c6428c9f5e4dad303af461aeefba4c47b543224cf0afecb'
MODEL_CAPABILITY = 'stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1'
CAPABILITY = 'parameter0_training_causal_zero_update_v1'
SOURCE_POSITION = {'epoch': 1, 'sampleId': 'ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2', 'trainIndex': 8, 'zeroBasedEpochPosition': 14}
SOURCE_STEPS = {'discriminator': 15, 'generator': 14}
ALGORITHM_ROLES = {'rgb_bias_reduction_precision', 'native_rgb_structured_object_cpu_v17', 'object_appearance_regime_bias_precision', 'object_decode1_entry_joint_priority_device_v1', 'rgb_bias_reduction_precision_cpu', 'object_ecology_decode1_entry_weight_precision_v1', 'painter_stage4_decode1_entry_weight_training_profile_v1', 'native_rgb_complete_support_partition_v23_cpu', 'object_support_structure_failure_capture_v1', 'parameter60_causal_restore_v1', 'object_joint_rgb_structure_priority_update_cpu_v1'}
require = capture.require


def source_route(policy=None):
    require(type(policy) is dict and policy.get("schemaVersion") == CURRENT_SCHEMA,
            "exact parameter0 training policy required")
    return dict(root=SOURCE_ROOT, run=SOURCE_RUN_ID, sample=SAMPLE_ID,
        hashes=dict(SOURCE_HASHES), archive_sha=ARCHIVE_SHA, archive_bytes=ARCHIVE_BYTES,
        profile_sha=PROFILE_SHA, coordinates=[[1, 13, 0, 0]], position=dict(SOURCE_POSITION),
        steps=dict(SOURCE_STEPS), model_capability=MODEL_CAPABILITY, structure_weight=1.0)


def _json(raw):
    def members(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "duplicate source metadata member")
            result[key] = value
        return result
    result = json.loads(raw, object_pairs_hook=members)
    require(type(result) is dict, "source metadata object required")
    return result


def _binding(value):
    require(type(value) is dict and set(value) in ({"path", "sha256"}, {"path", "sha256", "bytes"}), "exact binding required")
    return {key: value[key] for key in ("path", "sha256")}


def _is_original_python_source(path):
    return path.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/")) and path.endswith(".py")


def _fresh_networks(project_root, order, verified_programs, *, policy=None):
    route = source_route(policy)
    path = project_root / PROFILE_PATH
    require(verified_programs.get(str(path)) == route["profile_sha"] and capture.digest(path.read_bytes()) == route["profile_sha"],
            "exact original RGB profile required")
    old = list(sys.path)
    try:
        sys.path.insert(0, str(path.parent))
        profile = importlib.import_module(path.stem)
        require(Path(profile.__file__).absolute() == path, "profile import origin differs")
        queue, visited = [profile], set()
        while queue:
            module = queue.pop()
            if id(module) in visited: continue
            visited.add(id(module))
            origin = getattr(module, "__file__", None)
            if not origin: continue
            source = Path(origin).absolute()
            if source.suffix == ".py" and any(source.is_relative_to(project_root / p) for p in ("ml/ai-painter/src", "ml/ai-painter/scripts")):
                require(str(source) in verified_programs and capture.digest(source.read_bytes()) == verified_programs[str(source)],
                        "original imported model dependency unbound/stale")
                for value in vars(module).values():
                    dependency = value if isinstance(value, ModuleType) else sys.modules.get(getattr(value, "__module__", ""))
                    if isinstance(dependency, ModuleType): queue.append(dependency)
        with torch.device("cpu"):
            return profile.fresh_networks(order, model_capability=MODEL_CAPABILITY)
    finally:
        sys.path[:] = old


def validate_source_policy(policy):
    route = source_route(policy)
    require(type(policy.get("sourceEvidence")) is list and len(policy["sourceEvidence"]) == 6 and
            {_binding(b)["path"]: _binding(b)["sha256"] for b in policy["sourceEvidence"]} ==
            {route["root"] + name: sha for name, sha in route["hashes"].items()},
            "six exact metadata inputs required")
    require(policy.get("sourceTensorArchive") == {"path": route["root"] + "gradient-failure/tensors.pt", "sha256": route["archive_sha"],
                                                "bytes": route["archive_bytes"]}, "exact original archive required")
    scope = policy.get("scope", {})
    require(scope.get("failureSampleId") == route["sample"] and scope.get("sampleSplit") == "train" and scope.get("sampleCount") == 1
            and scope.get("failureRunId") == route["run"]
            and scope.get("resolution") == [256, 192] and scope.get("sourceStateTiming") == "after_exception", "exact source scope required")
    require(type(policy.get("target", {}).get("parameterIndex")) is int and policy["target"]["parameterIndex"] == 0 and policy["target"].get("parameterName") == TARGET_NAME
            and policy["target"].get("weightShape") == [48, 31, 3, 3]
            and policy["target"].get("coordinates") == route["coordinates"]
            and policy["target"].get("captureInputChannel") == route["coordinates"][0][1]
            and policy["target"].get("captureOutputChannel") == route["coordinates"][0][0], "fixed target0 identity required")
    require(policy.get("modelCapabilityVersion") == MODEL_CAPABILITY
            and policy.get("capabilityVersion") == CAPABILITY
            and type(policy.get("objectSupportStructureWeight")) is int
            and policy["objectSupportStructureWeight"] == 1, "exact RGB/weight1 identity required")
    require(policy.get("sourceFailurePosition") == SOURCE_POSITION
            and policy.get("sourceOptimizerSteps") == SOURCE_STEPS, "exact saved position/counts required")
    use = policy.get("sourceStateUse", {})
    require(all(use.get(k) is False for k in ("trainingInitializationAllowed", "historicalReplayAllowed", "archivedGradientsInstalled",
                "archivedRngRestored", "requiresGradHistoricalClaim")), "restore cannot grant historical/training identity")


def prepare_exact_failure_state(mapping, policy, *, resource):
    """CPU fresh instances with exact after_exception bytes; no forward or VJP."""
    validate_source_policy(policy)
    route = source_route(policy)
    records = {}
    for binding in policy["sourceEvidence"]:
        resource()
        records[binding["path"]] = _json(mapping.binding(_binding(binding)))
    terminal, manifest, primary, identity, plan, execution = [records[route["root"] + name] for name in
        ("worker-terminal.json", "gradient-failure/manifest.json", "gradient-failure/primary.json", "model-identity.json", "quality-plan.json", "capture-execution.json")]
    context = manifest["context"]
    original_python = plan["runtimeIdentity"]["python"]
    require(Path(sys.executable).absolute() == Path(original_python["absolutePath"]).absolute() and
            capture.digest(Path(sys.executable).read_bytes()) == original_python["sha256"], "original interpreter differs")
    require(terminal["schema"] == "object-support-structure-quality-worker-terminal-v1" and
            terminal["status"] == terminal["executionState"] == "failed_closed" and
            context == primary["context"] and terminal["runId"] == context["runId"] == plan["runId"] == execution["runId"] == route["run"] and
            terminal["executionPackage"] == context["executionPackage"] and terminal["originalError"] == primary["primaryError"],
            "failure terminal/context differs")
    require(primary["timing"] == manifest["stateTiming"] == "after_exception" and
            primary["primaryError"]["type"] == "ValueError" and primary["primaryError"]["message"] ==
            "actual four-term total gradient identity differs at parameter 0", "original parameter0 error differs")
    require(terminal["failurePosition"] == context["failurePosition"] == route["position"]
            and context["optimizerSteps"] == terminal["optimizerSteps"] == route["steps"], "source failure position/counts differ")
    require(plan["configuration"]["modelCapabilityVersion"] == MODEL_CAPABILITY
            and plan["configuration"].get("objectSupportStructureWeight") == 1,
            "captured RGB/weight1 identity differs")
    capture.validate_manifest(manifest)
    require(manifest["schema"] == capture.SCHEMA and manifest["status"] == "captured" and not manifest["missing"]
            and not manifest["nonfiniteTensorKeys"] and manifest["labels"] == list(capture.LABELS)
            and len(manifest["gradients"]) == 5 and identity["graph"] == manifest["graph"]
            and len(identity["graph"]) == 108 and sum(p["elements"] for p in identity["graph"]) == 2242687, "complete original five-gradient108 capture required")
    require(plan["modelBinding"] == context["modelBinding"] == execution["modelBinding"] and
            plan["programBindings"] == context["programBindings"] == execution["programBindings"] and
            execution["schema"] == "object-support-structure-failure-capture-execution-v1", "capture program/model identity differs")
    require(context["sampleId"] == route["sample"] and context["split"] == "train" and
            context["sampleBindings"] == policy["sourceSampleBindings"], "single train identity differs")
    require(manifest["artifacts"]["tensors"] == policy["sourceTensorArchive"] == terminal["captureReceipt"]["artifacts"]["tensors"]
            and terminal["captureReceipt"]["replayAllowed"] is False and manifest["replayAllowed"] is False, "archive/replay receipt differs")
    mapping.binding(context["executionPackage"])
    verified = {}
    for binding in context["programBindings"].values():
        if _is_original_python_source(binding["path"]):
            # Expected identities only. _fresh_networks checks the actually reached
            # frozen profile dependency modules before constructing the renderer.
            # The supervised entry already checks its bounded static import closure.
            path = str(mapping.project / binding["path"])
            previous = verified.setdefault(path, binding["sha256"])
            require(previous == binding["sha256"], "original Python binding collision")
    require(len(policy["sourceAlgorithmBindings"]) == len(ALGORITHM_ROLES)
            and {v["role"] for v in policy["sourceAlgorithmBindings"]} == ALGORITHM_ROLES, "original algorithm role set differs")
    for item in policy["sourceAlgorithmBindings"]:
        binding = item["binding"]
        require(Path(binding["path"]).stem == item["role"], "algorithm role/path differs")
        original = [b for b in context["programBindings"].values() if b["path"] == binding["path"]]
        if item["role"] == "parameter60_causal_restore_v1":
            require(_binding(binding) == {"path": "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py",
                    "sha256": "edb87370b17ff1760b5dd812877a64c33fbbdc39199821b0ae31b9c6d9e71547"},
                    "unchanged state-copy primitives required")
        else:
            require(len(original) == 1 and _binding(original[0]) == _binding(binding), "algorithm source missing/duplicate/collision")
        mapping.binding(_binding(binding), maximum=1024**2)
    archive = policy["sourceTensorArchive"]
    raw = mapping.binding(_binding(archive), maximum=capture.MAX_CAPTURE)
    require(len(raw) == archive["bytes"], "archive bytes differ")
    tensors = capture.safe_load_bytes(raw, archive["sha256"], manifest)
    del raw
    require(all(bool(torch.isfinite(v).all()) for v in tensors.values()), "nonfinite original archive")
    order = [c["id"] for c in context["sampleIdentity"]["channels"]]
    require(len(order) == len(set(order)) == 23, "original23 channels required")
    with _preserve_current_rng():
        model, critic = _fresh_networks(mapping.project, order, verified, policy=policy)
        capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
        require(len(tuple(critic.parameters())) == 14, "original D14 required")
        named = tuple(model.named_parameters())
        target = model.get_submodule(TARGET_NAME.removesuffix(".weight"))
        require(named[0][0] == TARGET_NAME and target.weight is named[0][1] and type(target) is torch.nn.Conv2d
                and list(target.weight.shape) == [48, 31, 3, 3] and target.weight.dtype == torch.float32
                and target.stride == target.dilation == (1, 1) and target.padding == (1, 1)
                and target.kernel_size == (3, 3) and target.padding_mode == "zeros"
                and target.in_channels == 31 and target.out_channels == 48 and target.groups == 1
                and target.bias is not None, "actual native target0 Conv2d identity differs")
        storages = [v.untyped_storage().data_ptr() for n in (model, critic) for v in (*n.parameters(), *n.buffers()) if v.numel()]
        require(len(storages) == len(set(storages)), "cross-network storage alias")
        for prefix, network in (("generator", model), ("discriminator", critic)):
            _state_plan(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
        state = {prefix: _restore_network(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
                 for prefix, network in (("generator", model), ("discriminator", critic))}
    del tensors  # Release decoded archive before any observation allocations.
    resource()
    return model, critic, manifest, state
