"""One fixed validation-row V23/V24 endpoint comparison; diagnostic only.

Neither endpoint was trained on this row by these runs. The row has been
historically reviewed, so this is not an independent challenge or selection
authority. No optimizer, GPU, model mutation, or registry write is allowed.
"""

from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import io
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_v24_validation_shadow as shadow  # noqa: E402

core = shadow.core
profile = shadow.profile
V23_RUN = "v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6"
V23_RESULT = shadow.PARENT + V23_RUN + "/result.json"
V24_SHADOW = (shadow.OUTPUT_PARENT
              + "/v24-validation-shadow-f11497fa13a0f42d67dc9ff972d04358/result.json")
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
MAX_SECONDS = 120


def require(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(*, execute: bool) -> dict:
    import torch

    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only comparator required")
    started = time.monotonic()
    reader, v24_package, v24_result, context, row, v24_checkpoint = shadow.fixed_inputs()
    v23_binding = core.bind(V23_RESULT)
    v23_result = reader.json(v23_binding)
    require(v23_result["experimentIdentity"] == V23_RUN
            and v23_result["executionState"] == "completed"
            and v23_result["checkpointPromotable"] is False
            and v23_result["validationContentRead"] is False
            and v23_result["modelPlan"]["architectureId"]
            == v24_result["modelPlan"]["architectureId"]
            and v23_result["checkpoint"]["sha256"] != v24_checkpoint["sha256"],
            "V23/V24 endpoints not comparable")
    v24_shadow_binding = core.bind(V24_SHADOW)
    v24_shadow = reader.json(v24_shadow_binding)
    require(v24_shadow["checkpoint"] == v24_checkpoint
            and v24_shadow["subject"]["sampleId"] == shadow.SUBJECT_ID,
            "V24 shadow binding differs")
    program = shadow.binding(Path(__file__).resolve())
    identity = digest(json.dumps({"program": program, "v23": v23_binding,
                                  "v24": v24_shadow_binding}, sort_keys=True,
                                 separators=(",", ":")).encode())[:32]
    report_path = ROOT / shadow.OUTPUT_PARENT / ("v23-v24-validation-" + identity + ".json")
    require(not report_path.exists(), "comparison already consumed; no overwrite")
    if not execute:
        return {"status": "preflight_only", "reportPath": report_path.relative_to(ROOT).as_posix(),
                "forwardCalls": 0, "optimizerSteps": 0, "formalQualification": False}

    with profile.successor_profile(), core.fit.readonly_guard(), \
            patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
        sample, subject = core.cpu.load_sample(reader, row, context["order"], context["continuous"])
        require(sample["split"] == "validation" and sample["sampleId"] == shadow.SUBJECT_ID,
                "fixed validation row differs")
        measurements = {}
        for label, record in (("v23", v23_result), ("v24", v24_result)):
            checkpoint = record["checkpoint"]
            payload = reader.read(checkpoint)
            saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
            model, critic = core.fresh_networks(context["order"])
            model.load_state_dict(saved["modelState"], strict=True)
            critic.load_state_dict(saved["criticState"], strict=True)
            require({"Model": core.cpu.state_hash(model), "Critic": core.cpu.state_hash(critic)}
                    == record["finalStateSha256"], label + " checkpoint state differs")
            del critic, saved, payload
            model.eval().requires_grad_(False)
            before = core.cpu.state_hash(model)
            with torch.inference_mode():
                predicted, evidence = model(sample["conditions"][None],
                                            sample["objectInstanceTable"], return_evidence=True)
                target = sample["image"][None]
                require(bool(torch.isfinite(predicted).all()), "nonfinite prediction")
                core_metrics = shadow.validation_metrics(predicted, sample, context["order"])
                support = {}
                for role in ROLES:
                    mask = evidence["visibleObjectSupportMasks"][role].bool()
                    require(bool(mask.any()), "empty visible object support")
                    support[role] = {"pixels": int(mask.sum()),
                                     "rgbMae": float((predicted - target).abs()[mask.expand_as(predicted)].mean())}
                if label == "v24":
                    require(digest(core.png_bytes(predicted[0]))
                            == v24_shadow["images"]["prediction.png"]["sha256"],
                            "V24 prediction differs from frozen shadow")
            require(core.cpu.state_hash(model) == before
                    and all(parameter.grad is None for parameter in model.parameters()),
                    label + " model mutated")
            measurements[label] = {"checkpoint": checkpoint, "fullRgbMae": core_metrics["rgbMae"],
                                   "core": core_metrics["objects"], "support": support}
            del model
    reader.unchanged()
    context["reader"].unchanged()
    require(time.monotonic() - started < MAX_SECONDS, "CPU time limit exceeded")
    changes = {role: {
        "coreRgbMaeDeltaV24MinusV23": (measurements["v24"]["core"][role]["rgbMae"]
                                        - measurements["v23"]["core"][role]["rgbMae"]),
        "supportRgbMaeDeltaV24MinusV23": (measurements["v24"]["support"][role]["rgbMae"]
                                           - measurements["v23"]["support"][role]["rgbMae"]),
    } for role in ROLES}
    report = {
        "schemaVersion": "ai-painter-v23-v24-validation-endpoint-comparison-v1",
        "status": "diagnostic_completed_not_formal_qualified", "program": program,
        "v23Result": v23_binding, "v24Shadow": v24_shadow_binding,
        "subject": subject, "measurements": measurements, "changes": changes,
        "boundary": {"sourceSplit": "validation", "historicallyReviewedSubject": True,
                     "independentChallengeResult": False, "cpuOnly": True,
                     "modelForwardCalls": 2, "optimizerSteps": 0,
                     "weightsModified": False, "registryWritten": False,
                     "checkpointPromotable": False, "formalStage4Qualified": False},
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(UTC).isoformat(),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) < 2 * 1024 * 1024, "report byte cap exceeded")
    shadow.write_exclusive(report_path, encoded)
    return {"report": shadow.binding(report_path), "fullRgbMae": {
        label: value["fullRgbMae"] for label, value in measurements.items()},
        "changes": changes, "optimizerSteps": 0}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(execute=args.execute), ensure_ascii=False))
