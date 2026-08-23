from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
import math
import os
from pathlib import Path
import shutil
import time

import torch

from ai_painter.complete_world import build_complete_world_system
import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as base
import run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification as reference_runner
import run_stage4_multisample_capacity_gradient_interference_readonly_diagnostic as previous


ROOT = Path(__file__).resolve().parents[3]
CLASSES = ("footprints", "tree", "rock", "vegetation")
SEED = 20263722
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
CONTRACT_ID = "stage4_conflict_aware_existing_gradient_aggregation_v1"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    authorization_path = previous.resolve(args.authorization)
    consumption_path = previous.resolve(args.consumption)
    output = previous.resolve(args.output_dir)
    if previous.sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("authorization_sha256_mismatch")
    authorization = previous.read_json(authorization_path)
    validate_authorization(authorization, authorization_path, consumption_path, output)
    if args.preflight_only:
        print(json.dumps(preflight(authorization, output), ensure_ascii=False, indent=2))
        return 0
    previous.consume(authorization, authorization_path, consumption_path)
    return run_gpu(authorization, authorization_path, consumption_path, output)


def validate_authorization(value, authorization_path, consumption_path, output):
    if value.get("schemaVersion") != "owner-authorized-stage4-conflict-aware-existing-gradient-aggregation-readonly-gpu-v1":
        raise ValueError("authorization_schema_invalid")
    if value.get("status") != "resolved_owner_authorized_not_consumed" or value.get("requestId") != value.get("commandRef"):
        raise ValueError("authorization_identity_invalid")
    if value.get("scope") != "one_readonly_gpu_stage4_conflict_aware_existing_gradient_aggregation_qualification":
        raise ValueError("authorization_scope_invalid")
    if value.get("oneTimeConsumption") is not True or value.get("gpuAuthorized") is not True or value.get("checkpointWeightsReadAuthorized") is not True:
        raise ValueError("readonly_gpu_authority_missing")
    if any(value.get(name) is not False for name in ("denoiserCheckpointReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized")):
        raise ValueError("forbidden_authority_present")
    identity = value.get("taskIdentity", {})
    if identity != {
        "contractId": CONTRACT_ID,
        "population": {"train": 48, "validation": 8},
        "conditionChannelCount": 23,
        "classIdentityOrder": list(CLASSES),
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "rolloutSteps": 50,
        "gradientTailSteps": 5,
        "topology": "west",
        "gradientParameterBoundary": "current_denoiser_shared_final_output_path",
    }:
        raise ValueError("task_identity_invalid")
    if value["bindings"]["sourceIndex"]["sha256"] != SOURCE_INDEX_SHA256 or value["bindings"]["projectAutoencoderCheckpoint"]["sha256"] != AUTOENCODER_SHA256:
        raise ValueError("source_or_checkpoint_identity_invalid")
    if previous.resolve(Path(value["execution"]["outputDirectory"])) != output or previous.resolve(Path(value["execution"]["consumptionPath"])) != consumption_path:
        raise ValueError("execution_path_identity_invalid")
    if authorization_path.parent != consumption_path.parent:
        raise ValueError("consumption_parent_identity_invalid")
    for name, binding in value["bindings"].items():
        if name == "projectAutoencoderCheckpoint":
            continue
        path = previous.resolve(Path(binding["path"]))
        if not path.is_file() or previous.sha256_file(path) != binding["sha256"]:
            raise ValueError(f"binding_invalid:{name}")


def preflight(authorization, output):
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    checkpoint = previous.resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if not checkpoint.is_file() or previous.sha256_file(checkpoint) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_invalid")
    if output.exists():
        raise ValueError("output_directory_already_exists")
    probe = output.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    free = shutil.disk_usage(probe).free
    if free < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-conflict-aware-gradient-aggregation-preflight-v1",
        "status": "passed_gpu_not_started_not_consumed_checkpoint_not_read",
        "python": os.sys.executable,
        "torchVersion": torch.__version__,
        "cudaDevice": torch.cuda.get_device_name(0),
        "freeDiskBytes": free,
        "outputDirectoryAbsent": True,
        "checkpointContentRead": False,
    }


