"""Detail-weight checkpoint component, not an authenticated training worker.

The frozen shared loop cannot inject this codec or validation forward. Training
entry stays closed until a reusable explicit lifecycle interface exists. Pure
ranking uses the original implementation; no old factory/global is replaced.
"""
from __future__ import annotations
from copy import deepcopy
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).absolute().parents[3]
for entry in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(entry) not in sys.path: sys.path.insert(0, str(entry))
CAPABILITY = "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"
SCHEMA = "detail-weight-bound-checkpoint-envelope-v1"
ELIGIBLE_EPOCHS = (24, 36, 48)
PROGRAM = "ml/ai-painter/scripts/painter_stage4_detail_weight_checkpoint_worker.py"
TEST = "ml/ai-painter/tests/test_painter_stage4_detail_weight_checkpoint_worker.py"


class LifecycleIntegrationUnavailable(RuntimeError): pass


def require(value, message):
    if not value: raise ValueError(message)


def _components():
    import torch
    import painter_stage4_appearance_regime_detail_weight_training_profile as profile
    import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
    from ai_painter.complete_world import detail_weight_checkpoint_codec as codec
    return torch, profile, shared, codec


def integration_gaps():
    """Concrete frozen-interface gaps; a new identity cannot pass the old gate."""
    return [
        {"path": "ml/ai-painter/scripts/painter_stage4_appearance_regime_checkpoint_worker.py", "line": 193,
         "interface": "_source_candidate / authenticate_training_gate",
         "gap": "Strict V28 capability/policy/program roles and specification 1.44 reject the detail-weight identity.",
         "minimalInterface": "Extract reusable acyclic package/process authentication accepting a validated immutable identity and program-role descriptor; retain V28 defaults and checks."},
        {"path": "ml/ai-painter/scripts/painter_stage4_appearance_regime_checkpoint_worker.py", "line": 624,
         "interface": "bounded_training_loop",
         "gap": "network_factory and pair_runner are explicit; validation_epoch, serialize_checkpoint and reload_checkpoint_exact remain fixed globals.",
         "minimalInterface": "Add explicit validation_runner, checkpoint_serializer and checkpoint_reloader dependencies with existing V28 defaults; preserve ledger/progress/counts/error handling."},
        {"path": "ml/ai-painter/scripts/painter_stage4_appearance_regime_checkpoint_worker.py", "line": 878,
         "interface": "run_cli / terminal boundary",
         "gap": "CLI authenticates old identity and terminal boundary calls the old global loop.",
         "minimalInterface": "Provide one reusable worker lifecycle entry with explicit authenticated profile/identity/hooks; retain the same owned runner, registry and publication protocol."},
        {"path": "ml/ai-painter/src/ai_painter/complete_world/detail_weight_checkpoint_codec.py", "line": 21,
         "interface": "frozen_training_config",
         "gap": "The frozen codec binds core.TRAINING, whose checkpointRule says final_epoch_48_only_no_selection_no_resume_no_promotion; managed selection is 24/36/48.",
         "minimalInterface": "Reconcile the normative managed selection contract with the codec configuration binding through an explicit reviewed configuration identity; do not relabel a different plan as the frozen one."},
        {"path": "scripts/run-ai-painter-mvp256-dry-appearance-regime-training.mjs", "line": 528,
         "interface": "run / package-chain / GPU and review adapters",
         "gap": "Supervisor/package/GPU/review imports and schemas are fixed to V28, even though registry and process protocols are shared.",
         "minimalInterface": "Factor explicit identity/paths/package validator/GPU worker/review dependencies out of the existing orchestration; keep all registry, heartbeat, artifact and resource checks."},
    ]


def training_entry(*_args, **_kwargs):
    raise LifecycleIntegrationUnavailable("detail-weight managed lifecycle is not connected; CPU/lifecycle qualification, configuration binding and current package are required")


def _binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}, "exact source binding required")
    require(type(value["path"]) is str and value["path"] and "\\" not in value["path"]
            and ":" not in value["path"] and all(part not in ("", ".", "..") for part in value["path"].split("/")), "source path invalid")
    require(type(value["sha256"]) is str and len(value["sha256"]) == 64
            and all(char in "0123456789abcdef" for char in value["sha256"]), "source SHA invalid")
    return dict(value)


