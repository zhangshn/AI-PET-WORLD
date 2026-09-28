"""Formal V21 CPU acceptance, callable only with a SHA-bound candidate.

One fixed train image is decoded; validation/challenge/regression pixels are
never read. This program creates no optimizer, checkpoint, or GPU context.
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


def _run_tests():
    env = {**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
           "PYTHONPATH": str(ROOT / "ml/ai-painter/src") + os.pathsep + os.environ.get("PYTHONPATH", ""),
           "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"}
    names = ("test_native_rgb_object_residual_v21_cpu.py",
             "test_v21_object_residual_admission.py")
    result = []
    for name in names:
        process = subprocess.run([sys.executable, "-B", "-m", "unittest", "discover",
                                  "-s", "ml/ai-painter/tests", "-p", name, "-q"],
                                 cwd=ROOT, env=env, capture_output=True, text=True,
                                 timeout=90, encoding="utf8", errors="replace")
        require(process.returncode == 0,
                "V21 CPU controls failed: " + name + "\n" + process.stderr[-3000:])
        result.append({"path": "ml/ai-painter/tests/" + name, "exitCode": 0})
    return result


def run_cpu(candidate_binding, *, attempt_id, output_root):
    """Return an acceptance report without writing it; caller must persist immutably."""
    import torch
    from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
        ROLES, SEED, build_fresh_native_rgb_object_residual_v21_cpu)
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective

    started = time.monotonic()
    require(not torch.cuda.is_initialized(), "CPU acceptance inherited CUDA initialization")
    reader, candidate, _, scope, order, continuous, row = gate.authenticate(
        candidate_binding, attempt_id=attempt_id, output_root=output_root)
    test_results = _run_tests()
    sample, identity, counts = gate.v18.positive_train_sample(reader, row, order, continuous)
    torch.set_num_threads(candidate["resourceBudget"]["cpuThreads"])
    with patch.object(torch.cuda, "_lazy_init", side_effect=RuntimeError("CPU acceptance forbids CUDA")), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer forbidden")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write forbidden")), \
         patch.object(torch, "load", side_effect=RuntimeError("checkpoint load forbidden")):
        torch.manual_seed(SEED)
        model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order).cpu().eval()
        critic = build_conditional_texture_discriminator().cpu().eval().requires_grad_(False)
        initial_model = gate.data.state_hash(model)
        initial_critic = gate.data.state_hash(critic)
        predicted, evidence = model(sample["conditions"][None], sample["objectInstanceTable"], return_evidence=True)
        require(predicted.shape == (1, 3, 192, 256) and bool(torch.isfinite(predicted).all()),
                "V21 CPU RGB invalid")
        head_sums = {}
        support = gate.validate_object_support(evidence)
        features = {**evidence["terrainResponsibilityFeatures"],
                    **evidence["responsibilityFeatures"]}
        for value in features.values():
            value.retain_grad()
        require(bool(torch.allclose(evidence["terrainRgb"], predicted,
                                    atol=0, rtol=0)) is False,
                "object residual did not change complete RGB")
        loss, parts = train_structured_object_objective(
            critic, predicted, sample, sample["objectInstanceTable"], order)
        require(bool(torch.isfinite(loss)), "V21 CPU original train objective nonfinite")
        loss.backward()
        role_gradients = gate.v18.role_gradient_facts(features, sample, order)
        for role in ROLES:
            head = model.object_rgb_heads[role]
            grads = [parameter.grad for parameter in head.parameters()]
            require(all(gradient is not None and bool(torch.isfinite(gradient).all()) for gradient in grads),
                    "V21 object head gradient absent: " + role)
            amount = sum(float(gradient.detach().double().abs().sum()) for gradient in grads)
            require(amount > 0, "V21 object head gradient zero: " + role)
            head_sums[role] = amount
        require(all(parameter.grad is None for parameter in critic.parameters()),
                "frozen critic received train gradients")
        final_model = gate.data.state_hash(model)
        final_critic = gate.data.state_hash(critic)
        require((initial_model, initial_critic) == (final_model, final_critic),
                "CPU acceptance changed network state")
    reader.unchanged()
    require(not torch.cuda.is_initialized(), "CPU acceptance initialized CUDA")
    require(time.monotonic() - started <= 120, "V21 CPU acceptance wall limit exceeded")
    return {"schemaVersion": gate.CPU_SCHEMA,
            "status": "cpu_readonly_accepted_execution_disabled",
            "capabilityVersion": gate.CAPABILITY,
            "candidateContractAtAcceptance": candidate_binding,
            "implementationIdentitySha256": gate.implementation_identity(candidate),
            "acceptanceProgram": candidate["programBindings"]["formalCpuAcceptance"],
            "cpuTestsPassed": True, "cpuTestResults": test_results,
            "fixedTrainSampleIdentity": identity, "positiveRolePixelCounts": counts,
            "scopePreflight": scope, "originalTrainLoss": float(loss.detach()),
            "originalTrainParts": {key: float(value.detach()) if isinstance(value, torch.Tensor)
                                   else value for key, value in parts.items()},
            "objectHeadGradientAbsoluteSums": head_sums,
            "responsibilityGradients": role_gradients,
            "objectSupport": support,
            "reviewApplicability": {row["responsibilityId"]: row["reviewApplicability"]
                                    for row in candidate["trainingReviewAlignment"]},
            "supportPositiveControlsPassed": True, "supportNegativeControlsPassed": True,
            "initialModelStateSha256": initial_model, "finalModelStateSha256": final_model,
            "initialCriticStateSha256": initial_critic, "finalCriticStateSha256": final_critic,
            "optimizerCreated": False, "optimizerSteps": 0, "weightsModified": False,
            "gpuInitialized": False, "trainingAllowed": False,
            "checkpointLoaded": False, "checkpointWritten": False,
            "challengeContentRead": False, "regressionContentRead": False,
            "elapsedSeconds": time.monotonic() - started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--candidate-sha256", required=True)
    parser.add_argument("--attempt-id", required=True)
    parser.add_argument("--output-root", required=True)
    args = parser.parse_args()
    report = run_cpu({"path": args.candidate, "sha256": args.candidate_sha256},
                     attempt_id=args.attempt_id, output_root=args.output_root)
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
