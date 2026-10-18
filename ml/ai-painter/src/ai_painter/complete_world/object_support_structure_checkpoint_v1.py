"""Inactive support-Loss checkpoint identity; strict complete-state CPU reload.

Existing state/rollback helpers are reused, never the old checkpoint metadata or
execution permission. In-memory synthetic tests do not grant model qualification.
"""
from copy import deepcopy
import hashlib
import io
import re
import zipfile

from ai_painter.complete_world import ecology_terrain_detail_weight_checkpoint_v1 as parent

CAPABILITY = "stage4_mvp256_dry_object_support_structure_quality24_v1"
MODEL_CAPABILITY = parent.MODEL_CAPABILITY
SCHEMA = "object-support-structure-quality-checkpoint-v1"
CONFIGURATION_SCHEMA = "object-support-structure-quality-configuration-v1"
EXECUTION_QUALIFIED = False
MAX_BYTES = parent.MAX_BYTES
POLICY = {"path": "data/ai-painter/system-governance/ai-painter-object-support-structure-lifecycle-integration-policy-v1.json",
    "sha256": "7782b99aa6f04c56a14a2f35694c4e67c99911835bc62e1096f25ac3424d17d3"}
LOSS = {"path": "data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json",
    "sha256": "f5842c5005a60a2c51dd84f9baca1d4ecc751a5fed09e8647f7d96acd4efaefe"}
GRADIENT = {"path": "data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json",
    "sha256": "2aa89a112ebc125e9b4bfdea8f7adade22f1d57afb094d1d4b4f1cff36293d82"}
SOURCE_ASSETS = {"path": parent.CANDIDATE_PATH,
    "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"}
exact_binding = parent.exact_binding
configuration_digest = parent.configuration_digest
require = parent.require
_same_json = parent._same_json


def _source_configuration():
    """Pure frozen asset/schedule template, not the predecessor's permission."""
    return parent.expected_configuration(SOURCE_ASSETS)


def expected_configuration():
    configuration = _source_configuration()
    del configuration["sourceCandidate"]
    configuration.update(schema=CONFIGURATION_SCHEMA, capabilityVersion=CAPABILITY,
        modelCapabilityVersion=MODEL_CAPABILITY, integrationPolicy=dict(POLICY),
        lossDefinition=dict(LOSS), gradientDefinition=dict(GRADIENT),
        sourceAssetsCandidate=dict(SOURCE_ASSETS),
        sourceAssetsUse="data_review_and_base_schedule_only_not_execution_qualification")
    return configuration


def validate_configuration(configuration):
    require(_same_json(configuration, expected_configuration()), "support configuration identity differs")


def derive_configuration(reader):
    """Rehash current source contracts; never use a caller's qualified boolean."""
    for binding in (POLICY, LOSS, GRADIENT, SOURCE_ASSETS, expected_configuration()["formalSpecification"]):
        raw = reader.read(binding)
        require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == binding["sha256"],
            "support contract bytes differ: " + binding["path"])
    reader.unchanged()
    return expected_configuration()


def validate_selection(configuration, run_id, epoch, selection, counts):
    validate_configuration(configuration)
    # Reuse only its numeric rank/24x48 validator; metadata below has a new identity.
    parent.validate_selection(_source_configuration(), run_id, epoch, selection, counts)


def _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding):
    validate_selection(configuration, run_id, epoch, selection, counts)
    for binding in (package_binding, dataset_binding, plan_binding):
        exact_binding(binding)
    require(plan_binding["path"].endswith("/quality-plan.json"), "support plan binding differs")
    require(type(program_bindings) is dict and 1 <= len(program_bindings) <= 256, "support source role ceiling")
    by_path = {}
    for binding in program_bindings.values():
        exact_binding(binding)
        require(binding["path"] not in by_path or by_path[binding["path"]] == binding["sha256"],
            "one source path has conflicting identities")
        by_path[binding["path"]] = binding["sha256"]
    _, _, _, architecture, numeric = parent.components()
    return {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "modelCapabilityVersion": MODEL_CAPABILITY,
        "architecture": architecture, "numericRule": numeric,
        "configuration": deepcopy(configuration), "configurationSha256": configuration_digest(configuration),
        "runId": run_id, "executionPackage": dict(package_binding), "datasetManifest": dict(dataset_binding),
        "epoch": epoch, "selection": deepcopy(selection), "counts": dict(counts),
        "programBindings": deepcopy(program_bindings), "planBinding": dict(plan_binding),
        "automaticResumeAllowed": False, "checkpointQualified": False}


