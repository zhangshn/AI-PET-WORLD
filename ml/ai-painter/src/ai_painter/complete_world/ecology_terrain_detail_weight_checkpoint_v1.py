# TD-TRAIN-ENTRY-01-PY: independent terrain-detail identity, inherited frozen algorithms.
"""Independent 24-epoch quality checkpoint identity with strict CPU rollback.

The current v3 policy fixes training at 8400 seconds without resource overrides.
No optimizer/RNG resume,
source qualification, production registration or automatic retry is provided.
"""
from copy import deepcopy
import hashlib
import io
import json
import re
import zipfile

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1"
SCHEMA = "ecology-terrain-detail-weight-quality-checkpoint-v1"
CONFIGURATION_SCHEMA = "ecology-terrain-detail-weight-quality-configuration-v2"
CANDIDATE_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
SPEC_PATH = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
SPEC_SHA = "792bf647336eb59a3cdbe6b4efbe3e630724e810ba0afa125fb4d7cc350c2e19"
SPEC_VERSION = "AI-PAINTER-SPEC-1.69"
MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1"
LEGACY_CONFIGURATION_SCHEMA = "ecology-terrain-detail-weight-quality-configuration-v1"
LEGACY_SPECIFICATION = {"path": SPEC_PATH, "sha256": "e498205a12389ae33163606ab0e43183cea713716c6f51daaacb4a7067b5496a"}
EXECUTION_POLICY = {"path": "data/ai-painter/system-governance/ai-painter-terrain-detail-weight-quality-execution-policy-v3.json",
    "sha256": "4bea99e243a1f68806eb27f4c4da4cc3aad11c77f58956efbd34e583cb2eb1d2"}
MAX_BYTES = 64 * 1024 * 1024


def require(value, message):
    if not value:
        raise ValueError(message)


def components():
    import torch
    from ai_painter.complete_world import detail_weight_checkpoint_codec as strict
    from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import (
        validate_model_identity, ARCHITECTURE, NUMERIC_RULE,
    )
    # Only the predecessor's pure state helpers are reused, never its bindings.
    return torch, strict, validate_model_identity, ARCHITECTURE, NUMERIC_RULE


def exact_binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}
            and type(value["path"]) is str and bool(value["path"])
            and "\\" not in value["path"] and ":" not in value["path"]
            and all(part not in ("", ".", "..") for part in value["path"].split("/"))
            and type(value["sha256"]) is str and len(value["sha256"]) == 64
            and all(c in "0123456789abcdef" for c in value["sha256"]),
            "exact immutable checkpoint binding required")
    return value


def _json_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _same_json(actual, expected):
    # Plain equality accepts True == 1 and 1152.0 == 1152; identities must not.
    try:
        return _json_bytes(actual) == _json_bytes(expected)
    except (TypeError, ValueError):
        return False


def configuration_digest(configuration):
    return hashlib.sha256(_json_bytes(configuration)).hexdigest()


def expected_configuration(candidate_binding, *, legacy=False):
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    exact_binding(candidate_binding)
    require(candidate_binding == {"path": CANDIDATE_PATH,
        "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"},
        "quality source candidate differs")
    return {
        "schema": LEGACY_CONFIGURATION_SCHEMA if legacy else CONFIGURATION_SCHEMA,
        "capabilityVersion": MODEL_CAPABILITY if legacy else CAPABILITY,
        "sourceCandidate": dict(candidate_binding), "formalSpecification": dict(LEGACY_SPECIFICATION) if legacy else {"path": SPEC_PATH, "sha256": SPEC_SHA},
        "executionCeiling": {**original.RESOURCE_CEILING, "epochs": 12 if legacy else 24,
            "generatorOptimizerSteps": 576 if legacy else 1152, "discriminatorOptimizerSteps": 576 if legacy else 1152,
            "maxWallSeconds": 4200 if legacy else 8400},
        "checkpointSelection": {**original.SELECTION_CONTRACT, "eligibleEpochs": [12] if legacy else [24],
            **({} if legacy else {"observationOnlyEpochs": [12]})},
        "scope": {"resolution": [256, 192], "worldCount": 1,
            "subjectSampleId": original.SUBJECT_ID, "subjectSplit": "validation",
            "waterFactPresent": False, "buildingsRequired": False,
            "artificialRoadNetworkRequired": False, "personalityRequired": False,
            "formalStage4Qualification": False, "runtimePublication": False,
            "purpose": "single_bounded_quality_validation"},
        "dataUse": {"train": 48, "validation": 8, "challenge": 4, "regression": 4,
            "weightUpdatesFrom": ["train"], "checkpointSelectionFrom": ["validation"],
            "challengeAndRegressionContentRead": False, "sourceImageOrSplitMutation": False},
        "seed": 20260929, "gpuAdmissionSeconds": 600, "freshInitializationOnly": True,
        "historicalCheckpointMayInitialize": False, "automaticResumeAllowed": False,
        "optimizer": deepcopy(original.v24.core.TRAINING["optimizer"]),
        "captureMiB": 64, "captureMetadataReserveBytes": 1048576, "terminalReserveBytes": 65536,
    }