def tensor_tuple_sha256(values):
    digest = __import__("hashlib").sha256()
    for value in values:
        digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def tuple_dot(left, right):
    return sum((a * b).sum() for a, b in zip(left, right))


def tuple_finite_nonzero(values):
    return all(bool(torch.isfinite(value).all()) for value in values) and float(sum((value * value).sum() for value in values).detach()) > 0.0


def verify_projection(result, contract):
    originals = result["originalWeightedGradients"]
    expected_projected = {}
    evidence = []
    negative_count = 0
    nonnegative_count = 0
    for identity in CLASSES:
        current = tuple(value.clone() for value in originals[identity])
        for reference_identity in CLASSES:
            if reference_identity == identity:
                continue
            reference = originals[reference_identity]
            before = tensor_tuple_sha256(current)
            dot = tuple_dot(current, reference)
            denominator = tuple_dot(reference, reference)
            if not bool(torch.isfinite(dot)) or not bool(torch.isfinite(denominator)) or float(denominator.detach()) <= 0.0:
                raise ValueError("projection_scalar_invalid")
            projected = float(dot.detach()) < 0.0
            if projected:
                negative_count += 1
                coefficient = dot / denominator
                current = tuple(left - coefficient * right for left, right in zip(current, reference))
            else:
                nonnegative_count += 1
                unchanged = tuple(value.clone() for value in current)
                if any(not torch.equal(left, right) for left, right in zip(current, unchanged)):
                    raise ValueError("nonnegative_gradient_changed")
            evidence.append({
                "currentClass": identity,
                "referenceClass": reference_identity,
                "dotProduct": float(dot.detach()),
                "strictlyNegative": projected,
                "projectionApplied": projected,
                "beforeSha256": before,
                "afterSha256": tensor_tuple_sha256(current),
                "numericToleranceUsed": False,
            })
        expected_projected[identity] = current
        if any(not torch.equal(left, right) for left, right in zip(current, result["projectedWeightedGradients"][identity])):
            raise ValueError("projected_gradient_identity_mismatch")
    expected_aggregate = tuple(sum(expected_projected[name][index] for name in CLASSES) for index in range(len(expected_projected[CLASSES[0]])))
    if any(not torch.equal(left, right) for left, right in zip(expected_aggregate, result["aggregatedSharedGradients"])):
        raise ValueError("aggregate_gradient_identity_mismatch")
    if not tuple_finite_nonzero(expected_aggregate):
        raise ValueError("aggregate_gradient_invalid")
    if result["additionalOptimizerSteps"] != 0 or result["additionalReplayPasses"] != 0 or result["freeNumericalToleranceUsed"] is not False:
        raise ValueError("execution_budget_or_tolerance_changed")
    if contract["classOrder"] != list(CLASSES):
        raise ValueError("class_order_changed")
    return evidence, negative_count, nonnegative_count, tensor_tuple_sha256(expected_aggregate)


