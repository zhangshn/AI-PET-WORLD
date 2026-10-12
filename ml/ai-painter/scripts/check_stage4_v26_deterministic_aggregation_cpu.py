"""One immutable CPU-only successor check, not a training/GPU entry."""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
for directory in ("src", "scripts", "tests"):
    sys.path.insert(0, str(ROOT / "ml/ai-painter" / directory))
import torch
import diagnose_stage4_v26_gpu_repeat as diagnosis
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    AGGREGATION_RULE, ARCHITECTURE, CAPABILITY,
    build_fresh_object_feature_aggregation_v26_v2_cpu,
)

DIAG_ROOT = (".runtime/ai-painter/stage4-mvp256-dry-v26-executions/gpu-repeat-diagnostics/"
             "v26-repeat-47c49d362a2bd827b9adcfca421643b1")
DIAG_ORDER = {"path": DIAG_ROOT + "/workorder.json",
              "sha256": "1263a535ee309eb7fa43816aa72f3a117d63c81662ea17e34caa71c001800c5b"}
DIAG_REPORT = {"path": DIAG_ROOT + "/report.json",
               "sha256": "a15bde6fe3b715b2d602953885a35284ce5051d13cbf6721bc7caccf039cc44d"}
PROGRAMS = (
    "ml/ai-painter/src/ai_painter/complete_world/object_feature_aggregation_v26_v2_cpu.py",
    "ml/ai-painter/tests/test_object_feature_aggregation_v26_v2_cpu.py",
    "ml/ai-painter/tests/test_object_head_train_dropout_v25_cpu.py",
    "ml/ai-painter/scripts/check_stage4_v26_deterministic_aggregation_cpu.py",
)
OUTPUT = ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/deterministic-aggregation-v2"
SCOPE = {"cpuThreads": 2, "maxWallSeconds": 180, "maxOutputBytes": 16 * 1024**2,
         "attempts": 1, "automaticRetries": 0, "trainRows": 1,
         "optimizerSteps": 0, "gpuAllowed": False, "trainingAllowed": False}
require = diagnosis.require
bind = diagnosis.bind
read = diagnosis.read