def derive_configuration(reader, candidate_binding, specification_binding):
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    expected = expected_configuration(candidate_binding)
    require(_same_json(specification_binding, expected["formalSpecification"]), "quality formal binding differs")
    raw = reader.read(specification_binding)
    require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == SPEC_SHA
        and b"AI-PAINTER-SPEC-1.69" in raw and b"17.1" in raw
        and b"ai-painter-terrain-detail-weight-quality-execution-policy-v3.json" in raw, "quality formal bytes differ")
    candidate_raw = reader.read(candidate_binding)
    require(type(candidate_raw) is bytes and hashlib.sha256(candidate_raw).hexdigest() == candidate_binding["sha256"],
        "quality candidate bytes differ")
    original.validate_candidate_contract(json.loads(candidate_raw))
    validate_configuration(expected)
    policy_raw = reader.read(EXECUTION_POLICY)
    require(type(policy_raw) is bytes and hashlib.sha256(policy_raw).hexdigest() == EXECUTION_POLICY["sha256"],
        "current execution policy bytes differ")
    validate_execution_policy(json.loads(policy_raw), expected)
    reader.unchanged()
    return expected


def validate_configuration(configuration, *, allow_legacy=False):
    require(type(configuration) is dict and "sourceCandidate" in configuration, "quality configuration required")
    legacy = allow_legacy and configuration.get("schema") == LEGACY_CONFIGURATION_SCHEMA
    require(_same_json(configuration, expected_configuration(configuration["sourceCandidate"], legacy=legacy)),
        "normative quality configuration differs")


