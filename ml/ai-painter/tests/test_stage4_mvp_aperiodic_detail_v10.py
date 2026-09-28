"""CPU-only V10 behavior. Synthetic fields are not data qualification."""
import inspect
import json
from pathlib import Path
import random
import unittest
import torch
from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import aperiodic_detail_basis
from ai_painter_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10 import (
    deterministic_object_crop, OBJECT_CROP_IDENTITIES, carrier_measurements, require_carrier,
)

ROOT = Path(__file__).resolve().parents[3]
RULES = json.loads((ROOT/'data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-contract.json').read_bytes())['cpuCarrierQualification']

def conditions():
    c = torch.zeros(23,192,256)
    c[0] = torch.linspace(0,1,256)[None,:]
    c[1] = torch.linspace(0,1,192)[:,None]
    return c

class V10Tests(unittest.TestCase):
    def test_carrier_is_two_dimensional_and_rejects_axis_controls(self):
        c = conditions()[None]
        require_carrier(carrier_measurements(aperiodic_detail_basis(c,(0,1))), RULES)
        for value in (torch.sin(c[:,0:1]*torch.pi*16), ((torch.arange(192)%8<4).float()[None,None,:,None]).expand(1,1,192,256)):
            with self.assertRaises(ValueError):
                require_carrier(carrier_measurements(value), RULES)

    def test_crop_is_exact_pointwise_and_rng_unchanged(self):
        c = conditions()[None]; before = torch.get_rng_state().clone(); python_rng = random.getstate()
        full = aperiodic_detail_basis(c,(0,1))
        for y,x in ((0,0),(31,72),(128,192)):
            crop = aperiodic_detail_basis(c[:,:,y:y+64,x:x+64],(0,1))
            self.assertTrue(torch.equal(crop,full[:,:,y:y+64,x:x+64]))
        self.assertTrue(torch.equal(before,torch.get_rng_state())); self.assertEqual(python_rng,random.getstate())

    def test_crop_selects_real_disconnected_object_not_empty_centroid(self):
        c = conditions(); indices = {k:2+i for i,k in enumerate(OBJECT_CROP_IDENTITIES)}
        for index in indices.values(): c[index,1,1]=1; c[index,190,254]=1
        sample = {'conditions':c,'image':torch.zeros(3,192,256),'split':'train'}
        for epoch in (1,2,24):
            for i in range(48):
                crop,e = deterministic_object_crop(sample,responsibility_indices=indices,epoch=epoch,sample_index=i,seed=20260928)
                self.assertEqual(tuple(crop['image'].shape),(3,64,64)); self.assertGreater(e['maskNonzero'],0)
                changed = {**sample,'image':torch.ones_like(sample['image'])}
                _,other = deterministic_object_crop(changed,responsibility_indices=indices,epoch=epoch,sample_index=i,seed=20260928)
                self.assertEqual(e,other)
                self.assertTrue(torch.equal(crop['conditions'],c[:,e['top']:e['top']+64,e['left']:e['left']+64]))

    def test_empty_support_and_wrong_size_reject(self):
        c=conditions();indices={k:2+i for i,k in enumerate(OBJECT_CROP_IDENTITIES)}
        for size in ((64,64),(128,128)):
            with self.assertRaises(ValueError):
                deterministic_object_crop({'conditions':c,'image':torch.zeros(3,192,256)},responsibility_indices=indices,epoch=1,sample_index=0,seed=1,crop_size=size)

    def test_no_rgb_or_world_seed_claim_in_carrier_api(self):
        self.assertEqual(list(inspect.signature(aperiodic_detail_basis).parameters),['conditions','coordinate_indices','scales'])
        c=conditions()[None]; c[0,0,0,0]=float('nan')
        with self.assertRaises(ValueError): aperiodic_detail_basis(c,(0,1))

if __name__ == '__main__':
    torch.set_num_threads(2)
    unittest.main()
