from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.native_rgb_renderer import RESPONSIBILITY_IDENTITIES  # noqa: E402
from ai_painter.complete_world.split_release import SplitReleaseDataset  # noqa: E402
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (  # noqa: E402
    CAPABILITY_VERSION,
    build_renderer,
    digest,
    load_contract,
    project_file,
    read_json,
)


POLICY_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-renderer-v6-gpu-qualification-policy.json"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_digest(value: dict) -> str:
    return sha256(json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
    ).encode("utf-8")).hexdigest()


def write_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + f".staged-{os.getpid()}")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def bound_json(binding: dict, label: str) -> dict:
    path = project_file(ROOT, binding["path"])
    data = path.read_bytes()
    if digest(data) != binding["sha256"]:
        raise ValueError(f"{label} binding is stale")
    return read_json(path, label)


def run() -> dict:
    if not torch.cuda.is_available():
        raise ValueError("CUDA is unavailable")
    policy_path = project_file(ROOT, POLICY_PATH)
    policy_data = policy_path.read_bytes()
    policy = read_json(policy_path, "V6 GPU qualification policy")
    if (
        policy.get("schemaVersion") != "stage4-mvp-native-complete-rgb-renderer-v6-gpu-qualification-policy-v1"
        or policy.get("policyId") != policy.get("schemaVersion")
        or policy.get("status") != "active_single_readonly_qualification"
        or policy.get("capabilityVersion") != CAPABILITY_VERSION
        or policy.get("automaticRetry") is not False
    ):
        raise ValueError("V6 GPU qualification policy identity changed")
    contract = bound_json(policy["candidateContract"], "V6 candidate contract")
    loaded_contract, _ = load_contract(ROOT)
    if contract != loaded_contract:
        raise ValueError("V6 candidate contract does not reproduce")
    cpu = bound_json(policy["cpuQualification"], "V6 CPU qualification")
    if (
        cpu.get("status") != "cpu_contract_passed_training_still_disabled"
        or cpu.get("capabilityVersion") != CAPABILITY_VERSION
        or cpu.get("stateUnchanged") is not True
        or cpu.get("trainingStarted") is not False
    ):
        raise ValueError("V6 CPU qualification is not eligible")
    execution = policy["execution"]
    if (
        execution.get("resolution") != [256, 192]
        or execution.get("split") != "train"
        or execution.get("oneNonemptySamplePerResponsibility") is not True
        or execution.get("optimizerAllowed") is not False
        or execution.get("backwardCallAllowed") is not False
        or execution.get("autogradProbeAllowed") is not True
        or execution.get("weightModificationAllowed") is not False
        or execution.get("checkpointWriteAllowed") is not False
        or execution.get("trainingAllowed") is not False
    ):
        raise ValueError("V6 GPU safety boundary changed")

    dataset = SplitReleaseDataset(
        ROOT, contract["datasetBinding"], "train", (256, 192)
    )
    condition_order = read_json(
        project_file(ROOT, contract["conditionContract"]["path"]),
        "condition contract",
    )["tensorContract"]["channelOrder"]
    selected = {}
    for index in range(len(dataset)):
        sample = dataset[index]
        for identity in RESPONSIBILITY_IDENTITIES:
            if identity in selected:
                continue
            model_index = condition_order.index(identity)
            if int(sample["conditions"][model_index].count_nonzero()) > 0:
                selected[identity] = sample
        if len(selected) == len(RESPONSIBILITY_IDENTITIES):
            break
    if set(selected) != set(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V6 train split lacks GPU responsibility coverage")

    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    torch.manual_seed(20260924)
    torch.cuda.manual_seed_all(20260924)
    model = build_renderer(ROOT)
    before = state_hash(model.state_dict())
    initialization = {
        "schemaVersion": "stage4-mvp-native-complete-rgb-renderer-v6-initialization-v1",
        "capabilityVersion": CAPABILITY_VERSION,
        "seed": 20260924,
        "candidateContract": policy["candidateContract"],
        "datasetBinding": contract["datasetBinding"],
        "modelStateSha256": before,
    }
    model.to(device).eval()
    rows = {}
    for identity in RESPONSIBILITY_IDENTITIES:
        sample = selected[identity]
        conditions = sample["conditions"].unsqueeze(0).to(device)
        rgb, evidence = model(conditions, return_evidence=True)
        contribution = evidence["responsibilityLogitContributions"][identity]
        parameters = tuple(model.responsibility_heads[identity].parameters())
        gradients = torch.autograd.grad(
            contribution.sum(), parameters, retain_graph=False, allow_unused=False
        )
        rows[identity] = {
            "sampleId": sample["sampleId"],
            "split": sample["split"],
            "outputShape": list(rgb.shape),
            "maskNonzero": int(evidence["responsibilityMasks"][identity].count_nonzero()),
            "outsideMaskContributionMaximum": float(
                (contribution * (1.0 - evidence["responsibilityMasks"][identity])).detach().abs().max()
            ),
            "gradientFinite": all(bool(torch.isfinite(value).all()) for value in gradients),
            "gradientAbsoluteSum": sum(float(value.detach().abs().sum()) for value in gradients),
        }
        del gradients, contribution, evidence, rgb, conditions
    after = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    peak = int(torch.cuda.max_memory_reserved(device))
    total = int(torch.cuda.get_device_properties(device).total_memory)
    if before != after or any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("V6 GPU qualification modified model gradient or state")
    if peak / total > float(execution["maxGpuMemoryFraction"]):
        raise ValueError("V6 GPU qualification exceeded memory cap")
    if any(
        row["outputShape"] != [1, 3, 192, 256]
        or row["maskNonzero"] <= 0
        or row["outsideMaskContributionMaximum"] != 0.0
        or row["gradientFinite"] is not True
        or row["gradientAbsoluteSum"] <= 0.0
        for row in rows.values()
    ):
        raise ValueError("V6 GPU responsibility qualification failed")
    return {
        "schemaVersion": "stage4-mvp-native-complete-rgb-renderer-v6-readonly-gpu-report-v1",
        "status": "readonly_gpu_qualification_passed",
        "capabilityVersion": CAPABILITY_VERSION,
        "policy": {"path": POLICY_PATH, "sha256": digest(policy_data)},
        "candidateContract": policy["candidateContract"],
        "cpuQualification": policy["cpuQualification"],
        "datasetManifest": {
            "path": contract["datasetBinding"]["path"],
            "sha256": contract["datasetBinding"]["sha256"],
        },
        "modelInitializationStateSha256": before,
        "formalInitializationSha256": canonical_digest(initialization),
        "initialization": initialization,
        "responsibilityEvidence": rows,
        "modelStateUnchanged": True,
        "parameterGradientsCleared": True,
        "peakGpuReservedBytes": peak,
        "gpuTotalBytes": total,
        "peakGpuReservedFraction": peak / total,
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "backwardExecuted": False,
        "weightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
        "challengeRead": False,
        "regressionRead": False,
        "trainingAllowedByThisArtifact": True,
        "recordedAtUtc": utc_now(),
    }


def main() -> int:
    output = ROOT / ".runtime" / "ai-painter" / "stage4-mvp-native-rgb-renderer-v6-qualifications" / "gpu-report.json"
    try:
        report = run()
        write_atomic(output, report)
        print(json.dumps({"status": report["status"], "output": str(output)}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
