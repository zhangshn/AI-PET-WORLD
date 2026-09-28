"""Future V17 zero-update BF16 GPU probe. Default mode is CPU preflight only.

No candidate contract or formal CPU acceptance is supplied by this program.
All external bindings must match an independently prepared immutable contract.
The numerical CPU probe is explicitly ineligible as formal CPU acceptance.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import check_stage4_mvp_structured_object_v17_cpu_acceptance as cpu

CAPABILITY = "stage4_mvp_native_rgb_structured_object_v17"
CANDIDATE_SCHEMA = "stage4-mvp-native-rgb-structured-object-v17-contract-v1"
CPU_SCHEMA = "stage4-mvp-structured-object-v17-formal-cpu-acceptance-v1"
REPORT_SCHEMA = "stage4-mvp-structured-object-v17-readonly-gpu-report-v1"
PROGRAM_PATH = "ml/ai-painter/scripts/run_stage4_mvp_structured_object_v17_readonly_gpu_qualification.py"
TEST_PATH = "ml/ai-painter/tests/test_stage4_mvp_structured_object_v17_gpu_gate.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-structured-object-v17-readonly-gpu-qualifications"
TRAIN_ID = "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7"
TRAIN_ORDINAL = 43
SCOPE = {"path": "data/ai-painter/system-governance/stage4-mvp-v17-dry-single-world-scope-v1.json",
         "sha256": "f6e6b9ce2c9da4944e647f60e924a612800ce75da1f2272d809c6afc2c51fdaf"}
SCOPE_VERIFIER = {"path": "scripts/lib/ai-painter-stage4-mvp-v17-dry-scope.mjs",
                  "sha256": "20beab9d53cd493ec2cfd482ec1cc7fea6349699070bfaeaa6a3fddde7eb3379"}
SCOPE_STATUS = "v17_dry_scope_facts_verified_not_execution_qualified"
ROLES = ("terrain_path_ground", "terrain_water", "terrain_shoreline", "object_footprints",
         "object_tree", "object_rock", "object_vegetation")
MODEL_PLAN = {"baseChannels": 48, "patchChannels": 32, "seed": 20260927}
PRECISION_PLAN = {"generatorAutocast": "bfloat16", "discriminatorAutocast": "bfloat16",
                  "parameterDtype": "float32", "gradientScaler": "disabled"}
PROGRAM_PATHS = {
    "readonlyGpuQualification": PROGRAM_PATH, "gpuGateTests": TEST_PATH,
    "model": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_cpu_v17.py",
    "objective": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_objective_cpu_v17.py",
    "discriminator": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_conditional_texture_cpu.py",
    "objectView": "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
    "splitRelease": "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "cpuDataAdapter": cpu.PROGRAM_PATH, "scopeVerifier": SCOPE_VERIFIER["path"],
    "scopeBindingReader": "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs",
    "terrainBackbone": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "instanceObjective": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
    "textureObjective": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_local_texture_objective_v12.py",
    "patchDiscriminator": "ml/ai-painter/src/ai_painter/training/discriminator.py",
}
require = cpu.require


def exact(left, right):
    # Canonical JSON distinguishes true/false from numeric 1/0.
    return cpu.canonical_bytes(left) == cpu.canonical_bytes(right)


def binding(value):
    require(isinstance(value, dict) and set(value) == {"path", "sha256"}, "exact path/SHA binding required")
    require(isinstance(value["sha256"], str) and re.fullmatch(r"[a-f0-9]{64}", value["sha256"]), "invalid binding SHA")
    cpu.project_file(ROOT, value["path"])
    return value


def implementation_identity(candidate):
    # Only the late-bound CPU report is excluded, avoiding a hash cycle. Every
    # other field (including activation, budget and attempt) is CPU-accepted.
    return cpu.sha(cpu.canonical_bytes({key: value for key, value in candidate.items() if key != "cpuAcceptance"}))


def declared_bindings(value):
    """Collect explicit bound files in a contract description, never infer SHAs."""
    result = []
    if isinstance(value, dict):
        if "path" in value or "sha256" in value:
            result.append(binding({"path": value.get("path"), "sha256": value.get("sha256")}))
        for nested in value.values():
            result.extend(declared_bindings(nested))
    elif isinstance(value, list):
        for nested in value:
            result.extend(declared_bindings(nested))
    return result


def validate_gate(candidate, acceptance, *, candidate_binding, cpu_binding, attempt_id, output_root):
    """Pure CPU JSON checks; callers must also recompute every bound source file."""
    binding(candidate_binding)
    binding(cpu_binding)
    require(candidate.get("schemaVersion") == CANDIDATE_SCHEMA
            and candidate.get("capabilityVersion") == CAPABILITY
            and candidate.get("status") == "cpu_candidate_not_execution_qualified", "wrong V17 candidate identity")
    require(candidate.get("activationGates", {}).get("readonlyGpuQualificationAllowed") is True
            and candidate["activationGates"].get("trainingAllowed") is False,
            "read-only GPU activation absent or training active")
    require(exact(candidate.get("modelPlan"), MODEL_PLAN)
            and exact(candidate.get("precisionExecutionPlan"), PRECISION_PLAN), "model or BF16 plan differs")
    require(exact(candidate.get("dryScope"), SCOPE)
            and exact(candidate.get("conditionContract"), cpu.CONDITION_CONTRACT), "scope or condition contract differs")
    dataset = candidate.get("datasetBinding", {})
    require(exact(dataset.get("manifest"), cpu.MANIFEST), "frozen dataset binding differs")
    for key in ("trainSelectionSha256", "validationSelectionSha256"):
        require(isinstance(dataset.get(key), str) and re.fullmatch(r"[a-f0-9]{64}", dataset[key]), "missing selection SHA")
    require(exact(candidate.get("cpuAcceptance"), cpu_binding), "CPU evidence binding differs")
    for field in ("lossContract", "reviewThresholdContract"):
        require(isinstance(candidate.get(field), dict) and declared_bindings(candidate[field]),
                "bound contract file missing: " + field)
    foundation = candidate.get("foundationAssetBinding", {})
    require(type(foundation.get("initializationSeed")) is int
            and foundation["initializationSeed"] == MODEL_PLAN["seed"]
            and foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedCheckpointLoaded") is False
            and foundation.get("checkpointLoaded", False) is False, "fresh foundation boundary differs")
    declared_bindings(foundation)
    attempt = candidate.get("readonlyGpuQualification", {})
    require(isinstance(attempt_id, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,95}", attempt_id)
            and exact(attempt, {"attemptId": attempt_id, "trainSampleId": TRAIN_ID,
                               "trainOrdinal": TRAIN_ORDINAL, "outputRoot": OUTPUT_ROOT})
            and output_root == OUTPUT_ROOT, "attempt, fixed train subject or output namespace differs")
    budget = candidate.get("resourceBudget", {})
    fraction, seconds, threads = budget.get("maxGpuMemoryFraction"), budget.get("maxWallSeconds"), budget.get("cpuThreads")
    require(type(fraction) in (int, float) and math.isfinite(fraction) and 0 < fraction <= 0.7,
            "VRAM fraction exceeds 70 percent or is invalid")
    require(type(seconds) is int and 1 <= seconds <= 120 and type(threads) is int and 1 <= threads <= 4,
            "wall time or CPU thread limit invalid")
    require(exact({key: budget.get(key) for key in ("sampleCount", "optimizerSteps", "automaticRetries", "checkpointWrites")},
                  {"sampleCount": 1, "optimizerSteps": 0, "automaticRetries": 0, "checkpointWrites": 0}),
            "zero-update resource boundary differs")
    alignments = candidate.get("trainingReviewAlignment", [])
    require(isinstance(alignments, list) and len(alignments) == 7
            and [row.get("responsibilityId") for row in alignments] == list(ROLES)
            and all(row.get("conditionChannelIds") == [role] for row, role in zip(alignments, ROLES)),
            "seven-role alignment missing or reordered")
    programs = candidate.get("programBindings", {})
    for role, path in PROGRAM_PATHS.items():
        require(binding(programs.get(role))["path"] == path, "program path differs: " + role)
    require(exact(programs["scopeVerifier"], SCOPE_VERIFIER), "frozen scope verifier SHA differs")
    formal_program = binding(programs.get("formalCpuAcceptance"))
    require(formal_program["path"] != cpu.PROGRAM_PATH, "numerical probe is not formal CPU acceptance")
    require(acceptance.get("schemaVersion") == CPU_SCHEMA
            and acceptance.get("status") == "cpu_readonly_accepted_execution_disabled"
            and acceptance.get("capabilityVersion") == CAPABILITY
            and acceptance.get("implementationIdentitySha256") == implementation_identity(candidate)
            and exact(acceptance.get("acceptanceProgram"), formal_program), "formal CPU identity/evidence missing")
    for field, expected in {"cpuTestsPassed": True, "optimizerCreated": False, "optimizerSteps": 0,
                            "weightsModified": False, "gpuInitialized": False, "trainingAllowed": False}.items():
        require(exact(acceptance.get(field), expected), "formal CPU boundary differs: " + field)
    for initial, final in (("initialModelStateSha256", "finalModelStateSha256"),
                           ("initialCriticStateSha256", "finalCriticStateSha256")):
        require(isinstance(acceptance.get(initial), str) and re.fullmatch(r"[a-f0-9]{64}", acceptance[initial])
                and acceptance[initial] == acceptance.get(final), "formal CPU network state differs")


def verify_dry_scope(reader):
    reader.read(SCOPE)
    reader.read(SCOPE_VERIFIER)
    code = ("import fs from 'node:fs';import {pathToFileURL} from 'node:url';"
            "const v=JSON.parse(fs.readFileSync(0,'utf8'));"
            "const m=await import(pathToFileURL(v.modulePath).href);"
            "process.stdout.write(JSON.stringify(m.verifyV17DryScope({projectRoot:v.root,scopeBinding:v.binding}))); ")
    result = subprocess.run(["node", "--input-type=module", "-e", code], input=json.dumps({
        "root": str(ROOT), "modulePath": str(cpu.project_file(ROOT, SCOPE_VERIFIER["path"])), "binding": SCOPE}),
        capture_output=True, text=True, timeout=15, check=True)
    value = json.loads(result.stdout)
    require(value.get("status") == SCOPE_STATUS, "scope preflight did not succeed")
    return value


def authenticate(candidate_binding, cpu_binding, attempt_id, output_root):
    reader = cpu.BoundReader()
    candidate = reader.json(binding(candidate_binding))
    acceptance = reader.json(binding(cpu_binding))
    validate_gate(candidate, acceptance, candidate_binding=candidate_binding, cpu_binding=cpu_binding,
                  attempt_id=attempt_id, output_root=output_root)
    for bound in candidate["programBindings"].values():
        reader.read(binding(bound))
    for field in ("lossContract", "reviewThresholdContract", "foundationAssetBinding"):
        for bound in declared_bindings(candidate[field]):
            reader.read(bound)
    scope = verify_dry_scope(reader)
    manifest, order, continuous, _, memberships = cpu.select_rows(reader)
    for split in ("train", "validation"):
        require(memberships[split]["selectionSha256"] == candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen row selection differs: " + split)
    source = reader.json(manifest["sourceIndex"])
    ids = reader.json(manifest["splits"]["train"])["sampleIds"]
    require(ids[TRAIN_ORDINAL] == TRAIN_ID, "fixed GPU sample is not the bound train member")
    row = next(item for item in source["samples"] if item["sampleId"] == TRAIN_ID)
    require(row["split"] == "train", "GPU sample is not train")
    reader.unchanged()
    return reader, candidate, acceptance, scope, order, continuous, row


def positive_train_sample(reader, row, order, continuous):
    require(row.get("sampleId") == TRAIN_ID and row.get("split") == "train", "only fixed positive train content allowed")
    sample, identity = cpu.load_sample(reader, row, order, continuous)
    identity["ordinal"] = TRAIN_ORDINAL
    counts = {role: int((sample["conditions"][order.index(role)] > 0.5).sum()) for role in ROLES}
    require(all(value > 0 for value in counts.values()), "all seven train responsibility masks must be positive")
    return sample, identity, counts


def attempt_directory(attempt_id, output_root):
    require(output_root == OUTPUT_ROOT and isinstance(attempt_id, str)
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,95}", attempt_id), "invalid attempt namespace")
    return cpu.project_file(ROOT, output_root + "/attempt-" + cpu.sha(attempt_id.encode("utf8")))


def write_json(path, value):
    with path.open("x", encoding="utf8") as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def claim_attempt(request):
    directory = attempt_directory(request["attemptId"], request["outputRoot"])
    try:
        directory.mkdir(parents=True, exist_ok=False)
    except FileExistsError as error:
        raise ValueError("qualification attempt already consumed; retry prohibited") from error
    write_json(directory / "claim.json", request)
    return directory


def check_memory(*, total, reserved, allocated, device_used, fraction):
    require(all(type(value) is int and value >= 0 for value in (total, reserved, allocated, device_used))
            and total > 0 and 0 < fraction <= 0.7, "invalid VRAM measurement")
    limit = int(total * fraction)
    require(allocated <= reserved <= limit and device_used <= limit, "VRAM exceeds bound fraction")
    return {"totalBytes": total, "peakReservedBytes": reserved, "peakAllocatedBytes": allocated,
            "sampledDeviceUsedBytes": device_used, "limitBytes": limit}


def gradient_facts(model, device_type):
    import torch
    result = []
    for name, parameter in model.named_parameters():
        require(parameter.device.type == device_type and parameter.grad is not None,
                "parameter device or gradient missing: " + name)
        require(bool(torch.isfinite(parameter.grad).all()), "nonfinite gradient: " + name)
        result.append({"name": name, "absoluteSum": float(parameter.grad.detach().double().abs().sum())})
    require(result and sum(item["absoluteSum"] for item in result) > 0, "all gradients are zero")
    return result


def role_gradient_facts(features, sample, order):
    import torch
    require(set(features) == set(ROLES), "responsibility output keys differ")
    result = {}
    for role in ROLES:
        value = features[role]
        require(value.shape == (1, 8, 192, 256) and bool(torch.isfinite(value).all())
                and value.grad is not None and bool(torch.isfinite(value.grad).all()),
                "responsibility gradient missing/nonfinite: " + role)
        mask = (sample["conditions"][order.index(role)] > 0.5)[None, None].expand_as(value)
        amount = float(value.grad.detach()[mask].double().abs().sum())
        require(amount > 0, "positive responsibility gradient is zero: " + role)
        result[role] = {"shape": list(value.shape), "maskedGradientAbsoluteSum": amount}
    return result


def detached_discriminator_objective(critic, prediction, sample):
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import discriminator_train_objective
    # Enforce isolation at this entry point, independently of objective internals.
    return discriminator_train_objective(critic, prediction.detach(), sample)


def run_cuda(candidate, acceptance, sample, order, report):
    """CUDA is reachable only after outer authentication and exclusive consumption."""
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import build_native_rgb_structured_object_cpu_v17
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

    budget = candidate["resourceBudget"]
    torch.set_num_threads(budget["cpuThreads"])
    torch.manual_seed(MODEL_PLAN["seed"])
    model = build_native_rgb_structured_object_cpu_v17(condition_channel_order=order,
        base_channels=MODEL_PLAN["baseChannels"], patch_channels=MODEL_PLAN["patchChannels"]).eval()
    critic = build_conditional_texture_discriminator().eval()
    initial_model, initial_critic = cpu.state_hash(model), cpu.state_hash(critic)
    require(initial_model == acceptance["initialModelStateSha256"]
            and initial_critic == acceptance["initialCriticStateSha256"], "fresh GPU networks differ from formal CPU states")
    report.update(initialModelStateSha256=initial_model, initialCriticStateSha256=initial_critic)
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    report["gpuInitialized"] = torch.cuda.is_initialized()
    torch.cuda.manual_seed_all(MODEL_PLAN["seed"])
    free, total = torch.cuda.mem_get_info(device)
    fraction = budget["maxGpuMemoryFraction"]
    # Leave baseline device use plus 64 MiB outside the allocator budget.
    # A global device-use check is also made at every measured phase.
    allocator_bytes = int(total * fraction) - (total - free) - 64 * 1024 * 1024
    require(allocator_bytes > 0, "insufficient VRAM below the resource ceiling")
    torch.cuda.set_per_process_memory_fraction(allocator_bytes / total, device)
    report["allocatorBudgetBytes"] = allocator_bytes
    torch.cuda.reset_peak_memory_stats(device)
    memory = []
    report["memoryMeasurements"] = memory

    def measure(phase):
        torch.cuda.synchronize(device)
        available, capacity = torch.cuda.mem_get_info(device)
        observed = {"total": int(capacity), "reserved": int(torch.cuda.max_memory_reserved(device)),
                    "allocated": int(torch.cuda.max_memory_allocated(device)), "device_used": int(capacity - available)}
        memory.append({"phase": phase, "observed": observed})
        measured = check_memory(**observed, fraction=fraction)
        memory[-1].update(measured)

    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("checkpoint load prohibited")):
        model.to(device)
        critic.to(device)
        gpu_sample = {**sample, "image": sample["image"].to(device), "conditions": sample["conditions"].to(device)}
        measure("models_and_sample_loaded")
        with torch.autocast("cuda", dtype=torch.bfloat16):
            prediction, evidence = model(gpu_sample["conditions"][None], sample["objectInstanceTable"], return_evidence=True)
            discriminator_loss, _ = detached_discriminator_objective(critic, prediction, gpu_sample)
        features = {**evidence["terrainResponsibilityFeatures"], **evidence["responsibilityFeatures"]}
        for value in features.values():
            value.retain_grad()
        require(bool(torch.isfinite(prediction).all() and torch.isfinite(discriminator_loss)), "nonfinite BF16 forward")
        measure("discriminator_forward")
        report["discriminatorBackwardCalls"] = 1
        discriminator_loss.backward()
        report["discriminatorGradients"] = gradient_facts(critic, "cuda")
        require(all(parameter.grad is None for parameter in model.parameters()), "discriminator gradients leaked to generator")
        measure("discriminator_backward")
        critic.zero_grad(set_to_none=True)
        critic.requires_grad_(False)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            generator_loss, parts = train_structured_object_objective(
                critic, prediction, gpu_sample, sample["objectInstanceTable"], order)
        require(bool(torch.isfinite(generator_loss)), "nonfinite BF16 generator loss")
        report["generatorBackwardCalls"] = 1
        generator_loss.backward()
        report["generatorGradients"] = gradient_facts(model, "cuda")
        report["responsibilityGradients"] = role_gradient_facts(features, gpu_sample, order)
        require(all(parameter.grad is None for parameter in critic.parameters()), "generator gradients leaked to frozen critic")
        measure("generator_backward")
        report.update(finalModelStateSha256=cpu.state_hash(model), finalCriticStateSha256=cpu.state_hash(critic),
                      discriminatorLoss=float(discriminator_loss.detach()), generatorLoss=float(generator_loss.detach()),
                      generatorParts={key: float(value.detach()) if isinstance(value, torch.Tensor) else value for key, value in parts.items()})
        require(report["finalModelStateSha256"] == initial_model and report["finalCriticStateSha256"] == initial_critic,
                "GPU qualification changed model or critic state")
        report["memoryMeasurements"] = memory
        report["peakReservedBytes"] = max(item["peakReservedBytes"] for item in memory)


def worker(request):
    started = time.monotonic()
    report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed", "capabilityVersion": CAPABILITY,
        "candidateContract": request["candidateContract"], "cpuAcceptance": request["cpuAcceptance"],
        "attemptId": request["attemptId"], "optimizerCreated": False, "optimizerSteps": 0,
        "generatorBackwardCalls": 0, "discriminatorBackwardCalls": 0, "checkpointLoaded": False,
        "checkpointWritten": False, "trainingAllowedByThisArtifact": False, "stage4QualificationGranted": False,
        "validationRgbOrChannelPixelsRead": False, "challengeContentRead": False, "regressionContentRead": False,
        "registryWritten": False, "gpuInitialized": False}
    try:
        reader, candidate, acceptance, scope, order, continuous, row = authenticate(
            request["candidateContract"], request["cpuAcceptance"], request["attemptId"], request["outputRoot"])
        directory = attempt_directory(request["attemptId"], request["outputRoot"])
        require(exact(json.loads((directory / "claim.json").read_bytes()), request), "missing or mismatched parent claim")
        # Never remove this marker, including on failure or timeout.
        write_json(directory / "worker-started.json", {"attemptId": request["attemptId"], "pid": os.getpid()})
        sample, identity, counts = positive_train_sample(reader, row, order, continuous)
        report.update(sampleIdentity=identity, positiveRolePixelCounts=counts, scopePreflight=scope,
                      validationFactMetadataReadForScope=True, precisionExecutionPlan=PRECISION_PLAN,
                      implementationIdentitySha256=implementation_identity(candidate))
        before = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
        run_cuda(candidate, acceptance, sample, order, report)
        require(before == {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}, "source tensors modified")
        reader.unchanged()
        require(time.monotonic() - started <= candidate["resourceBudget"]["maxWallSeconds"], "GPU wall limit exceeded")
        report.update(status="readonly_gpu_qualification_passed_training_still_disabled", weightsModified=False)
    except Exception as error:
        report.update(errorType=type(error).__name__, error=str(error))
    if "reader" in locals():
        report["sourceBindingsRecomputed"] = [{"path": path, "sha256": digest}
                                               for path, digest in reader.observed.items()]
    report["elapsedSeconds"] = time.monotonic() - started
    report["recordedAtUtc"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("candidate", "candidate-sha256", "cpu-evidence", "cpu-evidence-sha256", "attempt-id", "output-root"):
        parser.add_argument("--" + flag, required=True)
    parser.add_argument("--execute", action="store_true", help="Requires a separately activated exact contract")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    request = {"candidateContract": {"path": args.candidate, "sha256": args.candidate_sha256},
               "cpuAcceptance": {"path": args.cpu_evidence, "sha256": args.cpu_evidence_sha256},
               "attemptId": args.attempt_id, "outputRoot": args.output_root}
    if args.worker:
        require(args.execute, "worker requires explicit execute flag and an existing claim")
        result = worker(request)
        print(json.dumps(result, allow_nan=False))
        return 0 if result["status"] == "readonly_gpu_qualification_passed_training_still_disabled" else 1
    reader, candidate, _, scope, order, continuous, row = authenticate(
        request["candidateContract"], request["cpuAcceptance"], args.attempt_id, args.output_root)
    _, identity, counts = positive_train_sample(reader, row, order, continuous)
    reader.unchanged()
    if not args.execute:
        print(json.dumps({"status": "cpu_preflight_passed_gpu_not_started", "sampleIdentity": identity,
                          "positiveRolePixelCounts": counts, "scopePreflight": scope, "attemptConsumed": False}))
        return 0
    directory = claim_attempt(request)
    stdout, stderr = "", ""
    try:
        result = subprocess.run([sys.executable, "-B", str(Path(__file__).resolve()), *sys.argv[1:], "--worker"],
            cwd=ROOT, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}, capture_output=True, text=True,
            timeout=candidate["resourceBudget"]["maxWallSeconds"])
        stdout, stderr = result.stdout, result.stderr
        report = json.loads(stdout)
        require(report["status"] == "failed_closed" or result.returncode == 0, "worker exit/report conflict")
    except Exception as error:
        if isinstance(error, subprocess.TimeoutExpired):
            stdout = error.stdout.decode(errors="replace") if isinstance(error.stdout, bytes) else error.stdout or ""
            stderr = error.stderr.decode(errors="replace") if isinstance(error.stderr, bytes) else error.stderr or ""
        report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed", "attemptId": args.attempt_id,
                  "errorType": type(error).__name__, "error": str(error), "gpuExecutionState": "worker_did_not_return_complete_report",
                  "trainingAllowedByThisArtifact": False, "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for name, content in (("worker-stdout.log", stdout), ("worker-stderr.log", stderr)):
        with (directory / name).open("x", encoding="utf8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    write_json(directory / "report.json", report)
    print(json.dumps({"status": report["status"], "report": {"path": (directory / "report.json").relative_to(ROOT).as_posix(),
                      "sha256": cpu.sha((directory / "report.json").read_bytes())}}))
    return 0 if report["status"] == "readonly_gpu_qualification_passed_training_still_disabled" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_worker", "errorType": type(error).__name__, "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
