"""One synthetic CPU suite; no real image/archive/model forward or optimizer."""
import gc
import inspect
import hashlib
import importlib.util
from copy import deepcopy
import json
from pathlib import Path
import struct
import sys
import unittest
import weakref
from unittest.mock import patch

import psutil
_process = psutil.Process()
_process.cpu_affinity(_process.cpu_affinity()[:2])
assert 0 < len(_process.cpu_affinity()) <= 2
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
from torch import nn
from ai_painter.complete_world import parameter90_training_same_call_capture_v1 as capture
from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv

SYNTHETIC_DETAILS = dict(toyForwards=0, toyAutogradCalls=0, outsideContextParameterChanges=0,
                         sealedPackets=0, maximumSerializedSidecarBytes=0, actualCombinedBudgetTests=0)


def setUpModule():
    if torch.cuda.is_initialized():
        raise RuntimeError("CUDA must stay uninitialized")
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)


class Toy(nn.Module):
    def __init__(self):
        super().__init__()
        self.prefix = nn.ParameterList([nn.Parameter(torch.zeros(2242435))] +
                                       [nn.Parameter(torch.zeros(1)) for _ in range(89)])
        self.core = nn.Module()
        self.core.core = nn.Module()
        self.core.core.final_rgb_decoder = nn.Module()
        self.core.core.final_rgb_decoder.base = nn.Module()
        self.core.core.final_rgb_decoder.base.layers = nn.ModuleList(
            [nn.Identity() for _ in range(4)] + [PrecisionFinalRGBConv(nn.Conv2d(48, 3, 1))])
        self.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(16)])

    def forward(self, value):
        SYNTHETIC_DETAILS["toyForwards"] += 1
        return self.core.core.final_rgb_decoder.base.layers[4](value)


class SmallCapture(capture.Parameter90TrainingSameCallCapture):
    def _spatial(self):
        return (4, 5)

    def _validate_model_identity(self, model):
        # Explicit synthetic class, never a production-model qualification.
        if type(model) is not Toy:
            raise ValueError("synthetic fixture model required")


class FullPlaneSyntheticCapture(SmallCapture):
    def _spatial(self):
        return (192, 256)


def graph_of(model):
    return [dict(name=name, shape=list(value.shape), dtype=str(value.dtype), elements=value.numel())
            for name, value in model.named_parameters(remove_duplicate=False)]


def identity(step=0):
    return dict(runId="synthetic-new-run", packageId="synthetic-package", sampleId="synthetic-train",
                epoch=1, zeroBasedEpochPosition=step, trainIndex=step,
                optimizerSteps=dict(generator=step, discriminator=step+1),
                modelBinding=dict(path="private/synthetic-model.json", sha256="a"*64))


def context(model, cls=SmallCapture, **options):
    return cls(model, identity=identity(options.pop("step", 0)), graph=graph_of(model),
               source_bindings=capture.required_source_bindings(), **options)