def validate_execution_policy(policy, configuration):
    """Check the actual pinned current policy against the unchanged source config."""
    validate_configuration(configuration)
    require(type(policy) is dict and set(policy) == {"schemaVersion", "status", "formalSpecification",
        "candidate", "modelCapability", "executionProfile", "entrypointPath", "outputRoot", "sourceCandidate",
        "priorCpuEvidence", "modelBoundary", "scope", "dataUse", "executionCeiling", "phaseResources",
        "gpuAdmission", "optimizer", "checkpointSelection", "stopRules", "qualification"}, "current policy fields differ")
    expected = {
        "schemaVersion": "ai-painter-terrain-detail-weight-quality-execution-policy-v3",
        "status": "registered_bounded_candidate_route_not_qualified",
        "formalSpecification": {**configuration["formalSpecification"], "version": SPEC_VERSION},
        "candidate": CAPABILITY, "modelCapability": MODEL_CAPABILITY,
        "executionProfile": "bounded_ecology_terrain_detail_weight_quality24_v1",
        "entrypointPath": "scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs",
        "outputRoot": ".runtime/ai-painter/ecology-terrain-detail-weight-quality-executions",
        "sourceCandidate": configuration["sourceCandidate"],
        "modelBoundary": {"parameterCount": 108, "parameterElements": 2242687, "changedTargetIndex": 60,
            "changedTargetName": "core.core.terrain.full_resolution_detail.layers.3.weight",
            "targetShape": [48, 48, 3, 3], "parentTarget52Kept": True,
            "nativeForwardAndInputBiasGradientsKept": True, "otherLayersMayChange": False,
            "initializationSeed": configuration["seed"], "freshInitializationOnly": configuration["freshInitializationOnly"],
            "historicalCheckpointMayInitialize": configuration["historicalCheckpointMayInitialize"], "failedStateMayInitialize": False},
        "scope": {key: configuration["scope"][key] for key in ("resolution", "worldCount", "waterFactPresent",
            "buildingsRequired", "artificialRoadNetworkRequired", "personalityRequired", "formalStage4Qualification", "runtimePublication")},
        "dataUse": configuration["dataUse"], "executionCeiling": configuration["executionCeiling"],
        "phaseResources": {"cpuPreparationSeconds": 240, "gpuAdmissionSeconds": configuration["gpuAdmissionSeconds"],
            "reviewSeconds": 120, "maxStreamBytes": 8388608, "cpuOutputBytes": 8388608,
            "qualificationAndReviewOutputBytes": 16777216, "captureMiB": configuration["captureMiB"],
            "captureMetadataReserveBytes": configuration["captureMetadataReserveBytes"],
            "terminalReserveBytes": configuration["terminalReserveBytes"], "programFileCountMaximum": 256,
            "programFileBytesMaximum": 1048576, "totalProgramBytesMaximum": 16777216},
        "gpuAdmission": {"sampleSplit": "train", "sampleCount": configuration["dataUse"]["train"],
            "optimizerConstruction": 0, "optimizerUpdates": 0, "samePackageRequired": True,
            "stateBytesMustRemainUnchanged": True, "originalGradientGateKept": True, "oldCandidateQualificationReusable": False},
        "optimizer": configuration["optimizer"],
        "checkpointSelection": {"eligibleEpochs": configuration["checkpointSelection"]["eligibleEpochs"],
            "strictNewCandidateReloadRequired": True, "automaticResumeAllowed": configuration["automaticResumeAllowed"],
            "observationOnlyEpochs": configuration["checkpointSelection"]["observationOnlyEpochs"]},
        "qualification": {key: False for key in ("gpuQualified", "trainingQualified", "visualQualified", "stage4Qualified",
            "capabilityReleased", "runtimeFrameAllowed")},
    }
    for key, value in expected.items():
        require(_same_json(policy.get(key), value), "current policy/config differs: " + key)
    history = policy["priorCpuEvidence"]
    require(type(history) is dict and set(history) == {"acceptance", "terminal", "normativeVersion",
        "originalNormativeBytes", "oldAttemptReplayAllowed", "grantsGpuOrTrainingQualification"}
        and history["normativeVersion"] == "AI-PAINTER-SPEC-1.66"
        and history["oldAttemptReplayAllowed"] is False and history["grantsGpuOrTrainingQualification"] is False,
        "historical CPU evidence cannot grant current execution qualification")
    for key in ("acceptance", "terminal", "originalNormativeBytes"):
        exact_binding(history[key])
    require(type(policy["stopRules"]) is list and len(policy["stopRules"]) == 7
        and all(type(value) is str and value for value in policy["stopRules"]), "current policy stop rules differ")
    return policy


def validate_selection(configuration, run_id, epoch, selection, counts, *, allow_legacy=False):
    import ecology_quality_ranking_v1 as original
    validate_configuration(configuration, allow_legacy=allow_legacy)
    final_epoch = 12 if configuration["schema"] == LEGACY_CONFIGURATION_SCHEMA else 24
    require(type(selection) is dict and set(selection) == {
        "epoch", "worstApplicableObjectCorrelation", "meanValidationRgbMae", "applicableImageCounts",
        "rank", "qualificationGranted", "checkpointPromotionEligible",
    }, "complete checkpoint selection fields differ")
    original._validated_rank(selection, eligible_epochs=(final_epoch,))
    require(type(epoch) is int and epoch == final_epoch
            and type(selection["epoch"]) is int and selection["epoch"] == epoch
            and _same_json(selection["rank"], [selection["worstApplicableObjectCorrelation"],
                                               -selection["meanValidationRgbMae"], -epoch])
            and type(counts) is dict and set(counts) == {"generator", "discriminator"}
            and all(type(value) is int for value in counts.values())
            and counts == {"generator": epoch * 48, "discriminator": epoch * 48}
            and type(run_id) is str and bool(run_id.strip()),
            "normative epoch/rank/actual counts/Run differs")


def _graph(network):
    named = tuple(network.named_parameters(remove_duplicate=False))
    require(len(named) == len({id(p) for _, p in named})
            == len({p.untyped_storage().data_ptr() for _, p in named}),
            "checkpoint parameter aliases differ")
    return [{"name": n, "shape": list(p.shape), "dtype": str(p.dtype)} for n, p in named]


