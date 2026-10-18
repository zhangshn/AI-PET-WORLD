"""CPU-only recovery of authenticated failure evidence, never training initialization.

Archived gradients/RNG are evidence only. requires_grad was not archived; the
factory's new-instance flags remain unchanged and receive no historical claim.
"""
from __future__ import annotations

from copy import deepcopy
from contextlib import contextmanager
import importlib
import json
from pathlib import Path
import random
import sys
import time
from types import ModuleType

import numpy as np
import torch

from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture

POLICY_PATH = "data/ai-painter/system-governance/ai-painter-parameter60-causal-cpu-policy-v1.json"
POLICY_SHA = "67cec6ef0c5c2d395eb9f7f4e13d9ec301c35366db6597c361379efd4bd7c51f"
SCHEMA = "ai-painter-parameter60-causal-cpu-policy-v1"
STATUS = "active_cpu_preflight_only_not_gpu_or_training"
SOURCE_ROOT = ".runtime/ai-painter/ecology-decode1-weight-quality-executions/decode1-quality-v2-25e96b64-787b-4d4d-b9f3-114850f7e337/"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2"
TARGET_NAME = "core.core.terrain.full_resolution_detail.layers.3.weight"
SOURCE_HASHES = {
    "worker-terminal.json": "4de81c9efd93124771c98718a55aa5bd7d7159ed796e3072816604bced514985",
    "gradient-failure/manifest.json": "52f78d8a3d68424ad381b9a36786194b37880a23aa8fe5069da4805727abfbb7",
    "gradient-failure/primary.json": "1dae6f4622d13bc75ff909055c16a61be41bea7dd46b084fc3b793cf74b8ab27",
    "model-identity.json": "09f3066ffff1513fbefaeb48fa7af2a48b942e85cb70bd6f98d9bc2a1bde0de9",
}
ARCHIVE_SHA = "065cffad014029cab3905a4f6cb147f792be3db81acfcb1a89f5936a8ea87f2d"
ALGORITHM_ROLES = {"decode1Bridge", "decode1Model", "decode1Operator", "trainingProfile", "capture"}
COUNTS = {"cudaCalls": 0, "fullModelForwards": 0, "fullModelAutogradCalls": 0,
          "discriminatorAutogradCalls": 0, "optimizerConstruction": 0, "optimizerUpdates": 0}
require = capture.require


def _binding(value):
    require(type(value) is dict and set(value) in ({"path", "sha256"}, {"path", "sha256", "bytes"}),
            "exact source binding required")
    return {key: value[key] for key in ("path", "sha256")}


def _is_original_python_source(logical):
    return (logical.startswith("ml/ai-painter/src/") or logical.startswith("ml/ai-painter/scripts/")) and logical.endswith(".py")


def _validate_policy(contract):
    require(type(contract) is dict and contract.get("schemaVersion") == SCHEMA and
            contract.get("status") == STATUS, "CPU diagnostic policy schema/status differs")
    expected = [{"path": SOURCE_ROOT + name, "sha256": sha} for name, sha in SOURCE_HASHES.items()]
    require(contract.get("sourceEvidence") == expected, "fixed failure source evidence differs")
    archive = contract.get("sourceTensorArchive", {})
    require(archive == {"path": SOURCE_ROOT + "gradient-failure/tensors.pt", "sha256": ARCHIVE_SHA,
                        "bytes": 42252025}, "fixed source archive differs")
    scope = contract.get("scope", {})
    require(scope.get("failureSampleId") == SAMPLE_ID and scope.get("sampleSplit") == "train" and
            scope.get("sampleCount") == 1 and scope.get("resolution") == [256, 192] and
            scope.get("sourceStateTiming") == "after_exception" and
            scope.get("sourceReplayAllowedRemainsFalse") is True, "single train failure scope differs")
    target = contract.get("target", {})
    require(target.get("parameterIndex") == 60 and target.get("parameterName") == TARGET_NAME and
            target.get("modulePath") == TARGET_NAME.rsplit(".", 1)[0] and
            target.get("weightShape") == [48, 48, 3, 3] and target.get("elements") == 20736 and
            target.get("dtype") == "torch.float32", "parameter60 diagnostic identity differs")
    use = contract.get("sourceStateUse", {})
    require(use.get("purpose") == "failure_evidence_cpu_diagnostic_only" and
            all(use.get(key) is False for key in ("trainingInitializationAllowed", "historicalReplayAllowed",
                "archivedGradientsInstalled", "archivedRngRestored", "requiresGradHistoricalClaim")),
            "source-state use must not claim historical flags/replay or training")
    resources = contract.get("resources", {})
    require(resources == {"maxWallSeconds": 120, "threads": 2, "maxOutputBytes": 8388608,
        "cudaCalls": 0, "fullModelForwards": 0, "fullModelAutogradCalls": 0,
        "optimizerConstruction": 0, "optimizerUpdates": 0}, "CPU diagnostic resource boundary differs")
    qualification = contract.get("qualification")
    require(type(qualification) is dict and qualification and all(value is False for value in qualification.values()),
            "all diagnostic qualifications must remain false")
    formal = contract.get("formalSpecification", {})
    require(formal.get("path") == "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md" and
            formal.get("version") == "AI-PAINTER-SPEC-1.62", "new normative version required")


