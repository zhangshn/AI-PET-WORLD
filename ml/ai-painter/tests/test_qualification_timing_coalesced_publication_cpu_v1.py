"""Private CPU fixtures only: no live authentication, GPU, model or Run writes."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from uuid import uuid4
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import qualify_stage4_decode1_entry_weight_quality_gpu_v1 as original
from qualification_timing_coalesced_publication_cpu_v1 import (
    CoalescedTimingPublication,
    PUBLICATION_INTERVAL_SECONDS,
)
Candidate = original.CoalescedQualificationObservation
import psutil

process = psutil.Process()
process.cpu_affinity(process.cpu_affinity()[:2])
original.worker._torch_provider.set_num_threads(2)
if original.worker._torch_provider.get_num_interop_threads() != 2:
    original.worker._torch_provider.set_num_interop_threads(2)

PRIVATE_IO_RESULTS = []


class Clock:
    def __init__(self):
        self.value = 0.0

    def __call__(self):
        return self.value

    def advance(self, seconds):
        self.value += seconds


POINTS = (
    "initial_authentication", "data_load", "model_setup", "cuda_setup",
    "resource_checks", "generator_forward", "generator_vjp",
    "discriminator_vjp", "post_vjp_processing",
)


def fixture(kind=Candidate):
    # This bypass is confined to this private test, never an authentication
    # helper: genuine construction still delegates to the original constructor.
    observer = object.__new__(kind)
    observer.calls = original.Calls()
    observer.started = observer.last_clock = 0.0
    observer.active = {}
    observer.aggregates = {
        key: {"attempted": 0, "completed": 0, "failed": 0, "hostSeconds": 0.0}
        for key in POINTS
    }
    observer.sample = None
    observer.entered = observer.completed = observer.generator_base = 0
    observer.status = "observing"
    observer.last_event = None
    observer.identity = {"runId": "private-cpu-fixture", "packageId": "private-not-an-execution"}
    observer.package_binding = {"path": "private/not-a-package.json", "sha256": "0" * 64}
    observer.contract = {
        "schemaVersion": "ai-painter-gpu-qualification-timing-v1",
        "clock": "host_monotonic_elapsed_not_gpu_kernel_time",
        "resourceTimeMeaning": "includes_existing_gpu_synchronization_and_nested_authentication_not_pure_cpu_cost",
        "postVjpProcessingMeaning": "private CPU fixture",
    }
    if isinstance(observer, Candidate):
        observer._initialize_publication_state()
    return observer


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.records = []
        self.clock_patch = patch.object(original.time, "monotonic", self.clock)
        self.clock_patch.start()
        self.writer_patch = patch.object(original.QualificationObservation, "publish", lambda observer: self.record(observer))
        self.writer_patch.start()

    def tearDown(self):
        self.writer_patch.stop()
        self.clock_patch.stop()

    def record(self, observer):
        self.records.append((self.clock(), observer.snapshot()))

    def test_fixed_interval_and_existing_route_adoption(self):
        self.assertEqual(PUBLICATION_INTERVAL_SECONDS, 2.0)
        self.assertIsNot(original.QualificationObservation, Candidate)
        self.assertIs(original.observation_for_context.__globals__["CoalescedQualificationObservation"], Candidate)
        self.assertEqual(Candidate.__bases__, (CoalescedTimingPublication, original.QualificationObservation))
        self.assertIs(Candidate.resource, original.QualificationObservation.resource)
        self.assertIs(Candidate.event, original.QualificationObservation.event)
        self.assertIs(Candidate._stable, original.QualificationObservation._stable)
        self.assertIs(Candidate._replace, original.QualificationObservation._replace)

    def test_factory_keeps_capability_scope_and_original_context_refusal(self):
        context = type("PrivateContext", (), {"plan": {"capabilityVersion": "private"}})()
        with patch.object(original.worker.auth, "execution_route", return_value=type("Route", (), {"capability": "foreign"})()):
            self.assertIsNone(original.observation_for_context(context, original.Calls(), 0.0, 0.0))
        with patch.object(original.worker.auth, "execution_route", return_value=type("Route", (), {"capability": original.worker.auth.CAPABILITY})()):
            with self.assertRaisesRegex(ValueError, "authenticated Context"):
                original.observation_for_context(context, original.Calls(), 0.0, 0.0)

    def test_constructor_keeps_original_authentication(self):
        error = ValueError("private original constructor refused Context")
        with patch.object(original.QualificationObservation, "__init__", side_effect=error) as parent:
            with self.assertRaises(ValueError) as caught:
                Candidate(None, None, 0.0, 0.0)
        self.assertIs(caught.exception, error)
        parent.assert_called_once_with(None, None, 0.0, 0.0)

    def test_first_request_publishes_then_coalesces_without_advancing_clock(self):
        observer = fixture()
        observer.publish()
        self.clock.advance(1.999)
        observer.publish()
        self.assertEqual(len(self.records), 1)
        self.assertEqual(observer._last_successful_publication, 0.0)
        self.clock.value = 2.0
        observer.publish()
        self.assertEqual([r[0] for r in self.records], [0.0, 2.0])

    def test_coalesced_calls_keep_latest_memory_state(self):
        observer = fixture()
        observer.publish()
        observer.calls.begin()
        observer.enter_sample("private-sample", 0)
        observer.event("attempt", "forward", None)
        observer.event("complete", "forward", None)
        self.assertEqual(len(self.records), 1)
        self.assertEqual(observer.calls.counts["forwardCompleted"], 1)
        self.clock.advance(2.0)
        observer.publish()
        self.assertEqual(self.records[-1][1]["actualCounts"]["forwardCompleted"], 1)

    def test_sample_completion_forces_one_write_inside_interval(self):
        observer = fixture()
        observer.publish()
        observer.enter_sample("private-sample", 0)
        self.clock.advance(.1)
        observer.complete_sample()
        self.assertEqual(len(self.records), 2)
        self.assertEqual(self.records[-1][1]["completedSamples"], 1)
        self.assertEqual(observer._deferred_publication_depth, 0)

    def test_sample_completion_at_interval_does_not_double_write(self):
        observer = fixture()
        observer.publish()
        observer.enter_sample("private-sample", 0)
        self.clock.advance(2.0)
        observer.complete_sample()
        self.assertEqual(len(self.records), 2)

    def test_invalid_sample_completion_still_fails_before_forced_write(self):
        observer = fixture()
        observer.publish()
        with self.assertRaises(ValueError):
            observer.complete_sample()
        self.assertEqual(len(self.records), 1)
        self.assertEqual(observer._deferred_publication_depth, 0)

    def test_normal_finish_forces_terminal_snapshot(self):
        observer = fixture()
        observer.publish()
        observer.finish()
        self.assertEqual(len(self.records), 2)
        self.assertEqual(self.records[-1][1]["status"], "probe_sequence_completed_not_qualification")
        self.assertFalse(self.records[-1][1]["canGrantQualification"])

    def test_caught_failure_forces_snapshot_and_keeps_primary(self):
        observer = fixture()
        observer.publish()
        primary = ValueError("original numerical failure")
        observer.finish(primary)
        self.assertEqual(self.records[-1][1]["status"], "failed_closed")
        self.assertFalse(hasattr(primary, "qualification_observation_error"))

    def test_failed_write_never_advances_success_clock_or_retries(self):
        observer = fixture()
        error = PermissionError("private path refused")
        with patch.object(original.QualificationObservation, "publish", side_effect=error) as writer:
            with self.assertRaises(PermissionError) as caught:
                observer.publish()
        self.assertIs(caught.exception, error)
        self.assertIsNone(observer._last_successful_publication)
        writer.assert_called_once_with()

    def test_finish_io_failure_without_primary_remains_fatal(self):
        observer = fixture()
        error = OSError("private output ceiling")
        with patch.object(original.QualificationObservation, "publish", side_effect=error):
            with self.assertRaises(OSError) as caught:
                observer.finish()
        self.assertIs(caught.exception, error)

    def test_finish_io_failure_is_secondary_and_does_not_replace_primary(self):
        observer = fixture()
        primary = ValueError("original failure")
        with patch.object(original.QualificationObservation, "publish", side_effect=OSError("private IO")):
            observer.finish(primary)
        self.assertEqual(str(primary), "original failure")
        self.assertEqual(primary.qualification_observation_error["type"], "OSError")
        self.assertEqual(observer._deferred_publication_depth, 0)

    def test_existing_secondary_error_is_not_overwritten(self):
        observer = fixture()
        primary = ValueError("original failure")
        primary.qualification_observation_error = {"type": "FirstSecondary", "message": "keep"}
        with patch.object(original.QualificationObservation, "publish", side_effect=OSError("later")):
            observer.finish(primary)
        self.assertEqual(primary.qualification_observation_error["type"], "FirstSecondary")

    def test_every_resource_callback_still_runs_and_original_error_is_fatal(self):
        observer = fixture()
        calls = []
        def resource():
            calls.append(1)
            if len(calls) == 5:
                raise ValueError("original resource floor")
            return len(calls)
        for index in range(4):
            self.assertEqual(observer.resource(resource), index + 1)
        with self.assertRaisesRegex(ValueError, "original resource floor"):
            observer.resource(resource)
        self.assertEqual(len(calls), 5)
        self.assertEqual(observer.aggregates["resource_checks"]["attempted"], 5)
        self.assertEqual(observer.aggregates["resource_checks"]["failed"], 1)

    def test_clock_regression_is_not_hidden(self):
        observer = fixture()
        self.clock.value = 2.0
        observer.publish()
        self.clock.value = 1.0
        with self.assertRaisesRegex(ValueError, "clock"):
            observer.publish()

    def test_full48_event_trace_keeps_all_counts_and_callbacks(self):
        snapshots = []
        for kind in (original.QualificationObservation, Candidate):
            self.clock.value = 0.0
            self.records.clear()
            observer = fixture(kind)
            observer.publish()
            resource_count = [0]
            def resource():
                resource_count[0] += 1
                self.clock.advance(.01)
            for index in range(48):
                observer.calls.begin()
                observer.enter_sample("private-" + str(index), index)
                for event in ("forward", "discriminator", *("generator",) * 5):
                    observer.resource(resource)
                    observer.event("attempt", event, None)
                    self.clock.advance(.01)
                    observer.event("complete", event, None)
                    observer.resource(resource)
                observer.probe_returned()
                observer.complete_sample()
            observer.finish()
            snapshots.append({"snapshot": observer.snapshot(), "writes": len(self.records), "callbacks": resource_count[0]})
        self.assertEqual(snapshots[0]["snapshot"], snapshots[1]["snapshot"])
        self.assertEqual(snapshots[0]["callbacks"], snapshots[1]["callbacks"])
        self.assertEqual(snapshots[1]["callbacks"], 672)
        self.assertEqual(snapshots[1]["snapshot"]["actualCounts"], {
            "forwardAttempted": 48, "forwardCompleted": 48,
            "generatorAttempted": 240, "generatorCompleted": 240,
            "discriminatorAttempted": 48, "discriminatorCompleted": 48,
        })
        self.assertLess(snapshots[1]["writes"], snapshots[0]["writes"] // 10)
        self.assertEqual(snapshots[1]["writes"], 50)


def private_disk_observer(base, kind, clock, *, filler_count=0):
    """Real unchanged publisher IO, isolated roots, no live execution identity."""
    project = base / "project"
    data = base / "data"
    project.mkdir()
    (data / "hot/runtime").mkdir(parents=True)
    route = original.worker.auth.execution_route()
    policy_binding = route.execution_policy
    policy_file = project / policy_binding["path"]
    policy_file.parent.mkdir(parents=True)
    policy_file.write_bytes((ROOT / policy_binding["path"]).read_bytes())
    codec = original.worker.auth.checkpoint_components()
    preview = ROOT / codec.PREVIEW_PATH
    configuration = codec.expected_configuration({
        "path": codec.PREVIEW_PATH,
        "sha256": hashlib.sha256(preview.read_bytes()).hexdigest(),
    })
    run_id = "decode1-entry-quality-v1-" + str(uuid4())
    package_id = "decode1-entry-quality-v1-package-" + str(uuid4())
    plan = {
        "runId": run_id, "packageId": package_id,
        "capabilityVersion": route.capability, "executionProfile": route.profile,
        "outputRoot": route.root_prefix + run_id,
        "executionPolicy": dict(policy_binding), "configuration": configuration,
    }
    package = {"packageIdentity": package_id, "capabilityVersion": route.capability,
               "outputRoot": plan["outputRoot"]}
    raw_package = json.dumps(package, sort_keys=True).encode()
    binding = {"path": ".runtime/ai-painter/autonomous-closed-loop-packages/" + package_id + "/package.json",
               "sha256": hashlib.sha256(raw_package).hexdigest()}
    # Environment substitution is confined to this private test process/scope.
    with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
        reader = original.worker.auth.Reader(project)
        directory = reader.path(plan["outputRoot"])
        directory.mkdir(parents=True)
        for index in range(filler_count):
            (directory / ("private-immutable-" + str(index) + ".json")).write_bytes(b'{"private":true}\n')
        context = original.worker.auth.Context(reader, binding, package, plan)
        observer = (original.observation_for_context(context, original.Calls(), clock(), clock())
                    if kind is None else kind(context, original.Calls(), clock(), clock()))
    return observer, data


class PrivateIoTests(unittest.TestCase):
    def test_existing_factory_uses_candidate_and_unchanged_publisher(self):
        with tempfile.TemporaryDirectory(prefix="painter-timing-cpu-factory-") as temp:
            clock = Clock()
            with patch.object(original.time, "monotonic", clock):
                observer, data = private_disk_observer(Path(temp), None, clock)
                self.assertIs(type(observer), Candidate)
                with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
                    first = dict(observer.committed)
                    observer.enter_sample("private", 0)
                    self.assertEqual(observer.committed, first)
                    observer.complete_sample()
                    parsed = json.loads(observer.context.reader.mapping.binding(observer.committed, maximum=32768))
                    self.assertEqual(parsed, observer.snapshot())
                    self.assertEqual(parsed["completedSamples"], 1)
                    self.assertFalse(parsed["canGrantQualification"])
            self.assertFalse(original.worker._torch_provider.cuda.is_initialized())

    def test_actual_original_publisher_disk_trace_is_coalesced_without_losing_events(self):
        results = []
        for kind in (original.QualificationObservation, Candidate):
            with tempfile.TemporaryDirectory(prefix="painter-timing-cpu-private-") as temp:
                clock = Clock()
                started = time.perf_counter()
                publication_count = [0]
                replace = original.os.replace
                def tracked_replace(source, target):
                    result = replace(source, target)
                    if Path(target).name == "gpu-qualification-timing.json":
                        publication_count[0] += 1
                    return result
                with patch.object(original.time, "monotonic", clock), patch.object(original.os, "replace", tracked_replace):
                    observer, data = private_disk_observer(Path(temp), kind, clock, filler_count=32)
                    resource_calls = [0]
                    def resource():
                        resource_calls[0] += 1
                        clock.advance(.01)
                    with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
                        for index in range(8):
                            observer.calls.begin()
                            observer.enter_sample("private-" + str(index), index)
                            for event in ("forward", "discriminator", *("generator",) * 5):
                                observer.resource(resource)
                                observer.event("attempt", event, None)
                                clock.advance(.01)
                                observer.event("complete", event, None)
                                observer.resource(resource)
                            observer.probe_returned()
                            observer.complete_sample()
                        observer.finish()
                        final = observer.context.reader.mapping.binding(observer.committed, maximum=32768)
                        parsed = json.loads(final)
                        self.assertEqual(parsed, observer.snapshot())
                        self.assertFalse(parsed["canGrantQualification"])
                results.append({"candidate": kind is Candidate, "wallSeconds": time.perf_counter() - started,
                                "actualAtomicPublications": publication_count[0], "resourceCallbacks": resource_calls[0],
                                "snapshot": parsed, "fillerFiles": 32})
        self.assertEqual(results[0]["snapshot"]["actualCounts"], results[1]["snapshot"]["actualCounts"])
        self.assertEqual(results[0]["snapshot"]["aggregates"], results[1]["snapshot"]["aggregates"])
        self.assertEqual(results[0]["resourceCallbacks"], results[1]["resourceCallbacks"])
        self.assertEqual(results[1]["actualAtomicPublications"], 10)
        self.assertEqual(results[0]["actualAtomicPublications"], 362)
        self.assertFalse(original.worker._torch_provider.cuda.is_initialized())
        PRIVATE_IO_RESULTS.extend({key: value for key, value in row.items() if key != "snapshot"} for row in results)

    def test_forced_publication_keeps_actual_identity_and_byte_checks(self):
        for failure in ("identity", "oversize"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory(prefix="painter-timing-cpu-boundary-") as temp:
                clock = Clock()
                with patch.object(original.time, "monotonic", clock):
                    observer, data = private_disk_observer(Path(temp), Candidate, clock)
                    with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
                        observer.enter_sample("private", 0)
                        if failure == "identity":
                            observer.context.plan["runId"] = "foreign-private-run"
                        else:
                            observer.aggregates["resource_checks"]["privateOversize"] = "x" * 32768
                        with self.assertRaisesRegex(ValueError, "identity|32768"):
                            observer.complete_sample()

    def test_forced_deadline_failure_keeps_primary_and_does_not_extend_budget(self):
        with tempfile.TemporaryDirectory(prefix="painter-timing-cpu-deadline-") as temp:
            clock = Clock()
            with patch.object(original.time, "monotonic", clock):
                observer, data = private_disk_observer(Path(temp), Candidate, clock)
                primary = ValueError("original resource deadline")
                clock.advance(720.0)
                with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
                    observer.finish(primary)
                self.assertEqual(str(primary), "original resource deadline")
                self.assertEqual(primary.qualification_observation_error["type"], "TimeoutError")
                self.assertEqual(observer._last_successful_publication, 0.0)


if __name__ == "__main__":
    result = unittest.main(exit=False)
    print(json.dumps({"privateCpuOnly": True, "liveAdmissionOrRunWritten": False,
                      "gpuInitialized": original.worker._torch_provider.cuda.is_initialized(),
                      "cpuAffinity": process.cpu_affinity(), "torchThreads": original.worker._torch_provider.get_num_threads(),
                      "routeSourceIntegrated": True, "liveAdmissionExecuted": False,
                      "privateIoComparisons": PRIVATE_IO_RESULTS}))
    sys.exit(not result.result.wasSuccessful())
