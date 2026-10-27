import sys,unittest
from pathlib import Path
import torch
ROOT=Path(__file__).absolute().parents[3]
sys.path[:0]=[str(ROOT/'ml/ai-painter/src'),str(ROOT/'ml/ai-painter/scripts')]
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
import painter_stage4_decode1_entry_weight_training_profile_v1 as profile

class StemPairIdentityTests(unittest.TestCase):
 def setUp(self):torch.set_num_threads(2)
 def test_migration_preserves_learned_parameters_and_rejects_old_identity(self):
  old,_=profile.fresh_networks(identity.FORMAL_CONDITION_CHANNEL_ORDER)
  with torch.no_grad():next(old.parameters()).add_(.01)
  before={k:v.clone() for k,v in old.state_dict().items()}
  new=identity.migrate_original_d1_parameters_to_stem(old,stem_inner=True)
  self.assertEqual(len(list(new.parameters())),108)
  self.assertTrue(all(torch.equal(v,dict(new.named_parameters())[k]) for k,v in old.named_parameters()))
  self.assertTrue(all(torch.equal(v,old.state_dict()[k]) for k,v in before.items()))
  for name in ('regime_identity','numeric_identity','ecology_identity'):self.assertFalse(torch.equal(before[name],new.state_dict()[name]))
  with self.assertRaises(ValueError):new.load_state_dict(before)
  with self.assertRaises(ValueError):old.load_state_dict(new.state_dict())
  fresh,_=profile.fresh_networks(identity.FORMAL_CONDITION_CHANNEL_ORDER,model_capability=identity.STEM_PAIR_CAPABILITY)
  fresh.load_state_dict(new.state_dict())
  self.assertTrue(all(torch.equal(v,fresh.state_dict()[k]) for k,v in new.state_dict().items()))
  self.assertFalse(new.execution_qualified)
 def test_other_numeric_lineage_cannot_be_migrated_or_spoofed(self):
  other,_=profile.fresh_networks(identity.FORMAL_CONDITION_CHANNEL_ORDER,model_capability=identity.DECODE2_CAPABILITY)
  with self.assertRaises(ValueError):identity.migrate_original_d1_parameters_to_stem(other,stem_inner=True)
  new,_=profile.fresh_networks(identity.FORMAL_CONDITION_CHANNEL_ORDER,model_capability=identity.STEM_PAIR_CAPABILITY)
  new.capability_version=identity.CAPABILITY
  with self.assertRaises(ValueError):identity.validate_model_identity(new)

if __name__=='__main__':unittest.main()
