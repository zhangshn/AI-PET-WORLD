"""Independent synthetic CPU checks; no live qualification or model evidence.

The original arithmetic gate and same-call authentication remain real in all
persist tests. Model binding is stubbed solely to feed 108 fixed CPU tensors.
Lifecycle/loop fakes are explicitly orchestration tests, not capture provenance.
"""
import ast
import builtins
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import torch
import qualification_parameter0_capture_v1 as subject
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate
from ai_painter.complete_world.parameter40_qualification_observation_v1 import (
    LABELS, RESERVE, TARGET0_SHAPE, TARGET0_SPATIAL, Target0Observation, sha, signature)


class MemoryExclusiveWriter:
    """Bounded tests use an in-memory exclusive byte writer, never production I/O."""
    def __init__(self):
        self.files, self.calls = {}, []
        self.fail_name = None
        self.invalid_binding_name = None

    @staticmethod
    def encode(value):
        return value if type(value) is bytes else (json.dumps(
            value, ensure_ascii=False, allow_nan=False, sort_keys=True) + "\n").encode()

    def __call__(self, name, value):
        self.calls.append(name)
        if name in self.files:
            raise FileExistsError(name)
        if name == self.fail_name:
            raise OSError("injected write failure: " + name)
        raw = self.encode(value)
        self.files[name] = raw
        if name == self.invalid_binding_name:
            return {"path": name}
        return {"path": name, "sha256": hashlib.sha256(raw).hexdigest()}


class LifecycleObserver:
    def __init__(self):
        self.entered, self.exited, self.events = 0, [], []
        self.enter_error = self.exit_error = self.event_error = None
        self.observation_error = None

    def __enter__(self):
        self.entered += 1
        if self.enter_error is not None:
            raise self.enter_error
        return self

    def __exit__(self, kind, error, traceback):
        self.exited.append((kind, error, traceback))
        if self.exit_error is not None:
            raise self.exit_error
        return False

    def event(self, stage, kind, gradients=None):
        self.events.append((stage, kind, gradients))
        if self.event_error is not None:
            raise self.event_error


