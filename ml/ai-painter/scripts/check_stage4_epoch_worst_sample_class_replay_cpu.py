from __future__ import annotations

from copy import deepcopy
import argparse
import json
from pathlib import Path

import torch

from compile_stage4_epoch_worst_sample_class_replay_config import (
    compile_config,
    compile_early_convergence_stabilization_config,
)
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
SOURCE = ROOT / ".runtime/ai-painter/stage4-full-rollout-final-visible-consistency-cpu/20260813-095000000/inactive-config.json"


def rejects(action, contains: str | None = None) -> bool:
    try:
        action()
    except (ValueError, KeyError) as error:
        return contains is None or contains in str(error)
    return False


def run_early_convergence_stabilization(args) -> int:
    if not args.source or not args.output_dir:
        raise ValueError("early-convergence source and output-dir are required")
    source = (ROOT / args.source).resolve()
    output = (ROOT / args.output_dir).resolve()
    if output.exists():
        raise ValueError("new early-convergence CPU output must not exist")
    source_config = json.loads(source.read_text(encoding="utf-8"))
    config = compile_early_convergence_stabilization_config(source_config)
    contract = (
        trainer.validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )
    )
    base = trainer.validate_stage4_epoch_worst_sample_class_replay(config)
    multiscale_contract = (
        trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            config
        )
    )
    cuda_initialized_before = torch.cuda.is_initialized()
    with torch.no_grad():
        target = torch.linspace(0.0, 1.0, 2 * 3 * 8 * 8).reshape(2, 3, 8, 8)
        predicted = torch.flip(target, dims=[-1]) * 0.9 + 0.05
        conditions = torch.zeros(2, 23, 8, 8)
        for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS:
            conditions[:, config["conditionChannelOrder"].index(channel)] = 1.0
        multiscale = (
            trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
                predicted, target, conditions, config
            )
        )
        distribution = {
            "stage4DistributionAwareWeightedPerSampleClassTensor": torch.tensor(
                [[1.0, 2.0, 3.0, 4.0, 5.0]]
            )
        }
        lane1 = trainer.stage4_epoch_worst_sample_class_replay_loss_from_measurements(
            distribution, multiscale, config, 4, replay_index=0,
            allow_inactive_stabilization=True,
        )
        lane2 = trainer.stage4_epoch_worst_sample_class_replay_loss_from_measurements(
            distribution, multiscale, config, 4, replay_index=1,
            allow_inactive_stabilization=True,
        )
        legacy = deepcopy(config)
        del legacy["training"][
            "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"
        ]
        legacy_lane2 = (
            trainer.stage4_epoch_worst_sample_class_replay_loss_from_measurements(
                distribution, None, legacy, 4, replay_index=1,
            )
        )
    positives = {
        "candidate_identity_exact": contract["contractId"] == trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID,
        "candidate_is_inactive": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values()),
        "existing_two_pass_budget_preserved": base["replay"]["passesPerObservedPrimaryBatch"] == contract["replayBudget"]["totalReplayPassesPerObservedPrimaryBatch"] == 2,
        "no_replay_or_optimizer_expansion": contract["replayBudget"]["addsReplayPasses"] is False and contract["replayBudget"]["addsOptimizerSteps"] is False,
        "lane_partition_is_one_plus_one": [lane["passCount"] for lane in contract["lanes"]] == [1, 1],
        "lane1_preserves_global_worst": contract["lanes"][0]["selection"] == "existing_global_worst_sample_class_selection_unchanged",
        "lane1_loss_is_selected_direct": torch.equal(lane1["stage4EpochWorstSampleClassReplayLossTensor"], torch.tensor(5.0)),
        "lane2_has_exact_four_object_order": contract["lanes"][1]["objectChannels"] == list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "lane2_loss_is_joint_multiscale": torch.equal(lane2["stage4EpochWorstSampleClassReplayLossTensor"], multiscale["weightedTotalTensor"]),
        "lane2_does_not_reuse_selected_direct": not torch.equal(lane2["stage4EpochWorstSampleClassReplayLossTensor"], lane1["stage4EpochWorstSampleClassReplayLossTensor"]),
        "legacy_second_pass_remains_selected_direct": torch.equal(legacy_lane2["stage4EpochWorstSampleClassReplayLossTensor"], torch.tensor(5.0)),
        "pyramid_exactly_reused": contract["preservedSupervision"]["pyramidScales"] == multiscale_contract["pyramidScales"] == [1, 0.5, 0.25],
        "derived_weights_exactly_reused": contract["preservedSupervision"]["derivedWeights"] == multiscale_contract["derivedWeights"],
        "no_free_numeric_weight": contract["preservedSupervision"]["freeNumericWeightSelectionAllowed"] is False,
        "targets_and_thresholds_unchanged": not any(contract["legalSupervision"].values()) and contract["compatibility"]["reviewThresholdsChanged"] is False,
        "no_autograd_graph_created": all(not value.requires_grad for value in [lane1["stage4EpochWorstSampleClassReplayLossTensor"], lane2["stage4EpochWorstSampleClassReplayLossTensor"]]),
        "cuda_not_initialized": cuda_initialized_before is False and torch.cuda.is_initialized() is False,
    }
    negatives = {}
    cases = []
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["sourceRunId"] = "old-run"; cases.append(("wrong_source_run_rejected", bad, "identity"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["replayBudget"]["totalReplayPassesPerObservedPrimaryBatch"] = 3; cases.append(("replay_budget_change_rejected", bad, "budget"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["replayBudget"]["addsOptimizerSteps"] = True; cases.append(("optimizer_expansion_rejected", bad, "budget"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["lanes"] = list(reversed(bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["lanes"])); cases.append(("lane_order_change_rejected", bad, "lane"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["lanes"][1]["objectChannels"].pop(); cases.append(("object_set_change_rejected", bad, "lane"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["preservedSupervision"]["pyramidScales"].append(0.125); cases.append(("pyramid_change_rejected", bad, "supervision"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["preservedSupervision"]["derivedWeights"]["vegetation"] = 0.5; cases.append(("weight_change_rejected", bad, "supervision"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["preservedSupervision"]["freeNumericWeightSelectionAllowed"] = True; cases.append(("free_weight_rejected", bad, "supervision"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True; cases.append(("failed_preview_target_rejected", bad, "target"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True; cases.append(("machine_review_target_rejected", bad, "target"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["compatibility"]["reviewThresholdsChanged"] = True; cases.append(("review_threshold_change_rejected", bad, "compatibility"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["evidenceBindings"]["design"]["sha256"] = "0" * 64; cases.append(("design_lineage_change_rejected", bad, "evidence"))
    bad = deepcopy(config); bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["activationGate"]["gpuUseNow"] = True; cases.append(("inactive_gpu_gate_rejected", bad, "activation"))
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["replay"]["passesPerObservedPrimaryBatch"] = 1; cases.append(("base_two_pass_change_rejected", bad, "execution"))
    for name, bad, contains in cases:
        negatives[name] = rejects(
            lambda candidate=bad: trainer.validate_stage4_object_reference_multiscale_early_convergence_stabilization(candidate),
            contains,
        )
    negatives["missing_joint_measurement_rejected"] = rejects(
        lambda: trainer.stage4_epoch_worst_sample_class_replay_loss_from_measurements(
            distribution, None, config, 4, replay_index=1,
            allow_inactive_stabilization=True,
        ),
        "unavailable",
    )
    negatives["invalid_replay_index_rejected"] = rejects(
        lambda: trainer.stage4_epoch_worst_sample_class_replay_loss_from_measurements(
            distribution, multiscale, config, 4, replay_index=2,
            allow_inactive_stabilization=True,
        ),
        "pass index",
    )
    report = {
        "schemaVersion": "stage4-object-reference-multiscale-early-convergence-stabilization-cpu-report-v1",
        "status": "passed_stage4_object_reference_multiscale_early_convergence_stabilization_cpu" if all(positives.values()) and all(negatives.values()) else "failed_stage4_object_reference_multiscale_early_convergence_stabilization_cpu_closed",
        "positive": positives,
        "negative": negatives,
        "positivePassed": sum(positives.values()),
        "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()),
        "negativeTotal": len(negatives),
        "executionBoundary": {
            "checkpointFileRead": False,
            "modelLoaded": False,
            "optimizerCreated": False,
            "autogradExecuted": False,
            "backwardExecuted": False,
            "modelWeightsMutated": False,
            "gpuUsed": False,
            "cudaInitialized": False,
            "trainingStarted": False,
            "validationStarted": False,
            "smokeStarted": False,
            "stage0Started": False,
            "stage1Started": False,
            "stage2Started": False,
        },
    }
    output.mkdir(parents=True)
    (output / "inactive-config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output / "cpu-contract-regression.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"].startswith("passed_") else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id")
    parser.add_argument("--source")
    parser.add_argument("--output-dir")
    parser.add_argument("--early-convergence-stabilization", action="store_true")
    args = parser.parse_args()
    if args.early_convergence_stabilization:
        return run_early_convergence_stabilization(args)
    if not args.run_id:
        raise ValueError("legacy epoch-worst run-id is required")
    output = ROOT / ".runtime/ai-painter/stage4-epoch-worst-sample-class-replay" / args.run_id
    if output.exists():
        raise ValueError("new epoch-worst CPU runId must not exist")
    config = compile_config(json.loads(SOURCE.read_text(encoding="utf-8")))
    contract = trainer.validate_stage4_epoch_worst_sample_class_replay(config)
    weights = trainer.derive_stage4_per_class_final_visible_rgb_weights(config)["weights"]
    target = torch.zeros(2, 3, 4, 4)
    predicted = target.clone()
    predicted[0] += 0.1
    predicted[1] += 0.2
    conditions = torch.zeros(2, 23, 4, 4)
    for channel in trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS:
        conditions[:, config["conditionChannelOrder"].index(channel)] = 1.0
    measured = trainer.stage4_distribution_aware_visible_spatial_semantic_obligation(
        [predicted], target, conditions, config,
    )
    per_class = measured["stage4DistributionAwareWeightedPerSampleClassTensor"]
    positives = {
        "complete_train_epoch_population": contract["selection"]["population"] == "observed_current_train_split_epoch_prefix_with_complete_epoch_finalization",
        "batch_size_one_defect_closed_by_epoch_ledger": config["training"]["batchSize"] == 1 and contract["replay"]["replacesPerBatchPathOnlyReplay"] is True,
        "replay_count_reuses_existing_contract": contract["replay"]["passesPerObservedPrimaryBatch"] == config["training"]["pathHardExampleReplay"]["passesPerEpoch"],
        "no_free_numeric_weight": contract["replay"]["freeNumericWeightSelected"] is False,
        "per_sample_class_tensor_shape": tuple(per_class.shape) == (2, 5),
        "second_sample_selected_as_worst": float(per_class[1].max()) > float(per_class[0].max()),
        "class_weights_are_existing_derived_values": torch.allclose(per_class[0], torch.tensor([0.1 * weights[name] for name in trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES]), atol=1e-7, rtol=0),
        "only_train_split_is_eligible": contract["legalSupervision"]["validationSamplesUsedAsTrainingTargets"] is False,
        "failed_preview_and_review_targets_forbidden": contract["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] is False and contract["legalSupervision"]["machineReviewThresholdsUsedAsTargets"] is False,
        "replay_step_telemetry_registered": (
            '"epoch_worst_sample_class_replay"'
            in Path(trainer.__file__).read_text(encoding="utf-8")
        ),
        "internal_ledgers_excluded_from_scalar_condition_evidence": (
            set(trainer.STAGE4_DISTRIBUTION_AWARE_INTERNAL_TENSOR_FIELDS).isdisjoint(
                trainer.serialize_condition_evidence_metrics(measured)
            )
        ),
    }
    negatives = {}
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["selection"]["population"] = "validation"
    negatives["validation_population_rejected"] = rejects(lambda: trainer.validate_stage4_epoch_worst_sample_class_replay(bad), "selection")
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["replay"]["passesPerObservedPrimaryBatch"] += 1
    negatives["free_replay_count_rejected"] = rejects(lambda: trainer.validate_stage4_epoch_worst_sample_class_replay(bad), "execution")
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True
    negatives["failed_preview_target_rejected"] = rejects(lambda: trainer.validate_stage4_epoch_worst_sample_class_replay(bad), "supervision")
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["legalSupervision"]["machineReviewThresholdsUsedAsTargets"] = True
    negatives["review_threshold_target_rejected"] = rejects(lambda: trainer.validate_stage4_epoch_worst_sample_class_replay(bad), "supervision")
    bad = deepcopy(config); bad["training"]["stage4EpochWorstSampleClassReplay"]["selection"]["classIdentities"] = list(reversed(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES))
    negatives["class_order_change_rejected"] = rejects(lambda: trainer.validate_stage4_epoch_worst_sample_class_replay(bad), "selection")
    bad_metrics = dict(measured)
    bad_metrics["stage4DistributionAwareRawPerStepSampleClass"] = torch.zeros(2, 4)
    negatives["invalid_internal_ledger_shape_rejected"] = rejects(
        lambda: trainer.serialize_condition_evidence_metrics(bad_metrics),
        "internal distribution ledger",
    )
    output.mkdir(parents=True)
    (output / "inactive-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "schemaVersion": "stage4-epoch-worst-sample-class-replay-cpu-report-v1",
        "status": "passed_stage4_epoch_worst_sample_class_replay_cpu" if all(positives.values()) and all(negatives.values()) else "failed_stage4_epoch_worst_sample_class_replay_cpu_closed",
        "runId": args.run_id, "positive": positives, "negative": negatives,
        "positivePassed": sum(positives.values()), "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()), "negativeTotal": len(negatives),
        "checkpointWeightsRead": False, "optimizerCreated": False,
        "backwardExecuted": False, "gpuStarted": False, "trainingStarted": False,
    }
    (output / "cpu-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"].startswith("passed_") else 1


if __name__ == "__main__":
    raise SystemExit(main())
