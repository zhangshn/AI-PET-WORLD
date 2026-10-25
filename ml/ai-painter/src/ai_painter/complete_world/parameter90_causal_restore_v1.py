"""Exact parameter90 failure-state reconstruction for a new diagnostic only.

No archived gradients/RNG are installed. The old parameter60 restoration entry,
policy and factory are never invoked; only its unchanged state-copy primitives
are reused. A caller-bound new policy supplies current normative identity.
"""
from copy import deepcopy
import importlib
import json
from pathlib import Path
import sys
from types import ModuleType
import torch
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv
from ai_painter.complete_world.parameter60_causal_restore_v1 import (
    _state_plan, _restore_network, _preserve_current_rng)

SOURCE_ROOT = ".runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/decode1-entry-completion-v2-079d72e9-1a7e-4c2c-84a3-767836b72fe1/"
SOURCE_RUN_ID = "decode1-entry-completion-v2-079d72e9-1a7e-4c2c-84a3-767836b72fe1"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2"
TARGET_NAME = "core.core.final_rgb_decoder.base.layers.4.weight"
ARCHIVE_SHA = "7b5014f5114cbf7d10606de5d5d4c84f528cab0494289b2d9869f0fc6adb4103"
ARCHIVE_BYTES = 50428157
SOURCE_HASHES = {
    "worker-terminal.json": "6ec5a3538b8632f180f88cb86e4d9cb7e241871d8cbbacc1d1c728e4b4250f3d",
    "gradient-failure/manifest.json": "aabdc1828b861f18525b46feb462591718852a9fa963c8478d556f27e1d1bab4",
    "gradient-failure/primary.json": "a4ad2498d8c03187b45ea06d821adbf3aa7c8e68fbde9659ee0801c5ab8d6d88",
    "model-identity.json": "5fd96b0f3b520a6a79092b00086aaae5d4460cacec2cd431d6938912a6277140",
    "quality-plan.json": "16203d84770ea1e21bc05d90f2a474c92e0213a3e3f2c87407117c318d9b5322",
    "capture-execution.json": "647d2b8a47532a65536e64dc6236589c95bec0841803ff2fe000369941465d10",
}
PROFILE_PATH = "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py"
PROFILE_SHA = "0a69a96ad0446f91a1fc41f60589fa4e5adc3275edc51e0756e7166e01485c5c"
ALGORITHM_ROLES = {"parameter60_causal_restore_v1", "painter_stage4_decode1_entry_weight_training_profile_v1",
    "object_decode1_entry_joint_priority_device_v1", "object_joint_rgb_structure_priority_update_cpu_v1",
    "object_support_structure_failure_capture_v1", "native_rgb_structured_object_cpu_v17",
    "native_rgb_complete_support_partition_v23_cpu", "object_ecology_decode1_entry_weight_precision_v1",
    "object_appearance_regime_bias_precision", "rgb_bias_reduction_precision", "rgb_bias_reduction_precision_cpu"}
require = capture.require

CURRENT_SCHEMA = "ai-painter-parameter90-causal-gpu-policy-v2"
CURRENT_ROOT = ".runtime/ai-painter/registered-training-d2-ss1-v1-executions/d2-ss1-v1-a43899c0-e05e-4ec6-b0fd-b99457b0fb64/"
CURRENT_RUN = "d2-ss1-v1-a43899c0-e05e-4ec6-b0fd-b99457b0fb64"
CURRENT_SAMPLE = "ai-cold-start-v7-v7-capacity-slot-173-grassland-forest-transition-v2"
CURRENT_PROFILE_SHA = "8dcd598f5fa5e1ee8af27e197666dce53eb66bb132be4007be042daae2a7b0ce"
CURRENT_HASHES = {
    "worker-terminal.json": "739c2ae71e7da6307f26b1deab0ef114d7f8afd5f7577862fe697c256b9a530a",
    "gradient-failure/manifest.json": "3aa3733f3832f4f6a7dd1c7c136479d40fc5b033f4938a1a008786906e71b030",
    "gradient-failure/primary.json": "e8d0f63fd27790889204f133897041918807737bd71e83834067bc7d3d595c80",
    "model-identity.json": "0054938a965797fa55f15563602ada6404b5b7fab0c7d6f12457661ad4d8e519",
    "quality-plan.json": "cc087a60c83ffffd9b2395c4e5c5d0aae3dc8cddb701e532cd02ad233b6fad25",
    "capture-execution.json": "e40cd125ef1d79ff484c89216cdd8781e973eb21abd62110a00f2172810022e6",
}


