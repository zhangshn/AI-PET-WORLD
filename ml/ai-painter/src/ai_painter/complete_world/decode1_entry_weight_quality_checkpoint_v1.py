"""Inactive support-Loss checkpoint identity; strict complete-state CPU reload.

Existing state/rollback helpers are reused, never the old checkpoint metadata or
execution permission. In-memory synthetic tests do not grant model qualification.
"""
from copy import deepcopy
import hashlib
import io
import re
import zipfile
import os
import stat
from pathlib import Path

import json
import torch
from ai_painter.complete_world import ecology_terrain_detail_weight_checkpoint_v1 as tools
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as template
from ai_painter.complete_world import detail_weight_checkpoint_codec as strict
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
MODEL_CAPABILITY = identity.CAPABILITY
SCHEMA = "decode1-entry-weight-quality-checkpoint-v1"
CONFIGURATION_SCHEMA = "object-support-structure-quality-configuration-v1"
EXECUTION_QUALIFIED = False
MAX_BYTES = tools.MAX_BYTES
SUPPORT_WEIGHT1_CAPABILITY = "stage4_mvp256_dry_decode1_support_structure_weight1_v1"
# The controller fills these exact pins after formal 1.96/policy registration.
POLICY = {"path":"data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v1.json",
    "sha256":"94363da6660fb4c6c2789f0d7567babea231d8814f5e8652098b8891e9897fa9"}
SPECIFICATION = {"path":"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256":"f33115ca81ff3704e5b47d29f2927c5db9a5e0e97045a04b10813e646506557b"}
PROGRESS_PUBLICATION_POLICY = {
    "path":"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v1.json",
    "sha256":"594e72f0f3faa0d4eb8380e64143e197bf31d6eb6567578ba5f2e762c431c1bc"}
PREVIEW_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v6.json"
JOINT_LEARNING_RULE = {"path":"data/ai-painter/system-governance/ai-painter-joint-object-priority-cpu-policy-v1.json",
    "sha256":"ad23ad5a097fe9b4f6cc89a621a7ff763ac31340046a418b02861f2c94e59bf4"}
POLICY_CANONICAL_SHA256 = "8177b7222e229db15fdbf54bb3330cc9a9cfc1cd5fe216f0aaa6023386051748"
COMPLETION_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1"
COMPLETION_V2_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2"
SAME_CALL_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1"
SAME_CALL_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json","sha256":"a9efa678657b7069b36f824487673e27d05a862b39a37a21bf3270d34624e2aa"}
SAME_CALL_PROGRESS_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v4.json","sha256":"f03354cab75b2a96cc0145b85103999e6f22e6e1e4ddc5541f0063f0f58935b9"}
SAME_CALL_POLICY_CANONICAL_SHA256 = "10dd0739af1eaab16f8b6af60f485c89eb44729be026475ba5b55b4728464109"
COMPLETION_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v2.json",
    "sha256":"cee623bb0a34bfd49f68ec99f6078c93603a7af66f457e807f29fa50b6cd467b"}
COMPLETION_SPECIFICATION = {"path":SPECIFICATION["path"],"sha256":"d8590b62599da831130fdd791edee9ea23f683d0ce62cd3845f9466676d37162"}
COMPLETION_PROGRESS_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v2.json",
    "sha256":"e4c71f859201cccfac33afacec4f0ec731709c45d73d276886ab642d7c923403"}
COMPLETION_POLICY_CANONICAL_SHA256 = "fe252fc001037ab0da16e501df6a59e7286586fc848afe2bace1e83c8f913213"
COMPLETION_V2_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v3.json","sha256":"851b6ad6c13794f9351325a3b9f6323295dd48c4dbad9a141f74074a7e0b2307"}
COMPLETION_V2_PROGRESS_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v3.json","sha256":"0dc4baba10f789f8b571f9bcf322e3d3e5962e21bda1224054d1fce2665db16f"}
COMPLETION_V2_POLICY_CANONICAL_SHA256 = "2a5ad0eb5b0994674c6aa40c42c8891ba9a5fe70aad7bb96b1bfd6474266b4c2"
LOSS, GRADIENT, INTEGRATION = template.LOSS, template.GRADIENT, template.POLICY
SOURCE_ASSETS = template.SOURCE_ASSETS
exact_binding, configuration_digest, require = tools.exact_binding, tools.configuration_digest, tools.require
_same_json = tools._same_json


