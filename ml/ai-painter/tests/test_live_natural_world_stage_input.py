from io import BytesIO
from pathlib import Path
import hashlib
import unittest
from unittest.mock import patch

from ai_painter.complete_world import live_natural_world_stage_input as stage


class LiveNaturalStageInputTests(unittest.TestCase):
    def test_wrong_stage_is_rejected_before_reading(self):
        with patch.object(stage,"load_live_natural_world_input",side_effect=AssertionError("unexpected source read")):
            for value in (1,2,True,None):
                with self.assertRaisesRegex(ValueError,"Stage0"):
                    stage.load_live_natural_world_stage_input(root=Path.cwd(),descriptor_binding={},stage=value)

    def test_discrete_coordinates_are_native_pixel_centres_and_do_not_mix_labels(self):
        import numpy as np
        from PIL import Image
        raw = np.zeros((768,1024),dtype=np.uint8)
        raw[2,2],raw[2,6],raw[766,1022] = 255,11,29
        b = BytesIO();Image.fromarray(raw).save(b,format="PNG")
        g = stage.NativeStageGeometry(0)
        px = hashlib.sha256(raw.tobytes()).hexdigest()
        disc,disc_sha = stage._resample(b.getvalue(),"nearest",g,px)
        smooth,smooth_sha = stage._resample(b.getvalue(),"bilinear",g,px)
        expected = raw[2::4,2::4]
        self.assertEqual(disc_sha,hashlib.sha256(expected.tobytes()).hexdigest())
        self.assertTrue(np.array_equal(disc.mul(255).round().numpy().astype(np.uint8),expected))
        self.assertLess(smooth[0,0].item(),disc[0,0].item());self.assertNotEqual(smooth_sha,disc_sha)
        with self.assertRaisesRegex(ValueError,"native channel pixels changed"):
            stage._resample(b.getvalue(),"nearest",g,"0"*64)

    def test_missing_instance_fails_closed_even_with_an_otherwise_legal_table(self):
        import torch
        order=["object_instance","object_footprints","object_tree","object_rock","object_vegetation"]
        order += ["unused"+str(i) for i in range(18)]
        row={"value":1,"objectId":"unrepresented","kind":"rock","footprint":{"x":8,"y":8,"width":5,"height":5},"blocksMovement":True}
        with self.assertRaisesRegex(ValueError,"instance table and condition labels differ"):
            stage._instance_geometry(torch.zeros((23,192,256)),[row],order,stage.NativeStageGeometry(0))

    def test_registered_channel_types_cannot_be_swapped_or_duplicated(self):
        ids=["name"+str(i) for i in range(23)]
        contract={"channelOrder":ids,"typePartitions":{"discrete":ids[:15],"continuous":ids[15:]},
                  "resize":{"contractId":"discrete_nearest_continuous_bilinear_v1","typePartitionMustOccurBeforeResize":True,
                            "discrete":{"mode":"nearest","storageCodepointsMustRemainExact":True},"continuous":{"mode":"bilinear","alignCorners":False}}}
        self.assertEqual(stage._channel_modes(contract,ids),("nearest",)*15+("bilinear",)*8)
        contract["typePartitions"]["continuous"]=[ids[0],*ids[16:]]
        with self.assertRaisesRegex(ValueError,"channel partition"):
            stage._channel_modes(contract,ids)
