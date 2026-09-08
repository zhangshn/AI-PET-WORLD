import unittest

import torch

from ai_painter.complete_world.split_release import SplitReleaseDataset
from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash


class SplitTrainingTests(unittest.TestCase):
    def setUp(self):
        self.model = torch.nn.Sequential(torch.nn.Linear(2, 2), torch.nn.BatchNorm1d(2))
        self.optimizer = torch.optim.SGD(self.model.parameters(), lr=0.1, momentum=0.9)
        # This is an isolated CPU component fixture, not a qualified dataset.
        self.dataset = object.__new__(SplitReleaseDataset)
        self.dataset.split = "train"
        self.dataset._rows = [{"sampleId": "train-a", "split": "train"}]
        self.dataset.manifest = {"datasetReleaseIdentity": "fixture-release"}
        self.dataset.selection_sha256 = "a" * 64
        self.batch = {"sampleId": ["train-a"], "split": ["train"],
                      "datasetReleaseIdentity": ["fixture-release"],
                      "x": torch.tensor([[1., 2.], [3., 4.]])}

    def loader(self, batch=None):
        class Loader:
            dataset = self.dataset

            def __len__(inner):
                return 1

            def __iter__(inner):
                yield self.batch if batch is None else batch
        return Loader()

    def step(self, batch):
        self.optimizer.zero_grad()
        self.model(batch["x"]).square().sum().backward()
        self.optimizer.step()

    def test_real_cpu_optimizer_step_records_exact_train_sources(self):
        before = state_hash(self.model.state_dict())
        with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
            for batch in boundary.wrap_loader(self.loader()):
                self.step(batch)
            self.assertNotEqual(before, state_hash(self.model.state_dict()))
            evidence = boundary.evidence()
            self.assertEqual(evidence["optimizerSteps"], 1)
            self.assertEqual(evidence["nonTrainOptimizerSteps"], 0)
            self.assertEqual(evidence["steps"][0]["sampleIds"], ["train-a"])

    def test_validation_dataset_cannot_create_optimizer_boundary(self):
        self.dataset.split = "validation"
        with self.assertRaisesRegex(ValueError, "bound train split"):
            TrainSplitBoundary(self.model, self.optimizer, self.dataset)

    def test_wrong_split_sample_and_release_rejected_before_forward(self):
        for key, value in (("split", ["validation"]), ("sampleId", ["held-out"]),
                           ("datasetReleaseIdentity", ["old-release"])):
            with self.subTest(key=key):
                before = state_hash(self.model.state_dict())
                with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
                    with self.assertRaisesRegex(ValueError, "before forward"):
                        list(boundary.wrap_loader(self.loader({**self.batch, key: value})))
                    self.assertEqual(boundary.evidence()["optimizerSteps"], 0)
                self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_missing_batch_and_second_step_are_rejected(self):
        with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
            with self.assertRaisesRegex(ValueError, "unconsumed train batch"):
                self.optimizer.step()
            for batch in boundary.wrap_loader(self.loader()):
                self.step(batch)
                with self.assertRaisesRegex(ValueError, "unconsumed train batch"):
                    self.optimizer.step()
            self.assertEqual(boundary.evidence()["optimizerSteps"], 1)
            self.assertEqual(boundary.evidence()["rejectedOptimizerStepAttempts"], 2)

    def test_evaluation_preserves_weights_buffers_optimizer_and_modes(self):
        self.model[0].eval()
        before = state_hash(self.model.state_dict())
        optimizer_before = state_hash(self.optimizer.state_dict())
        modes = [m.training for m in self.model.modules()]
        with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
            with boundary.evaluation():
                result = self.model(self.batch["x"])
                self.assertFalse(result.requires_grad)
                self.assertFalse(self.model.training)
            self.assertEqual(before, state_hash(self.model.state_dict()))
            self.assertEqual(optimizer_before, state_hash(self.optimizer.state_dict()))
            self.assertEqual(modes, [m.training for m in self.model.modules()])

    def test_evaluation_optimizer_attempt_is_blocked(self):
        with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
            with self.assertRaisesRegex(ValueError, "unconsumed train batch"):
                with boundary.evaluation():
                    self.optimizer.step()
            self.assertEqual(boundary.evidence()["optimizerSteps"], 0)

    def test_evaluation_mutating_a_buffer_is_detected(self):
        with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
            with self.assertRaisesRegex(ValueError, "evaluation mutated"):
                with boundary.evaluation():
                    self.model[1].running_mean.add_(1)

    def test_exception_restores_modes_and_removes_hooks(self):
        with self.assertRaisesRegex(RuntimeError, "fixture failure"):
            with TrainSplitBoundary(self.model, self.optimizer, self.dataset) as boundary:
                with boundary.evaluation():
                    raise RuntimeError("fixture failure")
        self.assertTrue(self.model.training)
        self.assertEqual(len(self.optimizer._optimizer_step_pre_hooks), 0)
        self.assertEqual(len(self.optimizer._optimizer_step_post_hooks), 0)


if __name__ == "__main__":
    unittest.main()
