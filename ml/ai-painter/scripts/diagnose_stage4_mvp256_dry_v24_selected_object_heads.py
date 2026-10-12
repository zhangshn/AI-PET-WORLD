"""One CPU-only ablation of the already selected dry-world V24 checkpoint.

Diagnostic evidence only: no training, checkpoint selection, qualification, or
publication. The frozen validation subject is not an independent challenge.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import materialize_stage4_mvp256_dry_v24_candidate as materialize  # noqa: E402

core = materialize.core
worker = materialize.worker
profile = materialize.profile

RUN_ID = "mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2"
REVIEW_ROOT = (".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/"
               + RUN_ID + "/dry-review")
REQUEST = REVIEW_ROOT + "/materialization-request.json"
MANIFEST = REVIEW_ROOT + "/candidate-manifest.json"
AUDIT = REVIEW_ROOT + "/independent-audit.json"
REPORT = REVIEW_ROOT + "/selected-object-head-ablation.json"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
MAX_SECONDS = 120


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def head_effect(prediction, target, without, residual, core_mask, support_mask):
    """Describe this head's effect; positive improvement means lower RGB error."""
    import torch

    require(prediction.shape == target.shape == without.shape == residual.shape
            and prediction.shape == (1, 3, 192, 256), "RGB tensor shape differs")
    require(core_mask.shape == support_mask.shape == (1, 1, 192, 256)
            and core_mask.dtype == support_mask.dtype == torch.bool,
            "object mask shape differs")
    require(bool(core_mask.any()) and bool(support_mask.any())
            and bool((~core_mask | support_mask).all()), "empty or uncovered object core")
    require(bool(torch.isfinite(prediction).all()) and bool(torch.isfinite(target).all())
            and bool(torch.isfinite(without).all()) and bool(torch.isfinite(residual).all()),
            "nonfinite object response")
    require(bool((residual[~support_mask.expand_as(residual)] == 0).all()),
            "object head escaped visible support")
    core_rgb = core_mask.expand_as(prediction)
    support_rgb = support_mask.expand_as(prediction)
    with_error = float((prediction - target).abs()[core_rgb].mean())
    without_error = float((without - target).abs()[core_rgb].mean())
    return {
        "corePixels": int(core_mask.sum()),
        "visibleSupportPixels": int(support_mask.sum()),
        "meanAbsoluteHeadResidualOnSupport": float(residual[support_rgb].abs().mean()),
        "meanAbsoluteFinalRgbDeltaOnSupport": float(
            (prediction - without)[support_rgb].abs().mean()),
        "coreRgbMaeWithHead": with_error,
        "coreRgbMaeWithoutHead": without_error,
        "coreRgbMaeImprovementFromHead": without_error - with_error,
    }


def run(*, execute: bool) -> dict:
    import torch

    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CPU-only diagnostic required")
    request_binding = materialize.bind(REQUEST)
    request, _, _, terminal, candidate = materialize.check_request(request_binding)
    manifest_binding = materialize.bind(MANIFEST)
    manifest = materialize.bound_json(manifest_binding)
    audit_binding = materialize.bind(AUDIT)
    audit = materialize.bound_json(audit_binding)
    require(request["runId"] == RUN_ID == manifest["runId"] == audit["runId"]
            and manifest["status"] == "candidate_materialized_review_pending"
            and manifest["selectedCheckpoint"] == request["selectedCheckpoint"]
            and manifest["candidate"]["sampleId"] == worker.SUBJECT_ID
            and audit["status"] == "dry_single_world_review_failed_closed"
            and audit["issueCodes"] == [
                "condition_object_rock_reference_semantic_mismatch",
                "condition_object_vegetation_reference_semantic_mismatch"],
            "selected candidate or audit differs")
    require(not materialize.project_file(REPORT).exists(), "diagnostic already consumed")
    if not execute:
        return {"status": "cpu_preflight_passed_not_executed", "runId": RUN_ID,
                "reportPath": REPORT, "optimizerSteps": 0}

    started = time.monotonic()
    with profile.successor_profile(), core.fit.readonly_guard(), \
            patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
        reader = core.cpu.BoundReader()
        _, order, continuous, rows, _ = core.cpu.select_rows(reader)
        require(rows["validation"]["sampleId"] == worker.SUBJECT_ID,
                "frozen validation subject differs")
        sample, identity = core.cpu.load_sample(
            reader, rows["validation"], order, continuous)
        require(identity["worldId"] == manifest["subject"]["worldId"]
                and identity["factHash"] == manifest["subject"]["factHash"],
                "world facts differ")
        selected = terminal["selectedCheckpointRecord"]
        payload = materialize.read_bound(request["selectedCheckpoint"])
        model, critic, hashes = worker.reload_checkpoint_exact(
            payload, expected_epoch=terminal["selectedEpoch"],
            expected_selection=selected["selection"],
            execution_package=request["executionPackage"],
            candidate_contract=request["candidateContract"], channel_order=order)
        require(hashes == selected["stateSha256"], "checkpoint state differs")
        del critic, payload
        model.eval().requires_grad_(False)
        before = worker.nested_state_hash(model.state_dict())
        require(before == terminal["selectedModelStateSha256"],
                "selected model state differs")
        with torch.inference_mode():
            prediction, evidence = model(sample["conditions"][None],
                                         sample["objectInstanceTable"], return_evidence=True)
            require(materialize.sha(core.png_bytes(prediction[0]))
                    == manifest["candidate"]["rgb"]["sha256"],
                    "diagnostic prediction differs from saved candidate")
            target = sample["image"][None]
            terrain = evidence["terrainRgb"].float().clamp(1e-5, 1 - 1e-5)
            total = evidence["objectResidualSum"].float()
            require(bool(torch.allclose(prediction.float(),
                    torch.sigmoid(torch.logit(terrain) + total), atol=1e-6, rtol=0)),
                    "RGB composition differs")
            effects = {}
            for role in ROLES:
                residual = evidence["maskedObjectRgbResiduals"][role].float()
                without = torch.sigmoid(torch.logit(terrain) + total - residual)
                core_mask = sample["conditions"][order.index(role)].bool()[None, None]
                support_mask = evidence["visibleObjectSupportMasks"][role].bool()
                effects[role] = head_effect(prediction, target, without, residual,
                                            core_mask, support_mask)
        require(worker.nested_state_hash(model.state_dict()) == before
                and all(parameter.grad is None for parameter in model.parameters()),
                "diagnostic mutated model")
        reader.unchanged()
    require(time.monotonic() - started <= MAX_SECONDS, "diagnostic exceeded CPU time cap")
    report = {
        "schemaVersion": "ai-painter-mvp256-dry-v24-selected-head-ablation-v1",
        "status": "diagnostic_completed_not_formal_qualified",
        "runId": RUN_ID, "subjectSampleId": worker.SUBJECT_ID,
        "request": request_binding, "candidateManifest": manifest_binding,
        "independentAudit": audit_binding,
        "selectedCheckpoint": request["selectedCheckpoint"],
        "modelStateSha256": before, "program": materialize.bind(
            "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v24_selected_object_heads.py"),
        "roles": effects,
        "boundary": {"cpuOnly": True, "optimizerSteps": 0,
                     "weightsModified": False, "checkpointSelectionModified": False,
                     "stage4Advanced": False, "independentChallenge": False},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) < 256 * 1024, "diagnostic report exceeds cap")
    binding = materialize.write_exclusive(REPORT, encoded)
    return {"status": report["status"], "report": binding, "roles": effects}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(execute=args.execute), ensure_ascii=False))
