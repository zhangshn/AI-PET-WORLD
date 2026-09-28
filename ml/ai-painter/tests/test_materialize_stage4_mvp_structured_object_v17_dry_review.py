"""CPU-only materializer tests. No real training checkpoint is inferred."""
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import materialize_stage4_mvp_structured_object_v17_dry_review as review
from test_stage4_mvp_structured_object_v17_worker_gate import fixture as package_fixture


def fixture():
    package, _ = package_fixture()
    root = package["outputRoot"]
    binding = lambda path: {"path": path, "sha256": "a" * 64}
    request = {"executionPackage": binding(root + "/execution-package.json"),
        "workerTerminal": binding(root + "/phase-terminal.json"), "trainingTerminal": binding(root + "/training-finalize.json"),
        "checkpoint": binding(root + "/epochs/epoch-05.pt"), "outputRoot": root + "/dry-review", "device": "cpu",
        "program": review.training.bind(review.PROGRAM_PATH), "tests": review.training.bind(review.TEST_PATH)}
    terminal = {"schemaVersion": review.training.TERMINAL_SCHEMA,
        **{key: deepcopy(package[key]) for key in ("capabilityVersion", "runId", "packageId", "candidateContract",
            "cpuQualification", "gpuQualification", "datasetManifest", "dryScope", "trainingExecutionTicket", "precisionExecutionPlan", "stage")},
        "status": "training_completed_review_pending", "executionState": "completed", "executionPackage": request["executionPackage"],
        "checkpoint": request["checkpoint"], "completedEpochs": 24, "optimizerStepsGenerator": 1152,
        "optimizerStepsDiscriminator": 1152, "trainingStarted": True, "checkpointReloadVerified": True,
        "machineReviewPending": True, "stagePassed": False, "stage4QualificationGranted": False,
        "runtimePublicationAllowed": False, "automaticRetryStarted": False, "challengeContentRead": False,
        "regressionContentRead": False, "registryWritten": False, "selectedEpoch": 5, "selectedScore": .5,
        **{key: "b" * 64 for key in ("modelStateSha256", "criticStateSha256", "initialModelStateSha256", "initialCriticStateSha256")}}
    finalized = {"schemaVersion": "ai-painter-stage4-mvp-v17-dry-training-lifecycle-v1",
        **{key: terminal[key] for key in ("capabilityVersion", "runId", "packageId", "status", "executionState", "executionPackage", "checkpoint")},
        "workerTerminal": request["workerTerminal"], "trainingStarted": True,
        "formalStage0QualificationGranted": False, "runtimePublicationGranted": False}
    saved = {"schemaVersion": review.training.CHECKPOINT_SCHEMA,
        **{key: deepcopy(package[key]) for key in ("capabilityVersion", "runId", "packageId", "candidateContract", "cpuQualification",
            "gpuQualification", "datasetManifest", "dryScope", "trainingExecutionTicket", "precisionExecutionPlan", "modelPlan")},
        "executionPackage": request["executionPackage"], "epoch": 5, "validationScore": .5,
        "optimizerStepsGenerator": 240, "optimizerStepsDiscriminator": 240, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "automaticResumeAllowed": False,
        **{key: terminal[key] for key in ("modelStateSha256", "criticStateSha256", "initialModelStateSha256", "initialCriticStateSha256")}}
    return package, terminal, finalized, saved, request


class DryReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
        import torch
        torch.set_num_threads(2)
        cls.torch = torch

    def test_completed_bound_terminals_and_checkpoint_metadata(self):
        p, t, f, s, r = fixture()
        review.validate_terminals(p, t, f, r)
        review.validate_checkpoint(s, p, t, r)

    def test_failed_partial_or_different_training_rejected(self):
        for field, value in (("status", "failed_closed"), ("completedEpochs", 23), ("optimizerStepsGenerator", 1151),
            ("checkpointReloadVerified", False), ("selectedEpoch", True), ("selectedScore", float("nan")),
            ("runId", "another-run"), ("stagePassed", True), ("challengeContentRead", True)):
            p, t, f, s, r = fixture()
            t[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                review.validate_terminals(p, t, f, r)

    def test_wrong_output_or_checkpoint_binding_rejected(self):
        for field, value in (("outputRoot", "somewhere/dry-review"),
            ("checkpoint", {"path": "old-v16.pt", "sha256": "a" * 64}),
            ("workerTerminal", {"path": "other/phase-terminal.json", "sha256": "a" * 64})):
            p, t, f, s, r = fixture()
            r[field] = value
            with self.assertRaises(ValueError):
                review.validate_terminals(p, t, f, r)

    def test_changed_checkpoint_epoch_precision_or_state_identity_rejected(self):
        for field, value in (("schemaVersion", "v16"), ("epoch", 4), ("validationScore", .4),
            ("modelStateSha256", "c" * 64), ("criticStateSha256", "c" * 64),
            ("optimizerStepsGenerator", 1152), ("automaticResumeAllowed", True),
            ("precisionExecutionPlan", {"generatorAutocast": "float16"})):
            p, t, f, s, r = fixture()
            s[field] = value
            with self.assertRaises(ValueError):
                review.validate_checkpoint(s, p, t, r)

    def test_active_registry_or_failed_finalization_blocks_inference(self):
        p, t, f, s, r = fixture()
        registry = {"schemaVersion": "ai-painter-current-execution-registry-v1", "registryRevision": 99,
            "activeExecution": None, "executionState": "completed", "runId": p["runId"], "packageId": p["packageId"],
            "capabilityVersion": p["capabilityVersion"], "packageSha256": r["trainingTerminal"]["sha256"],
            "latestTrainingTerminal": {**r["trainingTerminal"], "runId": p["runId"], "status": t["status"]},
            "terminalEvidence": {**r["trainingTerminal"], "status": t["status"]}}
        review.validate_registry(registry, p, r)
        for field, value in (("activeExecution", {"runId": p["runId"]}), ("executionState", "failed_closed"),
            ("runId", "different"), ("packageSha256", "d" * 64)):
            bad = {**registry, field: value}
            with self.assertRaises(ValueError):
                review.validate_registry(bad, p, r)

    def test_other_validation_or_heldout_content_rejected_before_loader(self):
        for split, sample_id in (("challenge", review.SUBJECT_ID), ("regression", "other"), ("validation", "slot-190")):
            with patch.object(review.cpu, "load_sample", side_effect=AssertionError("content decoded")):
                with self.assertRaises(ValueError):
                    review.load_subject({"row": {"split": split, "sampleId": sample_id}})

    def test_materializer_source_sha_is_recomputed_before_any_inference(self):
        _, _, _, _, request = fixture()
        request["program"]["sha256"] = "0" * 64
        with patch.object(self.torch, "load", side_effect=AssertionError("checkpoint decoded")), \
             patch.object(self.torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
            with self.assertRaisesRegex(ValueError, "SHA mismatch"):
                review.authenticate(request)

    def test_rgb_encoding_rejects_nonfinite_out_of_range_or_wrong_shape(self):
        torch = self.torch
        pixels = review.to_rgb_pixels(torch.full((1, 3, 192, 256), .5))
        self.assertEqual(pixels.shape, (192, 256, 3))
        self.assertTrue((pixels == 128).all())
        for value in (torch.full((1, 3, 192, 256), float("nan")), torch.full((1, 3, 192, 256), 1.01), torch.zeros(1, 3, 16, 16)):
            with self.assertRaises(ValueError):
                review.to_rgb_pixels(value)

    def test_synthetic_validation_metrics_and_visualizations(self):
        from test_native_rgb_structured_object_objective_cpu_v17 import sample, ORDER
        from PIL import Image
        data, table = sample("validation")
        data.update(sampleId=review.SUBJECT_ID, objectInstanceTable=table)
        predicted = data["image"][None]
        metrics = review.diagnostic_metrics(predicted, data, ORDER)
        self.assertLess(metrics["encodedRgbMae"], 1e-7)
        self.assertIsNone(metrics["responsibilities"]["terrain_water"]["rgbMae"])
        self.assertEqual(metrics["responsibilities"]["terrain_water"]["conditionPixelCount"], 0)
        visuals = review.visualizations(data, review.to_rgb_pixels(predicted), ORDER)
        for name, size in (("reference-256.png", (256, 192)), ("conditions-23.png", (1536, 864)), ("comparison.png", (768, 224))):
            with Image.open(io.BytesIO(visuals[name])) as image:
                self.assertEqual(image.size, size)
                self.assertEqual(image.mode, "RGB")

    def test_synthetic_cpu_inference_safe_reload_seven_archives_and_no_mutation(self):
        # CPU smoke uses generated synthetic inputs and fresh test-only weights,
        # never the running task's selected checkpoint or original subject RGB.
        torch = self.torch
        from test_native_rgb_structured_object_objective_cpu_v17 import sample, ORDER
        from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import build_native_rgb_structured_object_cpu_v17
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
        from ai_painter.complete_world.stage4_v17_responsibility_artifact import decode_responsibility_artifact
        p, t, f, saved, request = fixture()
        model = build_native_rgb_structured_object_cpu_v17(condition_channel_order=ORDER, base_channels=48, patch_channels=32)
        critic = build_conditional_texture_discriminator()
        t["modelStateSha256"] = saved["modelStateSha256"] = review.cpu.state_hash(model)
        t["criticStateSha256"] = saved["criticStateSha256"] = review.cpu.state_hash(critic)
        saved.update(modelState=model.state_dict(), criticState=critic.state_dict())
        buffer = io.BytesIO()
        torch.save(saved, buffer)
        raw = buffer.getvalue()
        data, table = sample("validation")
        data.update(sampleId=review.SUBJECT_ID, objectInstanceTable=table)
        schema_bytes = review.cpu.project_file(ROOT, review.INTERFACE["path"]).read_bytes()
        identity = {"worldId": "synthetic-test-world", "tick": 0, "factHash": "a" * 64,
            "visualFactManifestContentSha256": "b" * 64, "conditionPack": {"path": "test-only.json", "sha256": "c" * 64}}
        context = {"reader": SimpleNamespace(read=lambda binding: raw if binding == request["checkpoint"] else b"{}", unchanged=lambda: None),
            "terminal": t, "package": p, "order": ORDER, "scope": {"preselectedSubject": {"regionId": "synthetic-test-region"}},
            "schemaBytes": schema_bytes, "registryBinding": {"path": "test-registry.json", "sha256": "a" * 64}}
        report = {}
        with patch.object(review, "load_subject", return_value=(data, identity)), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
            _, _, pixels, metrics, archive, evidence = review.infer(context, request, report)
        self.assertEqual(report["forwardCalls"], 1)
        self.assertEqual(report["modelStateSha256Before"], report["modelStateSha256After"])
        self.assertTrue(report["weightsUnmodifiedVerified"])
        self.assertEqual(pixels.shape, (192, 256, 3))
        decoded = decode_responsibility_artifact(archive, evidence, expected_identity=evidence,
            schema_bytes=schema_bytes, schema_sha256=review.INTERFACE["sha256"],
            candidate_pack_schema_version=json.loads(schema_bytes)["candidatePackSchemaVersion"])
        self.assertEqual(set(decoded), set(review.gpu.ROLES))
        self.assertFalse(torch.cuda.is_initialized())

    def test_claim_and_artifacts_cannot_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="v17-dry-review-test-") as temporary:
            root = Path(temporary) / "dry-review"
            with patch.object(review.cpu, "project_file", return_value=root):
                review.claim({"outputRoot": "test-only/dry-review"})
                with self.assertRaises(FileExistsError):
                    review.claim({"outputRoot": "test-only/dry-review"})
            binding = review.write_artifact(root, "source.png", b"test-original-bytes", "test-only/dry-review")
            self.assertEqual(binding["sha256"], review.cpu.sha(b"test-original-bytes"))
            with self.assertRaises(FileExistsError):
                review.write_artifact(root, "source.png", b"replacement", "test-only/dry-review")

    def test_failure_does_not_grant_visual_or_stage_qualification(self):
        _, _, _, _, request = fixture()
        with patch.object(review, "authenticate", side_effect=ValueError("uncompleted training")):
            result = review.materialize(request)
        self.assertEqual(result["status"], "failed_closed")
        self.assertIsNone(result["weightsModified"])
        for key in ("formalStage0QualificationGranted", "stage4ProgressIncreaseGranted", "runtimePublicationGranted", "visualQualityGranted"):
            self.assertFalse(result[key])

    def test_timeout_terminates_only_created_process_tree(self):
        process = MagicMock(pid=54321)
        process.communicate.side_effect = [subprocess.TimeoutExpired(["test-child"], 1), ("partial", "error")]
        process.poll.return_value = None
        with patch.object(review.subprocess, "Popen", return_value=process), \
             patch.object(review.subprocess, "run", return_value=SimpleNamespace(returncode=0)) as terminate:
            with self.assertRaises(subprocess.TimeoutExpired):
                review.run_child(["test-child"], timeout=1)
        if os.name == "nt":
            self.assertEqual(terminate.call_args.args[0], ["taskkill.exe", "/PID", "54321", "/T", "/F"])
        else:
            process.kill.assert_called_once()


if __name__ == "__main__":
    unittest.main()