def _state_plan(network, metadata, tensors, descriptors):
    """Validate all state/mode identities before copying any state into this instance."""
    require(isinstance(network, torch.nn.Module), "fresh CPU module required")
    params = tuple(network.named_parameters(remove_duplicate=False))
    buffers = tuple(network.named_buffers(remove_duplicate=False))
    named = [("parameter", name, value) for name, value in params]
    named += [("buffer", name, value) for name, value in buffers]
    rows = metadata["state"]
    require(len(named) == len(rows) and len({name for _, name, _ in named}) == len(named),
            "missing/extra/aliased network state")
    require(len({id(value) for _, _, value in named}) == len(named), "network tensor identity alias")
    storages = [v.untyped_storage().data_ptr() for _, _, v in named if v.numel()]
    require(len(set(storages)) == len(storages), "network storage alias")
    modules = tuple(network.named_modules(remove_duplicate=False))
    modes = metadata["modes"]
    require(type(modes) is dict and set(modes) == {name for name, _ in modules} and
            all(type(value) is bool for value in modes.values()), "missing/extra/module mode identity")
    require(len({id(module) for _, module in modules}) == len(modules), "module identity alias")
    planned = []
    for (kind, name, destination), row in zip(named, rows):
        require(row["kind"] == kind and row["name"] == name, "state name/order/kind differs")
        value = tensors[row["key"]]
        descriptor = descriptors[row["key"]]
        require(destination.device.type == value.device.type == "cpu" and
                destination.layout == value.layout == torch.strided and not destination.is_meta and
                destination.is_contiguous() and value.is_contiguous() and
                destination.dtype == value.dtype and destination.shape == value.shape and
                list(value.shape) == descriptor["shape"] and str(value.dtype) == descriptor["dtype"] and
                capture.tensor_sha(value) == descriptor["sha256"] and
                bool(torch.isfinite(value).all()) and descriptor["allFinite"] is True,
                "state shape/dtype/hash/finite/CPU identity differs")
        require(type(descriptor.get("sourceVersion")) is int and descriptor["sourceVersion"] >= 0,
                "historical source tensor version missing")
        require(kind != "parameter" or destination.grad is None, "fresh instance must not contain gradients")
        planned.append((name, destination, value, descriptor))
    return planned, modules, {name: parameter.requires_grad for name, parameter in params}