def components():
    return torch, strict, identity.validate_model_identity, identity.ARCHITECTURE, identity.NUMERIC_RULE


def _source_configuration():
    return template._source_configuration()


def registered_training_interfaces(root=None):
    """Current preparation index only; immutable history never calls this reader.

    No imports, inference, model construction, execution or qualification is
    selected by policy JSON. This implementation accepts one known adapter.
    """
    root = Path(root) if root is not None else Path(__file__).resolve().parents[5]
    def unique_pairs(rows):
        result = {}
        for key, value in rows:
            require(key not in result, "duplicate interface JSON key")
            result[key] = value
        return result
    def read(logical, maximum):
        require(type(logical) is str and logical.startswith("data/ai-painter/system-governance/")
            and "\\" not in logical and ":" not in logical
            and all(part not in ("", ".", "..") for part in logical.split("/")), "interface path boundary")
        target = root.joinpath(*logical.split("/"))
        for parent in (target, *target.parents):
            if parent == root: break
            require(not parent.is_symlink() and not getattr(parent,"is_junction",lambda:False)(), "interface path redirected")
        before = target.lstat()
        require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= maximum, "bounded interface record")
        with target.open("rb") as stream:
            opened = os.fstat(stream.fileno())
            require((opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino), "interface identity changed")
            raw = stream.read(maximum + 1)
            after = os.fstat(stream.fileno())
        final = target.lstat()
        stamp = lambda item:(item.st_dev,item.st_ino,item.st_size,item.st_mtime_ns,item.st_ctime_ns)
        # Windows lstat and fstat expose different ctime meanings. Compare each
        # API to itself, and stable file/size/mtime identity across both APIs.
        require(len(raw) <= maximum and stamp(before) == stamp(final) and stamp(opened) == stamp(after)
            and (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)
            == (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns), "interface bytes changed")
        value = json.loads(raw, object_pairs_hook=unique_pairs,
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite interface JSON")))
        require(type(value) is dict, "interface object required")
        return raw, value
    index_path = "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json"
    index_raw, index = read(index_path, 1024**2)
    require(index.get("schemaVersion") == "ai-painter-current-entrypoint-registry-v1"
        and index.get("status") == "active" and index.get("normalAuthority") == "local_ai_pet_world_program"
        and index.get("ownerInNormalStateMachine") is False, "current interface index required")
    rows = index.get("trainingInterfaces", [])
    require(type(rows) is list and len(rows) <= 64, "bounded training interface index")
    selectors = {row.get("candidateSelection") for row in index.get("localControlEntrypoints",[]) if row.get("candidateSelection")}
    capabilities = {row.get("capabilityVersion") for row in index.get("localControlEntrypoints",[]) if row.get("capabilityVersion")}
    roots, result = set(), []
    protocols = dict(package="ai-painter-current-training-package-v1",progress="ai-painter-current-training-progress-v1",
        previewRecord="training-preview-diagnostic-record-v1",previewManifest="training-preview-diagnostic-manifest-v1",
        timing="decode1-entry-worker-execution-timing-v1")
    for row in rows:
        require(type(row) is dict and set(row) == {"candidateSelection", "executionPolicy"}, "interface index fields")
        bound = exact_binding(row["executionPolicy"])
        raw, policy = read(bound["path"], 65536)
        require(hashlib.sha256(raw).hexdigest() == bound["sha256"], "interface policy SHA differs")
        d = policy.get("interfaceContract")
        require(policy.get("schemaVersion") == "ai-painter-registered-training-execution-policy-v1"
            and type(d) is dict and set(d) == {"schemaVersion","adapterId","candidateSelection","runPrefix","packagePrefix","protocols"}
            and d.get("schemaVersion") == "ai-painter-training-interface-contract-v1"
            and d.get("adapterId") == "decode1_entry_same_call_completion_v1" and d.get("protocols") == protocols,
            "registered interface protocol unsupported")
        selector = d["candidateSelection"]
        require(type(selector) is str and re.fullmatch(r"[a-z][a-z0-9-]{7,79}", selector)
            and selector == row["candidateSelection"] == policy.get("candidateSelection") and d["runPrefix"] == selector + "-"
            and d["packagePrefix"] == selector + "-package-", "interface selector/prefix conflict")
        capability = policy.get("candidate")
        require(type(capability) is str and re.fullmatch(r"[a-z][a-z0-9_]{7,127}", capability)
            and policy.get("modelCapability") == MODEL_CAPABILITY, "interface model unsupported")
        output = policy.get("outputRoot")
        require(output == ".runtime/ai-painter/registered-training-" + selector + "-executions"
            and type(policy.get("executionProfile")) is str
            and re.fullmatch(r"[a-z][a-z0-9_]{7,127}", policy["executionProfile"]), "interface namespace conflict")
        for seen, value in ((selectors,selector),(capabilities,capability),(roots,output)):
            require(value not in seen, "duplicate training interface identity")
            seen.add(value)
        formal = policy.get("formalSpecification", {})
        exact_binding({key:formal[key] for key in ("path","sha256")})
        require(formal.get("path") == SPECIFICATION["path"] and type(formal.get("version")) is str
            and re.fullmatch(r"AI-PAINTER-SPEC-1\.\d+", formal["version"]), "interface specification invalid")
        preview, progress = policy.get("trainingPreviewPolicy"), policy.get("progressPublication",{}).get("componentPolicy")
        preview = exact_binding({key:preview[key] for key in ("path","sha256")})
        progress = exact_binding(progress)
        require(all(b["path"].startswith("data/ai-painter/system-governance/") for b in (preview,progress)), "interface policy boundary")
        require(policy.get("entrypointPath") == "scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs"
            and policy.get("progressPublication",{}).get("componentPath")
            == "ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py", "interface implementation unsupported")
        ceiling, resources, scope = policy.get("executionCeiling",{}), policy.get("phaseResources",{}), policy.get("scope",{})
        require([ceiling.get(k) for k in ("epochs","generatorOptimizerSteps","discriminatorOptimizerSteps","trainingWallMode","maxWallSeconds")]
            == [24,1152,1152,"completion",None] and resources.get("gpuAdmissionSeconds") is None
            and resources.get("gpuAdmissionWallMode") == "completion" and resources.get("programFileCountMaximum") == 256,
            "interface resource conflict")
        require(scope.get("resolution") == [256,192] and type(scope.get("worldCount")) is int and scope.get("worldCount") == 1
            and scope.get("waterFactPresent") is False and scope.get("formalStage4Qualification") is False
            and scope.get("runtimePublication") is False, "interface scope conflict")
        result.append(dict(capability=capability,completion=True,qualification_completion=True,same_call_capture=True,
            policy=dict(bound),progress_policy=dict(progress),specification={key:formal[key] for key in ("path","sha256")},
            preview_path=preview["path"],preview_schema="ai-painter-registered-training-preview-policy-v1",
            root_prefix=output+"/",run_prefix=d["runPrefix"],package_prefix=d["packagePrefix"],profile=policy["executionProfile"],
            interface_contract=deepcopy(d),policy_value=policy,
            policy_canonical_sha256=hashlib.sha256(json.dumps(policy,sort_keys=True,separators=(",",":"),ensure_ascii=True,allow_nan=False).encode()).hexdigest(),
            entrypoint_snapshot=dict(schemaVersion="ai-painter-training-entrypoint-snapshot-v1",
                registry=dict(path=index_path,sha256=hashlib.sha256(index_raw).hexdigest()),selection=deepcopy(row))))
    return result


def execution_values(capability_version=CAPABILITY):
    if capability_version not in (CAPABILITY,COMPLETION_CAPABILITY,COMPLETION_V2_CAPABILITY,SAME_CALL_CAPABILITY):
        found = [value for value in registered_training_interfaces() if value["capability"] == capability_version]
        require(len(found) == 1, "unknown checkpoint execution capability")
        return found[0]
    if capability_version==SAME_CALL_CAPABILITY:
        return {"capability":capability_version,"completion":True,"qualification_completion":True,"same_call_capture":True,
            "policy":dict(SAME_CALL_POLICY),"progress_policy":dict(SAME_CALL_PROGRESS_POLICY),
            "specification":{"path":SPECIFICATION["path"],"sha256":"4492b0641a5a3b5e62e9b8f2c71f358f3dcd3d43734cc7f3de0b721730c92cfc"},
            "preview_path":"data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v9.json",
            "root_prefix":".runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/",
            "run_prefix":"decode1-entry-same-call-v1-","package_prefix":"decode1-entry-same-call-v1-package-"}
    if capability_version==COMPLETION_V2_CAPABILITY:
        return {"capability":capability_version,"completion":True,"qualification_completion":True,
            "policy":dict(COMPLETION_V2_POLICY),"progress_policy":dict(COMPLETION_V2_PROGRESS_POLICY),
            "specification":{"path":SPECIFICATION["path"],"sha256":"0bdd8f244f2e75777e75e27a8606c1f7132d464ea5d1efb1aec8d1b1abce294e"},
            "preview_path":"data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v8.json",
            "root_prefix":".runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/",
            "run_prefix":"decode1-entry-completion-v2-","package_prefix":"decode1-entry-completion-v2-package-"}
    completion=capability_version==COMPLETION_CAPABILITY
    return {"capability":capability_version,"completion":completion,
        "policy":dict(COMPLETION_POLICY if completion else POLICY),
        "specification":dict(COMPLETION_SPECIFICATION if completion else SPECIFICATION),
        "progress_policy":dict(COMPLETION_PROGRESS_POLICY if completion else PROGRESS_PUBLICATION_POLICY),
        "preview_path":"data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v7.json" if completion else PREVIEW_PATH,
        "root_prefix":".runtime/ai-painter/decode1-entry-weight-quality-completion-executions/" if completion else ".runtime/ai-painter/decode1-entry-weight-quality-executions/",
        "run_prefix":"decode1-entry-completion-v1-" if completion else "decode1-entry-quality-v1-",
        "package_prefix":"decode1-entry-completion-v1-package-" if completion else "decode1-entry-quality-v1-package-"}


def expected_configuration(training_preview_policy,capability_version=CAPABILITY):
    route=execution_values(capability_version)
    exact_binding(route["policy"])
    exact_binding(route["specification"])
    exact_binding(training_preview_policy)
    require(training_preview_policy["path"] == route["preview_path"], "registered route preview required")
    result = template.expected_configuration()
    result["sourceAssetsCandidate"] = source_assets(capability_version)
    result.update(schema=CONFIGURATION_SCHEMA,capabilityVersion=capability_version,modelCapabilityVersion=MODEL_CAPABILITY,
        formalSpecification=route["specification"],executionPolicy=route["policy"],trainingPreviewPolicy=dict(training_preview_policy),
        jointLearningRule=dict(JOINT_LEARNING_RULE),gpuAdmissionSeconds=720,
        progressPublicationPolicy=route["progress_policy"])
    if route["completion"]:
        result["executionCeiling"].update(maxWallSeconds=None,trainingWallMode="completion")
    if route.get("qualification_completion"):
        result.update(gpuAdmissionWallMode="completion",gpuAdmissionSeconds=None)
    if capability_version == SUPPORT_WEIGHT1_CAPABILITY:
        require(type(route["policy_value"].get("objectSupportStructureWeight")) is int
            and route["policy_value"]["objectSupportStructureWeight"] == 1, "registered support weight1 policy required")
        result["objectSupportStructureWeight"] = 1
    else:
        require("objectSupportStructureWeight" not in route.get("policy_value", {}),
            "legacy policy cannot activate support weight1")
    return result


def source_assets(capability_version=CAPABILITY):
    route = execution_values(capability_version)
    return dict(exact_binding(route["policy_value"]["sourceCandidate"])) if route.get("interface_contract") else dict(SOURCE_ASSETS)


def validate_configuration(configuration):
    require(type(configuration) is dict and "trainingPreviewPolicy" in configuration, "final RGB preview binding required")
    require(_same_json(configuration,expected_configuration(configuration["trainingPreviewPolicy"],configuration.get("capabilityVersion"))), "final RGB configuration identity differs")


def validate_execution_policy(policy, configuration):
    validate_configuration(configuration)
    raw=json.dumps(policy,sort_keys=True,separators=(",",":"),ensure_ascii=True,allow_nan=False).encode()
    route=execution_values(configuration["capabilityVersion"])
    expected=route.get("policy_canonical_sha256") or {CAPABILITY:POLICY_CANONICAL_SHA256,COMPLETION_CAPABILITY:COMPLETION_POLICY_CANONICAL_SHA256,
        COMPLETION_V2_CAPABILITY:COMPLETION_V2_POLICY_CANONICAL_SHA256,
        SAME_CALL_CAPABILITY:SAME_CALL_POLICY_CANONICAL_SHA256}[configuration["capabilityVersion"]]
    require(hashlib.sha256(raw).hexdigest()==expected,
        "exact joint execution policy values differ")
    if execution_values(configuration["capabilityVersion"])["completion"]:
        require(policy["trainingPreviewPolicy"]["sha256"]==configuration["trainingPreviewPolicy"]["sha256"],
            "registered completion preview SHA differs")
    return policy


def _references(model,critic):
    identity.validate_model_identity(model)
    with torch.device("cpu"),torch.random.fork_rng(devices=[]):
        fresh=identity.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=model.condition_channel_order)
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
    route=execution_values(configuration["capabilityVersion"])
    require(type(run_id) is str and run_id.startswith(route["run_prefix"])
        and plan_binding["path"] == route["root_prefix"] + run_id + "/quality-plan.json",
        "same decode1 entry Run/plan required")
    require(package_binding["path"].startswith(".runtime/ai-painter/autonomous-closed-loop-packages/"+route["package_prefix"])
        and package_binding["path"].endswith("/package.json"), "new decode1 entry package required")
    require(type(program_bindings) is dict and 1 <= len(program_bindings) <= 256, "decode1 entry source role ceiling")
    by_path = {}
    for binding in program_bindings.values():
        exact_binding(binding)
        require(binding["path"] not in by_path,
            "one source path has conflicting identities")
        by_path[binding["path"]] = binding["sha256"]
    _, _, _, architecture, numeric = components()
    return {"schema": SCHEMA, "capabilityVersion": route["capability"], "modelCapabilityVersion": MODEL_CAPABILITY,
        "architecture": architecture, "numericRule": numeric,
        "configuration": deepcopy(configuration), "configurationSha256": configuration_digest(configuration),
        "runId": run_id, "executionPackage": dict(package_binding), "datasetManifest": dict(dataset_binding),
        "epoch": epoch, "selection": deepcopy(selection), "counts": dict(counts),
        "programBindings": deepcopy(program_bindings), "planBinding": dict(plan_binding),
        "jointLearningRule": dict(JOINT_LEARNING_RULE), "automaticResumeAllowed": False, "checkpointQualified": False}


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
        "capabilityVersion": configuration["capabilityVersion"]}
