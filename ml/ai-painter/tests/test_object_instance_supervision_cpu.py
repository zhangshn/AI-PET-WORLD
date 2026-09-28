"""CPU-only tests for proposed train-original object supervision."""

import unittest
import json
from pathlib import Path

import torch

from ai_painter.complete_world.object_instance_supervision_cpu import (
    PATCH_SIZE,
    iter_train_object_supervision,
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset


ORDER = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
    "walkable", "collision", "object_footprints", "object_tree",
    "object_rock", "object_vegetation", "focal_area", "object_instance",
    "coordinate_x", "coordinate_y", "signed_distance_path",
    "signed_distance_water", "signed_distance_shoreline",
    "signed_distance_object_ground", "signed_distance_boundary",
    "moisture_proximity",
)


def fixture(value=7):
    image = torch.zeros(3, 192, 256)
    conditions = torch.zeros(23, 192, 256)
    conditions[10, 8:12, 10:14] = 1
    conditions[14, 8:12, 10:14] = value / 255
    image[0, 8:12, 10:14] = 0.9
    sample = {"sampleId": "train-fixture", "split": "train",
              "image": image, "conditions": conditions}
    table = [{"value": value, "kind": "tree", "footprint": {
        "x": 40, "y": 32, "width": 16, "height": 16,
    }}]
    return sample, table


class ObjectSupervisionCpuTests(unittest.TestCase):
    def test_train_original_rgb_is_cropped_in_memory_with_validity_mask(self):
        sample, table = fixture()
        (item,) = list(iter_train_object_supervision(sample, table, ORDER))
        self.assertEqual(tuple(item.target_rgb.shape), (3, PATCH_SIZE, PATCH_SIZE))
        self.assertEqual(float(item.subject_mask.sum()), 16)
        self.assertAlmostEqual(float(item.target_rgb[0].sum()), 14.4, places=5)
        self.assertTrue(bool((item.support_mask >= item.subject_mask).all()))
        self.assertLess(float(item.valid_mask.sum()), PATCH_SIZE * PATCH_SIZE)

    def test_arbitrary_sample_local_label_does_not_become_a_model_feature(self):
        first, first_table = fixture(7)
        second, second_table = fixture(31)
        original_conditions = first["conditions"].clone()
        a = next(iter_train_object_supervision(first, first_table, ORDER))
        b = next(iter_train_object_supervision(second, second_table, ORDER))
        self.assertTrue(torch.equal(a.subject_conditions, b.subject_conditions))
        self.assertTrue(torch.equal(a.target_rgb, b.target_rgb))
        self.assertTrue(torch.equal(first["conditions"], original_conditions))
        self.assertNotEqual(a.instance_value, b.instance_value)

    def test_non_train_split_fails_before_reading_image(self):
        sample, table = fixture()
        sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train split"):
            list(iter_train_object_supervision(sample, table, ORDER))

    def test_missing_or_mismatched_instance_fails_closed(self):
        sample, table = fixture()
        table[0]["value"] = 9
        with self.assertRaisesRegex(ValueError, "labels differ"):
            list(iter_train_object_supervision(sample, table, ORDER))
        sample, table = fixture()
        sample["conditions"][10] = 0
        with self.assertRaisesRegex(ValueError, "role mask"):
            list(iter_train_object_supervision(sample, table, ORDER))

    def test_native_footprint_mismatch_fails_closed(self):
        sample, table = fixture()
        table[0]["footprint"]["x"] = 100
        with self.assertRaisesRegex(ValueError, "escaped"):
            list(iter_train_object_supervision(sample, table, ORDER))

    def test_out_of_domain_pixels_fail_closed(self):
        sample, table = fixture()
        sample["image"][0, 9, 11] = 1.1
        with self.assertRaisesRegex(ValueError, r"in \[0,1\]"):
            list(iter_train_object_supervision(sample, table, ORDER))

    def test_real_bound_train_pack_supplies_instance_table_without_new_assets(self):
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-local-texture-v12-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(root, contract["datasetManifest"], "train", (256, 192))
        sample = load_bound_object_sample(dataset, 0)
        table = sample["objectInstanceTable"]
        self.assertGreater(len(table), 0)
        self.assertEqual(len(table), len(list(iter_train_object_supervision(
            sample, table, dataset.manifest["identityPayload"]["channelOrder"]))))
        table[0]["kind"] = "tampered"
        self.assertNotEqual(load_bound_object_sample(dataset, 0)["objectInstanceTable"][0]["kind"],
                            "tampered")

    def test_full_bound_train_and_validation_object_tables(self):
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-local-texture-v12-contract.json")
                              .read_text(encoding="utf-8"))
        counts = {}
        for split, expected in (("train", 48), ("validation", 8)):
            dataset = SplitReleaseDataset(root, contract["datasetManifest"], split, (256, 192))
            self.assertEqual(len(dataset), expected)
            counts[split] = sum(len(load_bound_object_sample(dataset, index)["objectInstanceTable"])
                                for index in range(len(dataset)))
            self.assertGreater(counts[split], 0)
        self.assertEqual(counts["train"], 2406)


if __name__ == "__main__":
    unittest.main()
