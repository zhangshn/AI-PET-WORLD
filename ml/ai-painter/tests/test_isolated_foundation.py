"""CPU component tests; synthetic tensors never qualify a real foundation run."""
import unittest

import torch

from ai_painter.complete_world.isolated_foundation import run_isolated_foundation_epoch
from ai_painter.complete_world.split_release import SplitReleaseDataset, canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash


class Dataset(SplitReleaseDataset):
    def __init__(self, split):
        self.root = "synthetic-project"
        self.binding = {"path": "synthetic/qualified-manifest.json", "sha256": "a" * 64}
        self.manifest = {"datasetReleaseIdentity": "synthetic-not-a-real-qualification",
                         "reviewOnly": False,
                         "qualification": {"trainingAllowed": True}}
        self.split = split
        self.image_size = (256, 192)
        self._rows = [{"sampleId": f"{split}-{index}", "split": split}
                      for index in range(48 if split == "train" else 8)]
        self.selection_sha256 = digest(canonical_bytes(self._rows))
        self.bad = None
        self.bad_at = 0

    @property
    def rows(self):
        return [dict(row) for row in self._rows]

    def __len__(self):
        return len(self._rows)

    def __getitem__(self, index):
        row = dict(self._rows[index])
        row["datasetReleaseIdentity"] = self.manifest["datasetReleaseIdentity"]
        row["image"] = torch.full((3, 192, 256), 0.5)
        if self.bad and index == self.bad_at:
            self.bad(row)
        return row


class TinyAutoencoder(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = torch.nn.Parameter(torch.tensor(0.8))

    def encode(self, image):
        return image * self.scale

    def decode(self, latent):
        return latent * self.scale


class IsolatedFoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.previous_threads)

    def setUp(self):
        self.train, self.validation = Dataset("train"), Dataset("validation")
        self.model = TinyAutoencoder()
        self.optimizer = torch.optim.SGD(self.model.parameters(), lr=0.001)
        self.args = dict(autoencoder=self.model, optimizer=self.optimizer,
                         train_dataset=self.train, validation_dataset=self.validation,
                         device="cpu", loss_weights={"pixel": 1.0, "edge": 0.0,
                                                     "laplacian": 0.0})

    def run_epoch(self):
        return run_isolated_foundation_epoch(**self.args)

    def test_complete_train_and_validation_without_qualification(self):
        before = state_hash(self.model.state_dict())
        result = self.run_epoch()
        self.assertEqual(result["optimizerSteps"], 48)
        self.assertEqual(len(result["trainSampleIds"]), 48)
        self.assertEqual(len(result["validationSampleIds"]), 8)
        self.assertNotEqual(before, state_hash(self.model.state_dict()))
        self.assertFalse(result["trainingAllowed"])
        self.assertFalse(result["challengeRead"])
        self.assertFalse(result["regressionRead"])

    def test_review_candidate_rejected_before_update(self):
        self.train.manifest["reviewOnly"] = True
        self.validation.manifest["reviewOnly"] = True
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "review-only"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_unqualified_candidate_rejected_before_update(self):
        self.train.manifest["qualification"]["trainingAllowed"] = False
        self.validation.manifest["qualification"]["trainingAllowed"] = False
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "not training qualified"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_cross_split_or_wrong_input_rejected(self):
        self.validation._rows[0]["sampleId"] = self.train._rows[0]["sampleId"]
        self.validation.selection_sha256 = digest(canonical_bytes(self.validation._rows))
        with self.assertRaisesRegex(ValueError, "overlap"):
            self.run_epoch()

    def test_bad_rgb_rejected_before_first_update(self):
        self.train.bad = lambda row: row.update(image=torch.zeros(3, 16, 16))
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "RGB tensor invalid"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_validation_identity_error_does_not_claim_success(self):
        self.validation.bad = lambda row: row.update(sampleId="foreign")
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "batch identity mismatch"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_last_train_image_failure_precedes_all_updates(self):
        self.train.bad_at = 47
        self.train.bad = lambda row: row.update(image=torch.zeros(3, 16, 16))
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "RGB tensor invalid"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_selection_hash_tamper_rejected_before_update(self):
        self.train.selection_sha256 = "0" * 64
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "selected rows changed"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))


if __name__ == "__main__":
    unittest.main()
