"""New-identity single counterfactual; no old proxy execution or training."""
from __future__ import annotations
import argparse, hashlib, inspect, json, math, os, sys, time
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
import diagnose_stage4_appearance_regime_failure_state_g_gpu as legacy
core, safe, require = legacy.core, legacy.safe, legacy.require
ROOT = Path(os.path.abspath(__file__)).parents[3]
ENTRY = "ml/ai-painter/scripts/diagnose_stage4_detail_weight_precision_counterfactual_gpu.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_detail_weight_precision_counterfactual_gpu.py"
MODEL = "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_precision.py"
PARENT = safe.OUTPUT_PARENT + "/next-t-q4-44/numeric-cpu"
SCHEMA = "detail-weight-precision-one-counterfactual-v1"
SPEC_SHA = "33958c6d55c809b5a52288f0dfe8a5e615ce76913e54bc6e7870ba806830ccc6"
BOUNDARY = {**legacy.BOUNDARY, "capability": "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"}
FROZEN = {**{p: s for p, s in legacy.FROZEN.items() if p != legacy.SPEC},
    legacy.ENTRY: "b5d62ca754dccc0a395d9cd3f3b87536a0bae26eea8690ac447385396b097d5c",
    "ml/ai-painter/src/ai_painter/complete_world/detail_weight_reduction_precision.py":
        "cbe9d9bf00d4bf5c8a1a217d0cbd59e2bd05a2233cbc1b6ee9c1f0bb2c196608",
    "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_priority_update.py":
        "2f46c0d019adbfb41538f066572da4c88819917d9ca52ebf4614052ba76c0ca1",
    "ml/ai-painter/scripts/painter_stage4_appearance_regime_detail_weight_probe.py":
        "0f1d5896d8a375d6643da262789c39cca7c194fde095b51833081cd66dd23177"}
BINDINGS = [core.SOURCE_FAILURE, legacy.HISTORY, legacy.CPU_TERMINAL]
CPU_JS_TEST = "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs"
CPU_JS_TEST_SHA = "b56d91ea8e057aa4c1a9094c068e09feecba7bb3b420f3a1bd32a33b33b064bc"
CPU_JS_TEST_SNAPSHOT = {
    "path": safe.OUTPUT_PARENT + "/next-t-q4-42/migration-regression/test-before.mjs",
    "sha256": CPU_JS_TEST_SHA, "bytes": 28974}
CPU_JS_BASELINE = {
    "path": safe.OUTPUT_PARENT + "/next-t-q4-42/migration-regression/baseline.json",
    "sha256": "4e6dae983bd5f0e8d37a2b1d9bbb0370aaced7e48a18c0fefcb5c8d5ecfc0fb1"}


class CounterfactualCpuEvidenceReader(legacy.CpuReportReader):
    """One explicit non-executed JS source snapshot; never a generic fallback."""
    def bound(self, binding, *, json_data=True, maximum=None):
        if type(binding) is dict and binding.get("path") == CPU_JS_TEST:
            require(not json_data and binding == {"path": CPU_JS_TEST, "sha256": CPU_JS_TEST_SHA},
                "historical CPU JS binding differs")
            baseline = super().bound(CPU_JS_BASELINE)
            require(baseline["sourceBefore"]["test"] == CPU_JS_TEST_SHA,
                "historical CPU JS provenance differs")
            current = {"path": CPU_JS_TEST,
                "sha256": safe.file_hash(safe.logical_path(self.root, CPU_JS_TEST), self.deadline)}
            super().bound(current, json_data=False, maximum=maximum)
            return super().bound(CPU_JS_TEST_SNAPSHOT, json_data=False, maximum=maximum)
        return super().bound(binding, json_data=json_data, maximum=maximum)


def programs(reader):
    result = []
    for path in (ENTRY, TEST, MODEL, *FROZEN, core.SPEC):
        sha = safe.file_hash(safe.logical_path(reader.root, path), reader.deadline)
        if path in FROZEN: require(sha == FROZEN[path], "frozen counterfactual source changed: " + path)
        if path == core.SPEC: require(sha == SPEC_SHA, "current counterfactual spec differs")
        binding = {"path": path, "sha256": sha}
        reader.bound(binding, json_data=False); result.append(binding)
    return result


