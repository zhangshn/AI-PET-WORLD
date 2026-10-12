"""One frozen two-fixture CPU experiment plus small boundary counterexamples.

CLI writes one combined report/delivery/raw synthetic-log artifact. Imported
unittest execution writes nothing. No real data/model/checkpoint is loaded.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager, redirect_stdout, redirect_stderr
from copy import deepcopy
import hashlib
import io
import itertools
import json
import os
from pathlib import Path
import sys
import threading
import _thread
import time
import unittest
from unittest.mock import patch

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
from torch.nn import functional as F
from ai_painter.complete_world import rgb_bias_reduction_precision_cpu as candidate

SOURCE = "ml/ai-painter/src/ai_painter/complete_world/rgb_bias_reduction_precision_cpu.py"
TEST = "ml/ai-painter/tests/test_rgb_bias_reduction_precision_cpu.py"
OUTPUT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/bias-reduction-proposal-t-q4-33"
SEED = 20260929
ATOL, RTOL = 1e-6, 1e-5
PLAN = (
    {"id": "specified_rgb_terminal_shape", "input": [1, 48, 192, 256],
     "weight": [3, 48, 1, 1], "bias": [3],
     "cotangents": "fixed local-seed randn*0.01; its exact negation; randn*1e-7"},
    {"id": "small_exact_cancellation", "input": [1, 48, 1, 4],
     "weight": [3, 48, 1, 1], "bias": [3],
     "cotangents": "[1e8,1,-1e8,1] repeated for RGB; zeros; ones*1e-7"},
)
LIMITS = {"cpuThreads": 2, "wallSeconds": 120, "sampleGroups": 2,
          "forwardsPerGroupPerPath": 1, "autogradCallsPerGroupPerPath": 4,
          "attempts": 1, "automaticRetries": 0, "seedSearch": 0, "shapeSearch": 0,
          "combinedOutputBytes": 2097152, "gradientExamples": 8}
COMPARISON = {"status": "not_started", "cases": []}
COMPARISON_STARTED = False
BOUNDARY_PLAN = {"maxFeatureShape": [1,48,2,2], "forwardCalls": 21,
                 "autogradCalls": 18,
                 "description": "7 nonempty masks native/candidate; frozen-all forward pair; 4 invalid/higher-order VJPs; 1 forward-overflow counterexample"}


def require(condition, message):
    if not condition: raise ValueError(message)


def same_bytes(left, right):
    return (left.shape == right.shape and left.dtype == right.dtype
            and torch.equal(left.detach().contiguous().view(torch.uint8),
                            right.detach().contiguous().view(torch.uint8)))


def backend_state():
    return {"deterministic": torch.are_deterministic_algorithms_enabled(),
            "warnOnly": torch.is_deterministic_algorithms_warn_only_enabled(),
            "mkldnnEnabled": torch.backends.mkldnn.enabled,
            "mkldnnDeterministic": torch.backends.mkldnn.deterministic}


def identity_statistics(actual, structured, whole, core, reference):
    """Only the original FP32 normalization/association/isclose rule; no projection."""
    tensors = []
    for value in (actual, structured, whole, core):
        if value is None: value = torch.zeros_like(reference)
        require(isinstance(value, torch.Tensor) and value.shape == reference.shape
                and value.dtype == torch.float32 and value.device.type == "cpu"
                and bool(torch.isfinite(value).all()), "identity gradient invalid")
        tensors.append(value)
    actual, structured, whole, core = tensors
    expected = (structured.float() + whole.float()).float() + core.float()
    close = torch.isclose(actual, expected, atol=ATOL, rtol=RTOL)
    diff = (actual.to(torch.float64) - expected.to(torch.float64)).abs()
    indices = (~close).reshape(-1).nonzero().reshape(-1)[:8].tolist()
    return {"passed": bool(close.all()), "outsideToleranceElements": int((~close).sum()),
            "maxAbsDifference": float(diff.max()), "atol": ATOL, "rtol": RTOL,
            "examples": [{"flatIndex": index, "actual": float(actual.reshape(-1)[index]),
                          "expected": float(expected.reshape(-1)[index])} for index in indices]}


class ComparisonBudget:
    def __init__(self, clock=time.monotonic):
        self.clock = clock; self.started = clock(); self.used = []
        self.counts = {}; self.current = None
    def check(self):
        require(0 <= self.clock()-self.started < 120, "120-second budget exceeded")
    def begin(self, case_id):
        self.check()
        require(case_id in [case["id"] for case in PLAN] and case_id not in self.used
                and len(self.used) < 2, "fixed sample-group budget exceeded")
        self.current = case_id; self.used.append(case_id)
        self.counts[case_id] = {path: {"forwardAttempted": 0, "forwardCompleted": 0,
                                     "autogradAttempted": 0, "autogradCompleted": 0}
                               for path in ("native", "candidate")}
    def call(self, path, operation, function):
        self.check()
        require(self.current is not None and path in ("native", "candidate")
                and operation in ("forward", "autograd"), "unbound budget operation")
        counters = self.counts[self.current][path]
        maximum = 1 if operation == "forward" else 4
        require(counters[operation+"Attempted"] < maximum, operation + " call budget exceeded")
        counters[operation+"Attempted"] += 1
        result = function()
        counters[operation+"Completed"] += 1
        self.check(); return result


@contextmanager
def forbidden_operations():
    def forbidden(*_args, **_kwargs): raise AssertionError("non-synthetic operation prohibited")
    with patch.object(torch.cuda, "_lazy_init", forbidden), \
         patch.object(torch.optim.Optimizer, "__init__", forbidden), \
         patch.object(torch.Tensor, "backward", forbidden), \
         patch.object(torch, "load", forbidden), patch.object(torch, "save", forbidden):
        yield


def synthetic_values(spec):
    generator = torch.Generator(device="cpu").manual_seed(SEED)
    features = torch.randn(spec["input"], generator=generator)*0.1
    weight = torch.randn(spec["weight"], generator=generator)*0.1
    bias = torch.randn(spec["bias"], generator=generator)*0.01
    if spec["id"] == "small_exact_cancellation":
        # Exact forward fixture; these synthetic parameters are never a real model.
        features.zero_(); weight.zero_(); bias.zero_()
        structured = torch.tensor([1e8, 1., -1e8, 1.], dtype=torch.float32).reshape(1,1,1,4).repeat(1,3,1,1)
        whole = torch.zeros_like(structured); core = torch.full_like(structured, 1e-7)
    else:
        shape = [1, 3, *spec["input"][2:]]
        structured = torch.randn(shape, generator=generator)*0.01
        whole = -structured; core = torch.randn(shape, generator=generator)*1e-7
    return (features, weight, bias), (structured, whole, core)


def compare_two_fixtures():
    global COMPARISON_STARTED
    require(not COMPARISON_STARTED, "single synthetic comparison already consumed")
    COMPARISON_STARTED = True
    require(torch.get_num_threads() == 2 and not torch.cuda.is_initialized(), "CPU-only comparison required")
    budget = ComparisonBudget()
    COMPARISON.update({"status": "running", "plan": deepcopy(PLAN), "seed": SEED,
                       "limits": LIMITS, "callCounts": budget.counts})
    caller_rng = torch.random.get_rng_state().clone(); flags = backend_state()
    try:
        for spec in PLAN:
            budget.begin(spec["id"])
            source, cotangents = synthetic_values(spec)
            original = [value.clone() for value in (*source, *cotangents)]
            paths = {}; records = {}; outputs = {}; incoming = {}
            for path in ("native", "candidate"):
                leaves = tuple(value.detach().clone().requires_grad_(True) for value in source)
                paths[path] = leaves
                function = F.conv2d if path == "native" else candidate.rgb_bias_reduction_precision_cpu
                output = budget.call(path, "forward", lambda: function(*leaves))
                outputs[path] = output; incoming[path] = []
                output.register_hook(lambda value, history=incoming[path]: history.append(value.detach().clone()))
                components = tuple((output*value).sum() for value in cotangents)
                # Independent differentiation of the total scalar is retained.
                total = (components[0].float()+components[1].float()).float()+components[2].float()
                gradients = []
                for loss in (total, *components):
                    gradients.append(budget.call(path, "autograd", lambda loss=loss:
                        torch.autograd.grad(loss, leaves, retain_graph=True, create_graph=False, allow_unused=True)))
                records[path] = gradients
            require(same_bytes(outputs["native"], outputs["candidate"]), "forward bytes differ")
            result = {"id": spec["id"], "shape": spec, "forwardByteEqual": True,
                      "leafNames": ["synthetic_input", "isolated_weight", "isolated_bias"],
                      "notOriginal107ParameterModel": True, "vjp": [], "identityChecks": {}}
            for index, loss_name in enumerate(("independent_total", "structured", "whole", "core")):
                ng, cg = records["native"][index], records["candidate"][index]
                require(same_bytes(incoming["native"][index], incoming["candidate"][index]), "incoming VJP bytes differ")
                require(all(same_bytes(ng[i], cg[i]) for i in (0,1)), "native input/weight gradient bytes differ")
                reference64 = incoming["candidate"][index].to(torch.float64).sum((0,2,3))
                reference32 = reference64.to(torch.float32)
                require(same_bytes(cg[2], reference32), "bias FP64 reference differs")
                result["vjp"].append({"loss": loss_name, "dInputByteEqual": True, "dWeightByteEqual": True,
                    "biasFloat64ReferenceByteEqual": True, "nativeBias": ng[2].tolist(),
                    "candidateBias": cg[2].tolist(), "biasReferenceFloat64": reference64.tolist(),
                    "nativeBiasMaxErrorToFloat64": float((ng[2].double()-reference64).abs().max()),
                    "candidateBiasMaxErrorToFloat64": float((cg[2].double()-reference64).abs().max())})
            for path in ("native", "candidate"):
                gradients = records[path]
                result["identityChecks"][path] = {
                    name: identity_statistics(gradients[0][i], gradients[1][i], gradients[2][i], gradients[3][i], source[i])
                    for i, name in enumerate(result["leafNames"])}
                require(all(value.grad is None for value in paths[path]), ".grad changed")
                require(all(same_bytes(value, ref) for value, ref in zip(paths[path], source)), "leaf bytes changed")
            require(all(same_bytes(value, ref) for value, ref in zip((*source,*cotangents), original)), "source bytes changed")
            require(torch.equal(caller_rng, torch.random.get_rng_state()) and backend_state() == flags, "RNG/backend changed")
            result["sourceWeightsRngBackendUnchanged"] = True
            COMPARISON["cases"].append(result)
        COMPARISON["status"] = "completed_synthetic_only_not_qualified"
        COMPARISON["elapsedSeconds"] = time.monotonic()-budget.started
    except BaseException as error:
        COMPARISON.update({"status": "failed_closed", "errorType": type(error).__name__, "error": str(error),
                           "elapsedSeconds": time.monotonic()-budget.started})
        raise
    return COMPARISON


def small_values(mask=(True, True, True)):
    generator = torch.Generator(device="cpu").manual_seed(SEED)
    shapes = ((1,48,2,2), (3,48,1,1), (3,))
    return tuple(torch.randn(shape, generator=generator).requires_grad_(need) for shape, need in zip(shapes,mask))


class RGBBiasPrecisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old_threads = torch.get_num_threads(); torch.set_num_threads(2)
    @classmethod
    def tearDownClass(cls): torch.set_num_threads(cls.old_threads)
    def setUp(self):
        self.rng = torch.random.get_rng_state().clone(); self.backend = backend_state()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertEqual(self.backend, backend_state()); self.assertFalse(torch.cuda.is_initialized())

    def test_01_frozen_two_sample_comparison(self):
        result = compare_two_fixtures()
        self.assertEqual(len(result["cases"]), 2)
        for counts in result["callCounts"].values():
            for path in counts.values():
                self.assertEqual(path, {"forwardAttempted": 1, "forwardCompleted": 1,
                                        "autogradAttempted": 4, "autogradCompleted": 4})
        with self.assertRaisesRegex(ValueError, "already consumed"): compare_two_fixtures()

    def test_partial_requires_grad_native_masks_and_byte_parity(self):
        native_backward = torch.ops.aten.convolution_backward.default
        for mask in itertools.product((False, True), repeat=3):
            if not any(mask): continue
            native = small_values(mask)
            other = tuple(value.detach().clone().requires_grad_(need) for value,need in zip(native,mask))
            before = [value.clone() for value in other]
            expected_output = F.conv2d(*native)
            with patch.object(torch.ops.aten.convolution_backward, "default", wraps=native_backward) as spy:
                actual_output = candidate.rgb_bias_reduction_precision_cpu(*other)
                self.assertTrue(same_bytes(expected_output, actual_output))
                grad_output = torch.arange(12, dtype=torch.float32).reshape(1,3,2,2)*0.125
                ng = torch.autograd.grad(expected_output, tuple(v for v in native if v.requires_grad), grad_outputs=grad_output)
                cg = torch.autograd.grad(actual_output, tuple(v for v in other if v.requires_grad), grad_outputs=grad_output)
                self.assertEqual(spy.call_count, 1); self.assertEqual(spy.call_args.args[-1], mask)
            for index, expected, actual in zip([i for i,need in enumerate(mask) if need], ng, cg):
                reference = grad_output.double().sum((0,2,3)).float() if index == 2 else expected
                self.assertTrue(same_bytes(actual, reference))
            self.assertTrue(all(same_bytes(v,b) for v,b in zip(other,before)))
            self.assertTrue(all(value.grad is None for value in other))
        frozen = small_values((False,False,False))
        frozen_output = candidate.rgb_bias_reduction_precision_cpu(*frozen)
        self.assertTrue(same_bytes(F.conv2d(*frozen), frozen_output))
        self.assertFalse(frozen_output.requires_grad)

    def test_exact_cancellation_near_zero_missing_and_original_tolerance(self):
        zero = torch.zeros(3)
        self.assertTrue(identity_statistics(zero, None, None, None, zero)["passed"])
        structured = torch.tensor([1., -1., 0.]); whole = -structured
        core = torch.tensor([1e-8, -1e-8, 0.])
        self.assertTrue(identity_statistics(core, structured, whole, core, zero)["passed"])
        failed = identity_statistics(torch.tensor([2e-6, 0., 0.]), None, None, None, zero)
        self.assertFalse(failed["passed"]); self.assertEqual(failed["outsideToleranceElements"], 1)
        with self.assertRaisesRegex(ValueError, "invalid"):
            identity_statistics(torch.tensor([float("nan"),0.,0.]),None,None,None,zero)
        with self.assertRaisesRegex(ValueError, "invalid"):
            identity_statistics(torch.ones(4),None,None,None,zero)

    def test_invalid_dtype_device_shapes_missing_and_nonfinite(self):
        baseline = small_values()
        cases = []
        for index in range(3):
            changed = list(baseline); changed[index] = changed[index].double(); cases.append(changed)
            for invalid in (float("nan"), float("inf")):
                changed = [value.detach().clone() for value in baseline]
                changed[index].reshape(-1)[0] = invalid; cases.append(changed)
        cases.extend([(None, baseline[1], baseline[2]), (baseline[0], baseline[1], None),
                      (torch.empty((1,48,2,2), device="meta"), baseline[1], baseline[2]),
                      (torch.zeros(2,48,2,2), baseline[1], baseline[2]),
                      (torch.zeros(1,47,2,2), baseline[1], baseline[2]),
                      (baseline[0], torch.zeros(3,48,3,3), baseline[2]),
                      (baseline[0], baseline[1], torch.zeros(4)),
                      (torch.zeros(1,48,0,2), baseline[1], baseline[2])])
        with patch.object(candidate._RGBBiasReduction, "apply", side_effect=AssertionError("must reject before convolution")):
            for values in cases:
                with self.assertRaises(ValueError): candidate.rgb_bias_reduction_precision_cpu(*values)
        with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError, "autocast"): candidate.rgb_bias_reduction_precision_cpu(*baseline)
        with self.assertRaisesRegex(ValueError, "forward must be finite"):
            candidate.rgb_bias_reduction_precision_cpu(torch.full((1,48,2,2),torch.finfo(torch.float32).max),
                                                      torch.full((3,48,1,1),2.),torch.zeros(3))

    def test_nonfinite_vjp_overflow_and_higher_order_rejected(self):
        for fill in (float("nan"), float("inf"), torch.finfo(torch.float32).max):
            values = small_values((False,False,True))
            output = candidate.rgb_bias_reduction_precision_cpu(*values)
            with self.assertRaisesRegex(ValueError, "finite"):
                torch.autograd.grad(output, values[2], grad_outputs=torch.full_like(output,fill))
            self.assertIsNone(values[2].grad)
        values = small_values(); output = candidate.rgb_bias_reduction_precision_cpu(*values)
        with self.assertRaisesRegex(ValueError, "higher-order"):
            torch.autograd.grad(output.sum(), values, create_graph=True)

    def test_budget_prefix_counts_no_automatic_retry(self):
        budget = ComparisonBudget(clock=lambda: 0.)
        budget.begin(PLAN[0]["id"])
        self.assertEqual(budget.call("native","forward",lambda: 7), 7)
        with self.assertRaisesRegex(ValueError, "call budget"):
            budget.call("native","forward",lambda: self.fail("second forward executed"))
        with self.assertRaisesRegex(RuntimeError, "partial"):
            budget.call("native","autograd",lambda: (_ for _ in ()).throw(RuntimeError("partial")))
        self.assertEqual(budget.counts[PLAN[0]["id"]]["native"]["autogradAttempted"], 1)
        self.assertEqual(budget.counts[PLAN[0]["id"]]["native"]["autogradCompleted"], 0)
        with self.assertRaisesRegex(ValueError, "sample-group"): budget.begin(PLAN[0]["id"])
        budget.begin(PLAN[1]["id"])
        with self.assertRaisesRegex(ValueError, "sample-group"): budget.begin("undeclared_shape")
        for _ in range(4): budget.call("candidate","autograd",lambda: None)
        with self.assertRaisesRegex(ValueError, "call budget"): budget.call("candidate","autograd",lambda: None)
        timer = iter((0.,121.)); expired = ComparisonBudget(clock=lambda: next(timer))
        with self.assertRaisesRegex(ValueError, "120-second"): expired.begin(PLAN[0]["id"])
        with patch.object(torch,"get_num_threads",return_value=3):
            with self.assertRaisesRegex(ValueError, "thread budget"):
                candidate.rgb_bias_reduction_precision_cpu(*small_values())

    def test_inactive_no_updates_no_checkpoint_gpu_or_backward(self):
        self.assertEqual(candidate.STATUS,"inactive_not_qualified")
        with forbidden_operations():
            for operation in (lambda: torch.cuda._lazy_init(), lambda: torch.save({},"forbidden.pt"),
                              lambda: torch.load("forbidden.pt"), lambda: torch.optim.SGD([torch.nn.Parameter(torch.zeros(1))],lr=.1),
                              lambda: torch.ones(1,requires_grad=True).backward()):
                with self.assertRaises(AssertionError): operation()


def file_binding(path):
    return {"path": path, "sha256": hashlib.sha256((ROOT/path).read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    require(ROOT == Path("F:/ai-pet-world") and args.report == OUTPUT+"/report.json", "fixed proposal report required")
    target = ROOT/args.report; target.parent.mkdir(parents=True, exist_ok=True)
    require(not target.exists(), "single proposal report already exists; no overwrite/retry")
    protected = [SOURCE, TEST, "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
                 "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
                 "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py",
                 "ml/ai-painter/scripts/check_stage4_mvp256_dry_appearance_regime_cpu.py",
                 "ml/ai-painter/tests/test_check_stage4_mvp256_dry_appearance_regime_cpu.py",
                 "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu.py",
                 ".runtime/ai-painter/current-execution-registry/current.json",
                 "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_conditioned_cpu.py",
                 "ml/ai-painter/src/ai_painter/complete_world/native_rgb_whole_frame_fidelity_candidate_cpu.py",
                 "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py",
                 OUTPUT.replace("bias-reduction-proposal-t-q4-33","season-cpu-t-q4-29/claim.json"),
                 OUTPUT.replace("bias-reduction-proposal-t-q4-33","season-cpu-t-q4-29/failure.json"),
                 OUTPUT.replace("bias-reduction-proposal-t-q4-33","season-gradient-capture-t-q4-32/report.json")]
    bindings = [file_binding(path) for path in protected]
    require(bindings[2]["sha256"] == "0a6ae5ded45454f892cfe51842cb37e24db33a9017b2de6a364e24ebc5f2e72e"
            and bindings[3]["sha256"] == "0aa98a7ce4a8b37f1a834f74ee92a4d0ac12793e8e2ae30a1482d4c1439c8ce7", "current spec/guide differs")
    stream = io.StringIO(); started = time.monotonic(); expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    watchdog = threading.Timer(120,interrupt); watchdog.daemon = True; watchdog.start()
    old_threads = torch.get_num_threads(); caller_rng = torch.random.get_rng_state().clone(); flags = backend_state()
    root_error = None; result = None
    try:
        torch.set_num_threads(2)
        with redirect_stdout(stream), redirect_stderr(stream), forbidden_operations():
            suite = unittest.defaultTestLoader.loadTestsFromTestCase(RGBBiasPrecisionTests)
            result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
        require(not expired.is_set() and time.monotonic()-started < 120, "120-second total synthetic budget exceeded")
        require(bindings == [file_binding(path) for path in protected], "source/governance bytes changed")
        require(torch.equal(caller_rng,torch.random.get_rng_state()) and flags == backend_state(), "caller state changed")
    except BaseException as error:
        root_error = {"type":type(error).__name__,"message":str(error)}
    finally:
        watchdog.cancel(); torch.set_num_threads(old_threads)
    report = {"schemaVersion":"t-q4-33-inactive-bias-reduction-proposal-v1","task":"T-Q4-33",
              "status":"synthetic_tests_passed_inactive_not_qualified" if root_error is None and result and result.wasSuccessful() else "failed_closed",
              "candidateId":candidate.CANDIDATE_ID,"qualification":False,"productionConnected":False,
              "hypothesis":"Native FP32 bias reduction may contribute to the observed identity mismatch; changing only its accumulation to FP64 is falsifiable and does not establish the unique cause.",
              "exactChange":"Same biased F.conv2d forward; same aten.convolution_backward arguments and requires-grad mask; retain native dInput/dWeight; replace requested bias with grad_output.double().sum((0,2,3)).float().",
              "retained":"Independent (Ls.float()+Lf).float()+Lc total differentiation; original atol1e-6/rtol1e-5 comparison association; no component-sum substitution or tolerance change.",
              "syntheticComparison":COMPARISON,"sourceBindings":bindings,"rootError":root_error,
              "syntheticLog":{"rawUnittestOutput":stream.getvalue(),"testsRun":0 if result is None else result.testsRun,
                              "successful":False if result is None else result.wasSuccessful(),"elapsedSeconds":time.monotonic()-started},
              "limits":LIMITS,"smallBoundaryPlan":BOUNDARY_PLAN,"boundary":{"realDataRead":False,"realNetworkBuilt":False,"original107ParameterModelPassed":False,
              "GPU":False,"optimizerSteps":0,"checkpoint":False,"PNG":False,"registryWritten":False,"oldClaimsConsumed":False,"formalSchemaBound":False},
              "provedIfTestsPass":["Forward byte equality for the frozen fixtures", "Native input/weight VJP byte equality including all nonempty requires-grad masks", "Bias byte equality with FP64 incoming-cotangent reduction returned as FP32", "Finite/dtype/device/shape/precision/budget counterexamples reject", "Inputs, weights, RNG, backend unchanged"],
              "notProved":["Unique cause of T-Q4-32 error", "Repair of the actual 107-parameter network", "Real-data forward/backward parity", "Production integration, CUDA or training behavior", "General numerical distributivity across differently-associated cotangents"],
              "costAndRisk":["Native requested bias is still computed and discarded to preserve the original output-mask path", "An FP64 cotangent copy/reduction adds CPU time and memory", "Only CPU contiguous FP32 N1/C48/RGB1x1 first-order gradients; autocast and higher-order unsupported", "Leaf gradient association can remain non-distributive even after bias reduction precision improves"],
              "stoppingConditions":["No original synthetic mismatch: record absence; do not search until failure", "Candidate identity failure: retain it; do not change Loss or tolerance", "Any parity/resource/state failure: close with actual prefix counts", "No automatic retry or real-data follow-up under this task"],
              "delivery":{"allowedSources":[SOURCE,TEST],"independentVerification":"Controller reruns the fixed synthetic unittest module only; any real-data comparison needs separate scope", "sourcesFrozenAfterDelivery":True}}
    data = (json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode("utf-8")
    require(sum(path.stat().st_size for path in target.parent.rglob("*") if path.is_file())+len(data) <= 2097152,"combined output budget exceeded")
    with target.open("xb") as stream_file:
        stream_file.write(data); stream_file.flush(); os.fsync(stream_file.fileno())
    print(json.dumps({"path":str(target),"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),"status":report["status"],"testsRun":report["syntheticLog"]["testsRun"]}))
    return 0 if report["status"] == "synthetic_tests_passed_inactive_not_qualified" else 1


if __name__ == "__main__": sys.exit(main())