def _restore_network(network, metadata, tensors, descriptors):
    plan, modules, flags = _state_plan(network, metadata, tensors, descriptors)
    before = {name: value._version for name, value, _, _ in plan}
    with torch.no_grad():
        for _, destination, value, _ in plan:
            destination.copy_(value)
    # Set each module directly: recursive train() would erase mixed child modes.
    for name, module in modules:
        module.training = metadata["modes"][name]
    hashes, versions, history = {}, {}, {}
    for name, destination, _, descriptor in plan:
        actual = capture.tensor_sha(destination.detach())
        require(actual == descriptor["sha256"], "restored byte hash differs")
        require(destination._version == before[name] + 1, "unexpected new-instance state mutation")
        hashes[name], versions[name], history[name] = actual, destination._version, descriptor["sourceVersion"]
    require({name: value.requires_grad for name, value in network.named_parameters()} == flags and
            all(value.grad is None for value in network.parameters()), "archived gradient/flag installation forbidden")
    return {"restoredByteHashes": hashes, "newInstanceVersions": versions, "archivedSourceVersions": history,
            "modes": dict(metadata["modes"]), "newInstanceRequiresGrad": flags,
            "requiresGradHistoricalClaim": False, "archivedGradientsInstalled": False}


def _fresh_networks(project_root, order, verified_programs):
    scripts = project_root / "ml/ai-painter/scripts"
    profile_name = "painter_stage4_ecology_decode1_weight_training_profile_v1"
    original_path = scripts / (profile_name + ".py")
    expected = verified_programs.get(str(original_path))
    require(expected is not None, "original profile binding missing")
    old_path = list(sys.path)
    try:
        sys.path.insert(0, str(scripts))
        profile = importlib.import_module(profile_name)
        require(Path(profile.__file__).absolute() == original_path, "profile import origin differs")
        # Follow only this frozen profile's module/function/class dependencies;
        # unrelated current diagnostic modules are not historical model sources.
        queue, visited = [profile], set()
        while queue:
            module = queue.pop()
            if id(module) in visited:
                continue
            visited.add(id(module))
            origin = getattr(module, "__file__", None)
            if not origin:
                continue
            file = Path(origin).absolute()
            if file.suffix == ".py" and (file.is_relative_to(project_root / "ml/ai-painter/src") or
                                         file.is_relative_to(project_root / "ml/ai-painter/scripts")):
                require(str(file) in verified_programs and capture.digest(file.read_bytes()) ==
                        verified_programs[str(file)], "unbound or stale original Python module")
                for value in vars(module).values():
                    dependency = value if isinstance(value, ModuleType) else sys.modules.get(getattr(value, "__module__", ""))
                    if isinstance(dependency, ModuleType):
                        queue.append(dependency)
        with torch.device("cpu"):
            return profile.fresh_networks(order)
    finally:
        sys.path[:] = old_path


@contextmanager
def _preserve_current_rng():
    saved = (random.getstate(), np.random.get_state(), torch.random.get_rng_state().clone())
    try:
        yield
    finally:
        random.setstate(saved[0])
        np.random.set_state(saved[1])
        torch.random.set_rng_state(saved[2])


