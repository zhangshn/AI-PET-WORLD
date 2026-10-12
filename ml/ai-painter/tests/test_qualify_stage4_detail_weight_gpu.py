"""GPU qualification counters only; this suite never initializes CUDA."""
import unittest
from qualify_stage4_detail_weight_gpu import Calls


class GateTests(unittest.TestCase):
    def test_complete48_zero_update_counter_contract(self):
        c=Calls()
        for _ in range(48):
            c.begin()
            for kind,times in (("forward",1),("generator",4),("discriminator",1)):
                for _ in range(times):c.event("attempt",kind,None);c.event("complete",kind,None)
        self.assertEqual(c.counts,{k+s:n for k,n in Calls.LIMITS.items() for s in ("Attempted","Completed")})
        c.begin()
        with self.assertRaises(ValueError):c.event("attempt","forward",None)
    def test_complete_without_attempt_and_case_overrun_fail_before_count(self):
        c=Calls();c.begin()
        with self.assertRaises(ValueError):c.event("complete","generator",None)
        self.assertEqual(c.counts["generatorCompleted"],0)
        c.event("attempt","forward",None)
        with self.assertRaises(ValueError):c.event("attempt","forward",None)
        self.assertEqual(c.counts["forwardAttempted"],1)
