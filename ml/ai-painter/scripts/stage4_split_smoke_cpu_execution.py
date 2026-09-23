"""Candidate-bound CPU composition; internal component, not an admission API.

The enclosing qualified adapter must authenticate the foundation read set and
data before real execution. A supplied state hash proves consistency only.
No CLI, GPU, historical Denoiser input, selection or production registration.
"""
from __future__ import annotations

from copy import deepcopy
import math
from pathlib import Path
import re

import torch

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.complete_world.split_release import canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash
from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    build_stage4_semantic_transport_v2_cpu_inactive_config,
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
    stage4_semantic_transport_v2_optimizer_parameters,
)
from stage4_split_isolated_smoke import verify_inactive_contract, selected_indices
from stage4_split_smoke_checkpoint import run_cpu_checkpoint_step, reload_cpu_checkpoint
from train_ai_assisted_conditional_denoiser import build_diffusion_schedule


def require(value, message):
    if not value:
        raise ValueError(message)


def initialize_cpu_candidate(*, root, component_binding, foundation_state, foundation_state_sha256):
    """Construct a fresh Denoiser; load only the supplied, checked CPU AE state.

    This function deliberately does not read/deserialize any checkpoint. The
    enclosing adapter is responsible for the authenticated foundation loader.
    Tests supply synthetic state, not the production foundation checkpoint.
    """
    component = verify_inactive_contract(Path(root), component_binding)
    config = build_stage4_semantic_transport_v2_cpu_inactive_config(Path(root))
    require(digest(canonical_bytes(config)) == component["derivedCpuConfigSha256"], "candidate config mismatch")
    require(component["qualification"]["trainingAllowed"] is False, "unexpected component scope")
    seed = component["schedule"]["seed"]
    require(type(seed) is int and 0 <= seed < 2**63, "invalid candidate seed")
    require(isinstance(foundation_state, dict) and foundation_state, "foundation state missing")
    require(re.fullmatch(r"[a-f0-9]{64}", foundation_state_sha256 or "") is not None, "invalid foundation state hash")
    require(all(isinstance(k, str) and isinstance(t, torch.Tensor) and t.device.type == "cpu"
                and torch.isfinite(t).all().item() for k, t in foundation_state.items()), "invalid CPU foundation tensors")
    require(state_hash(foundation_state) == foundation_state_sha256, "foundation state hash mismatch")
    # Factory configuration is reconstructed from bound contracts, not supplied
    # by the caller. RNG isolation avoids altering another CPU task's seed.
    with torch.random.fork_rng(devices=[]), torch.device("cpu"):
        torch.manual_seed(seed)
        model = build_complete_world_system(config)
    initial_denoiser = state_hash(model.denoiser.state_dict())
    model.autoencoder.load_state_dict(foundation_state, strict=True)
    model.train()
    frozen = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(state_hash(model.autoencoder.state_dict()) == foundation_state_sha256, "loaded foundation mismatch")
    require(state_hash(model.denoiser.state_dict()) == initial_denoiser, "foundation loading changed denoiser")
    require(state_hash(foundation_state) == foundation_state_sha256, "source foundation state changed")
    evidence = {"schemaVersion": "split-smoke-cpu-initialization-component-v1",
        "component": deepcopy(component_binding), "capabilityVersion": component["capabilityVersion"],
        "configSha256": digest(canonical_bytes(config)), "seed": seed, "device": "cpu",
        "initialDenoiserStateSha256": initial_denoiser,
        "foundationStateSha256": foundation_state_sha256,
        "foundationStateIdentityAlgorithm": "split_training.state_hash",
        "foundationBoundaryEvidence": frozen, "historicalDenoiserLoaded": False,
        "foundationCheckpointAuthenticated": False, "trainingAllowed": False}
    return component, config, model, evidence


def execute_cpu_candidate_step(*, root, component_binding, foundation_state, foundation_state_sha256,
                               train_dataset, validation_dataset, latent_normalization,
                               run_id, checkpoint_path):
    """One bounded CPU epoch, then fresh-model reload; not a 30-epoch runner.

    No automatic retry and no best-checkpoint selection. Output is the exact
    final state of this one component step and remains non-promotable.
    """
    component, config, model, initialized = initialize_cpu_candidate(
        root=root, component_binding=component_binding, foundation_state=foundation_state,
        foundation_state_sha256=foundation_state_sha256)
    for split, dataset in (("train", train_dataset), ("validation", validation_dataset)):
        require(dataset.manifest["datasetReleaseIdentity"] == component["datasetReleaseIdentity"], "candidate dataset mismatch")
        require(Path(dataset.root).resolve() == Path(root).resolve(), "candidate dataset root mismatch")
        ids = component["selections"][split]["sampleIds"]
        selected_indices(dataset, ids, split)
        rows = [row for row in dataset.rows if row["sampleId"] in ids]
        require(digest(canonical_bytes(rows)) == component["selections"][split]["rowsSha256"], "candidate selection rows mismatch")
    lr = float(config["training"]["denoiserLearningRate"])
    require(math.isfinite(lr) and lr > 0, "invalid registered learning rate")
    optimizer = torch.optim.AdamW(stage4_semantic_transport_v2_optimizer_parameters(model), lr=lr)
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(initialized["seed"])
        trained = run_cpu_checkpoint_step(root=root, checkpoint_path=checkpoint_path, run_id=run_id,
            capability_version=component["capabilityVersion"], model=model, optimizer=optimizer,
            train_dataset=train_dataset, validation_dataset=validation_dataset,
            train_sample_ids=component["selections"]["train"]["sampleIds"],
            validation_sample_ids=component["selections"]["validation"]["sampleIds"],
            diffusion=build_diffusion_schedule(config, torch.device("cpu")),
            latent_normalization=latent_normalization, device=torch.device("cpu"),
            config=config, epoch_index=0, seed=initialized["seed"])
    _, reload_config, fresh, fresh_evidence = initialize_cpu_candidate(
        root=root, component_binding=component_binding, foundation_state=foundation_state,
        foundation_state_sha256=foundation_state_sha256)
    require(fresh_evidence == initialized, "fresh initialization is not reproducible")
    reloaded = reload_cpu_checkpoint(root=root, checkpoint=trained["checkpoint"],
        expected_identity=trained["identity"], model=fresh, config=reload_config)
    require(state_hash(model.state_dict()) == state_hash(fresh.state_dict()), "reloaded model differs from trained state")
    require(state_hash(model.autoencoder.state_dict()) == foundation_state_sha256, "execution changed foundation")
    return {"status": "cpu_candidate_step_reloaded_not_qualified", "initialization": initialized,
        "training": trained, "reload": {k: v for k, v in reloaded.items() if k != "latentNormalization"},
        "trainingRngScope": "isolated_component_seed_reset_before_single_epoch",
        "selectionMode": "single_step_final_state_no_selection", "sameProcessFreshModelReload": True,
        "separateProcessReloadProven": False, "productionAdapterRegistered": False,
        "dataQualified": False, "gpuStarted": False, "trainingAllowed": False}