def source_route(policy=None):
    """Two exact archived failures, not caller-selected runs or model factories."""
    current = policy is not None and policy.get("schemaVersion") == CURRENT_SCHEMA
    if policy is not None:
        require(policy.get("schemaVersion") in (CURRENT_SCHEMA, "ai-painter-parameter90-causal-gpu-policy-v1"),
                "registered parameter90 policy required")
    return dict(root=CURRENT_ROOT if current else SOURCE_ROOT, run=CURRENT_RUN if current else SOURCE_RUN_ID,
        sample=CURRENT_SAMPLE if current else SAMPLE_ID, hashes=CURRENT_HASHES if current else SOURCE_HASHES,
        archive_sha="f9bb2917ba66361b01c4da2f3ca8597944645c2efafd6e6d035080553d6a8049" if current else ARCHIVE_SHA,
        archive_bytes=50443617 if current else ARCHIVE_BYTES,
        profile_sha=CURRENT_PROFILE_SHA if current else PROFILE_SHA,
        coordinates=[[1, 7, 0, 0]] if current else [[0, 1, 0, 0]],
        position=dict(epoch=6 if current else 15, zeroBasedEpochPosition=10 if current else 8,
            trainIndex=27 if current else 28, sampleId=CURRENT_SAMPLE if current else SAMPLE_ID),
        steps=dict(generator=250 if current else 680, discriminator=251 if current else 681),
        model_capability="stage4_mvp256_dry_factorized_ecology_decode2_entry_weight_precision_v1" if current else None,
        structure_weight=1.0 if current else 0.1, current=current)


def _binding(value):
    require(type(value) is dict and set(value) in ({"path", "sha256"}, {"path", "sha256", "bytes"}), "exact binding required")
    return {key: value[key] for key in ("path", "sha256")}


def _is_original_python_source(path):
    return path.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/")) and path.endswith(".py")


def _fresh_networks(project_root, order, verified_programs, *, policy=None):
    route = source_route(policy)
    path = project_root / PROFILE_PATH
    require(verified_programs.get(str(path)) == route["profile_sha"] and capture.digest(path.read_bytes()) == route["profile_sha"],
            "exact original decode1-entry profile required")
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
            return (profile.fresh_networks(order, model_capability=route["model_capability"])
                    if route["current"] else profile.fresh_networks(order))
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
    require(policy.get("target", {}).get("parameterIndex") == 90 and policy["target"].get("parameterName") == TARGET_NAME
            and policy["target"].get("weightShape") == [3, 48, 1, 1]
            and policy["target"].get("coordinates") == route["coordinates"]
            and policy["target"].get("captureInputChannel") == route["coordinates"][0][1]
            and policy["target"].get("captureOutputChannel") == route["coordinates"][0][0], "target90 identity required")
    if route["current"]:
        require(policy.get("modelCapabilityVersion") == route["model_capability"]
                and type(policy.get("objectSupportStructureWeight")) is int
                and policy["objectSupportStructureWeight"] == 1, "current decode2/structure weight binding required")
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
        records[binding["path"]] = json.loads(mapping.binding(_binding(binding)))
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
            "actual four-term total gradient identity differs at parameter 90", "original parameter90 error differs")
    require(terminal["failurePosition"] == context["failurePosition"] == route["position"]
            and context["optimizerSteps"] == terminal["optimizerSteps"] == route["steps"], "source failure position/counts differ")
    if route["current"]:
        require(plan["configuration"]["modelCapabilityVersion"] == route["model_capability"]
                and plan["configuration"].get("objectSupportStructureWeight") == 1,
                "captured decode2/structure weight differs")
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
        model, critic = (_fresh_networks(mapping.project, order, verified, policy=policy)
                         if route["current"] else _fresh_networks(mapping.project, order, verified))
        capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
        require(len(tuple(critic.parameters())) == 14, "original D14 required")
        named = tuple(model.named_parameters())
        target = model.get_submodule(TARGET_NAME.removesuffix(".weight"))
        require(named[90][0] == TARGET_NAME and target.weight is named[90][1] and type(target) is PrecisionFinalRGBConv and
                list(target.weight.shape) == [3, 48, 1, 1] and target.stride == target.dilation == (1, 1) and target.padding == (0, 0)
                and target.kernel_size == (1, 1) and target.padding_mode == "zeros"
                and target.in_channels == 48 and target.out_channels == 3 and target.groups == 1, "actual target90 PrecisionFinalRGBConv differs")
        storages = [v.untyped_storage().data_ptr() for n in (model, critic) for v in (*n.parameters(), *n.buffers()) if v.numel()]
        require(len(storages) == len(set(storages)), "cross-network storage alias")
        for prefix, network in (("generator", model), ("discriminator", critic)):
            _state_plan(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
        state = {prefix: _restore_network(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
                 for prefix, network in (("generator", model), ("discriminator", critic))}
    resource()
    return model, critic, manifest, state
