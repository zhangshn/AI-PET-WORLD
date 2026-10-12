"""Simulated schedule only; no actual forward, backward, optimizer or CUDA."""
import hashlib
import json
import random
import unittest
from unittest.mock import patch
import painter_stage4_ecology_decode1_weight_quality_lifecycle_v1 as lifecycle
import painter_stage4_ecology_decode1_weight_training_profile_v1 as profile
from ai_painter.complete_world import ecology_decode1_weight_checkpoint_v1 as codec
from test_ecology_decode1_weight_checkpoint_cpu import ORDER, configuration, selection


class QualityLifecycleTests(unittest.TestCase):
    def fixture(self, *, partial=False, late_reload=False, capture_failure=False, wrong_ledger=False):
        model, critic = profile.fresh_networks(ORDER)
        config = configuration()
        plan = {"capabilityVersion": codec.CAPABILITY, "configuration": config,
            "runId": "synthetic-quality-run", "packageId": "synthetic-quality-package",
            "datasetManifest": {"path": "synthetic/manifest.json", "sha256": "b" * 64},
            "programBindings": {"worker": {"path": "synthetic/worker.py", "sha256": "c" * 64}}}
        visits, selected_epochs, reloads, captures, blobs = [], [], [], [], {}
        primary = RuntimeError("synthetic after D before G")
        def pair(model, critic, sample, order, go, do, counts, ledger, resource, forward):
            visits.append(sample["sampleId"])
            counts["discriminator"] += 1
            ledger["discriminator"] += 1
            if partial:
                raise primary
            counts["generator"] += 1
            ledger["generator"] += 0 if wrong_ledger else 1
        def validate(model, samples, order, *, epoch):
            selected_epochs.append(epoch)
            return selection(epoch), [{"sampleId": s["sampleId"], "split": "validation"} for s in samples]
        def encode(model, critic, **kwargs):
            return json.dumps({"synthetic": True, "epoch": kwargs["epoch"]}).encode()
        def sink(epoch, value):
            if epoch is None:
                return blobs[value["path"]]
            p = "synthetic/checkpoint-12.pt"
            blobs[p] = value
            return {"path": p, "sha256": hashlib.sha256(value).hexdigest()}
        def reload(raw, **kwargs):
            reloads.append(kwargs)
            if late_reload:
                raise ValueError("synthetic late reload failure")
        def capture(error, **kwargs):
            captures.append((error, kwargs))
            if capture_failure:
                raise OSError("synthetic secondary capture failure")
            return {"status": "capture_incomplete", "missing": ["synthetic test has no actual gradients"]}
        return (dict(model=model, critic=critic,
            train=[{"sampleId": "train-" + str(i), "split": "train"} for i in range(48)],
            validation=[{"sampleId": "validation-" + str(i), "split": "validation"} for i in range(8)],
            order=ORDER, configuration=config, package_binding={"path": "synthetic/package.json", "sha256": "a" * 64},
            plan=plan, plan_binding={"path": "synthetic/quality-plan.json", "sha256": "d" * 64},
            resource=lambda: None, checkpoint_sink=sink, progress_sink=lambda *a, **k: None,
            pair_runner=pair, validation_runner=validate, checkpoint_encoder=encode, checkpoint_reloader=reload,
            optimizer_factory=lambda *a, **k: object(), capture_sink=capture,
            context_for_sample=lambda sample, position: {"sampleId": sample["sampleId"]}),
            visits, selected_epochs, reloads, captures, primary)

    def test_simulated_12_complete_epochs_576_and_only_epoch12_selection(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture()
        outcome = lifecycle.training_loop(**kwargs)
        self.assertEqual(outcome["optimizerSteps"], {"generator": 576, "discriminator": 576})
        self.assertEqual(outcome["completedEpochs"], 12)
        self.assertEqual(epochs, [12])
        self.assertEqual(len(outcome["checkpoints"]), 1)
        self.assertEqual(len(reloads), 1)
        self.assertEqual(reloads[0]["program_bindings"], kwargs["plan"]["programBindings"])
        self.assertEqual(reloads[0]["plan_binding"], kwargs["plan_binding"])
        self.assertEqual(captures, [])
        expected = []
        for epoch in range(1, 13):
            indices = list(range(48)); random.Random(20260929 + epoch).shuffle(indices)
            expected.extend("train-" + str(i) for i in indices)
        self.assertEqual(visits, expected)
        self.assertFalse(outcome["formalStage4QualificationAllowed"])

    def test_partial_d_primary_preserved_no_selection_or_reload(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture(partial=True)
        with self.assertRaises(RuntimeError) as caught:
            lifecycle.training_loop(**kwargs)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual(primary.completed_epochs, 0)
        self.assertEqual(primary.partial_checkpoint_records, [])
        self.assertEqual(epochs, [])
        self.assertEqual(reloads, [])
        self.assertIs(captures[0][0], primary)
        self.assertEqual(captures[0][1]["context"]["optimizerSteps"], primary.actual_optimizer_counts)

    def test_secondary_capture_error_does_not_replace_primary(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture(partial=True, capture_failure=True)
        with self.assertRaises(RuntimeError) as caught:
            lifecycle.training_loop(**kwargs)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.ecology_failure_capture_receipt["secondaryCaptureFailure"]["type"], "OSError")

    def test_late_reload_retains_complete_counts_and_unique_checkpoint(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture(late_reload=True)
        with self.assertRaisesRegex(ValueError, "late reload") as caught:
            lifecycle.training_loop(**kwargs)
        self.assertEqual(caught.exception.actual_optimizer_counts, {"generator": 576, "discriminator": 576})
        self.assertEqual(caught.exception.completed_epochs, 12)
        self.assertEqual(len(caught.exception.partial_checkpoint_records), 1)

    def test_optimizer_setup_failure_keeps_actual_zero_counts_and_primary(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture()
        setup_error = OSError("synthetic optimizer setup failure")
        def fail_setup(*args, **options):
            raise setup_error
        kwargs["optimizer_factory"] = fail_setup
        with self.assertRaises(OSError) as caught:
            lifecycle.training_loop(**kwargs)
        self.assertIs(caught.exception, setup_error)
        self.assertEqual(setup_error.actual_optimizer_counts, {"generator": 0, "discriminator": 0})
        self.assertEqual(setup_error.completed_epochs, 0)
        self.assertIsNone(setup_error.failure_position)
        self.assertEqual(setup_error.partial_checkpoint_records, [])
        self.assertEqual(setup_error.ecology_failure_capture_receipt["status"], "capture_incomplete")
        self.assertEqual(visits + epochs + reloads + captures, [])

    def test_wrong_actual_pair_ledger_refuses_before_completed_epoch(self):
        kwargs, visits, epochs, reloads, captures, primary = self.fixture(wrong_ledger=True)
        with self.assertRaisesRegex(ValueError, "pair ledger") as caught:
            lifecycle.training_loop(**kwargs)
        self.assertEqual(caught.exception.completed_epochs, 0)
        self.assertEqual(epochs, [])


if __name__ == "__main__":
    unittest.main()
