"""Single managed synthetic suite. No archive read, production writer or GPU.

The existing host owns the attempt, process containment and total output ledger.
This worker has no guard/registry writer and never invokes that host itself.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).absolute().parents[3]
AUDIT = ".runtime/ai-painter/controller-repair-reviews/parameter90-review-20261019/same-call-integration-cpu-v2"
POLICY = "data/ai-painter/system-governance/ai-painter-parameter90-training-same-call-integration-cpu-policy-v2.json"
DRIVER = "ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v2.py"
COMPONENT = "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_capture_v1.py"
TEST = "ml/ai-painter/tests/test_parameter90_training_same_call_integration_cpu_v1.py"
EXTRA_TESTS = ("ml/ai-painter/tests/test_parameter90_training_same_call_capture_cpu_v1.py",
               "ml/ai-painter/tests/test_parameter90_training_same_call_storage_cpu_v1.py",
               "ml/ai-painter/tests/test_parameter90_training_same_call_host_cpu_v2.py")
LOADER = "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py"
OUTPUT = AUDIT + "/attempt-001"
RESULT = "same-call-integration-cpu-result-v2.json"
LIMITS = dict(cpuThreads=2, cpuAffinityMaximum=2, maxWallSecondsIncludingStartup=120,
              maxRssMiB=1536, maxOutputMiB=8, maxSingleJsonMiB=2,
              failureReserveBytes=65536, attempts=1, automaticRetries=0)
CAPTURE_BUDGET = dict(targetSidecarMaximumBytes=2097152, aggregateFailureMaximumBytes=67108864,
                      executionMaximumBytes=134217728)
TARGET = dict(parameterIndex=90, parameterName="core.core.final_rgb_decoder.base.layers.4.weight",
              weightShape=[3,48,1,1], coordinate=[0,1,0,0], inputChannel=1, outputChannel=0)
SPEC = dict(path="docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
            version="AI-PAINTER-SPEC-1.104", sha256="ad4c4d2ca4596decfb9d95ec04fcb4746947d234c43ec270826a5fe871d0098d")
DESIGN = dict(path=AUDIT+"/design-v1.json", sha256="8107fe2252a18f4cb567e45b9541dbca6ea1f415822f5ceb4eae4d1ae59c39dc")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def plain(path):
    for item in (path, *path.parents):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        require(not stat.S_ISLNK(info.st_mode) and not (getattr(info,"st_file_attributes",0) & 0x400),
                "physical path redirection")


def bootstrap_path(root, logical):
    """Pre-torch subset of the existing approved storage mapping checks.

    RuntimeMap takes over and revalidates this mapping immediately after import.
    No additional storage option or fallback to an unapproved .runtime exists.
    """
    require(type(logical) is str and 0 < len(logical) <= 4096 and not logical.startswith("/") and
            not re.search(r"[\\:\x00-\x1f\x7f]",logical) and
            all(p not in ("", ".", "..") for p in logical.split("/")), "unsafe logical path")
    root = Path(os.path.abspath(root))
    plain(root)
    parts = logical.split("/")
    if parts[0] == ".runtime":
        default = "D:/AI-PET-WORLD-DATA" if os.name == "nt" else str(root/".ai-pet-world-data")
        storage = Path(os.environ.get("AI_PET_WORLD_DATA_ROOT",default))
        require(storage.is_absolute(), "storage data root must be absolute")
        physical = Path(os.path.abspath(storage/"hot/runtime"))
        plain(physical)
        require(physical.is_dir() and (root/".runtime").exists() and
                (root/".runtime").resolve() == physical, "formal runtime mapping differs")
        result = physical.joinpath(*parts[1:])
    else:
        result = root.joinpath(*parts)
    plain(result)
    return result


def read_bound(root, binding, maximum=1048576):
    require(type(binding) is dict and {"path","sha256"} <= set(binding) <= {"path","sha256","version"} and
            type(binding["sha256"]) is str and re.fullmatch("[a-f0-9]{64}",binding["sha256"]), "invalid exact binding")
    path = bootstrap_path(root,binding["path"])
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= maximum,
            "regular single-link bounded input required")
    stamp = lambda s: (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    with path.open("rb") as stream:
        handle_before = os.fstat(stream.fileno())
        # Match RuntimeMap.binding: Windows APIs disagree on ctime, so compare
        # shared identity across APIs and retain ctime stability within each.
        require(stamp(handle_before)[:-1] == stamp(before)[:-1], "input changed before read")
        raw = stream.read(maximum+1)
        require(len(raw) == before.st_size and stamp(os.fstat(stream.fileno())) == stamp(handle_before),
                "input changed during read")
    require(stamp(path.lstat()) == stamp(before) and bootstrap_path(root,binding["path"]) == path,
            "input mapping or identity changed")
    require(len(raw) <= maximum and digest(raw) == binding["sha256"], "binding SHA differs: "+binding["path"])
    return raw


def validate_policy(policy):
    require(type(policy) is dict and policy.get("schemaVersion") ==
            "ai-painter-parameter90-training-same-call-integration-cpu-policy-v2" and
            policy.get("status") == "registered_cpu_integration_validation_only" and
            policy.get("scope") == "training_same_call_integration_synthetic_cpu_only", "policy identity differs")
    require(policy.get("formalSpecification") == SPEC and policy.get("designBinding") == DESIGN,
            "current specification/design differs")
    require(policy.get("resources") == LIMITS and policy.get("captureBudget") == CAPTURE_BUDGET,
            "resource/capture limits differ")
    require(policy.get("target") == TARGET and policy.get("outputRoot") == OUTPUT, "target/output differs")
    comparison = policy.get("comparison",{})
    require(comparison == dict(atol=1e-6,rtol=1e-5,
        gradientLabels=["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"],
        fp32Order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",
        originalGateKept=True), "original comparison differs")
    require(policy.get("executionBoundary") == dict(syntheticCpuOnly=True,gpu=False,training=False,
        productionIntegrated=False,oldRunReplay=False,originalDataRead=False), "synthetic-only boundary differs")
    require(policy.get("executionHost",{}).get("path") ==
            "scripts/check-ai-painter-parameter90-training-same-call-integration-cpu-v2.mjs" and
            policy.get("executionHostTests",{}).get("path") ==
            "scripts/tests/ai-painter-parameter90-training-same-call-integration-cpu-v2.test.mjs", "host binding differs")
    programs = policy.get("programBindings")
    require(type(programs) is list and 0 < len(programs) <= 256 and
            all(type(b) is dict and set(b) == {"path","sha256"} and type(b["path"]) is str and
                b["path"].startswith("ml/ai-painter/") and b["path"].endswith(".py") for b in programs),
            "bounded exact Python bindings required")
    required_sources = {DRIVER,COMPONENT,TEST,LOADER,*EXTRA_TESTS,
        "ml/ai-painter/scripts/check_parameter90_training_same_call_capture_cpu_v1.py",
        "ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py",
        "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py",
        "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py"}
    require(len({b["path"] for b in programs}) == len(programs) and
            required_sources <= {b["path"] for b in programs}, "required unique source paths absent")
    containment = policy.get("containmentProgramBindings")
    require(type(containment) is dict and set(containment) == {"owner","nativeBridge","nativeOwnerSource",
            "pathResolver","storageConfiguration","operatorSession","candidateRegistration"}, "containment roles differ")
    interpreter = policy.get("interpreter",{})
    require(set(interpreter) == {"absolutePath","sha256"} and
            Path(interpreter["absolutePath"]) == ROOT/"ml/ai-painter/.venv/Scripts/python.exe", "interpreter path differs")
    return [policy["formalSpecification"],policy["designBinding"],policy["executionHost"],policy["executionHostTests"],
            *programs,*containment.values()]


def verify_imports(root, programs):
    bound = {b["path"]: b for b in programs}
    loaded = set()
    for module in tuple(sys.modules.values()):
        filename = getattr(module,"__file__",None)
        # Torch exposes virtual modules named _ops.py/_classes.py. They have
        # relative pseudo __file__ values, not source files in this project.
        if not filename or not Path(filename).is_absolute():
            continue
        path = Path(os.path.abspath(filename))
        try:
            logical = path.relative_to(root).as_posix()
        except ValueError:
            continue
        if logical.startswith("ml/ai-painter/.venv/"):
            continue
        require(path.suffix == ".py" and logical in bound, "unbound actual project import: "+logical)
        read_bound(root,bound[logical])
        loaded.add(logical)
    require({DRIVER,COMPONENT,TEST,LOADER} <= loaded, "required actual source imports missing")
    return sorted(loaded)


class ResourceMonitor:
    def __init__(self, process, deadline, started):
        self.process,self.deadline,self.started = process,deadline,started
        self.peak,self.failure,self.torch,self.last_sample = 0,None,None,0.0

    def check(self):
        if self.failure is not None:
            raise self.failure
        try:
            require(time.time()*1000 < self.deadline and time.monotonic()-self.started <= 120,
                    "CPU deadline exceeded including preparation/finalization")
            affinity = self.process.cpu_affinity()
            require(0 < len(affinity) <= 2, "CPU affinity exceeds two")
            self.peak = max(self.peak,self.process.memory_info().rss)
            require(self.peak <= 1536*1024**2, "sampled RSS exceeds 1536MiB")
            if self.torch is not None:
                require(self.torch.get_num_threads() == 2 and self.torch.get_num_interop_threads() <= 2 and
                        not self.torch.cuda.is_initialized(), "two-thread CPU/no CUDA boundary differs")
            self.last_sample = time.monotonic()
        except BaseException as error:
            self.failure = error
            raise


def fixture_bytes(folder, *, depth=0, counter=None, ancestors=()):
    """Account untrusted fixtures; detected redirects reject, not an ABA proof."""
    counter = [0] if counter is None else counter
    require(depth <= 32, "private fixture depth")
    try:
        info = folder.lstat()
    except FileNotFoundError:
        return 0
    if stat.S_ISLNK(info.st_mode) or getattr(info,"st_file_attributes",0) & 0x400:
        return info.st_size
    if stat.S_ISREG(info.st_mode):
        return info.st_size  # A fixture hardlink is not a trusted input.
    require(stat.S_ISDIR(info.st_mode), "private fixture special file")
    chain = (*ancestors,(folder,(info.st_dev,info.st_ino)))
    def verify():
        for anchor,identity in chain:
            current=anchor.lstat()
            require(not stat.S_ISLNK(current.st_mode) and not (getattr(current,"st_file_attributes",0) & 0x400)
                    and stat.S_ISDIR(current.st_mode) and (current.st_dev,current.st_ino)==identity,
                    "private fixture directory changed")
    verify()
    total = 0
    try:
        children = os.scandir(folder)
    except FileNotFoundError:
        return 0
    with children:
        verify()
        for child in children:
            verify()
            counter[0] += 1
            require(counter[0] <= 4096, "private fixture entries")
            total += fixture_bytes(Path(child.path),depth=depth+1,counter=counter,ancestors=chain)
            require(total <= 8*1024**2, "private fixture bytes")
        verify()
    try:
        after = folder.lstat()
    except FileNotFoundError:
        return total
    require(not (getattr(after,"st_file_attributes",0) & 0x400) and
            (info.st_dev,info.st_ino) == (after.st_dev,after.st_ino), "private fixture directory changed")
    return total


def main():
    started = time.monotonic()
    parser = argparse.ArgumentParser()
    for flag in ("project","policy","policy-sha256","output","deadline-unix-ms"):
        parser.add_argument("--"+flag,required=True)
    args = parser.parse_args()
    root = Path(os.path.abspath(args.project))
    require(root == ROOT and args.policy == POLICY, "fixed project/policy required")
    require("torch" not in sys.modules, "torch imported before affinity containment")
    import psutil
    process = psutil.Process()
    process.cpu_affinity(process.cpu_affinity()[:2])
    monitor = ResourceMonitor(process,int(args.deadline_unix_ms),started)
    monitor.check()
    require(int(args.deadline_unix_ms)-time.time()*1000 <= 120000, "deadline cannot extend CPU budget")
    for key in ("OMP_NUM_THREADS","MKL_NUM_THREADS","OPENBLAS_NUM_THREADS"):
        os.environ[key] = "2"
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    sys.dont_write_bytecode = True
    policy_binding = dict(path=POLICY,sha256=args.policy_sha256)
    policy = strict_json(read_bound(root,policy_binding,2*1024**2))
    bindings = validate_policy(policy)
    total = 0
    for binding in bindings:
        total += len(read_bound(root,binding))
        monitor.check()
    require(total <= 16*1024**2, "source aggregate exceeds 16MiB")
    interpreter = dict(path="ml/ai-painter/.venv/Scripts/python.exe",sha256=policy["interpreter"]["sha256"])
    require(Path(sys.executable).absolute() == root/interpreter["path"], "running interpreter differs")
    read_bound(root,interpreter,16*1024**2)
    output_root = bootstrap_path(root,OUTPUT)
    require(Path(os.path.abspath(args.output)).resolve() == output_root and not output_root.exists(),
            "fixed fresh owned output required")
    monitor.check()
    sys.path.insert(0,str(root/"ml/ai-painter/src"))
    import torch
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    monitor.torch = torch
    monitor.check()
    from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
    runtime = capture.RuntimeMap.current(root)
    require(runtime.path(OUTPUT) == output_root, "bootstrap/runtime mapping differs")
    for binding in bindings:
        runtime.binding({k:binding[k] for k in ("path","sha256")},maximum=1048576)
    output_root.mkdir(exist_ok=False)
    output_identity = capture._directory_identity(output_root)
    fixture_root = output_root/"private-fixtures"
    fixture_root.mkdir(exist_ok=False)
    fixture_identity = capture._directory_identity(fixture_root)
    previous_temp = tempfile.tempdir
    tempfile.tempdir = str(fixture_root)
    stream = io.StringIO()
    modules = []
    old_trace = sys.gettrace()
    traced_files = {str(root/b["path"]) for b in policy["programBindings"]
                    if "parameter90_training_same_call" in b["path"] or "decode1_entry_same_call" in b["path"]}
    def trace(frame,event,arg):
        if frame.f_code.co_filename in traced_files:
            if time.monotonic()-monitor.last_sample >= .05:
                monitor.check()
            return trace
        return None
    class CheckedResult(unittest.TextTestResult):
        def startTest(self,test):
            monitor.check()
            super().startTest(test)
        def stopTest(self,test):
            super().stopTest(test)
            monitor.check()
    try:
        suites = []
        for name,logical in (("parameter90_same_call_cpu_synthetic_tests",EXTRA_TESTS[0]),
                             ("parameter90_same_call_integration_cpu_synthetic_tests",TEST),
                             ("parameter90_same_call_storage_cpu_synthetic_tests",EXTRA_TESTS[1]),
                             ("parameter90_same_call_host_cpu_synthetic_tests_v2",EXTRA_TESTS[2])):
            spec = importlib.util.spec_from_file_location(name,root/logical)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            modules.append(module)
            suites.append(unittest.defaultTestLoader.loadTestsFromModule(module))
        loaded_before = verify_imports(root,policy["programBindings"])
        suite = unittest.TestSuite(suites)
        require(suite.countTestCases() > 0, "synthetic suite empty")
        sys.settrace(trace)
        result = unittest.TextTestRunner(stream=stream,verbosity=2,resultclass=CheckedResult).run(suite)
    finally:
        sys.settrace(old_trace)
        tempfile.tempdir = previous_temp
    monitor.check()
    log = stream.getvalue().encode()
    require(len(log) <= 65536, "synthetic test log exceeds 64KiB")
    require(result.wasSuccessful() and not result.skipped, "synthetic component suite failed: "+log.decode()[-8192:])
    loaded_after = verify_imports(root,policy["programBindings"])
    read_bound(root,policy_binding,2*1024**2)
    for binding in bindings:
        read_bound(root,binding)
        runtime.binding({k:binding[k] for k in ("path","sha256")},maximum=1048576)
    read_bound(root,interpreter,16*1024**2)
    monitor.check()
    report = dict(schemaVersion="parameter90-same-call-integration-cpu-result-v2",
        status="parameter90_same_call_integration_cpu_validation_completed",policy=policy_binding,
        programBindings=policy["programBindings"],tests=dict(run=result.testsRun,failures=len(result.failures),
        errors=len(result.errors),skipped=len(result.skipped)),realModelForwards=0,realModelAutogradCalls=0,
        optimizerSteps=0,cudaInitialized=torch.cuda.is_initialized(),modelStatesInstalled=False,
        qualificationGranted=False,rootCauseProven=False,productionIntegrated=False,
        plannedOriginalCaptureCeilingBytes=67108864,syntheticDetails={m.__name__:getattr(m,"SYNTHETIC_DETAILS",{}) for m in modules},
        actualProjectImportsBeforeTests=loaded_before,actualProjectImportsAfterTests=loaded_after,
        resourceObservation=dict(sampledPeakRssBytes=monitor.peak,cpuAffinity=process.cpu_affinity(),
            torchThreads=torch.get_num_threads(),torchInteropThreads=torch.get_num_interop_threads(),
            elapsedSecondsIncludingPreparation=time.monotonic()-started,rssSampling="test_boundaries_and_50ms_python_line_samples"),
        limitations=["cpu_training_failure_wiring_only_not_production_activation_or_qualification",
                    "caller_step_labels_not_authenticated_execution_or_sample_authority",
                    "toy_forward_autograd_counts_are_not_real_model_counts"])
    payload = (json.dumps(report,ensure_ascii=False,allow_nan=False,indent=2)+"\n").encode()
    require(len(payload) <= 2*1024**2, "result JSON exceeds 2MiB")
    def output_check(extra=0):
        monitor.check()
        require(runtime.path(OUTPUT) == output_root and capture._directory_identity(output_root) == output_identity,
                "owned output identity changed")
        size = extra
        for directory,dirs,files in os.walk(output_root,followlinks=False):
            if Path(directory) == output_root and "private-fixtures" in dirs:
                require(capture._directory_identity(fixture_root) == fixture_identity,
                        "private fixture root changed")
                size += fixture_bytes(fixture_root)
                dirs.remove("private-fixtures")
            for name in (*dirs,*files):
                path = Path(directory)/name
                capture._plain(path)
                info = path.lstat()
                if stat.S_ISREG(info.st_mode):
                    require(info.st_nlink == 1, "owned output hardlink")
                    size += info.st_size
                else:
                    require(stat.S_ISDIR(info.st_mode), "owned output special file")
        require(size+65536 <= 8*1024**2, "worker output exceeds 8MiB including reserve")
    output_check(len(payload)+len(log))
    for name,raw in (("synthetic-unittest.log",log),(RESULT,payload)):
        target = runtime.path(OUTPUT+"/"+name)
        with target.open("xb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        output_check()
    summary = json.dumps(dict(result=str(output_root/RESULT),sha256=digest(payload)))+"\n"
    output_check(len(summary.encode()))
    monitor.check()
    sys.stdout.write(summary)
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        # The existing managed host records failures and performs finite cleanup.
        sys.stderr.write(json.dumps(dict(status="failed_closed",errorType=type(error).__name__,
            error=str(error)[:8192],automaticRetries=0))+"\n")
        raise SystemExit(1)



