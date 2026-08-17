from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path

import torch

import compile_stage4_object_reference_multiscale_luminance_structure_supervision_config as compiler
import train_ai_assisted_conditional_denoiser as trainer


CONTRACT_KEY = "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"
SPARSE_FALLBACK_AUTH_SCHEMA = (
    "ai-painter-owner-stage4-multiscale-sparse-support-preserving-mask-fallback-v1"
)
SPARSE_FALLBACK_CONSUMPTION_STATUS = (
    "stage4_multiscale_sparse_support_preserving_mask_fallback_authorization_atomically_consumed"
)
LUMINANCE_VARIATION_FALLBACK_AUTH_SCHEMA = (
    "ai-painter-owner-stage4-multiscale-reference-luminance-variation-preserving-mask-fallback-v1"
)
LUMINANCE_VARIATION_FALLBACK_CONSUMPTION_STATUS = (
    "stage4_multiscale_reference_luminance_variation_preserving_mask_fallback_"
    "authorization_atomically_consumed"
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_sparse_fallback_implementation_authority(args):
    authorization_path = args.implementation_authorization.resolve()
    consumption_path = args.implementation_consumption.resolve()
    if sha256_file(authorization_path) != args.implementation_authorization_sha256:
        raise ValueError("sparse fallback implementation authorization SHA-256 changed")
    if sha256_file(consumption_path) != args.implementation_consumption_sha256:
        raise ValueError("sparse fallback implementation consumption SHA-256 changed")
    authorization = json.loads(authorization_path.read_text(encoding="utf-8"))
    consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
    if authorization.get("schemaVersion") != SPARSE_FALLBACK_AUTH_SCHEMA:
        raise ValueError("sparse fallback implementation authorization schema is invalid")
    if authorization.get("status") != "owner_authorized_unconsumed":
        raise ValueError("sparse fallback immutable authorization source status changed")
    if consumption.get("status") != SPARSE_FALLBACK_CONSUMPTION_STATUS:
        raise ValueError("sparse fallback implementation authorization is not consumed")
    for field in ("requestId", "commandRef", "scope"):
        if consumption.get(field) != authorization.get(field):
            raise ValueError(f"sparse fallback implementation lineage changed: {field}")
    if consumption.get("authorizationSha256") != args.implementation_authorization_sha256:
        raise ValueError("sparse fallback consumption authorization identity changed")
    if consumption.get("oneTimeConsumption") is not True:
        raise ValueError("sparse fallback implementation was not atomically consumed")
    return authorization, consumption


def validate_luminance_variation_fallback_implementation_authority(args):
    authorization_path = args.implementation_authorization.resolve()
    consumption_path = args.implementation_consumption.resolve()
    if sha256_file(authorization_path) != args.implementation_authorization_sha256:
        raise ValueError("luminance variation fallback implementation authorization SHA-256 changed")
    if sha256_file(consumption_path) != args.implementation_consumption_sha256:
        raise ValueError("luminance variation fallback implementation consumption SHA-256 changed")
    authorization = json.loads(authorization_path.read_text(encoding="utf-8"))
    consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
    if authorization.get("schemaVersion") != LUMINANCE_VARIATION_FALLBACK_AUTH_SCHEMA:
        raise ValueError("luminance variation fallback implementation authorization schema is invalid")
    if authorization.get("status") != "owner_authorized_unconsumed":
        raise ValueError("luminance variation fallback immutable authorization source status changed")
    if consumption.get("status") != LUMINANCE_VARIATION_FALLBACK_CONSUMPTION_STATUS:
        raise ValueError("luminance variation fallback implementation authorization is not consumed")
    for field in ("requestId", "commandRef", "scope"):
        if consumption.get(field) != authorization.get(field):
            raise ValueError(f"luminance variation fallback lineage changed: {field}")
    if consumption.get("authorizationSha256") != args.implementation_authorization_sha256:
        raise ValueError("luminance variation fallback consumption authorization identity changed")
    if consumption.get("oneTimeConsumption") is not True:
        raise ValueError("luminance variation fallback implementation was not atomically consumed")
    return authorization, consumption


def reference_luminance_energy(target_rgb, mask) -> float:
    coefficients = target_rgb.new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    luminance = (target_rgb * coefficients).sum(dim=1, keepdim=True)
    support = mask.sum()
    if float(support) <= 1.0:
        return 0.0
    mean = (luminance * mask).sum() / support
    centered = (luminance - mean) * mask
    return float(centered.square().sum())


def audit_sparse_support_fallback(config: dict, dataset_manifest: Path) -> dict:
    order = list(config["conditionChannelOrder"])
    image_size = (256, 192)
    splits = ("train", "validation", "challenge", "regression")
    scales = (1.0, 0.5, 0.25)
    entries = []
    fallback_entries = []
    for split in splits:
        dataset = trainer.AiAssistedConditionalDenoiserDataset(
            dataset_manifest,
            split,
            order,
            image_size,
            selection_contract="registered_v7_capacity_contribution_v1",
        )
        for sample_index in range(len(dataset)):
            row = dataset[sample_index]
            target = row["image"].unsqueeze(0)
            conditions = row["conditions"].unsqueeze(0)
            for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS:
                mask = conditions[:, order.index(channel):order.index(channel) + 1]
                for scale in scales:
                    size = (
                        max(2, round(target.shape[-2] * scale)),
                        max(2, round(target.shape[-1] * scale)),
                    )
                    nearest = torch.nn.functional.interpolate(mask, size=size, mode="nearest")
                    area = torch.nn.functional.interpolate(mask, size=size, mode="area")
                    resolved = trainer._stage4_resolve_multiscale_support_mask(mask, size)
                    nearest_support = float(nearest.sum())
                    area_support = float(area.sum())
                    area_nonzero = int(torch.count_nonzero(area))
                    fallback_used = nearest_support <= 1.0
                    expected = area if fallback_used else nearest
                    if not torch.equal(resolved, expected):
                        raise ValueError("shared sparse support mask resolver changed its selected mask")
                    target_masked = target * mask
                    target_scale = (
                        target_masked
                        if size == target.shape[-2:]
                        else torch.nn.functional.interpolate(
                            target_masked, size=size, mode="bilinear", align_corners=False,
                        )
                    )
                    energy = reference_luminance_energy(target_scale, resolved)
                    entry = {
                        "split": split,
                        "sampleId": row["sampleId"],
                        "objectClass": channel,
                        "scale": scale,
                        "nearestSupport": nearest_support,
                        "areaSupport": area_support,
                        "areaNonzeroPositions": area_nonzero,
                        "selectedMode": "area" if fallback_used else "nearest",
                        "selectedSupport": float(resolved.sum()),
                        "referenceLuminanceEnergy": energy,
                    }
                    entries.append(entry)
                    if fallback_used:
                        fallback_entries.append(entry)
    if len(entries) != 64 * 4 * 3:
        raise ValueError("sparse support audit did not cover all 64 records, four classes and three scales")
    expected_id = "ai-cold-start-v7-v7-capacity-slot-164-bamboo-grove-v2"
    if len(fallback_entries) != 1:
        raise ValueError(f"unexpected sparse fallback count: {len(fallback_entries)}")
    fallback = fallback_entries[0]
    if not (
        fallback["split"] == "train"
        and fallback["sampleId"] == expected_id
        and fallback["objectClass"] == "object_rock"
        and fallback["scale"] == 0.25
        and fallback["nearestSupport"] == 1.0
        and abs(fallback["areaSupport"] - 2.25) <= 1e-7
        and fallback["areaNonzeroPositions"] == 5
        and abs(fallback["referenceLuminanceEnergy"] - 0.010511141270399094) <= 1e-7
    ):
        raise ValueError(f"unique sparse fallback identity changed: {fallback}")
    return {
        "recordCount": 64,
        "objectClassCount": 4,
        "scaleCount": 3,
        "auditedEntryCount": len(entries),
        "nearestUnchangedEntryCount": len(entries) - len(fallback_entries),
        "fallbackEntryCount": len(fallback_entries),
        "fallbackEntries": fallback_entries,
    }


def run_sparse_support_audit(args) -> int:
    authorization, consumption = validate_sparse_fallback_implementation_authority(args)
    config_path = args.sparse_support_audit_config.resolve()
    dataset_manifest = args.dataset_package.resolve()
    if sha256_file(config_path) != args.sparse_support_audit_config_sha256:
        raise ValueError("sparse support audit config SHA-256 changed")
    if sha256_file(dataset_manifest) != args.dataset_package_sha256:
        raise ValueError("sparse support audit dataset Manifest SHA-256 changed")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    audit = audit_sparse_support_fallback(config, dataset_manifest)

    empty = torch.zeros((1, 1, 192, 256), dtype=torch.float32)
    singleton = empty.clone()
    singleton[:, :, 0, 0] = 1.0
    negatives = {}
    for name, mask in (("empty_original_mask_rejected", empty), ("area_still_insufficient_rejected", singleton)):
        try:
            trainer._stage4_resolve_multiscale_support_mask(mask, (48, 64))
            negatives[name] = False
        except ValueError:
            negatives[name] = True
    try:
        predicted = torch.rand((1, 3, 192, 256), dtype=torch.float32, requires_grad=True)
        target = torch.zeros_like(predicted)
        conditions = torch.zeros((1, 23, 192, 256), dtype=torch.float32)
        rock_index = config["conditionChannelOrder"].index("object_rock")
        conditions[:, rock_index, 10:16, 10:16] = 1.0
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            predicted, target, conditions, config,
        )
        negatives["zero_reference_luminance_variation_rejected"] = False
    except ValueError:
        negatives["zero_reference_luminance_variation_rejected"] = True
    if not all(negatives.values()):
        raise ValueError(f"sparse fallback negative checks failed: {negatives}")

    report = {
        "schemaVersion": "stage4-multiscale-sparse-support-preserving-mask-fallback-cpu-report-v1",
        "status": "stage4_multiscale_sparse_support_preserving_mask_fallback_cpu_passed",
        "implementationAuthorization": {
            "path": authorization.get("requestId"),
            "sha256": args.implementation_authorization_sha256,
            "consumptionSha256": args.implementation_consumption_sha256,
            "oneTimeConsumption": consumption.get("oneTimeConsumption"),
        },
        "datasetManifest": {
            "path": dataset_manifest.as_posix(),
            "sha256": args.dataset_package_sha256,
        },
        "activeConfig": {
            "path": config_path.as_posix(),
            "sha256": args.sparse_support_audit_config_sha256,
        },
        "audit": audit,
        "negativeChecks": negatives,
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "gpuUsed": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "trainingStarted": False,
        },
    }
    output = args.output_path.resolve()
    output.parent.mkdir(parents=True, exist_ok=False)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


