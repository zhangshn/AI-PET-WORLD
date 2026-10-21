"""Read-only algebra on bound saved FP32 gradients. No model/profile imports.

The caller must enforce wall/RSS/cleanup through existing runOwnedWorker. This
driver does not launch or kill processes and does not establish authorization.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import stat
import time
import types

HERE = Path(__file__).absolute().parent
ROOT = HERE.parents[2]
AUDIT_ROOT = ROOT / ".runtime/ai-painter/controller-repair-reviews/parameter90-review-20261019"
RUN_ID = "decode1-entry-completion-v2-079d72e9-1a7e-4c2c-84a3-767836b72fe1"
RUN = ".runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/" + RUN_ID
LABELS = ["actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure"]
TARGET = "core.core.final_rgb_decoder.base.layers.4.weight"
PINNED_INVENTORY_SHA = "ac92cc9200c31d8360eacea623de9e364a98608674b2d63ad2b53984aefbd8c0"
LOADER_PATH = "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py"
LOADER_SHA = "6363c4065b9dbec4376594d56664d6c0ecfdb395df61879f9045b2e75cb9e153"
LIMITS = {"cpuThreads": 2, "cpuAffinityMaximum": 2, "maxWallSecondsIncludingStartup": 120,
          "maxRssMiB": 1536, "maxOutputMiB": 8, "maxSingleJsonMiB": 2,
          "failureReserveBytes": 65536, "archiveReadMaximumBytes": 67108864,
          "decodedMaximumBytesIncludingArchiveMetadata": 67108864,
          "attempts": 1, "automaticRetries": 0}
MANIFEST_KEYS = {"archiveEncoding", "artifacts", "capturedAtUtc", "context", "decompressedBytes",
                 "executionBinding", "gradients", "graph", "labels", "missing", "networks",
                 "nonfiniteTensorKeys", "qualificationAllowed", "replayAllowed", "rng", "schema",
                 "stateTiming", "status", "tensorDescriptors"}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def binding_bytes(raw, binding, maximum):
    require(type(raw) is bytes and len(raw) <= maximum, "bound read budget exceeded")
    require(type(binding) is dict and set(binding) in ({"path", "sha256"}, {"path", "sha256", "bytes"}),
            "unknown binding structure")
    require(type(binding["sha256"]) is str and re.fullmatch(r"[0-9a-f]{64}", binding["sha256"]), "invalid SHA")
    require(digest(raw) == binding["sha256"], "binding SHA differs: " + binding["path"])
    require("bytes" not in binding or type(binding["bytes"]) is int and len(raw) == binding["bytes"],
            "binding size differs")
    return raw



def plain_physical(path):
    """Reject redirection in every physical component, not just the leaf."""
    for item in (path, *path.parents):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        require(not stat.S_ISLNK(info.st_mode) and not (getattr(info, "st_file_attributes", 0) & 0x400),
                "physical path redirection")


def safe_path(root, logical):
    require(type(logical) is str and logical and len(logical) <= 4096
            and "\\" not in logical and ":" not in logical and not logical.startswith("/")
            and not re.search(r"[\x00-\x1f\x7f]", logical)
            and all(p not in ("", ".", "..") for p in logical.split("/")), "unsafe logical input/output path")
    root = Path(os.path.abspath(root))
    plain_physical(root)
    parts = logical.split("/")
    if parts[0] == ".runtime":
        default = "D:/AI-PET-WORLD-DATA" if os.name == "nt" else str(root / ".ai-pet-world-data")
        data = Path(os.environ.get("AI_PET_WORLD_DATA_ROOT", default))
        require(data.is_absolute(), "storage data root must be absolute")
        physical = Path(os.path.abspath(data / "hot/runtime"))
        plain_physical(physical)
        require(physical.is_dir(), "formal physical runtime absent")
        mapped = root / ".runtime"
        require(mapped.exists() and mapped.resolve() == physical, "formal runtime mapping differs")
        result = physical.joinpath(*parts[1:])
    else:
        result = root.joinpath(*parts)
    plain_physical(result)
    return result


def read_bound(root, binding, maximum):
    logical = binding.get("path")
    require(type(logical) is str and not Path(logical).is_absolute() and ".." not in Path(logical).parts
            and "\\" not in logical, "unsafe logical input path")
    path = safe_path(root, logical)
    require(not path.is_symlink() and path.is_file(), "regular bound file required")
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        require(before.st_size <= maximum, "bound file too large")
        raw = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
    require(identity(before) == identity(after) == identity(path.stat()), "bound input changed while reading")
    require(safe_path(root, logical) == path, "binding mapping changed while reading")
    return binding_bytes(raw, binding, maximum)


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def load_archive_module(root=ROOT):
    """Only the pinned stand-alone loader module, never model/training packages."""
    raw = read_bound(root, {"path": LOADER_PATH, "sha256": LOADER_SHA}, 1024**2)
    name = "parameter90_pinned_archive_loader_v4"
    module = types.ModuleType(name)
    module.__file__ = str(root / LOADER_PATH)
    sys.modules[name] = module
    exec(compile(raw, module.__file__, "exec"), module.__dict__)
    return module


def validate_metadata(manifest, graph, loader):
    require(type(manifest) is dict and set(manifest) == MANIFEST_KEYS, "unknown/missing manifest structure")
    require(manifest["schema"] == "object-support-structure-gradient-failure-capture-v1"
            and manifest["archiveEncoding"] == "gzip-torch-flat-cpu-v1", "unknown capture protocol")
    require(type(graph) is list and graph == manifest["graph"] and len(graph) == 108
            and len({p["name"] for p in graph}) == 108, "108 graph identity differs")
    require(all(set(p) == {"name", "shape", "dtype", "elements"} and p["dtype"] == "torch.float32"
                and type(p["shape"]) is list and all(type(n) is int and n > 0 for n in p["shape"])
                and math.prod(p["shape"]) == p["elements"] for p in graph)
            and sum(p["elements"] for p in graph) == 2242687, "parameter graph dimensions differ")
    require(graph[90] == {"name": TARGET, "shape": [3, 48, 1, 1], "dtype": "torch.float32", "elements": 144},
            "parameter90 identity differs")
    require(manifest["labels"] == LABELS and len(manifest["gradients"]) == 5
            and [g["label"] for g in manifest["gradients"]] == LABELS, "five gradient labels/order differ")
    require(all(set(g) == {"label", "parameters"} and all(set(r) == {"index", "name", "unused", "key"}
                for r in g["parameters"]) for g in manifest["gradients"]), "unknown gradient row structure")
    descriptor_keys = {"shape", "dtype", "bytes", "sha256", "sourceDevice", "sourceVersion", "capturedAtUtc", "allFinite"}
    require(all(set(d) == descriptor_keys for d in manifest["tensorDescriptors"].values()), "unknown tensor descriptor structure")
    require(manifest["status"] == "captured" and manifest["stateTiming"] == "after_exception"
            and manifest["missing"] == [] and manifest["nonfiniteTensorKeys"] == []
            and all(d.get("allFinite") is True for d in manifest["tensorDescriptors"].values()),
            "incomplete/nonfinite saved evidence")
    loader.validate_manifest(manifest)
    require(sum(d["bytes"] for d in manifest["tensorDescriptors"].values()) == manifest["decompressedBytes"],
            "declared tensor byte total differs")


def tolerance_from_source(raw):
    constants = {}
    for node in ast.parse(raw.decode("utf-8-sig")).body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ("TOTAL_GRADIENT_ATOL", "TOTAL_GRADIENT_RTOL"):
                    constants[target.id] = ast.literal_eval(node.value)
    require(constants == {"TOTAL_GRADIENT_ATOL": 1e-6, "TOTAL_GRADIENT_RTOL": 1e-5}, "original tolerances differ")
    return constants["TOTAL_GRADIENT_ATOL"], constants["TOTAL_GRADIENT_RTOL"]


def audit_gradients(manifest, tensors, torch, *, check_resource=lambda: None):
    """Original FP32 gate; finite failures and overflow remain separate observations."""
    require(torch.get_num_threads() <= 2 and not torch.cuda.is_initialized(), "CPU-only two-thread execution required")
    rows, failures, total_failed = [], [], 0
    for index, parameter in enumerate(manifest["graph"]):
        check_resource()
        values = []
        for group in manifest["gradients"]:
            row = group["parameters"][index]
            value = torch.zeros(parameter["shape"], dtype=torch.float32) if row["unused"] else tensors[row["key"]]
            require(type(value) is torch.Tensor and value.device.type == "cpu" and value.dtype == torch.float32
                    and list(value.shape) == parameter["shape"] and not value.requires_grad
                    and bool(torch.isfinite(value).all()), "saved gradient shape/device/dtype/finite differs")
            values.append(value)
        actual, structured, whole, core, support = values
        first_sum = structured.float() + whole.float()
        second_sum = first_sum.float() + core.float()
        expected = second_sum.float() + support.float()
        finite = torch.isfinite(expected)
        close = finite & torch.isclose(actual, expected, atol=1e-6, rtol=1e-5, equal_nan=False)
        summed64 = ((structured.double() + whole.double()) + core.double()) + support.double()
        require(bool(torch.isfinite(summed64).all()), "saved value FP64 sum became nonfinite")
        residual = actual.double() - expected.double()
        tolerance = (torch.full_like(expected, 1e-6) + 1e-5 * expected.abs()).double()
        ratio = residual.abs() / tolerance
        failed_count = int((~close).sum())
        nonfinite_count = int((~finite).sum())
        finite_bad_count = int((finite & ~close).sum())
        # Counts cover every element. Only location detail is capped, never the scan.
        sampled = (~close).reshape(-1).nonzero().reshape(-1)[:64].tolist()
        total_failed += failed_count
        finite_ratios = torch.where(finite, ratio, torch.full_like(ratio, -1))
        worst = int(finite_ratios.reshape(-1).argmax()) if bool(finite.any()) else None

        def number(value):
            result = float(value)
            return result if math.isfinite(result) else None

        def finite_max(value):
            valid = value[torch.isfinite(value)]
            return float(valid.max()) if valid.numel() else None

        def point(flat):
            if flat is None:
                return None
            remainder, coordinate = flat, []
            for dimension in reversed(parameter["shape"]):
                coordinate.append(remainder % dimension)
                remainder //= dimension
            numbers = {label: float(value.reshape(-1)[flat]) for label, value in zip(LABELS, values)}
            g64, g32 = float(summed64.reshape(-1)[flat]), float(expected.reshape(-1)[flat])
            abs_sum = sum(abs(numbers[label]) for label in LABELS[1:])
            return {"flatIndex": flat, "coordinate": list(reversed(coordinate)), "components": numbers,
                    "classification": ("finite_within_tolerance" if bool(close.reshape(-1)[flat]) else
                                       "finite_tolerance_exceeded" if bool(finite.reshape(-1)[flat]) else "nonfinite_ordered_fp32_sum"),
                    "expectedOrderedFp32": number(g32), "savedComponentSumFp64": g64,
                    "actualMinusOrderedFp32": number(residual.reshape(-1)[flat]),
                    "originalFp32Tolerance": number(tolerance.reshape(-1)[flat]),
                    "residualToleranceRatio": number(ratio.reshape(-1)[flat]),
                    "fp32SumMinusSavedValueFp64Sum": number(g32 - g64),
                    "actualMinusSavedValueFp64Sum": numbers["actualTotal"] - g64,
                    "componentAbsoluteSum": abs_sum,
                    "cancellationRatio": abs_sum / abs(g64) if g64 != 0 else None,
                    "cancellationStatus": "zero_saved_component_sum" if g64 == 0 else "finite_saved_value_ratio"}

        result = {"parameterIndex": index, "name": parameter["name"], "shape": parameter["shape"],
                  "passesOriginalGate": failed_count == 0, "failureCount": failed_count,
                  "nonfiniteOrderedSumCount": nonfinite_count, "finiteToleranceFailureCount": finite_bad_count,
                  "nonfiniteIntermediateCounts": [int((~torch.isfinite(v)).sum()) for v in (first_sum, second_sum, expected)],
                  "failureFlatIndices": sampled, "failureLocationsTruncated": failed_count > len(sampled),
                  "firstFailure": point(sampled[0] if sampled else None),
                  "worstResidualTolerancePoint": point(worst),
                  "maxFiniteAbsResidual": finite_max(residual.abs()),
                  "maxFiniteResidualToleranceRatio": finite_max(ratio),
                  "maxFiniteAbsFp32SumMinusSavedValueFp64Sum": finite_max((expected.double() - summed64).abs()),
                  "maxAbsActualMinusSavedValueFp64Sum": float((actual.double() - summed64).abs().max())}
        if index == 90:
            result["failingElementDetails"] = [point(flat) for flat in sampled]
        rows.append(result)
        if failed_count:
            failures.append(index)
    return {"parameterCount": len(rows), "firstFailingParameter": failures[0] if failures else None,
            "allFailingParameters": failures, "totalFailedElements": total_failed, "parameters": rows,
            "parameter90": rows[90] if len(rows) > 90 else None, "allPassOriginalGate": not failures,
            "locationDetailLimitPerParameter": 64,
            "fp64Meaning": "FP64 sum of saved FP32 component gradients only, not an independently computed high-precision model gradient reference"}


def verify_documents(docs):
    plan, identity, terminal = (docs[k] for k in ("quality-plan.json", "model-identity.json", "worker-terminal.json"))
    manifest, primary, capture = (docs[k] for k in ("manifest.json", "primary.json", "capture-execution.json"))
    context = manifest["context"]
    require(context == primary["context"] and context["runId"] == plan["runId"] == terminal["runId"] == capture["runId"] == RUN_ID,
            "failure Run/context identity differs")
    require(plan["packageId"] == terminal["packageId"] and manifest["graph"] == identity["graph"], "model/package identity differs")
    require(context["modelBinding"] == plan["modelBinding"] == capture["modelBinding"]
            and context["programBindings"] == plan["programBindings"] == capture["programBindings"], "capture binding differs")
    require(context["failurePosition"] == terminal["failurePosition"] == {"epoch": 15, "zeroBasedEpochPosition": 8,
            "trainIndex": 28, "sampleId": "ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2"}
            and context["optimizerSteps"] == terminal["optimizerSteps"] == {"generator": 680, "discriminator": 681},
            "failure position/counts differ")
    require(terminal["originalError"] == primary["primaryError"] == terminal["captureReceipt"]["primaryError"]
            and terminal["originalError"]["message"] == "actual four-term total gradient identity differs at parameter 90",
            "original error differs")
    require(context["split"] == "train" and context["sampleId"] == context["failurePosition"]["sampleId"], "sample identity differs")


def recorded_failure_comparison(result):
    # A valid negative/non-reproducing observation must survive as evidence.
    confirmed = result["firstFailingParameter"] == 90
    return {"recordedFailureComparison": "recorded_failure_confirmed" if confirmed else "evidence_disagrees_with_recorded_failure",
            "recordedFailureConfirmed": confirmed, "recordedFirstFailingParameter": 90,
            "observedFirstFailingParameter": result["firstFailingParameter"]}


def policy_check(policy, inventory):
    require(type(policy) is dict and policy.get("schemaVersion") == "ai-painter-saved-gradient-algebra-cpu-policy-v4",
            "registered parameter90 policy schema required")
    inventory_binding = {"path": (AUDIT_ROOT / "registration-inputs-v4.json").relative_to(ROOT).as_posix(),
                         "sha256": PINNED_INVENTORY_SHA}
    require(policy.get("registrationInputs") == inventory_binding, "registration input binding differs")
    require(policy.get("runId") == RUN_ID and policy.get("scope") == "saved_gradient_algebra_only"
            and all(policy.get("resources", {}).get(k) == v for k, v in LIMITS.items()),
            "policy exact input/scope/resources differ")
    require(policy.get("outputRoot") == (AUDIT_ROOT / "attempt-001").relative_to(ROOT).as_posix()
            and policy.get("formalSpecification", {}).get("version") == "AI-PAINTER-SPEC-1.100",
            "policy output or specification differs")
    require(policy.get("target") == {"parameterIndex": 90, "name": TARGET, "shape": [3, 48, 1, 1]}
            and policy.get("comparison", {}).get("atol") == 1e-6
            and policy.get("comparison", {}).get("rtol") == 1e-5, "policy target/comparison differs")
    programs = policy.get("programBindings")
    require(type(programs) is dict and set(programs) == {"driver", "tests"}, "driver/tests bindings required")
    require(programs["driver"]["path"] == Path(__file__).absolute().relative_to(ROOT).as_posix()
            and programs["tests"]["path"] == (ROOT / "ml/ai-painter/tests/test_saved_gradient_algebra_cpu_v4.py").relative_to(ROOT).as_posix(),
            "driver/tests path differs")
    require(inventory.get("minimalSourceBindings", {}).get("boundedArchiveLoader", {}).get("path") == LOADER_PATH
            and inventory["minimalSourceBindings"]["boundedArchiveLoader"]["sha256"] == LOADER_SHA,
            "registered loader and executable constant differ")
    return {**programs, **inventory["minimalSourceBindings"]}


def main():
    started = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--policy-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--deadline-unix-ms", type=int, required=True)
    args = parser.parse_args()
    require(Path(args.project).is_absolute() and Path(args.project).absolute() == ROOT, "exact project root required")
    requested_output = Path(args.output)
    require(requested_output.is_absolute() and requested_output.absolute() == AUDIT_ROOT / "attempt-001", "exact attempt output directory required")
    output_logical = requested_output.relative_to(ROOT).as_posix()
    output_root = safe_path(ROOT, output_logical)
    require(0 < args.deadline_unix_ms - time.time_ns() // 1000000 <= 120000, "deadline outside120s budget")
    require(args.policy == "data/ai-painter/system-governance/ai-painter-saved-gradient-algebra-cpu-policy-v4.json", "exact formal policy required")
    policy_binding = {"path": args.policy, "sha256": args.policy_sha256}
    policy = strict_json(read_bound(ROOT, policy_binding, 2 * 1024**2))
    inventory_path = (AUDIT_ROOT / "registration-inputs-v4.json").relative_to(ROOT).as_posix()
    inventory = strict_json(read_bound(ROOT, {"path": inventory_path, "sha256": PINNED_INVENTORY_SHA}, 2 * 1024**2))
    programs = policy_check(policy, inventory)
    for binding in programs.values():
        read_bound(ROOT, binding, 1024**2)
    interpreter = policy.get("interpreter")
    require(type(interpreter) is dict and set(interpreter) == {"absolutePath", "sha256"}
            and Path(interpreter["absolutePath"]).absolute() == Path(sys.executable).absolute(), "interpreter path differs")
    with Path(sys.executable).open("rb") as stream:
        require(digest(stream.read(16 * 1024**2 + 1)) == interpreter["sha256"], "interpreter SHA differs")
    tolerance_from_source(read_bound(ROOT, programs["originalToleranceReadOnlySource"], 1024**2))
    # All pinned metadata/code checks precede this attempt's exclusive output claim.
    output_root.mkdir(exist_ok=False)
    output_identity = (output_root.stat().st_dev, output_root.stat().st_ino)
    import psutil
    process = psutil.Process()
    allowed = process.cpu_affinity()
    require(bool(allowed), "empty allowed CPU affinity")
    process.cpu_affinity(allowed[:2])
    require(len(process.cpu_affinity()) <= 2, "caller must set CPU affinity<=2 before Python startup")
    import torch
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    require(not torch.cuda.is_initialized(), "CUDA already initialized")
    peak = [0]

    def resource():
        rss = process.memory_info().rss
        peak[0] = max(peak[0], rss)
        require(time.monotonic() - started <= 120 and time.time_ns() // 1000000 <= args.deadline_unix_ms
                and rss <= 1536 * 1024**2, "CPU wall/RSS resource bound exceeded")
        require(not torch.cuda.is_initialized(), "CUDA became initialized")

    docs = {}
    archive_binding = None
    for binding in inventory["inputs"]:
        if binding["path"].endswith("/tensors.pt"):
            archive_binding = binding
        else:
            docs[Path(binding["path"]).name] = strict_json(read_bound(ROOT, binding, 2 * 1024**2))
        resource()
    verify_documents(docs)
    manifest = docs["manifest.json"]
    for source in inventory["minimalSourceBindings"].values():
        require(any(value["path"] == source["path"] and value["sha256"] == source["sha256"]
                    for value in manifest["context"]["programBindings"].values()),
                "minimal audit source does not belong to failed execution")
    loader = load_archive_module()
    validate_metadata(manifest, docs["model-identity.json"]["graph"], loader)
    require(archive_binding == manifest["artifacts"]["tensors"] == docs["worker-terminal.json"]["captureReceipt"]["artifacts"]["tensors"],
            "archive cross-binding differs")
    raw = read_bound(ROOT, archive_binding, 64 * 1024**2)
    resource()
    tensors = loader.safe_load_bytes(raw, archive_binding["sha256"], manifest)
    del raw
    resource()
    result = audit_gradients(manifest, tensors, torch, check_resource=resource)
    report = {"schema": "parameter90-saved-gradient-cpu-algebra-result-v4", "status": "saved_gradient_algebra_review_completed",
              **recorded_failure_comparison(result),
              "policy": policy_binding, "inputs": inventory["inputs"], "programBindings": programs,
              "runId": RUN_ID, "result": result, "bindingChecksPassed": True,
              "resourceObservation": {"secondsFromMainEntry": time.monotonic() - started, "sampledPeakRssBytes": peak[0],
                    "cpuAffinity": process.cpu_affinity(), "torchThreads": torch.get_num_threads()},
              "modelForwards": 0, "autogradCalls": 0, "optimizerSteps": 0, "cudaInitialized": False,
              "modelStatesInstalled": False, "historicalReplay": False, "rootCauseProven": False, "qualificationGranted": False}
    output = output_root / "real-cpu-algebra-result-v4.json"
    payload = (json.dumps(report, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode()
    require(len(payload) <= 2 * 1024**2 and len(payload) + 65536 <= 8 * 1024**2, "result output budget exceeded")
    resource()
    require(safe_path(ROOT, output_logical) == output_root
            and (output_root.stat().st_dev, output_root.stat().st_ino) == output_identity, "output directory changed")
    require(safe_path(ROOT, output_logical + "/" + output.name) == output, "output path changed")
    with output.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    resource()
    require(safe_path(ROOT, output_logical) == output_root
            and (output_root.stat().st_dev, output_root.stat().st_ino) == output_identity, "output directory changed after write")
    print(json.dumps({"result": str(output), "sha256": digest(payload), "bytes": len(payload),
                      "firstFailingParameter": result["firstFailingParameter"], "allFailingParameters": result["allFailingParameters"]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Existing managed caller retains stderr/exit status; no new cleanup system.
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__, "error": str(error)[:2048]}), file=sys.stderr)
        raise SystemExit(1)
