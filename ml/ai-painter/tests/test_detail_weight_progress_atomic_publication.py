"""CPU-only progress publication behavior, including actual Windows file locks.

All files remain in an explicitly supplied private evidence root. These tests
are not lifecycle, data, numerical-model or GPU qualification.
"""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import painter_stage4_detail_weight_capture_execution_worker as worker


class PublicationTests(unittest.TestCase):
    serial = 0

    def setUp(self):
        task_root = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"])
        self.assertTrue(task_root.is_absolute() and task_root.is_dir())
        PublicationTests.serial += 1
        self.directory = task_root / ("case-" + str(PublicationTests.serial))
        self.directory.mkdir()
        self.target = self.directory / "progress.json"
        self.pending = self.directory / "progress.json.staged-0123456789abcdef"
        self.target.write_bytes(b'{"updates":1}')
        self.pending.write_bytes(b'{"updates":2}')

    def publish(self, deadline=None):
        worker.replace_progress_file(self.pending, self.target,
            deadline=time.monotonic() + 2 if deadline is None else deadline)

    def native_reader(self):
        self.assertEqual(sys.platform, "win32")
        api = ctypes.WinDLL("kernel32", use_last_error=True)
        api.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
            wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        api.CreateFileW.restype = wintypes.HANDLE
        api.CloseHandle.argtypes = [wintypes.HANDLE]
        api.CloseHandle.restype = wintypes.BOOL
        # A real reader permits read/write but not FILE_SHARE_DELETE.
        handle = api.CreateFileW(str(self.target), 0x80000000, 1 | 2, None, 3, 0x80, None)
        self.assertNotEqual(handle, ctypes.c_void_p(-1).value)
        closed = [False]
        def close():
            if not closed[0]:
                self.assertTrue(api.CloseHandle(handle))
                closed[0] = True
        self.addCleanup(close)
        return close

    @unittest.skipUnless(sys.platform == "win32", "actual Windows sharing semantics required")
    def test_actual_windows_reader_reproduces_error_then_release_publishes(self):
        close = self.native_reader()
        actual_replace = os.replace
        errors, waits = [], []
        def replacing(*args):
            try:
                return actual_replace(*args)
            except OSError as error:
                errors.append(getattr(error, "winerror", None))
                raise
        def releasing(delay):
            waits.append(delay)
            close()
        with patch.object(worker.os, "replace", side_effect=replacing), patch.object(worker.time, "sleep", side_effect=releasing):
            self.publish()
        self.assertEqual(len(errors), 1)
        self.assertIn(errors[0], (5, 32, 33))
        self.assertEqual(waits, [.010])
        self.assertEqual(self.target.read_bytes(), b'{"updates":2}')
        self.assertFalse(self.pending.exists())

    @unittest.skipUnless(sys.platform == "win32", "actual Windows sharing semantics required")
    def test_persistent_actual_reader_preserves_first_error_and_both_payloads(self):
        self.native_reader()
        actual_replace, errors = os.replace, []
        def replacing(*args):
            try:
                return actual_replace(*args)
            except OSError as error:
                errors.append(error)
                raise
        with patch.object(worker.os, "replace", side_effect=replacing), patch.object(worker.time, "sleep") as sleep:
            with self.assertRaises(OSError) as failure:
                self.publish()
        self.assertEqual(len(errors), 5)
        self.assertIs(failure.exception, errors[0])
        self.assertEqual(sum(call.args[0] for call in sleep.call_args_list), .150)
        self.assertEqual(self.target.read_bytes(), b'{"updates":1}')
        self.assertEqual(self.pending.read_bytes(), b'{"updates":2}')

    def test_unrelated_error_is_not_retried(self):
        error = FileNotFoundError("missing source")
        with patch.object(worker.os, "replace", side_effect=error) as replace, patch.object(worker.time, "sleep") as sleep:
            with self.assertRaises(FileNotFoundError) as failure:
                self.publish()
        self.assertIs(failure.exception, error)
        self.assertEqual(replace.call_count, 1)
        sleep.assert_not_called()

    def test_later_unrelated_error_retains_first_error_and_secondary_chain(self):
        first = PermissionError("original Windows publication denied")
        first.winerror = 5
        secondary = FileNotFoundError("later replacement failed")
        with patch.object(worker.os, "replace", side_effect=[first, secondary]) as replace, patch.object(worker.time, "sleep") as sleep:
            with self.assertRaises(PermissionError) as failure:
                self.publish()
        self.assertIs(failure.exception, first)
        self.assertIs(failure.exception.__cause__, secondary)
        self.assertEqual(replace.call_count, 2)
        sleep.assert_called_once_with(.010)
        self.assertEqual(self.target.read_bytes(), b'{"updates":1}')
        self.assertEqual(self.pending.read_bytes(), b'{"updates":2}')

    def test_non_windows_access_denied_is_not_retried(self):
        error = PermissionError("denied")
        error.winerror = 5
        with patch.object(worker.sys, "platform", "linux"), patch.object(worker.os, "replace", side_effect=error) as replace:
            with self.assertRaises(PermissionError) as failure:
                self.publish()
        self.assertIs(failure.exception, error)
        self.assertEqual(replace.call_count, 1)

    def test_missing_destination_does_not_justify_permission_retry(self):
        self.target.unlink()
        error = PermissionError("denied")
        error.winerror = 5
        with patch.object(worker.os, "replace", side_effect=error) as replace, patch.object(worker.time, "sleep") as sleep:
            with self.assertRaises(PermissionError) as failure:
                self.publish()
        self.assertIs(failure.exception, error)
        self.assertEqual(replace.call_count, 1)
        sleep.assert_not_called()

    def test_initial_snapshot_without_destination_is_supported(self):
        self.target.unlink()
        self.publish()
        self.assertEqual(self.target.read_bytes(), b'{"updates":2}')

    def test_link_metadata_rejected_before_replacement(self):
        original = Path.lstat
        def info(target, *args, **kwargs):
            if target == self.target:
                return os.stat_result((stat.S_IFLNK | 0o777,) + (0,) * 9)
            return original(target, *args, **kwargs)
        with patch.object(Path, "lstat", new=info), patch.object(worker.os, "replace") as replace:
            with self.assertRaisesRegex(ValueError, "regular files"):
                self.publish()
        replace.assert_not_called()

    def test_unknown_stage_name_rejected(self):
        with patch.object(worker.os, "replace") as replace:
            with self.assertRaisesRegex(ValueError, "same-directory"):
                worker.replace_progress_file(self.directory / "model.pt.staged-0123456789abcdef",
                    self.target, deadline=time.monotonic()+2)
        replace.assert_not_called()

    def test_training_deadline_prevents_publication(self):
        with patch.object(worker.os, "replace") as replace:
            with self.assertRaises(TimeoutError):
                self.publish(deadline=time.monotonic()-1)
        replace.assert_not_called()
        self.assertTrue(self.pending.exists())

    def test_operation_window_exhaustion_does_not_retry_or_mask_error(self):
        error = PermissionError("denied")
        error.winerror = 5
        with patch.object(worker.time, "monotonic", side_effect=[0, 0, .249]), patch.object(worker.os, "replace", side_effect=error) as replace, patch.object(worker.time, "sleep") as sleep:
            with self.assertRaises(PermissionError) as failure:
                self.publish(deadline=5)
        self.assertIs(failure.exception, error)
        self.assertEqual(replace.call_count, 1)
        sleep.assert_not_called()


if __name__ == "__main__":
    started = time.monotonic()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(PublicationTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    record = {"schema":"progress-atomic-publication-component-tests-v1",
        "observedAtUtc":__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        "testsRun":result.testsRun,"passed":result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
        "failures":len(result.failures),"errors":len(result.errors),"skipped":len(result.skipped),
        "elapsedSeconds":time.monotonic()-started,"platform":sys.platform,
        "realDatasetReads":0,"optimizerSteps":0,"gpuCalls":0,"trainingRetries":0,
        "actualNativeWindowsReaderTests":2 if sys.platform == 'win32' else 0,
        "doesNotIdentifyHistoricalLockHolder":True,"doesNotGrantLifecycleOrGpuQualification":True,
        "sources":[{"path":p.relative_to(ROOT).as_posix(),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in (Path(worker.__file__),Path(__file__))]}
    target=Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"])/"test-result.json"
    with target.open('xb') as stream:
        stream.write((json.dumps(record)+'\n').encode());stream.flush();os.fsync(stream.fileno())
    raise SystemExit(0 if result.wasSuccessful() and not result.skipped else 1)