def run_call(kind="target", model=None, cls=SmallCapture, resource=None, after_gradients=None,
             observer_error=False, max_capture_bytes=capture.SIDECAR_MAXIMUM):
    model = Toy() if model is None else model
    observer = context(model, cls, resource=resource, max_capture_bytes=max_capture_bytes)
    spatial = observer._spatial()
    value = torch.arange(48*spatial[0]*spatial[1], dtype=torch.float32).reshape(1,48,*spatial).div(1000000000)
    original, output_ref = None, None
    observed_rows = []
    def bad_copy(*args, **kwargs):
        raise RuntimeError("optional observation failure")
    with patch.object(capture.gate_module, "bind_parameters", side_effect=lambda m: (tuple(m.parameters()), {}, 106, 107)), \
         patch.object(capture.gate_module, "_validate_model_and_parameters", side_effect=lambda m,p: (tuple(p), {})):
        try:
            with observer:
                if observer_error:
                    observer._clone = bad_copy
                output = model(value)
                output_ref = weakref.ref(output)
                parts = [(output * scale).sum() for scale in (.25,.5,.125,.0625)]
                losses = ((((parts[0]+parts[1])+parts[2])+parts[3]), *parts)
                for i,(label,loss) in enumerate(zip(capture.LABELS, losses)):
                    event_label = capture.LABELS[1] if kind == "labels" and i == 0 else label
                    observer("attempt", event_label, None)
                    rows = list(torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=i < 4, allow_unused=True))
                    SYNTHETIC_DETAILS["toyAutogradCalls"] += 1
                    if i == 0 and kind != "pass":
                        position = 89 if kind == "other_target" else 90
                        rows[position] = (torch.zeros_like(tuple(model.parameters())[position]) if rows[position] is None
                                          else rows[position].clone())
                        if kind == "other_target":
                            rows[position][0] += .01
                        elif kind == "different_coordinate":
                            rows[position][0,2,0,0] += .01
                        elif kind == "nonfinite":
                            rows[position][0,1,0,0] = float("nan")
                        else:
                            rows[position][0,1,0,0] += .01
                    if not (kind == "missing" and i == 4):
                        observer("complete", event_label, tuple(rows))
                    if kind == "swapped_object" and i == 0:
                        rows[90] = rows[90].clone()
                    observed_rows.append(tuple(rows))
                if kind == "tampered_capture":
                    observer._gradients["actualTotal"][0,1,0,0] += 1
                if kind == "state_changed":
                    with torch.no_grad():
                        model.prefix[1].add_(1)
                if after_gradients is not None:
                    after_gradients(observer)
                if kind == "forged":
                    raise ValueError("actual four-term total gradient identity differs at parameter 90")
                capture.gate_module.apply_object_joint_rgb_structure_priority_update_cpu(model=model,
                    parameters=tuple(model.parameters()), total_gradients=observed_rows[0],
                    structured_gradients=observed_rows[1], whole_frame_gradients=observed_rows[2],
                    core_gradients=observed_rows[3], support_gradients=observed_rows[4])
        except BaseException as error:
            original = error
    if observer.packet is not None:
        SYNTHETIC_DETAILS["sealedPackets"] += 1
    # The capture never stores exceptions/tracebacks. The test releases its own
    # traceback too, so graph-collection assertions isolate the component.
    if original is not None:
        original.__traceback__ = None
    observed_rows.clear()
    return observer, original, model, output_ref


def encoded(packet, failure_parts=(), execution_parts=()):
    result = capture.encode_capture(packet, original_failure_parts=failure_parts, execution_parts=execution_parts)
    SYNTHETIC_DETAILS["maximumSerializedSidecarBytes"] = max(
        SYNTHETIC_DETAILS["maximumSerializedSidecarBytes"], len(result["bytes"]))
    return result