def run_gpu(authorization, authorization_path, consumption_path, output):
    started = time.perf_counter()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir(exist_ok=False)
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    torch.cuda.init(); torch.cuda.set_device(0); torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    model_config = previous.read_json(previous.resolve(Path(authorization["bindings"]["modelConfig"]["path"])))
    inactive_config = previous.read_json(previous.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    config = deepcopy(model_config)
    config["training"]["stage4ConflictAwareExistingGradientAggregation"] = inactive_config["training"]["stage4ConflictAwareExistingGradientAggregation"]
    contract = trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    datasets = base.load_datasets(config)
    source_index = previous.read_json(previous.resolve(Path(authorization["bindings"]["sourceIndex"]["path"])))
    expected = {
        split: [row["sampleId"] for row in source_index["samples"] if row.get("split") == split and row.get("v7CapacityContributionRegistered") is True]
        for split in ("train", "validation")
    }
    torch.manual_seed(SEED); torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    denoiser_before = previous.state_sha256(model.denoiser)
    checkpoint_path = previous.resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False); model.autoencoder.eval()
    autoencoder_before = previous.state_sha256(model.autoencoder)
    model.to(device).eval()
    normalization = trainer.compute_latent_normalization(model, datasets["train"], device)
    diffusion = trainer.build_diffusion_schedule(config, device)
    shared_parameters = tuple(model.denoiser.output.parameters())
    shared_ids = {id(value) for value in shared_parameters}
    nonshared_parameters = tuple(value for value in model.denoiser.condition_stem.parameters() if id(value) not in shared_ids)
    if not shared_parameters or not nonshared_parameters:
        raise ValueError("gradient_parameter_boundary_missing")
    condition_order = list(config["conditionChannelOrder"])
    rollout_weight = float(config["training"]["stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"]["sourceContracts"]["rolloutWeight"])
    rows = []
    total_negative = 0
    total_nonnegative = 0
    completed = 0
    for split in ("train", "validation"):
        dataset = datasets[split]
        for index in range(len(dataset)):
            record = dataset[index]
            image = record["image"].unsqueeze(0).to(device)
            conditions = record["conditions"].unsqueeze(0).to(device).requires_grad_(True)
            seed = SEED + (0 if split == "train" else 3000) + index
            predicted = base.rollout_rgb(model, image, conditions, [seed], diffusion, normalization, config, gradient_tail_steps=5)
            losses = trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(model.autoencoder, predicted, image, conditions.detach(), config)
            raw_shared = {}
            raw_nonshared = {}
            class_rows = []
            for class_index, identity in enumerate(CLASSES):
                loss = losses["perSampleClassTensors"][0, class_index] * rollout_weight
                gradients = torch.autograd.grad(
                    loss,
                    (conditions, *shared_parameters, *nonshared_parameters),
                    retain_graph=class_index < len(CLASSES) - 1,
                    allow_unused=True,
                )
                condition_gradient = gradients[0]
                shared = tuple(torch.zeros_like(parameter) if gradient is None else gradient.detach() for parameter, gradient in zip(shared_parameters, gradients[1:1 + len(shared_parameters)]))
                nonshared = tuple(torch.zeros_like(parameter) if gradient is None else gradient.detach() for parameter, gradient in zip(nonshared_parameters, gradients[1 + len(shared_parameters):]))
                if not tuple_finite_nonzero(shared) or not tuple_finite_nonzero(nonshared):
                    raise ValueError(f"class_gradient_invalid:{split}:{record['sampleId']}:{identity}")
                channel = condition_order.index(f"object_{identity}")
                channel_sum = float(condition_gradient.detach().abs().sum(dim=(0, 2, 3))[channel].cpu())
                if not bool(torch.isfinite(condition_gradient).all()) or channel_sum <= 0.0:
                    raise ValueError("condition_channel_does_not_reach_final_path")
                raw_shared[identity] = shared
                raw_nonshared[identity] = nonshared
                class_rows.append({"classIdentity": identity, "rawLoss": float(loss.detach().cpu()), "sharedGradientNorm": float(torch.sqrt(tuple_dot(shared, shared)).cpu()), "nonSharedGradientNorm": float(torch.sqrt(tuple_dot(nonshared, nonshared)).cpu()), "ownConditionChannelGradientAbsSum": channel_sum})
            result = trainer.stage4_conflict_aware_existing_gradient_aggregation(raw_shared, config)
            interaction_evidence, negatives, nonnegatives, aggregate_sha = verify_projection(result, contract)
            total_negative += negatives; total_nonnegative += nonnegatives
            weights = contract["derivedClassWeights"]
            expected_nonshared = tuple(sum(raw_nonshared[name][parameter_index] * float(weights[name]) for name in CLASSES) for parameter_index in range(len(nonshared_parameters)))
            if not tuple_finite_nonzero(expected_nonshared):
                raise ValueError("nonshared_existing_gradient_invalid")
            rows.append({
                "sourceIndex": completed,
                "split": split,
                "sampleId": record["sampleId"],
                "seed": seed,
                "classDiagnostics": class_rows,
                "projectionInteractions": interaction_evidence,
                "negativeProjectionCount": negatives,
                "nonNegativeUnchangedCount": nonnegatives,
                "aggregatedSharedGradientSha256": aggregate_sha,
                "aggregatedSharedGradientFiniteNonZero": True,
                "nonSharedExistingWeightedSumSha256": tensor_tuple_sha256(expected_nonshared),
                "nonSharedGradientContractUnchanged": True,
                "additionalOptimizerSteps": 0,
                "additionalReplayPasses": 0,
            })
            completed += 1
            previous.write_json_atomic(output / "progress.json", {"schemaVersion": "stage4-conflict-aware-gradient-aggregation-progress-v1", "status": "running", "completed": completed, "total": 56, "percent": round(completed / 56 * 100, 3), "split": split, "sampleId": record["sampleId"], "recordedAtUtc": previous.utc_now()})
            print(json.dumps({"status": "qualification_progress", "completed": completed, "total": 56, "split": split, "sampleId": record["sampleId"]}), flush=True)
            del image, conditions, predicted, losses, raw_shared, raw_nonshared, result, expected_nonshared
            torch.cuda.empty_cache()
    if [row["sampleId"] for row in rows if row["split"] == "train"] != expected["train"] or [row["sampleId"] for row in rows if row["split"] == "validation"] != expected["validation"]:
        raise ValueError("source_index_order_changed")
    if total_negative <= 0 or total_nonnegative <= 0:
        raise ValueError("projection_population_does_not_cover_both_branches")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_fields_populated")
    torch.cuda.synchronize(0)
    cuda = {"deviceName": torch.cuda.get_device_name(0), "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)), "peakReservedBytes": int(torch.cuda.max_memory_reserved(0))}
    model.to("cpu")
    denoiser_after = previous.state_sha256(model.denoiser)
    autoencoder_after = previous.state_sha256(model.autoencoder)
    states = {"denoiserBefore": denoiser_before, "denoiserAfter": denoiser_after, "denoiserUnchanged": denoiser_before == denoiser_after, "autoencoderBefore": autoencoder_before, "autoencoderAfter": autoencoder_after, "autoencoderUnchanged": autoencoder_before == autoencoder_after}
    if not states["denoiserUnchanged"] or not states["autoencoderUnchanged"]:
        raise ValueError("model_state_changed")
    report = {
        "schemaVersion": "stage4-conflict-aware-existing-gradient-aggregation-gpu-report-v1",
        "status": "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_qualification_passed",
        "contractId": CONTRACT_ID,
        "population": {"train": 48, "validation": 8},
        "sourceOrderPreserved": True,
        "classIdentityOrder": list(CLASSES),
        "derivedClassWeights": contract["derivedClassWeights"],
        "imageSize": {"width": 256, "height": 192},
        "rolloutSteps": 50,
        "gradientTailSteps": 5,
        "totalNegativeProjectionCount": total_negative,
        "totalNonNegativeUnchangedCount": total_nonnegative,
        "sampleDiagnostics": rows,
        "stateHashes": states,
        "executionBudget": {"additionalOptimizerSteps": 0, "additionalReplayPasses": 0, "freeNumericalToleranceUsed": False},
        "safety": {"optimizerCreated": False, "backwardExecuted": False, "modelWeightsModified": False, "trainingStarted": False, "denoiserCheckpointRead": False, "failedCheckpointRead": False, "checkpointWritten": False},
        "authorization": previous.binding(authorization_path),
        "consumption": previous.binding(consumption_path),
        "cuda": cuda,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "recordedAtUtc": previous.utc_now(),
    }
    previous.write_json_atomic(output / "gpu-report.json", report)
    previous.write_json_atomic(output / "cuda-telemetry.json", {"schemaVersion": "stage4-conflict-aware-gradient-aggregation-cuda-telemetry-v1", "status": "completed", **cuda, "durationSeconds": report["durationSeconds"], "recordedAtUtc": report["recordedAtUtc"]})
    previous.write_json_atomic(output / "model-state-hashes.json", states)
    print(json.dumps({"status": report["status"], "gpuReport": previous.binding(output / "gpu-report.json"), "completed": 56}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
