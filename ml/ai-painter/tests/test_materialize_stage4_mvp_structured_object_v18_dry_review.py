"""CPU-only V18 materialization gates; no live checkpoint or GPU is read."""
from copy import deepcopy
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import materialize_stage4_mvp_structured_object_v18_dry_review as review
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import OBJECT_CLASSES, rank_epoch
from test_stage4_mvp_structured_object_v18_worker_gate import fixture as worker_fixture


def binding(path, n=1):
    return {"path": path, "sha256": f"{n:064x}"}


def terminal_fixture():
    package, _ = worker_fixture()
    root = package["outputRoot"]
    request = {"executionPackage": binding(root + "/execution-package.json"),
        "workerTerminal": binding(root + "/phase-terminal.json"),
        "trainingTerminal": binding(root + "/training-finalize.json"),
        "checkpoint": binding(root + "/epochs/epoch-24.pt", 24),
        "outputRoot": root + "/dry-review", "device": "cpu",
        "program": binding(review.PROGRAM_PATH), "tests": binding(review.TEST_PATH)}
    terminal = {"schemaVersion": review.training.TERMINAL_SCHEMA,
        **{key: deepcopy(package[key]) for key in ("capabilityVersion", "runId", "packageId",
            "candidateContract", "cpuQualification", "gpuQualification", "datasetManifest",
            "dryScope", "trainingExecutionTicket", "precisionExecutionPlan", "stage")},
        "status": "training_completed_review_pending", "executionState": "completed",
        "executionPackage": request["executionPackage"], "checkpoint": request["checkpoint"],
        "completedEpochs": 24, "optimizerStepsGenerator": 1152, "optimizerStepsDiscriminator": 1152,
        "trainingStarted": True, "checkpointReloadVerified": True, "machineReviewPending": True,
        "stagePassed": False, "stage4QualificationGranted": False,
        "runtimePublicationAllowed": False, "automaticRetryStarted": False,
        "challengeContentRead": False, "regressionContentRead": False, "registryWritten": False,
        "selectedEpoch": 24, "selectedScore": 1.0, "selectedRank": [.34, -1.0, -24],
        **{key: "b" * 64 for key in ("modelStateSha256", "criticStateSha256",
             "initialModelStateSha256", "initialCriticStateSha256")}}
    finalized = {"schemaVersion": "ai-painter-stage4-mvp-v18-dry-training-lifecycle-v1",
        **{key: terminal[key] for key in ("capabilityVersion", "runId", "packageId",
            "status", "executionState", "executionPackage", "checkpoint")},
        "workerTerminal": request["workerTerminal"], "trainingStarted": True,
        "formalStage0QualificationGranted": False, "runtimePublicationGranted": False}
    saved = {"schemaVersion": review.training.CHECKPOINT_SCHEMA,
        **{key: deepcopy(package[key]) for key in ("capabilityVersion", "runId", "packageId",
            "candidateContract", "cpuQualification", "gpuQualification", "datasetManifest",
            "dryScope", "trainingExecutionTicket", "precisionExecutionPlan", "modelPlan")},
        "executionPackage": request["executionPackage"], "epoch": 24, "validationScore": 1.0,
        "checkpointSelection": {"rank": terminal["selectedRank"]},
        "optimizerStepsGenerator": 1152, "optimizerStepsDiscriminator": 1152,
        "formalInferenceEligible": False, "checkpointPromotionEligible": False,
        "automaticResumeAllowed": False,
        **{key: terminal[key] for key in ("modelStateSha256", "criticStateSha256",
             "initialModelStateSha256", "initialCriticStateSha256")}}
    return package, terminal, finalized, saved, request