def audit_reference_luminance_variation_fallback(config: dict, dataset_manifest: Path) -> dict:
    order = list(config["conditionChannelOrder"])
    entries = []
    fallback_entries = []
    for split in ("train", "validation", "challenge", "regression"):
        dataset = trainer.AiAssistedConditionalDenoiserDataset(
            dataset_manifest,
            split,
            order,
            (256, 192),
            selection_contract="registered_v7_capacity_contribution_v1",
        )
        for sample_index in range(len(dataset)):
            row = dataset[sample_index]
            target = row["image"].unsqueeze(0)
            conditions = row["conditions"].unsqueeze(0)
            for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS:
                mask = conditions[:, order.index(channel):order.index(channel) + 1]
                for scale in (1.0, 0.5, 0.25):
                    size = (
                        max(2, round(target.shape[-2] * scale)),
                        max(2, round(target.shape[-1] * scale)),
                    )
                    target_masked = target * mask
                    target_scale = (
                        target_masked
                        if size == target.shape[-2:]
                        else torch.nn.functional.interpolate(
                            target_masked, size=size, mode="bilinear", align_corners=False,
                        )
                    )
                    primary = trainer._stage4_resolve_multiscale_support_mask(mask, size)
                    resolved = trainer._stage4_resolve_multiscale_support_mask(
                        mask, size, target_rgb=target_scale,
                    )
                    area = torch.nn.functional.interpolate(mask, size=size, mode="area")
                    primary_energy = reference_luminance_energy(target_scale, primary)
                    area_energy = reference_luminance_energy(target_scale, area)
                    fallback_used = not torch.equal(primary, resolved)
                    entry = {
                        "split": split,
                        "sampleId": row["sampleId"],
                        "objectClass": channel,
                        "scale": scale,
                        "primarySupport": float(primary.sum()),
                        "primaryReferenceLuminanceEnergy": primary_energy,
                        "areaSupport": float(area.sum()),
                        "areaNonzeroPositions": int(torch.count_nonzero(area)),
                        "areaReferenceLuminanceEnergy": area_energy,
                        "selectedMode": "area_luminance_variation_fallback" if fallback_used else "primary",
                    }
                    entries.append(entry)
                    if fallback_used:
                        fallback_entries.append(entry)
    if len(entries) != 64 * 4 * 3:
        raise ValueError("luminance variation audit did not cover all records/classes/scales")
    if len(fallback_entries) != 1:
        raise ValueError(f"unexpected luminance variation fallback count: {len(fallback_entries)}")
    fallback = fallback_entries[0]
    expected_id = "ai-cold-start-v7-v7-capacity-slot-198-grassland-forest-transition-v4"
    if not (
        fallback["split"] == "validation"
        and fallback["sampleId"] == expected_id
        and fallback["objectClass"] == "object_rock"
        and fallback["scale"] == 0.25
        and fallback["primarySupport"] == 3.0
        and fallback["primaryReferenceLuminanceEnergy"] == 0.0
        and abs(fallback["areaSupport"] - 3.375) <= 1e-7
        and fallback["areaNonzeroPositions"] == 13
        and abs(
            fallback["areaReferenceLuminanceEnergy"] - 0.028859881684184074
        ) <= 1e-7
    ):
        raise ValueError(f"unique luminance variation fallback identity changed: {fallback}")
    return {
        "recordCount": 64,
        "objectClassCount": 4,
        "scaleCount": 3,
        "auditedEntryCount": len(entries),
        "primaryUnchangedEntryCount": len(entries) - len(fallback_entries),
        "fallbackEntryCount": len(fallback_entries),
        "fallbackEntries": fallback_entries,
    }