def prepare_exact_failure_state(project_root, contract, *, resource=None):
    """No forward, differentiation, optimizer, CUDA or state/evidence writer."""
    started = time.monotonic()
    policy = deepcopy(contract)
    _validate_policy(policy)
    require(resource is None or callable(resource), "resource check must be callable")

    def check():
        require(time.monotonic() - started < 120 and torch.get_num_threads() <= 2,
                "CPU diagnostic deadline/thread limit")
        if resource is not None:
            resource()

    check()
    mapping = capture.RuntimeMap.current(project_root)
    # Policy is a fixed registry asset, not a caller-selected evidence resolver.
    policy_binding = {"path": POLICY_PATH, "sha256": POLICY_SHA}
    require(json.loads(mapping.binding(policy_binding)) == policy, "caller policy differs from fixed registered bytes")
    formal = policy["formalSpecification"]
    formal_raw = mapping.binding({key: formal[key] for key in ("path", "sha256")})
    require(b"AI-PAINTER-SPEC-1.62" in formal_raw, "normative specification version differs")
    values = {}
    for binding in policy["sourceEvidence"]:
        check()
        values[binding["path"]] = json.loads(mapping.binding(binding))
    terminal = values[SOURCE_ROOT + "worker-terminal.json"]
    manifest = values[SOURCE_ROOT + "gradient-failure/manifest.json"]
    primary = values[SOURCE_ROOT + "gradient-failure/primary.json"]
    identity = values[SOURCE_ROOT + "model-identity.json"]
    context = manifest["context"]
    require(terminal.get("schema") == "ecology-decode1-weight-quality-worker-terminal-v1" and
            terminal.get("status") == terminal.get("executionState") == "failed_closed" and
            terminal["runId"] == context["runId"] and terminal["failurePosition"] == context["failurePosition"] and
            terminal["executionPackage"] == context["executionPackage"] and
            terminal["originalError"] == primary["primaryError"], "original terminal/context/error differs")
    require(primary["timing"] == "after_exception" and primary["context"] == context and
            primary["primaryError"]["type"] == "ValueError" and
            primary["primaryError"]["message"] == "actual total gradient identity differs at parameter 60",
            "primary failure identity differs")
    require(manifest["schema"] == capture.SCHEMA and manifest["status"] == "captured" and
            manifest["stateTiming"] == "after_exception" and not manifest["missing"] and
            not manifest["nonfiniteTensorKeys"] and manifest["labels"] == list(capture.LABELS) and
            len(manifest["gradients"]) == 4 and set(manifest["networks"]) == {"generator", "discriminator"},
            "complete after_exception G/D evidence required")
    capture.validate_manifest(manifest)
    require(identity["graph"] == manifest["graph"] and len(identity["graph"]) == 108 and
            context["modelBinding"] == {"path": SOURCE_ROOT + "model-identity.json",
                "sha256": SOURCE_HASHES["model-identity.json"]} and
            identity["capabilityVersion"] == terminal["capabilityVersion"], "model identity/graph differs")
    require(context["sampleId"] == context["failurePosition"]["sampleId"] == SAMPLE_ID and
            context["split"] == context["sampleIdentity"]["split"] == "train" and
            context["sampleBindings"] == policy["sourceSampleBindings"], "train sample binding differs")
    receipt = terminal["captureReceipt"]
    require(receipt["status"] == "captured" and receipt["replayAllowed"] is False and
            receipt["qualificationAllowed"] is False and receipt["primaryError"] == primary["primaryError"],
            "source capture receipt differs")
    for role, suffix in (("manifest", "manifest.json"), ("primary", "primary.json"), ("tensors", "tensors.pt")):
        binding = receipt["artifacts"][role]
        require(binding["path"] == SOURCE_ROOT + "gradient-failure/" + suffix,
                "source capture artifact path differs")
        if role == "manifest":
            require(binding["sha256"] == SOURCE_HASHES["gradient-failure/manifest.json"], "manifest receipt SHA differs")
        else:
            require(binding == manifest["artifacts"][role], "capture artifact receipt differs")
    execution = json.loads(mapping.binding(manifest["executionBinding"]))
    require(execution["schema"] == "ecology-regime-failure-capture-execution-v1" and
            execution["runId"] == context["runId"] and execution["modelBinding"] == context["modelBinding"] and
            execution["programBindings"] == context["programBindings"], "capture execution binding differs")
    mapping.binding(context["executionPackage"])
    programs = context["programBindings"]
    verified_programs = {}
    python_bindings = {}
    for binding in programs.values():
        if not _is_original_python_source(binding["path"]):
            continue
        previous = python_bindings.setdefault(binding["path"], binding)
        require(previous == binding, "conflicting original Python binding")
    for binding in python_bindings.values():
        check()
        raw = mapping.binding(binding, maximum=1024**2)
        verified_programs[str(mapping.path(binding["path"]))] = capture.digest(raw)
    algorithms = policy["sourceAlgorithmBindings"]
    require(len(algorithms) == 5 and {item["role"] for item in algorithms} == ALGORITHM_ROLES,
            "original algorithm role set differs")
    for item in algorithms:
        require(item["binding"] == programs[item["role"]], "original algorithm binding differs")
    sample = context["sampleIdentity"]
    require(sample["sampleId"] == SAMPLE_ID and sample["image"] == context["sampleBindings"]["source"] and
            sample["conditionPack"] == context["sampleBindings"]["condition"], "source sample identity differs")
    mapping.binding(sample["image"], maximum=capture.MAX_CAPTURE)
    pack = json.loads(mapping.binding(sample["conditionPack"]))
    channels = [{key: channel[key] for key in ("id", "path", "sha256")} for channel in pack["channels"]]
    require(channels == sample["channels"] and len(channels) == len({c["id"] for c in channels}) == 23 and
            pack["worldId"] == sample["worldId"] and pack["tick"] == sample["tick"], "condition identity differs")
    archive = policy["sourceTensorArchive"]
    require(manifest["artifacts"]["tensors"] == archive, "archive manifest binding differs")
    check()
    raw = mapping.binding(_binding(archive), maximum=capture.MAX_CAPTURE)
    require(len(raw) == archive["bytes"], "archive byte size differs")
    tensors = capture.safe_load_bytes(raw, archive["sha256"], manifest)
    require(all(bool(torch.isfinite(value).all()) for value in tensors.values()), "nonfinite archive tensor")
    storages = [value.untyped_storage().data_ptr() for value in tensors.values() if value.numel()]
    require(len(set(storages)) == len(storages), "archive storage alias")
    with _preserve_current_rng():
        check()
        model, critic = _fresh_networks(mapping.project, [c["id"] for c in channels], verified_programs)
        capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
        named = tuple(model.named_parameters())
        target_module = model.get_submodule(TARGET_NAME.rsplit(".", 1)[0])
        require(named[60][0] == TARGET_NAME and tuple(named[60][1].shape) == (48, 48, 3, 3) and
                isinstance(target_module, torch.nn.Conv2d) and target_module.weight is named[60][1],
                "actual parameter60 module/weight differs")
        target_identity = {"parameterIndex": 60, "parameterName": TARGET_NAME,
            "moduleType": type(target_module).__module__ + "." + type(target_module).__qualname__,
            "parameterObjectId": id(named[60][1]), "moduleObjectId": id(target_module),
            "weightShape": list(named[60][1].shape), "dtype": str(named[60][1].dtype),
            "convolution": {key: getattr(target_module, key) for key in
                ("in_channels", "out_channels", "kernel_size", "stride", "padding", "dilation", "groups", "padding_mode")},
            "biasPresent": target_module.bias is not None}
        # Validate BOTH networks before modifying either fresh instance.
        for prefix, network in (("generator", model), ("discriminator", critic)):
            _state_plan(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
        all_state = [value for network in (model, critic) for value in
                     (*network.parameters(), *network.buffers()) if value.numel()]
        require(len({v.untyped_storage().data_ptr() for v in all_state}) == len(all_state),
                "cross-network state storage alias")
        state = {prefix: _restore_network(network, manifest["networks"][prefix], tensors,
                    manifest["tensorDescriptors"]) for prefix, network in (("generator", model), ("discriminator", critic))}
        check()
    # Revalidate all exact inputs after restoration; never substitute newer bytes.
    for binding in policy["sourceEvidence"] + [_binding(archive)] + list(python_bindings.values()) + list(context["sampleBindings"].values()):
        check()
        mapping.binding(binding, maximum=capture.MAX_CAPTURE)
    mapping.binding(policy_binding)
    mapping.binding({key: formal[key] for key in ("path", "sha256")})
    mapping.check()
    restoration = {"schemaVersion": "ai-painter-parameter60-causal-restore-receipt-v1",
        "status": "cpu_failure_state_restored_diagnostic_only", "policy": policy_binding,
        "stateTiming": "after_exception", "historicalReplayAllowed": False,
        "replayAllowed": False, "archivedRngRestored": False, "archivedGradientsInstalled": False,
        "requiresGradHistoricalClaim": False, "qualificationGranted": False,
        "qualification": deepcopy(policy["qualification"]), "counts": dict(COUNTS), "networks": state,
        "targetIdentity": target_identity,
        "historicalNonexecutedProgramBindings": {role: deepcopy(binding) for role, binding in programs.items()
            if not _is_original_python_source(binding["path"])},
        "elapsedSeconds": time.monotonic() - started}
    require(len(capture.json_bytes(restoration)) <= 8388608, "CPU receipt budget exceeded")
    return {"model": model, "critic": critic, "manifest": manifest, "receipt": restoration}