def history_fixture(package, terminal, request):
    ids = [f"frozen-validation-{i}" for i in range(8)]
    rows = {}
    best_epoch = best_rank = best_checkpoint = best_score = None
    for epoch in range(1, 25):
        observations = [{"sampleId": sample_id, "split": "validation", "epoch": epoch,
            "existingValidationObjective": 1.0,
            "objectCorrelations": {role: .1 + epoch / 100 for role in OBJECT_CLASSES}}
            for sample_id in ids]
        checkpoint = binding(package["outputRoot"] + f"/epochs/epoch-{epoch:02d}.pt", epoch)
        if epoch >= 8:
            selection = rank_epoch(observations, ids, epoch=epoch)
            if best_rank is None or tuple(selection["rank"]) > tuple(best_rank):
                best_epoch, best_rank, best_checkpoint = epoch, selection["rank"], checkpoint
                best_score = selection["meanExistingValidationObjective"]
        else:
            selection = {"epoch": epoch, "meanExistingValidationObjective": 1.0,
                "rank": None, "eligible": False}
        rows[epoch] = {"epoch": epoch, "validation": observations, "checkpoint": checkpoint,
            "checkpointSelection": selection, "bestEpoch": best_epoch, "bestRank": best_rank,
            "optimizerStepsGenerator": epoch * 48, "optimizerStepsDiscriminator": epoch * 48}
    terminal["selectedEpoch"], terminal["selectedRank"], terminal["selectedScore"] = best_epoch, best_rank, best_score
    terminal["checkpoint"] = request["checkpoint"] = best_checkpoint
    class Reader:
        def snapshot(self, logical):
            epoch = int(logical.rsplit("-", 1)[1].split(".")[0])
            raw = (json.dumps(rows[epoch], separators=(",", ":")) + "\n").encode()
            return raw, {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}
    return Reader(), ids, rows


