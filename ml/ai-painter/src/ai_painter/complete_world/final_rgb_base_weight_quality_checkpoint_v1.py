"""Inactive support-Loss checkpoint identity; strict complete-state CPU reload.

Existing state/rollback helpers are reused, never the old checkpoint metadata or
execution permission. In-memory synthetic tests do not grant model qualification.
"""
from copy import deepcopy
import hashlib
import io
import re
import zipfile

import json
import torch
from ai_painter.complete_world import ecology_terrain_detail_weight_checkpoint_v1 as tools
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as template
from ai_painter.complete_world import detail_weight_checkpoint_codec as strict
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

CAPABILITY = "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1"
MODEL_CAPABILITY = identity.CAPABILITY
SCHEMA = "final-rgb-base-weight-quality-checkpoint-v1"
CONFIGURATION_SCHEMA = "object-support-structure-quality-configuration-v1"
EXECUTION_QUALIFIED = False
MAX_BYTES = tools.MAX_BYTES
POLICY = {"path":"data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-quality-execution-policy-v3.json",
    "sha256":"5479dde98dd24882309986051c86fdfba024a2b3756082a79c9c9734ad3e2de1"}
SPECIFICATION = {"path":"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256":"318e7078b24f56734af92ba6636d63ec89ef27174866cc72ac2f4e934505b30e"}
PREVIEW_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v3.json"
LOSS, GRADIENT, INTEGRATION = template.LOSS, template.GRADIENT, template.POLICY
SOURCE_ASSETS = template.SOURCE_ASSETS
exact_binding, configuration_digest, require = tools.exact_binding, tools.configuration_digest, tools.require
_same_json = tools._same_json


def components():
    return torch, strict, identity.validate_model_identity, identity.ARCHITECTURE, identity.NUMERIC_RULE


def _source_configuration():
    return template._source_configuration()


def expected_configuration(training_preview_policy):
    exact_binding(training_preview_policy)
    require(training_preview_policy["path"] == PREVIEW_PATH, "registered preview v3 required")
    result = template.expected_configuration()
    result.update(schema=CONFIGURATION_SCHEMA,capabilityVersion=CAPABILITY,modelCapabilityVersion=MODEL_CAPABILITY,
        formalSpecification=dict(SPECIFICATION),executionPolicy=dict(POLICY),trainingPreviewPolicy=dict(training_preview_policy),gpuAdmissionSeconds=720)
    return result


def validate_configuration(configuration):
    require(type(configuration) is dict and "trainingPreviewPolicy" in configuration, "final RGB preview binding required")
    require(_same_json(configuration,expected_configuration(configuration["trainingPreviewPolicy"])), "final RGB configuration identity differs")


def validate_execution_policy(policy, configuration):
    validate_configuration(configuration)
    raw=json.dumps(policy,sort_keys=True,separators=(",",":"),ensure_ascii=True,allow_nan=False).encode()
    require(hashlib.sha256(raw).hexdigest()=="3704ad0365c596afb2080a6a81a7ec71c8ca3a72286349ca495ac6aceb51b6f5",
        "exact final RGB execution policy values differ")
    return policy


def _references(model,critic):
    identity.validate_model_identity(model)
    with torch.device("cpu"),torch.random.fork_rng(devices=[]):
        fresh=identity.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=model.condition_channel_order)
        fresh_critic=build_conditional_texture_discriminator()
    require(tools._graph(model)==tools._graph(fresh),"new generator complete graph differs")
    def graph(network):
        keys=("in_channels","out_channels","kernel_size","stride","padding","dilation","groups","padding_mode",
              "num_groups","num_channels","eps","inplace","negative_slope")
        return tuple((name,type(module),tuple((key,getattr(module,key)) for key in keys if hasattr(module,key)))
            for name,module in network.named_modules(remove_duplicate=False))
    require(type(critic) is type(fresh_critic) and tools._graph(critic)==tools._graph(fresh_critic)
        and graph(critic)==graph(fresh_critic),"critic exact graph/type differs")
    return fresh.state_dict(),fresh_critic.state_dict()


def _state(state,reference,label):
    require(all(type(v) is torch.Tensor and v.is_contiguous() for v in state.values()),label+" contiguous state required")
    return strict._state(state,reference,label)


def _restore_installation(network,snapshot):
    for module,children,parameters,buffers,training in snapshot["modules"]:
        module._modules,module._parameters,module._buffers,module.training=children,parameters,buffers,training
    with torch.no_grad():
        for value,original,_ in snapshot["data"]:
            value.data=original
        for value,needed,gradient,previous in snapshot["gradients"]:
            value.requires_grad_(needed)
            value.grad=gradient
            if gradient is not None:
                gradient.copy_(previous)
    tools._require_original_storage(network,snapshot)