def verify_context(reader, *, execution_package, dataset_manifest, selection_record, actual_counts):
    """Rehash immutable bytes and machine rank; does NOT authenticate execution.

    This yields a checkpoint-content binding only. It cannot grant training,
    resume, source licensing, GPU or selected-checkpoint release eligibility.
    The future shared lifecycle must first authenticate its own current package.
    """
    _torch, _profile, shared, _codec = _components()
    package = reader.json(_binding(execution_package))
    dataset = reader.json(_binding(dataset_manifest))
    record = reader.json(_binding(selection_record))
    require(package.get("capabilityVersion") == CAPABILITY and package.get("datasetManifest") == dataset_manifest
            and type(package.get("runId")) is str and bool(package["runId"])
            and type(package.get("packageId")) is str and package["packageId"] != package["runId"], "checkpoint package/data/Run differs")
    require(type(package.get("synthetic", False)) is bool, "synthetic package marker invalid")
    require(record.get("executionPackage") == execution_package and record.get("datasetManifest") == dataset_manifest
            and record.get("runId") == package["runId"] and record.get("packageId") == package["packageId"]
            and record.get("capabilityVersion") == CAPABILITY, "machine selection binding differs")
    epoch = record.get("epoch")
    require(type(epoch) is int and epoch in ELIGIBLE_EPOCHS and type(actual_counts) is dict
            and all(type(value) is int for value in actual_counts.values())
            and actual_counts == record.get("optimizerSteps") == {"generator": epoch * 48, "discriminator": epoch * 48}, "actual checkpoint counts differ")
    validation = reader.json(_binding(package["validationSplit"]))
    require(validation.get("split") == "validation", "selection split differs")
    rank = shared.rank_validation_epoch(record["validation"], validation["sampleIds"], epoch=epoch)
    require(rank == record.get("selection"), "machine checkpoint rank differs")
    programs = package.get("programBindings")
    require(type(programs) is dict and bool(programs) and programs.get("worker", {}).get("path") == PROGRAM,
            "own checkpoint program missing")
    for binding in programs.values(): reader.read(_binding(binding))
    reader.unchanged()
    return {"runId": package["runId"], "packageId": package["packageId"], "epoch": epoch,
            "counts": dict(actual_counts), "selection": rank, "selectionRecord": dict(selection_record),
            "executionPackage": dict(execution_package), "datasetManifest": dict(dataset_manifest),
            "datasetVersion": dataset.get("datasetVersion", dataset.get("schemaVersion")),
            "programBindings": deepcopy(programs), "synthetic": package.get("synthetic", False),
            "executionAuthenticated": False, "qualificationGranted": False}


def encode_snapshot(*, model, critic, reader, execution_package, dataset_manifest, selection_record, actual_counts):
    """CPU model-state snapshot of live weights; never resume or initialization."""
    torch, profile, _shared, codec = _components()
    context = verify_context(reader, execution_package=execution_package, dataset_manifest=dataset_manifest,
                             selection_record=selection_record, actual_counts=actual_counts)
    require(context["datasetVersion"] is not None, "dataset version missing")
    order = tuple(model.condition_channel_order)
    with torch.device("cpu"), torch.random.fork_rng(devices=[]): cpu_model, cpu_critic = profile.fresh_networks(order)
    # Copy only this live state into a temporary CPU snapshot. No checkpoint
    # input exists, and the caller's device/mode/gradients are untouched.
    model_state = {name: value.detach().cpu().clone() for name, value in model.state_dict().items()}
    critic_state = {name: value.detach().cpu().clone() for name, value in critic.state_dict().items()}
    cpu_model.load_state_dict(model_state, strict=True)
    cpu_critic.load_state_dict(critic_state, strict=True)
    codec._require_installed_state(cpu_model, model_state, "generator snapshot")
    codec._require_installed_state(cpu_critic, critic_state, "discriminator snapshot")
    state = codec.encode_checkpoint(model=cpu_model, critic=cpu_critic, counts=actual_counts,
              run_id=context["runId"], dataset_identity={"version": context["datasetVersion"], "manifest": context["datasetManifest"]},
              synthetic=context["synthetic"], training_config=codec.frozen_training_config())
    return {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "context": context, "modelState": state,
            "optimizerStateIncluded": False, "rngStateIncluded": False, "automaticResumeAllowed": False,
            "executionAuthenticated": False, "checkpointQualified": False}


def reload_snapshot(envelope, *, model, critic, reader, execution_package, dataset_manifest, selection_record, actual_counts):
    """Authenticate content bindings and strict model-state installation only."""
    _torch, _profile, _shared, codec = _components()
    context = verify_context(reader, execution_package=execution_package, dataset_manifest=dataset_manifest,
                             selection_record=selection_record, actual_counts=actual_counts)
    require(type(envelope) is dict and set(envelope) == {"schema", "capabilityVersion", "context", "modelState",
              "optimizerStateIncluded", "rngStateIncluded", "automaticResumeAllowed", "executionAuthenticated", "checkpointQualified"}
            and envelope["schema"] == SCHEMA and envelope["capabilityVersion"] == CAPABILITY and envelope["context"] == context
            and all(envelope[key] is False for key in ("optimizerStateIncluded", "rngStateIncluded", "automaticResumeAllowed",
                                                       "executionAuthenticated", "checkpointQualified")), "snapshot envelope differs or overclaims qualification")
    result = codec.decode_checkpoint(envelope["modelState"], model=model, critic=critic, expected_counts=actual_counts,
               run_id=context["runId"], dataset_identity={"version": context["datasetVersion"], "manifest": context["datasetManifest"]},
               synthetic=context["synthetic"], training_config=codec.frozen_training_config())
    reader.unchanged()
    return {**result, "executionAuthenticated": False, "automaticResumeAllowed": False}


def read_checkpoint_source(reader, checkpoint_binding):
    """Read only explicitly SHA-bound safe CPU payload bytes; no state writes."""
    _torch, _profile, _shared, codec = _components()
    raw = reader.read(_binding(checkpoint_binding))
    require(hashlib.sha256(raw).hexdigest() == checkpoint_binding["sha256"], "checkpoint source SHA differs")
    return codec.deserialize_checkpoint(raw)
