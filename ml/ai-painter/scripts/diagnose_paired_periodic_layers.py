"""Fixed CPU layer attribution; no optimizer, repair, selection or release."""
from __future__ import annotations
import argparse
import io
import json
import os
from pathlib import Path
import time

import painter_timestep_ab_experiment as trial
from painter_learning_capacity_experiment import bound_json, canonical_bytes, digest, exact_inference_runtime, read_bound, require
from verify_timestep_experiment_replay import verify_replay
from diagnose_learning_capacity_timesteps import rgb_diagnostics
from compare_decoder_adapted_sampling import png_matches

COMPONENTS = ("reconstruction", "generatedDecodeIncrement", "compositionIncrement")


def phase_vector(torch, value):
    require(value.ndim == 4 and value.shape[:2] == (1, 3), "one RGB tensor required")
    require(all(n >= 4 and n % 4 == 0 for n in value.shape[-2:]), "phase dimensions must divide by four")
    require(value.device.type == "cpu" and bool(torch.isfinite(value).all()), "finite CPU tensor required")
    value = value.double()
    phases = torch.stack([value[..., y::4, x::4].mean(dim=(0, 2, 3)) for y in range(4) for x in range(4)])
    return phases - phases.mean(dim=0, keepdim=True)


def phase_decomposition(torch, target, reconstruction, base, final):
    require(target.shape == reconstruction.shape == base.shape == final.shape, "layer shape mismatch")
    # Convert before subtraction. RMS is NOT additive; retain signed cross terms.
    target, reconstruction, base, final = [x.double() for x in (target, reconstruction, base, final)]
    vectors = {name: phase_vector(torch, value) for name, value in {
        "reconstruction": reconstruction-target, "generatedDecodeIncrement": base-reconstruction,
        "compositionIncrement": final-base, "baseResidual": base-target, "finalResidual": final-target}.items()}
    error = float((sum(vectors[k] for k in COMPONENTS)-vectors["finalResidual"]).abs().max())
    require(error < 1e-10, "phase decomposition does not telescope")
    energies = {k: float(v.square().mean()) for k, v in vectors.items()}
    crosses = {a+"__"+b: float(2*(vectors[a]*vectors[b]).mean())
               for i, a in enumerate(COMPONENTS) for b in COMPONENTS[i+1:]}
    total = sum(energies[k] for k in COMPONENTS) + sum(crosses.values())
    require(abs(total-energies["finalResidual"]) < 1e-12, "phase energy decomposition invalid")
    return {"vectors": {k: v.tolist() for k, v in vectors.items()}, "energies": energies,
            "crossTerms": crosses, "telescopingMaxError": error, "summedEnergy": total}