def validate_selection(configuration, run_id, epoch, selection, counts):
    validate_configuration(configuration)
    # Reuse only its numeric rank/24x48 validator; metadata below has a new identity.
    tools.validate_selection(_source_configuration(), run_id, epoch, selection, counts)


def _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding):
    validate_selection(configuration, run_id, epoch, selection, counts)
    for binding in (package_binding, dataset_binding, plan_binding):
        exact_binding(binding)
    require(plan_binding["path"].endswith("/quality-plan.json"), "final RGB plan binding differs")
    require(type(program_bindings) is dict and 1 <= len(program_bindings) <= 256, "final RGB source role ceiling")
    by_path = {}
    for binding in program_bindings.values():
        exact_binding(binding)
        require(binding["path"] not in by_path or by_path[binding["path"]] == binding["sha256"],
            "one source path has conflicting identities")
        by_path[binding["path"]] = binding["sha256"]
    _, _, _, architecture, numeric = components()
    return {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "modelCapabilityVersion": MODEL_CAPABILITY,
        "architecture": architecture, "numericRule": numeric,
        "configuration": deepcopy(configuration), "configurationSha256": configuration_digest(configuration),
        "runId": run_id, "executionPackage": dict(package_binding), "datasetManifest": dict(dataset_binding),
        "epoch": epoch, "selection": deepcopy(selection), "counts": dict(counts),
        "programBindings": deepcopy(program_bindings), "planBinding": dict(plan_binding),
        "automaticResumeAllowed": False, "checkpointQualified": False}


def encode(model, critic, *, configuration, run_id, package_binding, dataset_binding, epoch,
        selection, counts, program_bindings, plan_binding):
    torch, _, _, _, _ = components()
    payload = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding)
    g_reference, d_reference = _references(model, critic)
    payload.update(graph={"generator": tools._graph(model), "discriminator": tools._graph(critic)},
        generator=_state({n: v.detach().cpu().clone() for n, v in model.state_dict().items()}, g_reference, "generator"),
        discriminator=_state({n: v.detach().cpu().clone() for n, v in critic.state_dict().items()}, d_reference, "discriminator"))
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    require(buffer.tell() <= MAX_BYTES, "final RGB checkpoint byte ceiling")
    return buffer.getvalue()


def reload(raw, *, model, critic, configuration, run_id, package_binding, dataset_binding, epoch,
        selection, counts, program_bindings, plan_binding):
    torch, strict, validate, _, _ = components()
    expected = _metadata(configuration, run_id, package_binding, dataset_binding, epoch, selection, counts,
        program_bindings, plan_binding)
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES, "final RGB checkpoint byte ceiling")
    require(all(v.device.type == "cpu" for network in (model, critic)
        for v in (*network.parameters(), *network.buffers())), "final RGB reload requires CPU destinations")
    validate(model)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) <= 2048 and len({e.filename for e in entries}) == len(entries), "unsafe checkpoint member count/alias")
        require(sum(e.file_size for e in entries) <= MAX_BYTES and all(e.compress_type == zipfile.ZIP_STORED
            and not e.flag_bits & 1 and re.fullmatch(r"archive/(?:data/[0-9]+|data\.pkl|byteorder|version|\.data/serialization_id|\.format_version|\.storage_alignment)", e.filename)
            and (not e.filename.endswith("data.pkl") or e.file_size <= 2097152) for e in entries),
            "unsafe/compressed/oversized final RGB checkpoint")
    payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
    require(type(payload) is dict and set(payload) == set(expected) | {"generator", "discriminator", "graph"}
        and _same_json({key: payload[key] for key in expected}, expected), "final RGB checkpoint identity/Run/config differs")
    g_reference, d_reference = _references(model, critic)
    require(_same_json(payload["graph"], {"generator": tools._graph(model), "discriminator": tools._graph(critic)}),
        "final RGB checkpoint full graph differs")
    gs, ds = _state(payload["generator"], g_reference, "generator"), _state(payload["discriminator"], d_reference, "discriminator")
    networks = (model, critic)
    targets = [dict(network.state_dict()) for network in networks]
    saved = [{name: value.detach().clone() for name, value in state.items()} for state in targets]
    snapshots = [tools._installation_snapshot(network) for network in networks]
    try:
        model.load_state_dict(gs, strict=True)
        critic.load_state_dict(ds, strict=True)
        for network, snapshot in zip(networks, snapshots):
            tools._require_original_storage(network, snapshot)
        validate(model)
        strict._require_installed_state(model, gs, "generator")
        strict._require_installed_state(critic, ds, "discriminator")
    except BaseException as primary:
        errors = []
        for label, network, target, previous, snapshot in zip(("generator", "discriminator"), networks, targets, saved, snapshots):
            try:
                _restore_installation(network, snapshot)
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
