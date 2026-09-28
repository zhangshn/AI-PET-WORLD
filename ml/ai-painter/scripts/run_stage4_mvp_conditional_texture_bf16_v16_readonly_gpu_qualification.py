"""Bound V16 BF16 CUDA forward/backward qualification; no optimizer or checkpoint.

Only the child may initialize CUDA. The parent enforces a 120-second wall limit
and records an immutable terminal result. No non-train pixels are decoded.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "ml/ai-painter/src"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from ai_painter.complete_world.split_release import (  # noqa: E402
    bound_json, canonical_bytes, project_file, read_bound,
)


CAPABILITY = "stage4_mvp_native_rgb_conditional_texture_bf16_v16"
CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json"
REVIEW_PATH = "data/ai-painter/system-governance/stage4-mvp-v16-stage0-review-contract-v1.json"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-policy-v1.json"
PROGRAM_PATH = "ml/ai-painter/scripts/run_stage4_mvp_conditional_texture_bf16_v16_readonly_gpu_qualification.py"
CPU_PROGRAM_PATH = "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_bf16_v16_cpu_acceptance.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-conditional-texture-bf16-v16-gpu-qualifications"
REGISTRY_PATH = ".runtime/ai-painter/current-execution-registry/current.json"
POLICY_SCHEMA = "stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-policy-v1"
REPORT_SCHEMA = "stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-report-v1"
CPU_ACCEPTANCE_SCHEMA = "stage4-mvp-conditional-texture-bf16-v16-formal-cpu-acceptance-v1"
CPU_STATUS = "cpu_readonly_accepted_execution_disabled"
MAX_SECONDS = 120
MEMORY_FRACTION = 0.7
SEED = 20260927
EXECUTION = {
    "maxGpuMemoryFraction": MEMORY_FRACTION,
    "maxWallSeconds": MAX_SECONDS,
    "optimizerAllowed": False,
    "trainingAllowed": False,
    "checkpointAllowed": False,
    "validationRead": False,
    "challengeRead": False,
    "regressionRead": False,
}
PRECISION_PLAN = {
    "generatorAutocast": "bfloat16",
    "discriminatorAutocast": "bfloat16",
    "gradientScaler": "disabled",
    "nonfiniteGradient": "fail_closed_with_network_parameter_sample_and_step",
    "optimizerUpdateSkipAllowed": False,
    "optimizer": "AdamW",
    "generatorLearningRate": 0.0001,
    "discriminatorLearningRate": 0.0001,
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def bind(path: str) -> dict:
    return {"path": path, "sha256": hashlib.sha256(project_file(ROOT, path).read_bytes()).hexdigest()}


def registry_snapshot() -> dict:
    return json.loads(project_file(ROOT, REGISTRY_PATH).read_text(encoding="utf-8"))


def validate_gate(policy: dict, candidate: dict, cpu: dict, registry: dict,
                  *, candidate_binding: dict, program_binding: dict) -> None:
    """Pure policy check; unit tests call this without importing CUDA."""
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "active_single_readonly_qualification"
            and policy.get("capabilityVersion") == CAPABILITY
            and policy.get("candidateContract") == candidate_binding
            and policy.get("program") == program_binding
            and policy.get("datasetManifest") == candidate.get("datasetBinding", {}).get("manifest")
            and policy.get("precisionExecutionPlan") == PRECISION_PLAN
            and policy.get("execution") == EXECUTION,
            "V16 exact read-only GPU policy, resource limit or program binding invalid")
    require(candidate.get("schemaVersion") ==
            "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract-v1"
            and candidate.get("capabilityVersion") == CAPABILITY
            and candidate.get("reviewBinding", {}).get("formalContract", {}).get("path") == REVIEW_PATH
            and candidate.get("reviewBinding", {}).get("alignmentQualified") is True
            and isinstance(candidate.get("trainingReviewAlignment"), list)
            and len(candidate["trainingReviewAlignment"]) == 7
            and candidate.get("activationGates", {}).get("gpuReadOnlyNow") is True
            and candidate["activationGates"].get("optimizerNow") is False
            and candidate["activationGates"].get("trainingNow") is False
            and candidate["activationGates"].get("runtimeFrameNow") is False
            and candidate.get("precisionExecutionPlan") == PRECISION_PLAN,
            "V16 formal alignment or read-only GPU activation is absent")
    dataset = candidate["datasetBinding"]
    require(dataset.get("manifest") == policy["datasetManifest"]
            and isinstance(dataset.get("trainSelectionSha256"), str)
            and len(dataset["trainSelectionSha256"]) == 64
            and candidate.get("trainingBoundNotActivated", {}).get("resolution") == [256, 192]
            and candidate["trainingBoundNotActivated"].get("maxGpuMemoryFraction") == MEMORY_FRACTION,
            "V16 dataset or candidate resource bound differs")
    require(cpu.get("schemaVersion") == CPU_ACCEPTANCE_SCHEMA
            and cpu.get("status") == CPU_STATUS
            and cpu.get("capabilityVersion") == CAPABILITY
            and cpu.get("candidateContract") == candidate_binding
            and cpu.get("formalReviewContract") == candidate["reviewBinding"]["formalContract"]
            and cpu.get("datasetManifest") == policy["datasetManifest"]
            and cpu.get("trainSelectionSha256") == dataset["trainSelectionSha256"]
            and isinstance(cpu.get("initialModelStateSha256"), str)
            and len(cpu["initialModelStateSha256"]) == 64
            and isinstance(cpu.get("initialDiscriminatorStateSha256"), str)
            and len(cpu["initialDiscriminatorStateSha256"]) == 64
            and cpu.get("acceptanceProgram") ==
            candidate.get("programBindings", {}).get("cpuAcceptance")
            and cpu["acceptanceProgram"].get("path") == CPU_PROGRAM_PATH
            and isinstance(cpu.get("acceptanceTests"), dict)
            and cpu.get("formalReviewAlignmentPassed") is True
            and cpu.get("independentAcceptance") is True
            and cpu.get("cpuTestsPassed") is True
            and cpu.get("validationContentRead") is False
            and cpu.get("optimizerSteps") == 0
            and cpu.get("trainingStarted") is False
            and cpu.get("gpuUsed") is False
            and cpu.get("weightsModified") is False,
            "candidate-specific independent formal CPU acceptance is absent")
    require(registry.get("activeExecution") is None, "another AI Painter execution is active")


def authenticate() -> tuple[dict, dict, dict, dict, dict, dict]:
    policy_binding = bind(POLICY_PATH)
    policy = bound_json(ROOT, policy_binding)
    candidate_binding = bind(CONTRACT_PATH)
    candidate = bound_json(ROOT, candidate_binding)
    cpu = bound_json(ROOT, policy["cpuQualification"])
    registry = registry_snapshot()
    validate_gate(policy, candidate, cpu, registry,
                  candidate_binding=candidate_binding, program_binding=bind(PROGRAM_PATH))
    require(candidate["programBindings"].get("readonlyGpuQualification") == bind(PROGRAM_PATH)
            and candidate["programBindings"].get("cpuAcceptance") == bind(CPU_PROGRAM_PATH)
            and cpu["acceptanceTests"] == candidate["programBindings"].get("objectiveTests"),
            "V16 candidate or CPU program lineage changed")
    read_bound(ROOT, cpu["acceptanceTests"])
    manifest = bound_json(ROOT, policy["datasetManifest"])
    dataset = candidate["datasetBinding"]
    require(manifest.get("datasetReleaseIdentity") == dataset.get("datasetReleaseIdentity")
            and manifest.get("sourceIndex") == dataset.get("sourceIndex")
            and manifest.get("splits") == dataset.get("splits")
            and manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4,
            }, "V16 release identity or membership changed")
    for item in (dataset["sourceIndex"], *dataset["splits"].values(),
                 candidate["conditionContract"], candidate["reviewBinding"]["formalContract"],
                 candidate["reviewBinding"]["thresholds"],
                 candidate["reviewBinding"]["minimumDetail"]):
        read_bound(ROOT, item)
    return policy_binding, policy, candidate_binding, candidate, cpu, registry


def load_one_train_sample(dataset: dict, manifest: dict):
    """Only metadata for other splits; decode one bound train RGB and 23 channels."""
    import numpy as np
    from PIL import Image
    import torch
    from ai_painter.complete_world.object_instance_supervision_cpu import iter_object_views

    source = bound_json(ROOT, dataset["sourceIndex"])
    split = bound_json(ROOT, dataset["splits"]["train"])
    require(source.get("sampleCount") == 64 and len(source.get("samples", [])) == 64
            and split.get("split") == "train" and len(split.get("sampleIds", [])) == 48,
            "V16 train membership or source index invalid")
    by_id = {row["sampleId"]: row for row in source["samples"]}
    require(len(by_id) == 64 and len(set(split["sampleIds"])) == 48
            and all(key in by_id and by_id[key]["split"] == "train"
                    for key in split["sampleIds"]),
            "V16 train membership differs from source rows")
    selected = [by_id[key] for key in split["sampleIds"]]
    require(hashlib.sha256(canonical_bytes(selected)).hexdigest() ==
            dataset["trainSelectionSha256"], "V16 train selection hash changed")
    row = selected[0]
    pack = bound_json(ROOT, row["conditionPack"])
    order = manifest["identityPayload"]["channelOrder"]
    continuous = manifest["identityPayload"]["continuousChannelIds"]
    require(len(order) == len(set(order)) == 23
            and [item["id"] for item in pack.get("channels", [])] == order,
            "V16 train condition channel identity changed")

    def pixels(bound, mode, resampling):
        with Image.open(io.BytesIO(read_bound(ROOT, bound))) as image:
            require(image.size == (1024, 768), "V16 train original dimensions changed")
            return np.asarray(image.convert(mode).resize((256, 192), resample=resampling),
                              dtype=np.uint8).copy()

    image = pixels(row["image"], "RGB", Image.Resampling.LANCZOS)
    channels = [pixels(item, "L", Image.Resampling.BILINEAR
                       if item["id"] in continuous else Image.Resampling.NEAREST)
                for item in pack["channels"]]
    conditions = torch.stack([torch.from_numpy(item).float().div(255) for item in channels])
    table = pack.get("objectInstanceTable")
    require(isinstance(table, list), "V16 train object instance table missing")
    list(iter_object_views(conditions, table, order))
    return {"sampleId": row["sampleId"], "split": "train",
            "image": torch.from_numpy(image).permute(2, 0, 1).float().div(255),
            "conditions": conditions, "objectInstanceTable": table}, order


def gpu_child() -> dict:
    """One BF16-autocast train-sample pass per network; zero parameter updates."""
    import torch
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
        build_conditional_texture_discriminator, discriminator_train_objective,
        generator_train_objective,
    )
    from ai_painter.complete_world.native_rgb_instance_object_prototype import (
        build_native_rgb_instance_object_prototype,
    )
    from ai_painter.complete_world.split_training import state_hash

    started = time.monotonic()
    policy_binding, policy, candidate_binding, candidate, cpu, before_registry = authenticate()
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
            "V16 CUDA BF16 unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(MEMORY_FRACTION, device)
    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    manifest = bound_json(ROOT, policy["datasetManifest"])
    sample, order = load_one_train_sample(candidate["datasetBinding"], manifest)
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    initial_model, initial_critic = state_hash(model.state_dict()), state_hash(critic.state_dict())
    require(initial_model == cpu["initialModelStateSha256"]
            and initial_critic == cpu["initialDiscriminatorStateSha256"],
            "V16 fresh network states differ from CPU acceptance")
    model.to(device)
    critic.to(device)
    torch.cuda.reset_peak_memory_stats(device)
    gpu_sample = {**sample, "image": sample["image"].to(device),
                  "conditions": sample["conditions"].to(device)}
    with torch.autocast("cuda", dtype=torch.bfloat16):
        prediction = model(gpu_sample["conditions"].unsqueeze(0), sample["objectInstanceTable"])
        d_loss, _ = discriminator_train_objective(critic, prediction, gpu_sample)
    require(prediction.shape == (1, 3, 192, 256) and bool(torch.isfinite(d_loss)),
            "V16 BF16 discriminator forward invalid")
    d_loss.backward()
    critic_gradient = sum(float(p.grad.detach().abs().sum()) for p in critic.parameters()
                          if p.grad is not None)
    require(critic_gradient > 0 and all(
        p.grad is None or bool(torch.isfinite(p.grad).all()) for p in critic.parameters()
    ) and all(p.grad is None for p in model.parameters()),
            "V16 BF16 discriminator gradients missing, non-finite or leaked")
    critic.zero_grad(set_to_none=True)
    critic.requires_grad_(False)
    with torch.autocast("cuda", dtype=torch.bfloat16):
        g_loss, parts = generator_train_objective(
            critic, prediction, gpu_sample, sample["objectInstanceTable"], order)
    require(bool(torch.isfinite(g_loss)), "V16 BF16 generator objective non-finite")
    g_loss.backward()
    object_gradient = sum(float(p.grad.detach().abs().sum()) for p in model.object_head.parameters()
                          if p.grad is not None)
    core_gradient = sum(float(p.grad.detach().abs().sum()) for p in model.core.parameters()
                        if p.grad is not None)
    require(object_gradient > 0 and core_gradient > 0 and all(
        p.grad is None or bool(torch.isfinite(p.grad).all()) for p in model.parameters()
    ) and all(p.grad is None for p in critic.parameters()),
            "V16 BF16 generator gradients missing, non-finite or leaked")
    torch.cuda.synchronize(device)
    final_model = state_hash({k: v.detach().cpu() for k, v in model.state_dict().items()})
    final_critic = state_hash({k: v.detach().cpu() for k, v in critic.state_dict().items()})
    reserved = int(torch.cuda.max_memory_reserved(device))
    total = int(torch.cuda.get_device_properties(device).total_memory)
    require(final_model == initial_model and final_critic == initial_critic
            and reserved / total <= MEMORY_FRACTION,
            "V16 GPU probe changed network state or exceeded reserved-memory cap")
    require(time.monotonic() - started <= MAX_SECONDS, "V16 GPU probe exceeded wall limit")
    after_registry = registry_snapshot()
    require(after_registry.get("registryRevision") == before_registry.get("registryRevision")
            and after_registry.get("eventSequence") == before_registry.get("eventSequence")
            and after_registry.get("activeExecution") is None,
            "current-execution registry changed during V16 probe")
    require(bind(POLICY_PATH) == policy_binding and bind(CONTRACT_PATH) == candidate_binding
            and bind(PROGRAM_PATH) == policy["program"],
            "V16 policy, candidate or program changed during probe")
    return {
        "schemaVersion": REPORT_SCHEMA,
        "status": "readonly_gpu_qualification_passed_training_still_disabled",
        "capabilityVersion": CAPABILITY,
        "policy": policy_binding, "candidateContract": candidate_binding,
        "cpuQualification": policy["cpuQualification"],
        "datasetManifest": policy["datasetManifest"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": "train"},
        "precision": "torch_cuda_autocast_bfloat16_no_grad_scaler",
        "precisionExecutionPlan": PRECISION_PLAN,
        "initialModelStateSha256": initial_model, "finalModelStateSha256": final_model,
        "initialDiscriminatorStateSha256": initial_critic,
        "finalDiscriminatorStateSha256": final_critic,
        "criticGradientAbsoluteSum": critic_gradient,
        "objectGradientAbsoluteSum": object_gradient,
        "coreGradientAbsoluteSum": core_gradient,
        "criticObjective": float(d_loss.detach()),
        "generatorObjective": float(g_loss.detach()),
        "generatorTerms": {key: float(value.detach()) for key, value in parts.items()
                           if isinstance(value, torch.Tensor) and value.numel() == 1},
        "peakGpuReservedBytes": reserved, "gpuTotalBytes": total,
        "peakGpuReservedFraction": reserved / total,
        "optimizerCreated": False, "optimizerSteps": 0,
        "weightsModified": False, "checkpointWritten": False,
        "trainingStarted": False, "validationRead": False,
        "challengeRead": False, "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def immutable_report(report: dict) -> dict:
    directory = project_file(ROOT, OUTPUT_ROOT)
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / ("gpu-v16-" + uuid4().hex + ".json")
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    return bind(destination.relative_to(ROOT).as_posix())


def run() -> dict:
    started = time.monotonic()
    policy_binding, policy, candidate_binding, _, _, before_registry = authenticate()
    remaining = MAX_SECONDS - (time.monotonic() - started)
    require(remaining > 0, "V16 GPU preflight exceeded wall limit")
    try:
        child = subprocess.run([sys.executable, str(project_file(ROOT, PROGRAM_PATH)), "--worker"],
                               cwd=ROOT, capture_output=True, text=True, timeout=remaining,
                               check=False)
    except subprocess.TimeoutExpired as error:
        raise TimeoutError("V16 GPU child killed at 120-second wall limit") from error
    require(child.returncode == 0, "V16 GPU child failed: " + child.stderr[-2000:])
    report = json.loads(child.stdout)
    require(report.get("schemaVersion") == REPORT_SCHEMA
            and report.get("status") == "readonly_gpu_qualification_passed_training_still_disabled"
            and report.get("policy") == policy_binding
            and report.get("candidateContract") == candidate_binding
            and report.get("cpuQualification") == policy["cpuQualification"]
            and report.get("datasetManifest") == policy["datasetManifest"]
            and report.get("precisionExecutionPlan") == PRECISION_PLAN
            and report.get("sampleIdentity", {}).get("split") == "train"
            and report.get("initialModelStateSha256") ==
            report.get("finalModelStateSha256")
            and report.get("initialDiscriminatorStateSha256") ==
            report.get("finalDiscriminatorStateSha256")
            and isinstance(report.get("peakGpuReservedFraction"), (float, int))
            and 0 < report["peakGpuReservedFraction"] <= MEMORY_FRACTION
            and report.get("optimizerCreated") is False
            and report.get("trainingAllowedByThisArtifact") is False
            and report.get("optimizerSteps") == 0
            and report.get("weightsModified") is False
            and report.get("checkpointWritten") is False
            and report.get("trainingStarted") is False
            and report.get("validationRead") is False
            and report.get("challengeRead") is False
            and report.get("regressionRead") is False,
            "V16 GPU child report identity or non-training boundary invalid")
    after_registry = registry_snapshot()
    require(after_registry.get("registryRevision") == before_registry.get("registryRevision")
            and after_registry.get("eventSequence") == before_registry.get("eventSequence")
            and after_registry.get("activeExecution") is None,
            "current-execution registry changed during V16 probe")
    require(bind(POLICY_PATH) == policy_binding and bind(CONTRACT_PATH) == candidate_binding
            and bind(PROGRAM_PATH) == policy["program"],
            "V16 policy, candidate or program changed before evidence commit")
    require(time.monotonic() - started <= MAX_SECONDS, "V16 GPU probe exceeded wall limit")
    return immutable_report(report)


def main() -> int:
    if sys.argv[1:] == ["--worker"]:
        try:
            print(json.dumps(gpu_child(), ensure_ascii=False, allow_nan=False), flush=True)
            return 0
        except Exception as error:
            print(f"{type(error).__name__}: {error}", file=sys.stderr, flush=True)
            return 1
    if sys.argv[1:]:
        print("unexpected argument", file=sys.stderr)
        return 2
    try:
        evidence = run()
        print(json.dumps({"status": "readonly_gpu_qualification_passed_training_still_disabled",
                          "report": evidence}, ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": REPORT_SCHEMA, "status": "failed_closed",
            "capabilityVersion": CAPABILITY,
            "errorType": type(error).__name__, "error": str(error),
            "optimizerSteps": 0, "trainingStarted": False,
            "trainingAllowedByThisArtifact": False,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        evidence = immutable_report(failure)
        print(json.dumps({"status": "failed_closed", "report": evidence},
                         ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
