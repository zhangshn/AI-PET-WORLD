from __future__ import annotations

import sys
from pathlib import Path
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
SRC = ROOT / "ml" / "ai-painter" / "src"
for value in (SRC, SCRIPTS):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import (  # noqa: E402
    OBJECT_CROP_IDENTITIES, deterministic_object_crop,
)


INDICES = {identity: 9 + index for index, identity in enumerate(OBJECT_CROP_IDENTITIES)}


class NativeCompleteRgbObjectCropRendererV8Test(unittest.TestCase):
    def sample(self):
        conditions = torch.zeros(23, 192, 256)
        conditions[INDICES["object_tree"], 70:90, 120:145] = 1
        return {"sampleId": "sample", "image": torch.rand(3, 192, 256), "conditions": conditions}

    def test_crop_is_deterministic_and_contains_selected_object(self):
        first, a = deterministic_object_crop(
            self.sample(), responsibility_indices=INDICES, epoch=1, sample_index=0,
            seed=20260926,
        )
        second, b = deterministic_object_crop(
            self.sample(), responsibility_indices=INDICES, epoch=1, sample_index=0,
            seed=20260926,
        )
        self.assertEqual(a, b)
        self.assertEqual(a["identity"], "object_tree")
        self.assertEqual(tuple(first["image"].shape), (3, 128, 128))
        self.assertEqual(tuple(first["conditions"].shape), (23, 128, 128))
        self.assertTrue(torch.equal(first["conditions"], second["conditions"]))
        self.assertGreater(a["maskNonzero"], 0)

    def test_crop_rotates_to_available_identity(self):
        _, evidence = deterministic_object_crop(
            self.sample(), responsibility_indices=INDICES, epoch=2, sample_index=0,
            seed=20260926,
        )
        self.assertEqual(evidence["identity"], "object_tree")

    def test_crop_does_not_modify_source_tensors(self):
        sample = self.sample()
        before = sample["conditions"].clone()
        deterministic_object_crop(
            sample, responsibility_indices=INDICES, epoch=4, sample_index=7,
            seed=20260926,
        )
        self.assertTrue(torch.equal(sample["conditions"], before))


if __name__ == "__main__":
    unittest.main()