def preflight(root, deadline, bindings):
    require(bindings == BINDINGS, "explicit counterfactual source bindings differ")
    reader = core.HistoryReader(root, deadline, core.SOURCE_FAILURE, legacy.HISTORY)
    context = safe.preflight(reader, core.SOURCE_FAILURE)
    data = core.input_preflight(reader, context)
    # Only old CPU evidence resolves SPEC1.47 to its exact immutable bytes.
    # Current SPEC1.49 is independently checked in programs(); never alias it.
    proof = CounterfactualCpuEvidenceReader(root, deadline)
    cpu = legacy.cpu_evidence(proof)
    current = programs(reader)
    for path, sha in proof.observed.items():
        require(path not in reader.observed or reader.observed[path] == sha, "CPU/new closure collision")
        reader.observed[path] = sha
    reader.unchanged()
    return reader, context, data, cpu, current


def identity(reader, current):
    return safe.digest(safe.encoded({"algorithm": SCHEMA, "inputs": reader.observed,
        "programs": current, "bindings": BINDINGS, "device": 0, "uuid": legacy.GPU_UUID,
        "limits": safe.LIMITS, "boundary": BOUNDARY}))


class OriginalLossNewBridge:
    """Only the gradient adapter changes; original frozen objective builds total."""
    def __init__(self):
        import painter_stage4_appearance_regime_probe as original
        from ai_painter.complete_world import object_appearance_regime_detail_weight_priority_update as bridge
        self.original, self.bridge = original, bridge
        self.observe_generator_gradients = bridge.observe_generator_gradients
        self.sample_forward = original.sample_forward

    def _generator_candidate(self, model, critic, sample, order, prediction):
        with self.original.generator_fp32_scope(next(model.parameters()).device):
            total, parts = self.original.train_object_core_fidelity_candidate_objective(
                critic, prediction, sample, sample["objectInstanceTable"], order)
            candidate, facts = self.bridge.compute_generator_candidate_gradients(
                model=model, critic=critic, sample=sample, actual_total=total,
                structured_objective=parts["v21UnchangedTotal"], whole_frame_fidelity=parts["wholeFrameFidelity"],
                object_core_rgb=parts["objectCoreRgbWeighted"])
        return total, candidate, facts


@contextmanager
def observe_native_target_vjps(model):
    """Install only after the real legacy module_guard, then observe four VJPs."""
    import torch
    from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import TARGET
    target = model.get_submodule(TARGET)
    original = torch.ops.aten.convolution_backward.default
    records, handles, saved = [], [], {}
    def equal_bytes(a, b):
        return a is not None and b is not None and torch.equal(
            a.detach().contiguous().reshape(-1).view(torch.uint8),
            b.detach().contiguous().reshape(-1).view(torch.uint8))
    def input_hook(value):
        require(records and equal_bytes(value, saved["nativeInput"]), "native target input VJP bytes differ")
        records[-1]["inputVerified"] = True
        return value
    def bias_hook(value):
        require(records and equal_bytes(value, saved["nativeBias"]), "native target bias VJP bytes differ")
        records[-1]["biasVerified"] = True
        return value
    def forward(module, args, result):
        require("features" not in saved, "extra target forward prohibited")
        features = args[0]; saved["features"] = features
        saved["mask"] = (features.requires_grad, target.weight.requires_grad, target.bias.requires_grad)
        if features.requires_grad: handles.append(features.register_hook(input_hook))
    def native(*args, **kwargs):
        values = original(*args, **kwargs)
        if len(args) >= 11 and args[2] is target.weight and args[1] is saved.get("features"):
            require(not kwargs and tuple(args[-1]) == saved["mask"], "native full actual output mask differs")
            require(len(records) < 4, "extra target backward prohibited")
            saved["nativeInput"], saved["nativeBias"] = values[0], values[2]
            records.append({"mask": list(args[-1]), "inputVerified": not args[-1][0],
                "biasVerified": not args[-1][2], "nativeBackwardCount": len(records) + 1})
        return values
    handles.extend((target.register_forward_hook(forward), target.bias.register_hook(bias_hook)))
    try:
        with patch.object(torch.ops.aten.convolution_backward, "default", native):
            yield records
    except BaseException as error:
        error.counterfactual_native_vjp_observations = list(records)
        raise
    finally:
        for handle in handles: handle.remove()