def _references(model, critic):
    torch, _, validate, _, _ = components()
    from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import (
        build_fresh_object_ecology_terrain_detail_weight_precision,
    )
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator,
    )
    validate(model)
    # Recompute the canonical full graph; caller flags and stored graph claims
    # cannot establish identity. Factories restore CPU RNG and never run forward.
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        fresh = build_fresh_object_ecology_terrain_detail_weight_precision(
            condition_channel_order=model.condition_channel_order)
        fresh_critic = build_conditional_texture_discriminator()
    require(_graph(model) == _graph(fresh), "generator full graph differs")
    require(type(critic) is type(fresh_critic) and _graph(critic) == _graph(fresh_critic),
            "discriminator full graph differs")
    def modules(network):
        keys = ("in_channels", "out_channels", "kernel_size", "stride", "padding", "dilation", "groups",
                "padding_mode", "num_groups", "num_channels", "eps", "inplace", "negative_slope")
        return tuple((name, type(module), tuple((key, getattr(module, key)) for key in keys if hasattr(module, key)))
                     for name, module in network.named_modules(remove_duplicate=False))
    require(modules(critic) == modules(fresh_critic), "discriminator module types/configuration differ")
    return fresh.state_dict(), fresh_critic.state_dict()


def _state(state, reference, label):
    torch, strict, _, _, _ = components()
    result = strict._state(state, reference, label)
    require(all(type(value) is torch.Tensor and value.is_contiguous() for value in state.values()),
            label + " contiguous state required")
    return result


def _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding, *, allow_legacy=False):
    _, _, _, architecture, numeric = components()
    validate_selection(configuration, run_id, epoch, selection, counts, allow_legacy=allow_legacy)
    exact_binding(package_binding)
    exact_binding(dataset_binding)
    exact_binding(plan_binding)
    require(plan_binding["path"].endswith("/quality-plan.json"), "quality plan identity required")
    require(type(program_bindings) is dict and 1 <= len(program_bindings) <= 256, "quality source roles required")
    for binding in program_bindings.values():
        exact_binding(binding)
    return {
        "schema": SCHEMA, "capabilityVersion": configuration["capabilityVersion"], "architecture": architecture, "numericRule": numeric,
        "configuration": deepcopy(configuration), "configurationSha256": configuration_digest(configuration),
        "runId": run_id, "executionPackage": dict(package_binding), "datasetManifest": dict(dataset_binding),
        "epoch": epoch, "selection": deepcopy(selection), "counts": dict(counts),
        "programBindings": deepcopy(program_bindings), "planBinding": dict(plan_binding),
        "automaticResumeAllowed": False, "checkpointQualified": False,
    }


def encode(model, critic, *, configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding):
    torch, _, _, _, _ = components()
    payload = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding)
    g_reference, d_reference = _references(model, critic)
    gs = {n: v.detach().cpu().clone() for n, v in model.state_dict().items()}
    ds = {n: v.detach().cpu().clone() for n, v in critic.state_dict().items()}
    payload.update(graph={"generator": _graph(model), "discriminator": _graph(critic)},
                   generator=_state(gs, g_reference, "generator"),
                   discriminator=_state(ds, d_reference, "discriminator"))
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    require(buffer.tell() <= MAX_BYTES, "checkpoint byte budget exhausted")
    return buffer.getvalue()


