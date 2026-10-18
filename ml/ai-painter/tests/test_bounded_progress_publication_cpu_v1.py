"""Private-fixture CPU behavior only; no model/data/GPU or production writes."""
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
from ai_painter.complete_world import bounded_progress_publication_cpu_v1 as candidate
from painter_stage4_detail_weight_capture_execution_worker import replace_progress_file


class Clock:
    def __init__(self):
        self.origin = time.monotonic()
        self.offset = 0
    def __call__(self):
        return self.origin + self.offset


def denied(code=5):
    error = PermissionError("private fixture publication denied")
    error.winerror = code
    return error


class Tests(unittest.TestCase):
    serial = 0
    native_observations = []

    def setUp(self):
        root = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"])
        self.assertTrue(root.is_absolute() and root.is_dir())
        Tests.serial += 1
        self.directory = root / ("candidate-case-" + str(Tests.serial))
        self.directory.mkdir()
        self.target = self.directory / "progress.json"
        self.clock = Clock()
        self.budget = Mock()
        self.replace = Mock(side_effect=replace_progress_file)
        self.writer = candidate.BoundedProgressPublisher(self.target,
            replace_snapshot=self.replace, check_budget=self.budget, clock=self.clock)
        self.deadline = self.clock.origin + 1000

    def publish(self, raw=b'{"count":1}'):
        return self.writer.publish(raw, execution_deadline=self.deadline)

    def seed(self):
        self.assertEqual(self.publish(), "published")
        self.replace.reset_mock()
        self.budget.reset_mock()

    def native_reader(self, *, share_delete=False):
        api = ctypes.WinDLL("kernel32", use_last_error=True)
        api.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
            wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        api.CreateFileW.restype = wintypes.HANDLE
        api.CloseHandle.argtypes = [wintypes.HANDLE]
        api.CloseHandle.restype = wintypes.BOOL
        handle = api.CreateFileW(str(self.target), 0x80000000,
            1 | 2 | (4 if share_delete else 0), None, 3, 0x80, None)
        self.assertNotEqual(handle, ctypes.c_void_p(-1).value)
        closed = [False]
        def close():
            if not closed[0]:
                self.assertTrue(api.CloseHandle(handle))
                closed[0] = True
        self.addCleanup(close)
        return close

    def test_initial_snapshot_and_fresh_replacement(self):
        self.seed()
        self.clock.offset = 5
        self.assertEqual(self.publish(b'{"count":2}'), "published")
        self.assertEqual(self.target.read_bytes(), b'{"count":2}')
        self.assertIsNone(self.writer.pending)
        self.assertEqual(self.writer.last_published_capture, self.clock())

    def test_registered_cpu_policy_and_frozen_parent_are_exact(self):
        path = ROOT / "data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v1.json"
        policy = json.loads(path.read_bytes())
        self.assertEqual(policy["status"], "registered_inactive_cpu_candidate")
        self.assertFalse(policy["adoption"]["productionAdopted"])
        self.assertFalse(policy["adoption"]["trainingEntrypointIntegrated"])
        self.assertEqual(policy["publication"]["freshnessSeconds"], candidate.FRESHNESS_SECONDS)
        self.assertEqual(policy["publication"]["snapshotMaximumBytes"], candidate.MAX_SNAPSHOT_BYTES)
        self.assertEqual(policy["publication"]["maximumPendingFiles"], 1)
        for binding in (policy["formalSpecification"], policy["historicalSpecification"],
                policy["implementation"]["historicalAtomicReplacement"]):
            path = ROOT / binding["path"]
            if binding is policy["formalSpecification"]:
                path = ROOT / "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.85-d577ef34.txt"
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), binding["sha256"])

    @unittest.skipUnless(os.name == "nt", "native Windows handles required")
    def test_real_sharing_defers_then_releases_and_publishes(self):
        self.seed()
        close = self.native_reader()
        self.clock.offset = 5
        self.assertEqual(self.publish(b'{"count":2}'), "deferred_confirmed_sharing")
        pending, first = self.writer.pending, self.writer.first_error
        self.assertEqual(self.target.read_bytes(), b'{"count":1}')
        self.clock.offset = 10
        self.assertEqual(self.publish(b'{"count":3}'), "deferred_confirmed_sharing")
        self.assertEqual(self.writer.pending, pending)
        self.assertIs(self.writer.first_error, first)
        self.assertEqual(len(list(self.directory.glob("progress.json.staged-*"))), 1)
        self.assertEqual([call.args[0] for call in self.budget.call_args_list], [len(b'{"count":2}'), 0])
        close()
        self.assertEqual(self.publish(b'{"count":3}'), "published_retained_snapshot")
        self.assertEqual(self.writer.last_published_capture, self.clock.origin + 5)
        self.assertEqual(self.publish(b'{"count":3}'), "published")
        self.assertEqual(self.target.read_bytes(), b'{"count":3}')
        self.assertFalse(self.writer.closed)
        Tests.native_observations.append({"readerSharesDelete":False,
            "originalReplaceWinerror":getattr(first,"winerror",None),
            "confirmedSharing":True,"publicationAfterRelease":True})

    @unittest.skipUnless(os.name == "nt", "native Windows handles required")
    def test_shared_delete_reader_is_checked_not_assumed_replace_safe(self):
        self.seed()
        close = self.native_reader(share_delete=True)
        self.clock.offset = 5
        status = self.publish(b'{"count":2}')
        if status == "deferred_confirmed_sharing":
            error = self.writer.first_error
            self.assertTrue(candidate.confirmed_windows_sharing(error, self.writer.pending, self.target))
            self.assertEqual(self.target.read_bytes(), b'{"count":1}')
            close()
            self.assertEqual(self.publish(b'{"count":2}'), "published")
            code = getattr(error, "winerror", None)
        else:
            self.assertEqual(status, "published")
            code = None
        self.assertEqual(self.target.read_bytes(), b'{"count":2}')
        Tests.native_observations.append({"readerSharesDelete":True,
            "initialStatus":status,"originalReplaceWinerror":code,
            "publicationAfterRelease":True})

    def defer(self):
        self.seed()
        self.clock.offset = 5
        error = denied()
        self.replace.side_effect = error
        with patch.object(candidate, "confirmed_windows_sharing", return_value=True):
            self.assertEqual(self.publish(b'{"count":2}'), "deferred_confirmed_sharing")
        return error

    def test_freshness_is_anchored_to_last_published_capture_not_failure(self):
        first = self.defer()
        self.clock.offset = 119
        with patch.object(candidate, "confirmed_windows_sharing", return_value=True):
            self.assertEqual(self.publish(b'{"count":9}'), "deferred_confirmed_sharing")
        calls = self.replace.call_count
        self.clock.offset = 120
        with self.assertRaises(PermissionError) as failure:
            self.publish()
        self.assertIs(failure.exception, first)
        self.assertIsInstance(failure.exception.__cause__, TimeoutError)
        self.assertEqual(self.replace.call_count, calls)
        self.assertTrue(self.writer.closed)
        self.assertTrue(self.writer.pending.exists())
        self.assertEqual(self.target.read_bytes(), b'{"count":1}')

    def test_execution_budget_takes_precedence_over_120_seconds(self):
        self.deadline = self.clock.origin + 8
        first = self.defer()
        self.clock.offset = 8
        with self.assertRaises(PermissionError) as failure:
            self.publish()
        self.assertIs(failure.exception, first)
        self.assertIsInstance(failure.exception.__cause__, TimeoutError)

    def test_execution_deadline_cannot_be_rebound_after_first_publication(self):
        self.seed()
        self.deadline += 1
        with self.assertRaisesRegex(ValueError, "execution deadline changed"):
            self.publish()
        self.replace.assert_not_called()

    def test_nonfinite_deadline_or_clock_is_rejected(self):
        for deadline in (float("nan"), float("inf"), True):
            with self.subTest(deadline=deadline):
                writer = candidate.BoundedProgressPublisher(self.target,
                    replace_snapshot=self.replace, check_budget=self.budget)
                with self.assertRaises(ValueError):
                    writer.publish(b"{}", execution_deadline=deadline)
        self.clock.offset = float("nan")
        with self.assertRaises(ValueError):
            self.publish()
        self.replace.assert_not_called()

    def test_sharing_proof_cannot_return_deferral_after_freshness_deadline(self):
        first = self.defer()
        def expires(*args):
            self.clock.offset = 120
            return True
        with patch.object(candidate, "confirmed_windows_sharing", side_effect=expires):
            with self.assertRaises(PermissionError) as failure:
                self.publish()
        self.assertIs(failure.exception, first)
        self.assertIsInstance(failure.exception.__cause__, TimeoutError)
        self.assertTrue(self.writer.closed)

    def test_target_change_inside_failed_replace_cannot_be_deferred(self):
        self.seed()
        error = denied()
        def swaps(*args, **kwargs):
            self.target.write_bytes(b'{"foreign":true}')
            raise error
        self.replace.side_effect = swaps
        with patch.object(candidate, "confirmed_windows_sharing", return_value=True) as classify:
            with self.assertRaises(PermissionError) as failure:
                self.publish(b'{"count":2}')
        self.assertIs(failure.exception, error)
        self.assertIsInstance(failure.exception.__cause__, ValueError)
        classify.assert_not_called()

    def test_publishing_old_pending_does_not_refresh_its_capture_time(self):
        self.defer()
        self.clock.offset = 119
        self.replace.side_effect = replace_progress_file
        self.assertEqual(self.publish(b'{"count":9}'), "published_retained_snapshot")
        self.assertEqual(self.writer.last_published_capture, self.clock.origin + 5)
        self.clock.offset = 125
        with self.assertRaises(TimeoutError):
            self.publish()

    def test_unconfirmed_access_denial_is_fatal(self):
        self.seed()
        error = denied()
        self.replace.side_effect = error
        with patch.object(candidate, "confirmed_windows_sharing", return_value=False):
            with self.assertRaises(PermissionError) as failure:
                self.publish(b'{"count":2}')
        self.assertIs(failure.exception, error)
        self.assertTrue(self.writer.closed)

    def test_other_error_after_deferral_preserves_original_and_secondary(self):
        first = self.defer()
        secondary = FileNotFoundError("private fixture source disappeared")
        self.replace.side_effect = secondary
        with self.assertRaises(PermissionError) as failure:
            self.publish()
        self.assertIs(failure.exception, first)
        self.assertIs(failure.exception.__cause__, secondary)
        self.assertTrue(self.writer.closed)

    def test_no_successful_initial_snapshot_means_no_deferral(self):
        self.replace.side_effect = denied()
        with patch.object(candidate, "confirmed_windows_sharing", return_value=True) as classify:
            with self.assertRaises(PermissionError):
                self.publish()
        classify.assert_not_called()
        self.assertFalse(self.target.exists())

    def test_target_or_pending_identity_change_is_fatal(self):
        self.defer()
        pending = self.writer.pending
        pending.write_bytes(b'{"forged":true}')
        calls = self.replace.call_count
        with self.assertRaises(PermissionError) as failure:
            self.publish()
        self.assertIsInstance(failure.exception.__cause__, ValueError)
        self.assertEqual(self.replace.call_count, calls)

    def test_foreign_target_change_is_not_tolerated(self):
        self.seed()
        self.target.write_bytes(b'{"foreign":true}')
        with self.assertRaises(ValueError):
            self.publish()
        self.replace.assert_not_called()

    def test_path_redirect_and_wrong_target_name_are_rejected(self):
        with self.assertRaises(ValueError):
            candidate.BoundedProgressPublisher(self.directory / "checkpoint.pt",
                replace_snapshot=self.replace, check_budget=self.budget)
        original = Path.lstat
        def linked(p, *args, **kwargs):
            if p == self.directory:
                import stat
                return os.stat_result((stat.S_IFLNK | 0o777,) + (0,) * 9)
            return original(p, *args, **kwargs)
        with patch.object(Path, "lstat", new=linked):
            with self.assertRaises(ValueError):
                candidate.BoundedProgressPublisher(self.target,
                    replace_snapshot=self.replace, check_budget=self.budget)

    def test_empty_or_oversized_snapshot_does_not_create_files(self):
        for raw in (b"", b"x" * (candidate.MAX_SNAPSHOT_BYTES + 1)):
            with self.subTest(size=len(raw)):
                writer = candidate.BoundedProgressPublisher(self.target,
                    replace_snapshot=self.replace, check_budget=self.budget)
                with self.assertRaises(ValueError):
                    writer.publish(raw, execution_deadline=self.deadline)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_output_budget_failure_precedes_snapshot_write(self):
        self.budget.side_effect = ValueError("existing output reserve exhausted")
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(list(self.directory.iterdir()), [])
        self.replace.assert_not_called()

    def test_retained_pending_rechecks_shared_output_budget(self):
        first = self.defer()
        self.budget.side_effect = ValueError("other evidence exhausted shared output budget")
        calls = self.replace.call_count
        with self.assertRaises(PermissionError) as failure:
            self.publish()
        self.assertIs(failure.exception, first)
        self.assertIsInstance(failure.exception.__cause__, ValueError)
        self.assertEqual(self.budget.call_args.args, (0,))
        self.assertEqual(self.replace.call_count, calls)
        self.assertTrue(self.writer.pending.exists())

    @unittest.skipUnless(os.name == "nt", "Windows classifier required")
    def test_one_shared_file_cannot_hide_other_file_access_error(self):
        self.seed()
        pending = self.directory / "progress.json.staged-0123456789abcdef"
        pending.write_bytes(b'{"count":2}')
        for code in (5, 32, 33):
            with self.subTest(winerror=code):
                with patch.object(candidate, "_windows_occupancy", side_effect=[True, denied()]) as probe:
                    with self.assertRaises(PermissionError):
                        candidate.confirmed_windows_sharing(denied(code), pending, self.target)
                self.assertEqual(probe.call_count, 2)

    def test_closed_publisher_cannot_restart(self):
        self.replace.side_effect = denied()
        with self.assertRaises(PermissionError):
            self.publish()
        self.replace.reset_mock()
        with self.assertRaises(RuntimeError):
            self.publish()
        self.replace.assert_not_called()

    def test_classifier_does_not_interpret_linux_error_as_windows_sharing(self):
        with patch.object(candidate.os, "name", "posix"):
            self.assertFalse(candidate.confirmed_windows_sharing(denied(32), self.target, self.target))

    @unittest.skipUnless(os.name == "nt", "native Windows handles required")
    def test_winerror5_without_current_occupancy_is_not_confirmed(self):
        self.seed()
        pending = self.directory / "progress.json.staged-0123456789abcdef"
        pending.write_bytes(b'{"count":2}')
        self.assertFalse(candidate.confirmed_windows_sharing(denied(), pending, self.target))


if __name__ == "__main__":
    started = time.monotonic()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Tests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    record = {"schemaVersion":"bounded-progress-publication-cpu-tests-v1",
        "observedAtUtc":datetime.now(timezone.utc).isoformat(),
        "testsRun":result.testsRun,"passed":result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
        "failures":len(result.failures),"errors":len(result.errors),"skipped":len(result.skipped),
        "elapsedSeconds":time.monotonic()-started,"nativeObservations":Tests.native_observations,
        "realDatasetReads":0,"gpuCalls":0,"optimizerUpdates":0,"trainingRetries":0,
        "productionAdoption":False,"historicalIncidentRootCauseIdentified":False,
        "sources":[{"path":p.relative_to(ROOT).as_posix(),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in (Path(candidate.__file__),Path(__file__),
                ROOT / "data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v1.json")]}
    target = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"]) / "test-result.json"
    with target.open("xb") as stream:
        stream.write((json.dumps(record)+"\n").encode());stream.flush();os.fsync(stream.fileno())
    raise SystemExit(0 if result.wasSuccessful() and not result.skipped else 1)
