"""CPU behavioral guards for the single train-only V11 diagnostic."""

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import painter_stage4_v11_train_only_capacity_probe as probe  # noqa: E402


class TrainOnlyCapacityProbeTests(unittest.TestCase):
    def test_frozen_policy_is_train_only_and_bounded(self):
        policy = probe.read_policy()
        self.assertEqual(policy["sample"]["split"], "train")
        self.assertEqual(policy["maxOptimizerSteps"], 512)
        self.assertEqual(policy["observationSteps"], [0, 128, 256, 512])
        self.assertFalse(policy["execution"]["validationReadAllowed"])
        self.assertFalse(policy["execution"]["checkpointPromotionAllowed"])

    def test_selected_sample_is_exact_current_train_original(self):
        dataset, index, row = probe.selected_train_sample(probe.read_policy())
        self.assertEqual(len(dataset), 48)
        self.assertEqual(dataset[index]["sampleId"], row["sampleId"])
        self.assertEqual(row["image"]["sha256"], probe.read_policy()["sample"]["referenceRgbSha256"])

    def test_nontrain_sample_is_rejected(self):
        policy = dict(probe.read_policy())
        policy["sample"] = dict(policy["sample"], sampleId="ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
        with self.assertRaisesRegex(ValueError, "missing or duplicated"):
            probe.selected_train_sample(policy)

    def test_changed_budget_or_split_is_rejected(self):
        policy = probe.read_policy()
        with patch.object(probe, "bound_json", return_value={**policy, "maxOptimizerSteps": 513}):
            with self.assertRaisesRegex(ValueError, "policy changed"):
                probe.read_policy()
        with patch.object(probe, "bound_json", return_value={**policy, "sample": {**policy["sample"], "split": "validation"}}):
            with self.assertRaisesRegex(ValueError, "frozen train item"):
                probe.read_policy()

    def test_worker_rejects_unregistered_optimizer_entry(self):
        policy = probe.read_policy()
        package = {
            "schemaVersion": probe.SCHEMA,
            "scope": policy["scope"],
            "policy": probe.binding(probe.POLICY_PATH),
            "datasetManifest": policy["datasetManifest"],
            "sample": policy["sample"],
            "resources": {"maxWallSeconds": 900, "maxGpuMemoryFraction": 0.7,
                          "maxOutputMiB": 128},
            "maxOptimizerSteps": 512,
            "initializationSeed": 20260929,
            "programBindings": [probe.binding(path) for path in probe.PROGRAMS],
            "experimentIdentity": "unregistered",
            "outputRoot": f"{probe.OUTPUT_PARENT}/unregistered",
        }
        with patch.object(probe, "bound_json", side_effect=[package, policy]):
            with self.assertRaisesRegex(ValueError, "no exact registered active execution"):
                probe.authenticate({"path": "unregistered", "sha256": "0" * 64})


if __name__ == "__main__":
    unittest.main()
