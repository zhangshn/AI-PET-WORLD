"""V21 zero-update BF16 GPU qualification; default is CPU-only preflight.

Execution requires an immutable V21 candidate and independent formal CPU
acceptance. No optimizer, checkpoint, registry, or nontrain content is touched.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import v21_object_residual_admission as gate

require = gate.require
REPORT_SCHEMA = "stage4-mvp-object-residual-v21-readonly-gpu-report-v1"


def attempt_directory(attempt_id, output_root):
    require(output_root == gate.GPU_ROOT and isinstance(attempt_id, str)
            and gate.re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,95}", attempt_id),
            "invalid V21 attempt namespace")
    return gate.data.project_file(ROOT, output_root + "/attempt-" + gate.data.sha(attempt_id.encode("utf8")))


def claim_attempt(request):
    directory = attempt_directory(request["attemptId"], request["outputRoot"])
    try:
        directory.mkdir(parents=True, exist_ok=False)
    except FileExistsError as error:
        raise ValueError("V21 qualification attempt already consumed") from error
    gate.v18.write_json(directory / "claim.json", request)
    return directory


def _head_gradients(model):
    import torch
    values = {}
    for role in ("object_footprints", "object_tree", "object_rock", "object_vegetation"):
        grads = [parameter.grad for parameter in model.object_rgb_heads[role].parameters()]
        require(all(value is not None and bool(torch.isfinite(value).all()) for value in grads),
                "V21 GPU head gradient missing/nonfinite: " + role)
        amount = sum(float(value.detach().double().abs().sum()) for value in grads)
        require(amount > 0, "V21 GPU head gradient zero: " + role)
        values[role] = amount
    return values


def run_cuda(candidate, acceptance, sample, order, report):
    """CUDA is reachable only after SHA authentication and exclusive claim."""
    import torch
    from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
        SEED, build_fresh_native_rgb_object_residual_v21_cpu)
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective

    budget = candidate["resourceBudget"]
    torch.set_num_threads(budget["cpuThreads"])
    torch.manual_seed(SEED)
    model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order).eval()
    critic = build_conditional_texture_discriminator().eval()
    initial_model, initial_critic = gate.data.state_hash(model), gate.data.state_hash(critic)
    require(initial_model == acceptance["initialModelStateSha256"]
            and initial_critic == acceptance["initialCriticStateSha256"],
            "fresh V21 GPU networks differ from formal CPU states")
    report.update(initialModelStateSha256=initial_model, initialCriticStateSha256=initial_critic)
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    report["gpuInitialized"] = torch.cuda.is_initialized()
    torch.cuda.manual_seed_all(SEED)
    free, total = torch.cuda.mem_get_info(device)
    fraction = budget["maxGpuMemoryFraction"]
    allocator_bytes = int(total * fraction) - (total - free) - 64 * 1024 * 1024
    require(allocator_bytes > 0, "insufficient VRAM below V21 ceiling")
    torch.cuda.set_per_process_memory_fraction(allocator_bytes / total, device)
    report["allocatorBudgetBytes"] = allocator_bytes
    torch.cuda.reset_peak_memory_stats(device)
    memory = []

    def measure(phase):
        torch.cuda.synchronize(device)
        available, capacity = torch.cuda.mem_get_info(device)
        observed = {"total": int(capacity), "reserved": int(torch.cuda.max_memory_reserved(device)),
                    "allocated": int(torch.cuda.max_memory_allocated(device)),
                    "device_used": int(capacity - available)}
        memory.append({"phase": phase, **gate.v18.check_memory(**observed, fraction=fraction)})

    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("checkpoint load prohibited")):
        model.to(device)
        critic.to(device)
        gpu_sample = {**sample, "image": sample["image"].to(device),
                      "conditions": sample["conditions"].to(device)}
        measure("models_and_train_sample_loaded")
        with torch.autocast("cuda", dtype=torch.bfloat16):
            predicted, evidence = model(gpu_sample["conditions"][None],
                                        sample["objectInstanceTable"], return_evidence=True)
            discriminator_loss, _ = gate.v18.detached_discriminator_objective(
                critic, predicted, gpu_sample)
        require(bool(torch.isfinite(predicted).all() and torch.isfinite(discriminator_loss)),
                "nonfinite V21 BF16 forward")
        report["objectSupport"] = gate.validate_object_support(evidence)
        features = {**evidence["terrainResponsibilityFeatures"],
                    **evidence["responsibilityFeatures"]}
        for value in features.values():
            value.retain_grad()
        measure("discriminator_forward")
        report["discriminatorBackwardCalls"] = 1
        discriminator_loss.backward()
        report["discriminatorGradients"] = gate.v18.gradient_facts(critic, "cuda")
        require(all(parameter.grad is None for parameter in model.parameters()),
                "discriminator gradient leaked to V21 generator")
        measure("discriminator_backward")
        critic.zero_grad(set_to_none=True)
        critic.requires_grad_(False)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            generator_loss, parts = train_structured_object_objective(
                critic, predicted, gpu_sample, sample["objectInstanceTable"], order)
        require(bool(torch.isfinite(generator_loss)), "nonfinite V21 BF16 generator loss")
        report["generatorBackwardCalls"] = 1
        generator_loss.backward()
        report["generatorGradients"] = gate.v18.gradient_facts(model, "cuda")
        report["responsibilityGradients"] = gate.v18.role_gradient_facts(features, gpu_sample, order)
        report["objectHeadGradientAbsoluteSums"] = _head_gradients(model)
        require(all(parameter.grad is None for parameter in critic.parameters()),
                "generator gradient leaked to V21 critic")
        measure("generator_backward")
        report.update(finalModelStateSha256=gate.data.state_hash(model),
                      finalCriticStateSha256=gate.data.state_hash(critic),
                      discriminatorLoss=float(discriminator_loss.detach()),
                      generatorLoss=float(generator_loss.detach()),
                      generatorParts={key: float(value.detach()) if isinstance(value, torch.Tensor)
                                      else value for key, value in parts.items()},
                      memoryMeasurements=memory)
        require(report["finalModelStateSha256"] == initial_model
                and report["finalCriticStateSha256"] == initial_critic,
                "V21 GPU probe changed model or critic")


def worker(request):
    started = time.monotonic()
    report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed",
              "capabilityVersion": gate.CAPABILITY,
              "candidateContract": request["candidateContract"],
              "cpuAcceptance": request["cpuAcceptance"], "attemptId": request["attemptId"],
              "optimizerCreated": False, "optimizerSteps": 0,
              "generatorBackwardCalls": 0, "discriminatorBackwardCalls": 0,
              "checkpointLoaded": False, "checkpointWritten": False,
              "trainingAllowedByThisArtifact": False, "stage4QualificationGranted": False,
              "validationRgbOrChannelPixelsRead": False,
              "challengeContentRead": False, "regressionContentRead": False,
              "registryWritten": False, "gpuInitialized": False}
    try:
        reader, candidate, acceptance, scope, order, continuous, row = gate.authenticate(
            request["candidateContract"], request["cpuAcceptance"],
            attempt_id=request["attemptId"], output_root=request["outputRoot"])
        directory = attempt_directory(request["attemptId"], request["outputRoot"])
        require(gate.exact(json.loads((directory / "claim.json").read_bytes()), request),
                "missing or mismatched parent claim")
        gate.v18.write_json(directory / "worker-started.json",
                            {"attemptId": request["attemptId"], "pid": os.getpid()})
        sample, identity, counts = gate.v18.positive_train_sample(reader, row, order, continuous)
        before = {key: gate.data.tensor_hash(sample[key]) for key in ("image", "conditions")}
        report.update(sampleIdentity=identity, positiveRolePixelCounts=counts,
                      scopePreflight=scope,
                      reviewApplicability={item["responsibilityId"]: item["reviewApplicability"]
                                           for item in candidate["trainingReviewAlignment"]},
                      implementationIdentitySha256=gate.implementation_identity(candidate))
        run_cuda(candidate, acceptance, sample, order, report)
        require(before == {key: gate.data.tensor_hash(sample[key])
                           for key in ("image", "conditions")}, "source tensors changed")
        reader.unchanged()
        require(time.monotonic() - started <= candidate["resourceBudget"]["maxWallSeconds"],
                "V21 GPU wall limit exceeded")
        report.update(status="readonly_gpu_qualification_passed_training_still_disabled",
                      weightsModified=False)
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
    for flag in ("candidate", "candidate-sha256", "cpu-evidence", "cpu-evidence-sha256",
                 "attempt-id", "output-root"):
        parser.add_argument("--" + flag, required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    request = {"candidateContract": {"path": args.candidate, "sha256": args.candidate_sha256},
               "cpuAcceptance": {"path": args.cpu_evidence, "sha256": args.cpu_evidence_sha256},
               "attemptId": args.attempt_id, "outputRoot": args.output_root}
    if args.worker:
        require(args.execute, "worker requires explicit execute and parent claim")
        report = worker(request)
        print(json.dumps(report, allow_nan=False))
        return 0 if report["status"] == "readonly_gpu_qualification_passed_training_still_disabled" else 1
    reader, candidate, _, scope, order, continuous, row = gate.authenticate(
        request["candidateContract"], request["cpuAcceptance"],
        attempt_id=args.attempt_id, output_root=args.output_root)
    _, identity, counts = gate.v18.positive_train_sample(reader, row, order, continuous)
    reader.unchanged()
    if not args.execute:
        print(json.dumps({"status": "cpu_preflight_passed_gpu_not_started",
                          "sampleIdentity": identity, "positiveRolePixelCounts": counts,
                          "scopePreflight": scope, "attemptConsumed": False}))
        return 0
    directory = claim_attempt(request)
    stdout, stderr = "", ""
    try:
        result = subprocess.run([sys.executable, "-B", str(Path(__file__).resolve()),
                                 *sys.argv[1:], "--worker"], cwd=ROOT,
                                env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
                                capture_output=True, text=True,
                                timeout=candidate["resourceBudget"]["maxWallSeconds"])
        stdout, stderr = result.stdout, result.stderr
        report = json.loads(stdout)
        require(report["status"] == "failed_closed" or result.returncode == 0,
                "V21 GPU worker exit/report conflict")
    except Exception as error:
        if isinstance(error, subprocess.TimeoutExpired):
            stdout = error.stdout.decode(errors="replace") if isinstance(error.stdout, bytes) else error.stdout or ""
            stderr = error.stderr.decode(errors="replace") if isinstance(error.stderr, bytes) else error.stderr or ""
        report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed",
                  "attemptId": args.attempt_id, "errorType": type(error).__name__,
                  "error": str(error), "trainingAllowedByThisArtifact": False,
                  "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for name, content in (("worker-stdout.log", stdout), ("worker-stderr.log", stderr)):
        with (directory / name).open("x", encoding="utf8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    gate.v18.write_json(directory / "report.json", report)
    print(json.dumps({"status": report["status"], "report": {
        "path": (directory / "report.json").relative_to(ROOT).as_posix(),
        "sha256": gate.data.sha((directory / "report.json").read_bytes())}}))
    return 0 if report["status"] == "readonly_gpu_qualification_passed_training_still_disabled" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_worker", "errorType": type(error).__name__,
                          "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