def exclusive(path, value):
    target = diagnosis.q.core.cpu.project_file(ROOT, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf8")
    used = sum(item.stat().st_size for item in target.parent.iterdir() if item.is_file())
    require(used + len(raw) <= SCOPE["maxOutputBytes"], "CPU output cap exceeded")
    with target.open("xb") as stream:
        stream.write(raw)
    return bind(path)


def prepare():
    old = diagnosis.check_workorder(DIAG_ORDER)
    report = read(DIAG_REPORT)
    require(report["status"] == "completed_diagnostic_only_not_qualification",
            "completed numeric diagnostic required")
    programs = dict(old["programBindings"])
    for path in PROGRAMS:
        programs[path] = bind(path)
    order = {"schemaVersion": "ai-painter-v26-deterministic-aggregation-cpu-workorder-v1",
             "status": "inactive_cpu_successor_only", "scope": SCOPE,
             "diagnosticWorkorder": DIAG_ORDER, "diagnosticReport": DIAG_REPORT,
             "programBindings": programs, "capabilityVersion": CAPABILITY,
             "architectureId": ARCHITECTURE, "aggregationRule": AGGREGATION_RULE,
             "formalSpecification": old["formalSpecification"],
             "registry": old["registry"], "sample": old["sample"],
             "workspaceBaseline": subprocess.run(["git", "status", "--short"], cwd=ROOT,
                 capture_output=True, text=True, check=True).stdout.splitlines()}
    identity = diagnosis.hashlib.sha256(diagnosis.canonical(order)).hexdigest()[:24]
    order["workorderId"] = "v26-assembly-v2-cpu-" + identity
    order["outputDirectory"] = OUTPUT + "/" + order["workorderId"]
    return exclusive(order["outputDirectory"] + "/workorder.json", order)


def check(binding):
    order = read(binding)
    require(order.get("schemaVersion") == "ai-painter-v26-deterministic-aggregation-cpu-workorder-v1"
            and order.get("status") == "inactive_cpu_successor_only"
            and order.get("scope") == SCOPE and order.get("capabilityVersion") == CAPABILITY
            and order.get("architectureId") == ARCHITECTURE
            and order.get("aggregationRule") == AGGREGATION_RULE
            and order.get("diagnosticWorkorder") == DIAG_ORDER
            and order.get("diagnosticReport") == DIAG_REPORT,
            "inactive CPU-only successor scope differs")
    old = diagnosis.check_workorder(order["diagnosticWorkorder"])
    read(order["diagnosticReport"])
    require(order["formalSpecification"] == old["formalSpecification"]
            and order["registry"] == old["registry"] and order["sample"] == old["sample"],
            "CPU evidence inputs differ")
    require(all(order["programBindings"].get(key) == source
                for key, source in old["programBindings"].items())
            and all(order["programBindings"].get(path) == bind(path) for path in PROGRAMS),
            "CPU successor program roles missing or changed")
    for source in order["programBindings"].values():
        raw = diagnosis.q.core.cpu.project_file(ROOT, source["path"]).read_bytes()
        require(diagnosis.hashlib.sha256(raw).hexdigest() == source["sha256"],
                "CPU bound program changed: " + source["path"])
    require(binding["path"] == order["outputDirectory"] + "/workorder.json"
            and order["outputDirectory"].startswith(OUTPUT + "/v26-assembly-v2-cpu-"),
            "CPU output namespace differs")
    return order, old


def compare_real_train(order, old_order):
    base, profile = diagnosis.q.base, diagnosis.q.base.v24
    reader = profile.core.cpu.BoundReader(ROOT)
    package = reader.json(old_order["failedExecutionPackage"])
    manifest = reader.json(package["datasetManifest"])
    require(manifest["splitCounts"] == {"train": 48, "validation": 8,
                                       "challenge": 4, "regression": 4}, "split counts changed")
    channel_order = list(manifest["identityPayload"]["channelOrder"])
    continuous = set(manifest["identityPayload"]["continuousChannelIds"])
    require(order["sample"]["split"] == "train", "only one bound train row allowed")
    sample, identity = profile.core.cpu.load_sample(reader, order["sample"], channel_order, continuous)
    instances = deepcopy(sample["objectInstanceTable"])
    source = {key: profile.core.cpu.tensor_hash(sample[key]) for key in ("conditions", "image")}
    backend = diagnosis.backend()
    warn_only = torch.is_deterministic_algorithms_warn_only_enabled()
    rng = torch.get_rng_state().clone()
    with base._preserve_global_rng():
        original, critic = diagnosis.q.worker.fresh_networks(channel_order)
        successor = build_fresh_object_feature_aggregation_v26_v2_cpu(condition_channel_order=channel_order)
        require(tuple(original.state_dict()) == tuple(successor.state_dict())
                and all(torch.equal(value, successor.state_dict()[key])
                        for key, value in original.state_dict().items()), "fresh state identity changed")
        before = {"Model": profile.core.cpu.state_hash(successor),
                  "Critic": profile.core.cpu.state_hash(critic)}
        values = []
        for model in (original, successor):
            model.train(); critic.eval().requires_grad_(False)
            def forward(_kind, bound):
                require(bound["split"] == "train", "nontrain gradients prohibited")
                return model(bound["conditions"][None], bound["objectInstanceTable"])
            prediction, loss, _, gradients, facts = profile.generator_candidate_for_sample(
                model, critic, sample, channel_order, forward, "training")
            require(bool(torch.isfinite(loss)) and facts["autogradGradCalls"] == 4
                    and all(value > 0 for value in facts["generatorGradientFacts"]["headCandidateL2"].values())
                    and len(gradients) == 106
                    and all(value is not None and bool(torch.isfinite(value).all()) for value in gradients),
                    "complete real train generator gradient path invalid")
            critic.train().requires_grad_(True)
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(20260929)
                d_loss, _ = profile.core.gpu.detached_discriminator_objective(critic, prediction.detach(), sample)
                d_grad = torch.autograd.grad(d_loss, tuple(critic.parameters()), allow_unused=True)
            require(all(value is not None and bool(torch.isfinite(value).all()) for value in d_grad)
                    and any(bool(value.count_nonzero()) for value in d_grad), "critic gradient path invalid")
            values.append((prediction.detach(), loss.detach(), gradients, facts, d_loss.detach(), d_grad))
        left, right = values
        require(torch.equal(left[0], right[0]) and torch.equal(left[1], right[1])
                and all(torch.equal(a, b) for a, b in zip(left[2], right[2]))
                and left[3] == right[3] and torch.equal(left[4], right[4])
                and all(torch.equal(a, b) for a, b in zip(left[5], right[5])),
                "CPU full objective or generator/critic gradients changed")
        require(before == {"Model": profile.core.cpu.state_hash(successor),
                           "Critic": profile.core.cpu.state_hash(critic)}
                and profile.core.cpu.state_hash(original) == before["Model"]
                and all(parameter.grad is None for model in (original, successor, critic)
                        for parameter in model.parameters()), "zero-update weights or grad fields changed")
        result = {"sample": identity, "objectCount": len(instances),
                  "modelStateSha256": before["Model"], "criticStateSha256": before["Critic"],
                  "exactCpuRgb": True, "exactCpuCompleteLoss": True,
                  "exactAll106GeneratorGradientTensors": True, "exactCriticGradients": True,
                  "generatorLoss": float(right[1]), "criticLoss": float(right[4]),
                  "headGradientL2": right[3]["generatorGradientFacts"]["headCandidateL2"],
                  "actualAutogradCalls": 10, "actualTrainModelForwards": 2,
                  "optimizerSteps": 0, "sourceTensorsAndInstancesUnchanged": True,
                  "rngAndBackendRestored": True, "weightsUnchanged": True,
                  "all48GpuCasesCompleted": False}
    require(source == {key: profile.core.cpu.tensor_hash(sample[key]) for key in source}
            and instances == sample["objectInstanceTable"]
            and torch.equal(rng, torch.get_rng_state()) and backend == diagnosis.backend()
            and warn_only == torch.is_deterministic_algorithms_warn_only_enabled(),
            "CPU source/RNG/backend restoration differs")
    reader.unchanged()
    return result


def worker(binding):
    started = time.monotonic()
    order, old_order = check(binding)
    require(not torch.cuda.is_initialized(), "CUDA already initialized")
    torch.set_num_threads(2)
    log = io.StringIO()
    with (diagnosis.no_model_side_effects(),
          patch.object(torch.cuda, "_lazy_init", side_effect=RuntimeError("GPU prohibited")),
          patch.object(torch.cuda, "is_available", side_effect=RuntimeError("GPU prohibited")),
          patch.object(torch.Tensor, "backward", side_effect=RuntimeError("grad accumulation prohibited"))):
        suite = unittest.defaultTestLoader.loadTestsFromName("test_object_feature_aggregation_v26_v2_cpu")
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
        require(result.wasSuccessful() and result.testsRun == 13 and not result.skipped,
                "CPU tests failed: " + log.getvalue())
        facts = compare_real_train(order, old_order)
    check(binding)
    require(not torch.cuda.is_initialized(), "CPU check initialized CUDA")
    return {"schemaVersion": "ai-painter-v26-deterministic-aggregation-cpu-report-v1",
            "status": "cpu_successor_verified_not_gpu_or_execution_qualified", "workorder": binding,
            "capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
            "aggregationRule": AGGREGATION_RULE, "unitTestsPassed": result.testsRun,
            "unitTestsFailed": 0, "unitTestsLog": log.getvalue(), "realTrainComparison": facts,
            "programBindings": order["programBindings"], "scope": SCOPE,
            "gpuInitialized": False, "trainingStarted": False, "formalStage4Qualified": False,
            "executionRegistryWritten": False, "oldProgramsRehashedUnchanged": True,
            "remaining": ["independent CPU evidence review", "immutable successor lifecycle bindings",
                          "own complete 48-row GPU admission", "bounded training and frozen review"],
            "elapsedSeconds": time.monotonic() - started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}


def execute(binding):
    order, _ = check(binding)
    root = order["outputDirectory"]
    exclusive(root + "/cpu-claim.json", {"status": "consumed_once_no_retry", "workorder": binding,
        "processId": os.getpid(), "scope": SCOPE,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    started = time.monotonic()
    try:
        outcome = subprocess.run([sys.executable, str(ROOT / PROGRAMS[-1]), "--worker",
            binding["path"], "--sha256", binding["sha256"]], cwd=ROOT,
            capture_output=True, text=True, encoding="utf8", timeout=SCOPE["maxWallSeconds"],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        require(len(outcome.stdout.encode("utf8")) + len(outcome.stderr.encode("utf8"))
                <= SCOPE["maxOutputBytes"] // 2, "CPU transcript cap exceeded")
        exclusive(root + "/worker-transcript.json", {"returnCode": outcome.returncode,
            "stdout": outcome.stdout, "stderr": outcome.stderr})
        require(outcome.returncode == 0, "CPU worker failed: " + outcome.stderr[-4000:])
        report = json.loads(outcome.stdout)
        require(report.get("workorder") == binding
                and report.get("status") == "cpu_successor_verified_not_gpu_or_execution_qualified"
                and report.get("unitTestsPassed") == 13 and report.get("unitTestsFailed") == 0
                and report.get("gpuInitialized") is False and report.get("trainingStarted") is False,
                "CPU worker evidence boundary differs")
        check(binding)
        report["supervisorElapsedSeconds"] = time.monotonic() - started
        return exclusive(root + "/report.json", report)
    except Exception as error:
        exclusive(root + "/failure.json", {"status": "cpu_successor_check_failed_closed",
            "workorder": binding, "error": str(error), "gpuAllowed": False,
            "trainingStarted": False, "optimizerSteps": 0,
            "elapsedSeconds": time.monotonic() - started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--prepare", action="store_true")
    group.add_argument("--execute")
    group.add_argument("--worker")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.prepare:
        result = prepare()
    else:
        require(isinstance(args.sha256, str), "exact workorder hash required")
        binding = {"path": args.execute or args.worker, "sha256": args.sha256}
        result = execute(binding) if args.execute else worker(binding)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