def reload(raw, *, model, critic, configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding):
    """Preflight both complete states, install strictly, verify bytes or rollback."""
    torch, strict, validate, _, _ = components()
    expected = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding,
        allow_legacy=True)  # Decoding only; encode/admission still reject every old configuration.
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES, "checkpoint source byte bound invalid")
    require(all(value.device.type == "cpu" for network in (model, critic)
                for value in (*network.parameters(), *network.buffers())),
            "strict reload destinations must be CPU")
    validate(model)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) <= 2048 and len({entry.filename for entry in entries}) == len(entries), "checkpoint ZIP duplicate/member budget")
        require(sum(entry.file_size for entry in entries) <= MAX_BYTES and all(entry.compress_type == zipfile.ZIP_STORED
            and not entry.flag_bits & 1 and re.fullmatch(r"archive/(?:data/[0-9]+|data\.pkl|byteorder|version|\.data/serialization_id|\.format_version|\.storage_alignment)", entry.filename)
            and (not entry.filename.endswith("data.pkl") or entry.file_size <= 2097152) for entry in entries),
            "checkpoint unsafe/compressed/oversized ZIP")
    payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
    require(type(payload) is dict and set(payload) == set(expected) | {"generator", "discriminator", "graph"}
            and _same_json({key: payload[key] for key in expected}, expected),
            "checkpoint source/Run/config/counts binding differs")
    g_reference, d_reference = _references(model, critic)
    require(_same_json(payload["graph"], {"generator": _graph(model), "discriminator": _graph(critic)}),
            "checkpoint graph differs")
    gs = _state(payload["generator"], g_reference, "generator")
    ds = _state(payload["discriminator"], d_reference, "discriminator")
    # Capture original storage before invoking any loader. Recovery never calls
    # load_state_dict again, including when a post-load hook raises after writes.
    targets = [dict(network.state_dict()) for network in (model, critic)]
    saved = [{name: value.detach().clone() for name, value in state.items()} for state in targets]
    snapshots = [_installation_snapshot(network) for network in (model, critic)]
    try:
        model.load_state_dict(gs, strict=True)
        critic.load_state_dict(ds, strict=True)
        for network, snapshot in zip((model, critic), snapshots):
            _require_original_storage(network, snapshot)
        validate(model)
        strict._require_installed_state(model, gs, "generator")
        strict._require_installed_state(critic, ds, "discriminator")
    except BaseException as primary:
        errors = []
        for label, network, target, previous, snapshot in zip(("generator", "discriminator"), (model, critic), targets, saved, snapshots):
            try:
                _restore_installation(network, snapshot)
                with torch.no_grad():
                    for name, value in target.items():
                        value.copy_(previous[name])
                require(all(torch.equal(value.reshape(-1).view(torch.uint8),
                                        previous[name].reshape(-1).view(torch.uint8))
                            for name, value in target.items()), label + " rollback bytes differ")
                strict._require_installed_state(network, previous, label + " rollback")
            except BaseException as secondary:
                errors.append(label + ": " + str(secondary))
        if errors:
            primary.secondary_checkpoint_restore_errors = errors
        raise
    return {"modelStateLoaded": True, "automaticResumeAllowed": False, "checkpointQualified": False}


def _storage_identity(value):
    storage = value.untyped_storage()
    return (storage._cdata, storage.data_ptr(), storage.nbytes(), value.storage_offset(), tuple(value.stride()))


def _installation_snapshot(network):
    parameters, buffers = tuple(network.parameters()), tuple(network.buffers())
    return {"parameters": parameters, "buffers": buffers,
        "modules": [(module, module._modules.copy(), module._parameters.copy(), module._buffers.copy(), module.training)
                    for module in network.modules()],
        "data": [(value, value.detach(), _storage_identity(value)) for value in (*parameters, *buffers)],
        "gradients": [(value, value.requires_grad, value.grad, None if value.grad is None else value.grad.detach().clone())
                      for value in parameters]}


def _require_original_storage(network, snapshot):
    require(tuple(network.parameters()) and len(tuple(network.parameters())) == len(snapshot["parameters"])
        and all(left is right for left, right in zip(network.parameters(), snapshot["parameters"]))
        and len(tuple(network.buffers())) == len(snapshot["buffers"])
        and all(left is right for left, right in zip(network.buffers(), snapshot["buffers"])), "checkpoint replaced original G/D objects")
    require(all(_storage_identity(value) == identity for value, original, identity in snapshot["data"]),
            "checkpoint rebound original G/D storage")


def _restore_installation(network, snapshot):
    torch, _, _, _, _ = components()
    for module, children, parameters, buffers, training in snapshot["modules"]:
        module._modules, module._parameters, module._buffers, module.training = children, parameters, buffers, training
    with torch.no_grad():
        for value, original, identity in snapshot["data"]:
            value.data = original
        for value, needed, gradient, previous in snapshot["gradients"]:
            value.requires_grad_(needed)
            value.grad = gradient
            if gradient is not None:
                gradient.copy_(previous)
    _require_original_storage(network, snapshot)
