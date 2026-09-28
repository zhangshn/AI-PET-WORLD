"""Frozen V18 epoch-9/20 train-only visual fit fork; CPU inference, no updates."""
from __future__ import annotations

from datetime import datetime, timezone
import io
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
import check_stage4_mvp_v19_object_highpass_cpu as source_loader
import train_stage4_mvp_structured_object_v18_dry_stage0 as training
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    original_object_class_spatial_loss,
)

PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp_v18_train_fit_fork_cpu.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_mvp_v18_train_fit_fork_cpu.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-v18-train-fit-fork-diagnostics/diagnostic-001"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
EPOCHS = (9, 20)
ORDINALS = (0, 43)
MAX_SECONDS = 120


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def checkpoint_identity(saved, package, package_binding, epoch_row, epoch):
    require(saved.get("schemaVersion") == training.CHECKPOINT_SCHEMA
            and saved.get("epoch") == epoch
            and saved.get("executionPackage") == package_binding
            and saved.get("validationScore") ==
            epoch_row["checkpointSelection"]["meanExistingValidationObjective"]
            and saved.get("checkpointSelection") == epoch_row["checkpointSelection"],
            "frozen epoch checkpoint/selection differs")
    for key in ("runId", "packageId", "capabilityVersion", "candidateContract",
                "cpuQualification", "gpuQualification", "datasetManifest", "dryScope",
                "trainingExecutionTicket", "precisionExecutionPlan", "modelPlan"):
        require(saved.get(key) == package[key], "checkpoint package lineage differs: " + key)
    require(saved.get("optimizerStepsGenerator") == epoch * 48
            and saved.get("optimizerStepsDiscriminator") == epoch * 48,
            "epoch optimizer history differs")


def region_metrics(predicted, target, conditions, order):
    import torch
    from torch.nn import functional as F
    require(predicted.shape == target.shape == (1, 3, 192, 256), "RGB shape differs")
    error = predicted.float() - target.float()
    lowpass = F.avg_pool2d(error, 5, stride=1, padding=2).abs()[0]
    rgb = error.abs()[0]
    horizontal = (error[:, :, :, 1:] - error[:, :, :, :-1]).abs()[0]
    vertical = (error[:, :, 1:, :] - error[:, :, :-1, :]).abs()[0]
    results = {}
    for role in ROLES:
        mask = conditions[order.index(role)] > .5
        require(bool(mask.any()), "fixed train role absent: " + role)
        results[role] = {
            "pixels": int(mask.sum()),
            "rgbMae": float(rgb[:, mask].mean()),
            "lowpass5RgbMae": float(lowpass[:, mask].mean()),
            "signedEdgeDifferenceMae": float((horizontal[:, mask[:, 1:]].mean() +
                                              vertical[:, mask[1:, :]].mean()) / 2),
        }
    require(all(torch.isfinite(value).all() for value in (rgb, lowpass, horizontal, vertical)),
            "nonfinite region metric")
    return results


def side_by_side(sample, outputs):
    """Exact 8-bit RGB panels with a diagnostic-only header; no retouching."""
    from PIL import Image, ImageDraw
    def pixels(tensor):
        return tensor.detach().mul(255).round().clamp(0, 255).byte().permute(1, 2, 0).numpy()
    panels = [Image.fromarray(pixels(sample["image"])),
              *(Image.fromarray(pixels(outputs[epoch])) for epoch in EPOCHS)]
    result = Image.new("RGB", (768, 244), (255, 255, 255))
    draw = ImageDraw.Draw(result)
    for index, (label, panel) in enumerate(zip(
            ("TRAIN ORIGINAL", "V18 EPOCH 09", "V18 EPOCH 20"), panels)):
        x = 256 * index
        draw.text((x + 4, 5), label, fill=(0, 0, 0))
        result.paste(panel, (x, 26))
    draw.text((4, 222), "TRAIN-ONLY DIAGNOSTIC / NOT CANDIDATE OR QUALIFICATION", fill=(0, 0, 0))
    return result