def run_reference_luminance_variation_audit(args) -> int:
    authorization, consumption = (
        validate_luminance_variation_fallback_implementation_authority(args)
    )
    config_path = args.sparse_support_audit_config.resolve()
    dataset_manifest = args.dataset_package.resolve()
    if sha256_file(config_path) != args.sparse_support_audit_config_sha256:
        raise ValueError("luminance variation audit config SHA-256 changed")
    if sha256_file(dataset_manifest) != args.dataset_package_sha256:
        raise ValueError("luminance variation audit dataset Manifest SHA-256 changed")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    audit = audit_reference_luminance_variation_fallback(config, dataset_manifest)
    target = torch.zeros((1, 3, 48, 64), dtype=torch.float32)
    mask = torch.zeros((1, 1, 192, 256), dtype=torch.float32)
    mask[:, :, 8:32, 8:32] = 1.0
    negatives = {}
    try:
        trainer._stage4_resolve_multiscale_support_mask(
            mask, (48, 64), target_rgb=target,
        )
        negatives["area_with_zero_reference_variation_rejected"] = False
    except ValueError:
        negatives["area_with_zero_reference_variation_rejected"] = True
    if not all(negatives.values()):
        raise ValueError(f"luminance variation fallback negatives failed: {negatives}")
    report = {
        "schemaVersion": "stage4-multiscale-reference-luminance-variation-preserving-mask-fallback-cpu-report-v1",
        "status": "stage4_multiscale_reference_luminance_variation_preserving_mask_fallback_cpu_passed",
        "implementationAuthorization": {
            "requestId": authorization.get("requestId"),
            "sha256": args.implementation_authorization_sha256,
            "consumptionSha256": args.implementation_consumption_sha256,
            "oneTimeConsumption": consumption.get("oneTimeConsumption"),
        },
        "datasetManifest": {
            "path": dataset_manifest.as_posix(),
            "sha256": args.dataset_package_sha256,
        },
        "activeConfig": {
            "path": config_path.as_posix(),
            "sha256": args.sparse_support_audit_config_sha256,
        },
        "audit": audit,
        "negativeChecks": negatives,
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "gpuUsed": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "trainingStarted": False,
        },
    }
    output = args.output_path.resolve()
    output.parent.mkdir(parents=True, exist_ok=False)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


