"""CPU-only experimental scope and optimizer boundary regression."""
import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from painter_learning_capacity_experiment import (
    CHECKPOINT_SCHEMA, ExperimentDataset, SCHEMA, selected_rows, validate_experiment_checkpoint, verify_controller_process, exact_inference_runtime,
)
from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash


class ExperimentScopeTests(unittest.TestCase):
    def setUp(self):
        self.rows = [{"sampleId": "a", "split": "train"}, {"sampleId": "b", "split": "train"}]
        self.package = {"schemaVersion": SCHEMA, "resolution": [256, 192], "experimentIdentity": "experiment-test",
                        "selectedRows": self.rows, "inputIdentity": {}}

    def test_selected_train_order(self):
        self.assertEqual([r["sampleId"] for r in selected_rows({"samples": self.rows}, ["b", "a"])], ["b", "a"])

    def test_exact_inference_runtime_restores_flags_after_failure(self):
        import torch
        before = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
                  torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic)
        with self.assertRaisesRegex(RuntimeError, "fixture"):
            with exact_inference_runtime(torch):
                self.assertTrue(torch.are_deterministic_algorithms_enabled())
                self.assertFalse(torch.is_deterministic_algorithms_warn_only_enabled())
                self.assertFalse(torch.backends.cudnn.benchmark)
                self.assertTrue(torch.backends.cudnn.deterministic)
                raise RuntimeError("fixture")
        after = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
                 torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic)
        self.assertEqual(before, after)

    def test_exact_controller_or_venv_redirector_only(self):
        lease = {"experimentIdentity": "experiment-test", "workerParentPid": 100, "workerLauncherPid": 101, "registryRevision": 8}
        registry = {"runId": "experiment-test", "activeExecution": {"processId": 100}, "registryRevision": 8}
        for pid in (100, 101):
            verify_controller_process(lease, registry, pid)
        with self.assertRaises(ValueError):
            verify_controller_process(lease, registry, 102)

    def test_stale_controller_registry_rejected(self):
        lease = {"experimentIdentity": "experiment-test", "workerParentPid": 100, "workerLauncherPid": 101, "registryRevision": 8}
        for registry in ({"runId": "other", "activeExecution": {"processId": 100}, "registryRevision": 8},
                         {"runId": "experiment-test", "activeExecution": {"processId": 100}, "registryRevision": 9}):
            with self.assertRaises(ValueError):
                verify_controller_process(lease, registry, 101)

    def test_holdouts_rejected(self):
        for split in ("validation", "challenge", "regression"):
            rows = copy.deepcopy(self.rows)
            rows[0]["split"] = split
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "non-train"):
                selected_rows({"samples": rows}, ["a", "b"])

    def test_missing_duplicate_and_oversized_rejected(self):
        for ids in (["a", "a"], ["a", "missing"], ["a", "b", "c"]):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                selected_rows({"samples": self.rows}, ids)

    def test_dataset_distinct_identity_and_copy(self):
        dataset = ExperimentDataset(Path.cwd(), self.package)
        self.assertEqual(dataset.manifest["datasetReleaseIdentity"], "experiment-test")
        self.rows[0]["split"] = "validation"
        self.assertEqual(dataset.rows[0]["split"], "train")

    def test_wrong_resolution_rejected(self):
        self.package["resolution"] = [512, 384]
        with self.assertRaisesRegex(ValueError, "resolution"):
            ExperimentDataset(Path.cwd(), self.package)

    def checkpoint(self):
        return {"schemaVersion": CHECKPOINT_SCHEMA, "experimentIdentity": "experiment-test",
                "selectedSampleIds": ["a", "b"], "checkpointPromotable": False, "formalInferenceEligible": False}

    def test_experimental_checkpoint_accepted(self):
        validate_experiment_checkpoint(self.checkpoint(), self.package)

    def test_checkpoint_promotion_and_cross_identity_rejected(self):
        for key, value in (("checkpointPromotable", True), ("formalInferenceEligible", True),
                           ("experimentIdentity", "other"), ("schemaVersion", "formal-checkpoint"),
                           ("selectedSampleIds", ["a", "challenge"])):
            checkpoint = self.checkpoint()
            checkpoint[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_experiment_checkpoint(checkpoint, self.package)

    def test_real_optimizer_requires_bound_train_batch(self):
        import torch
        dataset = ExperimentDataset(Path.cwd(), self.package)
        model = torch.nn.Linear(1, 1)
        optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
        class Loader:
            def __init__(self, item):
                self.dataset = dataset
                self.item = item
            def __len__(self):
                return 1
            def __iter__(self):
                yield self.item
        item = {"sampleId": ["a"], "split": ["train"], "datasetReleaseIdentity": ["experiment-test"]}
        before = state_hash(model.state_dict())
        with TrainSplitBoundary(model, optimizer, dataset) as boundary:
            with self.assertRaises(ValueError):
                optimizer.step()
            for _ in boundary.wrap_loader(Loader(item)):
                optimizer.zero_grad()
                model(torch.ones(1, 1)).sum().backward()
                optimizer.step()
                with self.assertRaises(ValueError):
                    optimizer.step()
            self.assertEqual(boundary.evidence()["optimizerSteps"], 1)
            for field, value in (("split", ["validation"]), ("sampleId", ["unknown"]), ("datasetReleaseIdentity", ["other"])):
                changed = {**item, field: value}
                with self.assertRaises(ValueError):
                    list(boundary.wrap_loader(Loader(changed)))
            with boundary.evaluation():
                self.assertFalse(torch.is_grad_enabled())
        self.assertNotEqual(before, state_hash(model.state_dict()))


if __name__ == "__main__":
    unittest.main()