def run():
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
        build_native_rgb_structured_object_v18_cpu,
    )
    started = time.monotonic()
    reader = cpu.BoundReader()
    (package_binding, package, worker_binding, worker, final_binding, _selected_checkpoint,
     rows, order, continuous) = source_loader.load_inputs(reader)
    require(tuple(source_loader.TRAIN_ORDINALS) == ORDINALS, "fixed train ordinals differ")
    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "GPU already initialized")
    epoch_bindings, model_state_hashes, models = {}, {}, {}
    for epoch in EPOCHS:
        prefix = source_loader.RUN_ROOT + f"/epochs/epoch-{epoch:02d}"
        summary_binding = source_loader.binding(prefix + ".json")
        summary = reader.json(summary_binding)
        checkpoint = summary["checkpoint"]
        require(summary["epoch"] == epoch and checkpoint["path"] == prefix + ".pt",
                "epoch checkpoint path differs")
        require(cpu.project_file(ROOT, checkpoint["path"]).stat().st_size <= 128 * 1024 * 1024,
                "checkpoint exceeds bounded read")
        saved = torch.load(io.BytesIO(reader.read(checkpoint)), map_location="cpu", weights_only=True)
        checkpoint_identity(saved, package, package_binding, summary, epoch)
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=order, base_channels=48, patch_channels=32)
        model.load_state_dict(saved["modelState"], strict=True)
        require(cpu.state_hash(model) == saved["modelStateSha256"],
                "reloaded epoch model state differs")
        model.eval().requires_grad_(False)
        models[epoch] = model
        model_state_hashes[epoch] = saved["modelStateSha256"]
        epoch_bindings[epoch] = {"epochSummary": summary_binding, "checkpoint": checkpoint}
        del saved
    observations, visualizations = [], []
    output_dir = cpu.project_file(ROOT, OUTPUT_ROOT)
    require(not output_dir.exists(), "diagnostic output namespace already exists")
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         torch.inference_mode():
        for ordinal, source in zip(ORDINALS, rows):
            sample, identity = cpu.load_sample(reader, source, order, continuous)
            require(sample["split"] == identity["split"] == "train", "non-train pixels prohibited")
            before = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            outputs, metrics = {}, {}
            for epoch in EPOCHS:
                predicted = models[epoch](sample["conditions"][None], sample["objectInstanceTable"])
                require(bool(torch.isfinite(predicted).all() and
                             ((predicted >= 0) & (predicted <= 1)).all()),
                        "nonfinite/out-of-range frozen epoch RGB")
                outputs[epoch] = predicted[0]
                regions = region_metrics(predicted, sample["image"][None],
                                         sample["conditions"], order)
                _, correlations = original_object_class_spatial_loss(
                    predicted, sample, order, split="train")
                for role in ROLES:
                    regions[role]["centeredLumaCorrelation"] = float(correlations[role])
                metrics[str(epoch)] = regions
            require(before == {key: cpu.tensor_hash(sample[key]) for key in before},
                    "source train sample changed")
            side = side_by_side(sample, outputs)
            output_dir.mkdir(parents=True, exist_ok=True)
            image_path = OUTPUT_ROOT + f"/train-ordinal-{ordinal:02d}-side-by-side.png"
            side.save(cpu.project_file(ROOT, image_path), format="PNG")
            visualizations.append({"trainOrdinal": ordinal, "image": source_loader.binding(image_path)})
            observations.append({"trainOrdinal": ordinal, "sampleIdentity": identity,
                                 "epochMetrics": metrics})
            require(time.monotonic() - started <= MAX_SECONDS,
                    "train-fit fork exceeded 120-second budget")
    require(all(cpu.state_hash(models[epoch]) == model_state_hashes[epoch]
                and all(parameter.grad is None for parameter in models[epoch].parameters())
                for epoch in EPOCHS), "frozen epoch state changed")
    require(not torch.cuda.is_initialized(), "GPU initialized during CPU diagnosis")
    reader.unchanged()
    report = {
        "schemaVersion": "ai-painter-stage4-mvp-v18-train-fit-fork-cpu-diagnostic-v1",
        "status": "train_only_fit_observed_no_qualification",
        "program": source_loader.binding(PROGRAM), "testProgram": source_loader.binding(TEST),
        "sourceV18RunId": source_loader.RUN_ID, "sourceExecutionPackage": package_binding,
        "sourceWorkerTerminal": worker_binding, "sourceTrainingTerminal": final_binding,
        "epochs": {str(epoch): {**epoch_bindings[epoch],
                                "modelStateSha256": model_state_hashes[epoch]} for epoch in EPOCHS},
        "observations": observations, "visualizations": visualizations,
        "trainOnlyDiagnostic": True, "candidateImages": False,
        "checkpointSelectionChanged": False, "optimizerCreated": False,
        "optimizerSteps": 0, "weightsModified": False, "gpuInitialized": False,
        "validationPixelsRead": False, "challengePixelsRead": False,
        "regressionPixelsRead": False, "formalStage0QualificationGranted": False,
        "stage4ProgressIncreaseGranted": False, "runtimePublicationGranted": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    report_path = OUTPUT_ROOT + "/report.json"
    with cpu.project_file(ROOT, report_path).open("x", encoding="utf8") as target:
        json.dump(report, target, indent=2, ensure_ascii=False)
        target.write("\n")
    return {"status": report["status"], "report": source_loader.binding(report_path),
            "visualizations": visualizations, "elapsedSeconds": report["elapsedSeconds"]}


if __name__ == "__main__":
    print(json.dumps(run()))