class _DelayedNativeProfile:
    """The legacy runner checks unmodified modules before calling sample_forward."""
    def __init__(self, original):
        self.original, self.context, self.records = original, None, []
    def __getattr__(self, name): return getattr(self.original, name)
    def sample_forward(self, model, sample):
        require(self.context is None, "extra observed generator forward prohibited")
        self.context = observe_native_target_vjps(model)
        self.records = self.context.__enter__()
        return self.original.sample_forward(model, sample)


@contextmanager
def delayed_native_profile(original):
    profile = _DelayedNativeProfile(original)
    primary = None
    try:
        yield profile
    except BaseException as error:
        primary = error
        raise
    finally:
        if profile.context is not None:
            profile.context.__exit__(None if primary is None else type(primary),
                primary, None if primary is None else primary.__traceback__)


def require_native_vjps(records):
    require(len(records) == 4 and all(r["inputVerified"] and r["biasVerified"] for r in records),
        "four native input/bias VJP comparisons incomplete")


def same_imported_cpu_state(model, critic, sample, cpu):
    before = cpu["result"]["before"]
    require({k: core.tensor_sha(sample[k]) for k in ("image", "conditions", "appearance_regime")} == before["input"]
        and safe.digest(safe.encoded(sample["objectInstanceTable"])) == before["table"], "CPU rebuilt input/table differs")
    actual = legacy.content_state(core.state_snapshot(model)); expected = legacy.content_state(before["model"])
    actual["buffers"] = [b for b in actual["buffers"] if b[0] != "numeric_identity"]
    expected["buffers"] = [b for b in expected["buffers"] if b[0] != "numeric_identity"]
    require(actual == expected, "CPU imported generator state differs beyond numeric_identity")
    require(legacy.content_state(core.state_snapshot(critic)) == legacy.content_state(before["critic"]),
        "CPU imported critic state differs")


def worker(root, bindings, output, request, deadline):
    safe.verify_owned_worker(); safe.deadline_check(deadline)
    reader, context, data, cpu, current = preflight(root, deadline, bindings)
    require(identity(reader, current) == request, "worker request identity differs")
    claim = json.loads((output / "counterfactual-claim.json").read_bytes())
    require(claim["requestIdentity"] == request and claim["bindings"] == bindings
        and claim["deadline"] == deadline, "worker claim differs")
    # Query before any CUDA initialization. No operator or tensor load in parent.
    initial_nvml = legacy.resource_precheck(root, deadline)
    sys.path[:0] = [str(root / "ml/ai-painter/src"), str(root / "ml/ai-painter/scripts")]
    import torch
    torch.set_num_threads(2); torch.set_num_interop_threads(2)
    from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as successor
    import painter_stage4_appearance_regime_probe as original
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as decoder
    import painter_stage4_appearance_regime_checkpoint_worker as attached
    model = successor.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=data["order"])
    _, critic = original.fresh_networks(data["order"])
    installed = successor.import_diagnostic_failure_state(model=model, critic=critic, root=root,
        terminal_binding=core.SOURCE_FAILURE, history_binding=legacy.HISTORY, deadline=deadline)
    adapter = core.InputReader(reader, data["known"])
    sample, decoded = decoder.load_sample(adapter, data["row"], data["order"], data["continuous"])
    sample = attached.attach_regime(adapter, data["row"], sample)
    entry = core.state_snapshot(critic)
    critic.eval().requires_grad_(False)
    same_imported_cpu_state(model, critic, sample, cpu)
    require(identity(reader, current) == request, "decoder expanded bound input identity")
    modules, parameters = dict(critic.named_modules()), dict(critic.named_parameters())
    for name, mode in entry["modes"]: modules[name].training = mode
    for row in entry["parameters"]: parameters[row[0]].requires_grad_(row[5])
    torch.cuda.set_per_process_memory_fraction(.7, 0)
    resource = lambda: legacy.resources(torch, root, deadline)
    first_resource = resource()
    device = torch.device("cuda:0"); model.to(device); critic.to(device)
    bound = original._bound_device(model, sample)
    allowed = {str(safe.logical_path(root, p).resolve()) for p in data["sources"] if p.endswith(".py")}
    allowed.add(str(safe.logical_path(root, MODEL).resolve()))
    with delayed_native_profile(OriginalLossNewBridge()) as profile:
        result = legacy.run_gpu_graph(model=model, critic=critic, sample=bound, order=data["order"],
            profile=profile, deadline=deadline, allowed_files=allowed, device=device, resource=resource)
    native_records = profile.records
    with core.completed_g_evidence(result):
        require_native_vjps(native_records)
        raw = result["rawGradients"]
        gpu_mask = legacy.mask_statistics(raw, tuple(model.parameters()), device)
        cpu_raw = [tuple(None if v is None else v.detach().cpu() for v in rows) for rows in raw]
        cpu_mask = legacy.mask_statistics(cpu_raw, tuple(p.detach().cpu() for p in model.parameters()), torch.device("cpu"))
        semantics = legacy.reconcile_gate(result["outcome"], cpu_mask, gpu_mask)
        summaries = [[{"unused": v is None, "shape": None if v is None else list(v.shape),
            "sha256": None if v is None else core.tensor_sha(v)} for v in rows] for rows in raw]
        final_resource = resource(); torch.cuda.synchronize(0)
        reader.unchanged(); installed["reader"].unchanged(); safe.deadline_check(deadline)
        require(identity(reader, current) == request, "final input/source identity differs")
        complete = {k: v for k, v in result.items() if k != "rawGradients"}
        report = {"schemaVersion": SCHEMA, "status": "counterfactual_complete_diagnostic_only",
            "requestIdentity": request, "bindings": bindings, "programBindings": current,
            "inputBindings": dict(reader.observed), "result": complete, "importReceipt": installed["receipt"],
            "nativeVjpObservations": native_records, "gpuDiagnosticMask": gpu_mask,
            "cpuReferenceMaskOfGpuGradients": cpu_mask, "gateSemantics": semantics,
            "rawGradientSummaries": summaries, "decodedIdentity": decoded,
            "actualTrainingCountsUnchanged": context["counts"], "originalFailure": context["originalError"],
            "resources": {"beforeCudaInitialization": initial_nvml, "before": first_resource, "after": final_resource,
                "actualAllocatedPeakBytes": torch.cuda.max_memory_allocated(0),
                "actualReservedPeakBytes": torch.cuda.max_memory_reserved(0)},
            "boundary": BOUNDARY, "limits": safe.LIMITS}
        # Commit completed diagnostics before enforcing the strict candidate result.
        safe.write_exclusive(output, "counterfactual-comparison.json", report)
        require(result["outcome"] == "original_cpu_reference_gate_passed"
            and cpu_mask["passedAllOriginalToleranceMasks"] and gpu_mask["passedAllOriginalToleranceMasks"],
            "counterfactual strict original gate or device mask failed")
        return safe.write_exclusive(output, "counterfactual-worker-result.json", report)


