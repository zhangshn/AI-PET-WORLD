"""Read-only V24 validation probe for actual object-head RGB contribution.

One CPU forward, no optimizer or checkpoint write. This historically reviewed
validation row is diagnostic, never an independent challenge or formal gate.
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
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
MAX_SECONDS = 120
MAX_REPORT_BYTES = 2 * 1024 * 1024


def require(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(*, execute: bool) -> dict:
    import torch

    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only probe required")
    started = time.monotonic()
    reader, package, result, context, row, checkpoint = shadow.fixed_inputs()
    program = shadow.binding(Path(__file__).resolve())
    input_report = core.bind(shadow.OUTPUT_PARENT + "/v24-validation-shadow-f11497fa13a0f42d67dc9ff972d04358/result.json")
    prior = reader.json(input_report)
    require(prior["status"] == "diagnostic_completed_not_visual_qualified"
            and prior["sourceRunId"] == shadow.RUN_ID
            and prior["checkpoint"] == checkpoint
            and prior["subject"]["sampleId"] == shadow.SUBJECT_ID,
            "prior shadow evidence differs")
    identity = digest(json.dumps({"program": program, "input": input_report,
                                  "checkpoint": checkpoint}, sort_keys=True,
                                 separators=(",", ":")).encode())[:32]
    report_path = ROOT / shadow.OUTPUT_PARENT / ("v24-head-response-" + identity + ".json")
    require(not report_path.exists(), "probe already consumed; no overwrite")
    if not execute:
        return {"status": "preflight_only", "reportPath": report_path.relative_to(ROOT).as_posix(),
                "sourceRunId": shadow.RUN_ID, "optimizerSteps": 0,
                "formalQualification": False}

    with profile.successor_profile(), core.fit.readonly_guard(), \
            patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
        payload = reader.read(checkpoint)
        package_binding = core.bind(shadow.PARENT + shadow.RUN_ID + "/package.json")
        core.reload_final_cpu(payload, result["finalStateSha256"], context["order"],
                              package_binding, shadow.RUN_ID)
        saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
        model, critic = core.fresh_networks(context["order"])
        model.load_state_dict(saved["modelState"], strict=True)
        critic.load_state_dict(saved["criticState"], strict=True)
        require({"Model": core.cpu.state_hash(model), "Critic": core.cpu.state_hash(critic)}
                == result["finalStateSha256"], "checkpoint state differs")
        del critic, saved, payload
        model.eval().requires_grad_(False)
        before = core.cpu.state_hash(model)
        sample, subject = core.cpu.load_sample(reader, row, context["order"], context["continuous"])
        require(sample["split"] == "validation" and sample["sampleId"] == shadow.SUBJECT_ID,
                "subject differs")
        with torch.inference_mode():
            prediction, evidence = model(sample["conditions"][None],
                                         sample["objectInstanceTable"], return_evidence=True)
            require(digest(core.png_bytes(prediction[0])) == prior["images"]["prediction.png"]["sha256"],
                    "prediction differs from frozen shadow")
            target = sample["image"][None]
            terrain = evidence["terrainRgb"].float().clamp(1e-5, 1 - 1e-5)
            residual_sum = evidence["objectResidualSum"].float()
            require(torch.allclose(prediction.float(), torch.sigmoid(torch.logit(terrain) + residual_sum),
                                   atol=1e-6, rtol=0), "RGB composition differs")
            roles = {}
            for role in ROLES:
                mask = sample["conditions"][context["order"].index(role)].bool()[None, None]
                visible = evidence["visibleObjectSupportMasks"][role].bool()
                residual = evidence["maskedObjectRgbResiduals"][role].float()
                require(bool(mask.any()) and bool(visible.any()), "empty object role")
                require(bool(torch.all(residual[~visible.expand_as(residual)] == 0)),
                        "object residual escaped support")
                without = torch.sigmoid(torch.logit(terrain) + residual_sum - residual)
                core_rgb = mask.expand_as(prediction)
                support_rgb = visible.expand_as(prediction)
                current_error = (prediction - target).abs()
                ablated_error = (without - target).abs()
                roles[role] = {
                    "corePixels": int(mask.sum()), "visibleSupportPixels": int(visible.sum()),
                    "meanAbsoluteHeadResidualOnSupport": float(residual[support_rgb].abs().mean()),
                    "meanAbsoluteFinalRgbDeltaOnSupport": float((prediction - without)[support_rgb].abs().mean()),
                    "coreRgbMaeWithHead": float(current_error[core_rgb].mean()),
                    "coreRgbMaeWithoutHead": float(ablated_error[core_rgb].mean()),
                    "coreRgbMaeImprovementFromHead": float(
                        ablated_error[core_rgb].mean() - current_error[core_rgb].mean()),
                }
        require(core.cpu.state_hash(model) == before and all(p.grad is None for p in model.parameters()),
                "inference mutated model")
    reader.unchanged()
    context["reader"].unchanged()
    require(time.monotonic() - started < MAX_SECONDS, "CPU time limit exceeded")
    report = {
        "schemaVersion": "ai-painter-v24-object-head-response-diagnostic-v1",
        "status": "diagnostic_completed_not_formal_qualified",
        "sourceRunId": shadow.RUN_ID, "subject": subject,
        "inputReport": input_report, "program": program, "checkpoint": checkpoint,
        "roles": roles,
        "interpretation": "single_validation_sample_head_ablation_not_causal_training_proof",
        "boundary": {"cpuOnly": True, "modelForwardCalls": 1, "optimizerSteps": 0,
                     "weightsModified": False, "registryWritten": False,
                     "independentChallengeResult": False, "checkpointPromotable": False,
                     "formalStage4Qualified": False},
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(UTC).isoformat(),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) <= MAX_REPORT_BYTES, "report exceeds byte cap")
    shadow.write_exclusive(report_path, encoded)
    return {"report": shadow.binding(report_path), "roles": roles,
            "status": report["status"]}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(execute=args.execute), ensure_ascii=False))
