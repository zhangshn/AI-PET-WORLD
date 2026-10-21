import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).absolute().parents[1]/"scripts"))
import decode1_entry_weight_quality_completion_timing_v1 as timing

def ceiling(): return dict(epochs=24,generatorOptimizerSteps=1152,discriminatorOptimizerSteps=1152,maxWallSeconds=8400)
def completion(): return dict(ceiling(),trainingWallMode="completion",maxWallSeconds=None)
def contract(): return dict(capabilityVersion=timing.COMPLETION_CAPABILITY,candidateSelection=timing.COMPLETION_SELECTOR,
    trainingWallMode="completion",maxWallSeconds=None)

class TimingTests(unittest.TestCase):
    def test_old_ceiling_and_explicit_new_route(self):
        old=timing.validate_training_clock(timing.LEGACY_CAPABILITY,ceiling())
        new=timing.validate_training_clock(timing.COMPLETION_CAPABILITY,completion(),contract())
        self.assertEqual(timing.execution_deadline(100,old),8500)
        self.assertIsNone(timing.execution_deadline(100,new))
        timing.require_execution_time(864000,None)
        with self.assertRaises(ValueError): timing.require_execution_time(8500,8500)
        with self.assertRaises(ValueError): timing.validate_training_clock(timing.LEGACY_CAPABILITY,completion(),contract())
        with self.assertRaises(ValueError): timing.validate_training_clock(timing.COMPLETION_CAPABILITY,completion())
        for value in (False,0,8400,999999,float("inf"),float("nan"),"null"):
            with self.assertRaises(ValueError): timing.validate_training_clock(timing.COMPLETION_CAPABILITY,dict(completion(),maxWallSeconds=value),contract())

    def test_phase_budgets_and_fixed_schedule(self):
        new=timing.validate_training_clock(timing.COMPLETION_CAPABILITY,completion(),contract())
        for phase,seconds in dict(cpu=240,qualification=720,review=120,validation=120,adjudication=120,finalization=120).items():
            self.assertEqual(timing.phase_maximum_seconds(phase,new),seconds)
        for key in ("epochs","generatorOptimizerSteps","discriminatorOptimizerSteps"):
            value=completion();value[key]=1
            with self.assertRaises(ValueError): timing.validate_training_clock(timing.COMPLETION_CAPABILITY,value,contract())

    def test_operation_deadline_and_real_elapsed(self):
        self.assertEqual(timing.publication_deadline(20000,None),20000.25)
        self.assertEqual(timing.publication_deadline(10,10.1),10.1)
        self.assertEqual(timing.observed_elapsed_seconds(100,20100),20000)
        self.assertIsNone(timing.observed_elapsed_seconds(100,None))
        with self.assertRaises(ValueError): timing.observed_elapsed_seconds(100,99)
        with self.assertRaises(ValueError): timing.publication_deadline(1,float("inf"))

if __name__=="__main__": unittest.main()
