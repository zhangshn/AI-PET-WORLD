"""Pure fixed-validation and terminal identity checks, no inference."""
import copy
import hashlib
import json
import types
import unittest
from pathlib import Path
from unittest.mock import patch
import review_stage4_ecology_decode1_weight_quality_cpu_v1 as review
from test_ecology_decode1_weight_checkpoint_cpu import configuration, selection

def binding(path):
    return {"path": path, "sha256": "a" * 64}

class QualityReviewTests(unittest.TestCase):
    def setUp(self):
        self.config = configuration()
        self.selected = {"epoch": 12, "counts": {"generator": 576, "discriminator": 576},
            "selection": selection(), "checkpoint": binding("synthetic/checkpoint-12.pt")}
        self.terminal = {"schema": review.TERMINAL_SCHEMA, "status": "training_completed_review_pending",
            "executionState": "completed", "executionProfile": review.EXECUTION_PROFILE,
            "capabilityVersion": review.CAPABILITY, "completedEpochs": 12,
            "optimizerSteps": {"generator": 576, "discriminator": 576}, "optimizerStepsGenerator": 576,
            "optimizerStepsDiscriminator": 576, "checkpointReloadVerified": True,
            "challengeContentRead": False, "regressionContentRead": False, "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
            "executionPackage": binding("synthetic/package.json"), "runId": "synthetic-quality-run",
            "packageId": "synthetic-quality-package", "checkpoints": [self.selected],
            "selectedCheckpointRecord": copy.deepcopy(self.selected)}
        self.ids = ["validation-" + str(i) for i in range(8)]
        self.samples, self.images = [], []
        for i, sid in enumerate(self.ids):
            identity = {"conditionPack": binding("synthetic/condition-" + str(i)),
                "image": binding("synthetic/original-" + str(i))}
            self.samples.append({"_ecology_regime_binding": types.SimpleNamespace(identity_json=json.dumps(identity))})
            self.images.append({"sampleId": sid, "split": "validation", "purpose": "prediction", "epoch": 12,
                "optimizerStep": 576, "checkpoint": self.selected["checkpoint"],
                "binding": binding("synthetic/prediction-" + str(i)),
                "condition": identity["conditionPack"], "originalRgb": identity["image"]})

    def test_only_unique_epoch12_complete_checkpoint_selectable(self):
        fake = types.SimpleNamespace(runtime=lambda: (None, None, None))
        with patch.object(review, "own_worker", return_value=fake):
            self.assertEqual(review.selected_record(self.terminal, configuration=self.config), self.selected)
            for key, value in (("completedEpochs", 11), ("optimizerStepsGenerator", 575),
                ("checkpoints", [self.selected] * 3), ("schema", "ecology-regime-managed-worker-terminal-v1"),
                ("checkpointReloadVerified", False)):
                with self.subTest(key=key), self.assertRaises(ValueError):
                    review.selected_record({**self.terminal, key: value}, configuration=self.config)

    def test_ordered_eight_images_bind_actual_sources_and_selected_checkpoint(self):
        self.assertEqual(review.validate_validation_images(self.images, self.ids, self.selected, self.samples), self.images)
        for key, value in (("sampleId", "wrong"), ("split", "train"), ("epoch", 48),
            ("optimizerStep", 575), ("condition", binding("wrong")),
            ("originalRgb", binding("wrong")), ("checkpoint", binding("wrong")), ("purpose", "baseline")):
            images = copy.deepcopy(self.images); images[0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                review.validate_validation_images(images, self.ids, self.selected, self.samples)

    def test_missing_duplicate_reordered_or_non_binding_images_refused(self):
        duplicate = copy.deepcopy(self.images); duplicate[1]["binding"] = duplicate[0]["binding"]
        invalid = copy.deepcopy(self.images); invalid[0]["binding"]["sha256"] = "caller-says-qualified"
        for images in (self.images[:-1], list(reversed(self.images)), duplicate, invalid):
            with self.assertRaises(ValueError):
                review.validate_validation_images(images, self.ids, self.selected, self.samples)

    def baseline_fixture(self):
        root = Path(__file__).absolute().parents[3]
        class Reader:
            def read(self, binding):
                raw = (root / binding["path"]).read_bytes()
                if hashlib.sha256(raw).hexdigest() != binding["sha256"]:
                    raise ValueError("actual baseline source SHA differs")
                return raw
        reader = Reader()
        prior = review.read_json(reader, review.BASELINE_TERMINAL)
        package = review.read_json(reader, prior["executionPackage"])
        body = review.read_json(reader, prior["workerTerminal"])
        review.read_json(reader, review.BASELINE_AUDIT)
        plan = {"sourceCandidate": package["candidateContract"], "datasetManifest": package["datasetManifest"],
            "validationSplit": package["validationSplit"]}
        import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
        return reader, prior, body, plan, (None, None, shared, None)

    def test_actual_historical_baseline_metadata_keeps_48_epoch_2304_contract(self):
        reader, prior, body, plan, runtime = self.baseline_fixture()
        self.assertEqual([r["epoch"] for r in body["checkpoints"]], [24, 36, 48])
        self.assertEqual(body["optimizerStepsGenerator"], 2304)
        calls = []
        def inference_barrier():
            calls.append("metadata_verified")
            raise RuntimeError("CPU component inference barrier")
        with self.assertRaisesRegex(RuntimeError, "inference barrier"):
            review.baseline_review(reader, plan, [], (), inference_barrier, runtime=runtime)
        self.assertEqual(calls, ["metadata_verified"])

    def test_12_epoch_quality_counts_cannot_relabel_historical_baseline(self):
        reader, prior, body, plan, runtime = self.baseline_fixture()
        original_reader = review.read_json
        for mutate in (lambda value: value.update(completedEpochs=12, optimizerStepsGenerator=576,
                optimizerStepsDiscriminator=576), lambda value: value.update(checkpoints=[self.selected])):
            changed = copy.deepcopy(body); mutate(changed)
            def altered_read(r, binding):
                return changed if binding == prior["workerTerminal"] else original_reader(r, binding)
            resource = unittest.mock.Mock(side_effect=AssertionError("baseline reached inference"))
            with patch.object(review, "read_json", altered_read), self.assertRaisesRegex(ValueError, "V24 baseline"):
                review.baseline_review(reader, plan, [], (), resource, runtime=runtime)
            resource.assert_not_called()

if __name__ == "__main__":
    unittest.main()
