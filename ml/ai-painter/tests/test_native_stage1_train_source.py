import copy
import io
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from ai_painter.complete_world.native_stage1_train_source import (
    GEOMETRY, NativeStage1TrainSource, bound_json, object_geometry, plane)

ROOT=Path(__file__).resolve().parents[3]


class Stage1SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=NativeStage1TrainSource(ROOT)

    def test_real_members_metadata_only_and_corrected_164(self):
        self.assertEqual(len(self.source),48)
        corrected=[]
        with patch("ai_painter.complete_world.native_stage1_train_source.plane",side_effect=AssertionError("raster opened")):
            for row in self.source._rows:
                p=bound_json(ROOT,row["conditionPack"])
                self.source._identity(row,p)
                if "sourceCorrection" in row:corrected.append(row["sampleId"])
        self.assertEqual(corrected,["mvp64-slot164-objects-v5-20261020"])

    def test_foreign_member_and_swapped_rgb_rejected_before_pixel_use(self):
        with self.assertRaisesRegex(ValueError,"training index"):
            self.source.read_arrays(-1)
        reader=NativeStage1TrainSource(ROOT);rows=copy.deepcopy(list(reader._rows))
        rows[0]["image"]=rows[1]["image"];reader._rows=tuple(rows)
        with self.assertRaisesRegex(ValueError,"training source pair"):
            reader.read_arrays(0)
        rows[0]["split"]="validation"
        with self.assertRaisesRegex(ValueError,"training source pair"):
            reader.read_arrays(0)

    def test_wrong_source_dimensions_and_mode_rejected(self):
        for size,mode in [((256,192),"RGB"),((1024,768),"L")]:
            f=io.BytesIO();Image.new(mode,size).save(f,"PNG")
            with self.assertRaisesRegex(ValueError,"native PNG dimensions/mode"):
                plane(f.getvalue(),"RGB",Image.Resampling.LANCZOS)

    def test_core_role_and_edge_clipped_support_in_original_coordinates(self):
        order=("object_instance","object_footprints","object_tree","object_rock","object_vegetation")
        channels=[np.zeros(GEOMETRY.spatial_shape,dtype=np.uint8) for _ in order]
        for i in (0,1,2):channels[i][:3,:4]=1 if i==0 else 255
        table=[{"value":1,"kind":"tree","objectId":"s","footprint":{"x":0,"y":0,"width":8,"height":6}}]
        row=object_geometry(channels,table,order)[0]
        self.assertEqual(row["corePixels"],12);self.assertEqual(row["supportRadius"],16)
        self.assertEqual(row["supportBoundsExclusive"],[0,0,20,19])
        bad=copy.deepcopy(table);bad[0]["footprint"]["x"]=450
        with self.assertRaisesRegex(ValueError,"native core outside"):
            object_geometry(channels,bad,order)
        bad=copy.deepcopy(table);bad[0]["kind"]="rock"
        with self.assertRaisesRegex(ValueError,"object role"):
            object_geometry(channels,bad,order)
        with self.assertRaisesRegex(ValueError,"instance labels"):
            object_geometry(channels,[],order)
