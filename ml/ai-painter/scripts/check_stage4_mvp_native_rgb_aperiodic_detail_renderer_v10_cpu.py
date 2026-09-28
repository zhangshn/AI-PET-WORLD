from __future__ import annotations

"""Read-only CPU qualification for the bounded V10 detail-recovery candidate."""

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

from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import (  # noqa: E402
    RESPONSIBILITY_IDENTITIES,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset  # noqa: E402
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10 import (  # noqa: E402
    ARCHITECTURE_ID, CAPABILITY_VERSION, CONTRACT_PATH, OBJECT_CROP_IDENTITIES,
    build_renderer, detail_recovery_objective, deterministic_object_crop, load_contract,
    carrier_measurements, require_carrier,
)


OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-aperiodic-detail-renderer-v10-qualifications"
    / "cpu-report.json"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise FileExistsError("CPU qualification evidence already exists")
    staged = path.with_name(path.name + f".staged-{os.getpid()}")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def run() -> dict:
    contract, contract_sha = load_contract(ROOT)
    dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"], "train", (256, 192))
    if len(dataset) != 48:
        raise ValueError("V10 train capacity changed")
    torch.manual_seed(20260928)
    model = build_renderer(ROOT).eval()
    rng_before = torch.get_rng_state().clone()
    before = state_hash(model.state_dict())
    sample = dataset[0]
    conditions = sample["conditions"].unsqueeze(0)
    target = sample["image"].unsqueeze(0)
    predicted, evidence = model(conditions, return_evidence=True)
    loss, components = detail_recovery_objective(
        predicted, target, conditions, model, contract["trainingObjective"],
    )
    if tuple(predicted.shape) != (1, 3, 192, 256):
        raise ValueError("V10 complete RGB output shape invalid")
    if tuple(evidence["detailBasis"].shape) != (1, 20, 192, 256):
        raise ValueError("V10 aperiodic detail basis shape invalid")
    if float(evidence["detailBasis"].std()) <= 0.1:
        raise ValueError("V10 aperiodic detail basis collapsed")
    if not bool(torch.isfinite(loss)) or float(loss.detach()) <= 0:
        raise ValueError("V10 objective is not finite and positive")

    flat = target.mean(dim=(-2, -1), keepdim=True).expand_as(target)
    _, exact_components = detail_recovery_objective(
        target, target, conditions, model, contract["trainingObjective"],
    )
    _, flat_components = detail_recovery_objective(
        flat, target, conditions, model, contract["trainingObjective"],
    )
    detail_names = (
        "detailTextureEnergyLoss", "detailGradientEnergyLoss", "detailLocalVarianceLoss",
    )
    if any(
        float(exact_components[name].detach()) != 0.0
        or float(flat_components[name].detach()) <= 0.0
        for name in detail_names
    ):
        raise ValueError("V10 detail objective does not reject the flat mean solution")

    rules = contract['cpuCarrierQualification']
    measurements = carrier_measurements(evidence['detailBasis'])
    require_carrier(measurements, rules)
    coordinate_x = conditions[:, model.coordinate_indices[0]:model.coordinate_indices[0]+1]
    negative_controls = {
        'axis_fourier': torch.sin(coordinate_x * (16 * torch.pi)),
        'row_stripe': ((torch.arange(192) % 8 < 4).float()[None,None,:,None]).expand(1,1,192,256),
    }
    negatives = {}
    for name, negative in negative_controls.items():
        measured = carrier_measurements(negative)
        try:
            require_carrier(measured, rules)
        except ValueError:
            negatives[name] = {'rejected': True, 'measurements': measured}
        else:
            raise ValueError('V10 stripe negative control was accepted')
    # Renderer cannot open files or consume RGB: only condition tensor enters it.
    from unittest.mock import patch
    with patch('builtins.open', side_effect=AssertionError('inference file read')), patch.object(Path, 'read_bytes', side_effect=AssertionError('inference byte read')):
        repeated = model(conditions)
    if not torch.equal(predicted, repeated):
        raise ValueError('V10 deterministic inference changed')
    selected = {}
    for sample_index in range(len(dataset)):
        candidate = dataset[sample_index]
        candidate_conditions = candidate["conditions"].unsqueeze(0)
        for identity in RESPONSIBILITY_IDENTITIES:
            mask = candidate_conditions[
                :, model.responsibility_indices[identity]:model.responsibility_indices[identity] + 1
            ]
            if identity not in selected and int(mask.count_nonzero()) > 0:
                selected[identity] = (candidate, candidate_conditions)
        if len(selected) == len(RESPONSIBILITY_IDENTITIES):
            break
    if set(selected) != set(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V10 train split lacks a nonempty responsibility sample")
    responsibility_evidence = {}
    for identity, (selected_sample, selected_conditions) in selected.items():
        _, selected_evidence = model(selected_conditions, return_evidence=True)
        mask = selected_evidence["responsibilityMasks"][identity]
        contribution = selected_evidence["responsibilityLogitContributions"][identity]
        outside = float((contribution * (1.0 - mask)).detach().abs().max())
        if outside != 0.0:
            raise ValueError(f"V10 {identity} contribution escaped authoritative mask")
        responsibility_evidence[identity] = {
            "sampleId": selected_sample["sampleId"],
            "maskNonzero": int(mask.count_nonzero()),
            "outsideMaskContributionMaximum": outside,
        }
    crop_histogram = {identity: 0 for identity in OBJECT_CROP_IDENTITIES}
    crop_error = 0.0
    for sample_index in range(len(dataset)):
        sample_for_crop = dataset[sample_index]
        cropped, crop_evidence = deterministic_object_crop(
            sample_for_crop, responsibility_indices=model.responsibility_indices,
            epoch=1, sample_index=sample_index, seed=20260927,
        )
        crop_histogram[crop_evidence["identity"]] += 1
        full_basis = model.detail_basis(sample_for_crop['conditions'][None])
        crop_basis = model.detail_basis(cropped['conditions'][None])
        left, top = crop_evidence['left'], crop_evidence['top']
        delta = float((crop_basis-full_basis[:,:,top:top+64,left:left+64]).abs().max())
        crop_error = max(crop_error, delta)
        if delta > rules['cropAndFullCoordinateFeatureMaximumAbsoluteDifference']:
            raise ValueError('V10 crop coordinates changed carrier')
    if sum(crop_histogram.values()) != 48:
        raise ValueError("V10 crop curriculum does not cover every train sample")
    if not torch.equal(rng_before, torch.get_rng_state()):
        raise ValueError("V10 forward changed RNG")
    after = state_hash(model.state_dict())
    if before != after:
        raise ValueError("V10 CPU qualification modified model state")
    return {
        "schemaVersion": "stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-cpu-report-v1",
        "status": "cpu_contract_passed_training_still_disabled",
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
        "contract": {"path": CONTRACT_PATH, "sha256": contract_sha},
        "dataset": contract["datasetBinding"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": sample["split"]},
        "inputShape": list(conditions.shape),
        "outputShape": list(predicted.shape),
        "detailBasisShape": list(evidence["detailBasis"].shape),
        "detailBasisStandardDeviation": float(evidence["detailBasis"].std()),
        "parameterCount": sum(parameter.numel() for parameter in model.parameters()),
        "objective": {
            "total": float(loss.detach()),
            "fullRgbMae": float(components["fullRgbMae"].detach()),
            "detailTextureEnergyLoss": float(components["detailTextureEnergyLoss"].detach()),
            "detailGradientEnergyLoss": float(components["detailGradientEnergyLoss"].detach()),
            "detailLocalVarianceLoss": float(components["detailLocalVarianceLoss"].detach()),
            "flatMeanRejection": {
                name: {
                    "exact": float(exact_components[name].detach()),
                    "flat": float(flat_components[name].detach()),
                }
                for name in detail_names
            },
        },
        "responsibilityEvidence": responsibility_evidence,
        "cropCurriculum": {
            "sampleCount": 48,
            "cropSize": contract["trainingCurriculum"]["objectCropSize"],
            "identityHistogram": crop_histogram,
            "allCropsContainTargetObject": True,
            "persistentDerivedImagesWritten": False,
        },
        "carrierQualification": {"measurements": measurements, "negativeControls": negatives,
            "cropFullMaximumAbsoluteDifference": crop_error, "referenceRgbAtInference": False,
            "rngUnchanged": True, "scope": "input_carrier_only_not_learned_rgb_or_visual_acceptance"},
        "worldSeedSupport": "fixed_mvp_single_world_coordinate_basis_not_arbitrary_world_seed",
        "stateUnchanged": True,
        "freshInitializationRequired": True,
        "v8CheckpointRead": False,
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
    try:
        torch.set_num_threads(2)
        with torch.inference_mode():
            report = run()
        write_atomic(OUTPUT, report)
        print(json.dumps({
            "status": report["status"], "output": str(OUTPUT),
            "parameterCount": report["parameterCount"],
        }, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({
            "status": "failed_closed", "errorType": type(error).__name__,
            "error": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
