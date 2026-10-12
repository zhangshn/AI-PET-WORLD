"""Isolated zero-update profile and a single owned synthetic CPU test command.

No data/capture/checkpoint reader, training entry, default registry or GPU command.
The original private Windows Job helper owns the test worker before it resumes.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(os.path.abspath(__file__)).parents[3]
OUTPUT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/post-capture-t-q4-38/next-t-q4-43/numeric-cpu"
SOURCE_FILES = (
    "ml/ai-painter/src/ai_painter/complete_world/detail_weight_reduction_precision.py",
    "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_precision.py",
    "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_priority_update.py",
    "ml/ai-painter/scripts/painter_stage4_appearance_regime_detail_weight_probe.py",
    "ml/ai-painter/tests/test_detail_weight_reduction_precision.py",
    "ml/ai-painter/tests/test_object_appearance_regime_detail_weight_priority_update.py",
)
TESTS = ("test_detail_weight_reduction_precision", "test_object_appearance_regime_detail_weight_priority_update")


def zero_update_profile(*, model, critic, sample, appearance_regime, objective_builder):
    """One shared CPU G forward, independently differentiated original scalar.

    The caller supplies already bound tensors/objective code; this function does
    not load sources or infer that synthetic tensors confer real-model eligibility.
    """
    import torch
    from ai_painter.complete_world.object_appearance_regime_input_cpu import require
    from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import validate_model_identity
    from ai_painter.complete_world.object_appearance_regime_detail_weight_priority_update import (
        compute_generator_candidate_gradients, observe_generator_gradients, generator_full_fp32_backend)
    validate_model_identity(model)
    require(next(model.parameters()).device.type == "cpu" and torch.get_num_threads() <= 2,
        "this profile supports bounded CPU only")
    require(sample.get("split") == "train" and callable(objective_builder), "train/objective required")
    require(all(isinstance(sample.get(k), torch.Tensor) and sample[k].device.type == "cpu"
        and sample[k].dtype == torch.float32 and not sample[k].requires_grad
        for k in ("conditions", "image")), "detached CPU FP32 sources required")
    require(all(not m.training for m in critic.modules()) and all(not p.requires_grad for p in critic.parameters()),
        "critic must be frozen eval")
    before = [{k: v.detach().clone() for k, v in m.state_dict().items()} for m in (model, critic)]
    modes = [[m.training for m in root.modules()] for root in (model, critic)]
    grad_before = [[None if p.grad is None else p.grad.detach().clone() for p in root.parameters()]
        for root in (model, critic)]
    inputs = {k: sample[k].detach().clone() for k in ("conditions", "image")}
    rng = torch.random.get_rng_state().clone()
    counts = {"generatorForwardAttempts": 0, "generatorForwardsCompleted": 0,
        "gradientAttempts": 0, "gradientsCompleted": 0, "optimizerObjects": 0,
        "optimizerSteps": 0, "discriminatorGradientCalls": 0}
    def forward_attempt(module, args): counts["generatorForwardAttempts"] += 1
    def forward_done(module, args, output): counts["generatorForwardsCompleted"] += 1
    def gradient_event(event, label, values):
        counts["gradientAttempts" if event == "attempt" else "gradientsCompleted"] += 1
    pre = model.register_forward_pre_hook(forward_attempt)
    post = model.register_forward_hook(forward_done)
    error = None
    try:
        with generator_full_fp32_backend(), observe_generator_gradients(gradient_event):
            prediction = model(sample["conditions"], sample["instanceTable"], appearance_regime=appearance_regime)
            structured, whole, core = objective_builder(prediction, critic, sample)
            total = (structured.float() + whole).float() + core
            candidate, facts = compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
                actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)
        require(counts["generatorForwardAttempts"] == counts["generatorForwardsCompleted"] == 1
            and counts["gradientAttempts"] == counts["gradientsCompleted"] == 4, "zero-update call boundary differs")
        return candidate, {**facts, "actualCalls": counts, "diagnosticOnly": True, "trainingAllowed": False}
    except BaseException as failure:
        error = failure
        try: failure.detail_weight_profile_calls = dict(counts)
        except BaseException: pass
        raise
    finally:
        pre.remove(); post.remove()
        unchanged = all(set(saved) == set(root.state_dict())
            and all(torch.equal(value.reshape(-1).view(torch.uint8),
                root.state_dict()[key].detach().contiguous().reshape(-1).view(torch.uint8))
                for key, value in saved.items())
            and mode == [m.training for m in root.modules()]
            and all((old is None and p.grad is None) or (old is not None and p.grad is not None
                and torch.equal(old, p.grad)) for old, p in zip(grads, root.parameters()))
            for root, saved, mode, grads in zip((model, critic), before, modes, grad_before))
        unchanged = unchanged and all(torch.equal(value, sample[key]) for key, value in inputs.items())
        unchanged = unchanged and torch.equal(rng, torch.random.get_rng_state())
        if not unchanged:
            if error is None: raise ValueError("zero-update state/input/mode/gradient/RNG changed")
            error.detail_weight_profile_state_unchanged = False


def _safe():
    sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
    import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as safe
    return safe


def _bindings():
    return [{"path": name, "sha256": hashlib.sha256((ROOT / name).read_bytes()).hexdigest(),
             "bytes": (ROOT / name).stat().st_size} for name in SOURCE_FILES]


def _worker(output, deadline):
    safe = _safe()
    safe.verify_owned_worker(); safe.deadline_check(deadline)
    safe.require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CUDA visibility must be empty")
    sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/tests")]
    import unittest
    from unittest.mock import patch
    import torch
    torch.set_num_threads(2); torch.set_num_interop_threads(2)
    safe.require(not torch.cuda.is_initialized(), "CUDA initialized before tests")
    bindings = _bindings()
    counts = {"autogradAttempts": 0, "autogradCompleted": 0,
        "generatorForwardAttempts": 0, "generatorForwardsCompleted": 0,
        "optimizerObjects": 0, "optimizerSteps": 0}
    native = torch.autograd.grad
    def counted_grad(*args, **kwargs):
        counts["autogradAttempts"] += 1
        value = native(*args, **kwargs); counts["autogradCompleted"] += 1; return value
    def pre(module, args):
        if type(module).__name__ in ("DetailWeightPrecisionRegimeRenderer", "BiasPrecisionRegimeRenderer"):
            counts["generatorForwardAttempts"] += 1
    def post(module, args, result):
        if type(module).__name__ in ("DetailWeightPrecisionRegimeRenderer", "BiasPrecisionRegimeRenderer"):
            counts["generatorForwardsCompleted"] += 1
    def forbidden(*args, **kwargs): raise AssertionError("optimizer construction prohibited")
    class BoundedText(io.StringIO):
        def write(self, value):
            safe.require(self.tell() + len(value.encode("utf-8")) <= 65536, "test text limit exceeded")
            return super().write(value)
    items = []
    class Results(unittest.TextTestResult):
        def addSubTest(self, test, subtest, error):
            status = "pass" if error is None else ("fail" if issubclass(error[0], test.failureException) else "error")
            items.append({"test": subtest.id(), "status": status, "subtest": True})
            super().addSubTest(test, subtest, error)
        def addSuccess(self, test):
            items.append({"test": test.id(), "status": "pass"}); super().addSuccess(test)
        def addFailure(self, test, error):
            items.append({"test": test.id(), "status": "fail"}); super().addFailure(test, error)
        def addError(self, test, error):
            items.append({"test": test.id(), "status": "error"}); super().addError(test, error)
        def addSkip(self, test, reason):
            items.append({"test": test.id(), "status": "skip", "reason": reason}); super().addSkip(test, reason)
    start = time.monotonic(); text = BoundedText()
    pre_handle = torch.nn.modules.module.register_module_forward_pre_hook(pre)
    post_handle = torch.nn.modules.module.register_module_forward_hook(post)
    try:
        with patch.object(torch.autograd, "grad", counted_grad), patch.object(torch.optim.Optimizer, "__init__", forbidden), \
             patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA init prohibited")), \
             patch.object(torch.cuda, "manual_seed_all", side_effect=AssertionError("CUDA seed prohibited")):
            suite = unittest.defaultTestLoader.loadTestsFromNames(TESTS)
            result = unittest.TextTestRunner(stream=text, verbosity=2, resultclass=Results).run(suite)
    finally:
        pre_handle.remove(); post_handle.remove()
    safe.deadline_check(deadline)
    safe.require(_bindings() == bindings, "test sources changed during invocation")
    report = {"taskId": "T-Q4-43", "status": "synthetic_cpu_pass" if result.wasSuccessful() else "synthetic_cpu_failed_closed",
        "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
        "skipped": len(result.skipped), "items": items, "testText": text.getvalue(),
        "sourceBindings": bindings, "actualCalls": counts, "cpuThreads": torch.get_num_threads(),
        "cpuInteropThreads": torch.get_num_interop_threads(), "cudaInitialized": torch.cuda.is_initialized(),
        "cudaVisibleDevices": os.environ.get("CUDA_VISIBLE_DEVICES"), "elapsedTestSeconds": time.monotonic() - start,
        "realImageReads": 0, "captureLoads": 0, "checkpointLoads": 0, "trainingAllowed": False,
        "remainingGaps": ["Authenticated diagnostic-only real failure-state importer unavailable",
            "CUDA VJP equivalence and one fault counterfactual not executed",
            "No full-train/lifecycle/visual/release eligibility"]}
    safe.require(not report["cudaInitialized"], "CUDA initialized by synthetic tests")
    safe.write_exclusive(output, "worker-result.json", report)
    return 0 if result.wasSuccessful() else 1


def main():
    started = time.monotonic()
    parser = argparse.ArgumentParser()
    parser.add_argument("--synthetic-cpu-tests", action="store_true")
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--output", default=OUTPUT)
    parser.add_argument("--deadline", type=float)
    args = parser.parse_args()
    safe = _safe()
    safe.require(args.output.replace("\\", "/") == OUTPUT, "output outside T-Q4-43 scope")
    output = safe.logical_path(ROOT, OUTPUT)
    if args.worker:
        safe.require(args.deadline is not None and 0 < args.deadline - started <= 120, "inherited deadline required")
        try: return _worker(output, args.deadline)
        except BaseException as error:
            safe.write_exclusive(output, "worker-error.json",
                {"errorType": type(error).__name__, "error": str(error)[:2048]}, failure=True)
            raise
    safe.require(args.synthetic_cpu_tests and args.deadline is None, "explicit synthetic CPU command required")
    output.mkdir(parents=True, exist_ok=True)
    safe.require(not (output / "test-claim.json").exists(), "one invocation only; no retry")
    deadline = started + 120
    bindings = _bindings()
    safe.write_exclusive(output, "test-claim.json",
        {"taskId": "T-Q4-43", "sourceBindings": bindings, "limits": safe.LIMITS,
         "argv": sys.argv, "deadlineMonotonic": deadline, "syntheticOnly": True})
    process = None
    try:
        argv = [sys.executable, "-B", str(Path(__file__).absolute()), "--worker", "--output", OUTPUT,
                "--deadline", str(deadline)]
        process = safe.run_owned_process(argv, cwd=ROOT, deadline=deadline, evidence_root=output)
        safe.write_exclusive(output, "owned-process.json", process)
        safe.require(process["cleanupConfirmed"] and not process["timedOut"] and process["exitCode"] == 0,
            "owned CPU tests failed, timed out or cleanup unconfirmed")
        safe.require(_bindings() == bindings, "test sources changed")
        final = {"taskId": "T-Q4-43", "status": "owned_synthetic_cpu_pass",
            "ownedProcess": process, "workerReport": {"path": str(output / "worker-result.json"),
             "sha256": hashlib.sha256((output / "worker-result.json").read_bytes()).hexdigest()},
            "sourceBindings": bindings, "wallSecondsIncludingStartup": time.monotonic() - started,
            "diagnosticBytesBeforeTerminal": safe.output_bytes(output), "automaticRetries": 0}
        safe.write_exclusive(output, "test-terminal.json", final)
        print(json.dumps({"status": final["status"], "cleanupConfirmed": True, "output": OUTPUT}))
        return 0
    except BaseException as error:
        safe.write_exclusive(output, "test-terminal.json",
            {"taskId": "T-Q4-43", "status": "owned_synthetic_cpu_failed_closed",
             "errorType": type(error).__name__, "error": str(error)[:2048],
             "ownedProcess": process or getattr(error, "owned_process_receipt", None),
             "wallSecondsIncludingStartup": time.monotonic() - started}, failure=True)
        raise


if __name__ == "__main__": sys.exit(main())
