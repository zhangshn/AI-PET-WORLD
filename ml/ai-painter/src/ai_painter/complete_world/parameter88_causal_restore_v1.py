"""Exact parameter88 failure-state reconstruction for a new diagnostic only.

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
from ai_painter.complete_world.parameter60_causal_restore_v1 import (
    _state_plan, _restore_network, _preserve_current_rng)

SOURCE_ROOT = ".runtime/ai-painter/object-support-structure-quality-executions/object-support-quality-v1-e03cae36-386e-4919-b83c-a8441ab7115c/"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-169-forested-low-mountain-v2"
TARGET_NAME = "core.core.final_rgb_decoder.base.layers.2.weight"
ARCHIVE_SHA = "2ce433ac36cc2598c342aba193b64e9e008269ba7c89a6b405c2fe3b58138072"
ARCHIVE_BYTES = 50419897
SOURCE_HASHES = {
    "worker-terminal.json": "6ccd45712abfbd4850f3234832f035babbac0bfc20a7c98fb24d3aa01ae41303",
    "gradient-failure/manifest.json": "6fa557bad90e86ed90c83b9686bbcf77842215eb4839a9bbd53ca2b851e93605",
    "gradient-failure/primary.json": "98e5e7460b8892eadb9254c5c19c55d33e90ab8c10773572369e9b946814447c",
    "model-identity.json": "0e50b14e74b1ae8b57bf66d943ed6179e8be764541411611f5c917c46f4da92a",
    "quality-plan.json": "af372485c1f073091b4302943679fe0cfd276b8688fe89dbec4e79a5808be799",
    "capture-execution.json": "c1f8a0181c2f1e4d507c05f46ccefdad62b7b082941945be7b7d52dbd4990b04",
}
PROFILE_PATH = "ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py"
PROFILE_SHA = "8e336764cb56da5ab8a30a4202b1b7531fe13e64d29afa164a8431b9f921aa5b"
ALGORITHM_ROLES = {"parameter60_causal_restore_v1", "parameter60_causal_observation_v1", "diagnose_parameter60_causal_gpu_v1",
    "painter_stage4_object_support_structure_training_profile_v1", "object_support_structure_priority_update_device_v1",
    "object_support_structure_priority_update_cpu_v1", "object_support_structure_failure_capture_v1",
    "native_rgb_structured_object_cpu_v17", "native_rgb_complete_support_partition_v23_cpu"}
require = capture.require


def _binding(value):
    require(type(value) is dict and set(value) in ({"path", "sha256"}, {"path", "sha256", "bytes"}), "exact binding required")
    return {key: value[key] for key in ("path", "sha256")}


def _is_original_python_source(path):
    return path.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/")) and path.endswith(".py")


def _fresh_networks(project_root, order, verified_programs):
    path = project_root / PROFILE_PATH
    require(verified_programs.get(str(path)) == PROFILE_SHA and capture.digest(path.read_bytes()) == PROFILE_SHA,
            "exact original object-support profile required")
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
            return profile.fresh_networks(order)
    finally:
        sys.path[:] = old


def validate_source_policy(policy):
    require(type(policy.get("sourceEvidence")) is list and len(policy["sourceEvidence"]) == 6 and
            {_binding(b)["path"]: _binding(b)["sha256"] for b in policy["sourceEvidence"]} ==
            {SOURCE_ROOT + name: sha for name, sha in SOURCE_HASHES.items()},
            "six exact metadata inputs required")
    require(policy.get("sourceTensorArchive") == {"path": SOURCE_ROOT + "gradient-failure/tensors.pt", "sha256": ARCHIVE_SHA,
                                                "bytes": ARCHIVE_BYTES}, "exact original archive required")
    scope = policy.get("scope", {})
    require(scope.get("failureSampleId") == SAMPLE_ID and scope.get("sampleSplit") == "train" and scope.get("sampleCount") == 1
            and scope.get("resolution") == [256, 192] and scope.get("sourceStateTiming") == "after_exception", "exact source scope required")
    require(policy.get("target", {}).get("parameterIndex") == 88 and policy["target"].get("parameterName") == TARGET_NAME
            and policy["target"].get("weightShape") == [48, 48, 3, 3], "target88 identity required")
    use = policy.get("sourceStateUse", {})
    require(all(use.get(k) is False for k in ("trainingInitializationAllowed", "historicalReplayAllowed", "archivedGradientsInstalled",
                "archivedRngRestored", "requiresGradHistoricalClaim")), "restore cannot grant historical/training identity")


def prepare_exact_failure_state(mapping, policy, *, resource):
    """CPU fresh instances with exact after_exception bytes; no forward or VJP."""
    validate_source_policy(policy)
    records = {}
    for binding in policy["sourceEvidence"]:
        resource()
        records[binding["path"]] = json.loads(mapping.binding(_binding(binding)))
    terminal, manifest, primary, identity, plan, execution = [records[SOURCE_ROOT + name] for name in
        ("worker-terminal.json", "gradient-failure/manifest.json", "gradient-failure/primary.json", "model-identity.json", "quality-plan.json", "capture-execution.json")]
    context = manifest["context"]
    original_python = plan["runtimeIdentity"]["python"]
    require(Path(sys.executable).absolute() == Path(original_python["absolutePath"]).absolute() and
            capture.digest(Path(sys.executable).read_bytes()) == original_python["sha256"], "original interpreter differs")
    require(terminal["schema"] == "object-support-structure-quality-worker-terminal-v1" and
            terminal["status"] == terminal["executionState"] == "failed_closed" and
            context == primary["context"] and terminal["runId"] == context["runId"] == plan["runId"] == execution["runId"] and
            terminal["executionPackage"] == context["executionPackage"] and terminal["originalError"] == primary["primaryError"],
            "failure terminal/context differs")
    require(primary["timing"] == manifest["stateTiming"] == "after_exception" and
            primary["primaryError"]["type"] == "ValueError" and primary["primaryError"]["message"] ==
            "actual four-term total gradient identity differs at parameter 88", "original parameter88 error differs")
    require(terminal["failurePosition"] == context["failurePosition"] == {"epoch": 12, "zeroBasedEpochPosition": 11,
                "trainIndex": 23, "sampleId": SAMPLE_ID} and context["optimizerSteps"] == terminal["optimizerSteps"] ==
                {"generator": 539, "discriminator": 540}, "source failure position/counts differ")
    capture.validate_manifest(manifest)
    require(manifest["schema"] == capture.SCHEMA and manifest["status"] == "captured" and not manifest["missing"]
            and not manifest["nonfiniteTensorKeys"] and manifest["labels"] == list(capture.LABELS)
            and len(manifest["gradients"]) == 5 and identity["graph"] == manifest["graph"]
            and len(identity["graph"]) == 108, "complete original five-gradient108 capture required")
    require(plan["modelBinding"] == context["modelBinding"] == execution["modelBinding"] and
            plan["programBindings"] == context["programBindings"] == execution["programBindings"] and
            execution["schema"] == "object-support-structure-failure-capture-execution-v1", "capture program/model identity differs")
    require(context["sampleId"] == SAMPLE_ID and context["split"] == "train" and
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
    require({v["role"] for v in policy["sourceAlgorithmBindings"]} == ALGORITHM_ROLES, "original algorithm role set differs")
    for item in policy["sourceAlgorithmBindings"]:
        binding = item["binding"]
        require(Path(binding["path"]).stem == item["role"], "algorithm role/path differs")
        original = [b for b in context["programBindings"].values() if b["path"] == binding["path"]]
        require(not original or all(_binding(b) == _binding(binding) for b in original), "algorithm source collision")
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
        model, critic = _fresh_networks(mapping.project, order, verified)
        capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
        require(len(tuple(critic.parameters())) == 14, "original D14 required")
        named = tuple(model.named_parameters())
        target = model.get_submodule(TARGET_NAME.removesuffix(".weight"))
        require(named[88][0] == TARGET_NAME and target.weight is named[88][1] and type(target) is torch.nn.Conv2d and
                list(target.weight.shape) == [48, 48, 3, 3] and target.stride == target.padding == target.dilation == (1, 1)
                and target.groups == 1, "actual target88 native Conv2d differs")
        storages = [v.untyped_storage().data_ptr() for n in (model, critic) for v in (*n.parameters(), *n.buffers()) if v.numel()]
        require(len(storages) == len(set(storages)), "cross-network storage alias")
        for prefix, network in (("generator", model), ("discriminator", critic)):
            _state_plan(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
        state = {prefix: _restore_network(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
                 for prefix, network in (("generator", model), ("discriminator", critic))}
    resource()
    return model, critic, manifest, state
