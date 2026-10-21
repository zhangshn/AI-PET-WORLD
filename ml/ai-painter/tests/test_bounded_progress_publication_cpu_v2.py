"""Private finite/completion CPU cases; no datasets, model, GPU or registry."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import Mock,patch

ROOT=Path(__file__).absolute().parents[3]
sys.dont_write_bytecode=True
sys.path[:0]=[str(ROOT/"ml/ai-painter/src"),str(ROOT/"ml/ai-painter/scripts")]
from ai_painter.complete_world import bounded_progress_publication_cpu_v2 as component
from painter_stage4_detail_weight_capture_execution_worker import replace_progress_file


class Tests(unittest.TestCase):
    serial=0
    def setUp(self):
        root=Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"]).resolve()
        self.assertTrue(root.is_absolute() and root.is_dir())
        Tests.serial+=1;self.directory=root/("completion-case-"+str(Tests.serial));self.directory.mkdir()
        self.target=self.directory/"progress.json";self.now=time.monotonic();self.offset=0
        self.replace=Mock(side_effect=replace_progress_file);self.budget=Mock()
        self.writer=component.BoundedProgressPublisher(self.target,replace_snapshot=self.replace,
            check_budget=self.budget,clock=lambda:self.now+self.offset,completion_capability=component.COMPLETION_CAPABILITY)

    def publish(self,raw=b'{"count":1}',deadline=None):
        return self.writer.publish(raw,execution_deadline=deadline)

    def native_reader(self):
        self.assertEqual(os.name,"nt","real Windows reader cases are required")
        api=ctypes.WinDLL("kernel32",use_last_error=True)
        api.CreateFileW.argtypes=[wintypes.LPCWSTR,wintypes.DWORD,wintypes.DWORD,wintypes.LPVOID,wintypes.DWORD,wintypes.DWORD,wintypes.HANDLE]
        api.CreateFileW.restype=wintypes.HANDLE
        api.CloseHandle.argtypes=[wintypes.HANDLE];api.CloseHandle.restype=wintypes.BOOL
        handle=api.CreateFileW(str(self.target),0x80000000,1|2,None,3,0x80,None)
        self.assertNotEqual(handle,ctypes.c_void_p(-1).value)
        closed=[False]
        def close():
            if not closed[0]:self.assertTrue(api.CloseHandle(handle));closed[0]=True
        self.addCleanup(close);return close

    def test_registered_policy_and_frozen_atomic_replacement(self):
        p=json.loads((ROOT/"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v2.json").read_bytes())
        self.assertEqual(p["implementation"]["tests"],Path(__file__).relative_to(ROOT).as_posix())
        self.assertIsNone(p["publication"]["completionTrainingTotalDeadline"])
        self.assertEqual(p["publication"]["freshnessSeconds"],120)
        self.assertEqual(p["implementation"]["historicalAtomicReplacement"]["maximumAttemptsPerOperation"],5)
        b=p["implementation"]["historicalAtomicReplacement"]
        self.assertEqual(hashlib.sha256((ROOT/b["path"]).read_bytes()).hexdigest(),b["sha256"])

    def test_completion_publishes_and_retains_capture_clock(self):
        self.assertEqual(self.publish(),"published");self.offset=90
        self.assertEqual(self.publish(b'{"count":2}'),"published")
        self.assertEqual(self.writer.last_published_capture,self.now+90)
        self.assertIsNone(self.writer.pending)

    def test_new_completion_v2_identity_uses_same_bounded_publication(self):
        self.writer=component.BoundedProgressPublisher(self.target,replace_snapshot=self.replace,
            check_budget=self.budget,clock=lambda:self.now+self.offset,completion_capability=component.COMPLETION_V2_CAPABILITY)
        self.assertEqual(self.publish(),"published")
        self.offset=120
        with self.assertRaisesRegex(TimeoutError,"freshness exhausted"):self.publish()

    def test_registered_same_call_identity_uses_original_publication_and_freshness(self):
        policy=json.loads((ROOT/"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v4.json").read_bytes())
        self.assertEqual(component.SAME_CALL_CAPABILITY,policy["publication"]["completionCapability"])
        self.writer=component.BoundedProgressPublisher(self.target,replace_snapshot=self.replace,
            check_budget=self.budget,clock=lambda:self.now+self.offset,completion_capability=component.SAME_CALL_CAPABILITY)
        self.assertEqual(self.publish(),"published")
        self.offset=120
        with self.assertRaisesRegex(TimeoutError,"freshness exhausted"):self.publish()

    def test_same_call_prefixes_foreign_versions_and_flags_do_not_enable_completion(self):
        for identity in (component.SAME_CALL_CAPABILITY+"-foreign",component.SAME_CALL_CAPABILITY[:-1]+"2",True,"same_call_v1"):
            with self.subTest(identity=identity),self.assertRaisesRegex(ValueError,"unknown publication"):
                component.BoundedProgressPublisher(self.target,replace_snapshot=self.replace,
                    check_budget=self.budget,completion_capability=identity)
        self.assertFalse(self.target.exists());self.replace.assert_not_called();self.budget.assert_not_called()

    def test_finite_deadline_and_immutable_mode(self):
        deadline=self.now+10
        self.assertEqual(self.publish(deadline=deadline),"published");self.offset=11
        with self.assertRaisesRegex(TimeoutError,"original execution deadline exhausted"):self.publish(deadline=deadline)

    def test_completion_cannot_switch_to_finite(self):
        self.publish()
        with self.assertRaisesRegex(ValueError,"mode changed"):self.publish(deadline=self.now+100)

    def test_finite_cannot_switch_to_null(self):
        self.publish(deadline=self.now+100)
        with self.assertRaisesRegex(ValueError,"mode changed"):self.publish()

    def test_null_does_not_enable_unselected_or_unknown_route(self):
        writer=component.BoundedProgressPublisher(self.target,replace_snapshot=self.replace,check_budget=self.budget)
        with self.assertRaisesRegex(ValueError,"authenticated completion"):writer.publish(b'{}',execution_deadline=None)
        with self.assertRaisesRegex(ValueError,"unknown publication"):component.BoundedProgressPublisher(self.target,
            replace_snapshot=self.replace,check_budget=self.budget,completion_capability="legacy")

    def test_freshness120_is_not_a_new_total_training_deadline(self):
        self.publish();self.offset=119;self.publish(b'{"count":2}');self.offset=238
        self.publish(b'{"count":3}');self.offset=358
        with self.assertRaisesRegex(TimeoutError,"freshness exhausted"):self.publish()

    def test_staging_metadata_over250ms_has_only_original_freshness_boundary(self):
        def stage_budget(size):self.offset+=.5
        self.budget.side_effect=stage_budget
        self.assertEqual(self.publish(),"published")
        self.assertEqual(self.writer.last_published_capture,self.now)
        self.assertEqual(self.replace.call_count,1)

    def test_initial_publication_denial_is_fatal_and_keeps_original(self):
        first=PermissionError("private initial denial");first.winerror=32;self.replace.side_effect=first
        with self.assertRaises(PermissionError) as caught:self.publish()
        self.assertIs(caught.exception,first);self.assertTrue(self.writer.closed)
        self.assertFalse(self.target.exists());self.assertTrue(self.writer.pending.exists())

    def test_winerror5_without_sharing_is_fatal(self):
        self.publish();first=PermissionError("private ordinary denial");first.winerror=5;self.replace.side_effect=first
        with self.assertRaises(PermissionError) as caught:self.publish(b'{"count":2}')
        self.assertIs(caught.exception,first);self.assertTrue(self.writer.closed)

    def test_real_windows_reader_retains_one_pending_then_releases_original_bytes(self):
        self.publish();close=self.native_reader();self.offset=1
        self.assertEqual(self.publish(b'{"count":2}'),"deferred_confirmed_sharing")
        pending=self.writer.pending;first=self.writer.first_error;self.assertIsInstance(first,OSError)
        self.offset=2;self.assertEqual(self.publish(b'{"count":3}'),"deferred_confirmed_sharing")
        self.assertEqual(self.writer.pending,pending);self.assertEqual(pending.read_bytes(),b'{"count":2}')
        self.assertEqual(len(list(self.directory.glob('progress.json.staged-*'))),1)
        close();self.offset=3
        self.assertEqual(self.publish(b'{"count":4}'),"published_retained_snapshot")
        self.assertEqual(self.target.read_bytes(),b'{"count":2}');self.assertEqual(self.writer.last_published_capture,self.now+1)

    def test_real_windows_reader_cannot_renew_freshness_and_preserves_secondary(self):
        self.publish();self.native_reader();self.offset=1
        self.assertEqual(self.publish(b'{"count":2}'),"deferred_confirmed_sharing")
        first=self.writer.first_error;self.offset=120
        with self.assertRaises(OSError) as caught:self.publish()
        self.assertIs(caught.exception,first);self.assertIsInstance(first.__cause__,TimeoutError)

    def test_budget_and_foreign_target_change_remain_fatal(self):
        self.budget.side_effect=ValueError("private output budget")
        with self.assertRaisesRegex(ValueError,"output budget"):self.publish()
        self.assertFalse(self.target.exists());self.assertEqual(self.replace.call_count,0)

    def test_nonfinite_clock_and_oversize_bytes_are_rejected(self):
        self.offset=float("inf")
        with self.assertRaisesRegex(ValueError,"finite monotonic"):self.publish()
        self.assertEqual(self.replace.call_count,0)


if __name__=="__main__":
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests)).wasSuccessful())