class CaptureTests(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(torch.cuda.is_initialized())
        self.assertFalse(capture._ACTIVE)

    def assert_released(self, observer, model):
        self.assertIsNone(observer.model)
        self.assertIsNone(observer.module)
        self.assertFalse(observer._handles)
        self.assertFalse(observer._graph)
        self.assertFalse(observer._sources)
        self.assertFalse(observer._gradients)
        self.assertFalse(model.get_submodule(capture.TARGET_MODULE)._forward_hooks)

    def test_original_gate_seals_detached_bytes_and_releases_graph(self):
        observer, original, model, output_ref = run_call()
        self.assertEqual(str(original), "actual four-term total gradient identity differs at parameter 90")
        self.assertEqual(observer.outcome["status"], "sealed_same_call_target_failure", observer.outcome)
        result = encoded(observer.packet)
        self.assertEqual(result["bytes"][:8], b"P90SC1\0\0")
        length = struct.unpack("<I", result["bytes"][8:12])[0]
        metadata = json.loads(result["bytes"][12:12+length])
        self.assertEqual(metadata, result["metadata"])
        self.assertEqual(len(metadata["tensors"]), 12)
        self.assertEqual(metadata["target"]["coordinate"], [0,1,0,0])
        self.assertFalse(metadata["productionGeometryVerified"])
        payload = result["bytes"][12+length:]
        for descriptor in metadata["tensors"].values():
            raw = payload[descriptor["offset"]:descriptor["offset"]+descriptor["bytes"]]
            self.assertEqual(hashlib.sha256(raw).hexdigest(), descriptor["sha256"])
        with self.assertRaisesRegex(ValueError, "sealed packet"):
            encoded(observer.packet)
        self.assert_released(observer, model)
        gc.collect()
        self.assertIsNone(output_ref())

    def test_actual_device_bridge_frame_originals_carrier_and_copies(self):
        # Execute the bound bridge function itself on CPU toy losses. Only its
        # model/carrier admission adapters are synthetic, never its frame/code.
        bridge = capture.device_bridge
        for kind in ("valid", "other_model", "raw_replaced", "copy_changed", "copied_rows_replaced"):
            with self.subTest(kind=kind):
                model, other, carrier = Toy(), Toy(), Toy()
                observer = context(model)
                sample = dict(split="train", image=torch.zeros(3,192,256), conditions=torch.zeros(23,192,256))
                critic = nn.Identity().eval()
                real_grad = torch.autograd.grad
                call_count = [0]
                retained = []
                def gradients(*args, **kwargs):
                    rows = list(real_grad(*args, **kwargs))
                    SYNTHETIC_DETAILS["toyAutogradCalls"] += 1
                    if call_count[0] == 0:
                        rows[90] = rows[90].clone()
                        rows[90][0,1,0,0] += .01
                    call_count[0] += 1
                    return rows
                def event(stage, label, rows):
                    observer(stage, label, rows)
                    if kind == "raw_replaced" and stage == "complete" and label == capture.LABELS[0]:
                        retained.append(rows[90])
                        rows[90] = rows[90].clone()
                def gate_admission(m):
                    if kind in ("copy_changed", "copied_rows_replaced"):
                        frame = inspect.currentframe().f_back
                        try:
                            while frame is not None and frame.f_code is not capture.gate_module.apply_object_joint_rgb_structure_priority_update_cpu.__code__:
                                frame = frame.f_back
                            if frame.f_code is capture.gate_module.apply_object_joint_rgb_structure_priority_update_cpu.__code__:
                                if kind == "copy_changed":
                                    frame.f_locals["total_gradients"][90].add_(.01)
                                else:
                                    copied = frame.f_back.f_locals["copied"]
                                    copied[0] = tuple(None if v is None else v.clone() for v in copied[0])
                        finally:
                            del frame
                    return tuple(m.parameters()), {}, 106, 107
                error = None
                with patch.object(bridge, "bind_parameters", return_value=(tuple(model.parameters()), {}, 106, 107)), \
                     patch.object(bridge, "_cpu_carrier", return_value=carrier), \
                     patch.object(capture.gate_module, "bind_parameters", side_effect=gate_admission), \
                     patch.object(capture.gate_module, "_validate_model_and_parameters", side_effect=lambda m,p: (tuple(p), {})), \
                     patch.object(torch.autograd, "grad", side_effect=gradients):
                    try:
                        with observer, bridge.observe_generator_gradients(event):
                            output = model(torch.ones(1,48,4,5).div(1000))
                            parts = [(output*scale).sum() for scale in (.25,.5,.125,.0625)]
                            total = ((parts[0]+parts[1])+parts[2])+parts[3]
                            bridge.compute_generator_candidate_gradients(model=other if kind == "other_model" else model,
                                critic=critic, sample=sample, actual_total=total, structured_objective=parts[0],
                                whole_frame_fidelity=parts[1], object_core_rgb=parts[2], object_support_structure=parts[3])
                    except BaseException as caught:
                        error = caught
                self.assertEqual(str(error), "actual four-term total gradient identity differs at parameter 90")
                self.assertEqual(call_count[0], 5)
                if kind == "valid":
                    self.assertEqual(observer.outcome["status"], "sealed_same_call_target_failure", observer.outcome)
                    encoded(observer.packet)
                    SYNTHETIC_DETAILS["sealedPackets"] += 1
                else:
                    self.assertIsNone(observer.packet, observer.outcome)
                    self.assertEqual(observer.outcome["status"], "same_call_capture_unavailable")
                error.__traceback__ = None
                retained.clear()
                self.assert_released(observer, model)

    def test_success_two_legal_steps_remove_hooks_before_outside_update(self):
        model = Toy()
        for step in range(2):
            observer, error, _, _ = run_call("pass", model=model)
            self.assertIsNone(error)
            self.assertIsNone(observer.packet)
            self.assertEqual(observer.outcome["status"], "successful_g_released_without_capture")
            self.assert_released(observer, model)
            with torch.no_grad():
                model.get_submodule(capture.TARGET_MODULE).weight.add_(.001)
            SYNTHETIC_DETAILS["outsideContextParameterChanges"] += 1
        self.assertTrue(all(p.grad is None for p in model.parameters()))

    def test_wrong_error_target_coordinate_labels_partial_tamper_and_nonfinite_never_seal(self):
        for kind in ("forged","other_target","different_coordinate","labels","missing","tampered_capture",
                     "nonfinite","swapped_object","state_changed"):
            with self.subTest(kind=kind):
                observer, error, model, _ = run_call(kind)
                self.assertIsNotNone(error)
                self.assertIsNone(observer.packet, observer.outcome)
                self.assertEqual(observer.outcome["status"], "same_call_capture_unavailable")
                self.assert_released(observer, model)

    def test_observation_failure_or_budget_never_replaces_original_gate_error(self):
        for options in (dict(observer_error=True), dict(max_capture_bytes=capture.METADATA_RESERVE)):
            observer, error, model, _ = run_call(**options)
            self.assertEqual(type(error), ValueError)
            self.assertEqual(str(error), "actual four-term total gradient identity differs at parameter 90")
            self.assertIsNone(observer.packet)
            self.assert_released(observer, model)

    def test_wrong_phase_graph_type_geometry_and_sources_rejected(self):
        model = Toy()
        with self.assertRaisesRegex(ValueError, "generator phase"):
            context(model, phase="pair")
        for change in ("index","shape","graph","source","type"):
            with self.subTest(change=change):
                model = Toy()
                graph, sources = graph_of(model), capture.required_source_bindings()
                if change == "index": graph[90]["name"] = "other"
                elif change == "shape": model.get_submodule(capture.TARGET_MODULE).padding = (1,1)
                elif change == "graph": graph[0]["elements"] -= 1
                elif change == "source": sources[0]["sha256"] = "0"*64
                else: model.core.core.final_rgb_decoder.base.layers[4] = nn.Conv2d(48,3,1)
                with self.assertRaises(ValueError):
                    SmallCapture(model, identity=identity(), graph=graph, source_bindings=sources)

    def test_boolean_or_fabricated_packet_cannot_authorize_encoding(self):
        for packet in (True, {"sealed":True}, object.__new__(capture._SealedCapture)):
            with self.assertRaises(ValueError): encoded(packet)
        with self.assertRaises(TypeError): capture._SealedCapture()

    def test_earlier_no_grad_d_forward_is_outside_g_context(self):
        model = Toy()
        with torch.no_grad():
            model(torch.zeros(1,48,4,5))
        observer, error, _, _ = run_call("pass", model=model)
        self.assertIsNone(error)
        self.assertEqual(observer._forwards, 1)
        self.assert_released(observer, model)
        bad = context(model)
        with self.assertRaisesRegex(ValueError, "gradients enabled"), torch.no_grad():
            with bad: pass
        self.assert_released(bad, model)

    def test_nested_rejected_context_keeps_outer_registration_and_third_rejects(self):
        model = Toy()
        outer = context(model)
        with outer:
            for _ in range(2):
                inner = context(model)
                with self.assertRaisesRegex(ValueError, "one active"):
                    with inner: pass
                self.assertIs(capture._ACTIVE[model](), outer)
                self.assertIsNone(inner.model)
        self.assert_released(outer, model)

    def test_resource_exception_or_control_propagates_identical_object_at_entry_forward_and_exit(self):
        for error_type in (RuntimeError, KeyboardInterrupt):
            for stage in ("entry","forward","exit"):
                with self.subTest(error_type=error_type, stage=stage):
                    primary = error_type("resource stop")
                    count, enabled = [0], [stage == "entry"]
                    def resource():
                        count[0] += 1
                        if enabled[0] or stage == "forward" and count[0] == 2: raise primary
                    observer, error, model, _ = run_call("pass", resource=resource,
                        after_gradients=lambda _: enabled.__setitem__(0, stage == "exit"))
                    self.assertIs(error, primary)
                    self.assertIsNone(observer.packet)
                    self.assert_released(observer, model)

    def test_original_gate_error_precedes_later_resource_stop(self):
        for error_type in (RuntimeError, KeyboardInterrupt):
            stop, enabled = error_type("late resource stop"), [False]
            def resource():
                if enabled[0]: raise stop
            observer, error, model, _ = run_call(resource=resource, after_gradients=lambda _: enabled.__setitem__(0,True))
            self.assertEqual(str(error), "actual four-term total gradient identity differs at parameter 90")
            self.assertEqual(observer.outcome["resourceError"]["message"], "late resource stop")
            self.assertIsNone(observer.packet)
            self.assert_released(observer, model)

    def test_disabled_optional_observer_still_checks_resource_once_and_stops(self):
        for error_type in (RuntimeError, KeyboardInterrupt):
            model = Toy()
            count, stopped = [0], [False]
            stop = error_type("resource after optional failure")
            def resource():
                count[0] += 1
                if stopped[0]: raise stop
            observer = context(model, resource=resource)
            with self.assertRaises(error_type) as raised:
                with observer:
                    observer._observation_error = "prior optional error"
                    before = count[0]
                    observer("attempt", capture.LABELS[0], None)
                    self.assertEqual(count[0], before+1)
                    stopped[0] = True
                    observer("attempt", capture.LABELS[0], None)
            self.assertIs(raised.exception, stop)
            self.assert_released(observer, model)

    def test_disabled_optional_observer_checks_resource_at_exit_with_primary_precedence(self):
        for error_type in (RuntimeError, KeyboardInterrupt):
            for original in (None, ValueError("original training error")):
                model = Toy()
                stop, enabled = error_type("exit resource stop after observer failure"), [False]
                def resource():
                    if enabled[0]: raise stop
                observer, caught = context(model, resource=resource), None
                try:
                    with observer:
                        observer._observation_error = "optional failed"
                        enabled[0] = True
                        if original is not None: raise original
                except BaseException as error:
                    caught = error
                self.assertIs(caught, original if original is not None else stop)
                self.assertIn("resourceError", observer.outcome)
                self.assertIsNone(observer.packet)
                self.assert_released(observer, model)

    def test_actual_production_plane_size_fits_sidecar_and_actual_combined_ceilings(self):
        observer, error, model, _ = run_call(cls=FullPlaneSyntheticCapture)
        self.assertEqual(observer.outcome["status"], "sealed_same_call_target_failure", observer.outcome)
        result = encoded(observer.packet, (b"existing failure manifest",), (b"other execution bytes",))
        self.assertLessEqual(len(result["bytes"]), 2097152)
        self.assertEqual(sum(d["bytes"] for d in result["metadata"]["tensors"].values()), 1179648+2880+576)
        self.assertFalse(result["accounting"]["productionWriterVerified"])
        SYNTHETIC_DETAILS["actualCombinedBudgetTests"] += 1
        self.assert_released(observer, model)

    def test_actual_serialized_failure_and_execution_byte_ceilings_not_caller_bool(self):
        observer, _, _, _ = run_call()
        size = len(encoded(observer.packet)["bytes"])
        observer, _, _, _ = run_call()
        existing = bytes(capture.AGGREGATE_FAILURE_MAXIMUM-size-capture.FAILURE_RESERVE)
        result = encoded(observer.packet, (existing,), (bytes(64*1024**2),))
        self.assertEqual(result["accounting"]["aggregateFailureBytesIncludingReserve"], 64*1024**2)
        self.assertEqual(result["accounting"]["executionBytesIncludingReserve"], 128*1024**2)
        for failure, execution, match in ((existing+b"x", (), "64MiB"), (existing, (bytes(64*1024**2+1),), "128MiB")):
            observer, _, _, _ = run_call()
            with self.assertRaisesRegex(ValueError, match): encoded(observer.packet, (failure,), execution)
        observer, _, _, _ = run_call()
        with self.assertRaisesRegex(ValueError, "actual immutable"):
            encoded(observer.packet, (True,))
        SYNTHETIC_DETAILS["actualCombinedBudgetTests"] += 3

    def test_actual_model_factory_graph_constructed_without_forward(self):
        from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity_module
        from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER
        with patch.object(nn.Module, "_call_impl", side_effect=AssertionError("real model forward forbidden")), \
             patch.object(torch.autograd, "grad", side_effect=AssertionError("real model autograd forbidden")), \
             patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA forbidden")):
            model = identity_module.build_fresh_object_ecology_decode1_entry_weight_precision(
                condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER)
            observer = context(model, capture.Parameter90TrainingSameCallCapture)
            self.assertEqual(observer._graph[90][0], capture.TARGET_NAME)
            with observer: pass
            self.assertIsNone(observer.packet)
            self.assert_released(observer, model)


class WorkerContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT/"ml/ai-painter/scripts/check_parameter90_training_same_call_capture_cpu_v1.py"
        spec = importlib.util.spec_from_file_location("same_call_worker_contract", path)
        cls.worker = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.worker
        spec.loader.exec_module(cls.worker)

    def fixture_policy(self):
        worker = self.worker
        binding = lambda path: dict(path=path,sha256="a"*64)
        return dict(schemaVersion="ai-painter-parameter90-training-same-call-capture-cpu-policy-v1",
            status="registered_cpu_component_validation_only",scope="training_same_call_capture_component_synthetic_cpu_only",
            formalSpecification=deepcopy(worker.SPEC),designBinding=deepcopy(worker.DESIGN),
            executionHost=binding("scripts/check-ai-painter-parameter90-training-same-call-capture-cpu-v1.mjs"),
            executionHostTests=binding("scripts/tests/ai-painter-parameter90-training-same-call-capture-cpu-v1.test.mjs"),
            programBindings=[binding(p) for p in (worker.DRIVER,worker.COMPONENT,worker.TEST,worker.LOADER)],
            containmentProgramBindings={k:binding("private/"+k) for k in ("owner","nativeBridge","nativeOwnerSource",
                "pathResolver","storageConfiguration","operatorSession","candidateRegistration")},
            interpreter=dict(absolutePath=str(ROOT/"ml/ai-painter/.venv/Scripts/python.exe"),sha256="a"*64),
            target=deepcopy(worker.TARGET),resources=deepcopy(worker.LIMITS),captureBudget=deepcopy(worker.CAPTURE_BUDGET),
            comparison=dict(atol=1e-6,rtol=1e-5,gradientLabels=list(capture.LABELS),
                fp32Order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",originalGateKept=True),
            executionBoundary=dict(syntheticCpuOnly=True,gpu=False,training=False,productionIntegrated=False,
                oldRunReplay=False,originalDataRead=False),outputRoot=worker.OUTPUT)

    def test_worker_policy_dto_rejects_drift_without_executing_draft(self):
        policy = self.fixture_policy()
        self.assertTrue(self.worker.validate_policy(policy))
        for change in ("old_schema","spec","target","resource","output","comparison","boundary","missing","duplicate"):
            with self.subTest(change=change):
                value = deepcopy(policy)
                if change == "old_schema": value["schemaVersion"] = "v4"
                elif change == "spec": value["formalSpecification"]["version"] = "AI-PAINTER-SPEC-1.101"
                elif change == "target": value["target"]["coordinate"] = [0,2,0,0]
                elif change == "resource": value["resources"]["cpuThreads"] = 3
                elif change == "output": value["outputRoot"] += "/other"
                elif change == "comparison": value["comparison"]["atol"] *= 10
                elif change == "boundary": value["executionBoundary"]["gpu"] = True
                elif change == "missing": value["programBindings"].pop()
                else: value["programBindings"].append(value["programBindings"][0])
                with self.assertRaises(ValueError): self.worker.validate_policy(value)

    def test_worker_exact_source_bytes_and_safe_paths(self):
        source = ROOT/self.worker.DRIVER
        binding = dict(path=self.worker.DRIVER,sha256=hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertEqual(self.worker.read_bound(ROOT,binding),source.read_bytes())
        binding["sha256"] = "0"*64
        with self.assertRaisesRegex(ValueError,"SHA differs"): self.worker.read_bound(ROOT,binding)
        for logical in ("../outside","/absolute","a\\b","a//b","a/./b","C:/other"):
            with self.assertRaises(ValueError): self.worker.bootstrap_path(ROOT,logical)
        with self.assertRaisesRegex(ValueError,"duplicate"): self.worker.strict_json(b'{"a":1,"a":2}')

    def test_worker_actual_import_inventory_includes_loader_and_rejects_missing_binding(self):
        from ai_painter.complete_world import object_support_structure_failure_capture_v1
        programs = {}
        for module in tuple(sys.modules.values()):
            filename = getattr(module,"__file__",None)
            if not filename or not Path(filename).is_absolute(): continue
            try: logical = Path(filename).absolute().relative_to(ROOT).as_posix()
            except ValueError: continue
            if logical.startswith("ml/ai-painter/.venv/"): continue
            programs[logical] = dict(path=logical,sha256=hashlib.sha256(Path(filename).read_bytes()).hexdigest())
        loaded = self.worker.verify_imports(ROOT,list(programs.values()))
        self.assertIn(self.worker.LOADER,loaded)
        programs.pop(self.worker.COMPONENT)
        with self.assertRaisesRegex(ValueError,"unbound actual project import"):
            self.worker.verify_imports(ROOT,list(programs.values()))

    def test_worker_deadline_rss_affinity_and_no_cuda_checks_latch_original_error(self):
        class Process:
            def cpu_affinity(self): return [0,1]
            def memory_info(self): return type("Memory",(),dict(rss=1000))()
        for change in ("deadline","rss","affinity","cuda"):
            process = Process()
            monitor = self.worker.ResourceMonitor(process, self.worker.time.time()*1000+1000,
                                                   self.worker.time.monotonic())
            if change == "deadline": monitor.deadline = 0
            elif change == "rss": process.memory_info = lambda: type("Memory",(),dict(rss=1536*1024**2+1))()
            elif change == "affinity": process.cpu_affinity = lambda: [0,1,2]
            else:
                monitor.torch = type("Torch",(),dict(get_num_threads=lambda:2,get_num_interop_threads=lambda:2,
                    cuda=type("Cuda",(),dict(is_initialized=lambda:True))))
            with self.assertRaises(ValueError) as first: monitor.check()
            with self.assertRaises(ValueError) as second: monitor.check()
            self.assertIs(first.exception,second.exception)


if __name__ == "__main__":
    unittest.main()