class Parameter0CaptureCpuTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.guards = ExitStack()
        self.addCleanup(self.guards.close)
        for owner, attribute in ((torch.autograd, "grad"), (torch.autograd, "backward"),
                                 (torch.Tensor, "backward"), (torch.cuda, "_lazy_init"),
                                 (torch.nn.Module, "__init__"), (torch.nn.Module, "_call_impl"),
                                 (torch.nn.Module, "forward"), (torch.optim.Optimizer, "__init__"),
                                 (torch.optim.Optimizer, "step")):
            guard = self.guards.enter_context(patch.object(
                owner, attribute, side_effect=AssertionError("forbidden execution: " + attribute)))
            self.addCleanup(guard.assert_not_called)

    def capture(self, observer=None, sample=None):
        value = object.__new__(subject.Parameter0ProbeCapture)
        value.model = object()
        value.sample = sample if sample is not None else {"sampleId": subject.SAMPLE_ID, "split": "train"}
        value.ordinal = 17
        value.observer = observer if observer is not None else LifecycleObserver()
        value.used, value.persisted, value.primary = False, False, None
        value.callback_failure, value.cleanup_errors = None, []
        return value

    @staticmethod
    def arguments(capture):
        return capture.model, object(), capture.sample, object(), lambda: None

    def real_gate_failure(self):
        observation = object.__new__(Target0Observation)
        parameters = tuple(torch.zeros(TARGET0_SHAPE if i == 0 else (1,), dtype=torch.float32) for i in range(108))
        rows = [[torch.zeros_like(p) for p in parameters] for _ in range(5)]
        for values, scalar in zip(rows, (99.0, 1.0, 2.0, 3.0, 4.0)):
            values[0].fill_(scalar)
        observation.raw = [values[0].clone() for values in rows]
        observation.observation_error = None
        observation.bytes = RESERVE + sum(value.numel() * 4 for value in observation.raw)
        groups, caught = {}, None
        with patch.object(gate, "bind_parameters", return_value=(parameters, groups, (), ())), patch.object(
                gate, "_validate_model_and_parameters", return_value=(parameters, groups)):
            try:
                gate.apply_object_joint_rgb_structure_priority_update_cpu(
                    model=object(), parameters=parameters, total_gradients=rows[0],
                    structured_gradients=rows[1], whole_frame_gradients=rows[2],
                    core_gradients=rows[3], support_gradients=rows[4])
            except ValueError as error:
                caught = error
        self.assertIsNotNone(caught)
        self.assertEqual(str(caught), "actual four-term total gradient identity differs at parameter 0")
        programs = {}
        for function in (gate.apply_object_joint_rgb_structure_priority_update_cpu, gate.require):
            path = Path(function.__code__.co_filename).absolute()
            programs[path.relative_to(ROOT).as_posix()] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        capture = self.capture(observation)
        capture.used, capture.primary = True, caught
        writer = MemoryExclusiveWriter()
        primary = writer("gpu-failure.json", {"type": type(caught).__name__, "message": str(caught)})
        options = dict(primary_binding=primary, identity={"runId": "synthetic-only"}, programs=programs,
                       actual_counts={"forwardCompleted": 18, "generatorCompleted": 90, "discriminatorCompleted": 18},
                       attempted_sample={"sampleId": subject.SAMPLE_ID}, write=writer, resource=lambda: None)
        return capture, caught, writer, options

    def prepare_compact(self, observation):
        # Broadcast fixed planes avoid a needless 53 MiB allocation. Logical byte
        # accounting still uses full production-shaped activations; no forward ran.
        observation.input = torch.zeros(1, 1, *TARGET0_SPATIAL).expand(1, 31, *TARGET0_SPATIAL)
        observation.adjoints = [torch.full((1, 1, *TARGET0_SPATIAL), float(i + 1)).expand(
            1, 48, *TARGET0_SPATIAL) for i in range(5)]
        observation.bytes += (observation.input.numel() + sum(v.numel() for v in observation.adjoints)) * 4
        observation.closed, observation.forward_count, observation.active = True, 1, None

    def assert_primary_preserved(self, capture, primary, result):
        self.assertIs(capture.primary, primary)
        self.assertEqual(result["originalError"], {"type": type(primary).__name__, "message": str(primary)})
        self.assertIs(result["qualificationGranted"], False)
        self.assertEqual(result["optimizerUpdates"], 0)

    def assert_raw_saved(self, capture, writer, result):
        self.assertIn("qualification-target0-gradients.pt", writer.files)
        packet = torch.load(io.BytesIO(writer.files["qualification-target0-gradients.pt"]),
                            map_location="cpu", weights_only=True)
        self.assertEqual(set(packet), {"gradient." + label for label in LABELS})
        for label, value in zip(LABELS, capture.observer.raw):
            self.assertEqual(sha(packet["gradient." + label]), sha(value))
        self.assertEqual(result["originalGate"]["verifiedGradientSets"], 5)
        self.assertIs(result["originalGate"]["sameCallInputsVerified"], True)

    def test_default_none_preserves_argument_and_result_identity(self):
        args, options, answer = (object(), object()), {"event": object(), "option": object()}, object()
        probe = Mock(return_value=answer)
        self.assertIs(subject.invoke_probe(probe, *args, **options), answer)
        self.assertEqual(probe.call_count, 1)
        for actual, expected in zip(probe.call_args.args, args):
            self.assertIs(actual, expected)
        for key in options:
            self.assertIs(probe.call_args.kwargs[key], options[key])

    def test_default_none_preserves_original_exception(self):
        primary = RuntimeError("primary")
        probe = Mock(side_effect=primary)
        with self.assertRaises(RuntimeError) as raised:
            subject.invoke_probe(probe, object(), capture=None)
        self.assertIs(raised.exception, primary)
        probe.assert_called_once()

    @staticmethod
    def qualifier_helper():
        path = ROOT / "ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py"
        tree = ast.parse(path.read_text(encoding="utf-8"))
        node = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "invoke_original_probe")
        namespace = {}
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), namespace)
        return namespace["invoke_original_probe"]

    def test_qualifier_default_none_avoids_capture_import_and_preserves_result(self):
        helper, probe, argument, option, answer = self.qualifier_helper(), Mock(), object(), object(), object()
        probe.return_value = answer
        with patch.object(builtins, "__import__", side_effect=AssertionError("inactive helper imported capture")):
            result = helper(probe, argument, option=option)
        self.assertIs(result, answer)
        probe.assert_called_once_with(argument, option=option)

    def test_qualifier_default_none_preserves_original_exception(self):
        helper, primary = self.qualifier_helper(), RuntimeError("original exception")
        probe = Mock(side_effect=primary)
        with self.assertRaises(RuntimeError) as raised:
            helper(probe, object())
        self.assertIs(raised.exception, primary)
        probe.assert_called_once()

    def test_live_loop_uses_helper_without_activating_capture(self):
        path = ROOT / "ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py"
        tree = ast.parse(path.read_text(encoding="utf-8"))
        run = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "run")
        calls = [node for node in ast.walk(run) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id == "invoke_original_probe"]
        self.assertEqual(len(calls), 1)
        self.assertFalse(any(keyword.arg == "capture" for keyword in calls[0].keywords))
        self.assertEqual(ast.unparse(calls[0].args[0]), "profile.zero_update_probe")

    def test_strict_target_ordinal_sample_id_and_split(self):
        sample = {"sampleId": subject.SAMPLE_ID, "split": "train"}
        self.assertTrue(subject.target_selected(sample, 17))
        for ordinal in (16, 18, 17.0, True, "17", None):
            self.assertFalse(subject.target_selected(sample, ordinal))
        for value in ({"sampleId": "slot-163", "split": "train"},
                      {"sampleId": subject.SAMPLE_ID, "split": "validation"},
                      {"sampleId": subject.SAMPLE_ID}, None, []):
            self.assertFalse(subject.target_selected(value, 17))
        self.assertFalse(subject.target_selected(type("Subclass", (dict,), {})(sample), 17))

    def test_invoke_rejects_non_exact_capture_type(self):
        probe = Mock()
        with self.assertRaises(ValueError):
            subject.invoke_probe(probe, capture=types.SimpleNamespace())
        probe.assert_not_called()

    def test_call_once_and_same_original_arguments(self):
        capture = self.capture()
        args, answer, option = self.arguments(capture), object(), object()
        probe = Mock(return_value=answer)
        self.assertIs(subject.invoke_probe(probe, *args, capture=capture, option=option), answer)
        probe.assert_called_once()
        self.assertEqual(probe.call_args.args, args)
        self.assertIs(probe.call_args.kwargs["option"], option)
        self.assertEqual(capture.observer.entered, 1)
        self.assertEqual(len(capture.observer.exited), 1)
        with self.assertRaises(ValueError):
            capture.call(probe, *args)
        probe.assert_called_once()

    def test_call_rejects_wrong_model_sample_or_argument_count(self):
        for position in (0, 2, None):
            capture, probe = self.capture(), Mock()
            args = list(self.arguments(capture))
            if position is None:
                args.pop()
            else:
                args[position] = object()
            with self.assertRaises(ValueError):
                capture.call(probe, *args)
            probe.assert_not_called()
            self.assertEqual(capture.observer.entered, 0)

    def test_original_event_precedes_observation_once(self):
        capture, order, gradients = self.capture(), [], object()
        capture.observer.event = lambda *values: order.append(("observation", values))
        original = lambda *values: order.append(("original", values))
        def probe(*args, event):
            event("complete", "generator", gradients)
        capture.call(probe, *self.arguments(capture), event=original)
        self.assertEqual([row[0] for row in order], ["original", "observation"])
        self.assertIs(order[0][1][2], gradients)
        self.assertEqual(order[0][1], order[1][1])

    def test_original_event_stop_prevents_observation(self):
        capture, primary = self.capture(), KeyboardInterrupt("original stop")
        original = Mock(side_effect=primary)
        def probe(*args, event):
            event("attempt", "generator", None)
        with self.assertRaises(KeyboardInterrupt) as raised:
            capture.call(probe, *self.arguments(capture), event=original)
        self.assertIs(raised.exception, primary)
        self.assertIs(capture.primary, primary)
        original.assert_called_once()
        self.assertEqual(capture.observer.events, [])
        self.assertIsNone(capture.callback_failure)
        self.assertEqual(len(capture.observer.exited), 1)

    def test_observer_event_failure_keeps_original_event_count(self):
        capture, primary, original = self.capture(), ValueError("observer failure"), Mock()
        capture.observer.event_error = primary
        def probe(*args, event):
            event("attempt", "generator")
        with self.assertRaises(ValueError) as raised:
            capture.call(probe, *self.arguments(capture), event=original)
        self.assertIs(raised.exception, primary)
        original.assert_called_once()
        self.assertEqual(len(capture.observer.events), 1)
        self.assertEqual(capture.callback_failure["message"], "observer failure")

    def test_primary_survives_cleanup_failure(self):
        capture, primary = self.capture(), ValueError("original probe failure")
        capture.observer.exit_error = OSError("cleanup failure")
        with self.assertRaises(ValueError) as raised:
            capture.call(Mock(side_effect=primary), *self.arguments(capture))
        self.assertIs(raised.exception, primary)
        self.assertIs(capture.primary, primary)
        self.assertEqual(capture.cleanup_errors[0]["message"], "cleanup failure")

    def test_entry_failure_still_attempts_cleanup_and_skips_probe(self):
        capture, primary, probe = self.capture(), OSError("entry failure"), Mock()
        capture.observer.enter_error = primary
        with self.assertRaises(OSError) as raised:
            capture.call(probe, *self.arguments(capture))
        self.assertIs(raised.exception, primary)
        probe.assert_not_called()
        self.assertEqual(len(capture.observer.exited), 1)

    def test_cleanup_failure_after_success_is_not_silent(self):
        capture, cleanup = self.capture(), OSError("cleanup failure")
        capture.observer.exit_error = cleanup
        with self.assertRaises(OSError) as raised:
            capture.call(Mock(return_value=object()), *self.arguments(capture))
        self.assertIs(raised.exception, cleanup)
        self.assertIs(capture.primary, cleanup)

    def test_real_target0_exit_attempts_every_handle_and_keeps_primary(self):
        observer = object.__new__(Target0Observation)
        parameter = torch.zeros(TARGET0_SHAPE)
        observer.model = types.SimpleNamespace(named_parameters=lambda: [("parameter", parameter)])
        observer.module = types.SimpleNamespace(weight=parameter)
        observer.before, observer.weight_sha = (signature(parameter),), sha(parameter)
        first, failing, last = Mock(), Mock(), Mock()
        failing.remove.side_effect = OSError("handle removal failure")
        observer.handles, observer.observation_error = [first, failing, last], None
        primary = ValueError("original probe failure")
        self.assertIs(observer.__exit__(ValueError, primary, None), False)
        for handle in (first, failing, last):
            handle.remove.assert_called_once()
        self.assertEqual(observer.handles, [])
        self.assertIs(observer.closed, True)
        self.assertIn("handle removal failure", observer.observation_error)

    def test_persist_requires_primary_binding_before_any_sidecar(self):
        for binding in (None, {}, {"path": "gpu-failure.json"}, {"path": "x", "sha256": "y", "extra": 1}):
            capture, primary, writer, options = self.real_gate_failure()
            options["primary_binding"] = binding
            with self.assertRaises(ValueError):
                capture.persist_failure(primary, **options)
            self.assertEqual(writer.calls, ["gpu-failure.json"])
            self.assertIs(capture.persisted, False)

    def test_persist_rejects_nonidentical_primary_or_repeat(self):
        capture, primary, writer, options = self.real_gate_failure()
        with self.assertRaises(ValueError):
            capture.persist_failure(ValueError(str(primary)), **options)
        with patch.object(Target0Observation, "compact", side_effect=ValueError("compact injection")):
            capture.persist_failure(primary, **options)
        count = len(writer.calls)
        with self.assertRaises(ValueError):
            capture.persist_failure(primary, **options)
        self.assertEqual(len(writer.calls), count)

    def test_real_authentication_raw_compact_and_reference_complete(self):
        capture, primary, writer, options = self.real_gate_failure()
        self.prepare_compact(capture.observer)
        result = capture.persist_failure(primary, **options)
        self.assertEqual(result["status"], "target_evidence_complete")
        self.assertEqual(result["failureClassification"], "authenticated_original_parameter0_gate")
        self.assertEqual(result["comparison"]["localReferenceCount"], 5)
        self.assertEqual(result["secondaryErrors"], [])
        self.assert_primary_preserved(capture, primary, result)
        self.assert_raw_saved(capture, writer, result)
        self.assertEqual(writer.calls[:3], ["gpu-failure.json", "qualification-target0-original.json", "qualification-target0-gradients.pt"])
        self.assertEqual(writer.calls[-1], "qualification-target0-result.json")
        self.assertLessEqual(sum(len(value) for name, value in writer.files.items() if name != "gpu-failure.json"), subject.PACKET_MAXIMUM)
        self.assertLessEqual(len(writer.files["qualification-target0-result.json"]), subject.FINAL_RESERVE)

    def test_real_auth_rejects_empty_or_tampered_five_captures(self):
        for corruption in ("empty", "bytes", "order"):
            capture, primary, writer, options = self.real_gate_failure()
            if corruption == "empty":
                capture.observer.raw = []
            elif corruption == "bytes":
                capture.observer.raw[4].reshape(-1)[0] += 1
            else:
                capture.observer.raw[1], capture.observer.raw[2] = capture.observer.raw[2], capture.observer.raw[1]
            result = capture.persist_failure(primary, **options)
            self.assertEqual(result["status"], "incomplete")
            self.assertNotIn("qualification-target0-gradients.pt", writer.files)
            self.assertNotIn("originalGate", result)
            self.assertEqual(result["failureClassification"], "unverified_probe_or_observation_failure")
            self.assert_primary_preserved(capture, primary, result)

    def test_compact_failure_retains_raw_packet_and_manifest(self):
        capture, primary, writer, options = self.real_gate_failure()
        with patch.object(Target0Observation, "compact", side_effect=OSError("compact injection")):
            result = capture.persist_failure(primary, **options)
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["incompleteAt"], "target_gradients_saved")
        self.assertIn("compact injection", result["secondaryErrors"][0]["message"])
        self.assert_raw_saved(capture, writer, result)
        self.assertIn("qualification-target0-gradients.json", writer.files)
        self.assert_primary_preserved(capture, primary, result)

    def test_reference_failure_retains_raw_and_local_packet(self):
        capture, primary, writer, options = self.real_gate_failure()
        self.prepare_compact(capture.observer)
        with patch.object(subject, "contrast", side_effect=RuntimeError("reference injection")):
            result = capture.persist_failure(primary, **options)
        self.assertEqual(result["incompleteAt"], "local_planes_saved")
        self.assert_raw_saved(capture, writer, result)
        self.assertIn("qualification-target0-local.pt", writer.files)
        self.assert_primary_preserved(capture, primary, result)

    def test_resource_failures_preserve_primary_and_prior_raw(self):
        for fail_at in (1, 2, 3):
            capture, primary, writer, options = self.real_gate_failure()
            self.prepare_compact(capture.observer)
            calls = []
            def resource():
                calls.append(None)
                if len(calls) == fail_at:
                    raise TimeoutError("resource injection")
            options["resource"] = resource
            result = capture.persist_failure(primary, **options)
            self.assertEqual(result["status"], "incomplete")
            self.assert_primary_preserved(capture, primary, result)
            if fail_at >= 2:
                self.assert_raw_saved(capture, writer, result)
            else:
                self.assertNotIn("qualification-target0-gradients.pt", writer.files)

    def test_existing_secondary_errors_prevent_compact_but_keep_raw(self):
        for kind in ("callback", "cleanup", "observer", "probe"):
            capture, primary, writer, options = self.real_gate_failure()
            if kind == "callback": capture.callback_failure = {"message": "callback injection"}
            if kind == "cleanup": capture.cleanup_errors = [{"message": "cleanup injection"}]
            if kind == "observer": capture.observer.observation_error = "observer injection"
            if kind == "probe": options["attempted_sample"]["secondaryProbeErrors"] = ["probe injection"]
            with patch.object(Target0Observation, "compact", side_effect=AssertionError("compact must not run")) as compact:
                result = capture.persist_failure(primary, **options)
            compact.assert_not_called()
            self.assert_raw_saved(capture, writer, result)
            self.assertEqual(result["status"], "incomplete")
            self.assert_primary_preserved(capture, primary, result)

    def test_encoding_failure_cannot_replace_primary(self):
        capture, primary, writer, options = self.real_gate_failure()
        with patch.object(subject, "encode_packet", side_effect=MemoryError("raw encoding injection")):
            result = capture.persist_failure(primary, **options)
        self.assertEqual(result["secondaryErrors"][0]["type"], "MemoryError")
        self.assertNotIn("qualification-target0-gradients.pt", writer.files)
        self.assert_primary_preserved(capture, primary, result)

    def test_each_write_failure_preserves_primary_and_committed_raw(self):
        names = ("qualification-target0-original.json", "qualification-target0-gradients.pt",
                 "qualification-target0-gradients.json", "qualification-target0-local.pt",
                 "qualification-target0-local.json", "qualification-target0-result.json")
        for name in names:
            with self.subTest(name=name):
                capture, primary, writer, options = self.real_gate_failure()
                self.prepare_compact(capture.observer)
                writer.fail_name = name
                result = capture.persist_failure(primary, **options)
                self.assertEqual(result["status"], "incomplete")
                self.assert_primary_preserved(capture, primary, result)
                if names.index(name) >= 2:
                    self.assert_raw_saved(capture, writer, result)
                self.assertIn("gpu-failure.json", writer.files)

    def test_duplicate_path_is_rejected_by_exclusive_writer(self):
        capture, primary, writer, options = self.real_gate_failure()
        original = b"already committed evidence"
        writer.files["qualification-target0-gradients.pt"] = original
        result = capture.persist_failure(primary, **options)
        self.assertEqual(result["secondaryErrors"][0]["type"], "FileExistsError")
        self.assertEqual(writer.files["qualification-target0-gradients.pt"], original)
        self.assert_primary_preserved(capture, primary, result)

    def test_invalid_writer_binding_is_recorded_as_secondary(self):
        capture, primary, writer, options = self.real_gate_failure()
        writer.invalid_binding_name = "qualification-target0-gradients.pt"
        result = capture.persist_failure(primary, **options)
        self.assertIn("exclusive writer binding required", result["secondaryErrors"][0]["message"])
        self.assertIn("qualification-target0-gradients.pt", writer.files)
        self.assert_primary_preserved(capture, primary, result)

    def test_aggregate_bytes_reserve_final_64k_and_keep_raw(self):
        capture, primary, writer, options = self.real_gate_failure()
        self.prepare_compact(capture.observer)
        first = subject.PACKET_MAXIMUM - subject.FINAL_RESERVE - 8192
        # Synthetic serializer sizes test accounting only; real auth runs first.
        with patch.object(subject, "encode_packet", side_effect=(b"r" * first, b"l" * 8192)):
            result = capture.persist_failure(primary, **options)
        self.assertEqual(result["status"], "incomplete")
        self.assertIn("reserve exhausted", result["secondaryErrors"][0]["message"])
        self.assertEqual(len(writer.files["qualification-target0-gradients.pt"]), first)
        self.assertNotIn("qualification-target0-local.pt", writer.files)
        self.assertIn("qualification-target0-result.json", writer.files)
        self.assertLessEqual(sum(len(value) for name, value in writer.files.items() if name != "gpu-failure.json"), subject.PACKET_MAXIMUM)
        self.assertLessEqual(len(writer.files["qualification-target0-result.json"]), subject.FINAL_RESERVE)
        self.assert_primary_preserved(capture, primary, result)

    def test_final_larger_than_reserve_is_rejected_without_removing_raw(self):
        capture, primary, writer, options = self.real_gate_failure()
        self.prepare_compact(capture.observer)
        with patch.object(subject, "contrast", return_value={"large": "x" * subject.FINAL_RESERVE}):
            result = capture.persist_failure(primary, **options)
        self.assertEqual(result["status"], "incomplete")
        self.assertNotIn("qualification-target0-result.json", writer.files)
        self.assert_raw_saved(capture, writer, result)
        self.assert_primary_preserved(capture, primary, result)

    def test_capture_workspace_budget_rejects_before_compact_and_preserves_raw(self):
        capture, primary, writer, options = self.real_gate_failure()
        capture.observer.bytes = subject.MAX_CAPTURE - 2 * subject.PACKET_MAXIMUM
        with patch.object(Target0Observation, "compact") as compact:
            result = capture.persist_failure(primary, **options)
        compact.assert_not_called()
        self.assertIn("workspace exceeds", result["secondaryErrors"][0]["message"])
        self.assert_raw_saved(capture, writer, result)
        self.assert_primary_preserved(capture, primary, result)

    def test_raw_workspace_budget_rejects_before_serialization(self):
        capture, primary, writer, options = self.real_gate_failure()
        capture.observer.bytes = subject.MAX_CAPTURE
        with patch.object(subject, "encode_packet", side_effect=AssertionError("encode must not run")) as encode:
            result = capture.persist_failure(primary, **options)
        encode.assert_not_called()
        self.assertNotIn("qualification-target0-gradients.pt", writer.files)
        self.assertEqual(result["failureClassification"], "authenticated_original_parameter0_gate")
        self.assertIn("raw serialization workspace", result["secondaryErrors"][0]["message"])
        self.assert_primary_preserved(capture, primary, result)

    def test_bounded_encoder_rejects_before_oversized_write(self):
        with subject.BoundedPacketBuffer() as buffer:
            buffer.seek(subject.PACKET_MAXIMUM - 1)
            self.assertEqual(buffer.write(b"x"), 1)
            before = buffer.getvalue()
            with self.assertRaises(ValueError):
                buffer.write(b"x")
            self.assertEqual(buffer.getvalue(), before)

    @staticmethod
    def original_counter_class():
        path = ROOT / "ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py"
        tree = ast.parse(path.read_text(encoding="utf-8"))
        node = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Calls")
        namespace = {"worker": types.SimpleNamespace(require=subject.require)}
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), namespace)
        return namespace["Calls"]

    def simulate_sequence(self, stop_at_target=False):
        calls = self.original_counter_class()()
        helper = self.qualifier_helper()
        model, critic, visited, completed = object(), object(), [], []
        samples = [{"sampleId": subject.SAMPLE_ID if i == 17 else "synthetic-" + str(i), "split": "train"} for i in range(48)]
        primary = ValueError("synthetic original stop")
        active = None
        def probe(g, d, sample, order, resource, *, event, **kwargs):
            self.assertIs(g, model)
            self.assertIs(d, critic)
            visited.append(sample["sampleId"])
            for kind, repetitions in (("forward", 1), ("generator", 5), ("discriminator", 1)):
                for _ in range(repetitions):
                    event("attempt", kind, None)
                    event("complete", kind, None)
            if stop_at_target and sample is samples[17]:
                raise primary
            return {"passed": True}
        caught = None
        try:
            for ordinal, sample in enumerate(samples):
                calls.begin()
                capture = None
                if subject.target_selected(sample, ordinal):
                    capture = self.capture(sample=sample)
                    capture.model = model
                    active = capture
                answer = helper(probe, model, critic, sample, (), lambda: None,
                                capture=capture, event=calls.event)
                completed.append(answer)
        except ValueError as error:
            caught = error
        return calls, samples, visited, completed, active, primary, caught

    def test_simulated_full48_keeps_order_same_gd_and_original_counts(self):
        calls, samples, visited, completed, active, _, caught = self.simulate_sequence()
        self.assertIsNone(caught)
        self.assertEqual(visited, [sample["sampleId"] for sample in samples])
        self.assertEqual(len(completed), 48)
        self.assertEqual(calls.counts, {kind + suffix: count for kind, count in (
            ("forward", 48), ("generator", 240), ("discriminator", 48)) for suffix in ("Attempted", "Completed")})
        self.assertEqual(len(active.observer.events), 14)
        self.assertEqual(active.observer.entered, 1)
        self.assertEqual(len(active.observer.exited), 1)

    def test_simulated_target_failure_keeps_17_completed_18_90_18_counts(self):
        calls, samples, visited, completed, active, primary, caught = self.simulate_sequence(True)
        self.assertIs(caught, primary)
        self.assertIs(active.primary, primary)
        self.assertEqual(visited, [sample["sampleId"] for sample in samples[:18]])
        self.assertEqual(len(completed), 17)
        self.assertEqual(calls.counts, {kind + suffix: count for kind, count in (
            ("forward", 18), ("generator", 90), ("discriminator", 18)) for suffix in ("Attempted", "Completed")})


if __name__ == "__main__":
    unittest.main(verbosity=2)