class V18MaterializationGateTests(unittest.TestCase):
    def test_finished_lineage_and_ranked_checkpoint(self):
        package, terminal, finalized, saved, request = terminal_fixture()
        review.validate_terminals(package, terminal, finalized, request)
        review.validate_checkpoint(saved, package, terminal, request)
        reader, ids, _ = history_fixture(package, terminal, request)
        result = review.validate_selection_history(reader, package, terminal, request, ids)
        self.assertEqual(result["selectedEpoch"], 24)
        self.assertEqual(len(result["epochSummaries"]), 24)

    def test_failed_or_partial_terminal_is_rejected(self):
        for key, value in (("status", "failed_closed"), ("completedEpochs", 23),
                           ("optimizerStepsGenerator", 1151), ("selectedEpoch", 7),
                           ("selectedRank", None), ("checkpointReloadVerified", False),
                           ("challengeContentRead", True)):
            p, t, f, s, r = terminal_fixture(); t[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                review.validate_terminals(p, t, f, r)

    def test_checkpoint_rank_and_lineage_tamper_is_rejected(self):
        for key, value in (("epoch", 23), ("validationScore", .5),
                           ("checkpointSelection", {"rank": [0, 0, -24]}),
                           ("modelStateSha256", "c" * 64),
                           ("automaticResumeAllowed", True)):
            p, t, f, s, r = terminal_fixture(); s[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                review.validate_checkpoint(s, p, t, r)

    def test_wrong_frozen_validation_or_epoch_rank_is_rejected(self):
        for mutate in (
            lambda rows: rows[10]["validation"][0].update(sampleId="foreign"),
            lambda rows: rows[24]["checkpointSelection"].update(rank=[1, 0, -24]),
            lambda rows: rows[12].update(bestEpoch=11),
            lambda rows: rows[24]["validation"][0]["objectCorrelations"].update(object_tree=-.9),
        ):
            p, t, f, s, r = terminal_fixture(); reader, ids, rows = history_fixture(p, t, r)
            mutate(rows)
            with self.assertRaises((ValueError, TypeError, KeyError)):
                review.validate_selection_history(reader, p, t, r, ids)

    def test_heldout_or_non_slot189_subject_rejected_before_loader(self):
        for split, sample_id in (("challenge", review.SUBJECT_ID),
                                 ("regression", "other"), ("validation", "slot-190")):
            with self.assertRaises(ValueError):
                review.load_subject({"row": {"split": split, "sampleId": sample_id}})

    def test_synthetic_cpu_v18_reload_inference_and_seven_role_archive(self):
        import torch
        from test_native_rgb_structured_object_objective_cpu_v17 import sample, ORDER
        from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import build_native_rgb_structured_object_v18_cpu
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
        from ai_painter.complete_world.stage4_v17_responsibility_artifact import decode_responsibility_artifact
        torch.set_num_threads(2)
        package, terminal, _, saved, request = terminal_fixture()
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=48, patch_channels=32)
        critic = build_conditional_texture_discriminator()
        terminal["modelStateSha256"] = saved["modelStateSha256"] = review.cpu.state_hash(model)
        terminal["criticStateSha256"] = saved["criticStateSha256"] = review.cpu.state_hash(critic)
        saved.update(modelState=model.state_dict(), criticState=critic.state_dict())
        buffer = io.BytesIO(); torch.save(saved, buffer)
        data, table = sample("validation")
        data.update(sampleId=review.SUBJECT_ID, objectInstanceTable=table)
        schema_bytes = review.cpu.project_file(ROOT, review.INTERFACE["path"]).read_bytes()
        identity = {"worldId": "synthetic-test-world", "tick": 0, "factHash": "a" * 64,
            "visualFactManifestContentSha256": "b" * 64,
            "conditionPack": {"path": "synthetic-test.json", "sha256": "c" * 64}}
        context = {"reader": SimpleNamespace(read=lambda binding: buffer.getvalue()
                    if binding == request["checkpoint"] else b"{}", unchanged=lambda: None),
            "terminal": terminal, "package": package, "order": ORDER,
            "scope": {"preselectedSubject": {"regionId": "synthetic-test-region"}},
            "schemaBytes": schema_bytes,
            "registryBinding": {"path": "synthetic-registry.json", "sha256": "a" * 64}}
        report = {}
        with patch.object(review, "load_subject", return_value=(data, identity)), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
            _, _, pixels, _, archive, evidence = review.infer(context, request, report)
        self.assertEqual(report["forwardCalls"], 1)
        self.assertEqual(report["modelStateSha256Before"], report["modelStateSha256After"])
        self.assertTrue(report["weightsUnmodifiedVerified"])
        self.assertEqual(pixels.shape, (192, 256, 3))
        decoded = decode_responsibility_artifact(archive, evidence, expected_identity=evidence,
            schema_bytes=schema_bytes, schema_sha256=review.INTERFACE["sha256"],
            candidate_pack_schema_version=json.loads(schema_bytes)["candidatePackSchemaVersion"])
        self.assertEqual(set(decoded), set(review.gpu.ROLES))
        self.assertFalse(torch.cuda.is_initialized())

    def test_claim_and_artifacts_do_not_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="v18-review-test-") as temporary:
            directory = Path(temporary) / "dry-review"
            with patch.object(review.cpu, "project_file", return_value=directory):
                review.claim({"outputRoot": "synthetic/dry-review"})
                with self.assertRaises(FileExistsError):
                    review.claim({"outputRoot": "synthetic/dry-review"})
            review.write_artifact(directory, "generated.png", b"synthetic", "synthetic/dry-review")
            with self.assertRaises(FileExistsError):
                review.write_artifact(directory, "generated.png", b"changed", "synthetic/dry-review")

    def test_failure_report_cannot_grant_visual_or_stage_qualification(self):
        _, _, _, _, request = terminal_fixture()
        with patch.object(review, "authenticate", side_effect=ValueError("training not complete")):
            result = review.materialize(request)
        self.assertEqual(result["status"], "failed_closed")
        self.assertIsNone(result["weightsModified"])
        for key in ("formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
                    "runtimePublicationGranted", "visualQualityGranted"):
            self.assertFalse(result[key])


if __name__ == "__main__": unittest.main()