def rejected(config: dict, mutation) -> bool:
    value = deepcopy(config)
    mutation(value)
    try:
        trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            value
        )
    except (KeyError, TypeError, ValueError):
        return True
    return False


def synthetic_forward(config: dict) -> dict:
    order = list(config["conditionChannelOrder"])
    size = 32
    conditions = torch.zeros((1, len(order), size, size), dtype=torch.float32)
    boxes = {
        "object_footprints": (slice(2, 10), slice(2, 10)),
        "object_tree": (slice(2, 10), slice(22, 30)),
        "object_rock": (slice(22, 30), slice(2, 10)),
        "object_vegetation": (slice(22, 30), slice(22, 30)),
    }
    target = torch.zeros((1, 3, size, size), dtype=torch.float32)
    yy, xx = torch.meshgrid(
        torch.linspace(0.0, 1.0, size),
        torch.linspace(0.0, 1.0, size),
        indexing="ij",
    )
    for index, channel in enumerate(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS):
        rows, columns = boxes[channel]
        conditions[:, order.index(channel), rows, columns] = 1.0
        target[:, 0, rows, columns] = xx[rows, columns] * (0.32 + index * 0.05)
        target[:, 1, rows, columns] = yy[rows, columns] * (0.43 + index * 0.04)
        target[:, 2, rows, columns] = (
            xx[rows, columns] + 2.0 * yy[rows, columns]
        ) * (0.10 + index * 0.01)
    predicted = (
        target * 0.72
        + torch.roll(target, shifts=1, dims=-1) * 0.18
        + torch.roll(target, shifts=1, dims=-2) * 0.10
    ).requires_grad_(True)
    result = trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
        predicted, target, conditions, config,
    )
    perfect = trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
        target.clone().requires_grad_(True), target, conditions, config,
    )
    union = torch.zeros((1, 1, size, size), dtype=torch.float32)
    for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS:
        union = torch.maximum(union, conditions[:, order.index(channel):order.index(channel) + 1])
    outside_changed = predicted.detach().clone() + (1.0 - union) * 7.0
    outside_changed.requires_grad_(True)
    outside_result = (
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            outside_changed, target, conditions, config,
        )
    )
    return {
        "result": result,
        "perfect": perfect,
        "outsideResult": outside_result,
        "predicted": predicted,
        "target": target,
        "conditions": conditions,
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--source-sha256")
    parser.add_argument("--authorization", type=Path)
    parser.add_argument("--authorization-sha256")
    parser.add_argument("--consumption", type=Path)
    parser.add_argument("--consumption-sha256")
    parser.add_argument("--sparse-support-audit", action="store_true")
    parser.add_argument("--reference-luminance-variation-audit", action="store_true")
    parser.add_argument("--sparse-support-audit-config", type=Path)
    parser.add_argument("--sparse-support-audit-config-sha256")
    parser.add_argument("--dataset-package", type=Path)
    parser.add_argument("--dataset-package-sha256")
    parser.add_argument("--implementation-authorization", type=Path)
    parser.add_argument("--implementation-authorization-sha256")
    parser.add_argument("--implementation-consumption", type=Path)
    parser.add_argument("--implementation-consumption-sha256")
    parser.add_argument("--output-path", type=Path)
    args = parser.parse_args()
    if args.reference_luminance_variation_audit:
        required = (
            "sparse_support_audit_config",
            "sparse_support_audit_config_sha256",
            "dataset_package",
            "dataset_package_sha256",
            "implementation_authorization",
            "implementation_authorization_sha256",
            "implementation_consumption",
            "implementation_consumption_sha256",
            "output_path",
        )
        missing = [name for name in required if getattr(args, name) is None]
        if missing:
            raise ValueError(f"luminance variation audit arguments are missing: {missing}")
        return run_reference_luminance_variation_audit(args)
    if args.sparse_support_audit:
        required = (
            "sparse_support_audit_config",
            "sparse_support_audit_config_sha256",
            "dataset_package",
            "dataset_package_sha256",
            "implementation_authorization",
            "implementation_authorization_sha256",
            "implementation_consumption",
            "implementation_consumption_sha256",
            "output_path",
        )
        missing = [name for name in required if getattr(args, name) is None]
        if missing:
            raise ValueError(f"sparse support audit arguments are missing: {missing}")
        return run_sparse_support_audit(args)
    required = (
        "source", "source_sha256", "authorization", "authorization_sha256",
        "consumption", "consumption_sha256",
    )
    missing = [name for name in required if getattr(args, name) is None]
    if missing:
        raise ValueError(f"legacy multiscale CPU arguments are missing: {missing}")
    authorization, consumption = compiler.validate_authorization(
        args.authorization.resolve(), args.authorization_sha256,
        args.consumption.resolve(), args.consumption_sha256,
    )
    source = compiler.read_json(args.source.resolve())
    fragment, built = compiler.compile_inactive_fragment(
        source, args.source.resolve(), args.source_sha256, authorization, consumption,
    )
    config = built["config"]
    contract = config["training"][CONTRACT_KEY]
    forward = synthetic_forward(config)
    result = forward["result"]
    perfect = forward["perfect"]
    outside = forward["outsideResult"]
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation")
    suffixes = (
        "NativeLuminanceCorrelationLoss",
        "HalfLuminanceCorrelationLoss",
        "QuarterLuminanceCorrelationLoss",
        "CrossScaleStructureConsistencyLoss",
        "MultiscaleLuminanceStructureLoss",
    )
    expected_metrics = {
        f"stage4SemanticMixture{prefix}FinalTyped{suffix}"
        for prefix in prefixes
        for suffix in suffixes
    }
    existing_weights = trainer.derive_stage4_per_class_final_visible_rgb_weights(config)[
        "weights"
    ]
    object_means_exact = True
    for prefix in prefixes:
        components = [
            result["losses"][
                f"stage4SemanticMixture{prefix}FinalTyped{suffix}"
            ]
            for suffix in suffixes[:-1]
        ]
        aggregate = result["losses"][
            f"stage4SemanticMixture{prefix}FinalTypedMultiscaleLuminanceStructureLoss"
        ]
        object_means_exact = object_means_exact and torch.allclose(
            aggregate, torch.stack(components).mean(), atol=1e-7, rtol=1e-7,
        )
    positives = {
        "compiled_fragment_inactive": fragment["status"] == "cpu_support_verified_inactive",
        "formal_activation_closed": fragment["activationAuthorized"] is False,
        "training_closed": fragment["trainingAuthorized"] is False,
        "gpu_closed": fragment["gpuAuthorized"] is False,
        "failed_single_scale_contract_removed": (
            fragment["replacesFailedContract"]
            == trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID
            and "stage4ObjectVisibleStructureSupervision" not in config["training"]
        ),
        "novel_contract_identity": (
            contract["contractId"]
            == trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID
        ),
        "exact_four_channels": (
            tuple(contract["sourceChannels"])
            == trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS
        ),
        "existing_pyramid_exactly_inherited": contract["pyramidScales"] == [1.0, 0.5, 0.25],
        "existing_weights_reused": contract["derivedWeights"] == {
            key: existing_weights[key]
            for key in ("footprints", "tree", "rock", "vegetation")
        },
        "no_free_weight_selected": (
            contract["weightDerivation"]["freeValueSelectionAllowed"] is False
            and contract["aggregation"]["freeNumericalWeightSelectionAllowed"] is False
        ),
        "review_thresholds_unchanged": contract["compatibility"]["reviewThresholdsChanged"] is False,
        "failed_preview_targets_rejected": contract["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] is False,
        "failed_checkpoint_weights_closed": contract["legalSupervision"]["failedCheckpointWeightsReadOrLoaded"] is False,
        "forward_metric_identity_exact": set(result["losses"]) == expected_metrics,
        "forward_losses_finite": all(
            math.isfinite(float(value.detach())) for value in result["losses"].values()
        ),
        "forward_total_finite": math.isfinite(float(result["weightedTotalTensor"].detach())),
        "future_gradient_path_present_without_backward": result["weightedTotalTensor"].requires_grad is True,
        "perfect_reference_losses_zero": all(
            abs(float(value.detach())) <= 1e-6 for value in perfect["losses"].values()
        ),
        "per_object_aggregation_is_structural_mean": object_means_exact,
        "mask_bounded_outside_change_invariant": all(
            torch.allclose(result["losses"][name], outside["losses"][name], atol=1e-7, rtol=1e-7)
            for name in expected_metrics
        ),
        "diagnostic_registry_exact": expected_metrics.issubset(
            trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)
        ),
        "water_and_path_preserved": contract["compatibility"]["waterAndPathBehaviorPreserved"] is True,
    }
    mutations = {
        "disabled_rejected": lambda value: value["training"][CONTRACT_KEY].update(enabled=False),
        "active_without_execution_rejected": lambda value: value["training"][CONTRACT_KEY].update(status="training_loss_active_owner_authorized"),
        "channel_order_rejected": lambda value: value["training"][CONTRACT_KEY].update(sourceChannels=list(reversed(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS))),
        "luminance_coefficients_rejected": lambda value: value["training"][CONTRACT_KEY].update(luminanceCoefficients=[1.0, 0.0, 0.0]),
        "pyramid_scales_rejected": lambda value: value["training"][CONTRACT_KEY].update(pyramidScales=[1.0, 0.5]),
        "source_pyramid_change_rejected": lambda value: value["training"].update(textureHierarchyScales=[1.0, 0.5]),
        "per_scale_loss_identity_rejected": lambda value: value["training"][CONTRACT_KEY].update(perScaleLossFunction="single_scale_reuse"),
        "cross_scale_loss_identity_rejected": lambda value: value["training"][CONTRACT_KEY].update(crossScaleLossFunction="none"),
        "free_aggregation_weight_rejected": lambda value: value["training"][CONTRACT_KEY]["aggregation"].update(freeNumericalWeightSelectionAllowed=True),
        "derived_weight_change_rejected": lambda value: value["training"][CONTRACT_KEY]["derivedWeights"].update(tree=9.0),
        "failed_single_scale_reuse_rejected": lambda value: value["training"].update(stage4ObjectVisibleStructureSupervision={}),
        "single_object_duplicate_rejected": lambda value: value["training"].update(stage4VegetationLuminanceSpatialStructureSupervision={}),
        "novelty_reuse_rejected": lambda value: value["training"][CONTRACT_KEY]["noveltyBoundary"].update(failedSingleScaleContractReuseAllowed=True),
        "failed_preview_target_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(failedPreviewPixelsUsedAsTargets=True),
        "failed_checkpoint_read_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(failedCheckpointWeightsReadOrLoaded=True),
        "threshold_change_rejected": lambda value: value["training"][CONTRACT_KEY]["compatibility"].update(reviewThresholdsChanged=True),
        "water_path_change_rejected": lambda value: value["training"][CONTRACT_KEY]["compatibility"].update(waterAndPathBehaviorPreserved=False),
        "architecture_change_rejected": lambda value: value.update(denoiserArchitecture="other"),
        "evidence_change_rejected": lambda value: value["training"][CONTRACT_KEY]["evidenceBindings"]["formalDesign"].update(sha256="0" * 64),
        "authorization_change_rejected": lambda value: value["training"][CONTRACT_KEY]["ownerImplementationAuthorization"].update(authorizationSha256="0" * 64),
        "activation_gate_rejected": lambda value: value["training"][CONTRACT_KEY]["activationGate"].update(trainingNow=True),
        "unknown_field_rejected": lambda value: value["training"][CONTRACT_KEY].update(freeField=True),
    }
    negatives = {name: rejected(config, mutation) for name, mutation in mutations.items()}
    missing_mask = forward["conditions"].clone()
    missing_mask[:, config["conditionChannelOrder"].index("object_tree")] = 0.0
    try:
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            forward["predicted"], forward["target"], missing_mask, config,
        )
        negatives["empty_typed_mask_rejected"] = False
    except ValueError:
        negatives["empty_typed_mask_rejected"] = True
    constant_target = torch.zeros_like(forward["target"])
    try:
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            forward["predicted"], constant_target, forward["conditions"], config,
        )
        negatives["constant_reference_structure_rejected"] = False
    except ValueError:
        negatives["constant_reference_structure_rejected"] = True
    if not all(positives.values()) or not all(negatives.values()):
        failed_positive = [name for name, passed in positives.items() if not passed]
        failed_negative = [name for name, passed in negatives.items() if not passed]
        raise ValueError(
            f"multiscale CPU contract regression failed: positive={failed_positive}, negative={failed_negative}"
        )
    report = {
        "schemaVersion": (
            "stage4-object-reference-multiscale-luminance-structure-supervision-"
            "cpu-regression-v1"
        ),
        "status": "stage4_object_reference_multiscale_luminance_structure_cpu_regression_passed",
        "positivePassed": sum(positives.values()),
        "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()),
        "negativeTotal": len(negatives),
        "positiveChecks": positives,
        "negativeChecks": negatives,
        "forwardMetrics": {
            name: float(value.detach()) for name, value in result["losses"].items()
        },
        "pyramidScales": result["pyramidScales"],
        "derivedWeights": result["derivedWeights"],
        "executionBoundary": {
            "checkpointFileRead": False,
            "modelLoaded": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsMutated": False,
            "gpuUsed": False,
            "cudaInitialized": False,
            "trainingStarted": False,
            "validationStarted": False,
            "smokeStarted": False,
            "stage1Or2Started": False,
        },
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
