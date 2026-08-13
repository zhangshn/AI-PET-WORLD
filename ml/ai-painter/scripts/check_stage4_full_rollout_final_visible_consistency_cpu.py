from __future__ import annotations

from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path

from compile_stage4_full_rollout_final_visible_consistency_config import compile_config
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
SOURCE = ROOT / ".runtime/ai-painter/stage4-distribution-aware-visible-spatial-semantic-obligation-cpu/20260813-063344851/inactive-config.json"
FAILED = ROOT / ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-084000000-stage0/finalization/phase-terminal.json"
MANIFEST = ROOT / ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-084000000-stage0/training-output/manifest.json"
SELECTED_REVIEW = ROOT / ".runtime/ai-painter/stage4-selected-checkpoint-machine-reviews/20260813-093000000/phase-terminal.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rejects(action, contains: str | None = None) -> bool:
    try:
        action()
    except (ValueError, KeyError) as error:
        return contains is None or contains in str(error)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    output = ROOT / ".runtime/ai-painter/stage4-full-rollout-final-visible-consistency-cpu" / args.run_id
    if output.exists():
        raise ValueError("new CPU runId must not exist")
    evidence = {
        "failed_terminal": {"path": FAILED.relative_to(ROOT).as_posix(), "sha256": sha(FAILED)},
        "manifest": {"path": MANIFEST.relative_to(ROOT).as_posix(), "sha256": sha(MANIFEST)},
        "selected_review": {"path": SELECTED_REVIEW.relative_to(ROOT).as_posix(), "sha256": sha(SELECTED_REVIEW)},
    }
    config = compile_config(json.loads(SOURCE.read_text(encoding="utf-8")), evidence)
    contract = trainer.validate_stage4_full_rollout_final_visible_consistency(config)
    source = Path(trainer.__file__).read_text(encoding="utf-8")
    positives = {
        "same_sampler_as_preview": contract["sampler"] == "same_deterministic_velocity_sampler_as_fixed_preview",
        "full_fifty_step_rollout": contract["rolloutSteps"] == config["inferenceSteps"] == 50,
        "bounded_existing_gradient_tail": contract["gradientTailSteps"] == 5,
        "existing_weight_reused": contract["weight"] == config["training"]["shortTrajectorySupervision"]["weight"],
        "all_final_visible_classes_bound": contract["legalSupervision"]["maskChannels"] == ["terrain_water", "terrain_path_ground", "object_footprints", "object_tree", "object_rock", "object_vegetation"],
        "no_failed_preview_or_review_target": all(contract["legalSupervision"][key] is False for key in ("failedPreviewPixelsUsedAsTargets", "machineReviewThresholdsUsedAsTargets", "machineReviewResultsUsedAsTargets")),
        "trainer_executes_full_rollout_before_backward": source.index("full_rollout_metrics = stage4_full_rollout_final_visible_consistency(") < source.index('loss_metrics["compositeLossTensor"].backward()'),
        "early_steps_no_grad_tail_grad": "if step_index < no_gradient_steps:" in source and "with torch.no_grad():" in source and "gradient_tail_steps" in source,
    }
    negatives = {}
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["rolloutSteps"] = 2
    negatives["short_rollout_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "identity")
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["gradientTailSteps"] = 50
    negatives["free_gradient_tail_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "identity")
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"] = 1.0
    negatives["free_weight_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "identity")
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True
    negatives["failed_preview_target_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "supervision")
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True
    negatives["review_target_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "supervision")
    bad = deepcopy(config); bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["finalVisibleTerms"]["decodedRgb"] += 0.1
    negatives["derived_term_change_rejected"] = rejects(lambda: trainer.validate_stage4_full_rollout_final_visible_consistency(bad), "provenance")
    output.mkdir(parents=True)
    (output / "inactive-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "schemaVersion": "stage4-full-rollout-final-visible-consistency-cpu-report-v1",
        "status": "passed_stage4_full_rollout_final_visible_consistency_cpu" if all(positives.values()) and all(negatives.values()) else "failed_stage4_full_rollout_final_visible_consistency_cpu_closed",
        "runId": args.run_id,
        "positive": positives,
        "negative": negatives,
        "positivePassed": sum(positives.values()), "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()), "negativeTotal": len(negatives),
        "checkpointWeightsRead": False, "optimizerCreated": False, "backwardExecuted": False,
        "gpuStarted": False, "trainingStarted": False,
    }
    (output / "cpu-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"].startswith("passed_") else 1


if __name__ == "__main__":
    raise SystemExit(main())