def diagnose(*, bindings=BINDINGS, root=ROOT, execute=False):
    root = Path(os.path.abspath(root)); deadline = time.monotonic() + 120
    reader, context, data, cpu, current = preflight(root, deadline, bindings)
    request = identity(reader, current)
    if not execute:
        return {"status": "counterfactual_readonly_preflight_no_tensor_load", "requestIdentity": request,
            "programBindings": current, "cudaInitialized": False}
    output = safe.logical_path(root, PARENT + "/gpu-control-" + request)
    require(not output.exists(), "counterfactual identity already consumed; no retry")
    output.mkdir(parents=True, exist_ok=False)
    safe.write_exclusive(output, "counterfactual-claim.json",
        {"requestIdentity": request, "bindings": bindings, "programBindings": current, "deadline": deadline})
    process = None
    try:
        argv = [sys.executable, "-B", str(safe.logical_path(root, ENTRY)), "--gpu-worker",
            "--output", str(output.relative_to(root)).replace("\\", "/"), "--identity", request,
            "--deadline", str(deadline)]
        process = legacy.run_owned_gpu_process(argv, cwd=root, deadline=deadline, evidence_root=output)
        safe.write_exclusive(output, "counterfactual-owned-process.json", process)
        require(process["cleanupConfirmed"] and not process["timedOut"] and process["exitCode"] == 0,
            "counterfactual worker failed/timed out/cleanup unknown")
        file = output / "counterfactual-worker-result.json"
        require(file.stat().st_size <= safe.LIMITS["jsonBytes"], "counterfactual report budget")
        result = json.loads(file.read_bytes())
        require(result["requestIdentity"] == request and result["programBindings"] == current
            and result["bindings"] == bindings and result["boundary"] == BOUNDARY, "counterfactual worker binding differs")
        reader.unchanged(); safe.deadline_check(deadline)
        result["ownedProcess"] = process
    except BaseException as error:
        process = process or getattr(error, "owned_process_receipt", None)
        result = {"status": "counterfactual_failed_closed", "requestIdentity": request, "bindings": bindings,
            "errorType": type(error).__name__, "error": str(error)[:2048], "ownedProcess": process, "boundary": BOUNDARY}
        worker_error = output / "gpu-worker-error.json"
        if process is not None and process.get("cleanupConfirmed") and worker_error.is_file():
            require(worker_error.stat().st_size <= safe.LIMITS["failureReserveBytes"] // 4, "worker failure budget")
            result["workerFailure"] = legacy.stopped_worker_error(output, request, bindings)
    return safe.write_exclusive(output, "counterfactual-terminal.json", result,
        failure=result.get("status") == "counterfactual_failed_closed")


def synthetic_cpu_tests():
    """Single CPU owned invocation, new claim; no previous test identity consumed."""
    output = safe.logical_path(ROOT, PARENT + "/synthetic-cpu")
    require(not output.exists(), "synthetic test identity already consumed")
    output.mkdir(parents=True)
    deadline = time.monotonic() + 120
    reader = safe.Reader(ROOT, deadline); current = programs(reader)
    safe.write_exclusive(output, "test-claim.json", {"programBindings": current, "deadline": deadline})
    program = ("import sys,unittest,io,json,time;from pathlib import Path;"
        "root=Path(sys.argv[1]);out=Path(sys.argv[2]);"
        "sys.path[:0]=[str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/src'),str(root/'ml/ai-painter/tests')];"
        "import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as s;s.verify_owned_worker();"
        "import torch;torch.set_num_threads(2);torch.set_num_interop_threads(2);"
        "text=io.StringIO();suite=unittest.defaultTestLoader.loadTestsFromName('test_diagnose_stage4_detail_weight_precision_counterfactual_gpu');"
        "r=unittest.TextTestRunner(stream=text,verbosity=2).run(suite);"
        "report={'testsRun':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'skipped':len(r.skipped),"
        "'testText':text.getvalue(),'cudaInitialized':torch.cuda.is_initialized(),'cpuThreads':torch.get_num_threads()};"
        "s.write_exclusive(out,'worker-result.json',report);sys.exit(0 if r.wasSuccessful() and not torch.cuda.is_initialized() else 1)")
    process = safe.run_owned_process([sys.executable, "-B", "-c", program, str(ROOT), str(output)],
        cwd=ROOT, deadline=deadline, evidence_root=output)
    safe.write_exclusive(output, "owned-process.json", process)
    require(process["cleanupConfirmed"] and not process["timedOut"], "synthetic CPU cleanup/timeout failure")
    reader.unchanged()
    report = {"process": process, "programBindings": current,
        "worker": json.loads((output / "worker-result.json").read_bytes())}
    safe.write_exclusive(output, "test-terminal.json", report)
    require(process["exitCode"] == 0 and report["worker"]["failures"] == 0
        and report["worker"]["errors"] == 0 and not report["worker"]["cudaInitialized"],
        "synthetic CPU validation failed; retained terminal, no retry")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic-cpu-tests", action="store_true")
    parser.add_argument("--execute-gpu-counterfactual", action="store_true")
    parser.add_argument("--gpu-worker", action="store_true")
    parser.add_argument("--output"); parser.add_argument("--identity"); parser.add_argument("--deadline", type=float)
    args = parser.parse_args()
    if args.gpu_worker:
        require(not args.synthetic_cpu_tests and not args.execute_gpu_counterfactual
            and args.identity and args.output == PARENT + "/gpu-control-" + args.identity
            and args.deadline is not None and 0 < args.deadline - time.monotonic() <= 120,
            "invalid counterfactual worker claim")
        output = safe.logical_path(ROOT, args.output)
        try: worker(ROOT, BINDINGS, output, args.identity, args.deadline)
        except BaseException as error:
            legacy.save_worker_error(output, args.identity, BINDINGS, error)
            raise
    elif args.synthetic_cpu_tests:
        require(not args.execute_gpu_counterfactual, "synthetic GPU execution prohibited")
        print(json.dumps(synthetic_cpu_tests()))
    else:
        print(json.dumps(diagnose(execute=args.execute_gpu_counterfactual)))


if __name__ == "__main__": main()
