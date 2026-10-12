"""Managed plan authority and strict CPU checkpoints for the detail successor.

No historical checkpoint input can initialize training. The frozen state codec
supplies only pure graph/state validation helpers, never its legacy plan binding.
"""
from copy import deepcopy
import hashlib
import io
import json

CAPABILITY = "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"
SCHEMA = "detail-weight-managed-checkpoint-v1"
CANDIDATE_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
SPEC_PATH = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
SPEC_SHA = "b7a15e6bab4733fc7b9311d3625d047c5a222ae69e3c2024745ef23b41367600"


def require(value, message):
    if not value: raise ValueError(message)


def components():
    import torch
    from ai_painter.complete_world import detail_weight_checkpoint_codec as strict
    from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import validate_model_identity, ARCHITECTURE, NUMERIC_RULE
    return torch, strict, validate_model_identity, ARCHITECTURE, NUMERIC_RULE


def derive_configuration(reader, candidate_binding, specification_binding):
    """Recompute the actual plan from immutable normative source bytes."""
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    require(candidate_binding["path"] == CANDIDATE_PATH and specification_binding == {"path": SPEC_PATH, "sha256": SPEC_SHA}, "configuration authority differs")
    candidate = reader.json(candidate_binding); original.validate_candidate_contract(candidate)
    spec = reader.read(specification_binding)
    require(b"AI-PAINTER-SPEC-1.50" in spec and b"9.6.35" in spec, "managed formal specification differs")
    configuration = {"schema": "detail-weight-managed-configuration-v1", "capabilityVersion": CAPABILITY,
        "sourceCandidate": dict(candidate_binding), "formalSpecification": dict(specification_binding),
        "executionCeiling": deepcopy(candidate["executionCeiling"]), "checkpointSelection": deepcopy(candidate["checkpointSelection"]),
        "scope": deepcopy(candidate["scope"]), "dataUse": deepcopy(candidate["dataUse"]), "seed": 20260929,
        "gpuAdmissionSeconds": 600, "freshInitializationOnly": True,
        "historicalCheckpointMayInitialize": False, "automaticResumeAllowed": False,
        "optimizer": deepcopy(original.v24.core.TRAINING["optimizer"])}
    reader.unchanged()
    return configuration


def exact_binding(value):
    require(type(value) is dict and set(value) == {"path","sha256"} and type(value["path"]) is str and value["path"]
        and "\\" not in value["path"] and ":" not in value["path"] and all(v not in ("",".","..") for v in value["path"].split("/"))
        and type(value["sha256"]) is str and len(value["sha256"]) == 64 and all(c in "0123456789abcdef" for c in value["sha256"]), "exact immutable checkpoint binding required")
    return value


def configuration_digest(config):
    return hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def validate_configuration(configuration):
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    exact_binding(configuration.get("sourceCandidate")); exact_binding(configuration.get("formalSpecification"))
    require(type(configuration) is dict and set(configuration) == {"schema", "capabilityVersion", "sourceCandidate", "formalSpecification",
        "executionCeiling", "checkpointSelection", "scope", "dataUse", "seed", "gpuAdmissionSeconds", "freshInitializationOnly",
        "historicalCheckpointMayInitialize", "automaticResumeAllowed", "optimizer"}, "complete managed configuration fields differ")
    require(configuration["schema"] == "detail-weight-managed-configuration-v1" and configuration["capabilityVersion"] == CAPABILITY
            and configuration["executionCeiling"] == original.RESOURCE_CEILING
            and configuration["checkpointSelection"] == original.SELECTION_CONTRACT
            and type(configuration["seed"]) is int and configuration["seed"] == 20260929
            and type(configuration["gpuAdmissionSeconds"]) is int and configuration["gpuAdmissionSeconds"] == 600
            and configuration["freshInitializationOnly"] is True and configuration["historicalCheckpointMayInitialize"] is False
            and configuration["automaticResumeAllowed"] is False and configuration["optimizer"] == original.v24.core.TRAINING["optimizer"]
            and configuration["formalSpecification"] == {"path": SPEC_PATH, "sha256": SPEC_SHA}
            and configuration["sourceCandidate"].get("path") == CANDIDATE_PATH,
            "normative managed configuration differs")
    require(configuration["scope"].get("resolution") == [256, 192]
            and configuration["scope"].get("subjectSampleId") == original.SUBJECT_ID
            and configuration["scope"].get("formalStage4Qualification") is False and configuration["scope"].get("runtimePublication") is False
            and configuration["dataUse"] == {"train": 48, "validation": 8, "challenge": 4, "regression": 4,
                "weightUpdatesFrom": ["train"], "checkpointSelectionFrom": ["validation"],
                "challengeAndRegressionContentRead": False, "sourceImageOrSplitMutation": False}, "normative data/scope differs")


