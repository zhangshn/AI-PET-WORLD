"""Read-only CPU feasibility gate for one inactive V12 texture objective."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import sys
import time

import numpy as np
from PIL import Image, ImageFilter
import torch


ROOT = Path(__file__).resolve().parents[3]
for directory in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (  # noqa: E402
    LOCAL_WINDOW, TEXTURE_SCALES, TEXTURE_WEIGHT,
    local_target_texture_moments_loss,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10 import (  # noqa: E402
    build_renderer,
)


CONTRACT = "data/ai-painter/system-governance/stage4-mvp-native-rgb-local-texture-v12-contract.json"
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp_local_texture_v12_cpu.py"
PROBE_ORDINALS = (0, 6, 12, 18, 24, 30, 36, 42)
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-local-texture-v12-cpu-qualifications"
MAX_WALL_SECONDS = 120
MAX_REPORT_BYTES = 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def binding(path: str) -> dict:
    return {"path": path, "sha256": digest(project_file(ROOT, path).read_bytes())}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def gradient_mean(value: torch.Tensor) -> float:
    return float(((value[..., 1:] - value[..., :-1]).abs().mean()
                  + (value[..., 1:, :] - value[..., :-1, :]).abs().mean()) / 2)


def as_tensor(image: Image.Image) -> torch.Tensor:
    return (torch.from_numpy(np.asarray(image, dtype=np.uint8).copy())
            .permute(2, 0, 1).float().unsqueeze(0) / 255)


def target_image(value: torch.Tensor) -> Image.Image:
    pixels = value[0].permute(1, 2, 0).mul(255).round().byte().numpy()
    return Image.fromarray(pixels)


def gradient_matched_noise(blur: torch.Tensor, target: torch.Tensor,
                           seed: int) -> tuple[torch.Tensor, float]:
    noise = torch.randn(blur.shape, generator=torch.Generator().manual_seed(seed))
    lower, upper = 0.0, 0.5
    target_gradient = gradient_mean(target)
    require(target_gradient > 0, "target has no gradient for noise counterexample")
    for _ in range(22):
        middle = (lower + upper) / 2
        candidate = (blur + noise * middle).clamp(0, 1)
        if gradient_mean(candidate) < target_gradient:
            lower = middle
        else:
            upper = middle
    candidate = (blur + noise * upper).clamp(0, 1)
    ratio = gradient_mean(candidate) / target_gradient
    require(abs(ratio - 1) < 0.002, "noise gradient counterexample did not match")
    return candidate, ratio


def verify_contract() -> tuple[dict, Mapping, Mapping, Mapping]:
    contract = bound_json(ROOT, binding(CONTRACT))
    require(contract.get("schemaVersion") == "stage4-mvp-native-rgb-local-texture-v12-contract-v1"
            and contract.get("status") == "cpu_candidate_not_execution_qualified",
            "inactive V12 candidate identity changed")
    gates = contract.get("activationGates", {})
    require(gates == {"cpuPrototypeNow": True, "gpuQualificationNow": False,
                      "optimizerNow": False, "trainingNow": False,
                      "checkpointPromotionNow": False}, "V12 activation gate changed")
    objective = contract.get("trainingObjective", {})
    require(objective.get("auxiliaryWeight") == TEXTURE_WEIGHT
            and objective.get("scaleFactors") == list(TEXTURE_SCALES)
            and objective.get("localMomentWindow") == LOCAL_WINDOW
            and objective.get("unlocalizedEnergyRewardAllowed") is False
            and objective.get("validationOrReviewPixelsAsOptimizerTargetsAllowed") is False,
            "V12 local objective contract changed")
    require(contract.get("cpuQualificationRequired", {}).get("trainProbeOrdinals")
            == list(PROBE_ORDINALS), "V12 eight-train probe set changed")
    require(contract.get("cpuQualificationRequired", {}).get("maxWallSeconds")
            == MAX_WALL_SECONDS, "V12 CPU wall limit changed")
    require(contract.get("cpuQualificationRequired", {}).get("maxReportBytes")
            == MAX_REPORT_BYTES, "V12 report limit changed")
    require(any(p.get("path") == PROGRAM for p in contract["programBindings"]),
            "V12 CPU checker program not bound")
    for item in contract["programBindings"]:
        read_bound(ROOT, item)
    v11 = bound_json(ROOT, contract["baseCandidateContract"])
    parent = bound_json(ROOT, contract["parentFailedCandidate"])
    require(v11.get("capabilityVersion")
            == "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
            and v11.get("datasetBinding", {}).get("sha256")
            == contract["datasetManifest"]["sha256"], "V11 parent contract changed")
    require(parent.get("executionState") == "failed_closed"
            and parent.get("candidatePassCount") == 0
            and parent.get("candidateFailCount") == 8
            and parent.get("formalQualificationGranted") is False,
            "V11 failure terminal changed")
    v10 = bound_json(ROOT, v11["parentFailureEvidence"])
    require(v10.get("executionState") == "failed_closed"
            and v10.get("candidatePassCount") == 0
            and v10.get("candidateFailCount") == 8,
            "V10 speckle counterexample terminal changed")
    return contract, v11, parent, v10


def run() -> dict:
    started = time.monotonic()
    torch.set_num_threads(4)
    contract, _, _, v10 = verify_contract()
    dataset = SplitReleaseDataset(ROOT, contract["datasetManifest"], "train", (256, 192))
    require(len(dataset) == 48
            and dataset.manifest["qualification"]["dataQualifiedForTraining"] is True,
            "V12 CPU probe source is not the qualified 48-item train split")
    checkpoint_bytes = read_bound(ROOT, v10["checkpoint"])
    checkpoint = torch.load(BytesIO(checkpoint_bytes), map_location="cpu", weights_only=True)
    require(state_hash(checkpoint["modelState"]) == checkpoint["modelStateSha256"],
            "V10 checkpoint state hash changed")
    require(checkpoint.get("datasetManifest") == {
        key: contract["datasetManifest"][key] for key in ("path", "sha256")
    }, "V10 counterexample was trained on a different dataset")
    model = build_renderer(ROOT)
    model.load_state_dict(checkpoint["modelState"], strict=True)
    model.eval()
    rows = []
    for index in PROBE_ORDINALS:
        require(time.monotonic() - started < MAX_WALL_SECONDS,
                "V12 CPU feasibility wall limit exceeded")
        sample = dataset[index]
        target = sample["image"].unsqueeze(0)
        with torch.no_grad():
            historical = model(sample["conditions"].unsqueeze(0))
        blur = as_tensor(target_image(target).filter(ImageFilter.GaussianBlur(2)))
        noise, ratio = gradient_matched_noise(blur, target, 20260926 + index)
        scores = {
            "target": float(local_target_texture_moments_loss(target, target)),
            "blur": float(local_target_texture_moments_loss(blur, target)),
            "gradientMatchedNoise": float(local_target_texture_moments_loss(noise, target)),
            "historicalV10": float(local_target_texture_moments_loss(historical, target)),
        }
        require(scores["target"] == 0
                and scores["gradientMatchedNoise"] > scores["blur"]
                and scores["historicalV10"] > scores["blur"],
                f"V12 texture discriminator failed train ordinal {index}")
        rows.append({"ordinal": index, "sampleId": sample["sampleId"],
                     "scoresLowerIsBetter": scores, "noiseGradientRatio": ratio})
    require(time.monotonic() - started < MAX_WALL_SECONDS,
            "V12 CPU feasibility wall limit exceeded")
    program = binding(PROGRAM)
    policy = binding(CONTRACT)
    identity = "cpu-v12-" + digest((program["sha256"] + policy["sha256"]
                                   + v10["checkpoint"]["sha256"]).encode())[:48]
    report = {
        "schemaVersion": "stage4-mvp-local-texture-v12-cpu-feasibility-v1",
        "status": "cpu_feasibility_passed_not_gpu_or_training_qualified",
        "identity": identity, "contract": policy, "program": program,
        "datasetManifest": contract["datasetManifest"],
        "historicalV10Checkpoint": v10["checkpoint"],
        "trainOnly": True, "validationRead": False, "challengeRead": False,
        "regressionRead": False, "optimizerCreated": False,
        "gpuStarted": False, "trainingStarted": False,
        "formalQualificationGranted": False,
        "rows": rows,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    encoded = (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    require(len(encoded) <= MAX_REPORT_BYTES, "V12 CPU report size cap exceeded")
    output = project_file(ROOT, f"{OUTPUT_PARENT}/{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    return {"status": report["status"], "report": binding(output.relative_to(ROOT).as_posix()),
            "trainNegativeCases": len(rows)}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
