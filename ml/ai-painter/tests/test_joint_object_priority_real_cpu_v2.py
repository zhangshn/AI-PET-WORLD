"""Stdlib-only affinity tests; no global process pinning or real model runtime."""
from contextlib import ExitStack
import hashlib
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).absolute().parents[3]
SPEC = importlib.util.spec_from_file_location("joint_real_cpu_v2_component_checker",
    ROOT / "ml/ai-painter/scripts/check_joint_object_priority_real_cpu_v2.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class ProcessStandIn:
    def __init__(self, allowed, *, actual=None, set_error=None):
        self.allowed = allowed
        self.actual = actual
        self.set_error = set_error
        self.calls = []
        self.applied = None

    def cpu_affinity(self, *args):
        if args:
            self.calls.append(("set", args[0]))
            if self.set_error is not None:
                raise self.set_error
            self.applied = list(args[0])
            return None
        self.calls.append(("get",))
        return self.allowed if self.applied is None else self.actual if self.actual is not None else self.applied


def torch_stand_in(interop=1):
    return types.SimpleNamespace(set_num_threads=Mock(), get_num_interop_threads=Mock(return_value=interop),
        set_num_interop_threads=Mock(), cuda=types.SimpleNamespace(is_initialized=Mock(return_value=False)))


class AffinityTests(unittest.TestCase):
    def test_one_two_and_many_allowed_cpus_set_then_read_back(self):
        for allowed in ([3], [5, 2], [7, 4, 1, 9]):
            with self.subTest(allowed=allowed):
                process, torch = ProcessStandIn(allowed), torch_stand_in()
                facts = checker.initialize_cpu_resources(process, torch)
                self.assertEqual(process.calls, [("get",), ("set", allowed[:2]), ("get",)])
                self.assertEqual(facts["allowedCpuAffinity"], allowed)
                self.assertEqual(facts["selectedCpuAffinity"], allowed[:2])
                self.assertEqual(facts["verifiedCpuAffinity"], allowed[:2])
                torch.set_num_threads.assert_called_once_with(2)
                torch.set_num_interop_threads.assert_called_once_with(2)

    def test_readback_set_order_can_differ(self):
        process, torch = ProcessStandIn([6, 3, 8], actual=[3, 6]), torch_stand_in(interop=2)
        facts = checker.initialize_cpu_resources(process, torch)
        self.assertEqual(set(facts["verifiedCpuAffinity"]), {3, 6})
        torch.set_num_interop_threads.assert_not_called()

    def test_invalid_allowed_sets_fail_before_set_or_thread_initialization(self):
        for allowed in ([], (), None, [0, 0], [-1], [False], [1.5], ["1"], {0, 1}):
            with self.subTest(allowed=allowed):
                process, torch = ProcessStandIn(allowed), torch_stand_in()
                with self.assertRaisesRegex(ValueError, "allowed CPU set"):
                    checker.initialize_cpu_resources(process, torch)
                self.assertEqual(process.calls, [("get",)])
                torch.set_num_threads.assert_not_called()

    def test_setting_error_is_preserved_without_verification_or_model_call(self):
        first = OSError("set affinity denied")
        process, torch, model = ProcessStandIn([0, 1, 2], set_error=first), torch_stand_in(), Mock()
        with self.assertRaises(OSError) as caught:
            checker.initialize_cpu_resources(process, torch)
            model()
        self.assertIs(caught.exception, first)
        self.assertEqual(process.calls, [("get",), ("set", [0, 1])])
        torch.set_num_threads.assert_not_called()
        model.assert_not_called()

    def test_invalid_out_of_set_or_mismatched_readbacks_fail(self):
        for actual in ([], [0], [0, 2], [0, 1, 2], [0, 0], [-1, 1], [False, 1], ["0", 1]):
            with self.subTest(actual=actual):
                process, torch = ProcessStandIn([0, 1, 2], actual=actual), torch_stand_in()
                with self.assertRaisesRegex(ValueError, "readback"):
                    checker.initialize_cpu_resources(process, torch)
                self.assertEqual(process.calls, [("get",), ("set", [0, 1]), ("get",)])
                torch.set_num_threads.assert_not_called()

    def test_getter_and_thread_errors_are_not_suppressed(self):
        process, torch = ProcessStandIn([0]), torch_stand_in()
        process.cpu_affinity = Mock(side_effect=OSError("cannot get allowed set"))
        with self.assertRaisesRegex(OSError, "cannot get"):
            checker.initialize_cpu_resources(process, torch)
        process = ProcessStandIn([0])
        torch.set_num_threads.side_effect = RuntimeError("thread initialization failed")
        with self.assertRaisesRegex(RuntimeError, "thread initialization"):
            checker.initialize_cpu_resources(process, torch)

    def test_execution_identity_and_frozen_profile_transport_are_separate(self):
        self.assertEqual(checker.CANDIDATE, "stage4_mvp256_dry_joint_object_priority_real_cpu_v2")
        self.assertEqual(checker.PROFILE, "ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_cpu_v1.py")
        self.assertEqual(checker.UPDATE_RULE, "stage4_mvp256_dry_joint_object_priority_cpu_v1")
        self.assertTrue(checker.SELF.endswith("_v2.py"))
        self.assertTrue(checker.POLICY["path"].endswith("-v2.json"))

    def test_predecessor_bindings_are_read_without_inventing_paths(self):
        item = {"path": "synthetic.json", "sha256": "a" * 64}
        policy = {"schemaVersion": "ai-painter-joint-object-priority-real-cpu-policy-v2",
            "candidateId": checker.CANDIDATE, "updateRule": {"candidateId": checker.UPDATE_RULE,
                "policy": item, "implementation": item, "syntheticAcceptance": item, "historicalSpecification": item},
            "formalSpecification": item, "data": {"dataPlan": checker.DATA_PLAN, "selectedSampleId": checker.SAMPLE_ID},
            "predecessor": {"bindings": {"first": {"path": "specific-failure.json", "sha256": "b" * 64},
                "second": {"path": "specific-claim.json", "sha256": "c" * 64}}}, "qualification": {"trainingAllowed": False}}
        reader = types.SimpleNamespace(read=Mock(return_value=b"{}"))
        checker.validate_policy(reader, policy)
        self.assertEqual([call.args[0] for call in reader.read.call_args_list[-2:]],
            list(policy["predecessor"]["bindings"].values()))


class WorkerWiringTests(unittest.TestCase):
    def run_to_resource_boundary(self, process, *, expected_initialization_failure=False):
        run = "joint-object-real-cpu-v2-synthetic"
        item = {"path": "synthetic.json", "sha256": "a" * 64}
        req = {"schemaVersion": "joint-object-priority-real-cpu-request-v1", "runId": run,
            "candidateId": checker.CANDIDATE, "policy": checker.POLICY, "dataPlan": checker.DATA_PLAN,
            "selectedSampleId": checker.SAMPLE_ID, "outputRoot": checker.OUTPUT_PREFIX + run,
            "programBindings": {"worker": {"path": checker.SELF, "sha256": "a" * 64},
                "profile": {"path": checker.PROFILE, "sha256": "a" * 64}},
            "registryBefore": {"path": checker.REGISTRY, "sha256": "a" * 64},
            "interpreter": {"path": str(Path(sys.executable).absolute()), "sha256": hashlib.sha256(b"exe").hexdigest()},
            "deadlineUnixMs": 200000}
        torch = torch_stand_in()
        profile = types.ModuleType("painter_stage4_joint_object_priority_training_profile_cpu_v1")
        profile.fresh_networks = Mock(side_effect=AssertionError("model prohibited"))
        profile.zero_update_probe = Mock(side_effect=AssertionError("probe prohibited"))
        sample_loader = types.ModuleType("diagnose_ecology_terrain_detail_object_response_cpu_v1")
        sample_loader.load_selected = Mock(side_effect=AssertionError("sample decode prohibited"))
        worker = types.ModuleType("painter_stage4_ecology_terrain_detail_weight_quality_worker_v1")
        worker.runtime = Mock(return_value=(torch, object(), object()))
        worker.verify_loaded_sources = Mock(return_value={"projectSources": [], "dynamicNamespaces": [], "qualified": False})
        auth = types.ModuleType("ecology_terrain_detail_weight_quality_auth_v1")
        auth.CONTROL_JSON_MAX = 2097152
        auth.read_json = Mock(side_effect=lambda reader, bound: req if bound == item else {})
        psutil = types.ModuleType("psutil")
        psutil.Process = Mock(return_value=process)
        reader = types.SimpleNamespace(read=Mock(return_value=b"source"), unchanged=Mock(),
            mapping=types.SimpleNamespace(check=Mock()), observed={})
        locator = Mock(side_effect=ValueError("synthetic stop before sample computation"))
        modules = {module.__name__: module for module in (auth, worker, sample_loader, profile, psutil)}
        with ExitStack() as scope:
            scope.enter_context(patch.dict(sys.modules, modules))
            scope.enter_context(patch.dict(checker.os.environ, {"CUDA_VISIBLE_DEVICES": ""}))
            scope.enter_context(patch.object(checker, "bootstrap_request", return_value=req))
            scope.enter_context(patch.object(checker, "selected_reader_class", return_value=lambda root: reader))
            scope.enter_context(patch.object(checker, "validate_policy"))
            scope.enter_context(patch.object(checker, "prepare_data_locator", locator))
            scope.enter_context(patch.object(checker.time, "time", return_value=100.))
            scope.enter_context(patch.object(Path, "read_bytes", return_value=b"exe"))
            init = scope.enter_context(patch.object(checker, "initialize_cpu_resources", wraps=checker.initialize_cpu_resources))
            result = checker.run(item)
        init.assert_called_once_with(process, torch)
        profile.fresh_networks.assert_not_called()
        profile.zero_update_probe.assert_not_called()
        sample_loader.load_selected.assert_not_called()
        self.assertEqual(result["actualCalls"]["generatorForwards"], 0)
        self.assertEqual(result["actualCalls"]["decodedTrainSamples"], 0)
        self.assertEqual(result["executionState"], "failed_closed")
        if expected_initialization_failure:
            locator.assert_not_called()
        else:
            locator.assert_called_once()
        return result, torch

    def test_actual_worker_invokes_affinity_set_before_data_or_model(self):
        process = ProcessStandIn([4, 7, 9, 11])
        result, torch = self.run_to_resource_boundary(process)
        self.assertEqual(process.calls, [("get",), ("set", [4, 7]), ("get",)])
        torch.set_num_threads.assert_called_once_with(2)
        self.assertEqual(result["error"]["message"], "synthetic stop before sample computation")

    def test_actual_worker_closes_affinity_set_failure_before_data_model_or_cuda(self):
        result, torch = self.run_to_resource_boundary(ProcessStandIn([1, 2, 3], set_error=OSError("set denied")),
            expected_initialization_failure=True)
        self.assertEqual(result["error"]["message"], "set denied")
        torch.cuda.is_initialized.assert_not_called()

    def test_actual_worker_closes_readback_mismatch_before_data_model(self):
        result, _ = self.run_to_resource_boundary(ProcessStandIn([1, 2, 3], actual=[1, 3]),
            expected_initialization_failure=True)
        self.assertIn("readback", result["error"]["message"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