def encode(model, critic, *, configuration, run_id, package_binding, dataset_binding, epoch,
        selection, counts, program_bindings, plan_binding):
    torch, _, _, _, _ = parent.components()
    payload = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding)
    g_reference, d_reference = parent._references(model, critic)
    payload.update(graph={"generator": parent._graph(model), "discriminator": parent._graph(critic)},
        generator=parent._state({n: v.detach().cpu().clone() for n, v in model.state_dict().items()}, g_reference, "generator"),
        discriminator=parent._state({n: v.detach().cpu().clone() for n, v in critic.state_dict().items()}, d_reference, "discriminator"))
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    require(buffer.tell() <= MAX_BYTES, "support checkpoint byte ceiling")
    return buffer.getvalue()


def reload(raw, *, model, critic, configuration, run_id, package_binding, dataset_binding, epoch,
        selection, counts, program_bindings, plan_binding):
    torch, strict, validate, _, _ = parent.components()
    expected = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding)
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES, "support checkpoint byte ceiling")
    require(all(v.device.type == "cpu" for network in (model, critic)
        for v in (*network.parameters(), *network.buffers())), "support reload requires CPU destinations")
    validate(model)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) <= 2048 and len({e.filename for e in entries}) == len(entries), "unsafe checkpoint member count/alias")
        require(sum(e.file_size for e in entries) <= MAX_BYTES and all(e.compress_type == zipfile.ZIP_STORED
            and not e.flag_bits & 1 and re.fullmatch(r"archive/(?:data/[0-9]+|data\.pkl|byteorder|version|\.data/serialization_id|\.format_version|\.storage_alignment)", e.filename)
            and (not e.filename.endswith("data.pkl") or e.file_size <= 2097152) for e in entries),
            "unsafe/compressed/oversized support checkpoint")
    payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
    require(type(payload) is dict and set(payload) == set(expected) | {"generator", "discriminator", "graph"}
        and _same_json({key: payload[key] for key in expected}, expected), "support checkpoint identity/Run/config differs")
    g_reference, d_reference = parent._references(model, critic)
    require(_same_json(payload["graph"], {"generator": parent._graph(model), "discriminator": parent._graph(critic)}),
        "support checkpoint full graph differs")
    gs, ds = parent._state(payload["generator"], g_reference, "generator"), parent._state(payload["discriminator"], d_reference, "discriminator")
    networks = (model, critic)
    targets = [dict(network.state_dict()) for network in networks]
    saved = [{name: value.detach().clone() for name, value in state.items()} for state in targets]
    snapshots = [parent._installation_snapshot(network) for network in networks]
    try:
        model.load_state_dict(gs, strict=True)
        critic.load_state_dict(ds, strict=True)
        for network, snapshot in zip(networks, snapshots):
            parent._require_original_storage(network, snapshot)
        validate(model)
        strict._require_installed_state(model, gs, "generator")
        strict._require_installed_state(critic, ds, "discriminator")
    except BaseException as primary:
        errors = []
        for label, network, target, previous, snapshot in zip(("generator", "discriminator"), networks, targets, saved, snapshots):
            try:
                parent._restore_installation(network, snapshot)
                with torch.no_grad():
                    for name, value in target.items():
                        value.copy_(previous[name])
                strict._require_installed_state(network, previous, label + " rollback")
            except BaseException as secondary:
                errors.append(label + ": " + str(secondary))
        if errors:
            primary.secondary_checkpoint_restore_errors = errors
        raise
    return {"modelStateLoaded": True, "automaticResumeAllowed": False, "checkpointQualified": False,
        "capabilityVersion": CAPABILITY}