def validate_selection(configuration, run_id, epoch, selection, counts):
    import painter_stage4_v24_dry_single_world_checkpoint_worker as original
    validate_configuration(configuration); original._validated_rank(selection)
    require(type(epoch) is int and epoch in (24,36,48) and selection["epoch"] == epoch
            and type(counts) is dict and set(counts) == {"generator", "discriminator"}
            and all(type(value) is int for value in counts.values())
            and counts == {"generator": epoch*48, "discriminator": epoch*48}
            and type(run_id) is str and bool(run_id.strip()), "normative epoch/rank/actual counts/Run differs")


def encode(model, critic, *, configuration, run_id, package_binding, dataset_binding, epoch, selection, counts):
    torch, strict, validate, architecture, numeric = components()
    validate(model); validate_selection(configuration, run_id, epoch, selection, counts)
    exact_binding(package_binding); exact_binding(dataset_binding)
    # Live GPU states may be copied to CPU, but no destination network is touched.
    gs = {n: v.detach().cpu().clone() for n, v in model.state_dict().items()}
    ds = {n: v.detach().cpu().clone() for n, v in critic.state_dict().items()}
    gs = strict._state(gs, gs, "generator")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
        reference = build_conditional_texture_discriminator()
    require(type(critic) is type(reference) and strict._graph(critic)==strict._graph(reference), "live discriminator graph differs")
    ds = strict._state(ds, reference.state_dict(), "discriminator")
    payload = {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "architecture": architecture, "numericRule": numeric,
        "configuration": deepcopy(configuration), "configurationSha256": configuration_digest(configuration),
        "runId": run_id, "executionPackage": dict(package_binding), "datasetManifest": dict(dataset_binding),
        "epoch": epoch, "selection": deepcopy(selection), "counts": dict(counts),
        "graph": {"generator": strict._graph(model), "discriminator": strict._graph(critic)},
        "generator": gs, "discriminator": ds, "automaticResumeAllowed": False, "checkpointQualified": False}
    buffer = io.BytesIO(); torch.save(payload, buffer)
    require(buffer.tell() <= 64 * 1024 * 1024, "checkpoint byte budget exhausted")
    return buffer.getvalue()


def reload(raw, *, model, critic, configuration, run_id, package_binding, dataset_binding, epoch, selection, counts):
    """All G/D payloads preflight before writes; exact bytes verified afterward."""
    torch, strict, validate, architecture, numeric = components()
    validate(model); validate_selection(configuration, run_id, epoch, selection, counts)
    exact_binding(package_binding); exact_binding(dataset_binding)
    require(type(raw) is bytes and 0 < len(raw) <= 64 * 1024 * 1024, "checkpoint source byte bound invalid")
    payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
    expected = {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "architecture": architecture, "numericRule": numeric,
        "configuration": configuration, "configurationSha256": configuration_digest(configuration), "runId": run_id,
        "executionPackage": package_binding, "datasetManifest": dataset_binding, "epoch": epoch,
        "selection": selection, "counts": counts, "automaticResumeAllowed": False, "checkpointQualified": False}
    require(type(payload) is dict and set(payload) == set(expected) | {"generator", "discriminator", "graph"}
            and all(payload.get(key) == value for key, value in expected.items()), "checkpoint source/Run/config/counts binding differs")
    require(all(p.device.type == "cpu" for network in (model, critic) for p in network.parameters()), "strict reload destinations must be CPU")
    require(payload["graph"] == {"generator": strict._graph(model), "discriminator": strict._graph(critic)}, "checkpoint graph differs")
    gs = strict._state(payload["generator"], model.state_dict(), "generator")
    ds = strict._state(payload["discriminator"], strict._critic(critic), "discriminator")
    old = [{n: v.detach().clone() for n, v in network.state_dict().items()} for network in (model, critic)]
    try:
        model.load_state_dict(gs, strict=True); critic.load_state_dict(ds, strict=True)
        validate(model); strict._require_installed_state(model, gs, "generator"); strict._require_installed_state(critic, ds, "discriminator")
    except BaseException as primary:
        for network, previous in zip((model, critic), old):
            try:
                with torch.no_grad():
                    for name, value in network.state_dict().items(): value.copy_(previous[name])
            except BaseException as secondary:
                primary.secondary_checkpoint_restore_error = str(secondary)
        raise
    return {"modelStateLoaded": True, "automaticResumeAllowed": False, "checkpointQualified": False}
