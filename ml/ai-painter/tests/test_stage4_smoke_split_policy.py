import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import run_stage4_semantic_transport_v2_controlled_smoke as adapter


class SmokeSplitPolicyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="stage4-smoke-split-policy-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def write(self, name, value):
        data = json.dumps(value).encode()
        (self.root / name).write_bytes(data)
        return {"path": name, "sha256": hashlib.sha256(data).hexdigest()}

    def config(self, split="validation", declared=None, source_split=None, contribution_split=None):
        source = {"samples": [{"sampleId": "sample-a", "split": source_split or split}],
                  "v7CapacityContributions": [{"sampleId": "sample-a", "split": contribution_split or split}]}
        release = {"schemaVersion": "ai-painter-stage4-v2-dataset-release-contract-v1",
                   "datasetReleaseIdentity": "fixture-release",
                   "sourcePackage": {"sourceIndex": self.write("source.json", source)},
                   "samples": [{"sampleId": "sample-a", "split": split}]}
        return {"training": {"stage4V2ControlledSmokeExecution": {
            "datasetRelease": self.write("release.json", release),
            "derivedConfigContract": {"datasetPackageId": "fixture-release"},
            "sampleId": "sample-a", "sampleSplit": declared or split,
        }}}

    def test_train_only_is_not_capability_qualification(self):
        value = adapter.validate_training_data_use(self.config("train"), self.root)
        self.assertEqual(value["sampleIds"], ["sample-a"])
        self.assertFalse(value["capabilityQualificationGranted"])

    def test_each_non_train_split_and_relabelled_source_is_rejected(self):
        for split in ("validation", "challenge", "regression", "unknown"):
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "non_train_optimizer_source"):
                adapter.validate_training_data_use(self.config(split, declared="train"), self.root)
        for key in ("source_split", "contribution_split"):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "non_train_optimizer_source"):
                adapter.validate_training_data_use(self.config("train", **{key: "validation"}), self.root)

    def test_rehash_prevents_source_or_release_substitution(self):
        for name in ("source.json", "release.json"):
            config = self.config("train")
            self.write(name, {"changed": True})
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                adapter.validate_training_data_use(config, self.root)

    def test_duplicate_or_missing_membership_is_rejected(self):
        for rows in ([], [{"sampleId": "sample-a", "split": "train"}] * 2):
            config = self.config("train")
            release = json.loads((self.root / "release.json").read_text())
            release["samples"] = rows
            config["training"]["stage4V2ControlledSmokeExecution"]["datasetRelease"] = self.write("release.json", release)
            with self.assertRaisesRegex(ValueError, "exactly once"):
                adapter.validate_training_data_use(config, self.root)

    def test_run_entry_refuses_before_importing_training_or_gpu_modules(self):
        config = self.config()
        binding = self.write("config.json", config)
        args = SimpleNamespace(project_root=self.root, config=self.root / "config.json",
                               expected_config_sha256=binding["sha256"])
        # The real active-config identity checks have their own regression suite.
        # Only those are isolated here; source-file reads and the run entry are real.
        with patch.object(adapter, "validate_active_config", return_value=config), \
             patch.dict(sys.modules, {"stage4_semantic_transport_v2_controlled_smoke_training": None}):
            with self.assertRaisesRegex(ValueError, "non_train_optimizer_source"):
                adapter.run_trainer(args)

    def test_direct_lower_entry_refuses_before_cuda_model_optimizer_or_output(self):
        import stage4_semantic_transport_v2_controlled_smoke_training as training
        config = self.config()
        output = self.root / "forbidden-output"
        with patch.object(Path, "cwd", return_value=self.root), \
             patch.object(adapter, "validate_active_config", return_value=config), \
             patch.object(training.torch.cuda, "is_available") as cuda, \
             patch.object(training, "build_complete_world_system") as model, \
             patch.object(training.torch.optim, "AdamW") as optimizer:
            for preflight in (False, True):
                with self.subTest(preflight=preflight), self.assertRaisesRegex(ValueError, "non_train_optimizer_source"):
                    training.execute_stage4_v2_controlled_smoke(
                        config_path=self.root / "unused-config.json",
                        dataset_package_path=self.root / "release.json",
                        autoencoder_checkpoint_path=self.root / "never-loaded.pt",
                        output_dir=output, preflight_only=preflight)
            cuda.assert_not_called()
            model.assert_not_called()
            optimizer.assert_not_called()
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