def diagnose(root, source_binding):
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "explicit CPU isolation required")
    torch.set_num_threads(4)
    started = time.monotonic()

    def check():
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(time.monotonic()-started < 210, "CPU layer diagnosis timeout")

    source = bound_json(root, source_binding)
    package = trial.materialize(root)
    package_path = str(Path(source_binding["path"]).parent / "experiment.json").replace("\\", "/")
    package_binding = trial.file_binding(root, package_path)
    require(bound_json(root, package_binding) == package, "source package changed")
    require(source_binding["path"] == trial.previous.ROOT+"/"+package["experimentIdentity"]+"/result.json", "source namespace changed")
    verify_replay(source, source.get("rows"))
    require([a["arm"] for a in source["arms"]] == list(trial.ARMS), "checkpoint arm order changed")
    require(len({a["frozenStateSha256"] for a in source["arms"]}) == 1, "frozen assets differ between arms")
    for b in source["artifacts"]:
        read_bound(root, b)
    artifacts = {Path(b["path"]).name: b for b in source["artifacts"]}
    plan = bound_json(root, package["sourceComparisonPlan"])
    parent_result = bound_json(root, package["sourceComparisonResult"])
    rows, layers, reconstructions = [], [], []
    common_state = None
    reconstruction_hashes = {}
    for arm_index, arm in enumerate(source["arms"]):
        model, heads, normalization, adaptation = trial.comparison.load_frozen_pair(root, plan)
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root, arm["checkpoint"])), map_location="cpu", weights_only=True)
        trial.validate_checkpoint(cp, package, arm["arm"])
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "Denoiser state mismatch")
        require(state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == expected_heads, "frozen heads mismatch")
        require(trial.frozen_hash(model) == cp["frozenStateSha256"] == arm["frozenStateSha256"], "frozen asset mismatch")
        fixed = state_hash((model.autoencoder.state_dict(), heads.state_dict(), normalization))
        require(common_state is None or fixed == common_state, "paired AE, heads or normalization differ")
        common_state = fixed
        before = state_hash((model.state_dict(), normalization))
        dataset = trial.previous.HeadDataset(root, adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(trial.previous.SAMPLES):
                item = dataset[i]
                target, conditions = item["image"][None], item["conditions"][None]
                inputs_before = state_hash((target, conditions))
                # Separate target-fed control, never a generative initializer.
                clean_raw = model.autoencoder.encode(target)
                reconstruction = model.autoencoder.decode(clean_raw)
                clean = trainer.normalize_latent(clean_raw, normalization)
                recon_metrics = rgb_diagnostics(torch, reconstruction, target)
                recon_hash = state_hash(reconstruction)
                if arm_index == 0:
                    reconstruction_hashes[sample] = recon_hash
                    reconstructions.append({"sampleId": sample, "split": "train", "purpose": "target_reconstruction_diagnostic_only",
                        "metrics": recon_metrics, "tensorSha256": recon_hash})
                else:
                    require(reconstruction_hashes[sample] == recon_hash, "paired reconstruction differs")
                for j, seed in enumerate(trial.comparison.SETTINGS["seedsBySample"][i]):
                    check()
                    noise, latent, grid = trial.comparison.paired.pure_noise_rollout(
                        torch, model.predict_velocity, (1, 12, 48, 64), conditions, alpha, seed, check)
                    require(len(grid) == 50 and grid[0][0] == 999 and grid[-1] == (0, -1), "sampling endpoint changed")
                    rgb, evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, normalization),
                        conditions, package["config"], return_stage4_semantic_responsibility_evidence=True)
                    measured = trial.comparison.measure(torch, rgb, evidence, target, conditions, package["config"])
                    expected = source["rows"][arm_index*6+i*3+j]
                    require(measured == expected["measurements"], "recorded layer metrics not reproduced exactly")
                    png_binding = artifacts[f"{arm['arm']}-{i}-{j}.png"]
                    png_matches(root, png_binding, rgb)
                    rows.append({"arm": arm["arm"], "sampleId": sample, "split": "train", "seed": seed,
                        "targetUsedForInitialization": False, "measurements": measured,
                        "baseline": parent_result["rows"][6+i*3+j]["measurements"]})
                    layers.append({"arm": arm["arm"], "sampleId": sample, "seed": seed,
                        "reconstruction": recon_metrics, "base": measured["base"], "final": measured["final"],
                        "phaseDecomposition": phase_decomposition(torch, target, reconstruction, evidence["baseDecodedRgb"], rgb),
                        "normalizedLatentMseAgainstEncodedTarget": float((latent-clean).square().mean()),
                        "noiseStateSha256": state_hash(noise), "generatedLatentSha256": state_hash(latent),
                        "reconstructionTensorSha256": recon_hash, "baselinePng": png_binding, "pngPixelsExact": True,
                        "outsideCoverageMaxAbsoluteChange": measured["outsideCoverageMaxAbsoluteChange"],
                        "coverageFraction": measured["coverageFraction"], "regions": measured["regions"]})
                require(state_hash((target, conditions)) == inputs_before, "input tensors mutated")
        require(state_hash((model.state_dict(), normalization)) == before, "model or normalization mutated")
        del model, heads, cp, dataset
    summary = verify_replay(source, rows)
    for b in [*package["inputReceipts"], *source["artifacts"], source_binding, package_binding]:
        read_bound(root, b)
        check()
    return {"schemaVersion": "ai-painter-paired-periodic-layer-diagnosis-v1", "status": "metrics_replayed_exactly",
        "sourceResult": source_binding, "sourcePackage": package_binding, "summary": summary,
        "rowsSha256": digest(canonical_bytes(rows)), "rowsReplayed": 12, "fixedSeedRollouts": 12,
        "inputBindingsReverified": len(package["inputReceipts"]), "sourceArtifactsReverified": len(source["artifacts"]),
        "reconstructions": reconstructions, "layers": layers, "commonFrozenStateSha256": common_state,
        "cudaInitialized": torch.cuda.is_initialized(), "optimizerSteps": 0, "imagesWritten": 0, "checkpointsWritten": 0,
        "modelAndNormalizationUnchanged": True, "sourcePngPixelsReproduced": 12,
        "limitations": ["Seen train scenes only. Target encoding is a separate reconstruction control, never noise initialization.",
            "Layer attribution is not a unique causal diagnosis of a convolution, loss or training objective.",
            "Phase RMS is not additive; signed vectors and cross terms retain cancellation.",
            "No qualification, model selection, repair, training or publication is performed."],
        "elapsedSeconds": time.monotonic()-started}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(diagnose(Path.cwd(), {"path": args.source, "sha256": args.source_sha256}), allow_nan=False), flush=True)
