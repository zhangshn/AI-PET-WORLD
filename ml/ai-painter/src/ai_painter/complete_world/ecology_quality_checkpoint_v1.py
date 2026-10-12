"""Independent 12-epoch quality checkpoint identity with strict CPU rollback.

The 2700-second source configuration remains frozen. A future execution adapter
must authenticate any resource successor separately. No optimizer/RNG resume,
source qualification, production registration or automatic retry is provided.
"""
from copy import deepcopy
import hashlib
import io
import json

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_quality_v1"
SCHEMA = "ecology-regime-quality-checkpoint-v1"
CONFIGURATION_SCHEMA = "ecology-regime-quality-configuration-v1"
CANDIDATE_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
SPEC_PATH = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
SPEC_SHA = "41c000f8b0dff28184bd1ccd0d584d10916824ad61f85054aae110dc71d42a51"
MAX_BYTES = 64 * 1024 * 1024


def require(value, message):
    if not value:
        raise ValueError(message)


def components():
    import torch
    from ai_painter.complete_world import detail_weight_checkpoint_codec as strict
    from ai_painter.complete_world.object_ecology_regime_conditioned import (
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


def expected_configuration(candidate_binding):
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    exact_binding(candidate_binding)
    require(candidate_binding == {"path": CANDIDATE_PATH,
        "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"},
        "quality source candidate differs")
    return {
        "schema": CONFIGURATION_SCHEMA, "capabilityVersion": CAPABILITY,
        "sourceCandidate": dict(candidate_binding), "formalSpecification": {"path": SPEC_PATH, "sha256": SPEC_SHA},
        "executionCeiling": {**original.RESOURCE_CEILING, "epochs": 12,
            "generatorOptimizerSteps": 576, "discriminatorOptimizerSteps": 576},
        "checkpointSelection": {**original.SELECTION_CONTRACT, "eligibleEpochs": [12]},
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
        and b"AI-PAINTER-SPEC-1.58" in raw and b"9.6.40" in raw, "quality formal bytes differ")
    candidate_raw = reader.read(candidate_binding)
    require(type(candidate_raw) is bytes and hashlib.sha256(candidate_raw).hexdigest() == candidate_binding["sha256"],
        "quality candidate bytes differ")
    original.validate_candidate_contract(json.loads(candidate_raw))
    validate_configuration(expected)
    reader.unchanged()
    return expected


def validate_configuration(configuration):
    require(type(configuration) is dict and "sourceCandidate" in configuration, "quality configuration required")
    require(_same_json(configuration, expected_configuration(configuration["sourceCandidate"])),
        "normative quality configuration differs")


def validate_selection(configuration, run_id, epoch, selection, counts):
    import ecology_quality_ranking_v1 as original
    validate_configuration(configuration)
    require(type(selection) is dict and set(selection) == {
        "epoch", "worstApplicableObjectCorrelation", "meanValidationRgbMae", "applicableImageCounts",
        "rank", "qualificationGranted", "checkpointPromotionEligible",
    }, "complete checkpoint selection fields differ")
    original._validated_rank(selection, eligible_epochs=(12,))
    require(type(epoch) is int and epoch == 12
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
    from ai_painter.complete_world.object_ecology_regime_conditioned import (
        build_fresh_object_ecology_regime_conditioned,
    )
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator,
    )
    validate(model)
    # Recompute the canonical full graph; caller flags and stored graph claims
    # cannot establish identity. Factories restore CPU RNG and never run forward.
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        fresh = build_fresh_object_ecology_regime_conditioned(
            condition_channel_order=model.condition_channel_order)
        fresh_critic = build_conditional_texture_discriminator()
    require(_graph(model) == _graph(fresh), "generator full graph differs")
    require(type(critic) is type(fresh_critic) and _graph(critic) == _graph(fresh_critic),
            "discriminator full graph differs")
    return fresh.state_dict(), fresh_critic.state_dict()


def _state(state, reference, label):
    torch, strict, _, _, _ = components()
    result = strict._state(state, reference, label)
    require(all(type(value) is torch.Tensor and value.is_contiguous() for value in state.values()),
            label + " contiguous state required")
    return result


def _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding):
    _, _, _, architecture, numeric = components()
    validate_selection(configuration, run_id, epoch, selection, counts)
    exact_binding(package_binding)
    exact_binding(dataset_binding)
    exact_binding(plan_binding)
    require(plan_binding["path"].endswith("/quality-plan.json"), "quality plan identity required")
    require(type(program_bindings) is dict and 1 <= len(program_bindings) <= 256, "quality source roles required")
    for binding in program_bindings.values():
        exact_binding(binding)
    return {
        "schema": SCHEMA, "capabilityVersion": CAPABILITY, "architecture": architecture, "numericRule": numeric,
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
    expected = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts, program_bindings, plan_binding)
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES, "checkpoint source byte bound invalid")
    require(all(value.device.type == "cpu" for network in (model, critic)
                for value in (*network.parameters(), *network.buffers())),
            "strict reload destinations must be CPU")
    validate(model)
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
    try:
        model.load_state_dict(gs, strict=True)
        critic.load_state_dict(ds, strict=True)
        validate(model)
        strict._require_installed_state(model, gs, "generator")
        strict._require_installed_state(critic, ds, "discriminator")
    except BaseException as primary:
        errors = []
        for label, network, target, previous in zip(("generator", "discriminator"), (model, critic), targets, saved):
            try:
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
