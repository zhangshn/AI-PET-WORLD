"""CPU-only checkpoint lifecycle component for the split-isolated V2 Trainer.

Not a GPU entrypoint, qualification authority, best-checkpoint selector or
production adapter registration. The caller owns input admission and execution
supervision. Smoke weights remain non-promotable, including after a reload.
"""
from __future__ import annotations

from copy import deepcopy
import io
import os
from pathlib import Path

import torch

from ai_painter.complete_world.split_release import canonical_bytes, digest, project_file
from ai_painter.complete_world.split_training import state_hash
from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
)
from stage4_split_isolated_smoke import run_split_smoke_epoch, selected_indices

SCHEMA = "ai-painter-split-smoke-cpu-checkpoint-v1"
MAX_BYTES = 512 * 1024 * 1024


def _require(value, message):
    if not value:
        raise ValueError(message)


def _cpu_model(model):
    _require(all(t.device.type == "cpu" for t in (*model.parameters(), *model.buffers())),
             "CPU checkpoint component refuses non-CPU model")
    return validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")


def _path(root, logical):
    _require(isinstance(logical, str) and logical.startswith(".runtime/ai-painter/"),
             "checkpoint must use isolated ai-painter runtime namespace")
    return project_file(Path(root), logical)


def _normalization(value):
    _require(isinstance(value, dict) and set(value) == {"mean", "standardDeviation"},
             "latent normalization keys invalid")
    for name, tensor in value.items():
        _require(isinstance(tensor, torch.Tensor) and tensor.device.type == "cpu"
                 and tensor.shape == (1, 12, 1, 1) and torch.isfinite(tensor).all().item(),
                 "latent normalization tensor invalid")
        if name == "standardDeviation":
            _require((tensor > 0).all().item(), "latent standard deviation must be positive")
    return {name: tensor.detach().clone() for name, tensor in value.items()}


def _identity(run_id, capability_version, kwargs):
    _require(all(isinstance(v, str) and v.strip() for v in (run_id, capability_version)),
             "explicit run and capability identities required")
    selections = {}
    for split in ("train", "validation"):
        dataset, ids = kwargs[split + "_dataset"], kwargs[split + "_sample_ids"]
        selected_indices(dataset, ids, split)
        selections[split] = {"sampleIds": list(ids), "selectionSha256": dataset.selection_sha256}
    _require(kwargs["train_dataset"].manifest == kwargs["validation_dataset"].manifest,
             "cross-release checkpoint inputs")
    return {"runId": run_id, "capabilityVersion": capability_version,
            "architectureId": kwargs["config"]["denoiserArchitecture"],
            "configSha256": digest(canonical_bytes(kwargs["config"])),
            "datasetReleaseIdentity": kwargs["train_dataset"].manifest["datasetReleaseIdentity"],
            "selections": selections, "epoch": kwargs["epoch_index"] + 1,
            "seed": kwargs["seed"]}


def run_cpu_checkpoint_step(*, root, checkpoint_path, run_id, capability_version, **kwargs):
    """Run one actual split-isolated epoch and persist its final, non-selected state.

    Exclusive output reservation precedes any optimizer update. A failed or
    interrupted write is retained and cannot be silently replayed at this path.
    """
    _require(torch.device(kwargs["device"]).type == "cpu", "CPU execution required")
    foundation = _cpu_model(kwargs["model"])["stateSha256"]
    normalization = _normalization(kwargs["latent_normalization"])
    identity = _identity(run_id, capability_version, kwargs)
    target = _path(root, checkpoint_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        epoch = run_split_smoke_epoch(**kwargs)
        _require(state_hash(kwargs["latent_normalization"]) == state_hash(normalization),
                 "latent normalization changed during checkpoint step")
        _require(_cpu_model(kwargs["model"])["stateSha256"] == foundation,
                 "foundation changed during checkpoint step")
        denoiser = {key: value.detach().clone() for key, value in kwargs["model"].denoiser.state_dict().items()}
        _require(all(torch.isfinite(t).all().item() for t in denoiser.values()), "nonfinite denoiser state")
        payload = {"schemaVersion": SCHEMA, "identity": identity,
                   "status": "cpu_component_only_non_promotable", "promotable": False,
                   "denoiserState": denoiser, "denoiserStateSha256": state_hash(denoiser),
                   "autoencoderStateSha256": foundation,
                   "latentNormalization": normalization,
                   "latentNormalizationSha256": state_hash(normalization),
                   "epochEvidence": epoch}
        torch.save(payload, stream)
        stream.flush()
        os.fsync(stream.fileno())
    _require(target.stat().st_size <= MAX_BYTES, "checkpoint exceeds CPU component byte limit")
    binding = {"path": checkpoint_path, "sha256": digest(target.read_bytes())}
    return {"status": "cpu_checkpoint_written_not_qualified", "checkpoint": binding,
            "identity": identity, "epochEvidence": epoch,
            "denoiserStateSha256": payload["denoiserStateSha256"],
            "foundationStateSha256": foundation, "gpuStarted": False,
            "trainingAllowed": False, "capabilityQualificationGranted": False}


def reload_cpu_checkpoint(*, root, checkpoint, expected_identity, model, config):
    """Hash before restricted deserialization; never load foundation from Smoke.

    The enclosing adapter supplies the expected identity and independently loaded
    foundation. This component does not authenticate that adapter or its inputs.
    """
    foundation = _cpu_model(model)["stateSha256"]
    _require(isinstance(checkpoint, dict) and set(checkpoint) == {"path", "sha256"},
             "exact checkpoint binding required")
    target = _path(root, checkpoint["path"])
    with target.open("rb") as stream:
        data = stream.read(MAX_BYTES + 1)
    _require(len(data) <= MAX_BYTES, "checkpoint exceeds CPU component byte limit")
    _require(digest(data) == checkpoint["sha256"], "checkpoint byte hash mismatch")
    payload = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
    _require(payload["schemaVersion"] == SCHEMA and payload["promotable"] is False
             and payload["status"] == "cpu_component_only_non_promotable", "checkpoint scope mismatch")
    _require(payload["identity"] == expected_identity, "checkpoint execution identity mismatch")
    _require(expected_identity["configSha256"] == digest(canonical_bytes(config))
             and expected_identity["architectureId"] == config["denoiserArchitecture"],
             "checkpoint config mismatch")
    _require(payload["autoencoderStateSha256"] == foundation, "checkpoint foundation mismatch")
    state = payload["denoiserState"]
    _require(state_hash(state) == payload["denoiserStateSha256"], "denoiser state hash mismatch")
    current = model.denoiser.state_dict()
    _require(set(state) == set(current) and all(
        isinstance(t, torch.Tensor) and t.shape == current[key].shape and t.dtype == current[key].dtype
        and torch.isfinite(t).all().item() for key, t in state.items()), "denoiser state structure mismatch")
    normalization = _normalization(payload["latentNormalization"])
    _require(state_hash(normalization) == payload["latentNormalizationSha256"], "normalization hash mismatch")
    model.denoiser.load_state_dict(state, strict=True)
    model.eval()
    _require(state_hash(model.denoiser.state_dict()) == payload["denoiserStateSha256"],
             "loaded model state mismatch")
    _require(_cpu_model(model)["stateSha256"] == foundation, "reload mutated foundation")
    return {"status": "cpu_checkpoint_reloaded_not_qualified", "checkpoint": deepcopy(checkpoint),
            "identity": deepcopy(expected_identity), "latentNormalization": normalization,
            "denoiserStateSha256": payload["denoiserStateSha256"], "optimizerSteps": 0,
            "trainingAllowed": False, "capabilityQualificationGranted": False}
