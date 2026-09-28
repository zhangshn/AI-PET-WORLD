"""CPU probe controls; tests never perform the real model's backward pass."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import check_stage4_mvp_structured_object_v17_cpu_acceptance as probe
import torch
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import original_object_class_spatial_loss


class CpuAcceptanceControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.reader = probe.BoundReader()
        cls.manifest, cls.order, cls.continuous, cls.rows, cls.memberships = probe.select_rows(cls.reader)
        cls.samples, cls.identities = {}, {}
        for split in ("train", "validation"):
            cls.samples[split], cls.identities[split] = probe.load_sample(
                cls.reader, cls.rows[split], cls.order, cls.continuous)

    def test_frozen_membership_and_two_native_sample_bindings(self):
        self.assertEqual({key: value["count"] for key, value in self.memberships.items()}, probe.COUNTS)
        self.assertEqual(len(self.order), 23)
        for split, sample in self.samples.items():
            self.assertEqual(sample["split"], split)
            self.assertEqual(sample["image"].shape, (3, 192, 256))
            self.assertEqual(sample["conditions"].shape, (23, 192, 256))
            self.assertEqual(self.identities[split]["ordinal"], 0)
            self.assertEqual(self.identities[split]["objectCount"], len(sample["objectInstanceTable"]))
            self.assertTrue(bool(torch.isfinite(sample["conditions"]).all()))
        self.assertFalse(torch.cuda.is_initialized())
        self.reader.unchanged()

    def test_missing_hash_tampered_sha_and_path_escape_rejected(self):
        binding = self.rows["train"]["image"]
        for changed in ({"path": binding["path"]}, {**binding, "sha256": "0" * 64},
                        {**binding, "path": "../outside.png"}):
            with self.subTest(binding=changed), self.assertRaises(ValueError):
                self.reader.read(changed)

    def test_canonical_content_hash_is_not_a_file_byte_hash(self):
        raw = b'{ "worldId": "synthetic", "tick": 0, "taskSha256": "ignored" }'
        expected = probe.sha(b'{"worldId":"synthetic","tick":0}')
        probe.verify_js_content_hash(raw, "taskSha256", expected)
        with self.assertRaisesRegex(ValueError, "canonical content SHA"):
            probe.verify_js_content_hash(raw, "taskSha256", probe.sha(raw))

    def test_missing_and_reordered_condition_channels_fail(self):
        pack = self.reader.json(self.rows["train"]["conditionPack"])
        missing = deepcopy(pack)
        missing["channels"].pop()
        swapped = deepcopy(pack)
        swapped["channels"][0], swapped["channels"][1] = swapped["channels"][1], swapped["channels"][0]
        for changed in (missing, swapped):
            with self.assertRaisesRegex(ValueError, "channel order"):
                probe.validate_pack(self.rows["train"], changed, self.order)

    def test_missing_misaligned_and_orphan_object_bindings_fail(self):
        sample = self.samples["train"]
        table = sample["objectInstanceTable"]
        with self.assertRaisesRegex(ValueError, "labels differ"):
            validate_bound_object_views(sample["conditions"], table[1:], self.order)
        shifted = deepcopy(table)
        shifted[0]["footprint"]["x"] = (shifted[0]["footprint"]["x"] + 512) % 900
        with self.assertRaisesRegex(ValueError, "footprint"):
            validate_bound_object_views(sample["conditions"], shifted, self.order)
        conditions = sample["conditions"].clone()
        conditions[self.order.index("object_tree"), 0, 0] = 1
        with self.assertRaisesRegex(ValueError, "mask and instance"):
            validate_bound_object_views(conditions, table, self.order)

    def test_degenerate_original_and_nonfinite_prediction_fail(self):
        sample = self.samples["train"]
        with self.assertRaisesRegex(ValueError, "no nonconstant original"):
            original_object_class_spatial_loss(sample["image"][None],
                {**sample, "image": torch.zeros_like(sample["image"])}, self.order, split="train")
        bad = sample["image"][None].clone()
        bad[0, 0, 0, 0] = float("nan")
        with self.assertRaisesRegex(ValueError, "finite values"):
            original_object_class_spatial_loss(bad, sample, self.order, split="train")

    def test_gradient_check_rejects_missing_nonfinite_and_all_zero_without_backward(self):
        model = torch.nn.Linear(2, 1)
        with self.assertRaisesRegex(ValueError, "missing parameter"):
            probe.gradients(model)
        for parameter in model.parameters():
            parameter.grad = torch.zeros_like(parameter)
        with self.assertRaisesRegex(ValueError, "all model gradients"):
            probe.gradients(model)
        for parameter in model.parameters():
            parameter.grad = torch.ones_like(parameter)
        self.assertEqual(len(probe.gradients(model)), 2)
        model.weight.grad[0, 0] = float("nan")
        with self.assertRaisesRegex(ValueError, "nonfinite parameter"):
            probe.gradients(model)

    def test_challenge_regression_content_rejected_before_read(self):
        for split in ("challenge", "regression"):
            with patch.object(self.reader, "json", side_effect=AssertionError("unexpected content read")):
                with self.assertRaisesRegex(ValueError, "content read prohibited"):
                    probe.load_sample(self.reader, {**self.rows["train"], "split": split}, self.order, self.continuous)

    def test_binding_failure_returns_machine_failure_without_model_forward(self):
        with patch.object(probe, "select_rows", side_effect=ValueError("synthetic missing binding")):
            report = probe.run_probe()
        self.assertEqual(report["status"], "failed_closed")
        self.assertEqual(report["error"], "synthetic missing binding")
        self.assertEqual(report["backwardCalls"], 0)
        self.assertFalse(report["qualificationGranted"])
        self.assertFalse(report["optimizerCreated"])


if __name__ == "__main__":
    unittest.main()
