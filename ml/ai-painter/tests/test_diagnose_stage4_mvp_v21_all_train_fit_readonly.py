"""CPU counterexamples for exact endpoint, all-train identity and read-only metrics."""
from __future__ import annotations

from copy import deepcopy
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp_v21_all_train_fit_readonly as probe
import torch


class EndpointFitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        with patch.object(torch, "load", side_effect=AssertionError("preflight deserialized checkpoint")), \
             patch.object(probe.cpu, "load_sample", side_effect=AssertionError("preflight decoded pixels")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("preflight queried CUDA")):
            cls.context = probe.inspect_inputs()

    def fixture(self):
        order = self.context["order"]
        image = torch.zeros(3, 192, 256)
        conditions = torch.zeros(23, 192, 256)
        conditions[order.index("object_tree"), 8:12, 10:14] = 1
        conditions[order.index("object_footprints"), 8:12, 10:14] = 1
        conditions[order.index("object_instance"), 8:12, 10:14] = 7 / 255
        image[:, 8:12, 10:14] = torch.linspace(.2, .8, 16).reshape(1, 4, 4)
        table = [{"value": 7, "kind": "tree", "footprint": {"x": 40, "y": 32, "width": 16, "height": 16}}]
        return {"sampleId": "fixture-train", "split": "train", "image": image,
                "conditions": conditions, "objectInstanceTable": table}

    def test_real_inputs_are_exact_48_train_and_epoch24(self):
        inputs = self.context["inputs"]
        self.assertEqual(inputs["checkpointEpoch"], 24)
        self.assertEqual(inputs["sourceInputs"]["checkpoint"]["sha256"], probe.SOURCE_INPUTS["checkpoint"]["sha256"])
        self.assertEqual(len(inputs["selectedRows"]), 48)
        self.assertEqual([x["trainOrdinal"] for x in inputs["selectedRows"]], list(range(48)))
        self.assertTrue(all(x["split"] == "train" for x in inputs["selectedRows"]))
        self.assertEqual(inputs["registryBeforeStart"]["activeExecution"], None)

    def test_preflight_opens_no_non_train_assets_or_metric_json(self):
        reader = self.context["reader"]
        manifest = reader.json(probe.cpu.MANIFEST)
        source = reader.json(manifest["sourceIndex"])
        for row in source["samples"]:
            if row["split"] != "train":
                for key in ("image", "conditionPack", "sourceRecord", "contribution", "regionSource"):
                    self.assertNotIn(row[key]["path"], reader.observed)
        for split in ("validation", "challenge", "regression"):
            self.assertNotIn(manifest["splits"][split]["path"], reader.observed)
        self.assertEqual(probe.SOURCE_INPUTS["endpointMetadata"]["sha256"],
                         reader.observed[probe.SOURCE_INPUTS["endpointMetadata"]["path"]])

    def test_membership_counterexamples_rejected(self):
        reader = self.context["reader"]
        manifest = reader.json(probe.cpu.MANIFEST)
        source = reader.json(manifest["sourceIndex"])
        train = reader.json(manifest["splits"]["train"])
        candidate = reader.json(probe.training.CANDIDATE)
        contract = reader.json(probe.cpu.CONDITION_CONTRACT)
        bad_train = deepcopy(train)
        bad_train["sampleIds"][1] = bad_train["sampleIds"][0]
        with self.assertRaisesRegex(ValueError, "48 train"):
            probe.validate_membership(manifest, source, bad_train, candidate, contract)
        bad_train = deepcopy(train)
        bad_train["sampleIds"] = list(reversed(bad_train["sampleIds"]))
        with self.assertRaisesRegex(ValueError, "row identity"):
            probe.validate_membership(manifest, source, bad_train, candidate, contract)
        bad_source = deepcopy(source)
        next(x for x in bad_source["samples"] if x["sampleId"] == train["sampleIds"][0])["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "48 train"):
            probe.validate_membership(manifest, bad_source, train, candidate, contract)

    def test_actual_weights_only_cpu_load_is_final_epoch(self):
        with patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU load queried CUDA")):
            model = probe.load_checkpoint_cpu(self.context["reader"], self.context["order"])
        self.assertEqual(probe.cpu.state_hash(model), probe.MODEL_STATE_SHA)
        self.assertFalse(model.training)
        self.assertTrue(all(not x.requires_grad and x.grad is None for x in model.parameters()))

    def test_safe_loader_never_falls_back(self):
        with patch.object(torch, "load", side_effect=RuntimeError("unsupported safe input")) as load:
            with self.assertRaisesRegex(RuntimeError, "unsupported safe input"):
                probe.load_checkpoint_cpu(self.context["reader"], self.context["order"])
        self.assertEqual(load.call_count, 1)
        self.assertIs(load.call_args.kwargs["weights_only"], True)
        self.assertEqual(load.call_args.kwargs["map_location"], "cpu")

    def test_checkpoint_selection_metadata_not_consumed_and_epoch12_rejected(self):
        saved = torch.load(io.BytesIO(self.context["reader"].read(probe.SOURCE_INPUTS["checkpoint"])),
                           map_location="cpu", weights_only=True)
        class MetadataTrap(dict):
            def get(self, key, *args):
                if key in ("validationScore", "checkpointSelection"):
                    raise AssertionError("non-train metric consumed")
                return super().get(key, *args)
            def __getitem__(self, key):
                if key in ("validationScore", "checkpointSelection"):
                    raise AssertionError("non-train metric consumed")
                return super().__getitem__(key)
        probe.validate_checkpoint(MetadataTrap(saved))
        saved["epoch"] = 12
        with self.assertRaisesRegex(ValueError, "epoch24"):
            probe.validate_checkpoint(saved)

    def test_optimizer_checkpoint_write_and_backward_are_blocked(self):
        with probe.readonly_guard():
            with self.assertRaisesRegex(RuntimeError, "optimizer prohibited"):
                torch.optim.AdamW([torch.nn.Parameter(torch.ones(1))])
            with self.assertRaisesRegex(RuntimeError, "checkpoint write prohibited"):
                torch.save({}, io.BytesIO())
            with self.assertRaisesRegex(RuntimeError, "backward prohibited"):
                torch.ones(1, requires_grad=True).backward()

    def test_metrics_exact_target_and_foreign_pixels(self):
        sample = self.fixture()
        exact = probe.fit_metrics(sample["image"][None], sample, self.context["order"])
        self.assertEqual(exact["rgbMae"], 0)
        self.assertAlmostEqual(exact["objects"]["object_tree"]["centeredLumaCorrelation"], 1, places=5)
        self.assertEqual(exact["instanceSupportErrors"][0]["supportRgbMae"], 0)
        self.assertIsNone(exact["objects"]["object_rock"]["centeredLumaCorrelation"])
        changed = sample["image"][None].clone()
        changed[:, :, 150, 150] = 1
        metrics = probe.fit_metrics(changed, sample, self.context["order"])
        self.assertGreater(metrics["rgbMae"], 0)
        self.assertEqual(metrics["objects"]["object_tree"]["rgbMae"], 0)
        self.assertEqual(metrics["instanceSupportErrors"][0]["supportRgbMae"], 0)

    def test_metric_non_train_nonfinite_and_wrong_instance_rejected(self):
        sample = self.fixture()
        sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train only"):
            probe.fit_metrics(sample["image"][None], sample, self.context["order"])
        sample = self.fixture()
        prediction = sample["image"][None].clone()
        prediction[0, 0, 0, 0] = float("nan")
        with self.assertRaisesRegex(ValueError, "invalid predicted"):
            probe.fit_metrics(prediction, sample, self.context["order"])
        sample["objectInstanceTable"][0]["value"] = 9
        with self.assertRaisesRegex(ValueError, "labels differ"):
            probe.fit_metrics(sample["image"][None], sample, self.context["order"])

    def test_result_cardinality_and_order_cannot_fake_48_completion(self):
        selected = self.context["inputs"]["selectedRows"]
        samples = [{k: row[k] for k in ("sampleId", "split", "trainOrdinal")} for row in selected]
        probe.validate_results(samples, selected)
        with self.assertRaisesRegex(ValueError, "48 forwards"):
            probe.validate_results(samples[:-1], selected)
        samples[1] = samples[0]
        with self.assertRaisesRegex(ValueError, "identity/order"):
            probe.validate_results(samples, selected)

    def test_all_unavailable_and_partial_correlations_preserve_null_and_counts(self):
        samples = [{"metrics": {"objects": {role: {"centeredLumaCorrelation": None}
                    for role in probe.ROLES}}} for _ in range(48)]
        summary = probe.summarize_correlations(samples)
        for role in probe.ROLES:
            self.assertIsNone(summary[role]["medianCorrelation"])
            self.assertEqual(summary[role]["validCorrelationCount"], 0)
            self.assertEqual(summary[role]["unavailableCorrelationCount"], 48)
            self.assertEqual(summary[role]["positiveCorrelationCount"], 0)
            self.assertEqual(summary[role]["correlationAvailability"], "unavailable_indeterminate")
        for sample, value in zip(samples, (-.5, 0, .8)):
            sample["metrics"]["objects"]["object_tree"]["centeredLumaCorrelation"] = value
        tree = probe.summarize_correlations(samples)["object_tree"]
        self.assertEqual(tree["medianCorrelation"], 0)
        self.assertEqual(tree["validCorrelationCount"], 3)
        self.assertEqual(tree["unavailableCorrelationCount"], 45)
        self.assertEqual(tree["positiveCorrelationCount"], 1)

    def test_no_policy_no_execution_and_resource_identity_fixed(self):
        inputs = self.context["inputs"]
        policy = {"schemaVersion": probe.POLICY_SCHEMA, "status": "draft_not_executable", "scope": probe.SCOPE,
                  "inputs": inputs, "checkpointUse": "weights_only_diagnostic_only_no_training_initialization",
                  "maxAttempts": 1, "automaticRetries": 0}
        with self.assertRaisesRegex(ValueError, "frozen diagnostic policy"):
            probe.validate_policy(policy, inputs)
        policy["status"] = "active_single_bounded_readonly_diagnostic_not_training"
        probe.validate_policy(policy, inputs)
        policy = deepcopy(policy)
        policy["inputs"]["resources"]["maxForwardCalls"] = 49
        with self.assertRaisesRegex(ValueError, "frozen diagnostic policy"):
            probe.validate_policy(policy, inputs)


if __name__ == "__main__":
    unittest.main()
