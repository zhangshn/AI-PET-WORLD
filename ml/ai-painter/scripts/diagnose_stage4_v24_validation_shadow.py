"""One bounded, diagnostic-only V24 inference on the frozen first validation row.

This is not formal inference, Stage4 qualification, checkpoint promotion, or an
independent challenge result. The historically reviewed validation subject is
used only to test whether a train-only endpoint responds outside its train set.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import painter_stage4_v24_object_head_core_priority_probe as profile  # noqa: E402

core = profile.core
RUN_ID = "v24-resource-bound-core-priority-049a77d0f96ffff8eb1ee4b2363e28f1802ab0bf4fbd6a15"
PARENT = ".runtime/ai-painter/learning-capacity-experiments/"
OUTPUT_PARENT = ".runtime/ai-painter/validation-shadow-diagnostics"
SUBJECT_ID = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
MAX_SECONDS = 120
MAX_OUTPUT_BYTES = 16 * 1024 * 1024


def require(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def binding(path: Path) -> dict[str, str]:
    raw = path.read_bytes()
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(raw)}


def write_exclusive(path: Path, data: bytes) -> None:
    require(len(data) <= MAX_OUTPUT_BYTES, "shadow output exceeds byte cap")
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def fixed_inputs() -> tuple[object, dict, dict, dict, dict, dict]:
    reader = core.cpu.BoundReader()
    package_path = PARENT + RUN_ID + "/package.json"
    terminal_path = PARENT + RUN_ID + "/terminal.json"
    package = reader.json(core.bind(package_path))
    terminal = reader.json(core.bind(terminal_path))
    result = reader.json(terminal["result"])
    require(package["experimentIdentity"] == result["experimentIdentity"] == RUN_ID,
            "V24 run identity differs")
    require(terminal["exitCode"] == 0 and terminal["timedOut"] is False
            and result["executionState"] == "completed" and result["completedEpochs"] == 48
            and result["optimizerSteps"] == {"generator": 2304, "discriminator": 2304},
            "V24 final training terminal invalid")
    require(result["checkpointPromotable"] is False and result["stage4QualificationGranted"] is False
            and result["validationContentRead"] is False and result["challengeContentRead"] is False
            and result["regressionContentRead"] is False, "train-only result boundary changed")
    with profile.successor_profile():
        context = core.collect_inputs(registry=package["inputs"]["registryBeforeStart"])
        core.validate_policy(reader.json(package["policy"]), context["inputs"])
        require(context["inputs"] == package["inputs"], "V24 frozen inputs differ")
        core.validate_result_contract(result, package)
    manifest, order, continuous, rows, memberships = core.cpu.select_rows(reader)
    require(manifest["datasetReleaseIdentity"] == package["sourceDatasetIdentity"],
            "validation dataset release differs")
    require(order == context["order"] and continuous == context["continuous"],
            "validation condition type/order differs")
    require(memberships["train"]["selectionSha256"] == package["inputs"]["trainSelectionSha256"],
            "training split changed")
    row = rows["validation"]
    require(row["sampleId"] == SUBJECT_ID and row["split"] == "validation",
            "fixed validation subject differs")
    checkpoint = result["checkpoint"]
    checkpoint_path = core.cpu.project_file(ROOT, checkpoint["path"])
    require(0 < checkpoint_path.stat().st_size <= 128 * 1024 * 1024,
            "checkpoint size outside diagnostic cap")
    registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    require(registry.get("activeExecution") is None, "active execution must remain untouched")
    return reader, package, result, context, row, checkpoint


def validation_metrics(prediction, sample: dict, order: list[str]) -> dict:
    """Descriptive pixel errors only; never borrow the train-only fit gate."""
    import torch

    require(sample.get("split") == "validation", "validation metric rejects other splits")
    target, conditions = sample["image"][None], sample["conditions"]
    require(prediction.shape == target.shape == (1, 3, 192, 256), "RGB shape differs")
    require(conditions.shape == (len(order), 192, 256), "condition shape differs")
    require(bool(torch.isfinite(prediction).all() and torch.isfinite(target).all()
                 and torch.isfinite(conditions).all()), "nonfinite validation tensor")
    require(bool(((prediction >= 0) & (prediction <= 1)).all()), "prediction outside RGB range")
    difference = (prediction - target).abs()[0]
    roles = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
    objects = {}
    for role in roles:
        require(order.count(role) == 1, "missing or duplicate object role: " + role)
        mask = conditions[order.index(role)]
        require(bool(((mask == 0) | (mask == 1)).all()), "nonbinary object mask")
        pixels = int(mask.sum())
        objects[role] = {"conditionPixelCount": pixels,
                         "rgbMae": float(difference[:, mask.bool()].mean()) if pixels else None}
    return {"rgbMae": float(difference.mean()), "objects": objects,
            "meaning": "validation_target_comparison_diagnostic_not_visual_or_semantic_review"}


def execute() -> dict:
    import torch

    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only diagnostic required")
    started = time.monotonic()

    def deadline() -> None:
        require(time.monotonic() - started < MAX_SECONDS, "shadow CPU budget exceeded")

    reader, package, result, context, row, checkpoint = fixed_inputs()
    program = binding(Path(__file__).resolve())
    identity_payload = {"runId": RUN_ID, "checkpoint": checkpoint,
                        "subjectId": SUBJECT_ID, "program": program}
    diagnostic_id = "v24-validation-shadow-" + sha(json.dumps(
        identity_payload, sort_keys=True, separators=(",", ":")).encode())[:32]
    output = ROOT / OUTPUT_PARENT / diagnostic_id
    require(not output.exists(), "shadow diagnostic already consumed; no overwrite/retry")
    output.mkdir(parents=True, exist_ok=False)
    try:
        deadline()
        with profile.successor_profile(), core.fit.readonly_guard(), \
                patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA query prohibited")):
            payload = reader.read(checkpoint)
            package_binding = core.bind(PARENT + RUN_ID + "/package.json")
            core.reload_final_cpu(payload, result["finalStateSha256"], context["order"],
                                  package_binding, RUN_ID)
            saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
            model, critic = core.fresh_networks(context["order"])
            model.load_state_dict(saved["modelState"], strict=True)
            critic.load_state_dict(saved["criticState"], strict=True)
            require({"Model": core.cpu.state_hash(model), "Critic": core.cpu.state_hash(critic)}
                    == result["finalStateSha256"], "CPU checkpoint state differs")
            del critic, saved, payload
            model.eval().requires_grad_(False)
            state_before = core.cpu.state_hash(model)
            sample, sample_identity = core.cpu.load_sample(reader, row,
                                                          context["order"], context["continuous"])
            require(sample["sampleId"] == SUBJECT_ID and sample["split"] == "validation",
                    "non-validation image decoded")
            deadline()
            prediction = model(sample["conditions"][None], sample["objectInstanceTable"])
            require(bool(torch.isfinite(prediction).all()), "nonfinite prediction")
            measurements = validation_metrics(prediction, sample, context["order"])
            require(core.cpu.state_hash(model) == state_before
                    and all(p.grad is None for p in model.parameters()), "inference mutated model")
            predicted_png = core.png_bytes(prediction[0])
            target_png = core.png_bytes(sample["image"])
            _, comparison_png = core.final_image_bytes(prediction[0], sample["image"])
        deadline()
        reader.unchanged()
        context["reader"].unchanged()
        images = {}
        for name, data in (("original.png", target_png), ("prediction.png", predicted_png),
                           ("comparison.png", comparison_png)):
            write_exclusive(output / name, data)
            images[name] = binding(output / name)
        report = {"schemaVersion": "ai-painter-v24-validation-shadow-diagnostic-v1",
                  "status": "diagnostic_completed_not_visual_qualified",
                  "diagnosticId": diagnostic_id, "sourceRunId": RUN_ID,
                  "sourceResult": core.bind(PARENT + RUN_ID + "/result.json"),
                  "checkpoint": checkpoint, "program": program,
                  "subject": sample_identity, "measurements": measurements,
                  "images": images, "cpuThreads": 2, "elapsedSeconds": time.monotonic() - started,
                  "limits": {"maxWallSeconds": MAX_SECONDS, "maxOutputBytes": MAX_OUTPUT_BYTES,
                             "modelForwardCalls": 1, "optimizerSteps": 0},
                  "boundary": {"historicallyReviewedValidationSubject": True,
                               "currentModelTrainingExposure": False,
                               "formalInferenceEligible": False,
                               "independentChallengeResult": False,
                               "visualQualified": False, "stage4Qualified": False,
                               "runtimeAllowed": False, "checkpointPromotable": False,
                               "registryWritten": False, "gpuStarted": False,
                               "weightsModified": False, "challengeContentRead": False,
                               "regressionContentRead": False},
                  "recordedAtUtc": datetime.now(UTC).isoformat()}
        encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
        require(sum(p.stat().st_size for p in output.iterdir()) + len(encoded) <= MAX_OUTPUT_BYTES,
                "shadow output byte cap exceeded")
        write_exclusive(output / "result.json", encoded)
        return {"result": binding(output / "result.json"), "status": report["status"],
                "rgbMae": measurements["rgbMae"], "images": images}
    except Exception as error:
        failure = {"status": "diagnostic_failed_closed", "diagnosticId": diagnostic_id,
                   "error": str(error), "recordedAtUtc": datetime.now(UTC).isoformat(),
                   "optimizerSteps": 0, "registryWritten": False}
        write_exclusive(output / "failure.json", (json.dumps(failure, ensure_ascii=False) + "\n").encode())
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.execute:
        print(json.dumps(execute(), ensure_ascii=False))
    else:
        _, package, result, _, row, checkpoint = fixed_inputs()
        print(json.dumps({"status": "preflight_only_no_pixels_or_checkpoint_loaded",
                          "sourceRunId": package["experimentIdentity"],
                          "sourceStatus": result["status"], "checkpoint": checkpoint,
                          "subjectId": row["sampleId"], "maxWallSeconds": MAX_SECONDS,
                          "optimizerSteps": 0, "formalQualification": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
