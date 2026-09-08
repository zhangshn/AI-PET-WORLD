"""Synthetic CPU integration with the actual V2 model, V6 Loss and Trainer."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parents[2]
for directory in (TESTS, TESTS.parent / "scripts"):
    sys.path.insert(0, str(directory))

from test_stage4_semantic_transport_v2_trainer_support import _config
from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.complete_world.split_release import SplitReleaseDataset, canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash
import stage4_split_isolated_smoke as smoke
import train_ai_assisted_conditional_denoiser as trainer


class SyntheticDataset(SplitReleaseDataset):
    def __init__(self, split):
        # No project images or training assets are consumed by these fixtures.
        self.root = ROOT
        self.split = split
        self.manifest = {"datasetReleaseIdentity": "synthetic-cpu-only-release"}
        self._rows = [{"sampleId": split + suffix, "split": split} for suffix in ("-a", "-b")]
        self.selection_sha256 = digest(canonical_bytes(self._rows))
        self.accessed = []

    def __getitem__(self, index):
        self.accessed.append(self._rows[index]["sampleId"])
        generator = torch.Generator().manual_seed(100 + index + (0 if self.split == "train" else 10))
        conditions = torch.rand(23, 16, 16, generator=generator)
        conditions[:15] = 0
        for identity in ("object_footprints", "object_tree", "object_rock", "object_vegetation", "walkable_path"):
            if identity in _config()["conditionChannelOrder"]:
                conditions[_config()["conditionChannelOrder"].index(identity)] = 1
        return {"sampleId": self._rows[index]["sampleId"], "split": self.split,
                "datasetReleaseIdentity": self.manifest["datasetReleaseIdentity"],
                "image": torch.rand(3, 16, 16, generator=generator), "conditions": conditions}


class SplitSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.previous_threads)

    def setUp(self):
        torch.manual_seed(20263722)
        self.config = _config()
        self.config["training"].update(batchSize=1, fixedValidationTimesteps=[0, 250, 500, 750])
        self.model = build_complete_world_system(self.config)
        self.optimizer = torch.optim.AdamW(self.model.denoiser.parameters(), lr=0.0001)
        self.train, self.validation = SyntheticDataset("train"), SyntheticDataset("validation")
        self.kwargs = dict(model=self.model, optimizer=self.optimizer,
                           train_dataset=self.train, validation_dataset=self.validation,
                           train_sample_ids=["train-a"], validation_sample_ids=["validation-a"],
                           diffusion=trainer.build_diffusion_schedule(self.config, torch.device("cpu")),
                           latent_normalization={"mean": torch.zeros(1, 12, 1, 1),
                                                 "standardDeviation": torch.ones(1, 12, 1, 1)},
                           device=torch.device("cpu"), config=self.config, epoch_index=0, seed=20263722)

    def test_actual_trainer_updates_only_train_and_validation_is_state_preserving(self):
        before = state_hash(self.model.state_dict())
        ae_before = state_hash(self.model.autoencoder.state_dict())
        config_before = deepcopy(self.config)
        with patch.object(trainer, "train_epoch", wraps=trainer.train_epoch) as train, \
             patch.object(trainer, "evaluate_velocity_prediction", wraps=trainer.evaluate_velocity_prediction) as evaluate:
            result = smoke.run_split_smoke_epoch(**self.kwargs)
        self.assertEqual(train.call_count, 1)
        self.assertEqual(evaluate.call_count, 1)
        self.assertNotEqual(before, state_hash(self.model.state_dict()))
        self.assertEqual(ae_before, state_hash(self.model.autoencoder.state_dict()))
        self.assertEqual(self.config, config_before)
        self.assertEqual(self.train.accessed, ["train-a"])
        self.assertEqual(self.validation.accessed, ["validation-a"])
        self.assertEqual(result["stepEvidence"]["optimizerSteps"], 1)
        self.assertEqual(result["stepEvidence"]["steps"][0]["sampleIds"], ["train-a"])
        self.assertEqual(result["stepEvidence"]["nonTrainOptimizerSteps"], 0)
        validation = result["validationEvidence"]
        self.assertEqual(validation["modelStateBefore"], validation["modelStateAfter"])
        self.assertEqual(validation["optimizerStateBefore"], validation["optimizerStateAfter"])
        self.assertFalse(result["smokeWeightsPromotable"])

    def test_validation_or_unknown_training_selection_fails_before_forward(self):
        for key, value in (("train_dataset", self.validation), ("train_sample_ids", ["validation-a"]),
                           ("train_sample_ids", ["missing"]), ("validation_dataset", self.train),
                           ("validation_sample_ids", ["train-a"]), ("epoch_index", 30)):
            with self.subTest(key=key, value=value):
                before = state_hash(self.model.state_dict())
                with patch.object(trainer, "train_epoch") as train, self.assertRaises(ValueError):
                    smoke.run_split_smoke_epoch(**{**self.kwargs, key: value})
                train.assert_not_called()
                self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_cross_release_and_duplicate_selection_are_refused(self):
        self.validation.manifest = {"datasetReleaseIdentity": "different-release"}
        with self.assertRaisesRegex(ValueError, "cross release"):
            smoke.run_split_smoke_epoch(**self.kwargs)
        with self.assertRaisesRegex(ValueError, "unique"):
            smoke.selected_indices(self.train, ["train-a", "train-a"], "train")

    def test_autoencoder_optimizer_contamination_is_refused(self):
        self.optimizer.add_param_group({"params": list(self.model.autoencoder.parameters())})
        with patch.object(trainer, "train_epoch") as train, self.assertRaisesRegex(ValueError, "exactly the trainable"):
            smoke.run_split_smoke_epoch(**self.kwargs)
        train.assert_not_called()

    def test_validation_optimizer_attempt_cannot_be_suppressed(self):
        def invalid_evaluation(*args, **kwargs):
            try:
                self.optimizer.step()
            except ValueError:
                pass
            return {}
        with patch.object(trainer, "evaluate_velocity_prediction", side_effect=invalid_evaluation), \
             self.assertRaisesRegex(ValueError, "suppressed a forbidden"):
            smoke.run_split_smoke_epoch(**self.kwargs)

    def test_validation_state_mutation_fails_closed(self):
        def invalid_evaluation(*args, **kwargs):
            next(self.model.denoiser.parameters()).add_(1)
            return {}
        with patch.object(trainer, "evaluate_velocity_prediction", side_effect=invalid_evaluation), \
             self.assertRaisesRegex(ValueError, "evaluation mutated"):
            smoke.run_split_smoke_epoch(**self.kwargs)

    def test_validation_must_actually_read_the_bound_sample(self):
        with patch.object(trainer, "evaluate_velocity_prediction", return_value={}), \
             self.assertRaisesRegex(ValueError, "did not consume exactly"):
            smoke.run_split_smoke_epoch(**self.kwargs)

    def test_validation_batch_relabelling_is_detected_before_evaluation_forward(self):
        original = SyntheticDataset.__getitem__

        def substituted(dataset, index):
            item = original(dataset, index)
            if dataset is self.validation:
                item["sampleId"] = "train-a"
            return item

        with patch.object(SyntheticDataset, "__getitem__", substituted), \
             self.assertRaisesRegex(ValueError, "actual validation batch"):
            smoke.run_split_smoke_epoch(**self.kwargs)

    def test_contract_tampering_cannot_inherit_the_inactive_identity(self):
        expected = {"datasetManifest": {"path": "manifest.json", "sha256": "a" * 64},
                    "selections": {"train": {"sampleIds": ["train-a"]},
                                   "validation": {"sampleIds": ["validation-a"]}},
                    "status": "inactive_component_candidate_not_execution_qualified",
                    "qualification": {"trainingAllowed": False}}
        with patch.object(smoke, "build_inactive_contract", return_value=expected), \
             patch.object(smoke, "bound_json", return_value=deepcopy(expected)):
            self.assertEqual(smoke.verify_inactive_contract(ROOT, {}), expected)
        changed = deepcopy(expected)
        changed["qualification"]["trainingAllowed"] = True
        with patch.object(smoke, "build_inactive_contract", return_value=expected), \
             patch.object(smoke, "bound_json", return_value=changed), \
             self.assertRaisesRegex(ValueError, "no longer reproduces"):
            smoke.verify_inactive_contract(ROOT, {})


if __name__ == "__main__":
    unittest.main()
