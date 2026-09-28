from __future__ import annotations

from datetime import datetime, timezone
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
    ARCHITECTURE_ID,
    CAPABILITY_VERSION,
    CONTRACT_PATH,
    build_renderer,
    load_contract,
    native_rgb_objective,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + f".staged-{os.getpid()}")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def run() -> dict:
    contract, contract_sha = load_contract(ROOT)
    dataset = SplitReleaseDataset(
        ROOT, contract["datasetBinding"], "train", (256, 192)
    )
    sample = dataset[0]
    conditions = sample["conditions"].unsqueeze(0)
    target = sample["image"].unsqueeze(0)
    torch.manual_seed(20260924)
    model = build_renderer(ROOT)
    before = state_hash(model.state_dict())
    predicted, evidence = model(conditions, return_evidence=True)
    loss, components = native_rgb_objective(
        predicted, target, conditions, model, contract["trainingObjective"]
    )
    selected = {}
    for index in range(len(dataset)):
        candidate = dataset[index]
        candidate_conditions = candidate["conditions"].unsqueeze(0)
        for identity in RESPONSIBILITY_IDENTITIES:
            mask = candidate_conditions[:, model.responsibility_indices[identity]:model.responsibility_indices[identity] + 1]
            if identity not in selected and int(mask.count_nonzero()) > 0:
                selected[identity] = (candidate, candidate_conditions)
        if len(selected) == len(RESPONSIBILITY_IDENTITIES):
            break
    if set(selected) != set(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V6 train split lacks a nonempty responsibility sample")
    head_evidence = {}
    for identity in RESPONSIBILITY_IDENTITIES:
        selected_sample, selected_conditions = selected[identity]
        _, selected_evidence = model(selected_conditions, return_evidence=True)
        contribution = selected_evidence["responsibilityLogitContributions"][identity]
        parameters = tuple(model.responsibility_heads[identity].parameters())
        gradients = torch.autograd.grad(
            contribution.sum(), parameters, retain_graph=True, allow_unused=False
        )
        head_evidence[identity] = {
            "sampleId": selected_sample["sampleId"],
            "split": selected_sample["split"],
            "maskNonzero": int(selected_evidence["responsibilityMasks"][identity].count_nonzero()),
            "outsideMaskContributionMaximum": float(
                (contribution * (1.0 - selected_evidence["responsibilityMasks"][identity])).detach().abs().max()
            ),
            "parameterGradientFinite": all(bool(torch.isfinite(value).all()) for value in gradients),
            "parameterGradientAbsoluteSum": sum(float(value.abs().sum()) for value in gradients),
        }
    after = state_hash(model.state_dict())
    if tuple(predicted.shape) != (1, 3, 192, 256):
        raise ValueError("V6 CPU complete RGB output shape is invalid")
    if not bool(torch.isfinite(loss)) or float(loss.detach()) <= 0:
        raise ValueError("V6 CPU objective is not finite and positive")
    if before != after:
        raise ValueError("V6 CPU qualification modified model state")
    if any(
        row["maskNonzero"] <= 0
        or row["outsideMaskContributionMaximum"] != 0.0
        or row["parameterGradientFinite"] is not True
        or row["parameterGradientAbsoluteSum"] <= 0.0
        for row in head_evidence.values()
    ):
        raise ValueError("V6 CPU responsibility evidence failed")
    return {
        "schemaVersion": "stage4-mvp-native-complete-rgb-renderer-v6-cpu-report-v1",
        "status": "cpu_contract_passed_training_still_disabled",
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
        "contract": {"path": CONTRACT_PATH, "sha256": contract_sha},
        "dataset": contract["datasetBinding"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": sample["split"]},
        "inputShape": list(conditions.shape),
        "outputShape": list(predicted.shape),
        "parameterCount": sum(parameter.numel() for parameter in model.parameters()),
        "objective": {
            "total": float(loss.detach()),
            "fullRgbMae": float(components["fullRgbMae"].detach()),
            "fullRgbGradientMae": float(components["fullRgbGradientMae"].detach()),
            "fullRgbLaplacianMae": float(components["fullRgbLaplacianMae"].detach()),
            "responsibilityRgbMae": {
                key: float(value.detach())
                for key, value in components["responsibilityRgbMae"].items()
            },
        },
        "responsibilityEvidence": head_evidence,
        "stateUnchanged": True,
        "autoencoderPresent": False,
        "diffusionPresent": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "challengeRead": False,
        "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": utc_now(),
    }


def main() -> int:
    output = ROOT / ".runtime" / "ai-painter" / "stage4-mvp-native-rgb-renderer-v6-qualifications" / "cpu-report.json"
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
