"""CPU-only decomposition of a saved train-only experiment; no optimizer/GPU.

Reconstruction sees the target RGB by design. It is diagnostic evidence, never
an inference Candidate or a qualification decision. Saved sampling outputs are
read unchanged, not regenerated or filtered to improve their appearance.
"""
import argparse
import io
import json
from pathlib import Path
import time

from painter_learning_capacity_experiment import (
    ExperimentDataset, canonical_bytes, digest, file_binding, now, read_bound,
    require, save_json, validate_experiment_checkpoint,
)


def image_metrics(torch, actual, target):
    require(actual.shape == target.shape and actual.ndim == 4, "metric shape mismatch")
    require(bool(torch.isfinite(actual).all()), "nonfinite diagnostic RGB")
    def lap(x):
        return 4 * x[..., 1:-1, 1:-1] - x[..., :-2, 1:-1] - x[..., 2:, 1:-1] - x[..., 1:-1, :-2] - x[..., 1:-1, 2:]
    return {"rgbMae": float((actual - target).abs().mean()),
            "laplacianMae": float((lap(actual) - lap(target)).abs().mean()),
            "laplacianAbsMean": float(lap(actual).abs().mean())}


def diagnose(root, source):
    import numpy as np
    from PIL import Image
    import torch
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb, save_tensor_png
    started = time.perf_counter()
    require(not torch.cuda.is_initialized(), "diagnosis must remain CPU-only")
    torch.set_num_threads(4)
    result = json.loads(read_bound(root, source))
    require(result["status"] == "experiment_executed_not_visual_qualified", "source execution incomplete")
    directory = Path(source["path"]).parent
    package_binding = file_binding(root, str(directory / "experiment.json").replace("\\", "/"))
    package = json.loads(read_bound(root, package_binding))
    require(package["experimentIdentity"] == result["experimentIdentity"], "source package identity mismatch")
    payload = {k: v for k, v in package.items() if k != "experimentIdentity"}
    require(package["experimentIdentity"] == "painter-learning-capacity-" + digest(canonical_bytes(payload)), "source package payload mismatch")
    # The full source snapshot is intact before this diagnosis. Later versions
    # cannot silently reuse it with a changed decoder or condition reader.
    for receipt in package["inputReceipts"]:
        read_bound(root, receipt)
    artifacts = {Path(b["path"]).name: b for b in result["artifacts"]}
    checkpoint_binding = artifacts["experimental-checkpoint.pt"]
    checkpoint = torch.load(io.BytesIO(read_bound(root, checkpoint_binding)), map_location="cpu", weights_only=True)
    validate_experiment_checkpoint(checkpoint, package)
    plan = {"schemaVersion": "ai-painter-learning-capacity-noise-diagnosis-v1", "sourceResult": source,
            "sourcePackage": package_binding, "checkpoint": checkpoint_binding,
            "program": file_binding(root, "ml/ai-painter/scripts/diagnose_learning_capacity_noise.py"),
            "device": "cpu", "cpuThreads": 4, "maxWallSeconds": 120, "optimizerUpdatesAllowed": False,
            "observations": ["target", "frozen_ae_reconstruction", "target_latent_final_rgb", "saved_full_sampling_rgb"],
            "formalQualificationAllowed": False}
    identity = "noise-diagnosis-" + digest(canonical_bytes(plan))
    output = root / ".runtime/ai-painter/learning-capacity-experiments" / identity
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    try:
        model = build_complete_world_system(checkpoint["config"])
        foundation = torch.load(io.BytesIO(read_bound(root, package["foundation"])), map_location="cpu", weights_only=True)
        model.autoencoder.load_state_dict(foundation["autoencoderState"], strict=True)
        model.denoiser.load_state_dict(checkpoint["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        before = state_hash(model.state_dict())
        require(state_hash(model.denoiser.state_dict()) == checkpoint["denoiserStateSha256"], "checkpoint state mismatch")
        require(state_dict_sha256(model.autoencoder.state_dict()) == checkpoint["foundationStateSha256"], "foundation state mismatch")
        dataset = ExperimentDataset(root, package)
        rows = []
        with torch.inference_mode():
            for index in range(2):
                require(time.perf_counter() - started < plan["maxWallSeconds"], "CPU diagnosis timeout")
                item = dataset[index]
                target, conditions = item["image"][None], item["conditions"][None]
                latent = model.autoencoder.encode(target)
                reconstruction = model.autoencoder.decode(latent)
                oracle_final = decode_final_visible_rgb(model, latent, conditions, checkpoint["config"])
                saved = read_bound(root, artifacts[f"after-{index}.png"])
                with Image.open(io.BytesIO(saved)) as im:
                    require(im.mode == "RGB" and im.size == (256, 192), "saved sampling RGB mismatch")
                    sampled = torch.from_numpy(np.array(im, copy=True)).permute(2, 0, 1)[None].float() / 255
                values = {"target": target, "ae_reconstruction": reconstruction, "target_latent_final": oracle_final, "saved_sampling": sampled}
                metrics = {key: image_metrics(torch, value, target) for key, value in values.items()}
                for key in ("target", "ae_reconstruction", "target_latent_final"):
                    save_tensor_png(values[key][0], output / f"{key}-{index}.png")
                rows.append({"sampleId": item["sampleId"], "split": "train", "metrics": metrics,
                             "savedSamplingImage": artifacts[f"after-{index}.png"]})
                print(json.dumps(rows[-1]), flush=True)
        require(state_hash(model.state_dict()) == before, "read-only diagnosis changed model")
        require(not torch.cuda.is_initialized(), "diagnosis initialized CUDA")
        for receipt in package["inputReceipts"]:
            read_bound(root, receipt)
        evidence = {**plan, "diagnosisIdentity": identity, "status": "cpu_noise_diagnosis_completed_not_visual_qualified",
                    "executionState": "completed", "recordedAtUtc": now(), "gpuStarted": False, "trainingStarted": False,
                    "optimizerSteps": 0, "modelStateUnchanged": True, "rows": rows, "elapsedSeconds": time.perf_counter() - started,
                    "images": [file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in output.glob("*.png")],
                    "interpretationLimits": ["Target-latent reconstructions consume original RGB and are not generative outputs.",
                                             "CPU reconstruction and saved GPU sampling are diagnostic comparisons, not same-device byte reproduction.",
                                             "Metrics on two seen train originals cannot establish generalization or semantic quality."]}
        save_json(output / "result.json", evidence)
        print(json.dumps(file_binding(root, str((output / "result.json").relative_to(root)).replace("\\", "/"))), flush=True)
    except Exception as error:
        save_json(output / "result.json", {"status": "cpu_noise_diagnosis_failed_closed", "executionState": "failed_closed", "error": str(error), "plan": plan})
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-result", required=True)
    parser.add_argument("--source-sha256", required=True)
    args = parser.parse_args()
    diagnose(Path.cwd(), {"path": args.source_result, "sha256": args.source_sha256})
