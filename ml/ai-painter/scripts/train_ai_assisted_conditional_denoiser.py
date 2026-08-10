from __future__ import annotations

from argparse import ArgumentParser
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import random
import time
from copy import deepcopy

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import (
    add_noise,
    build_complete_world_system,
    deterministic_velocity_step,
    inference_timesteps,
    recover_from_velocity,
    velocity_target,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter.complete_world.live_progress import (
    build_live_progress,
    write_json_atomic,
)


OWNERSHIP = "project_owned_architecture_ai_assisted_cold_start_weights"
POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"
V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS = "owner_authorized_active_mvp64_gpu_training"
V7_TRAINING_AUTHORIZATION_ID = "owner-approved-v7-mvp64-local-gpu-training-activation-20260802"
V7_TRAINING_AUTHORIZATION_REQUEST_ID = "owner-action-request-v7-mvp64-gpu-training-activation-resolution-20260802"
V7_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-approved-v7-mvp64-local-gpu-training-activation-20260802"
V7_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-gpu-training-activation-resolution-20260802/request.json"
V7_DATASET_REPAIR_AUTHORIZATION_ID = "owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802"
V7_DATASET_REPAIR_AUTHORIZATION_COMMAND_REF = "owner-approved-v7-mvp64-training-sample-binding-repair-retrain-20260802"
V7_DATASET_REPAIR_AUTHORIZATION_SCOPE = "v7_dataset_binding_repair_cpu_regression_smoke_stage_0_1_2_only"
V7_DATASET_REPAIR_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802/request.json"
V7_DATASET_REPAIR_AUTHORIZATION_SHA256 = "3ecebd96908852b3888a7327a40b3cb38b2f0a5a6f9b3b6ddbd2f67aa4db554e"
V7_REPAIR_R1_AUTHORIZATION_STATUS = "owner_authorized_bounded_repair_r1_single_stage0_smoke"
V7_REPAIR_R1_AUTHORIZATION_ID = "owner-action-request-v7-bounded-repair-r1-resolution-20260802"
V7_REPAIR_R1_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-bounded-repair-r1-diagnostics-implementation-single-stage0-smoke-20260802"
V7_REPAIR_R1_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r1-resolution-20260802/request.json"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS = "owner_authorized_v7_repair_r1_full_training"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID = "owner-action-request-v7-repair-r1-full-training-resolution-20260802"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-repair-r1-full-stage0-stage1-stage2-training-20260802"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_SCOPE = "v7_repair_r1_full_stage0_stage1_stage2_training_only"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-full-training-resolution-20260802/request.json"
V7_REPAIR_R2_AUTHORIZATION_STATUS = "owner_authorized_v7_repair_r2_single_sample_overfit_smoke"
V7_REPAIR_R2_AUTHORIZATION_ID = "owner-action-request-v7-bounded-repair-r2-resolution-20260803"
V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-bounded-repair-r2-single-sample-overfit-smoke-20260803"
V7_REPAIR_R2_AUTHORIZATION_SCOPE = "v7_r2_timestep_short_trajectory_preview_gate_object_audit_single_sample_overfit_smoke_only"
V7_REPAIR_R2_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r2-resolution-20260803/request.json"
V7_REPAIR_R2_AUTHORIZATION_SHA256 = "a57cb2fb67d561754fcd5ccf51d03ed6b29494f559c28b127b9197596cd7b311"
V7_REPAIR_R2_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r2-resolution-20260803/r2-authorization-consumption.json"
V7_REPAIR_R2_CONSUMPTION_SHA256 = "f8f9620483888cf405692918e289f655721dff1029067c6d75ab69d24c78f9e1"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r3_single_sample_overfit_smoke"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r3-run-registration-fix-retry-20260804"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r3-run-registration-fix-one-random-init-smoke-retry-20260804"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE = "v7_r3_run_registration_directory_fix_and_one_random_init_smoke_retry_only"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/request.json"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256 = "5aa799eeb314e2ac6352603233712ae595ddec81707fb71c5b2bdd0f03bee83b"
V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/authorization-consumption.json"
V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256 = "e4fa80e91dbc9897a49a3100b6f9629b61a20e723a74cbc20042388d4fccc3c2"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r4_single_sample_overfit_smoke"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r4-single-sample-gpu-smoke-20260804"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-one-v7-r4-single-sample-gpu-overfit-smoke-20260804"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE = "one_v7_r4_random_init_single_sample_gpu_overfit_smoke_with_preview_review_and_terminal_only"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/request.json"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256 = "02a147ab7c3f47595abcdd6f61456b5d7339914585b86fd5a37b405beff2b782"
V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/authorization-consumption.json"
V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256 = "62f3a190a04f01e2c75a55eec5c6fc6e70df151a55e217ddef8451a284f2a6de"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r5_single_sample_overfit_smoke"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage3-condition-evidence-serialization-fix-and-one-checkpoint-smoke-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE = "r5_stage3_condition_evidence_non_scalar_image_tensor_serialization_fix_cpu_regression_and_one_same_checkpoint_gpu_smoke_retry_only"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/request.json"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256 = "df0de715098933533468668776573cfa88abc17ec0716e4883e005baf7782708"
V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/authorization-consumption.json"
V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256 = "10873531ed7e9804b9cdc76fde78f7ecc4faf764a4626b277d70373a3f1aea6a"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r5_stage3_coverage_convergence_single_sample_gpu_smoke"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SCOPE = "rebind_r5_stage3_coverage_convergence_smoke_runner_and_trainer_gate_cpu_regression_then_one_checkpoint_continuation_single_sample_30_epoch_gpu_smoke_only"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805/request.json"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256 = "037741e42eeb3c73b7b9fdfc1eae8a0536ce9208e053cfec4aac4d4977515d19"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805/authorization-consumption.json"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256 = "9281a8ba10c58a68f93a056995a2bfb8f9d7d62430aa5c73ca4a7a0dccb42bc8"
V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS = "owner_authorized_v7_r5_stage4_full_training_preflight_only"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS = "owner_authorized_v7_r5_stage4_full_training"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SCOPE = "split_stage3_smoke_30_epoch_and_stage4_formal_40_epoch_contract_then_one_bounded_stage4_execution_only"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/request.json"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256 = "2bc4993cf339476d786a5c4a90dc60bb61bd0ade632f366c2414ef60bba5a07c"
V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/implementation-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_SHA256 = "698788ed3a5b5b87f25f92ef2234a5345be9a92b2aebb7ce8c8c20127ae690b4"
V7_REPAIR_R5_STAGE4_TRAINING_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/training-execution-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_smoke_preflight_only"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_single_sample_gpu_smoke"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_COMMAND_REF = "owner-authorized-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_SCOPE = "fix_only_two_diagnostic_success_status_bindings_sync_related_hashes_then_one_cpu_gate_preflights_and_one_30_epoch_bounded_gpu_smoke"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806/request.json"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_SHA256 = "1c497e6802da24bd6e16e3b981b7ff5438639047d04f3d9afa677bb33937efed"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806/implementation-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_SHA256 = "7ed86af0f3fb94ef3585c83cb5511fbd72273da94fbb69bb594ab6f683f5ab7f"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_EXECUTION_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806/gpu-execution-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_CONFIG_BOUND_AUTHORIZATION_MODE = "config_bound_immutable_owner_authorization_v1"
V7_REPAIR_R5_STAGE4_PROJECT_RUNTIME_LOGICAL_ENTRY = ".runtime"
V7_REPAIR_R5_STAGE4_REGISTERED_HOT_RUNTIME_ROOT = "D:/AI-PET-WORLD-DATA/hot/runtime"
V8_STAGE4_SMOKE_INACTIVE_STATUS = "v8_stage4_shared_readout_training_loss_supported_inactive"
V8_STAGE4_SMOKE_PREFLIGHT_STATUS = "owner_authorized_v8_stage4_single_sample_smoke_preflight_only"
V8_STAGE4_SMOKE_ACTIVE_STATUS = "owner_authorized_v8_stage4_single_sample_gpu_smoke"
V9_STAGE4_CPU_INACTIVE_STATUS = "v9_stage4_object_semantic_decoder_alignment_cpu_supported_inactive"
V9_STAGE4_SMOKE_ACTIVE_STATUS = "owner_authorized_v9_stage4_single_sample_gpu_smoke"
V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS = "owner_authorized_v9_stage4_unified_preview_pipeline_single_sample_gpu_smoke"
V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS = "owner_authorized_v9_stage4_validation_kernel_single_sample_gpu_smoke"
STAGE4_VALIDATION_KERNEL_PHASE0_UPDATE_STATUS = "owner_authorized_stage4_validation_kernel_phase0_single_step_update"
STAGE4_VALIDATION_KERNEL_PHASE0_REPRODUCE_STATUS = "owner_authorized_stage4_validation_kernel_phase0_checkpoint_preview_reproduction"
V7_MVP64_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
V7_R5_STAGE4_OBJECT_DIAGNOSTIC_MEASUREMENTS = (
    "independent_loss",
    "gradient_contribution",
    "decoded_response",
)
V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS = (
    "coverage",
    "spatial_distribution",
    "centroid",
    "required_boundary_contact",
)
V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS = tuple(
    f"stage4DiagnosticObject{object_name}{measurement}"
    for object_name in ("Footprints", "Tree", "Rock", "Vegetation")
    for measurement in ("IndependentLoss", "GradientContribution", "DecodedResponsePrototypeMae")
) + (
    "stage4DiagnosticObjectGradientAvailable",
    "stage4DiagnosticRouteActivationMassRatio",
    "stage4DiagnosticRouteSpatialDistributionL1",
    "stage4DiagnosticRouteCentroidDrift",
    "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
)


def main() -> int:
    parser = ArgumentParser(description="Train the project-owned 23-channel conditional complete-world denoiser.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--autoencoder-checkpoint", type=Path, required=True)
    parser.add_argument("--initial-denoiser-checkpoint", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--resolution-stage", type=int, default=0)
    parser.add_argument("--smoke-test", action="store_true")
    parser.add_argument("--single-sample-overfit-smoke", action="store_true")
    parser.add_argument("--overfit-sample-id")
    parser.add_argument("--overfit-epochs", type=int)
    parser.add_argument("--overfit-evaluation-interval", type=int, default=10)
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--stage4-validation-kernel-phase0-update", action="store_true")
    parser.add_argument("--stage4-validation-kernel-phase0-reproduce", action="store_true")
    parser.add_argument("--phase0-execution-identity", type=Path)
    parser.add_argument("--phase0-diagnostic-checkpoint", type=Path)
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    validate_training_inputs(config, package)
    phase0_mode = args.stage4_validation_kernel_phase0_update or args.stage4_validation_kernel_phase0_reproduce
    if args.stage4_validation_kernel_phase0_update and args.stage4_validation_kernel_phase0_reproduce:
        raise ValueError("Stage4 validation kernel Phase0 update and reproduction modes are mutually exclusive")
    if phase0_mode:
        validate_stage4_validation_kernel_phase0_cli(args, config, package)
    if config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
        training = config["training"]
        if args.single_sample_overfit_smoke is not True:
            raise ValueError("V7 R3 authorization permits only single-sample overfit smoke")
        if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V7 R3 authorized overfit sample identity does not match")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("V7 R3 random-initialization Smoke forbids a parent checkpoint")
        if training.get("authorizedInitialization") != "project_random_multiscale_denoiser":
            raise ValueError("V7 R3 authorized initialization contract is invalid")
    if config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
        training = config["training"]
        if args.single_sample_overfit_smoke is not True:
            raise ValueError("V7 R4 authorization permits only single-sample overfit smoke")
        if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V7 R4 authorized overfit sample identity does not match")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("V7 R4 random-initialization Smoke forbids a parent checkpoint")
        if training.get("authorizedInitialization") != "project_random_multiscale_denoiser":
            raise ValueError("V7 R4 authorized initialization contract is invalid")
        smoke_contract = training.get("r4SmokeCandidateContract", {})
        if int(args.overfit_epochs or 0) != int(smoke_contract.get("plannedEpochs", 0)):
            raise ValueError("V7 R4 authorized Smoke epoch count does not match")
        if int(args.overfit_evaluation_interval) != int(smoke_contract.get("plannedEvaluationInterval", 0)):
            raise ValueError("V7 R4 authorized Smoke evaluation interval does not match")
    if (
        config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate"
        and not is_v8_stage4_decoded_alignment(config)
        and not is_v9_stage4_object_semantic_decoded_alignment(config)
    ):
        training = config["training"]
        authorization_status = training.get("trainingAuthorizationStatus")
        stage4_bounded_smoke = authorization_status in {
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
        }
        stage4_mode = authorization_status in {
            V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS,
            V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS,
        }
        if stage4_bounded_smoke:
            smoke_contract = training.get("r5Stage4BoundedRepairSmokeContract", {})
            continuation = training.get("r5Stage4BoundedRepairCheckpointContinuation", {})
            if authorization_status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS and args.preflight_only is not True:
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke preflight cannot execute training")
            if args.single_sample_overfit_smoke is not True or args.smoke_test:
                raise ValueError("V7 R5 Stage 4 bounded repair permits only single-sample overfit Smoke")
            if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke sample identity does not match")
            if args.initial_denoiser_checkpoint is None:
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke requires the bound Stage 0 checkpoint")
            if project_path(args.initial_denoiser_checkpoint) != continuation.get("sourceCheckpointPath"):
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke checkpoint path does not match")
            if int(args.overfit_epochs or 0) != int(smoke_contract.get("epochCount", 0)):
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke epoch count does not match")
            if int(args.overfit_evaluation_interval) != int(smoke_contract.get("evaluationInterval", 0)):
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke evaluation interval does not match")
            if args.resolution_stage != 0:
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke is restricted to Stage 0")
            if training.get("authorizedInitialization") != "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke":
                raise ValueError("V7 R5 Stage 4 bounded-repair Smoke initialization is invalid")
        elif stage4_mode:
            if authorization_status == V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS and args.preflight_only is not True:
                raise ValueError("V7 R5 Stage 4 preflight config cannot execute training")
            if args.single_sample_overfit_smoke or args.smoke_test:
                raise ValueError("V7 R5 Stage 4 full training cannot use a Smoke execution mode")
            if args.overfit_sample_id is not None or args.overfit_epochs is not None:
                raise ValueError("V7 R5 Stage 4 full training cannot carry single-sample arguments")
            if args.resolution_stage == 0 and args.initial_denoiser_checkpoint is not None:
                raise ValueError("V7 R5 Stage 4 Stage 0 must use deterministic project random initialization")
            if args.resolution_stage > 0 and args.initial_denoiser_checkpoint is None and not args.preflight_only:
                raise ValueError("V7 R5 Stage 4 progressive stage requires the current-run parent checkpoint")
            if training.get("authorizedInitialization") != "project_random_stage0_then_current_run_progressive_checkpoint_chain":
                raise ValueError("V7 R5 Stage 4 initialization contract is invalid")
        else:
            continuation = training.get("r5Stage3CheckpointContinuation") or training.get("r5CheckpointContinuation", {})
            if args.single_sample_overfit_smoke is not True:
                raise ValueError("V7 R5 authorization permits only single-sample overfit smoke")
            if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
                raise ValueError("V7 R5 authorized overfit sample identity does not match")
            if args.initial_denoiser_checkpoint is None:
                raise ValueError("V7 R5 Smoke requires the bound parent checkpoint")
            if project_path(args.initial_denoiser_checkpoint) != continuation.get("sourceCheckpointPath"):
                raise ValueError("V7 R5 parent checkpoint path does not match the bound source")
            expected_initialization = (
                "project_r5_single_sample_checkpoint_continuation"
                if training.get("r5Stage3CheckpointContinuation")
                else "project_r4_single_sample_checkpoint_continuation"
            )
            if training.get("authorizedInitialization") != expected_initialization:
                raise ValueError("V7 R5 authorized checkpoint continuation identity is invalid")
            if int(args.overfit_epochs or 0) != int(training.get("denoiserEpochs", 0)):
                raise ValueError("V7 R5 authorized Smoke epoch count does not match")
            if int(args.overfit_evaluation_interval) != int(training.get("smokeStabilityGate", {}).get("evaluationInterval", 0)):
                raise ValueError("V7 R5 authorized Smoke evaluation interval does not match")
    if is_v8_stage4_decoded_alignment(config):
        training = config["training"]
        authorization_status = training.get("trainingAuthorizationStatus")
        if authorization_status == V8_STAGE4_SMOKE_INACTIVE_STATUS:
            if args.preflight_only is not True:
                raise ValueError("V8 Stage 4 inactive Smoke config cannot execute training")
            if args.initial_denoiser_checkpoint is not None:
                raise ValueError("V8 Stage 4 Smoke must start from project random V8 initialization")
        elif authorization_status in {V8_STAGE4_SMOKE_PREFLIGHT_STATUS, V8_STAGE4_SMOKE_ACTIVE_STATUS}:
            if authorization_status == V8_STAGE4_SMOKE_PREFLIGHT_STATUS and args.preflight_only is not True:
                raise ValueError("V8 Stage 4 preflight config cannot execute training")
            smoke_contract = training.get("v8Stage4SingleSampleSmokeContract", {})
            if args.single_sample_overfit_smoke is not True or args.smoke_test:
                raise ValueError("V8 Stage 4 authorization permits only single-sample overfit Smoke")
            if args.overfit_sample_id != training.get("authorizedOverfitSampleId") or args.overfit_sample_id != smoke_contract.get("sampleId"):
                raise ValueError("V8 Stage 4 fixed Smoke sample identity does not match")
            if args.initial_denoiser_checkpoint is not None:
                raise ValueError("V8 Stage 4 Smoke must start from project random V8 initialization")
            if int(args.overfit_epochs or 0) != 30 or int(smoke_contract.get("epochCount", 0)) != 30:
                raise ValueError("V8 Stage 4 Smoke requires exactly 30 Epoch")
            if int(args.overfit_evaluation_interval) != 5 or smoke_contract.get("previewEpochs") != [1, 5, 10, 20, 30]:
                raise ValueError("V8 Stage 4 Smoke preview schedule is invalid")
            if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_v8_denoiser":
                raise ValueError("V8 Stage 4 Smoke initialization or resolution is invalid")
        else:
            raise ValueError("V8 Stage 4 training authorization status is invalid")
    if is_v9_stage4_object_semantic_decoded_alignment(config):
        training = config["training"]
        smoke_contract = training.get("v9Stage4SingleSampleSmokeContract", {})
        authorization_status = training.get("trainingAuthorizationStatus")
        if authorization_status == V9_STAGE4_CPU_INACTIVE_STATUS:
            if args.preflight_only is not True and not phase0_mode:
                raise ValueError("V9 Stage 4 inactive CPU support configuration cannot execute training")
        elif authorization_status in {V9_STAGE4_SMOKE_ACTIVE_STATUS, V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS, V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS}:
            if args.preflight_only is True:
                raise ValueError("V9 Stage 4 active Smoke configuration cannot be used as a preflight substitute")
        else:
            raise ValueError("V9 Stage 4 training authorization status is invalid")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("V9 Stage 4 must reject every V7 or V8 parent Denoiser Checkpoint")
        if args.single_sample_overfit_smoke is not True or args.smoke_test:
            raise ValueError("V9 Stage 4 authorization permits only the bound single-sample Smoke")
        if args.overfit_sample_id != smoke_contract.get("sampleId") or args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V9 Stage 4 fixed Smoke sample identity does not match")
        if phase0_mode:
            if int(args.overfit_epochs or 0) != 1 or int(args.overfit_evaluation_interval) != 1:
                raise ValueError("Stage4 validation kernel Phase0 requires exactly one bounded step schedule")
        else:
            if int(args.overfit_epochs or 0) != 30 or int(smoke_contract.get("epochCount", 0)) != 30:
                raise ValueError("V9 Stage 4 Smoke requires exactly 30 Epoch")
            if int(args.overfit_evaluation_interval) != 5 or smoke_contract.get("previewEpochs") != [1, 5, 10, 20, 30]:
                raise ValueError("V9 Stage 4 Smoke preview schedule does not match")
        if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_v9_denoiser":
            raise ValueError("V9 Stage 4 Smoke initialization or resolution is invalid")
    if args.resolution_stage < 0 or args.resolution_stage >= len(config["training"]["resolutionStages"]):
        raise ValueError("resolution stage is outside the configured progressive stages")
    stage = config["training"]["resolutionStages"][args.resolution_stage]
    image_size = (int(stage["width"]), int(stage["height"]))
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            args.dataset_package,
            split,
            list(config["conditionChannelOrder"]),
            image_size,
            selection_contract=conditional_dataset_selection_contract(config),
        )
        for split in ("train", "validation", "challenge", "regression")
    }
    dataset_binding_evidence = (
        validate_loaded_v7_datasets(datasets)
        if uses_registered_v7_capacity_dataset(config)
        else {
            "selectionMode": "current_condition_identity",
            "actualLoadedConditionalSampleCount": sum(len(dataset) for dataset in datasets.values()),
            "actualSplitCounts": {split: len(dataset) for split, dataset in datasets.items()},
        }
    )
    overfit_evidence = build_single_sample_overfit_evidence(datasets, args, config)
    sample_bound_boundary_provenance = validate_stage4_sample_bound_boundary_provenance(
        config,
        overfit_evidence,
    )
    if args.preflight_only:
        print(json.dumps({
            "status": "conditional_denoiser_python_preflight_passed",
            "modelId": config["modelId"],
            "architectureVersion": config["architectureVersion"],
            "resolutionStage": stage,
            "datasetPackageId": package["packageId"],
            **dataset_binding_evidence,
            "gpuStarted": False,
            "checkpointCreated": False,
            "formalInferenceEligible": False,
            "singleSampleOverfitSmoke": overfit_evidence,
            "sampleBoundBoundaryProvenance": sample_bound_boundary_provenance,
        }, ensure_ascii=False, indent=2))
        return 0

    if phase0_mode:
        return run_stage4_validation_kernel_phase0(
            args,
            config,
            package,
            datasets,
            dataset_binding_evidence,
            overfit_evidence,
            sample_bound_boundary_provenance,
        )

    seed = int(config["training"]["seed"])
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    step_telemetry_path = initialize_stage4_step_telemetry(
        args.output_dir,
        config,
        overfit_evidence,
        device,
    )
    started_at = utc_now()
    started_at_shanghai = asia_shanghai_now()
    started = time.perf_counter()
    optimization_datasets = build_optimization_datasets(datasets, overfit_evidence)
    loaders = {
        split: torch.utils.data.DataLoader(
            dataset,
            batch_size=int(config["training"]["batchSize"]),
            shuffle=split == "train",
            num_workers=0,
        )
        for split, dataset in optimization_datasets.items()
    }

    record_stage4_step(step_telemetry_path, "model_device_placement", "started", device=str(device))
    model = build_complete_world_system(config).to(device)
    record_stage4_step(step_telemetry_path, "model_device_placement", "completed", device=str(device))
    record_stage4_step(step_telemetry_path, "autoencoder_checkpoint_read", "started")
    autoencoder_checkpoint = load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    record_stage4_step(step_telemetry_path, "autoencoder_checkpoint_read", "completed")
    record_stage4_step(step_telemetry_path, "autoencoder_state_load", "started")
    model.autoencoder.load_state_dict(autoencoder_checkpoint["autoencoderState"])
    record_stage4_step(step_telemetry_path, "autoencoder_state_load", "completed")
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    denoiser_initialization = "project_random_multiscale_denoiser"
    parent_denoiser_checkpoint = None
    r5_checkpoint_continuation = (
        config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate"
        and args.single_sample_overfit_smoke
        and is_v7(config)
    )
    if r5_checkpoint_continuation:
        if args.resolution_stage != 0 or args.initial_denoiser_checkpoint is None:
            raise ValueError("V7 R5 checkpoint continuation is restricted to the Stage 0 single-sample Smoke")
        if config.get("training", {}).get("trainingAuthorizationStatus") == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS:
            record_stage4_step(step_telemetry_path, "denoiser_checkpoint_read", "started")
            parent_denoiser_checkpoint = load_stage4_bounded_repair_checkpoint(
                args.initial_denoiser_checkpoint,
                config,
                package,
            )
            record_stage4_step(step_telemetry_path, "denoiser_checkpoint_read", "completed")
        else:
            parent_denoiser_checkpoint = load_r5_continuation_checkpoint(args.initial_denoiser_checkpoint, config, package)
        record_stage4_step(step_telemetry_path, "denoiser_state_load", "started")
        model.denoiser.load_state_dict(parent_denoiser_checkpoint["denoiserState"])
        record_stage4_step(step_telemetry_path, "denoiser_state_load", "completed")
        if config.get("training", {}).get("trainingAuthorizationStatus") == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS:
            denoiser_initialization = "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke"
        else:
            denoiser_initialization = (
                "project_r5_single_sample_checkpoint_continuation"
                if config.get("training", {}).get("r5Stage3CheckpointContinuation")
                else "project_r4_single_sample_checkpoint_continuation"
            )
    elif args.resolution_stage > 0:
        if args.initial_denoiser_checkpoint is None:
            raise ValueError("progressive denoiser stage requires the previous denoiser checkpoint")
        parent_denoiser_checkpoint = load_denoiser_checkpoint(args.initial_denoiser_checkpoint, config, package, args.resolution_stage)
        model.denoiser.load_state_dict(parent_denoiser_checkpoint["denoiserState"])
        denoiser_initialization = "project_denoiser_checkpoint_resume"
    elif args.initial_denoiser_checkpoint is not None:
        raise ValueError("conditional denoiser stage 0 must start from project random initialization")

    record_stage4_smoke_state_hashes = (
        config.get("training", {}).get("trainingAuthorizationStatus")
        in {V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS, V8_STAGE4_SMOKE_ACTIVE_STATUS, V9_STAGE4_SMOKE_ACTIVE_STATUS, V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS, V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS}
    )
    initial_denoiser_state_sha256 = (
        state_dict_sha256(model.denoiser.state_dict())
        if record_stage4_smoke_state_hashes
        else None
    )

    latent_normalization = (
        load_latent_normalization(parent_denoiser_checkpoint, device)
        if parent_denoiser_checkpoint
        else compute_latent_normalization(model, datasets["train"], device)
    )
    diffusion = build_diffusion_schedule(config, device)
    record_stage4_step(step_telemetry_path, "optimizer_creation", "started")
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    record_stage4_step(step_telemetry_path, "optimizer_creation", "completed")
    epoch_count = (
        int(args.overfit_epochs)
        if args.single_sample_overfit_smoke
        else (1 if args.smoke_test else int(config["training"]["denoiserEpochs"]))
    )
    if epoch_count < 1:
        raise ValueError("overfit epoch count must be positive")
    run_is_smoke = args.smoke_test or args.single_sample_overfit_smoke
    max_train_batches = 1 if args.smoke_test else None
    timestep_coverage = build_timestep_coverage_evidence(
        config,
        epoch_count,
        len(loaders["train"]),
        int(config["training"]["batchSize"]),
    )
    evaluation_epoch_count = (
        len({1, epoch_count, *range(int(args.overfit_evaluation_interval), epoch_count + 1, int(args.overfit_evaluation_interval))})
        if args.single_sample_overfit_smoke
        else epoch_count
    )
    training_token_accounting = build_training_token_accounting(
        config,
        optimization_datasets,
        stage,
        epoch_count,
        run_is_smoke,
        parent_denoiser_checkpoint is None,
        evaluation_epoch_count,
    )
    metrics = []
    best_validation_loss = float("inf")
    best_epoch = None
    best_denoiser_state = None
    batch_target = min(len(loaders["train"]), max_train_batches) if max_train_batches is not None else len(loaders["train"])
    path_replay_passes = r5_path_replay_passes_per_epoch(config)
    optimizer_steps_per_batch = 1 + path_replay_passes
    optimizer_step_target = epoch_count * batch_target * optimizer_steps_per_batch
    train_samples_target_per_epoch = min(
        len(optimization_datasets["train"]),
        batch_target * int(config["training"]["batchSize"]),
    )
    trajectory_steps_per_sample = (
        int(config["training"].get("shortTrajectorySupervision", {}).get("steps", 0))
        if config["training"].get("shortTrajectorySupervision", {}).get("enabled") is True
        else 0
    )
    cross_domain_rollout_steps_per_sample = (
        int(config["inferenceSteps"])
        if config["training"].get("stage4CrossDomainVisualConsistency", {}).get("enabled") is True
        else 0
    )
    latent_spatial_positions = (
        int(stage["width"]) // int(config["latentDownsampleFactor"])
    ) * (
        int(stage["height"]) // int(config["latentDownsampleFactor"])
    )
    latest_live_progress = build_live_progress(
        phase="initializing",
        epoch=0,
        epoch_target=epoch_count,
        batch=0,
        batch_target=batch_target,
        optimizer_step=0,
        optimizer_step_target=optimizer_step_target,
        started_monotonic=started,
        local_denoiser_sample_forward_passes=0,
        local_training_token_count=0,
    )
    last_progress_write_monotonic = 0.0

    def persist_live_progress(progress, force=False):
        nonlocal latest_live_progress, last_progress_write_monotonic
        latest_live_progress = progress
        now_monotonic = time.perf_counter()
        if not force and now_monotonic - last_progress_write_monotonic < 0.5:
            return
        write_progress(
            args.output_dir,
            config,
            package,
            stage,
            started_at,
            started_at_shanghai,
            None,
            metrics,
            "running" if progress["phase"] != "initializing" else "starting",
            run_is_smoke,
            live_progress=progress,
        )
        last_progress_write_monotonic = now_monotonic

    persist_live_progress(latest_live_progress, force=True)

    model.denoiser.train()
    for epoch in range(epoch_count):
        def on_batch_progress(batch_progress):
            optimizer_step = (
                epoch * batch_target * optimizer_steps_per_batch
                + batch_progress["optimizerStepsCompletedInEpoch"]
            )
            completed_training_samples = (
                epoch * train_samples_target_per_epoch
                + batch_progress["samplesProcessedInEpoch"]
            )
            local_denoiser_sample_forward_passes = completed_training_samples * (
                (1 + trajectory_steps_per_sample) * optimizer_steps_per_batch
                + cross_domain_rollout_steps_per_sample
            )
            persist_live_progress(build_live_progress(
                phase="training_batch",
                epoch=epoch + 1,
                epoch_target=epoch_count,
                batch=batch_progress["batch"],
                batch_target=batch_target,
                optimizer_step=optimizer_step,
                optimizer_step_target=optimizer_step_target,
                started_monotonic=started,
                batch_loss=batch_progress["batchLoss"],
                rolling_epoch_loss=batch_progress["rollingEpochLoss"],
                last_batch_duration_seconds=batch_progress["lastBatchDurationSeconds"],
                samples_in_batch=batch_progress["samplesInBatch"],
                local_denoiser_sample_forward_passes=local_denoiser_sample_forward_passes,
                local_training_token_count=local_denoiser_sample_forward_passes * latent_spatial_positions,
            ), force=batch_progress["batch"] == batch_target)

        train_metrics = train_epoch(
            model,
            loaders["train"],
            optimizer,
            diffusion,
            latent_normalization,
            device,
            config,
            epoch,
            max_train_batches,
            on_batch_progress,
            step_telemetry_path,
        )
        evaluate_this_epoch = (
            not args.single_sample_overfit_smoke
            or epoch == 0
            or epoch + 1 == epoch_count
            or (epoch + 1) % int(args.overfit_evaluation_interval) == 0
        )
        if not evaluate_this_epoch:
            row = {
                "stage": "ai_assisted_23_channel_conditional_denoiser",
                "epoch": epoch + 1,
                "recordedAtUtc": utc_now(),
                "recordedAtAsiaShanghai": asia_shanghai_now(),
                "trainCompositeLoss": train_metrics["compositeLoss"],
                "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
                "trainCleanLatentMae": train_metrics["cleanLatentMae"],
                "validationSkippedForBoundedOverfitSmoke": True,
                "bestCheckpointUpdated": False,
                "tokenAccounting": training_token_accounting["perEpoch"],
            }
            for key, value in train_metrics.items():
                if key not in {"compositeLoss", "velocityPredictionMse", "cleanLatentMae"}:
                    row[f"train{upper_camel(key)}"] = value
            register_v9_stage4_diagnostic_manifest_fields(row, train_metrics, epoch + 1, config)
            metrics.append(row)
            latest_live_progress = build_live_progress(
                phase="epoch_completed",
                epoch=epoch + 1,
                epoch_target=epoch_count,
                batch=batch_target,
                batch_target=batch_target,
                optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
                optimizer_step_target=optimizer_step_target,
                started_monotonic=started,
                batch_loss=latest_live_progress.get("batchLoss"),
                rolling_epoch_loss=train_metrics["compositeLoss"],
                local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
                local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
            )
            write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running", True, live_progress=latest_live_progress)
            continue
        latest_live_progress = build_live_progress(
            phase="validating_epoch",
            epoch=epoch + 1,
            epoch_target=epoch_count,
            batch=batch_target,
            batch_target=batch_target,
            optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
            optimizer_step_target=optimizer_step_target,
            started_monotonic=started,
            batch_loss=latest_live_progress.get("batchLoss"),
            rolling_epoch_loss=train_metrics["compositeLoss"],
            local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
            local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
        )
        persist_live_progress(latest_live_progress, force=True)
        validation = evaluate_velocity_prediction(
            model,
            loaders["validation"],
            diffusion,
            latent_normalization,
            device,
            seed + 1000,
            list(config["training"]["fixedValidationTimesteps"]),
            config,
        )
        validation_loss = validation["compositeConditionQualityScore"]
        rollout_validation = None
        if uses_v7_rollout_validation(config):
            with stage4_fixed_preview_determinism_scope(
                uses_stage4_unified_preview_sampling_contract(config)
            ):
                rollout_validation = evaluate_deterministic_rollout_rgb_quality_v7(
                    model,
                    optimization_datasets["validation"],
                    diffusion,
                    latent_normalization,
                    device,
                    seed + 3000,
                    config,
                    args.output_dir / "fixed-epoch-previews",
                    epoch + 1,
                )
            if uses_stage4_unified_preview_sampling_contract(config):
                source_preview = rollout_validation.get("previewArtifact")
                if not isinstance(source_preview, dict):
                    raise ValueError("Stage4 fixed Epoch preview artifact is missing")
                with stage4_fixed_preview_determinism_scope(True):
                    repeated_metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                        model,
                        optimization_datasets["validation"],
                        diffusion,
                        latent_normalization,
                        device,
                        seed + 3000,
                        config,
                        args.output_dir / "fixed-epoch-preview-reproductions",
                        epoch + 1,
                    )
                repeated_preview = repeated_metrics.get("previewArtifact")
                reproduction = {
                    "schemaVersion": "stage4-fixed-epoch-preview-reproduction-v1",
                    "status": "fixed_epoch_preview_reproduced_exactly",
                    "sourcePreview": source_preview,
                    "repeatedPreview": repeated_preview,
                    "modelStateSha256Matches": isinstance(repeated_preview, dict) and source_preview.get("denoiserStateSha256") == repeated_preview.get("denoiserStateSha256"),
                    "conditionTensorSha256Matches": isinstance(repeated_preview, dict) and source_preview.get("conditionTensorSha256") == repeated_preview.get("conditionTensorSha256"),
                    "rgbTensorSha256Matches": isinstance(repeated_preview, dict) and source_preview.get("rgbTensorSha256") == repeated_preview.get("rgbTensorSha256"),
                    "pngByteSha256Matches": isinstance(repeated_preview, dict) and source_preview.get("previewSha256") == repeated_preview.get("previewSha256"),
                }
                if not all(reproduction[key] is True for key in (
                    "modelStateSha256Matches", "conditionTensorSha256Matches",
                    "rgbTensorSha256Matches", "pngByteSha256Matches",
                )):
                    raise ValueError("Stage4 fixed Epoch preview reproduction identity mismatch")
                rollout_validation["previewReproductionArtifact"] = reproduction
            validation_loss += (
                rollout_validation["rolloutRgbQualityScore"]
                * float(config["training"].get("checkpointRolloutWeight", 1.0))
            )
        elif is_v6(config):
            rollout_validation = evaluate_deterministic_rollout_rgb_quality(
                model,
                datasets["validation"],
                diffusion,
                latent_normalization,
                device,
                seed + 3000,
                config,
            )
            validation_loss += (
                rollout_validation["rolloutRgbQualityScore"]
                * float(config["training"].get("checkpointRolloutWeight", 1.0))
            )
        row = {
            "stage": "ai_assisted_23_channel_conditional_denoiser",
            "epoch": epoch + 1,
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": asia_shanghai_now(),
            "trainCompositeLoss": train_metrics["compositeLoss"],
            "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
            "trainCleanLatentMae": train_metrics["cleanLatentMae"],
            "validationFixedGridCompositeConditionQualityScore": validation["compositeConditionQualityScore"],
            "validationFixedGridVelocityLoss": validation["velocityPredictionMse"],
            "validationFixedGridCleanLatentMae": validation["cleanLatentMae"],
            "validationCheckpointSelectionScore": validation_loss,
            "tokenAccounting": training_token_accounting["perEpoch"],
        }
        if rollout_validation:
            row.update({f"validation{upper_camel(key)}": value for key, value in rollout_validation.items()})
        for key, value in train_metrics.items():
            if key not in {"compositeLoss", "velocityPredictionMse", "cleanLatentMae"}:
                row[f"train{upper_camel(key)}"] = value
        for key, value in validation.items():
            if key not in {"compositeConditionQualityScore", "velocityPredictionMse", "cleanLatentMae", "fixedTimesteps"}:
                row[f"validationFixedGrid{upper_camel(key)}"] = value
        register_v9_stage4_diagnostic_manifest_fields(row, train_metrics, epoch + 1, config)
        if validation_loss < best_validation_loss:
            best_validation_loss = validation_loss
            best_epoch = epoch + 1
            best_denoiser_state = deepcopy({key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()})
            row["bestCheckpointUpdated"] = True
        else:
            row["bestCheckpointUpdated"] = False
        metrics.append(row)
        latest_live_progress = build_live_progress(
            phase="epoch_completed",
            epoch=epoch + 1,
            epoch_target=epoch_count,
            batch=batch_target,
            batch_target=batch_target,
            optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
            optimizer_step_target=optimizer_step_target,
            started_monotonic=started,
            batch_loss=latest_live_progress.get("batchLoss"),
            rolling_epoch_loss=train_metrics["compositeLoss"],
            validation_score=validation["compositeConditionQualityScore"],
            checkpoint_score=validation_loss,
            local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
            local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
        )
        write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running", run_is_smoke, live_progress=latest_live_progress)

    if best_denoiser_state is None:
        raise ValueError("fixed validation did not produce a selectable checkpoint")
    model.denoiser.load_state_dict(best_denoiser_state)
    final_denoiser_state_sha256 = (
        state_dict_sha256(model.denoiser.state_dict())
        if record_stage4_smoke_state_hashes
        else None
    )
    unified_preview_reproduction = None
    if uses_stage4_unified_preview_sampling_contract(config):
        best_row = next((row for row in metrics if row.get("epoch") == best_epoch), None)
        source_preview = best_row.get("validationPreviewArtifact") if best_row else None
        if not isinstance(source_preview, dict):
            raise ValueError("Stage4 unified preview source artifact is missing for the selected checkpoint")
        with stage4_fixed_preview_determinism_scope(True):
            reproduction_metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                model,
                optimization_datasets["validation"],
                diffusion,
                latent_normalization,
                device,
                seed + 3000,
                config,
                args.output_dir / "checkpoint-bound-preview-reproduction",
                best_epoch,
            )
        reproduced_preview = reproduction_metrics.get("previewArtifact")
        if not isinstance(reproduced_preview, dict):
            raise ValueError("Stage4 unified preview checkpoint reproduction artifact is missing")
        unified_preview_reproduction = {
            "schemaVersion": "stage4-unified-training-preview-reproduction-v1",
            "status": "checkpoint_bound_preview_reproduced_exactly" if source_preview.get("previewSha256") == reproduced_preview.get("previewSha256") else "checkpoint_bound_preview_reproduction_mismatch",
            "bestEpoch": int(best_epoch),
            "selectedCheckpointDenoiserStateSha256": final_denoiser_state_sha256,
            "sourcePreview": source_preview,
            "reproducedPreview": reproduced_preview,
            "denoiserStateIdentityMatches": source_preview.get("denoiserStateSha256") == final_denoiser_state_sha256 == reproduced_preview.get("denoiserStateSha256"),
            "previewSha256Matches": source_preview.get("previewSha256") == reproduced_preview.get("previewSha256"),
            "machineReviewThresholdsChanged": False,
        }
        if not unified_preview_reproduction["denoiserStateIdentityMatches"]:
            raise ValueError("Stage4 unified preview selected checkpoint state identity mismatch")
        if not unified_preview_reproduction["previewSha256Matches"]:
            raise ValueError("Stage4 unified preview byte-exact checkpoint reproduction mismatch")

    split_metrics = {}
    for index, split in enumerate(datasets):
        if args.single_sample_overfit_smoke and split != "validation":
            split_metrics[split] = {
                "sampleCount": len(datasets[split]),
                "status": "not_read_by_nonformal_single_sample_overfit_smoke",
                "metricsReadDuringTraining": False,
            }
            continue
        if is_v6_or_later(config) and split == config["training"].get("strictHeldOutInferenceSplit"):
            split_metrics[split] = {
                "sampleCount": len(datasets[split]),
                "status": "reserved_for_post_training_held_out_inference",
                "metricsReadDuringTraining": False,
            }
            continue
        split_metrics[split] = {
            "sampleCount": len(optimization_datasets[split]),
            **evaluate_velocity_prediction(
                model,
                loaders[split],
                diffusion,
                latent_normalization,
                device,
                seed + 2000 + index,
                list(config["training"]["fixedValidationTimesteps"]),
                config,
            ),
        }
    condition_evidence = save_condition_evidence(
        model,
        optimization_datasets,
        diffusion,
        latent_normalization,
        device,
        seed,
        args.output_dir / "condition-evidence.json",
        config,
    )

    checkpoint_path = args.output_dir / "complete-world-ai-assisted-conditional-denoiser.pt"
    checkpoint = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": f"project_autoencoder_checkpoint_plus_{denoiser_initialization}",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "modelConfig": config,
        "datasetPackageId": package["packageId"],
        "datasetBindingEvidence": dataset_binding_evidence,
        "actualLoadedConditionalSampleCount": dataset_binding_evidence["actualLoadedConditionalSampleCount"],
        "actualLoadedV7CapacityCount": dataset_binding_evidence.get("actualLoadedV7CapacityCount"),
        "actualLoadedSplitCounts": dataset_binding_evidence["actualSplitCounts"],
        "trainingTokenAccounting": training_token_accounting,
        "trainingStage": "conditional_denoiser_single_sample_overfit_smoke" if args.single_sample_overfit_smoke else ("conditional_denoiser_smoke_test" if args.smoke_test else "conditional_denoiser_training"),
        "denoiserTrained": not args.smoke_test and not args.single_sample_overfit_smoke,
        "programValidated": True,
        "formalInferenceEligible": False,
        "resolutionStage": stage,
        "seed": seed,
        "parentDenoiserCheckpointPath": project_path(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "parentDenoiserCheckpointSha256": sha256_file(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "predictionTarget": config["predictionTarget"],
        "latentNormalization": serialize_latent_normalization(latent_normalization),
        "bestCheckpointMetric": config["training"]["bestCheckpointMetric"],
        "bestEpoch": best_epoch,
        "bestValidationMetric": best_validation_loss,
        "denoiserLossVersion": config["training"]["denoiserLossVersion"],
        "denoiserLossWeights": config["training"]["denoiserLossWeights"],
        "bestCheckpointMetricWeights": config["training"]["bestCheckpointMetricWeights"],
        "singleSampleOverfitSmoke": overfit_evidence,
        "timestepCoverage": timestep_coverage,
        "conditionResizeContract": config["conditionResizeContract"],
        "autoencoderState": {key: value.detach().cpu() for key, value in model.autoencoder.state_dict().items()},
        "denoiserState": {key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()},
    }
    if unified_preview_reproduction is not None:
        checkpoint["stage4UnifiedTrainingPreviewSampling"] = unified_preview_reproduction
    if record_stage4_smoke_state_hashes:
        checkpoint["modelStateHashEvidence"] = {
            "algorithm": "sha256_sorted_tensor_bytes_v1",
            "initialDenoiserStateSha256": initial_denoiser_state_sha256,
            "finalDenoiserStateSha256": final_denoiser_state_sha256,
            "weightsChanged": initial_denoiser_state_sha256 != final_denoiser_state_sha256,
        }
    record_stage4_step(step_telemetry_path, "checkpoint_write", "started")
    torch.save(checkpoint, checkpoint_path)
    record_stage4_step(step_telemetry_path, "checkpoint_write", "completed")

    created_at = utc_now()
    manifest = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "status": "conditional_denoiser_single_sample_overfit_smoke_completed" if args.single_sample_overfit_smoke else ("conditional_denoiser_program_smoke_test_passed" if args.smoke_test else "conditional_denoiser_training_completed_pending_validation"),
        "createdAtUtc": created_at,
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": f"project_autoencoder_checkpoint_plus_{denoiser_initialization}",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "datasetPackageId": package["packageId"],
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "sourceIndexPath": package["sourceIndexPath"],
        "sourceIndexSha256": sha256_file(Path.cwd() / package["sourceIndexPath"]),
        "connectivityCoverage": package["connectivityCoverage"],
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": sha256_file(checkpoint_path),
        "autoencoderCheckpointPath": project_path(args.autoencoder_checkpoint),
        "autoencoderCheckpointSha256": sha256_file(args.autoencoder_checkpoint),
        "parentDenoiserCheckpointPath": project_path(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "parentDenoiserCheckpointSha256": sha256_file(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "trainingStage": checkpoint["trainingStage"],
        "denoiserTrained": checkpoint["denoiserTrained"],
        "programValidated": True,
        "formalInferenceEligible": False,
        "conditionChannels": int(config["conditionChannels"]),
        "conditionChannelOrder": list(config["conditionChannelOrder"]),
        "conditionBoundSampleCount": sum(len(dataset) for dataset in datasets.values()),
        "datasetBindingEvidence": dataset_binding_evidence,
        "actualLoadedConditionalSampleCount": dataset_binding_evidence["actualLoadedConditionalSampleCount"],
        "actualLoadedV7CapacityCount": dataset_binding_evidence.get("actualLoadedV7CapacityCount"),
        "actualLoadedSplitCounts": dataset_binding_evidence["actualSplitCounts"],
        "trainingTokenAccounting": training_token_accounting,
        "singleSampleOverfitSmoke": overfit_evidence,
        "timestepCoverage": timestep_coverage,
        "resolutionStage": stage,
        "seed": seed,
        "splitMetrics": split_metrics,
        "conditionEvidencePath": project_path(args.output_dir / "condition-evidence.json"),
        "conditionEvidenceSha256": sha256_file(args.output_dir / "condition-evidence.json"),
        "conditionEvidence": condition_evidence,
        "predictionTarget": config["predictionTarget"],
        "latentNormalization": checkpoint["latentNormalization"],
        "bestCheckpointMetric": checkpoint["bestCheckpointMetric"],
        "bestEpoch": best_epoch,
        "bestValidationMetric": best_validation_loss,
        "denoiserLossVersion": checkpoint["denoiserLossVersion"],
        "denoiserLossWeights": checkpoint["denoiserLossWeights"],
        "bestCheckpointMetricWeights": checkpoint["bestCheckpointMetricWeights"],
        "conditionResizeContract": checkpoint["conditionResizeContract"],
        "diffusionSchedule": {
            "type": "linear_beta_v1",
            "steps": int(config["diffusionSteps"]),
            "betaStart": diffusion["betaStart"],
            "betaEnd": diffusion["betaEnd"],
            "predictionTarget": "velocity_v1",
        },
        "remainingBlockers": [
            "conditional_denoiser_full_training_missing" if (args.smoke_test or args.single_sample_overfit_smoke) else "conditional_denoiser_validation_pending",
            "formal_inference_validation_missing",
            "owner_review_missing_identity",
        ],
        "durationSeconds": round(time.perf_counter() - started, 3),
        "device": str(device),
        "metrics": metrics,
        "automaticStorage": True,
    }
    if unified_preview_reproduction is not None:
        manifest["stage4UnifiedTrainingPreviewSampling"] = unified_preview_reproduction
    if record_stage4_smoke_state_hashes:
        manifest["modelStateHashEvidence"] = deepcopy(checkpoint["modelStateHashEvidence"])
    manifest_path = args.output_dir / "manifest.json"
    write_json(manifest_path, manifest)
    completed_live_progress = build_live_progress(
        phase="completed",
        epoch=epoch_count,
        epoch_target=epoch_count,
        batch=batch_target,
        batch_target=batch_target,
        optimizer_step=optimizer_step_target,
        optimizer_step_target=optimizer_step_target,
        started_monotonic=started,
        rolling_epoch_loss=metrics[-1]["trainCompositeLoss"] if metrics else None,
        validation_score=metrics[-1].get("validationFixedGridCompositeConditionQualityScore") if metrics else None,
        checkpoint_score=metrics[-1].get("validationCheckpointSelectionScore") if metrics else None,
        local_denoiser_sample_forward_passes=epoch_count * train_samples_target_per_epoch * (
            (1 + trajectory_steps_per_sample) * optimizer_steps_per_batch
            + cross_domain_rollout_steps_per_sample
        ),
        local_training_token_count=epoch_count * train_samples_target_per_epoch * (
            (1 + trajectory_steps_per_sample) * optimizer_steps_per_batch
            + cross_domain_rollout_steps_per_sample
        ) * latent_spatial_positions,
    )
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "completed", run_is_smoke, manifest, completed_live_progress)
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


def build_single_sample_overfit_evidence(datasets, args, config):
    if not args.single_sample_overfit_smoke:
        return {
            "enabled": False,
            "nonFormal": False,
        }
    if args.smoke_test:
        raise ValueError("single-sample overfit smoke and program smoke-test are mutually exclusive")
    configured_split = "train"
    training = config.get("training", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    if is_v8_stage4_decoded_alignment(config):
        if authorization_status not in {
            V8_STAGE4_SMOKE_INACTIVE_STATUS,
            V8_STAGE4_SMOKE_PREFLIGHT_STATUS,
            V8_STAGE4_SMOKE_ACTIVE_STATUS,
        }:
            raise ValueError("V8 Stage 4 Smoke sample selection requires an authorized V8 Smoke status")
        configured_split = training.get("v8Stage4SingleSampleSmokeContract", {}).get("sampleSplit")
        if configured_split != "validation":
            raise ValueError("V8 Stage 4 Smoke must use the bound validation diagnostic sample")
    elif is_v9_stage4_object_semantic_decoded_alignment(config):
        if authorization_status not in {V9_STAGE4_CPU_INACTIVE_STATUS, V9_STAGE4_SMOKE_ACTIVE_STATUS, V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS}:
            raise ValueError("V9 Stage 4 sample selection requires an authorized V9 status")
        configured_split = training.get("v9Stage4SingleSampleSmokeContract", {}).get("sampleSplit")
        if configured_split != "validation":
            raise ValueError("V9 Stage 4 must preserve the bound validation sample")
    elif authorization_status in {
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
    }:
        configured_split = training.get("authorizedOverfitSampleSplit")
        if configured_split != "validation":
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke must use the bound validation diagnostic sample")
    rows = datasets[configured_split].rows
    selected_index = 0
    if args.overfit_sample_id:
        matches = [index for index, row in enumerate(rows) if row.get("sampleId") == args.overfit_sample_id]
        if len(matches) != 1:
            raise ValueError(f"single-sample overfit sample id must match exactly one {configured_split} row")
        selected_index = matches[0]
    row = rows[selected_index]
    return {
        "enabled": True,
        "nonFormal": True,
        "selectedSplit": configured_split,
        "selectedIndex": selected_index,
        "sampleId": row.get("sampleId"),
        "conditionLabel": row.get("conditionLabel"),
        "conditionPackPath": row.get("conditionPackPath"),
        "fullDatasetBindingStillRequired": True,
        "formalModelPromotionEligible": False,
    }


def validate_stage4_sample_bound_boundary_provenance(config, overfit_evidence):
    training = config.get("training", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    if authorization_status not in {
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
        V8_STAGE4_SMOKE_INACTIVE_STATUS,
        V8_STAGE4_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_CPU_INACTIVE_STATUS,
        V9_STAGE4_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS,
    }:
        return {
            "enabled": False,
            "status": "not_applicable_non_stage4_bounded_smoke",
        }
    if overfit_evidence.get("enabled") is not True:
        raise ValueError("Stage4 sample-bound boundary provenance requires the fixed Smoke sample")
    if is_v9_stage4_object_semantic_decoded_alignment(config):
        smoke_contract = training.get("v9Stage4SingleSampleSmokeContract", {})
    elif is_v8_stage4_decoded_alignment(config):
        smoke_contract = training.get("v8Stage4SingleSampleSmokeContract", {})
    else:
        smoke_contract = training.get("r5Stage4BoundedRepairSmokeContract", {})
    sample_id = overfit_evidence.get("sampleId")
    condition_pack_path = overfit_evidence.get("conditionPackPath")
    if sample_id != smoke_contract.get("sampleId") or sample_id != training.get("authorizedOverfitSampleId"):
        raise ValueError("Stage4 sample-bound boundary provenance sample identity mismatch")
    if condition_pack_path != smoke_contract.get("conditionPackPath"):
        raise ValueError("Stage4 sample-bound boundary provenance condition pack mismatch")
    condition_pack = read_json(condition_pack_path)
    if condition_pack.get("status") != "compiled_conditions_ready":
        raise ValueError("Stage4 sample-bound boundary provenance condition pack is not ready")
    task_package_path = condition_pack.get("sourceBindings", {}).get("taskPackagePath")
    if not task_package_path:
        raise ValueError("Stage4 sample-bound boundary provenance task package path is missing")
    task_package = read_json(task_package_path)
    blueprint_path = task_package.get("sourceBindings", {}).get("trainingBlueprintPath")
    connectivity_path = task_package.get("sourceBindings", {}).get("connectivityBlueprintPath")
    if not blueprint_path or not connectivity_path:
        raise ValueError("Stage4 sample-bound boundary provenance source paths are missing")
    blueprint = read_json(blueprint_path)
    connectivity = read_json(connectivity_path)
    source_sides = {
        "taskPackageWorldFrame": task_package.get("worldFrameContract", {}).get("boundaryConnectivity", {}).get("pathBoundarySide"),
        "blueprintWorldFrame": blueprint.get("worldFrameContract", {}).get("boundaryConnectivity", {}).get("pathBoundarySide"),
        "blueprintRouteAudit": blueprint.get("geometry", {}).get("routeWaterAvoidanceAudit", {}).get("pathBoundarySide"),
        "regionalConnectivityPathPlan": connectivity.get("anonymousTrainingCoordinateProjection", {}).get("pathPlan", {}).get("boundarySide"),
    }
    source_side_values = list(source_sides.values())
    if any(side not in {"north", "south", "west", "east"} for side in source_side_values):
        raise ValueError("Stage4 sample-bound boundary provenance source side is missing or invalid")
    if len(set(source_side_values)) != 1:
        raise ValueError("Stage4 sample-bound boundary provenance source sides disagree")
    authoritative_sides = [source_side_values[0]]
    configured_sides = list(training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides", []))
    if configured_sides != authoritative_sides:
        raise ValueError(
            "Stage4 sample-bound boundary provenance required sides do not match current sample: "
            f"configured={configured_sides}, authoritative={authoritative_sides}"
        )
    canvas = condition_pack.get("canvas", {})
    canvas_width = int(canvas.get("width", 0))
    canvas_height = int(canvas.get("height", 0))
    path_centerline = blueprint.get("geometry", {}).get("pathCenterline", [])
    if canvas_width <= 0 or canvas_height <= 0 or not path_centerline:
        raise ValueError("Stage4 sample-bound boundary provenance route geometry is missing")
    geometry_contacts = route_geometry_boundary_contacts(path_centerline, canvas_width, canvas_height)
    if geometry_contacts != authoritative_sides:
        raise ValueError(
            "Stage4 sample-bound boundary provenance route geometry contact mismatch: "
            f"geometry={geometry_contacts}, authoritative={authoritative_sides}"
        )
    path_channel = next(
        (channel for channel in condition_pack.get("channels", []) if channel.get("id") == "terrain_path_ground"),
        None,
    )
    if not path_channel or path_channel.get("derivation") != "rasterized_from_current_task_geometry":
        raise ValueError("Stage4 sample-bound boundary provenance terrain_path_ground binding is invalid")
    mask_path = path_channel.get("path")
    if not mask_path or sha256_file(mask_path) != path_channel.get("sha256"):
        raise ValueError("Stage4 sample-bound boundary provenance terrain_path_ground hash mismatch")
    band_ratio = float(training.get("authorizedBoundaryTopology", {}).get("boundaryBandRatio", 0.04))
    resolution_evidence = []
    for stage in training.get("resolutionStages", []):
        width = int(stage.get("width", 0))
        height = int(stage.get("height", 0))
        contacted_sides, counts, band_pixels = mask_boundary_contacts(
            mask_path,
            width,
            height,
            band_ratio,
        )
        if contacted_sides != authoritative_sides:
            raise ValueError(
                "Stage4 sample-bound boundary provenance mask contact mismatch: "
                f"resolution={width}x{height}, mask={contacted_sides}, authoritative={authoritative_sides}"
            )
        resolution_evidence.append({
            "width": width,
            "height": height,
            "bandPixels": band_pixels,
            "contactedSides": contacted_sides,
            "boundaryNonZeroCounts": counts,
        })
    return {
        "enabled": True,
        "status": "current_sample_world_fact_geometry_and_mask_topology_verified_before_checkpoint_read",
        "sampleId": sample_id,
        "conditionPackPath": condition_pack_path,
        "conditionPackSha256": sha256_file(condition_pack_path),
        "taskPackagePath": task_package_path,
        "taskPackageSha256": sha256_file(task_package_path),
        "worldFactBlueprintPath": blueprint_path,
        "worldFactBlueprintSha256": sha256_file(blueprint_path),
        "regionalConnectivityPath": connectivity_path,
        "regionalConnectivitySha256": sha256_file(connectivity_path),
        "authority": "current_sample_world_fact_topology_and_project_route_geometry",
        "conditionMaskRole": "consistency_validation_only",
        "sourceBoundarySides": source_sides,
        "authoritativeRequiredBoundarySides": authoritative_sides,
        "configuredRequiredBoundarySides": configured_sides,
        "geometryContactSides": geometry_contacts,
        "maskResolutionEvidence": resolution_evidence,
        "checkpointFileRead": False,
        "gpuStarted": False,
    }


def route_geometry_boundary_contacts(points, width, height):
    contacts = []
    if any(float(point.get("y", 1)) <= 0 for point in points):
        contacts.append("north")
    if any(float(point.get("y", -1)) >= height - 1 for point in points):
        contacts.append("south")
    if any(float(point.get("x", 1)) <= 0 for point in points):
        contacts.append("west")
    if any(float(point.get("x", -1)) >= width - 1 for point in points):
        contacts.append("east")
    return contacts


def mask_boundary_contacts(mask_path, width, height, band_ratio):
    if width <= 0 or height <= 0:
        raise ValueError("Stage4 sample-bound boundary provenance resolution is invalid")
    resampling = getattr(Image, "Resampling", Image)
    with Image.open(Path.cwd() / mask_path) as image:
        mask = np.asarray(image.convert("L").resize((width, height), resampling.NEAREST)) > 0
    band = max(1, round(min(width, height) * band_ratio))
    counts = {
        "north": int(mask[:band, :].sum()),
        "south": int(mask[-band:, :].sum()),
        "west": int(mask[:, :band].sum()),
        "east": int(mask[:, -band:].sum()),
    }
    return [side for side in ("north", "south", "west", "east") if counts[side] > 0], counts, band


def initialize_stage4_step_telemetry(output_dir, config, overfit_evidence, device):
    authorization_status = config.get("training", {}).get("trainingAuthorizationStatus")
    if authorization_status not in {
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
        V8_STAGE4_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS,
    }:
        return None
    telemetry_path = output_dir / "stage4-step-telemetry.json"
    write_json_atomic(telemetry_path, {
        "schemaVersion": "stage4-bounded-repair-smoke-step-telemetry-v1",
        "status": "initialized_before_model_device_placement",
        "createdAtUtc": utc_now(),
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "sampleId": overfit_evidence.get("sampleId"),
        "device": str(device),
        "events": [],
        "state": {},
        "latestStep": None,
        "latestStatus": None,
    })
    return telemetry_path


def record_stage4_step(telemetry_path, step, status, **details):
    if telemetry_path is None:
        return
    allowed_steps = {
        "model_device_placement",
        "autoencoder_checkpoint_read",
        "autoencoder_state_load",
        "denoiser_checkpoint_read",
        "denoiser_state_load",
        "optimizer_creation",
        "batch_device_transfer",
        "forward_loss",
        "backward",
        "optimizer_step",
        "checkpoint_write",
    }
    if step not in allowed_steps or status not in {"started", "completed", "failed"}:
        raise ValueError("Stage4 step telemetry event is invalid")
    telemetry = read_json(telemetry_path)
    events = telemetry.get("events", [])
    event = {
        "sequence": len(events) + 1,
        "step": step,
        "status": status,
        "recordedAtUtc": utc_now(),
        "recordedAtAsiaShanghai": asia_shanghai_now(),
        **details,
    }
    events.append(event)
    prefix = "".join(part[:1].upper() + part[1:] for part in step.split("_"))
    prefix = prefix[:1].lower() + prefix[1:]
    state = telemetry.get("state", {})
    if status == "started":
        state[f"{prefix}Started"] = True
    elif status == "completed":
        state[f"{prefix}Started"] = True
        state[f"{prefix}Completed"] = True
    else:
        state[f"{prefix}Failed"] = True
    telemetry.update({
        "status": "step_recorded",
        "events": events,
        "state": state,
        "latestStep": step,
        "latestStatus": status,
        "updatedAtUtc": event["recordedAtUtc"],
        "updatedAtAsiaShanghai": event["recordedAtAsiaShanghai"],
    })
    write_json_atomic(telemetry_path, telemetry)


def build_optimization_datasets(datasets, overfit_evidence):
    if not overfit_evidence.get("enabled"):
        return datasets
    source_split = overfit_evidence.get("selectedSplit", "train")
    selected = torch.utils.data.Subset(datasets[source_split], [int(overfit_evidence["selectedIndex"])])
    return {
        "train": selected,
        "validation": selected,
        "challenge": selected,
        "regression": selected,
    }


def build_timestep_coverage_evidence(config, epoch_count, batch_count, batch_size):
    diffusion_steps = int(config["diffusionSteps"])
    values = []
    for epoch_index in range(epoch_count):
        for batch_index in range(batch_count):
            values.extend(training_timesteps(
                config,
                epoch_index,
                batch_index,
                batch_count,
                batch_size,
                diffusion_steps,
                torch.device("cpu"),
            ).tolist())
    unique = sorted(set(int(value) for value in values))
    rollout = [int(value) for value in inference_timesteps(diffusion_steps, int(config["inferenceSteps"]), torch.device("cpu")).tolist()]
    exact_overlap = sorted(set(unique).intersection(rollout))
    nearest_gaps = [min(abs(value - trained) for trained in unique) for value in rollout] if unique else []
    return {
        "samplingContract": config.get("training", {}).get("timestepSampling", "legacy_bucket_grid"),
        "diffusionStepCount": diffusion_steps,
        "trainingPresentationCount": len(values),
        "uniqueTrainingTimestepCount": len(unique),
        "coverageRatio": len(unique) / diffusion_steps,
        "minimumTimestep": min(unique) if unique else None,
        "maximumTimestep": max(unique) if unique else None,
        "inferenceTimestepCount": len(rollout),
        "exactInferenceOverlapCount": len(exact_overlap),
        "maximumNearestInferenceGap": max(nearest_gaps) if nearest_gaps else None,
        "fullScheduleCovered": len(unique) == diffusion_steps,
    }


def validate_training_inputs(config, package):
    if config.get("ownership") != OWNERSHIP or config.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted model ownership or lane contract failed")
    if config.get("initialization") != "random_initialization_only" or config.get("upstreamModelIds") != []:
        raise ValueError("AI-assisted model must not declare upstream model weights")
    if config.get("thirdPartyWeightsAllowed") is not False:
        raise ValueError("third-party weights are forbidden")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("locked 23-channel condition contract is invalid")
    channel_types = config.get("conditionChannelTypes", {})
    typed_channels = list(channel_types.get("discrete", [])) + list(channel_types.get("continuous", []))
    if config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("typed condition resize contract is invalid")
    if len(typed_channels) != 23 or set(typed_channels) != set(config["conditionChannelOrder"]):
        raise ValueError("typed condition groups must cover the locked 23-channel order")
    architecture = config.get("denoiserArchitecture")
    if architecture == "multiscale_condition_unet_v4":
        if config.get("training", {}).get("denoiserLossVersion") != "velocity_clean_gradient_condition_reconstruction_v4":
            raise ValueError("V4 composite denoiser loss contract is invalid")
        if config.get("training", {}).get("bestCheckpointMetric") != "fixed_grid_composite_condition_quality_score_v4":
            raise ValueError("V4 composite checkpoint selection contract is invalid")
    elif architecture == "multiscale_condition_unet_v5":
        if config.get("conditionOutputBinding") != "predicted_clean_latent_probe_v1":
            raise ValueError("V5 output-bound condition contract is invalid")
        if config.get("training", {}).get("denoiserLossVersion") != "velocity_output_bound_condition_texture_hierarchy_v5":
            raise ValueError("V5 composite denoiser loss contract is invalid")
        if config.get("training", {}).get("bestCheckpointMetric") != "fixed_grid_output_bound_hierarchy_score_v5":
            raise ValueError("V5 checkpoint selection contract is invalid")
        if config.get("training", {}).get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V5 strict held-out split must be challenge")
    elif architecture == "multiscale_condition_unet_v6":
        training = config.get("training", {})
        if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
            raise ValueError("V6 decoded RGB output binding contract is invalid")
        if training.get("denoiserLossVersion") != "velocity_decoded_rgb_sparse_region_rollout_v6":
            raise ValueError("V6 composite denoiser loss contract is invalid")
        if training.get("bestCheckpointMetric") != "fixed_grid_plus_deterministic_rollout_rgb_score_v6":
            raise ValueError("V6 checkpoint selection contract is invalid")
        if training.get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V6 strict held-out split must be challenge")
        required_sparse = {"terrain_water", "terrain_path_ground", "terrain_shoreline", "object_footprints", "focal_area"}
        if set(training.get("sparseRgbConditionChannels", [])) != required_sparse:
            raise ValueError("V6 sparse RGB condition channels are incomplete")
        if int(training.get("checkpointRolloutSampleCount", 0)) < 1:
            raise ValueError("V6 rollout checkpoint validation must include at least one validation sample")
    elif architecture == "multiscale_condition_unet_v7":
        training = config.get("training", {})
        if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
            raise ValueError("V7 decoded RGB output binding contract is invalid")
        allowed_loss_versions = {"velocity_decoded_rgb_sparse_region_rollout_v7"}
        allowed_checkpoint_metrics = {"all_validation_multiseed_worst_case_semantic_rollout_score_v7"}
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r1":
            allowed_loss_versions.add("velocity_decoded_rgb_semantic_contrast_grid_boundary_v7_repair_r1")
            allowed_checkpoint_metrics.add("all_validation_multiseed_professional_semantic_rollout_score_v7_repair_r1")
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r2":
            allowed_loss_versions.add("velocity_decoded_rgb_semantic_contrast_grid_boundary_short_trajectory_v7_repair_r2")
            allowed_checkpoint_metrics.add("all_validation_multiseed_professional_semantic_rollout_score_v7_repair_r2")
            if training.get("timestepSampling") != "deterministic_full_schedule_cover_v2":
                raise ValueError("V7 R2 requires deterministic full diffusion schedule coverage")
            trajectory = training.get("shortTrajectorySupervision", {})
            if trajectory.get("enabled") is not True:
                raise ValueError("V7 R2 short trajectory supervision must be enabled")
            if int(trajectory.get("steps", 0)) < 2 or int(trajectory.get("stepGap", 0)) < 1:
                raise ValueError("V7 R2 short trajectory supervision contract is invalid")
            if float(trajectory.get("weight", 0.0)) <= 0.0:
                raise ValueError("V7 R2 short trajectory supervision weight must be positive")
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_object_channel_path_topology_short_trajectory_v7_repair_r3_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_object_channel_path_topology_score_v7_repair_r3_candidate")
            validate_v7_r3_candidate_contract(config)
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_object_channel_path_stability_short_trajectory_v7_repair_r4_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_object_channel_path_stability_score_v7_repair_r4_candidate")
            validate_v7_r4_candidate_contract(config)
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_path_replay_trajectory_stability_v7_repair_r5_candidate")
            if "r5Stage4CrossDomainVisualConsistencySelectionEvidence" in training:
                allowed_loss_versions.add("velocity_decoded_rgb_path_replay_cross_domain_visual_consistency_v7_repair_r5_candidate")
            if "r5Stage4StructuredStabilitySelectionEvidence" in training:
                allowed_loss_versions.add("velocity_decoded_rgb_path_replay_cross_domain_structured_stability_v7_repair_r5_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_path_replay_trajectory_stability_score_v7_repair_r5_candidate")
            validate_v7_r5_candidate_contract(config)
        if training.get("denoiserLossVersion") not in allowed_loss_versions:
            raise ValueError("V7 composite denoiser loss contract is invalid")
        if training.get("bestCheckpointMetric") not in allowed_checkpoint_metrics:
            raise ValueError("V7 checkpoint selection contract is invalid")
        if training.get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V7 strict held-out split must be challenge")
        if training.get("checkpointRolloutCoverage") != "all_validation_samples":
            raise ValueError("V7 checkpoint rollout must cover every validation sample")
        if int(training.get("checkpointRolloutSeedsPerSample", 0)) < 2:
            raise ValueError("V7 checkpoint rollout requires at least two deterministic seeds per validation sample")
        validate_v7_training_authorization(config, package)
        required_sparse = {"terrain_water", "terrain_path_ground", "terrain_shoreline", "object_footprints", "focal_area"}
        if set(training.get("sparseRgbConditionChannels", [])) != required_sparse:
            raise ValueError("V7 sparse RGB condition channels are incomplete")
    elif architecture == "multiscale_condition_unet_v8_stage4_decoded_alignment":
        validate_v8_stage4_decoded_domain_alignment_training_contract(config, package)
    elif architecture == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment":
        validate_v9_stage4_object_semantic_decoded_alignment_cpu_contract(config, package)
    else:
        raise ValueError("unsupported conditional denoiser architecture")
    if package.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
        raise ValueError("AI-assisted dataset package schema is invalid")
    if package.get("policyVersion") != POLICY_VERSION or package.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted dataset policy or lane is invalid")
    if package.get("modelConfigId") != config.get("datasetPackageModelId", config.get("modelId")):
        raise ValueError("AI-assisted dataset package model config does not match")
    if package.get("canTrainConditionalDenoiser") is not True or package.get("currentConditionUnpairedCount") != 0:
        raise ValueError("AI-assisted dataset package conditional gate is not open")
    if package.get("currentConditionPairCount") != package.get("conditionOnlyBlueprintCount"):
        raise ValueError("AI-assisted dataset condition pair count is incomplete")
    coverage = package.get("connectivityCoverage", {})
    if coverage.get("thresholdMet") is not True or coverage.get("currentPositiveRecordCount") != 27 or coverage.get("currentNegativeRecordCount") != 27:
        raise ValueError("world connectivity coverage is not complete")
    if package.get("formalInferenceEligible") is not False:
        raise ValueError("conditional training package must not claim formal inference readiness")


def validate_v7_r3_candidate_contract(config):
    training = config.get("training", {})
    required_channels = {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
    if set(training.get("semanticRgbConditionChannels", [])) != required_channels:
        raise ValueError("V7 R3 candidate semantic RGB condition channels are incomplete")
    channel_weights = training.get("objectSemanticChannelWeights", {})
    if set(channel_weights) != required_channels or any(float(channel_weights[name]) <= 0.0 for name in required_channels):
        raise ValueError("V7 R3 candidate object semantic channel weights are invalid")
    required_loss_weights = {"objectSemanticRgb", "pathInteriorRgb", "pathForbiddenBoundaryRgb"}
    loss_weights = training.get("denoiserLossWeights", {})
    if not required_loss_weights.issubset(loss_weights) or any(float(loss_weights[name]) <= 0.0 for name in required_loss_weights):
        raise ValueError("V7 R3 candidate topology loss weights are incomplete")
    required_rollout_weights = {
        "rolloutObjectSemanticRgbMae",
        "rolloutPathInteriorRgbMae",
        "rolloutPathForbiddenBoundaryRgbMae",
    }
    rollout_weights = training.get("rolloutCheckpointMetricWeights", {})
    if not required_rollout_weights.issubset(rollout_weights):
        raise ValueError("V7 R3 candidate rollout topology weights are incomplete")
    gate = training.get("smokeStabilityGate", {})
    if int(gate.get("requiredConsecutiveTailPasses", 0)) != 3:
        raise ValueError("V7 R3 candidate requires exactly three consecutive tail passes")
    if gate.get("requireAllMachineReviewsPassed") is not True or gate.get("preserveReviewThresholds") is not True:
        raise ValueError("V7 R3 candidate stability gate must preserve all machine review thresholds")
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    if len(tail_epochs) != 3 or tail_epochs != sorted(set(tail_epochs)):
        raise ValueError("V7 R3 candidate stability tail epochs are invalid")
    smoke_epochs = [int(value) for value in training.get("fixedEpochPreviewPolicy", {}).get("smoke", [])]
    if any(epoch not in smoke_epochs for epoch in tail_epochs):
        raise ValueError("V7 R3 candidate stability tail epochs are missing from the preview policy")
    authorization = training.get("ownerTrainingAuthorization", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    if authorization_status not in {"not_authorized_candidate_only", V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS}:
        raise ValueError("V7 R3 candidate training authorization status is invalid")
    forbidden_true_flags = (
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if authorization_status == "not_authorized_candidate_only" and any(authorization.get(name) is True for name in forbidden_true_flags):
        raise ValueError("V7 R3 candidate cannot carry active execution authorization")
    return {
        "status": "r3_candidate_contract_valid",
        "semanticRgbConditionChannels": sorted(required_channels),
        "tailEpochs": tail_epochs,
        "requiredConsecutiveTailPasses": 3,
    }


def build_v7_r4_candidate_config(r3_config, candidate_proposal, path_interior_weight, path_forbidden_boundary_weight):
    if candidate_proposal.get("status") not in {
        "isolated_candidate_proposal_cpu_regression_pending_not_implemented_not_active",
        "isolated_candidate_proposal_cpu_verified_not_implemented_not_active",
    }:
        raise ValueError("V7 R4 candidate proposal status is invalid")
    proposal = candidate_proposal.get("proposal", {})
    if proposal.get("boundedRepairVersion") != "v7_bounded_repair_r4_candidate_proposal":
        raise ValueError("V7 R4 candidate proposal version is invalid")
    searches = proposal.get("pathStabilityWeightSearch", {})
    selected = {
        "pathInteriorRgb": float(path_interior_weight),
        "pathForbiddenBoundaryRgb": float(path_forbidden_boundary_weight),
    }
    for name, value in selected.items():
        contract = searches.get(name, {})
        minimum = float(contract.get("minimum", float("nan")))
        maximum = float(contract.get("maximum", float("nan")))
        if not math.isfinite(minimum) or not math.isfinite(maximum) or minimum > maximum:
            raise ValueError(f"V7 R4 candidate {name} search range is invalid")
        if not minimum <= value <= maximum:
            raise ValueError(f"V7 R4 candidate {name} selection is outside the authorized proposal range")
    config = deepcopy(r3_config)
    training = config.setdefault("training", {})
    training["boundedRepairVersion"] = "v7_bounded_repair_r4_candidate"
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["denoiserLossVersion"] = "velocity_decoded_rgb_object_channel_path_stability_short_trajectory_v7_repair_r4_candidate"
    training["bestCheckpointMetric"] = "all_validation_multiseed_object_channel_path_stability_score_v7_repair_r4_candidate"
    training["denoiserLossWeights"]["pathInteriorRgb"] = selected["pathInteriorRgb"]
    training["denoiserLossWeights"]["pathForbiddenBoundaryRgb"] = selected["pathForbiddenBoundaryRgb"]
    training["objectSemanticChannelWeights"] = deepcopy(
        proposal.get("objectSemanticStabilityProposal", {}).get("currentChannelWeights", {})
    )
    training["smokeStabilityGate"] = deepcopy(proposal.get("smokeStabilityGate", {}))
    training["r4BoundedSelectionEvidence"] = {
        "proposalVersion": proposal["boundedRepairVersion"],
        "proposalStatus": candidate_proposal["status"],
        "pathInteriorRgb": {
            "minimum": float(searches["pathInteriorRgb"]["minimum"]),
            "maximum": float(searches["pathInteriorRgb"]["maximum"]),
            "selected": selected["pathInteriorRgb"],
        },
        "pathForbiddenBoundaryRgb": {
            "minimum": float(searches["pathForbiddenBoundaryRgb"]["minimum"]),
            "maximum": float(searches["pathForbiddenBoundaryRgb"]["maximum"]),
            "selected": selected["pathForbiddenBoundaryRgb"],
        },
        "selectedObjectWeightChanges": proposal.get("objectSemanticStabilityProposal", {}).get("selectedWeightChanges"),
        "reviewThresholdPolicy": candidate_proposal.get("reviewThresholdPolicy"),
    }
    training["ownerTrainingAuthorization"] = deepcopy(proposal.get("ownerTrainingAuthorization", {}))
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r4-candidate"
    config["status"] = "isolated_r4_candidate_not_active"
    validate_v7_r4_candidate_contract(config)
    return config


def validate_v7_r4_candidate_contract(config):
    training = config.get("training", {})
    required_channels = {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
    if set(training.get("semanticRgbConditionChannels", [])) != required_channels:
        raise ValueError("V7 R4 candidate semantic RGB condition channels are incomplete")
    channel_weights = training.get("objectSemanticChannelWeights", {})
    if set(channel_weights) != required_channels or any(float(channel_weights[name]) <= 0.0 for name in required_channels):
        raise ValueError("V7 R4 candidate object semantic channel weights are invalid")
    evidence = training.get("r4BoundedSelectionEvidence", {})
    if evidence.get("proposalVersion") != "v7_bounded_repair_r4_candidate_proposal":
        raise ValueError("V7 R4 bounded selection proposal identity is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged":
        raise ValueError("V7 R4 candidate cannot change machine review thresholds")
    if evidence.get("selectedObjectWeightChanges") is not None:
        raise ValueError("V7 R4 candidate cannot select object weight changes without separate authorization")
    loss_weights = training.get("denoiserLossWeights", {})
    for name in ("pathInteriorRgb", "pathForbiddenBoundaryRgb"):
        selection = evidence.get(name, {})
        minimum = float(selection.get("minimum", float("nan")))
        maximum = float(selection.get("maximum", float("nan")))
        selected = float(selection.get("selected", float("nan")))
        if not all(math.isfinite(value) for value in (minimum, maximum, selected)) or minimum > maximum:
            raise ValueError(f"V7 R4 candidate {name} bounded selection evidence is invalid")
        if not minimum <= selected <= maximum:
            raise ValueError(f"V7 R4 candidate {name} selection is outside the proposal range")
        if float(loss_weights.get(name, float("nan"))) != selected:
            raise ValueError(f"V7 R4 candidate {name} selected weight does not match the training loss")
    gate = training.get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    if tail_epochs != [100, 110, 120] or int(gate.get("requiredConsecutiveTailPasses", 0)) != 3:
        raise ValueError("V7 R4 candidate tail stability epochs are invalid")
    if any(gate.get(name) is not True for name in (
        "requireAllMachineReviewsPassed",
        "requireZeroPathBoundaryIssues",
        "requireZeroObjectSemanticIssues",
        "preserveReviewThresholds",
    )):
        raise ValueError("V7 R4 candidate stability gate is incomplete")
    authorization_status = training.get("trainingAuthorizationStatus")
    if authorization_status not in {"not_authorized_candidate_only", V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS}:
        raise ValueError("V7 R4 candidate training authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    forbidden_true_flags = (
        "trainerImplementationAuthorized",
        "gpuTrainingAuthorizedNow",
        "fullTrainingAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if authorization_status == "not_authorized_candidate_only" and any(
        authorization.get(name) is True for name in forbidden_true_flags
    ):
        raise ValueError("V7 R4 candidate cannot carry active execution authorization")
    return {
        "status": "r4_candidate_contract_valid_not_authorized_for_training",
        "semanticRgbConditionChannels": sorted(required_channels),
        "tailEpochs": tail_epochs,
        "requiredConsecutiveTailPasses": 3,
        "pathInteriorRgbWeight": float(loss_weights["pathInteriorRgb"]),
        "pathForbiddenBoundaryRgbWeight": float(loss_weights["pathForbiddenBoundaryRgb"]),
    }


def summarize_v7_r4_tail_stability(review_rows, config):
    gate = config.get("training", {}).get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    rows_by_epoch = {int(row.get("epoch", 0)): row for row in review_rows}
    evaluated = []
    for epoch in tail_epochs:
        row = rows_by_epoch.get(epoch)
        issue_codes = list(row.get("issueCodes", [])) if isinstance(row, dict) else []
        path_issue_free = not any("terrain_path_ground" in code for code in issue_codes)
        object_issue_free = not any(code.startswith("condition_object_") for code in issue_codes)
        evaluated.append({
            "epoch": epoch,
            "recorded": row is not None,
            "passed": bool(row and row.get("passed") is True and not issue_codes),
            "pathBoundaryIssueFree": path_issue_free,
            "objectSemanticIssueFree": object_issue_free,
            "issueCodes": issue_codes,
        })
    passed = (
        len(evaluated) == 3
        and all(row["recorded"] and row["passed"] for row in evaluated)
        and all(row["pathBoundaryIssueFree"] for row in evaluated)
        and all(row["objectSemanticIssueFree"] for row in evaluated)
    )
    return {
        "status": "r4_tail_stability_gate_passed" if passed else "r4_tail_stability_gate_failed_closed",
        "passed": passed,
        "requiredConsecutiveTailPasses": 3,
        "evaluated": evaluated,
    }


def build_v7_r5_candidate_config(
    r4_config,
    candidate_proposal,
    continuation_epochs,
    replay_passes_per_epoch,
    path_short_trajectory_consistency_weight,
):
    if candidate_proposal.get("status") != "isolated_candidate_proposal_cpu_verified_not_implemented_not_active":
        raise ValueError("V7 R5 candidate proposal status is invalid")
    proposal = candidate_proposal.get("proposal", {})
    if proposal.get("boundedRepairVersion") != "v7_bounded_repair_r5_candidate_proposal":
        raise ValueError("V7 R5 candidate proposal version is invalid")
    if r4_config.get("training", {}).get("boundedRepairVersion") != "v7_bounded_repair_r4_candidate":
        raise ValueError("V7 R5 candidate must derive from the immutable R4 candidate configuration")

    selected = {
        "continuationEpochs": int(continuation_epochs),
        "replayPassesPerEpoch": int(replay_passes_per_epoch),
        "pathShortTrajectoryConsistencyWeight": float(path_short_trajectory_consistency_weight),
    }
    bounds = {
        "continuationEpochs": proposal.get("checkpointContinuationProposal", {}).get("continuationEpochs", {}),
        "replayPassesPerEpoch": proposal.get("pathHardExampleReplayProposal", {}).get("replayPassesPerEpoch", {}),
        "pathShortTrajectoryConsistencyWeight": proposal.get("pathShortTrajectoryConsistencyProposal", {}).get("weight", {}),
    }
    for name, value in selected.items():
        minimum = float(bounds[name].get("minimum", float("nan")))
        maximum = float(bounds[name].get("maximum", float("nan")))
        if not math.isfinite(minimum) or not math.isfinite(maximum) or minimum > maximum:
            raise ValueError(f"V7 R5 candidate {name} range is invalid")
        if not minimum <= float(value) <= maximum:
            raise ValueError(f"V7 R5 candidate {name} selection is outside the proposal range")

    if selected["continuationEpochs"] % int(proposal["checkpointContinuationProposal"]["evaluationInterval"]) != 0:
        raise ValueError("V7 R5 continuation epochs must align with the fixed evaluation interval")
    tail_epochs = [selected["continuationEpochs"] - 20, selected["continuationEpochs"] - 10, selected["continuationEpochs"]]
    if tail_epochs[0] <= 0:
        raise ValueError("V7 R5 continuation schedule cannot provide three positive tail epochs")

    config = deepcopy(r4_config)
    training = config.setdefault("training", {})
    training["boundedRepairVersion"] = "v7_bounded_repair_r5_candidate"
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["denoiserLossVersion"] = "velocity_decoded_rgb_path_replay_trajectory_stability_v7_repair_r5_candidate"
    training["bestCheckpointMetric"] = "all_validation_multiseed_path_replay_trajectory_stability_score_v7_repair_r5_candidate"
    training["denoiserEpochs"] = selected["continuationEpochs"]
    training["denoiserLossWeights"]["pathInteriorRgb"] = float(proposal["preserveR4PathLossWeights"]["pathInteriorRgb"])
    training["denoiserLossWeights"]["pathForbiddenBoundaryRgb"] = float(proposal["preserveR4PathLossWeights"]["pathForbiddenBoundaryRgb"])
    training["objectSemanticChannelWeights"] = deepcopy(proposal["objectSemanticStabilityProposal"]["currentChannelWeights"])
    training["pathHardExampleReplay"] = {
        "enabled": True,
        "targetSource": proposal["pathHardExampleReplayProposal"]["targetSource"],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "passesPerEpoch": selected["replayPassesPerEpoch"],
        "evidenceEpochs": deepcopy(proposal["pathHardExampleReplayProposal"]["evidenceEpochs"]),
    }
    training["pathShortTrajectoryConsistency"] = {
        "enabled": True,
        "conditionChannel": proposal["pathShortTrajectoryConsistencyProposal"]["conditionChannel"],
        "objective": proposal["pathShortTrajectoryConsistencyProposal"]["objective"],
        "weight": selected["pathShortTrajectoryConsistencyWeight"],
    }
    training["r5CheckpointContinuation"] = {
        "sourceCheckpointPath": proposal["checkpointContinuationProposal"]["sourceCheckpointPath"],
        "sourceCheckpointSha256": proposal["checkpointContinuationProposal"]["sourceCheckpointSha256"],
        "sourceArchitectureVersion": r4_config.get("architectureVersion"),
        "sourceBoundedRepairVersion": r4_config.get("training", {}).get("boundedRepairVersion"),
        "loadingAuthorizedNow": False,
    }
    training["smokeStabilityGate"] = {
        **deepcopy(proposal["smokeStabilityGate"]),
        "tailEpochs": tail_epochs,
    }
    smoke_previews = sorted(set([1, *range(10, selected["continuationEpochs"] + 1, 10), *tail_epochs]))
    training["fixedEpochPreviewPolicy"] = {
        **deepcopy(training.get("fixedEpochPreviewPolicy", {})),
        "smoke": smoke_previews,
    }
    training["r5BoundedSelectionEvidence"] = {
        "proposalVersion": proposal["boundedRepairVersion"],
        "proposalStatus": candidate_proposal["status"],
        "continuationEpochs": {**deepcopy(bounds["continuationEpochs"]), "selectedValue": selected["continuationEpochs"]},
        "replayPassesPerEpoch": {**deepcopy(bounds["replayPassesPerEpoch"]), "selectedValue": selected["replayPassesPerEpoch"]},
        "pathShortTrajectoryConsistencyWeight": {
            **deepcopy(bounds["pathShortTrajectoryConsistencyWeight"]),
            "selectedValue": selected["pathShortTrajectoryConsistencyWeight"],
        },
        "reviewThresholdPolicy": candidate_proposal.get("reviewThresholdPolicy"),
        "selectedObjectWeightChanges": proposal["objectSemanticStabilityProposal"].get("selectedWeightChanges"),
        "sourceCheckpointPath": proposal["checkpointContinuationProposal"]["sourceCheckpointPath"],
        "sourceCheckpointSha256": proposal["checkpointContinuationProposal"]["sourceCheckpointSha256"],
    }
    training["ownerTrainingAuthorization"] = deepcopy(proposal["ownerTrainingAuthorization"])
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-candidate"
    config["status"] = "isolated_r5_candidate_not_active"
    validate_v7_r5_candidate_contract(config)
    return config


def validate_v7_r5_stage4_inactive_full_training_contract(config):
    training = config.get("training", {})
    contract = training.get("stage4FullTrainingContract")
    if not isinstance(contract, dict):
        raise ValueError("V7 R5 Stage 4 inactive full-training contract is missing")
    if training.get("trainingAuthorizationStatus") != "not_authorized_candidate_only":
        raise ValueError("V7 R5 Stage 4 inactive full-training contract cannot activate training")
    if contract.get("status") != "compiled_not_active":
        raise ValueError("V7 R5 Stage 4 inactive full-training contract status is invalid")
    if contract.get("datasetCapacityCount") != 64 or contract.get("splitCounts") != {
        "train": 48,
        "validation": 8,
        "challenge": 4,
        "regression": 4,
    }:
        raise ValueError("V7 R5 Stage 4 inactive full-training dataset contract is invalid")
    expected_stages = [
        {
            "index": 0,
            "width": 256,
            "height": 192,
            "epochs": 40,
            "initialization": "deterministic_project_random",
        },
        {
            "index": 1,
            "width": 512,
            "height": 384,
            "epochs": 40,
            "initialization": "current_run_stage_0_checkpoint_only",
        },
        {
            "index": 2,
            "width": 1024,
            "height": 768,
            "epochs": 40,
            "initialization": "current_run_stage_1_checkpoint_only",
        },
    ]
    if contract.get("stages") != expected_stages:
        raise ValueError("V7 R5 Stage 4 inactive full-training stages must remain 40 Epoch each")
    if contract.get("fixedPreviewEpochsPerStage") != [1, 5, 10, 20, 30, 40]:
        raise ValueError("V7 R5 Stage 4 inactive full-training preview policy is invalid")
    expected_flags = {
        "machineReviewRequiredPerStage": True,
        "stopOnFirstFailure": True,
        "automaticRetryAuthorized": False,
        "stage3SmokeCheckpointInitializationAuthorized": False,
        "strictRevalidationAuthorized": False,
    }
    for key, expected in expected_flags.items():
        if contract.get(key) is not expected:
            raise ValueError(f"V7 R5 Stage 4 inactive full-training boundary is invalid: {key}")
    if int(training.get("denoiserEpochs", 0)) != 40:
        raise ValueError("V7 R5 Stage 4 inactive full-training denoiserEpochs must be 40")
    return {
        "status": "v7_r5_stage4_inactive_full_training_contract_valid_not_active",
        "stageCount": 3,
        "epochsPerStage": 40,
        "stage3SmokeContinuationEpochs": 30,
    }


def is_v7_r5_stage4_contract_mode(config):
    training = config.get("training", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    stage4_bounded_repair_candidate = any(key in training for key in (
        "r5Stage4DiagnosticEvidenceBoundedSelectionEvidence",
        "r5Stage4CrossDomainVisualConsistencySelectionEvidence",
        "r5Stage4StructuredStabilitySelectionEvidence",
    ))
    inactive_full_training = (
        authorization_status == "not_authorized_candidate_only"
        and "stage4FullTrainingContract" in training
    )
    if inactive_full_training:
        validate_v7_r5_stage4_inactive_full_training_contract(config)
    return (
        authorization_status in {
            V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS,
            V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS,
        }
        or stage4_bounded_repair_candidate
        or inactive_full_training
    )


def validate_v7_r5_candidate_contract(config):
    training = config.get("training", {})
    evidence = training.get("r5BoundedSelectionEvidence", {})
    if evidence.get("proposalVersion") != "v7_bounded_repair_r5_candidate_proposal":
        raise ValueError("V7 R5 bounded selection proposal identity is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged":
        raise ValueError("V7 R5 candidate cannot change machine review thresholds")
    if evidence.get("selectedObjectWeightChanges") is not None:
        raise ValueError("V7 R5 candidate cannot change object weights")

    authorization_status = training.get("trainingAuthorizationStatus")
    stage4_bounded_repair_candidate = (
        "r5Stage4DiagnosticEvidenceBoundedSelectionEvidence" in training
        or "r5Stage4CrossDomainVisualConsistencySelectionEvidence" in training
        or "r5Stage4StructuredStabilitySelectionEvidence" in training
    )
    stage4_mode = is_v7_r5_stage4_contract_mode(config)
    selected_fields = {
        # Stage 3 bounded-selection evidence governs its 30-Epoch Smoke only.
        # Stage 4 has an independent formal per-stage epoch contract validated below.
        "continuationEpochs": int(evidence.get("continuationEpochs", {}).get("selectedValue", 0)) if stage4_mode else int(training.get("denoiserEpochs", 0)),
        "replayPassesPerEpoch": int(training.get("pathHardExampleReplay", {}).get("passesPerEpoch", 0)),
        "pathShortTrajectoryConsistencyWeight": float(training.get("pathShortTrajectoryConsistency", {}).get("weight", float("nan"))),
    }
    for name, selected in selected_fields.items():
        selection = evidence.get(name, {})
        minimum = float(selection.get("minimum", float("nan")))
        maximum = float(selection.get("maximum", float("nan")))
        recorded = float(selection.get("selectedValue", float("nan")))
        if not all(math.isfinite(value) for value in (minimum, maximum, recorded)) or minimum > maximum:
            raise ValueError(f"V7 R5 candidate {name} bounded selection evidence is invalid")
        if not minimum <= float(selected) <= maximum or float(selected) != recorded:
            raise ValueError(f"V7 R5 candidate {name} selection does not match the bounded evidence")

    loss_weights = training.get("denoiserLossWeights", {})
    if float(loss_weights.get("pathInteriorRgb", float("nan"))) != 2.0 or float(loss_weights.get("pathForbiddenBoundaryRgb", float("nan"))) != 2.0:
        raise ValueError("V7 R5 candidate must preserve the R4 path loss weights")
    required_object_weights = {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": 1.25,
        "object_vegetation": 1.0,
    }
    actual_object_weights = {name: float(value) for name, value in training.get("objectSemanticChannelWeights", {}).items()}
    if actual_object_weights != required_object_weights:
        raise ValueError("V7 R5 candidate must preserve the R4 object semantic weights")

    replay = training.get("pathHardExampleReplay", {})
    if replay.get("enabled") is not True or replay.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("V7 R5 path replay target source is invalid")
    if replay.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 failed preview pixels cannot be used as training targets")
    consistency = training.get("pathShortTrajectoryConsistency", {})
    if consistency.get("enabled") is not True or consistency.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 path short-trajectory consistency contract is invalid")
    if training.get("shortTrajectorySupervision", {}).get("enabled") is not True or int(training.get("shortTrajectorySupervision", {}).get("steps", 0)) < 2:
        raise ValueError("V7 R5 requires the existing short-trajectory supervision")
    if any(key in training for key in (
        "pathCoverageCalibration",
        "authorizedBoundaryTopology",
        "pathActivationMassCalibration",
        "shortTrajectoryCoverageDrift",
    )):
        validate_v7_r5_stage3_internal_trainer_contract(config)
    if any(key in training for key in (
        "r5Stage4DiagnosticEvidenceBoundedSelectionEvidence",
        "stage4RequiredBoundaryContact",
    )):
        validate_v7_r5_stage4_diagnostic_evidence_bounded_repair_contract(config)
    if "r5Stage4CrossDomainVisualConsistencySelectionEvidence" in training:
        validate_v7_r5_stage4_cross_domain_visual_consistency_contract(config)
    if "r5Stage4StructuredStabilitySelectionEvidence" in training:
        validate_v7_r5_stage4_structured_stability_candidate_contract(config)

    continuation = training.get("r5CheckpointContinuation", {})
    if continuation.get("sourceBoundedRepairVersion") != "v7_bounded_repair_r4_candidate":
        raise ValueError("V7 R5 checkpoint continuation source version is invalid")
    if not isinstance(continuation.get("sourceCheckpointSha256"), str) or len(continuation["sourceCheckpointSha256"]) != 64:
        raise ValueError("V7 R5 checkpoint continuation SHA-256 is invalid")
    if continuation.get("sourceCheckpointPath") != evidence.get("sourceCheckpointPath") or continuation.get("sourceCheckpointSha256") != evidence.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 checkpoint continuation identity does not match the proposal evidence")
    smoke_authorized = authorization_status in {
        V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
    }
    bounded_smoke_preflight = authorization_status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS
    stage4_preflight = authorization_status == V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS
    full_training_authorized = authorization_status == V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS
    loading_continuation = (
        training.get("r5Stage4BoundedRepairCheckpointContinuation")
        or training.get("r5Stage3CheckpointContinuation")
        or continuation
    )
    if authorization_status not in {
        "not_authorized_candidate_only",
        V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
    }:
        raise ValueError("V7 R5 candidate training authorization status is invalid")
    if smoke_authorized and loading_continuation.get("loadingAuthorizedNow") is not True:
        raise ValueError("V7 R5 authorized Smoke must enable checkpoint loading")
    if not smoke_authorized and loading_continuation.get("loadingAuthorizedNow") is not False:
        raise ValueError("V7 R5 isolated candidate cannot authorize checkpoint loading")

    gate = training.get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    continuation_epochs = selected_fields["continuationEpochs"]
    if tail_epochs != [continuation_epochs - 20, continuation_epochs - 10, continuation_epochs]:
        raise ValueError("V7 R5 candidate tail stability epochs are invalid")
    if int(gate.get("requiredConsecutiveTailPasses", 0)) != 3 or any(gate.get(name) is not True for name in (
        "requireAllMachineReviewsPassed",
        "requireZeroPathBoundaryIssues",
        "requireZeroObjectSemanticIssues",
        "preserveReviewThresholds",
    )):
        raise ValueError("V7 R5 candidate stability gate is incomplete")
    smoke_epochs = [int(value) for value in training.get("fixedEpochPreviewPolicy", {}).get("smoke", [])]
    if any(epoch not in smoke_epochs for epoch in tail_epochs):
        raise ValueError("V7 R5 tail epochs are missing from the fixed preview policy")

    authorization = training.get("ownerTrainingAuthorization", {})
    active_flags = (
        "checkpointLoadingAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    forbidden_flags = (
        "automaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if smoke_authorized:
        if any(authorization.get(name) is not True for name in active_flags):
            raise ValueError("V7 R5 active Smoke is missing an execution flag")
        if authorization.get("fullTrainingAuthorized") is not False or any(authorization.get(name) is not False for name in forbidden_flags):
            raise ValueError("V7 R5 active Smoke improperly opens a forbidden execution boundary")
    elif stage4_preflight or bounded_smoke_preflight:
        if any(authorization.get(name) is True for name in (*active_flags, "fullTrainingAuthorized", *forbidden_flags)):
            raise ValueError("V7 R5 Stage 4 preflight config carries an active execution flag")
    elif full_training_authorized:
        for name in ("checkpointLoadingAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized"):
            if authorization.get(name) is not True:
                raise ValueError(f"V7 R5 Stage 4 full training is missing {name}")
        if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not False:
            raise ValueError("V7 R5 Stage 4 full training cannot authorize single-sample Smoke")
        if any(authorization.get(name) is not False for name in forbidden_flags):
            raise ValueError("V7 R5 Stage 4 full training opens a forbidden downstream boundary")
    elif any(authorization.get(name) is True for name in (*active_flags, "fullTrainingAuthorized", *forbidden_flags)):
        raise ValueError("V7 R5 isolated candidate carries an active execution flag")
    return {
        "status": (
            "r5_candidate_contract_valid_for_single_smoke"
            if smoke_authorized
            else (
                "r5_candidate_contract_valid_for_stage4_full_training"
                if full_training_authorized
                else (
                    "r5_candidate_contract_valid_for_stage4_bounded_repair_not_active"
                    if stage4_bounded_repair_candidate
                    else (
                        "r5_candidate_contract_valid_for_stage4_preflight"
                        if stage4_mode
                        else "r5_candidate_contract_valid_not_authorized_for_training"
                    )
                )
            )
        ),
        "continuationEpochs": continuation_epochs,
        "replayPassesPerEpoch": selected_fields["replayPassesPerEpoch"],
        "pathShortTrajectoryConsistencyWeight": selected_fields["pathShortTrajectoryConsistencyWeight"],
        "tailEpochs": tail_epochs,
        "checkpointLoadingAuthorized": smoke_authorized or full_training_authorized,
    }


def validate_v7_r5_stage3_internal_trainer_contract(config):
    training = config.get("training", {})
    coverage = training.get("pathCoverageCalibration", {})
    boundary = training.get("authorizedBoundaryTopology", {})
    replay = training.get("pathHardExampleReplay", {})
    if coverage.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 path coverage calibration must be enabled")
    if coverage.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 path coverage calibration requires terrain_path_ground")
    if coverage.get("targetSource") != "original_condition_mask_support_only":
        raise ValueError("V7 R5 stage-3 path coverage target source is invalid")
    if coverage.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 cannot use a machine-review threshold as a training target")
    if boundary.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 authorized boundary topology must be enabled")
    if boundary.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 authorized boundary topology requires terrain_path_ground")
    if boundary.get("allowedSidesSource") != "original_condition_channel_boundary_contact_only":
        raise ValueError("V7 R5 stage-3 authorized boundary source is invalid")
    for name, contract in (("path coverage calibration", coverage), ("authorized boundary topology", boundary)):
        weight = float(contract.get("weight", float("nan")))
        if not math.isfinite(weight) or not 0.25 <= weight <= 0.75:
            raise ValueError(f"V7 R5 stage-3 {name} weight is outside the authorized implementation bounds")
    if replay.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("V7 R5 stage-3 replay requires original Owner-approved RGB and conditions")
    if replay.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 stage-3 replay cannot use failed preview pixels as targets")
    if int(replay.get("passesPerEpoch", 0)) != 2:
        raise ValueError("V7 R5 stage-3 requires exactly two original-target replay passes per epoch")
    authorization = training.get("ownerTrainingAuthorization", {})
    smoke_authorized = training.get("trainingAuthorizationStatus") in {
        V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
    }
    stage4_preflight = training.get("trainingAuthorizationStatus") in {
        V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS,
        V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
    }
    full_training_authorized = training.get("trainingAuthorizationStatus") == V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS
    active_flags = (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    forbidden_flags = (
        "automaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if smoke_authorized:
        if any(authorization.get(key) is not True for key in active_flags):
            raise ValueError("V7 R5 stage-3 active Smoke is missing an execution authorization")
        if authorization.get("fullTrainingAuthorized") is not False or any(authorization.get(key) is not False for key in forbidden_flags):
            raise ValueError("V7 R5 stage-3 active Smoke opens a forbidden execution boundary")
    elif stage4_preflight:
        if any(authorization.get(key) is True for key in (*active_flags, "fullTrainingAuthorized", *forbidden_flags)):
            raise ValueError("V7 R5 Stage 4 preflight carries an active execution authorization")
    elif full_training_authorized:
        for key in ("checkpointLoadingAuthorized", "optimizerCreationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized"):
            if authorization.get(key) is not True:
                raise ValueError(f"V7 R5 Stage 4 full training is missing {key}")
        if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not False:
            raise ValueError("V7 R5 Stage 4 full training cannot authorize single-sample Smoke")
        if any(authorization.get(key) is not False for key in forbidden_flags):
            raise ValueError("V7 R5 Stage 4 full training opens a forbidden downstream boundary")
    elif any(authorization.get(key) is True for key in (*active_flags, "fullTrainingAuthorized", *forbidden_flags)):
        raise ValueError("V7 R5 stage-3 inactive contract carries an active execution authorization")
    convergence = None
    if "pathActivationMassCalibration" in training or "shortTrajectoryCoverageDrift" in training:
        convergence = validate_v7_r5_stage3_coverage_convergence_trainer_contract(config)
    return {
        "status": "r5_stage3_internal_trainer_contract_valid_for_stage4" if full_training_authorized else "r5_stage3_internal_trainer_contract_valid_not_active",
        "pathCoverageCalibrationWeight": float(coverage["weight"]),
        "authorizedBoundaryTopologyWeight": float(boundary["weight"]),
        "replayPassesPerEpoch": 2,
        "coverageConvergence": convergence,
    }


def validate_v7_r5_stage3_coverage_convergence_trainer_contract(config):
    training = config.get("training", {})
    activation = training.get("pathActivationMassCalibration", {})
    drift = training.get("shortTrajectoryCoverageDrift", {})
    if activation.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration must be enabled")
    if activation.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 path activation-mass calibration requires terrain_path_ground")
    if activation.get("targetSource") != "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only":
        raise ValueError("V7 R5 stage-3 path activation-mass target source is invalid")
    if activation.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration cannot use failed preview pixels")
    if activation.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration cannot use machine-review thresholds")
    if activation.get("lossForm") != "symmetric_log_activation_mass_ratio_plus_outside_support_leakage":
        raise ValueError("V7 R5 stage-3 path activation-mass loss form is invalid")
    activation_weight = float(activation.get("weight", float("nan")))
    if not math.isfinite(activation_weight) or not 0.25 <= activation_weight <= 0.75:
        raise ValueError("V7 R5 stage-3 path activation-mass weight is outside the candidate bounds")

    if drift.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift must be enabled")
    if drift.get("source") != "current_training_prediction_steps_against_original_target_activation_mass_only":
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift source is invalid")
    if drift.get("failedPreviewTrajectoryUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift cannot use failed preview trajectories")
    drift_weight = float(drift.get("weight", float("nan")))
    if not math.isfinite(drift_weight) or not 0.1 <= drift_weight <= 0.35:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift weight is outside the candidate bounds")
    return {
        "status": "r5_stage3_coverage_convergence_trainer_contract_valid_not_active",
        "pathActivationMassCalibrationWeight": activation_weight,
        "shortTrajectoryCoverageDriftWeight": drift_weight,
    }


def validate_v7_r5_stage4_diagnostic_evidence_bounded_repair_contract(config):
    training = config.get("training", {})
    evidence = training.get("r5Stage4DiagnosticEvidenceBoundedSelectionEvidence", {})
    required_contact = training.get("stage4RequiredBoundaryContact", {})
    expected_policy = (
        "failure_prevalence_linear_mapping_with_bound_diagnostic_direction_"
        "and_no_threshold_reinterpretation"
    )
    if evidence.get("candidateVersion") != "v7_r5_stage4_diagnostic_evidence_bounded_candidate_v1":
        raise ValueError("V7 R5 Stage 4 bounded repair candidate identity is invalid")
    if evidence.get("candidateStatus") != "selected_inactive_not_authorized":
        raise ValueError("V7 R5 Stage 4 bounded repair candidate must remain inactive")
    if evidence.get("selectionPolicy") != expected_policy:
        raise ValueError("V7 R5 Stage 4 bounded repair selection policy is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged_not_used_as_training_target":
        raise ValueError("V7 R5 Stage 4 bounded repair cannot reinterpret review thresholds")

    selections = evidence.get("selectedValues", {})
    expected = {
        "objectRockRelativeMultiplier": (1.0, 1.25, 1.25),
        "pathActivationMassCalibrationWeight": (0.625, 0.75, 2.0 / 3.0),
        "requiredBoundaryContactLossWeight": (0.25, 0.75, 1.0 / 3.0),
    }
    for name, (minimum, maximum, selected) in expected.items():
        record = selections.get(name, {})
        actual = (
            float(record.get("minimum", float("nan"))),
            float(record.get("maximum", float("nan"))),
            float(record.get("selectedValue", float("nan"))),
        )
        if not all(math.isfinite(value) for value in actual):
            raise ValueError(f"V7 R5 Stage 4 bounded repair {name} selection is invalid")
        if any(not math.isclose(value, wanted, rel_tol=0.0, abs_tol=1e-12) for value, wanted in zip(actual, (minimum, maximum, selected))):
            raise ValueError(f"V7 R5 Stage 4 bounded repair {name} selection does not match its evidence bound")
        if not actual[0] <= actual[2] <= actual[1]:
            raise ValueError(f"V7 R5 Stage 4 bounded repair {name} selection is outside its bounds")

    expected_object_weights = {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": 1.25,
        "object_vegetation": 1.0,
    }
    actual_object_weights = {
        name: float(value)
        for name, value in training.get("objectSemanticChannelWeights", {}).items()
    }
    if actual_object_weights != expected_object_weights:
        raise ValueError("V7 R5 Stage 4 bounded repair object channel weights are invalid")
    activation_weight = float(training.get("pathActivationMassCalibration", {}).get("weight", float("nan")))
    if not math.isclose(activation_weight, 2.0 / 3.0, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 bounded repair path activation-mass weight is invalid")

    if required_contact.get("enabled") is not True:
        raise ValueError("V7 R5 Stage 4 required-boundary contact loss must be enabled in the inactive candidate")
    required_contact_identity = {
        "conditionChannel": "terrain_path_ground",
        "targetSource": "original_owner_approved_rgb_required_boundary_activation_with_original_condition_mask_only",
        "requiredSidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
        "lossForm": "required_side_target_activation_deficit",
    }
    for name, value in required_contact_identity.items():
        if required_contact.get(name) != value:
            raise ValueError(f"V7 R5 Stage 4 required-boundary contact {name} is invalid")
    if required_contact.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 Stage 4 required-boundary contact cannot use failed preview pixels")
    if required_contact.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 Stage 4 required-boundary contact cannot use machine-review thresholds")
    contact_weight = float(required_contact.get("weight", float("nan")))
    if not math.isclose(contact_weight, 1.0 / 3.0, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 required-boundary contact weight is invalid")
    topology = training.get("authorizedBoundaryTopology", {})
    required_sides = list(topology.get("requiredBoundarySides", []))
    if not required_sides or any(side not in {"north", "south", "west", "east"} for side in required_sides):
        raise ValueError("V7 R5 Stage 4 bounded repair required boundary sides are invalid")
    if not math.isclose(
        float(required_contact.get("boundaryBandRatio", float("nan"))),
        float(topology.get("boundaryBandRatio", float("nan"))),
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise ValueError("V7 R5 Stage 4 required-boundary contact band must preserve the topology contract")
    if evidence.get("candidateActive") is not False:
        raise ValueError("V7 R5 Stage 4 bounded repair evidence cannot activate the candidate")
    return {
        "status": "r5_stage4_diagnostic_evidence_bounded_repair_contract_valid_not_active",
        "objectSemanticChannelWeights": actual_object_weights,
        "pathActivationMassCalibrationWeight": activation_weight,
        "requiredBoundaryContactLossWeight": contact_weight,
        "requiredBoundarySides": required_sides,
    }


def validate_v7_r5_stage4_cross_domain_visual_consistency_contract(config):
    training = config.get("training", {})
    evidence = training.get("r5Stage4CrossDomainVisualConsistencySelectionEvidence", {})
    contract = training.get("stage4CrossDomainVisualConsistency", {})
    if evidence.get("candidateVersion") != "v7_r5_stage4_cross_domain_visual_consistency_candidate_v1":
        raise ValueError("V7 R5 Stage 4 cross-domain candidate identity is invalid")
    if evidence.get("candidateStatus") != "selected_inactive_not_authorized":
        raise ValueError("V7 R5 Stage 4 cross-domain candidate provenance must remain inactive")
    if evidence.get("selectionPolicy") != "five_preview_failure_prevalence_linear_mapping_with_existing_training_weight_caps":
        raise ValueError("V7 R5 Stage 4 cross-domain selection policy is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged_not_used_as_training_target":
        raise ValueError("V7 R5 Stage 4 cross-domain candidate cannot reinterpret review thresholds")
    expected_selections = {
        "crossDomainRolloutWeight": (0.175, 0.35, 0.35),
        "gradientTailSteps": (2.0, 5.0, 5.0),
        "objectRockRelativeMultiplier": (1.0, 1.25, 1.25),
    }
    selections = evidence.get("selectedValues", {})
    for name, expected in expected_selections.items():
        record = selections.get(name, {})
        actual = tuple(float(record.get(key, float("nan"))) for key in ("minimum", "maximum", "selectedValue"))
        if not all(math.isfinite(value) for value in actual):
            raise ValueError(f"V7 R5 Stage 4 cross-domain {name} selection is invalid")
        if any(not math.isclose(value, wanted, rel_tol=0.0, abs_tol=1e-12) for value, wanted in zip(actual, expected)):
            raise ValueError(f"V7 R5 Stage 4 cross-domain {name} selection does not match its bounded evidence")
        if not actual[0] <= actual[2] <= actual[1]:
            raise ValueError(f"V7 R5 Stage 4 cross-domain {name} selection is outside its bounds")

    required_identity = {
        "enabled": True,
        "targetSource": "original_owner_approved_rgb_and_condition_pack_only",
        "rolloutInitializationSource": "deterministic_noise_from_task_seed_plus_preview_offset_without_preview_pixels",
        "conditionChannel": "terrain_path_ground",
        "objectChannel": "object_rock",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "inferenceStepsSource": "model_config_inference_steps",
    }
    for key, expected in required_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"V7 R5 Stage 4 cross-domain contract {key} is invalid")
    if int(contract.get("previewSeedOffset", -1)) != 3000:
        raise ValueError("V7 R5 Stage 4 cross-domain preview seed offset is invalid")
    if int(contract.get("gradientTailSteps", 0)) != 5:
        raise ValueError("V7 R5 Stage 4 cross-domain gradient tail is invalid")
    if int(contract.get("gradientTailSteps", 0)) > int(config.get("inferenceSteps", 0)):
        raise ValueError("V7 R5 Stage 4 cross-domain gradient tail exceeds the rollout")
    if not math.isclose(float(contract.get("weight", float("nan"))), 0.35, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 cross-domain rollout weight is invalid")
    route = contract.get("route", {})
    if route.get("lossForm") != "path_rgb_plus_activation_mass_plus_required_boundary_contact":
        raise ValueError("V7 R5 Stage 4 cross-domain route loss form is invalid")
    if route.get("requiredSidesSource") != "authorizedBoundaryTopology.requiredBoundarySides":
        raise ValueError("V7 R5 Stage 4 cross-domain route side source is invalid")
    rock = contract.get("rock", {})
    if rock.get("lossForm") != "masked_rgb_plus_masked_edge_reference_consistency":
        raise ValueError("V7 R5 Stage 4 cross-domain Rock loss form is invalid")
    if not math.isclose(float(rock.get("rgbWeight", float("nan"))), 1.25, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 cross-domain Rock RGB weight is invalid")
    if not math.isclose(float(rock.get("edgeWeight", float("nan"))), 0.35, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 cross-domain Rock edge weight is invalid")
    if evidence.get("candidateActive") is not False:
        raise ValueError("V7 R5 Stage 4 cross-domain evidence cannot activate itself")
    return {
        "status": "r5_stage4_cross_domain_visual_consistency_contract_valid_not_formally_promoted",
        "crossDomainRolloutWeight": float(contract["weight"]),
        "gradientTailSteps": int(contract["gradientTailSteps"]),
        "requiredBoundarySides": list(training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides", [])),
    }


def validate_v7_r5_stage4_structured_stability_candidate_contract(config):
    training = config.get("training", {})
    evidence = training.get("r5Stage4StructuredStabilitySelectionEvidence", {})
    contract = training.get("stage4StructuredTrajectoryStability", {})
    qualification = training.get("stage4LateStabilityQualification", {})
    if evidence.get("candidateVersion") != "v7_r5_stage4_structured_stability_candidate_v2":
        raise ValueError("V7 R5 Stage 4 structured stability candidate identity is invalid")
    if evidence.get("candidateStatus") != "selected_inactive_not_authorized":
        raise ValueError("V7 R5 Stage 4 structured stability candidate must remain inactive")
    if evidence.get("selectionPolicy") != "observed_failure_prevalence_linear_mapping_with_existing_weight_caps":
        raise ValueError("V7 R5 Stage 4 structured stability selection policy is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged_not_used_as_training_target":
        raise ValueError("V7 R5 Stage 4 structured stability cannot reinterpret review thresholds")
    if (
        evidence.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or evidence.get("machineReviewThresholdUsedAsTrainingTarget") is not False
    ):
        raise ValueError("V7 R5 Stage 4 structured stability evidence uses a forbidden training target")
    expected_selections = {
        "trajectoryTailStepCount": (2.0, 3.0, 3.0),
        "routeTrajectoryStabilityWeight": (0.05, 0.2, 0.11),
        "rockTrajectoryStabilityWeight": (0.05, 0.25, 0.21),
    }
    selections = evidence.get("selectedValues", {})
    for name, expected in expected_selections.items():
        record = selections.get(name, {})
        actual = tuple(float(record.get(key, float("nan"))) for key in ("minimum", "maximum", "selectedValue"))
        if not all(math.isfinite(value) for value in actual):
            raise ValueError(f"V7 R5 Stage 4 structured stability {name} selection is invalid")
        if any(not math.isclose(value, wanted, rel_tol=0.0, abs_tol=1e-12) for value, wanted in zip(actual, expected)):
            raise ValueError(f"V7 R5 Stage 4 structured stability {name} selection does not match evidence")
        if not actual[0] <= actual[2] <= actual[1]:
            raise ValueError(f"V7 R5 Stage 4 structured stability {name} selection is outside bounds")
    required_identity = {
        "enabled": True,
        "status": "candidate_support_not_active",
        "targetSource": "original_owner_approved_rgb_and_condition_pack_only",
        "trajectorySource": "current_cross_domain_gradient_tail_predictions_only",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
    }
    for key, expected in required_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"V7 R5 Stage 4 structured stability contract {key} is invalid")
    tail_steps = int(contract.get("tailStepCount", 0))
    if tail_steps != 3 or tail_steps > int(training.get("stage4CrossDomainVisualConsistency", {}).get("gradientTailSteps", 0)):
        raise ValueError("V7 R5 Stage 4 structured stability tail step count is invalid")
    route = contract.get("route", {})
    if route.get("conditionChannel") != "terrain_path_ground" or route.get("lossForm") != "original_reference_plus_adjacent_tail_step_consistency":
        raise ValueError("V7 R5 Stage 4 structured route stability identity is invalid")
    if not math.isclose(float(route.get("weight", float("nan"))), 0.11, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 structured route stability weight is invalid")
    rock = contract.get("rock", {})
    if rock.get("conditionChannel") != "object_rock" or rock.get("lossForm") != "original_reference_plus_adjacent_tail_step_consistency":
        raise ValueError("V7 R5 Stage 4 structured Rock stability identity is invalid")
    if not math.isclose(float(rock.get("weight", float("nan"))), 0.21, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("V7 R5 Stage 4 structured Rock stability weight is invalid")
    if qualification.get("status") != "qualification_gate_not_training_target_not_active":
        raise ValueError("V7 R5 Stage 4 late stability qualification status is invalid")
    if qualification.get("requiredEpochs") != [20, 30] or int(qualification.get("minimumConsecutivePasses", 0)) != 2:
        raise ValueError("V7 R5 Stage 4 late stability qualification window is invalid")
    if qualification.get("finalEpochMustPass") is not True:
        raise ValueError("V7 R5 Stage 4 late stability qualification must include the final epoch")
    if (
        qualification.get("machineReviewThresholdUsedAsTrainingTarget") is not False
        or qualification.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or qualification.get("trainingTarget") is not False
    ):
        raise ValueError("V7 R5 Stage 4 late stability qualification cannot become a training target")
    if evidence.get("candidateActive") is not False:
        raise ValueError("V7 R5 Stage 4 structured stability evidence cannot activate itself")
    return {
        "status": "r5_stage4_structured_stability_contract_valid_not_active",
        "tailStepCount": tail_steps,
        "routeTrajectoryStabilityWeight": float(route["weight"]),
        "rockTrajectoryStabilityWeight": float(rock["weight"]),
        "lateQualificationEpochs": list(qualification["requiredEpochs"]),
    }


def validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(config, project_root=None):
    if config.get("denoiserArchitecture") != "multiscale_condition_unet_v8_stage4_decoded_alignment":
        raise ValueError("V8 Stage 4 decoded alignment architecture identity is invalid")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("V8 Stage 4 decoded alignment must preserve the 23-channel condition contract")
    if config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("V8 Stage 4 decoded alignment typed resize contract is invalid")
    if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
        raise ValueError("V8 Stage 4 decoded alignment latent and RGB output binding changed")

    training = config.get("training", {})
    contract = training.get("stage4DecodedDomainAlignment", {})
    expected_identity = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": "stage4_decoded_domain_alignment_bridge_v1",
        "architectureId": "multiscale_condition_unet_v8_stage4_decoded_alignment",
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "legacyStage3AndStage4ModesPreserved": True,
        "existingDenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": "not_implemented_not_authorized",
    }
    for key, expected in expected_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"V8 Stage 4 decoded alignment contract {key} is invalid")

    adapters = contract.get("typedConditionDecoderAdapters", {})
    if adapters.get("scales") != ["up1", "up0"]:
        raise ValueError("V8 Stage 4 decoded alignment typed adapter scales are invalid")
    if adapters.get("source") != "original_compiled_23_channel_condition_pack":
        raise ValueError("V8 Stage 4 decoded alignment typed adapter source is invalid")
    if adapters.get("channelOrder") != config.get("conditionChannelOrder"):
        raise ValueError("V8 Stage 4 decoded alignment typed adapter channel order changed")
    if adapters.get("resizeContract") != config.get("conditionResizeContract"):
        raise ValueError("V8 Stage 4 decoded alignment typed adapter resize contract changed")

    expected_readout_channels = [
        "terrain_path_ground",
        "route_required_boundary",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    ]
    readout = contract.get("sharedSemanticTopologyReadout", {})
    if readout.get("channels") != expected_readout_channels:
        raise ValueError("V8 Stage 4 decoded alignment shared readout channel order is invalid")
    if readout.get("sourceFeatures") != "existing_up0_decoder_features_after_up1_and_up0_typed_condition_adapters":
        raise ValueError("V8 Stage 4 decoded alignment shared readout source is invalid")
    if readout.get("changesLatentOutputShape") is not False:
        raise ValueError("V8 Stage 4 decoded alignment readout cannot change latent output shape")

    decoded_path = contract.get("frozenAutoencoderDecodedConsistencyPath", {})
    expected_decoded_path = {
        "status": "support_contract_only_not_active",
        "autoencoderParametersFrozen": True,
        "gradientMayFlowToDenoiserPrediction": True,
        "autoencoderCheckpointReadRequiresSeparateAuthorization": True,
    }
    if decoded_path != expected_decoded_path:
        raise ValueError("V8 Stage 4 decoded alignment frozen autoencoder path contract is invalid")

    supervision = contract.get("supervisionContract", {})
    expected_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "current_training_prediction_and_frozen_project_autoencoder_decode",
    ]
    if supervision.get("allowedSources") != expected_sources:
        raise ValueError("V8 Stage 4 decoded alignment supervision sources are invalid")
    if (
        supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
        or supervision.get("conditionMaskIsWorldFactAuthority") is not False
    ):
        raise ValueError("V8 Stage 4 decoded alignment uses a forbidden supervision source")
    if contract.get("hyperparameterSelections") != []:
        raise ValueError("V8 Stage 4 decoded alignment CPU support cannot select hyperparameters")

    activation_gate = contract.get("activationGate", {})
    expected_activation_fields = {
        "configurationActiveNow",
        "checkpointReadNow",
        "optimizerCreationNow",
        "backwardExecutionNow",
        "modelParameterUpdateNow",
        "gpuUseNow",
        "trainingNow",
        "validationNow",
        "formalInferenceNow",
        "checkpointPromotionNow",
        "runtimeFrameNow",
        "worldEntryNow",
    }
    if set(activation_gate) != expected_activation_fields or any(
        activation_gate.get(key) is not False for key in expected_activation_fields
    ):
        raise ValueError("V8 Stage 4 decoded alignment activation gate is not fully closed")

    root = Path(project_root or Path.cwd()).resolve()
    evidence = contract.get("evidenceBindings", {})
    evidence_specs = (
        (
            "architectureDesignTerminal",
            "8f5a6f2a59ade9ee5fed8c7e8cd42944ff4188630e2f5f80bf176536c06c1608",
            "architecture design terminal",
        ),
        (
            "architectureDesignReport",
            "2b6b4702987f14fb9de1c7ba3e15f090519b230b1d7df00920ffcfa54b302613",
            "architecture design report",
        ),
        (
            "inactiveImplementationContract",
            "da53f0005c99c64d525ec25d784b52304d76775a405847a02a71800c1212438e",
            "inactive architecture implementation contract",
        ),
    )
    verified_paths = {}
    for key, expected_sha, label in evidence_specs:
        identity = evidence.get(key, {})
        if identity.get("sha256") != expected_sha:
            raise ValueError(f"V8 Stage 4 decoded alignment {label} identity is invalid")
        verified_paths[key] = verify_config_bound_project_file(
            root,
            identity.get("path"),
            identity.get("sha256"),
            label,
        )
    design_terminal = read_json(verified_paths["architectureDesignTerminal"])
    implementation_contract = read_json(verified_paths["inactiveImplementationContract"])
    if (
        design_terminal.get("recommendedContractId") != "stage4_decoded_domain_alignment_bridge_v1"
        or design_terminal.get("recommendedDirectionId") != "condition_to_decoded_visual_domain_consistency"
        or implementation_contract.get("contractId") != "stage4_decoded_domain_alignment_bridge_v1"
        or implementation_contract.get("proposedArchitectureId")
        != "multiscale_condition_unet_v8_stage4_decoded_alignment"
    ):
        raise ValueError("V8 Stage 4 decoded alignment bound architecture decision changed")

    implementation = contract.get("ownerImplementationAuthorization", {})
    authorization_path = verify_config_bound_project_file(
        root,
        implementation.get("authorizationPath"),
        implementation.get("authorizationSha256"),
        "decoded alignment Owner authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root,
        implementation.get("implementationConsumptionPath"),
        implementation.get("implementationConsumptionSha256"),
        "decoded alignment implementation consumption",
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    command_ref = "owner-authorized-r5-stage4-decoded-domain-alignment-cpu-support-20260808-204122373"
    scope = "implement_stage4_decoded_domain_alignment_bridge_v1_cpu_support_compile_inactive_config_and_regress_only"
    if (
        authorization.get("schemaVersion")
        != "owner-authorized-r5-stage4-decoded-domain-alignment-cpu-support-input-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or implementation.get("commandRef") != command_ref
        or implementation.get("scope") != scope
    ):
        raise ValueError("V8 Stage 4 decoded alignment Owner authorization identity is invalid")
    if (
        consumption.get("status") != "consumed_once_for_cpu_support_implementation"
        or consumption.get("commandRef") != command_ref
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != implementation.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("V8 Stage 4 decoded alignment implementation consumption identity is invalid")
    authorized = authorization.get("authorizedBoundaries", {})
    if any(authorized.get(key) is not True for key in (
        "modelCodeModificationAuthorized",
        "trainerCodeModificationAuthorized",
        "existingInactiveCompilerAndCpuCheckerModificationAuthorized",
        "syntheticCpuTensorForwardAuthorized",
        "syntheticCpuAutogradInspectionAuthorized",
        "inactiveConfigCompilationAuthorized",
    )):
        raise ValueError("V8 Stage 4 decoded alignment CPU implementation actions are incomplete")
    if any(authorized.get(key) is not False for key in (
        "hyperparameterSelectionAuthorized",
        "checkpointReadOrLoadAuthorized",
        "optimizerCreationAuthorized",
        "backwardMethodExecutionAuthorized",
        "modelParameterUpdateAuthorized",
        "modelWeightModificationAuthorized",
        "gpuUseAuthorized",
        "trainingAuthorized",
        "reviewThresholdModificationAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    )):
        raise ValueError("V8 Stage 4 decoded alignment Owner authorization opens a forbidden action")

    owner_training = training.get("ownerTrainingAuthorization", {})
    if training.get("trainingAuthorizationStatus") != "not_authorized_candidate_only":
        raise ValueError("V8 Stage 4 decoded alignment configuration must remain inactive")
    if owner_training.get("status") != "not_authorized_candidate_only" or any(
        owner_training.get(key) is not False for key in (
            "checkpointLoadingAuthorized",
            "optimizerCreationAuthorized",
            "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow",
            "fullTrainingAuthorized",
            "singleSampleGpuOverfitSmokeAuthorized",
            "automaticRetryAuthorized",
            "strictRevalidationAuthorized",
            "validationAuthorized",
            "formalInferenceAuthorized",
            "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized",
            "worldEntryAuthorized",
        )
    ):
        raise ValueError("V8 Stage 4 decoded alignment nested training authorization is not closed")
    return {
        "status": "v8_stage4_decoded_domain_alignment_cpu_support_contract_valid_not_active",
        "conditionChannels": 23,
        "adapterScales": list(adapters["scales"]),
        "sharedReadoutChannels": list(readout["channels"]),
        "existingDenoiserCheckpointCompatible": False,
    }


def validate_v8_stage4_decoded_domain_alignment_training_contract(config, package, project_root=None):
    if config.get("denoiserArchitecture") != "multiscale_condition_unet_v8_stage4_decoded_alignment":
        raise ValueError("V8 Stage 4 training architecture identity is invalid")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("V8 Stage 4 training must preserve the 23-channel condition contract")
    if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
        raise ValueError("V8 Stage 4 decoded output binding changed")
    training = config.get("training", {})
    if training.get("denoiserLossVersion") != "velocity_decoded_rgb_shared_semantic_topology_alignment_v8_stage4":
        raise ValueError("V8 Stage 4 training loss version is invalid")
    if training.get("bestCheckpointMetric") != "fixed_grid_plus_shared_semantic_topology_rollout_score_v8_stage4":
        raise ValueError("V8 Stage 4 checkpoint metric identity is invalid")
    if conditional_dataset_selection_contract(config) != "registered_v7_capacity_contribution_v1":
        raise ValueError("V8 Stage 4 must use the registered V7 capacity dataset")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V8 Stage 4 dataset does not contain the approved 64 capacity rows")

    contract = training.get("stage4DecodedDomainAlignment", {})
    expected_channels = [
        "terrain_path_ground", "route_required_boundary", "object_footprints",
        "object_tree", "object_rock", "object_vegetation",
    ]
    if contract.get("contractId") != "stage4_decoded_domain_alignment_bridge_v1":
        raise ValueError("V8 Stage 4 training contract identity is invalid")
    if contract.get("architectureId") != config.get("denoiserArchitecture"):
        raise ValueError("V8 Stage 4 training contract architecture changed")
    if contract.get("sharedSemanticTopologyReadout", {}).get("channels") != expected_channels:
        raise ValueError("V8 Stage 4 shared readout channel order is invalid")
    supervision = contract.get("sharedReadoutTrainingSupervision", {})
    if supervision.get("loss") != "balanced_binary_cross_entropy_v1":
        raise ValueError("V8 Stage 4 shared readout loss identity is invalid")
    if supervision.get("weightSource") != "training.denoiserLossWeights.discreteConditionOutputBinding":
        raise ValueError("V8 Stage 4 shared readout must reuse the existing discrete condition weight")
    if float(training.get("denoiserLossWeights", {}).get("discreteConditionOutputBinding", 0.0)) <= 0.0:
        raise ValueError("V8 Stage 4 reused discrete condition weight is missing")
    if supervision.get("targetChannels") != expected_channels:
        raise ValueError("V8 Stage 4 shared readout targets changed")
    if (
        supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
        or supervision.get("newFreeHyperparameterSelected") is not False
        or supervision.get("conditionMaskIsWorldFactAuthority") is not False
    ):
        raise ValueError("V8 Stage 4 shared readout uses a forbidden training target or parameter")
    allowed_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "current_training_prediction_and_frozen_project_autoencoder_decode",
    ]
    if supervision.get("allowedSources") != allowed_sources or contract.get("hyperparameterSelections") != []:
        raise ValueError("V8 Stage 4 supervision source or hyperparameter boundary changed")
    smoke = training.get("v8Stage4SingleSampleSmokeContract", {})
    if (
        smoke.get("sampleId") != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or smoke.get("sampleSplit") != "validation"
        or smoke.get("seed") != 20263722
        or smoke.get("requiredBoundarySides") != ["west"]
        or smoke.get("epochCount") != 30
        or smoke.get("previewEpochs") != [1, 5, 10, 20, 30]
        or smoke.get("resolution") != {"width": 256, "height": 192}
    ):
        raise ValueError("V8 Stage 4 fixed Smoke identity is invalid")
    if training.get("seed") != 20263722 or training.get("authorizedOverfitSampleId") != smoke.get("sampleId"):
        raise ValueError("V8 Stage 4 seed or sample binding changed")
    if training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides") != ["west"]:
        raise ValueError("V8 Stage 4 west topology binding changed")
    if training.get("fixedEpochPreviewPolicy", {}).get("smoke") != [1, 5, 10, 20, 30]:
        raise ValueError("V8 Stage 4 fixed preview policy changed")

    status = training.get("trainingAuthorizationStatus")
    active = status == V8_STAGE4_SMOKE_ACTIVE_STATUS
    if status not in {V8_STAGE4_SMOKE_INACTIVE_STATUS, V8_STAGE4_SMOKE_ACTIVE_STATUS}:
        raise ValueError("V8 Stage 4 training authorization status is invalid")
    expected_gate = {
        "configurationActiveNow": active,
        "autoencoderCheckpointReadNow": active,
        "oldDenoiserCheckpointReadNow": False,
        "optimizerCreationNow": active,
        "backwardExecutionNow": active,
        "modelParameterUpdateNow": active,
        "gpuUseNow": active,
        "trainingNow": active,
        "checkpointWriteNow": active,
        "stage4FullTrainingNow": False,
        "stage1OrStage2Now": False,
        "strictRevalidationNow": False,
        "formalInferenceNow": False,
        "checkpointPromotionNow": False,
        "runtimeFrameNow": False,
        "worldEntryNow": False,
    }
    if contract.get("activationGate") != expected_gate or contract.get("enabled") is not active:
        raise ValueError("V8 Stage 4 activation gate is invalid")
    expected_implementation = "implemented_active_owner_authorized" if active else "implemented_cpu_verified_not_active"
    if contract.get("trainingLossImplementationStatus") != expected_implementation:
        raise ValueError("V8 Stage 4 training loss implementation status is invalid")

    owner = training.get("ownerTrainingAuthorization", {})
    if not active:
        if owner.get("status") != "not_authorized_candidate_only" or any(
            owner.get(key) is True
            for key in (
                "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
                "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow",
                "singleSampleGpuOverfitSmokeAuthorized", "fullTrainingAuthorized",
            )
        ):
            raise ValueError("V8 Stage 4 inactive config opens an execution action")
    else:
        root = Path(project_root or Path.cwd()).resolve()
        authorization_path = verify_config_bound_project_file(
            root, owner.get("authorizationPath"), owner.get("authorizationSha256"),
            "V8 Stage 4 Smoke Owner authorization",
        )
        consumption_path = verify_config_bound_project_file(
            root, owner.get("executionConsumptionPath"), owner.get("executionConsumptionSha256"),
            "V8 Stage 4 Smoke execution consumption",
        )
        authorization = read_json(authorization_path)
        consumption = read_json(consumption_path)
        if (
            authorization.get("requestId") != "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808"
            or authorization.get("status") != "resolved_owner_authorized"
            or authorization.get("ownerDecision", {}).get("commandRef")
            != "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808"
            or consumption.get("status") != "gpu_smoke_authorization_atomically_consumed"
            or consumption.get("authorizationSha256") != owner.get("authorizationSha256")
        ):
            raise ValueError("V8 Stage 4 active Owner authorization or consumption is invalid")
        actions = authorization.get("authorizedActions", {})
        if not all(actions.get(key) is True for key in (
            "autoencoderCheckpointReadAndLoad", "optimizerCreation", "backwardExecution",
            "boundedModelWeightMutation", "singleSampleThirtyEpochTraining",
            "smokeCheckpointWrite", "fivePreviewWriteAndMachineReview",
        )):
            raise ValueError("V8 Stage 4 active authorization actions are incomplete")
        if actions.get("oldDenoiserCheckpointReadOrLoad") is not False or actions.get("stage4FullTraining") is not False:
            raise ValueError("V8 Stage 4 active authorization opens forbidden lineage or full training")
    return {
        "status": "v8_stage4_shared_readout_training_contract_valid_active" if active else "v8_stage4_shared_readout_training_contract_valid_inactive",
        "sharedReadoutChannels": expected_channels,
        "sharedReadoutWeight": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
    }


def validate_v9_stage4_object_semantic_decoded_alignment_cpu_contract(config, package, project_root=None):
    if config.get("training", {}).get("trainingAuthorizationStatus") in {
        V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS,
        V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS,
    }:
        return validate_v9_stage4_unified_preview_active_contract(config, package, project_root)
    if config.get("training", {}).get("trainingAuthorizationStatus") == V9_STAGE4_SMOKE_ACTIVE_STATUS:
        return validate_v9_stage4_active_smoke_contract(config, package, project_root)
    if config.get("denoiserArchitecture") != "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment":
        raise ValueError("V9 Stage 4 object semantic alignment architecture identity is invalid")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("V9 Stage 4 must preserve the locked 23-channel condition contract")
    if config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("V9 Stage 4 typed condition resize contract is invalid")
    if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
        raise ValueError("V9 Stage 4 latent and decoded RGB output binding changed")
    if conditional_dataset_selection_contract(config) != "registered_v7_capacity_contribution_v1":
        raise ValueError("V9 Stage 4 must reuse the approved registered V7 capacity dataset")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V9 Stage 4 dataset does not contain the approved 64 capacity rows")

    training = config.get("training", {})
    if training.get("trainingAuthorizationStatus") != V9_STAGE4_CPU_INACTIVE_STATUS:
        raise ValueError("V9 Stage 4 CPU support configuration must remain inactive")
    if training.get("denoiserLossVersion") != "velocity_decoded_rgb_independent_object_semantic_topology_alignment_v9_stage4":
        raise ValueError("V9 Stage 4 training Loss identity is invalid")
    if training.get("bestCheckpointMetric") != "fixed_grid_plus_independent_object_semantic_topology_rollout_score_v9_stage4":
        raise ValueError("V9 Stage 4 checkpoint metric identity is invalid")

    contract = training.get("stage4ObjectSemanticDecoderAlignment", {})
    expected_identity = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": "stage4_object_semantic_decoder_alignment_v9_v1",
        "architectureId": "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "legacyStage3Stage4AndV8ModesPreserved": True,
        "v7OrV8DenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": "implemented_cpu_verified_not_active",
    }
    for key, expected in expected_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"V9 Stage 4 contract {key} is invalid")

    adapters = contract.get("typedConditionDecoderAdapters", {})
    if (
        adapters.get("scales") != ["up1", "up0"]
        or adapters.get("source") != "original_compiled_23_channel_condition_pack"
        or adapters.get("channelOrder") != config.get("conditionChannelOrder")
        or adapters.get("resizeContract") != config.get("conditionResizeContract")
    ):
        raise ValueError("V9 Stage 4 typed condition adapter contract is invalid")

    expected_objects = list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS)
    projections = contract.get("independentObjectSemanticProjections", {})
    if (
        projections.get("objectChannels") != expected_objects
        or projections.get("scales") != ["up1", "up0"]
        or projections.get("projectionCount") != 8
        or projections.get("independentPerObject") is not True
        or projections.get("independentReadoutPerObject") is not True
        or projections.get("source") != "matching_original_object_semantic_condition_channel_only"
        or projections.get("changesLatentOutputShape") is not False
    ):
        raise ValueError("V9 Stage 4 independent object projection contract is invalid")

    route = contract.get("preservedRouteTopologyReadout", {})
    if (
        route.get("channels") != ["terrain_path_ground", "route_required_boundary"]
        or route.get("requiredBoundarySides") != ["west"]
        or route.get("worldFactAuthority") != "approved_world_facts_and_project_route_geometry"
        or route.get("conditionMaskRole") != "consistency_projection_only_not_world_fact_authority"
    ):
        raise ValueError("V9 Stage 4 preserved west route topology contract is invalid")

    decoded_path = contract.get("frozenAutoencoderDecodedConsistencyPath", {})
    if decoded_path != {
        "status": "cpu_support_only_not_active",
        "autoencoderParametersFrozen": True,
        "gradientMayFlowToDenoiserPrediction": True,
        "autoencoderCheckpointReadRequiresSeparateAuthorization": True,
    }:
        raise ValueError("V9 Stage 4 frozen Autoencoder decoded consistency contract is invalid")

    supervision = contract.get("objectSemanticTrainingSupervision", {})
    expected_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts",
        "original_object_semantic_and_identity_masks",
        "current_training_prediction_decoded_by_frozen_project_autoencoder",
        "frozen_project_autoencoder_decoded_features",
        "approved_project_route_geometry_and_region_graph_for_west_topology_consistency",
    ]
    if (
        supervision.get("loss") != "independent_two_scale_balanced_binary_cross_entropy_plus_existing_masked_decoded_rgb_alignment_v1"
        or supervision.get("weightSource") != "training.denoiserLossWeights.discreteConditionOutputBinding"
        or supervision.get("targetChannels") != expected_objects
        or supervision.get("allowedSources") != expected_sources
        or supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewLabelsUsedAsTrainingTargets") is not False
        or supervision.get("newFreeHyperparameterSelected") is not False
    ):
        raise ValueError("V9 Stage 4 object semantic supervision contract is invalid")
    if float(training.get("denoiserLossWeights", {}).get("discreteConditionOutputBinding", 0.0)) <= 0.0:
        raise ValueError("V9 Stage 4 must reuse the existing discrete condition output binding weight")
    if contract.get("hyperparameterSelections") != []:
        raise ValueError("V9 Stage 4 CPU implementation cannot select hyperparameters")

    registry = contract.get("diagnosticManifestRegistry", {})
    if (
        registry.get("contractId") != "stage4_diagnostic_manifest_registration_contract_v1"
        or registry.get("recordLocation") != "manifest.metrics[*]"
        or registry.get("fixedEpochs") != [1, 5, 10, 20, 30]
        or registry.get("exactFieldCount") != 17
        or registry.get("exactFields") != list(V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
        or registry.get("rejectUnknownDiagnosticFields") is not True
        or registry.get("finiteNonnegativeNumbersRequired") is not True
        or registry.get("visualReviewIndependent") is not True
    ):
        raise ValueError("V9 Stage 4 exact diagnostic Manifest registry contract is invalid")

    diagnostic = training.get("stage4FailureDiagnostics", {})
    if (
        diagnostic.get("enabled") is not True
        or diagnostic.get("status") != "v9_diagnostic_manifest_registry_supported_inactive"
        or diagnostic.get("objectSemanticDiagnostics", {}).get("channels") != expected_objects
        or diagnostic.get("objectSemanticDiagnostics", {}).get("gradientTarget")
        != "matching_v9_object_projection_features_up1_and_up0"
        or diagnostic.get("routeLateRegressionDiagnostics", {}).get("requiredBoundarySidesSource")
        != "authorizedBoundaryTopology.requiredBoundarySides"
    ):
        raise ValueError("V9 Stage 4 diagnostic calculation contract is invalid")

    activation_gate = contract.get("activationGate", {})
    expected_activation_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "validationNow", "checkpointWriteNow", "stage4FullTrainingNow",
        "stage1OrStage2Now", "strictRevalidationNow", "formalInferenceNow",
        "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
    }
    if set(activation_gate) != expected_activation_fields or any(
        activation_gate.get(key) is not False for key in expected_activation_fields
    ):
        raise ValueError("V9 Stage 4 activation gate is not fully closed")

    smoke = training.get("v9Stage4SingleSampleSmokeContract", {})
    if (
        smoke.get("status") != "compiled_inactive_not_authorized"
        or smoke.get("sampleId") != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or smoke.get("sampleSplit") != "validation"
        or smoke.get("seed") != 20263722
        or smoke.get("requiredBoundarySides") != ["west"]
        or smoke.get("epochCount") != 30
        or smoke.get("previewEpochs") != [1, 5, 10, 20, 30]
        or smoke.get("resolution") != {"width": 256, "height": 192}
        or smoke.get("oldDenoiserCheckpointCompatible") is not False
        or smoke.get("oldDenoiserCheckpointReadAuthorized") is not False
        or smoke.get("stage0Initialization") != "project_random_v9_denoiser"
    ):
        raise ValueError("V9 Stage 4 fixed sample and west topology identity is invalid")
    if training.get("seed") != 20263722 or training.get("authorizedOverfitSampleId") != smoke.get("sampleId"):
        raise ValueError("V9 Stage 4 fixed seed or sample binding changed")
    if training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides") != ["west"]:
        raise ValueError("V9 Stage 4 west topology binding changed")
    if training.get("fixedEpochPreviewPolicy", {}).get("smoke") != [1, 5, 10, 20, 30]:
        raise ValueError("V9 Stage 4 fixed preview policy changed")

    root = Path(project_root or Path.cwd()).resolve()
    evidence = contract.get("evidenceBindings", {})
    evidence_specs = (
        ("v9DesignTerminal", "18a82b764b80d004d6361d7674926d38c9d7e3d2236bea1c7143377eafbcab34"),
        ("v9DesignReport", "7fe5700f89966ea84004d9379679c41807ce9396299078997ea5097e25107d13"),
        ("v9InactiveDesignContract", "85ec0ce486738a722e513a41dd63225123528ad65cd73243cfa41970c4e3642c"),
    )
    verified_paths = {}
    for key, expected_sha in evidence_specs:
        identity = evidence.get(key, {})
        if identity.get("sha256") != expected_sha:
            raise ValueError(f"V9 Stage 4 bound design evidence identity is invalid: {key}")
        verified_paths[key] = verify_config_bound_project_file(
            root, identity.get("path"), identity.get("sha256"), key,
        )
    design_terminal = read_json(verified_paths["v9DesignTerminal"])
    design_contract = read_json(verified_paths["v9InactiveDesignContract"])
    if (
        design_terminal.get("status") != "v9_stage4_architecture_design_and_diagnostic_manifest_contract_completed_closed"
        or design_terminal.get("designContractId") != "stage4_object_semantic_decoder_alignment_v9_v1"
        or design_contract.get("status") != "designed_inactive_not_implemented"
        or design_contract.get("proposedArchitectureId") != config.get("denoiserArchitecture")
        or [row.get("manifestField") for row in design_contract.get("diagnosticManifestFields", [])]
        != list(V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
    ):
        raise ValueError("V9 Stage 4 bound design decision or diagnostic mapping changed")

    implementation = contract.get("ownerImplementationAuthorization", {})
    authorization_path = verify_config_bound_project_file(
        root, implementation.get("authorizationPath"), implementation.get("authorizationSha256"),
        "V9 Stage 4 Owner implementation authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root, implementation.get("implementationConsumptionPath"), implementation.get("implementationConsumptionSha256"),
        "V9 Stage 4 implementation consumption",
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    command_ref = "owner-authorized-v9-stage4-cpu-support-and-manifest-registry-20260809"
    scope = "implement_v9_cpu_architecture_object_semantic_supervision_exact_17_manifest_registry_inactive_config_and_regressions_only"
    if (
        authorization.get("requestId") != command_ref
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != command_ref
        or authorization.get("ownerDecision", {}).get("scope") != scope
        or implementation.get("commandRef") != command_ref
        or implementation.get("scope") != scope
        or consumption.get("status") != "v9_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != implementation.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("V9 Stage 4 implementation authorization or consumption identity is invalid")
    actions = authorization.get("authorizedActions", {})
    required_actions = (
        "modelV9ArchitectureBranchImplementation", "trainerV9AuthorizationAndLegalSupervisionImplementation",
        "exact17DiagnosticManifestRegistryImplementation", "v9InactiveConfigCompilerImplementation",
        "v9CpuCheckerImplementation", "syntheticCpuTensorForward", "syntheticCpuAutogradInspection",
        "cpuPositiveNegativeRegression", "legacyV7V8CompatibilityRegression", "inactiveConfigWrite",
        "supportContractWrite", "cpuReportWrite", "terminalEvidenceWrite", "uniquePlanUpdate",
    )
    forbidden_actions = (
        "hyperparameterSelection", "checkpointFileReadOrLoad", "optimizerCreation",
        "backwardMethodExecution", "modelWeightModification", "gpuUse", "training",
        "reviewThresholdModification", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    )
    if any(actions.get(key) is not True for key in required_actions):
        raise ValueError("V9 Stage 4 implementation actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden_actions):
        raise ValueError("V9 Stage 4 implementation authorization opens a forbidden action")

    owner = training.get("ownerTrainingAuthorization", {})
    if owner.get("status") != "not_authorized_cpu_support_only" or any(
        owner.get(key) is not False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized",
            "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
            "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized", "strictRevalidationAuthorized",
            "validationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
        )
    ):
        raise ValueError("V9 Stage 4 nested training authorization is not fully closed")
    return {
        "status": "v9_stage4_object_semantic_decoder_alignment_cpu_contract_valid_inactive",
        "objectChannels": expected_objects,
        "projectionScales": ["up1", "up0"],
        "diagnosticManifestFields": list(V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
        "reusedWeight": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
        "v7OrV8DenoiserCheckpointCompatible": False,
    }


def validate_v9_stage4_unified_preview_active_contract(config, package, project_root=None):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    validation_kernel_mode = training.get("trainingAuthorizationStatus") == V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS
    execution = training.get("v9Stage4SmokeExecution", {})
    required_execution_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "gpuConsumptionPath", "gpuConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
    }
    if validation_kernel_mode:
        required_execution_fields.update({"phase0TerminalPath", "phase0TerminalSha256"})
    if set(execution) != required_execution_fields:
        raise ValueError("V9 Stage 4 unified preview execution identity fields are invalid")
    source_path = verify_config_bound_project_file(root, execution.get("sourceInactiveConfigPath"), execution.get("sourceInactiveConfigSha256"), "V9 unified preview inactive config")
    authorization_path = verify_config_bound_project_file(root, execution.get("ownerAuthorizationPath"), execution.get("ownerAuthorizationSha256"), "V9 unified preview Owner authorization")
    consumption_path = verify_config_bound_project_file(root, execution.get("gpuConsumptionPath"), execution.get("gpuConsumptionSha256"), "V9 unified preview GPU consumption")
    attestation_path = verify_config_bound_project_file(root, execution.get("implementationAttestationPath"), execution.get("implementationAttestationSha256"), "V9 unified preview implementation attestation")
    phase0_terminal = None
    if validation_kernel_mode:
        phase0_terminal_path = verify_config_bound_project_file(root, execution.get("phase0TerminalPath"), execution.get("phase0TerminalSha256"), "Stage4 validation kernel Phase0 terminal")
        phase0_terminal = read_json(phase0_terminal_path)
    source = read_json(source_path)
    source_result = validate_v9_stage4_object_semantic_decoded_alignment_cpu_contract(source, package, project_root)
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    attestation = read_json(attestation_path)
    request_id = (
        "owner-authorized-stage4-validation-kernel-through-stage5-20260810"
        if validation_kernel_mode
        else "owner-authorized-stage4-continuous-closure-20260809"
    )
    scope = (
        "stage4_validation_kernel_then_single_smoke_full_training_and_stage5_strict_revalidation"
        if validation_kernel_mode
        else "continuous_stage4_business_closure_or_route_exit_with_bounded_implementation_repairs"
    )
    expected_consumption_status = (
        "stage4_validation_kernel_model_smoke_gpu_authorization_atomically_consumed"
        if validation_kernel_mode
        else "stage4_unified_preview_smoke_gpu_authorization_atomically_consumed"
    )
    expected_attestation_status = (
        "stage4_validation_kernel_model_smoke_implementation_cpu_verified"
        if validation_kernel_mode
        else "stage4_unified_preview_pipeline_implementation_cpu_verified"
    )
    if (
        authorization.get("requestId") != request_id
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != request_id
        or authorization.get("ownerDecision", {}).get("scope") != scope
        or consumption.get("status") != expected_consumption_status
        or consumption.get("requestId") != request_id
        or consumption.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
        or attestation.get("status") != expected_attestation_status
        or attestation.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or (validation_kernel_mode and phase0_terminal.get("status") != "stage4_validation_kernel_phase0_passed_closed")
    ):
        raise ValueError("V9 Stage 4 unified preview authorization lineage is invalid")
    actions = authorization.get("authorizedActions", {})
    required_actions = (
        ("singleThirtyEpochV9Smoke", "smokeOptimizerBackwardWeightAndCheckpointWrite", "phase0ProjectAutoencoderReadAndLoadFrozen")
        if validation_kernel_mode
        else ("projectAutoencoderCheckpointReadAndLoad", "boundedSmokeOptimizerCreation", "boundedSmokeBackwardExecution", "boundedSmokeWeightModification", "boundedSmokeCheckpointWrite", "singleThirtyEpochGpuSmoke", "machineReview")
    )
    for key in required_actions:
        if actions.get(key) is not True:
            raise ValueError(f"V9 Stage 4 unified preview authorized action is closed: {key}")
    forbidden_actions = (
        ("formalInference", "checkpointFormalPromotion", "ownerFormalVisualAcceptance", "runtimeFrame", "worldEntry", "worldRuntime")
        if validation_kernel_mode
        else ("stage5StrictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame", "worldEntry", "machineReviewThresholdReduction", "failedPreviewPixelsAsTrainingTarget", "freeHyperparameterSearch")
    )
    for key in forbidden_actions:
        if actions.get(key) is not False:
            raise ValueError(f"V9 Stage 4 unified preview forbidden action is open: {key}")

    smoke = training.get("v9Stage4SingleSampleSmokeContract", {})
    model_contract = training.get("stage4ObjectSemanticDecoderAlignment", {})
    preview_contract = training.get("stage4UnifiedTrainingPreviewSamplingContract", {})
    expected_preview_contract = {
        "schemaVersion": "stage4-unified-training-preview-sampling-contract-v1",
        "enabled": True,
        "status": "active_owner_authorized_single_execution",
        "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
        "modelStateBinding": "sha256_sorted_tensor_bytes_v1",
        "seedBinding": "training_seed_plus_3000",
        "normalizationBinding": "checkpoint_latent_normalization",
        "decodeBinding": "frozen_project_autoencoder_decode_clamp_0_1",
        "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
        "deterministicAlgorithmsRequired": True,
        "cublasWorkspaceConfig": ":4096:8",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdsUsedAsTrainingTargets": False,
    }
    if preview_contract != expected_preview_contract:
        raise ValueError("V9 Stage 4 unified preview sampling contract is invalid")
    if (
        config.get("architectureVersion") != (
            "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"
            if validation_kernel_mode
            else "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke"
        )
        or smoke.get("status") != "active_owner_authorized_single_execution"
        or model_contract.get("enabled") is not True
        or model_contract.get("status") != "training_loss_active_owner_authorized"
        or model_contract.get("trainingLossImplementationStatus") != "implemented_active_owner_authorized"
    ):
        raise ValueError("V9 Stage 4 unified preview active gate is invalid")
    owner = training.get("ownerTrainingAuthorization", {})
    if (
        owner.get("authorizationId") != request_id
        or owner.get("authorizationPath") != execution.get("ownerAuthorizationPath")
        or owner.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or owner.get("executionConsumptionPath") != execution.get("gpuConsumptionPath")
        or owner.get("executionConsumptionSha256") != execution.get("gpuConsumptionSha256")
        or owner.get("status") != (
            V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS
            if validation_kernel_mode
            else V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS
        )
    ):
        raise ValueError("V9 Stage 4 unified preview nested Owner authorization is invalid")

    sanitized = deepcopy(config)
    sanitized["architectureVersion"] = source["architectureVersion"]
    sanitized_training = sanitized["training"]
    source_training = source["training"]
    sanitized_training["trainingAuthorizationStatus"] = source_training["trainingAuthorizationStatus"]
    sanitized_training["v9Stage4SingleSampleSmokeContract"] = deepcopy(source_training["v9Stage4SingleSampleSmokeContract"])
    sanitized_training["ownerTrainingAuthorization"] = deepcopy(source_training["ownerTrainingAuthorization"])
    sanitized_training["stage4ObjectSemanticDecoderAlignment"] = deepcopy(source_training["stage4ObjectSemanticDecoderAlignment"])
    if "stage4UnifiedTrainingPreviewSamplingContract" in source_training:
        sanitized_training["stage4UnifiedTrainingPreviewSamplingContract"] = deepcopy(source_training["stage4UnifiedTrainingPreviewSamplingContract"])
    else:
        sanitized_training.pop("stage4UnifiedTrainingPreviewSamplingContract", None)
    sanitized_training.pop("v9Stage4SmokeExecution", None)
    if sanitized != source:
        raise ValueError("V9 Stage 4 unified preview Smoke changed fields outside the bounded activation contract")
    return {
        **source_result,
        "status": "v9_stage4_unified_preview_pipeline_smoke_contract_valid_active",
        "authorizationId": request_id,
        "sampleId": smoke.get("sampleId"),
    }


def validate_v9_stage4_active_smoke_contract(config, package, project_root=None):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    execution = training.get("v9Stage4SmokeExecution", {})
    required_execution_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "gpuConsumptionPath", "gpuConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
    }
    if set(execution) != required_execution_fields:
        raise ValueError("V9 Stage 4 active Smoke execution identity fields are invalid")
    source_path = verify_config_bound_project_file(
        root, execution.get("sourceInactiveConfigPath"), execution.get("sourceInactiveConfigSha256"),
        "V9 Stage 4 inactive source config",
    )
    authorization_path = verify_config_bound_project_file(
        root, execution.get("ownerAuthorizationPath"), execution.get("ownerAuthorizationSha256"),
        "V9 Stage 4 Smoke Owner authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root, execution.get("gpuConsumptionPath"), execution.get("gpuConsumptionSha256"),
        "V9 Stage 4 Smoke GPU consumption",
    )
    attestation_path = verify_config_bound_project_file(
        root, execution.get("implementationAttestationPath"), execution.get("implementationAttestationSha256"),
        "V9 Stage 4 Smoke implementation attestation",
    )
    if execution.get("sourceInactiveConfigSha256") != "e4a90350ea1263bcef0a90ba36491f4a9477c8886aeac4ae0f44b846f1e4bef6":
        raise ValueError("V9 Stage 4 active Smoke source config identity changed")
    source = read_json(source_path)
    source_result = validate_v9_stage4_object_semantic_decoded_alignment_cpu_contract(
        source, package, project_root,
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    attestation = read_json(attestation_path)
    request_id = "owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809"
    scope = "extend_v9_stage4_smoke_support_cpu_regress_preflight_then_one_sample194_30_epoch_gpu_smoke_only"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != request_id
        or authorization.get("ownerDecision", {}).get("scope") != scope
        or consumption.get("status") != "v9_stage4_smoke_gpu_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
        or attestation.get("status") != "v9_stage4_smoke_implementation_cpu_verified"
        or attestation.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
    ):
        raise ValueError("V9 Stage 4 active Smoke authorization, consumption or attestation is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "projectAutoencoderCheckpointReadAndLoad", "v9FixedRandomInitialization",
        "optimizerCreation", "backwardMethodExecution", "boundedModelWeightModification",
        "singleSampleThirtyEpochTraining", "fivePreviewWrite",
        "exact17DiagnosticManifestWrite", "machineReview", "smokeCheckpointWrite",
        "modelStateHashEvidenceWrite", "terminalEvidenceWrite",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"V9 Stage 4 active Smoke authorized action is closed: {key}")
    for key in (
        "oldV7OrV8DenoiserCheckpointReadOrLoad", "hyperparameterSelection",
        "machineReviewThresholdModification", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"V9 Stage 4 active Smoke forbidden action is open: {key}")

    smoke = training.get("v9Stage4SingleSampleSmokeContract", {})
    contract = training.get("stage4ObjectSemanticDecoderAlignment", {})
    expected_gate = {
        "configurationActiveNow": True,
        "checkpointReadNow": True,
        "optimizerCreationNow": True,
        "backwardExecutionNow": True,
        "modelParameterUpdateNow": True,
        "gpuUseNow": True,
        "trainingNow": True,
        "validationNow": False,
        "checkpointWriteNow": True,
        "stage4FullTrainingNow": False,
        "stage1OrStage2Now": False,
        "strictRevalidationNow": False,
        "formalInferenceNow": False,
        "checkpointPromotionNow": False,
        "runtimeFrameNow": False,
        "worldEntryNow": False,
    }
    if (
        config.get("architectureVersion")
        != "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
        or smoke.get("status") != "active_owner_authorized_single_execution"
        or contract.get("enabled") is not True
        or contract.get("status") != "training_loss_active_owner_authorized"
        or contract.get("trainingLossImplementationStatus") != "implemented_active_owner_authorized"
        or contract.get("activationGate") != expected_gate
    ):
        raise ValueError("V9 Stage 4 active Smoke configuration gate is invalid")
    owner = training.get("ownerTrainingAuthorization", {})
    expected_owner_flags = {
        "checkpointLoadingAuthorized": True,
        "optimizerCreationAuthorized": True,
        "backwardExecutionAuthorized": True,
        "modelWeightMutationAuthorized": True,
        "gpuTrainingAuthorizedNow": True,
        "singleSampleGpuOverfitSmokeAuthorized": True,
        "fullTrainingAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    if (
        owner.get("authorizationId") != request_id
        or owner.get("authorizationPath") != execution.get("ownerAuthorizationPath")
        or owner.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or owner.get("executionConsumptionPath") != execution.get("gpuConsumptionPath")
        or owner.get("executionConsumptionSha256") != execution.get("gpuConsumptionSha256")
        or owner.get("status") != V9_STAGE4_SMOKE_ACTIVE_STATUS
        or any(owner.get(key) is not expected for key, expected in expected_owner_flags.items())
    ):
        raise ValueError("V9 Stage 4 active nested Owner authorization is invalid")

    sanitized = deepcopy(config)
    sanitized["architectureVersion"] = source["architectureVersion"]
    sanitized_training = sanitized["training"]
    source_training = source["training"]
    sanitized_training["trainingAuthorizationStatus"] = source_training["trainingAuthorizationStatus"]
    sanitized_training["v9Stage4SingleSampleSmokeContract"] = deepcopy(source_training["v9Stage4SingleSampleSmokeContract"])
    sanitized_training["ownerTrainingAuthorization"] = deepcopy(source_training["ownerTrainingAuthorization"])
    sanitized_training["stage4ObjectSemanticDecoderAlignment"] = deepcopy(source_training["stage4ObjectSemanticDecoderAlignment"])
    sanitized_training.pop("v9Stage4SmokeExecution", None)
    if sanitized != source:
        raise ValueError("V9 Stage 4 active Smoke changed fields outside the bounded activation contract")
    return {
        **source_result,
        "status": "v9_stage4_object_semantic_decoder_alignment_smoke_contract_valid_active",
        "authorizationId": request_id,
        "sampleId": smoke.get("sampleId"),
    }


def validate_v7_r5_stage4_failure_diagnostic_support_contract(config):
    training = config.get("training", {})
    contract = training.get("stage4FailureDiagnostics", {})
    active_bounded_smoke = training.get("trainingAuthorizationStatus") == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS
    if contract.get("enabled") is not True:
        raise ValueError("V7 R5 Stage 4 failure diagnostics must be enabled")
    expected_status = (
        "diagnostic_support_active_bounded_smoke"
        if active_bounded_smoke
        else "diagnostic_support_candidate_not_active"
    )
    if contract.get("status") != expected_status:
        raise ValueError("V7 R5 Stage 4 failure diagnostics status is invalid")
    object_contract = contract.get("objectSemanticDiagnostics", {})
    if tuple(object_contract.get("channels", [])) != V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS:
        raise ValueError("V7 R5 Stage 4 object diagnostic channels are invalid")
    if tuple(object_contract.get("measurements", [])) != V7_R5_STAGE4_OBJECT_DIAGNOSTIC_MEASUREMENTS:
        raise ValueError("V7 R5 Stage 4 object diagnostic measurements are invalid")
    if object_contract.get("gradientTarget") != "predicted_rgb_only":
        raise ValueError("V7 R5 Stage 4 object gradient diagnostic target is invalid")
    if object_contract.get("changesTrainingWeightsNow") is not False:
        raise ValueError("V7 R5 Stage 4 diagnostics cannot change object training weights")
    route_contract = contract.get("routeLateRegressionDiagnostics", {})
    if tuple(route_contract.get("measurements", [])) != V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS:
        raise ValueError("V7 R5 Stage 4 route diagnostic measurements are invalid")
    if route_contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 Stage 4 route diagnostics require terrain_path_ground")
    if route_contract.get("requiredBoundarySidesSource") != "authorizedBoundaryTopology.requiredBoundarySides":
        raise ValueError("V7 R5 Stage 4 route boundary source is invalid")
    if route_contract.get("preserveExistingPathLossWeights") is not True:
        raise ValueError("V7 R5 Stage 4 route diagnostics cannot change path loss weights")
    for key in (
        "reviewThresholdsModified",
        "failedPreviewPixelsUsedAsTrainingTargets",
        "executionValuesSelected",
        "trainingConfigApplied",
    ):
        if contract.get(key) is not False:
            raise ValueError(f"V7 R5 Stage 4 diagnostics boundary is invalid: {key}")
    for key in ("checkpointFileReadAuthorized", "gpuUseAuthorized", "trainingAuthorized"):
        if contract.get(key) is not active_bounded_smoke:
            raise ValueError(f"V7 R5 Stage 4 diagnostics execution boundary is invalid: {key}")
    required_object_weights = {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": 1.25,
        "object_vegetation": 1.0,
    }
    actual_object_weights = {
        key: float(value)
        for key, value in training.get("objectSemanticChannelWeights", {}).items()
    }
    if actual_object_weights != required_object_weights:
        raise ValueError("V7 R5 Stage 4 diagnostic support cannot change object weights")
    loss_weights = training.get("denoiserLossWeights", {})
    if float(loss_weights.get("pathInteriorRgb", float("nan"))) != 2.0 or float(loss_weights.get("pathForbiddenBoundaryRgb", float("nan"))) != 2.0:
        raise ValueError("V7 R5 Stage 4 diagnostic support cannot change path weights")
    return {
        "status": (
            "r5_stage4_failure_diagnostic_support_contract_valid_for_bounded_smoke"
            if active_bounded_smoke
            else "r5_stage4_failure_diagnostic_support_contract_valid_not_active"
        ),
        "objectChannels": list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS),
        "objectMeasurements": list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_MEASUREMENTS),
        "routeMeasurements": list(V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS),
        "executionValuesSelected": False,
        "trainingConfigApplied": False,
    }


def summarize_v7_r5_tail_stability(review_rows, config):
    gate = config.get("training", {}).get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    rows_by_epoch = {int(row.get("epoch", 0)): row for row in review_rows}
    evaluated = []
    for epoch in tail_epochs:
        row = rows_by_epoch.get(epoch)
        issue_codes = list(row.get("issueCodes", [])) if isinstance(row, dict) else []
        evaluated.append({
            "epoch": epoch,
            "recorded": row is not None,
            "passed": bool(row and row.get("passed") is True and not issue_codes),
            "pathIssueFree": not any("terrain_path_ground" in code for code in issue_codes),
            "objectIssueFree": not any(code.startswith("condition_object_") for code in issue_codes),
            "issueCodes": issue_codes,
        })
    passed = (
        len(evaluated) == 3
        and all(row["recorded"] and row["passed"] for row in evaluated)
        and all(row["pathIssueFree"] and row["objectIssueFree"] for row in evaluated)
    )
    return {
        "status": "r5_tail_stability_gate_passed" if passed else "r5_tail_stability_gate_failed_closed",
        "passed": passed,
        "requiredConsecutiveTailPasses": 3,
        "evaluated": evaluated,
    }


def validate_v7_training_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate":
        validate_v7_r5_candidate_contract(config)
        authorization_status = training.get("trainingAuthorizationStatus")
        if authorization_status in {
            V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS,
            V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS,
        }:
            validate_v7_repair_r5_stage4_full_training_authorization(config, package, project_root)
            return
        if authorization_status in {
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS,
            V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS,
        }:
            validate_v7_repair_r5_stage4_bounded_smoke_authorization(config, package, project_root)
            return
        if authorization_status == V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS:
            validate_v7_repair_r5_coverage_convergence_smoke_authorization(config, package, project_root)
            return
        if authorization_status != V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R5 candidate is isolated and is not authorized for training")
        validate_v7_repair_r5_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
        validate_v7_r4_candidate_contract(config)
        if training.get("trainingAuthorizationStatus") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R4 candidate is isolated and is not authorized for training")
        validate_v7_repair_r4_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
        if training.get("trainingAuthorizationStatus") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R3 candidate is isolated and is not authorized for training")
        validate_v7_repair_r3_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r2":
        validate_v7_repair_r2_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r1":
        if training.get("trainingAuthorizationStatus") == V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS:
            validate_v7_repair_r1_full_training_authorization(config, package, project_root)
        else:
            validate_v7_repair_r1_authorization(config, package, project_root)
        return
    if training.get("trainingAuthorizationStatus") != V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 GPU training authorization status is not active")

    authorization = training.get("ownerTrainingAuthorization")
    if not isinstance(authorization, dict):
        raise ValueError("V7 owner training authorization is missing")
    if authorization.get("authorizationId") != V7_TRAINING_AUTHORIZATION_ID:
        raise ValueError("V7 owner training authorization identity is invalid")
    if authorization.get("status") != V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 nested owner training authorization status is not active")
    if authorization.get("gpuTrainingAuthorizedNow") is not True:
        raise ValueError("V7 GPU training is not authorized now")

    authorization_sha256 = authorization.get("authorizationSha256")
    if not isinstance(authorization_sha256, str) or len(authorization_sha256) != 64:
        raise ValueError("V7 owner training authorization SHA-256 is invalid")
    try:
        int(authorization_sha256, 16)
    except ValueError as error:
        raise ValueError("V7 owner training authorization SHA-256 is invalid") from error

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path_value = authorization.get("authorizationPath")
    if authorization_path_value != V7_TRAINING_AUTHORIZATION_PATH:
        raise ValueError("V7 owner training authorization path identity is invalid")
    # Keep the logical project path here. On Windows, .runtime is intentionally a
    # junction into the project-owned data root, so Path.resolve() would make the
    # valid immutable record appear to escape the workspace.
    authorization_path = root / Path(authorization_path_value)
    if not authorization_path.is_file():
        raise ValueError("V7 owner training authorization file is missing")
    if sha256_file(authorization_path) != authorization_sha256:
        raise ValueError("V7 owner training authorization SHA-256 does not match")

    authorization_record = read_json(authorization_path)
    if authorization_record.get("schemaVersion") != "ai-painter-owner-action-request-v1":
        raise ValueError("V7 owner training authorization record schema is invalid")
    if authorization_record.get("requestId") != V7_TRAINING_AUTHORIZATION_REQUEST_ID:
        raise ValueError("V7 owner training authorization request identity is invalid")
    if authorization_record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 owner training authorization record is not resolved and authorized")
    if authorization_record.get("ownerDecision", {}).get("commandRef") != V7_TRAINING_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 owner training authorization command is invalid")
    if authorization_record.get("ownerDecision", {}).get("scope") != "v7_smoke_and_stage_0_1_2_only":
        raise ValueError("V7 owner training authorization scope is invalid")

    resolution = authorization_record.get("resolution", {})
    if resolution.get("gpuTrainingActivated") is not True:
        raise ValueError("V7 owner training authorization did not activate GPU training")
    if resolution.get("formalInferenceAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens formal inference")
    if resolution.get("runtimeFrameAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens RuntimeFrame")
    if resolution.get("worldEntryAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens world entry")

    task_identity = authorization_record.get("taskIdentity", {})
    if task_identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 owner training authorization model identity does not match")
    if task_identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 owner training authorization dataset identity does not match")
    if task_identity.get("qualifiedCompleteMapCount") != 64:
        raise ValueError("V7 owner training authorization capacity is not 64")
    if task_identity.get("splitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 owner training authorization split is not 48/8/4/4")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 dataset package does not contain 64 capacity contributions")
    validate_v7_dataset_repair_authorization(root, config, package)


def validate_v7_repair_r3_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID:
        raise ValueError("V7 repair R3 Smoke authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R3 Smoke authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 Smoke authorization pinned hash is invalid")
    if authorization.get("authorizationConsumptionPath") != V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH:
        raise ValueError("V7 repair R3 Smoke consumption path is invalid")
    if authorization.get("authorizationConsumptionSha256") != V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R3 Smoke consumption pinned hash is invalid")
    if authorization.get("status") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R3 Smoke nested authorization status is invalid")
    if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R3 single-sample GPU Smoke is not authorized")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if authorization.get(key) is not False:
            raise ValueError(f"V7 repair R3 improperly authorizes {key}")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R3 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R3 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R3 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R3 owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("singleSampleGpuOverfitSmokeAuthorized") is not True and resolution.get("singleSampleGpuOverfitSmokeRetryAuthorized") is not True:
        raise ValueError("V7 repair R3 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R3 authorization improperly opens {key}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R3 authorization consumption identity mismatch")
    identity = record.get("taskIdentity", {})
    authorized_dataset_package_id = identity.get("datasetPackageId")
    if authorized_dataset_package_id is None:
        failed_report_path_value = identity.get("failedRunReportPath")
        failed_report_sha256 = identity.get("failedRunReportSha256")
        failed_report_path = root / Path(failed_report_path_value or "")
        if not failed_report_path.is_file() or sha256_file(failed_report_path) != failed_report_sha256:
            raise ValueError("V7 repair R3 retry evidence chain is missing or changed")
        failed_report = read_json(failed_report_path)
        prior_authorization_path = root / Path(failed_report.get("authorizationPath", ""))
        if not prior_authorization_path.is_file() or sha256_file(prior_authorization_path) != failed_report.get("authorizationSha256"):
            raise ValueError("V7 repair R3 prior authorization evidence is missing or changed")
        authorized_dataset_package_id = read_json(prior_authorization_path).get("taskIdentity", {}).get("datasetPackageId")
    if identity.get("modelId") != config.get("modelId") or authorized_dataset_package_id != package.get("packageId"):
        raise ValueError("V7 repair R3 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R3 authorized sample identity mismatch")
    if identity.get("parentCheckpointPath") is not None or identity.get("parentCheckpointSha256") is not None:
        raise ValueError("V7 repair R3 random-initialization authorization cannot bind a parent checkpoint")
    if identity.get("initialization") != "project_random_multiscale_denoiser" or int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R3 random initialization identity mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R3 dataset capacity is not 64")


def validate_v7_repair_r5_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    continuation = training.get("r5Stage3CheckpointContinuation") or training.get("r5CheckpointContinuation", {})
    expected_identity = {
        "authorizationId": V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH,
        "authorizationConsumptionSha256": V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256,
        "status": V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS,
    }
    for name, expected in expected_identity.items():
        if authorization.get(name) != expected:
            raise ValueError(f"V7 repair R5 Smoke {name} identity is invalid")
    for name in ("checkpointLoadingAuthorized", "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized"):
        if authorization.get(name) is not True:
            raise ValueError(f"V7 repair R5 Smoke is missing {name}")
    for name in (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(name) is not False:
            raise ValueError(f"V7 repair R5 Smoke improperly authorizes {name}")

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R5 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R5 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R5 authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF or decision.get("scope") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R5 owner authorization identity mismatch")
    resolution = record.get("resolution", {})
    for name in (
        "conditionEvidenceSerializationFixAuthorized",
        "knownPredictedRgbTensorExclusionAuthorized",
        "unknownNonScalarTensorFailureClosureRequired",
        "cpuPositiveRegressionAuthorized",
        "cpuNegativeRegressionAuthorized",
        "trainerAuthorizationGateRebindingAuthorized",
        "runnerAuthorizationGateRebindingAuthorized",
        "sameCheckpointReadAndLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "oneGpuSmokeRetryAuthorized",
        "fixedEpochPreviewGenerationAuthorized",
        "machinePreviewReviewAuthorized",
        "checkpointAndTokenEvidenceStorageAuthorized",
        "automaticTerminalStorageAuthorized",
    ):
        if resolution.get(name) is not True:
            raise ValueError(f"V7 repair R5 authorization is missing {name}")
    for name in (
        "automaticAdditionalRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(name) is not False:
            raise ValueError(f"V7 repair R5 authorization improperly opens {name}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R5 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R5 authorization consumption identity mismatch")

    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId") or identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R5 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R5 authorized sample identity mismatch")
    if int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R5 seed identity mismatch")
    if int(identity.get("epochCount", 0)) != int(training.get("denoiserEpochs", -1)):
        raise ValueError("V7 repair R5 epoch count identity mismatch")
    if identity.get("requiredTailEpochs") != training.get("smokeStabilityGate", {}).get("tailEpochs"):
        raise ValueError("V7 repair R5 tail gate identity mismatch")
    if identity.get("parentCheckpointPath") != continuation.get("sourceCheckpointPath") or identity.get("parentCheckpointSha256") != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 repair R5 parent checkpoint binding mismatch")
    source_checkpoint = root / Path(continuation.get("sourceCheckpointPath", ""))
    if not source_checkpoint.is_file() or sha256_file(source_checkpoint) != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 repair R5 bound parent checkpoint is missing or changed")
    if continuation.get("loadingAuthorizedNow") is not True:
        raise ValueError("V7 repair R5 checkpoint loading is not active")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R5 dataset capacity is not 64")


def validate_v7_repair_r5_coverage_convergence_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    continuation = training.get("r5Stage3CheckpointContinuation", {})
    expected_identity = {
        "authorizationId": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH,
        "authorizationConsumptionSha256": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256,
        "status": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
    }
    for name, expected in expected_identity.items():
        if authorization.get(name) != expected:
            raise ValueError(f"V7 R5 coverage-convergence Smoke {name} identity is invalid")
    for name in (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    ):
        if authorization.get(name) is not True:
            raise ValueError(f"V7 R5 coverage-convergence Smoke is missing {name}")
    for name in (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(name) is not False:
            raise ValueError(f"V7 R5 coverage-convergence Smoke improperly authorizes {name}")
    if authorization.get("checkpointHashValidatedByRunnerAfterPythonPreflight") is not True:
        raise ValueError("V7 R5 coverage-convergence Smoke requires post-preflight runner checkpoint validation")

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 coverage-convergence immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 R5 coverage-convergence atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 R5 coverage-convergence authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_COMMAND_REF or decision.get("scope") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 R5 coverage-convergence owner authorization identity mismatch")
    resolution = record.get("resolution", {})
    for name in (
        "trainerAuthorizationGateRebindingAuthorized",
        "runnerAuthorizationGateRebindingAuthorized",
        "legacyStage3CompatibilityRequired",
        "cpuPositiveAuthorizationRegressionAuthorized",
        "cpuNegativeAuthorizationRegressionAuthorized",
        "pythonPreflightAuthorized",
        "checkpointFileReadAuthorizedAfterPreflight",
        "checkpointLoadingAuthorizedAfterPreflight",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "oneGpuSmokeAuthorized",
        "fixedEpochPreviewGenerationAuthorized",
        "machinePreviewReviewAuthorized",
        "checkpointAndTokenEvidenceStorageAuthorized",
        "automaticTerminalStorageAuthorized",
    ):
        if resolution.get(name) is not True:
            raise ValueError(f"V7 R5 coverage-convergence authorization is missing {name}")
    for name in (
        "automaticAdditionalRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(name) is not False:
            raise ValueError(f"V7 R5 coverage-convergence authorization improperly opens {name}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 coverage-convergence authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 R5 coverage-convergence authorization consumption identity mismatch")
    if int(consumption.get("allowedExecutionCount", 0)) != 1:
        raise ValueError("V7 R5 coverage-convergence authorization execution count is invalid")

    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId") or identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 R5 coverage-convergence model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 R5 coverage-convergence sample identity mismatch")
    if identity.get("conditionLabel") != training.get("authorizedOverfitConditionLabel"):
        raise ValueError("V7 R5 coverage-convergence condition identity mismatch")
    if int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 R5 coverage-convergence seed identity mismatch")
    if int(identity.get("epochCount", 0)) != int(training.get("denoiserEpochs", -1)):
        raise ValueError("V7 R5 coverage-convergence epoch count identity mismatch")
    if int(identity.get("evaluationInterval", 0)) != int(training.get("smokeStabilityGate", {}).get("evaluationInterval", -1)):
        raise ValueError("V7 R5 coverage-convergence evaluation interval identity mismatch")
    if identity.get("requiredPreviewEpochs") != training.get("fixedEpochPreviewPolicy", {}).get("smoke"):
        raise ValueError("V7 R5 coverage-convergence preview identity mismatch")
    if identity.get("requiredTailEpochs") != training.get("smokeStabilityGate", {}).get("tailEpochs"):
        raise ValueError("V7 R5 coverage-convergence tail identity mismatch")
    selected = identity.get("selectedValues", {})
    if float(selected.get("pathActivationMassCalibrationWeight", -1)) != float(training.get("pathActivationMassCalibration", {}).get("weight", -2)):
        raise ValueError("V7 R5 coverage-convergence activation-mass weight identity mismatch")
    if float(selected.get("shortTrajectoryCoverageDriftWeight", -1)) != float(training.get("shortTrajectoryCoverageDrift", {}).get("weight", -2)):
        raise ValueError("V7 R5 coverage-convergence drift weight identity mismatch")
    if identity.get("parentCheckpointPath") != continuation.get("sourceCheckpointPath") or identity.get("parentCheckpointSha256") != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 coverage-convergence parent checkpoint binding mismatch")
    if continuation.get("loadingAuthorizedNow") is not True:
        raise ValueError("V7 R5 coverage-convergence checkpoint loading is not active")

    source_config_path = root / Path(authorization.get("sourceConfigPath", ""))
    selection_contract_path = root / Path(authorization.get("selectionContractPath", ""))
    if authorization.get("sourceConfigPath") != identity.get("sourceConfigPath") or authorization.get("sourceConfigSha256") != identity.get("sourceConfigSha256"):
        raise ValueError("V7 R5 coverage-convergence source config identity mismatch")
    if not source_config_path.is_file() or sha256_file(source_config_path) != identity.get("sourceConfigSha256"):
        raise ValueError("V7 R5 coverage-convergence source config is missing or changed")
    if authorization.get("selectionContractPath") != identity.get("selectionContractPath") or authorization.get("selectionContractSha256") != identity.get("selectionContractSha256"):
        raise ValueError("V7 R5 coverage-convergence selection contract identity mismatch")
    if not selection_contract_path.is_file() or sha256_file(selection_contract_path) != identity.get("selectionContractSha256"):
        raise ValueError("V7 R5 coverage-convergence selection contract is missing or changed")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 R5 coverage-convergence dataset capacity is not 64")


def validate_v7_repair_r5_stage4_bounded_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    nested = training.get("ownerTrainingAuthorization", {})
    if nested.get("authorizationBindingMode") == V7_REPAIR_R5_STAGE4_CONFIG_BOUND_AUTHORIZATION_MODE:
        validate_config_bound_v7_r5_stage4_bounded_smoke_authorization(
            config,
            package,
            project_root,
        )
        return
    status = training.get("trainingAuthorizationStatus")
    preflight_only = status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS
    active_smoke = status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS
    if not preflight_only and not active_smoke:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke authorization status is invalid")
    root = Path(project_root) if project_root is not None else Path.cwd()
    authorization_path = root / V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_PATH
    implementation_path = root / V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_PATH
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke authorization is missing or changed")
    if not implementation_path.is_file() or sha256_file(implementation_path) != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_SHA256:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke implementation consumption is missing or changed")
    record = read_json(authorization_path)
    implementation = read_json(implementation_path)
    if record.get("requestId") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke Owner authorization is invalid")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_COMMAND_REF or decision.get("scope") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_SCOPE:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke command identity is invalid")
    if (
        implementation.get("status") != "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes"
        or implementation.get("authorizationSha256") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_SHA256
        or implementation.get("commandRef") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_COMMAND_REF
        or implementation.get("scope") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_SCOPE
        or int(implementation.get("allowedImplementationExecutionCount", 0)) != 1
        or int(implementation.get("cpuRegressionExecutionCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
    ):
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke implementation consumption identity is invalid")
    identity = record.get("taskIdentity", {})
    smoke = training.get("r5Stage4BoundedRepairSmokeContract", {})
    continuation = training.get("r5Stage4BoundedRepairCheckpointContinuation", {})
    expected = {
        "modelId": config.get("modelId"),
        "fixedStageNumber": 4,
        "fixedResolutionStageIndex": 0,
        "resolution": training.get("resolutionStages", [None])[0],
        "epochCount": smoke.get("epochCount"),
        "evaluationInterval": smoke.get("evaluationInterval"),
        "requiredPreviewEpochs": smoke.get("requiredPreviewEpochs"),
        "seed": training.get("seed"),
        "sampleId": training.get("authorizedOverfitSampleId"),
        "conditionLabel": training.get("authorizedOverfitConditionLabel"),
        "sampleSplit": training.get("authorizedOverfitSampleSplit"),
        "inactiveConfigPath": nested.get("sourceConfigPath"),
        "inactiveConfigSha256": nested.get("sourceConfigSha256"),
        "selectionContractPath": nested.get("selectionContractPath"),
        "selectionContractSha256": nested.get("selectionContractSha256"),
        "trainerSupportContractPath": nested.get("trainerSupportContractPath"),
        "trainerSupportContractSha256": nested.get("trainerSupportContractSha256"),
        "boundedRepairCpuReportPath": nested.get("boundedRepairCpuReportPath"),
        "boundedRepairCpuReportSha256": nested.get("boundedRepairCpuReportSha256"),
        "boundedRepairTerminalPath": nested.get("boundedRepairTerminalPath"),
        "boundedRepairTerminalSha256": nested.get("boundedRepairTerminalSha256"),
        "stage0ManifestPath": continuation.get("sourceManifestPath"),
        "stage0ManifestSha256": continuation.get("sourceManifestSha256"),
        "stage0CheckpointPath": continuation.get("sourceCheckpointPath"),
        "stage0CheckpointSha256": continuation.get("sourceCheckpointSha256"),
        "autoencoderCheckpointPath": nested.get("autoencoderCheckpointPath"),
        "autoencoderCheckpointSha256": nested.get("autoencoderCheckpointSha256"),
        "runnerPath": nested.get("runnerPath"),
        "runnerSha256": nested.get("runnerSha256"),
        "telemetryLibraryPath": nested.get("telemetryLibraryPath"),
        "telemetryLibrarySha256": nested.get("telemetryLibrarySha256"),
        "outputDirectoryPath": nested.get("outputDirectoryPath"),
        "datasetManifestPath": nested.get("datasetManifestPath"),
        "datasetManifestSha256": nested.get("datasetManifestSha256"),
        "sourceIndexPath": nested.get("sourceIndexPath"),
        "sourceIndexSha256": nested.get("sourceIndexSha256"),
        "requiredDiagnosticMetricCount": 17,
        "requiredSmokeStage1Authorized": smoke.get("stage1Authorized"),
        "requiredSmokeStage2Authorized": smoke.get("stage2Authorized"),
        "requiredStage1OrStage2InitializationAuthorized": continuation.get("stage1OrStage2InitializationAuthorized"),
    }
    for key, value in expected.items():
        if identity.get(key) != value:
            raise ValueError(f"V7 R5 Stage 4 bounded-repair Smoke identity is invalid: {key}")
    if package.get("packageId") != "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z":
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke dataset identity is invalid")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke requires the fixed 64-sample capacity")
    if smoke.get("status") != ("preflight_only" if preflight_only else "active_single_execution"):
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke contract status is invalid")
    if smoke.get("nonFormalValidationSampleOverfit") is not True or smoke.get("checkpointPromotionEligible") is not False:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke formal boundary is invalid")
    if smoke.get("stage1Authorized") is not False or smoke.get("stage2Authorized") is not False:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke Stage 1/2 authorization boundary is invalid")
    if continuation.get("stage1OrStage2InitializationAuthorized") is not False:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke Stage 1/2 initialization boundary is invalid")
    if training.get("fixedEpochPreviewPolicy", {}).get("smoke") != [1, 5, 10, 20, 30]:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke preview policy is invalid")
    diagnostics = training.get("stage4FailureDiagnostics", {})
    if diagnostics.get("enabled") is not True or diagnostics.get("trainingAuthorized") is not active_smoke:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke diagnostics activation is invalid")
    validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    if continuation.get("loadingAuthorizedNow") is not active_smoke:
        raise ValueError("V7 R5 Stage 4 bounded-repair Smoke checkpoint loading boundary is invalid")
    expected_nested = {
        "authorizationId": V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_SHA256,
        "implementationConsumptionPath": V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_PATH,
        "implementationConsumptionSha256": V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_IMPLEMENTATION_CONSUMPTION_SHA256,
        "status": status,
    }
    for key, value in expected_nested.items():
        if nested.get(key) != value:
            raise ValueError(f"V7 R5 Stage 4 bounded-repair Smoke nested authorization is invalid: {key}")
    active_flags = (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    forbidden_flags = (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if preflight_only:
        if any(nested.get(key) is not False for key in (*active_flags, *forbidden_flags)):
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke preflight opens an execution boundary")
        if nested.get("executionConsumptionPath") is not None or nested.get("executionConsumptionSha256") is not None:
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke preflight cannot bind execution consumption")
    else:
        if any(nested.get(key) is not True for key in active_flags):
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke is missing an active execution flag")
        if any(nested.get(key) is not False for key in forbidden_flags):
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke opens a forbidden downstream boundary")
        execution_path_value = nested.get("executionConsumptionPath")
        execution_sha = nested.get("executionConsumptionSha256")
        if execution_path_value != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_EXECUTION_CONSUMPTION_PATH:
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke execution consumption path is invalid")
        execution_path = root / execution_path_value
        if not execution_path.is_file() or sha256_file(execution_path) != execution_sha:
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke execution consumption is missing or changed")
        execution = read_json(execution_path)
        if (
            execution.get("status") != "consumed_after_all_preflights_before_checkpoint_read_and_gpu_smoke"
            or execution.get("authorizationSha256") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_AUTHORIZATION_SHA256
            or execution.get("commandRef") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_COMMAND_REF
            or execution.get("scope") != V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_SCOPE
            or int(execution.get("allowedExecutionCount", 0)) != 1
            or execution.get("automaticRetryAuthorized") is not False
        ):
            raise ValueError("V7 R5 Stage 4 bounded-repair Smoke execution consumption identity is invalid")


def validate_config_bound_v7_r5_stage4_bounded_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    nested = training.get("ownerTrainingAuthorization", {})
    status = training.get("trainingAuthorizationStatus")
    preflight_only = status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS
    active_smoke = status == V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS
    if not preflight_only and not active_smoke:
        raise ValueError("V7 R5 Stage 4 config-bound Smoke authorization status is invalid")

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = resolve_config_bound_owner_evidence_path(
        root,
        nested.get("authorizationPath"),
        "authorization",
    )
    implementation_path = resolve_config_bound_owner_evidence_path(
        root,
        nested.get("implementationConsumptionPath"),
        "implementation consumption",
    )
    authorization_sha = nested.get("authorizationSha256")
    implementation_sha = nested.get("implementationConsumptionSha256")
    if sha256_file(authorization_path) != authorization_sha:
        raise ValueError("V7 R5 Stage 4 config-bound Owner authorization changed")
    if sha256_file(implementation_path) != implementation_sha:
        raise ValueError("V7 R5 Stage 4 config-bound implementation consumption changed")

    record = read_json(authorization_path)
    implementation = read_json(implementation_path)
    request_id = nested.get("authorizationId")
    command_ref = nested.get("authorizationCommandRef")
    scope = nested.get("authorizationScope")
    if (
        record.get("status") != "resolved_owner_authorized"
        or record.get("requestId") != request_id
        or authorization_path.parent.name != request_id
        or record.get("ownerDecision", {}).get("commandRef") != command_ref
        or record.get("ownerDecision", {}).get("scope") != scope
    ):
        raise ValueError("V7 R5 Stage 4 config-bound Owner authorization identity is invalid")
    if (
        implementation.get("status")
        != "consumed_before_config_bound_stage4_smoke_preflight_and_evidence_writes"
        or implementation.get("requestId") != request_id
        or implementation.get("authorizationSha256") != authorization_sha
        or implementation.get("commandRef") != command_ref
        or implementation.get("scope") != scope
        or int(implementation.get("allowedImplementationCount", 0)) != 1
        or int(implementation.get("allowedConfigCompilationCount", 0)) != 1
        or int(implementation.get("allowedCpuRegressionCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
    ):
        raise ValueError("V7 R5 Stage 4 config-bound implementation consumption identity is invalid")

    resolution = record.get("resolution", {})
    if (
        resolution.get("configBoundStage4SmokeAuthorization") is not True
        or resolution.get("stage4BoundedSmokePreflightAuthorized") is not True
    ):
        raise ValueError("V7 R5 Stage 4 config-bound preflight authorization is missing")
    forbidden_resolution_flags = (
        "reviewThresholdChangeAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    )
    if any(resolution.get(key) is not False for key in forbidden_resolution_flags):
        raise ValueError("V7 R5 Stage 4 config-bound authorization opens a forbidden downstream action")
    execution_resolution_flags = (
        "checkpointFileReadAuthorized",
        "checkpointDeserializationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "backwardExecutionAuthorized",
        "modelWeightMutationAuthorized",
        "gpuUseAuthorized",
        "trainingAuthorized",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    expected_execution_value = active_smoke
    if any(resolution.get(key) is not expected_execution_value for key in execution_resolution_flags):
        raise ValueError("V7 R5 Stage 4 config-bound execution authorization boundary is invalid")

    identity = record.get("taskIdentity", {})
    smoke = training.get("r5Stage4BoundedRepairSmokeContract", {})
    continuation = training.get("r5Stage4BoundedRepairCheckpointContinuation", {})
    expected_identity = {
        "modelId": config.get("modelId"),
        "fixedStageNumber": 4,
        "sampleId": training.get("authorizedOverfitSampleId"),
        "conditionLabel": training.get("authorizedOverfitConditionLabel"),
        "sampleSplit": training.get("authorizedOverfitSampleSplit"),
        "seed": training.get("seed"),
        "requiredBoundarySides": training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides"),
        "resolutionStages": training.get("resolutionStages"),
        "epochCount": smoke.get("epochCount"),
        "evaluationInterval": smoke.get("evaluationInterval"),
        "requiredPreviewEpochs": smoke.get("requiredPreviewEpochs"),
        "requiredDiagnosticMetricCount": smoke.get("requiredDiagnosticMetricCount"),
        "sourceInactiveConfigPath": nested.get("sourceConfigPath"),
        "sourceInactiveConfigSha256": nested.get("sourceConfigSha256"),
        "selectionContractPath": nested.get("selectionContractPath"),
        "selectionContractSha256": nested.get("selectionContractSha256"),
        "boundaryAnalysisPath": nested.get("boundaryAnalysisPath"),
        "boundaryAnalysisSha256": nested.get("boundaryAnalysisSha256"),
        "topologyTelemetrySupportContractPath": nested.get("topologyTelemetrySupportContractPath"),
        "topologyTelemetrySupportContractSha256": nested.get("topologyTelemetrySupportContractSha256"),
        "datasetManifestPath": nested.get("datasetManifestPath"),
        "datasetManifestSha256": nested.get("datasetManifestSha256"),
        "sourceIndexPath": nested.get("sourceIndexPath"),
        "sourceIndexSha256": nested.get("sourceIndexSha256"),
        "projectRuntimeLogicalEntry": nested.get("projectRuntimeLogicalEntry"),
        "registeredHotRuntimeRoot": nested.get("registeredHotRuntimeRoot"),
        "storageAuthorityPath": nested.get("storageAuthorityPath"),
        "storageAuthoritySha256": nested.get("storageAuthoritySha256"),
        "architectureAuthorityPath": nested.get("architectureAuthorityPath"),
        "architectureAuthoritySha256": nested.get("architectureAuthoritySha256"),
        "previousCpuFailureTerminalPath": nested.get("previousCpuFailureTerminalPath"),
        "previousCpuFailureTerminalSha256": nested.get("previousCpuFailureTerminalSha256"),
        "stage0ManifestPath": continuation.get("sourceManifestPath"),
        "stage0ManifestSha256": continuation.get("sourceManifestSha256"),
        "stage0CheckpointPath": continuation.get("sourceCheckpointPath"),
        "stage0CheckpointSha256": continuation.get("sourceCheckpointSha256"),
        "autoencoderCheckpointPath": nested.get("autoencoderCheckpointPath"),
        "autoencoderCheckpointSha256": nested.get("autoencoderCheckpointSha256"),
    }
    for key, value in expected_identity.items():
        if identity.get(key) != value:
            raise ValueError(f"V7 R5 Stage 4 config-bound identity is invalid: {key}")

    for path_key, sha_key, code in (
        ("sourceInactiveConfigPath", "sourceInactiveConfigSha256", "source inactive config"),
        ("selectionContractPath", "selectionContractSha256", "selection contract"),
        ("boundaryAnalysisPath", "boundaryAnalysisSha256", "boundary analysis"),
        (
            "topologyTelemetrySupportContractPath",
            "topologyTelemetrySupportContractSha256",
            "topology telemetry support contract",
        ),
        ("datasetManifestPath", "datasetManifestSha256", "dataset manifest"),
        ("sourceIndexPath", "sourceIndexSha256", "source index"),
        ("storageAuthorityPath", "storageAuthoritySha256", "storage authority"),
        ("architectureAuthorityPath", "architectureAuthoritySha256", "architecture authority"),
        (
            "previousCpuFailureTerminalPath",
            "previousCpuFailureTerminalSha256",
            "previous CPU failure terminal",
        ),
        ("stage0ManifestPath", "stage0ManifestSha256", "Stage 0 manifest"),
        ("runnerPath", "runnerSha256", "Smoke runner"),
        ("telemetryLibraryPath", "telemetryLibrarySha256", "step telemetry library"),
    ):
        verify_config_bound_project_file(root, identity.get(path_key), identity.get(sha_key), code)

    if nested.get("projectRuntimeLogicalEntry") != V7_REPAIR_R5_STAGE4_PROJECT_RUNTIME_LOGICAL_ENTRY:
        raise ValueError("V7 R5 Stage 4 config-bound logical runtime identity is invalid")
    if nested.get("registeredHotRuntimeRoot") != V7_REPAIR_R5_STAGE4_REGISTERED_HOT_RUNTIME_ROOT:
        raise ValueError("V7 R5 Stage 4 config-bound registered hot runtime identity is invalid")
    if resolution.get("registeredRuntimePathIdentityFixAuthorized") is not True:
        raise ValueError("V7 R5 Stage 4 config-bound registered runtime path support is not authorized")

    stage0_manifest = read_json(root / Path(identity["stage0ManifestPath"]))
    if (
        stage0_manifest.get("checkpointPath") != identity.get("stage0CheckpointPath")
        or stage0_manifest.get("checkpointSha256") != identity.get("stage0CheckpointSha256")
        or stage0_manifest.get("autoencoderCheckpointPath") != identity.get("autoencoderCheckpointPath")
        or stage0_manifest.get("autoencoderCheckpointSha256") != identity.get("autoencoderCheckpointSha256")
    ):
        raise ValueError("V7 R5 Stage 4 config-bound Checkpoint identity does not match the bound manifest")

    if package.get("packageId") != "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z":
        raise ValueError("V7 R5 Stage 4 config-bound dataset identity is invalid")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 R5 Stage 4 config-bound dataset capacity must remain 64")
    if smoke.get("status") != ("preflight_only" if preflight_only else "active_single_execution"):
        raise ValueError("V7 R5 Stage 4 config-bound Smoke contract status is invalid")
    if smoke.get("nonFormalValidationSampleOverfit") is not True or smoke.get("checkpointPromotionEligible") is not False:
        raise ValueError("V7 R5 Stage 4 config-bound Smoke formal boundary is invalid")
    if smoke.get("stage1Authorized") is not False or smoke.get("stage2Authorized") is not False:
        raise ValueError("V7 R5 Stage 4 config-bound Smoke Stage 1/2 boundary is invalid")
    if continuation.get("stage1OrStage2InitializationAuthorized") is not False:
        raise ValueError("V7 R5 Stage 4 config-bound Smoke Stage 1/2 initialization is invalid")
    if continuation.get("loadingAuthorizedNow") is not active_smoke:
        raise ValueError("V7 R5 Stage 4 config-bound Checkpoint loading boundary is invalid")
    if training.get("fixedEpochPreviewPolicy", {}).get("smoke") != [1, 5, 10, 20, 30]:
        raise ValueError("V7 R5 Stage 4 config-bound preview policy is invalid")

    diagnostics = training.get("stage4FailureDiagnostics", {})
    if diagnostics.get("enabled") is not True or diagnostics.get("trainingAuthorized") is not active_smoke:
        raise ValueError("V7 R5 Stage 4 config-bound diagnostics activation is invalid")
    validate_v7_r5_stage4_failure_diagnostic_support_contract(config)

    nested_active_flags = (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    nested_forbidden_flags = (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if any(nested.get(key) is not active_smoke for key in nested_active_flags):
        raise ValueError("V7 R5 Stage 4 config-bound nested execution flags are invalid")
    if any(nested.get(key) is not False for key in nested_forbidden_flags):
        raise ValueError("V7 R5 Stage 4 config-bound nested forbidden flags are open")
    if nested.get("status") != status:
        raise ValueError("V7 R5 Stage 4 config-bound nested status is invalid")

    if preflight_only:
        if nested.get("executionConsumptionPath") is not None or nested.get("executionConsumptionSha256") is not None:
            raise ValueError("V7 R5 Stage 4 config-bound preflight cannot bind GPU execution consumption")
        return

    execution_path = resolve_config_bound_owner_evidence_path(
        root,
        nested.get("executionConsumptionPath"),
        "GPU execution consumption",
    )
    if sha256_file(execution_path) != nested.get("executionConsumptionSha256"):
        raise ValueError("V7 R5 Stage 4 config-bound GPU execution consumption changed")
    execution = read_json(execution_path)
    if (
        execution.get("status") != "consumed_after_all_preflights_before_checkpoint_read_and_gpu_smoke"
        or execution.get("authorizationSha256") != authorization_sha
        or execution.get("commandRef") != command_ref
        or execution.get("scope") != scope
        or int(execution.get("allowedExecutionCount", 0)) != 1
        or execution.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("V7 R5 Stage 4 config-bound GPU execution consumption identity is invalid")


def resolve_config_bound_owner_evidence_path(root, path_value, code):
    if not isinstance(path_value, str) or not path_value:
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path is missing")
    relative = Path(path_value)
    owner_parts = tuple(
        part.casefold()
        for part in Path(".runtime/ai-painter/owner-action-requests").parts
    )
    relative_parts = tuple(part.casefold() for part in relative.parts)
    if relative_parts[: len(owner_parts)] != owner_parts:
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path is outside Owner evidence")
    resolved_path = resolve_config_bound_project_path(root, path_value, code)
    if not resolved_path.is_file():
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} file is missing")
    return resolved_path


def verify_config_bound_project_file(root, path_value, expected_sha256, code):
    if not isinstance(path_value, str) or not path_value or not isinstance(expected_sha256, str):
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} identity is missing")
    resolved_path = resolve_config_bound_project_path(root, path_value, code)
    if not resolved_path.is_file():
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} file is missing")
    if sha256_file(resolved_path) != expected_sha256:
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} changed")
    return resolved_path


def resolve_config_bound_project_path(root, path_value, code):
    if not isinstance(path_value, str) or not path_value:
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path is missing")
    project_root = Path(root).resolve()
    relative = Path(path_value)
    if relative.is_absolute():
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path must be project-relative")
    if not relative.parts or any(part == ".." for part in relative.parts):
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path traversal is forbidden")

    resolved_path = (project_root / relative).resolve()
    first_part = relative.parts[0].casefold()
    if first_part == V7_REPAIR_R5_STAGE4_PROJECT_RUNTIME_LOGICAL_ENTRY.casefold():
        logical_runtime_root = (
            project_root / V7_REPAIR_R5_STAGE4_PROJECT_RUNTIME_LOGICAL_ENTRY
        )
        registered_hot_runtime_root = Path(
            V7_REPAIR_R5_STAGE4_REGISTERED_HOT_RUNTIME_ROOT
        ).resolve()
        if not logical_runtime_root.is_dir():
            raise ValueError("V7 R5 Stage 4 config-bound logical runtime entry is missing")
        if logical_runtime_root.resolve() != registered_hot_runtime_root:
            raise ValueError(
                "V7 R5 Stage 4 config-bound logical runtime entry does not match the registered hot root"
            )
        if (
            resolved_path != registered_hot_runtime_root
            and registered_hot_runtime_root not in resolved_path.parents
        ):
            raise ValueError(
                f"V7 R5 Stage 4 config-bound {code} path escapes the registered hot runtime root"
            )
        return resolved_path

    if resolved_path != project_root and project_root not in resolved_path.parents:
        raise ValueError(f"V7 R5 Stage 4 config-bound {code} path is outside the project")
    return resolved_path


def validate_v7_repair_r5_stage4_full_training_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    preflight_only = authorization_status == V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS
    active_training = authorization_status == V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS
    if not preflight_only and not active_training:
        raise ValueError("V7 R5 Stage 4 authorization status is invalid")
    expected_identity = {
        "authorizationId": V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256,
        "implementationConsumptionPath": V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_PATH,
        "implementationConsumptionSha256": V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_SHA256,
        "status": authorization_status,
    }
    for name, expected in expected_identity.items():
        if authorization.get(name) != expected:
            raise ValueError(f"V7 R5 Stage 4 {name} identity is invalid")

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_PATH)
    implementation_path = root / Path(V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 Stage 4 immutable authorization evidence is missing or changed")
    if not implementation_path.is_file() or sha256_file(implementation_path) != V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_SHA256:
        raise ValueError("V7 R5 Stage 4 implementation authorization consumption is missing or changed")
    record = read_json(authorization_path)
    implementation = read_json(implementation_path)
    if record.get("requestId") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 R5 Stage 4 authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_COMMAND_REF or decision.get("scope") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SCOPE:
        raise ValueError("V7 R5 Stage 4 owner authorization identity mismatch")
    if implementation.get("status") != "implementation_scope_consumed_before_authorized_writes_training_scope_not_consumed":
        raise ValueError("V7 R5 Stage 4 implementation scope was not consumed before writes")
    if implementation.get("authorizationSha256") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 Stage 4 implementation consumption authorization hash mismatch")
    if implementation.get("commandRef") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_COMMAND_REF or implementation.get("scope") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SCOPE:
        raise ValueError("V7 R5 Stage 4 implementation consumption identity mismatch")

    resolution = record.get("resolution", {})
    for name in (
        "contractBoundaryRepairAuthorized",
        "stage3SmokeContinuationEpochsMustRemain30",
        "stage4FormalEpochsPerStageMustRemain40",
        "legacyR1CompatibilityRequired",
        "legacyStage3CompatibilityRequired",
        "stage4InactiveConfigRecompilationAuthorized",
        "cpuPositiveAuthorizationRegressionAuthorized",
        "cpuNegativeAuthorizationRegressionAuthorized",
        "pythonReadOnlyPreflightAuthorized",
        "gpuResourceGateAuthorized",
        "diskBudgetGateAuthorized",
        "implementationConsumptionRequiredBeforeAuthorizedWrites",
        "trainingExecutionConsumptionRequiredAfterAllPreflights",
        "autoencoderCheckpointReadAndLoadAuthorizedAfterTrainingConsumption",
        "stage0RandomInitializationAuthorized",
        "stage1CurrentRunStage0CheckpointReadAndLoadAuthorized",
        "stage2CurrentRunStage1CheckpointReadAndLoadAuthorized",
        "optimizerCreationAuthorizedAfterTrainingConsumption",
        "boundedModelWeightMutationAuthorizedAfterTrainingConsumption",
        "oneFullStage0Stage1Stage2GpuTrainingAuthorized",
        "fixedPreviewGenerationAndMachineReviewAuthorized",
        "checkpointTokenResourceAndTerminalEvidenceStorageAuthorized",
    ):
        if resolution.get(name) is not True:
            raise ValueError(f"V7 R5 Stage 4 authorization is missing {name}")
    for name in (
        "stage3SmokeCheckpointReadOrLoadAuthorized",
        "automaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(name) is not False:
            raise ValueError(f"V7 R5 Stage 4 authorization improperly opens {name}")

    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 R5 Stage 4 model identity mismatch")
    if identity.get("requiredRecordCount") != 64 or identity.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 R5 Stage 4 data identity mismatch")
    expected_stages = [
        {"index": 0, "width": 256, "height": 192, "epochs": 40, "initialization": "deterministic_project_random"},
        {"index": 1, "width": 512, "height": 384, "epochs": 40, "initialization": "current_run_stage_0_checkpoint_only"},
        {"index": 2, "width": 1024, "height": 768, "epochs": 40, "initialization": "current_run_stage_1_checkpoint_only"},
    ]
    if identity.get("requiredStages") != expected_stages:
        raise ValueError("V7 R5 Stage 4 progressive stage authorization mismatch")
    if identity.get("stage3SmokeContinuationEpochs") != 30:
        raise ValueError("V7 R5 Stage 3 Smoke continuation epoch identity mismatch")
    if identity.get("stage4FormalEpochsPerStage") != 40:
        raise ValueError("V7 R5 Stage 4 formal epoch identity mismatch")
    if int(training.get("r5BoundedSelectionEvidence", {}).get("continuationEpochs", {}).get("selectedValue", 0)) != 30:
        raise ValueError("V7 R5 Stage 3 Smoke bounded continuation epoch changed")
    if training.get("resolutionStages") != [{"width": 256, "height": 192}, {"width": 512, "height": 384}, {"width": 1024, "height": 768}]:
        raise ValueError("V7 R5 Stage 4 resolution stages are invalid")
    if int(training.get("denoiserEpochs", 0)) != 40:
        raise ValueError("V7 R5 Stage 4 requires 40 epochs per stage")
    if training.get("fixedEpochPreviewPolicy", {}).get("formalStage") != [1, 5, 10, 20, 30, 40]:
        raise ValueError("V7 R5 Stage 4 fixed preview epochs are invalid")
    if identity.get("requiredPreviewEpochsPerStage") != [1, 5, 10, 20, 30, 40]:
        raise ValueError("V7 R5 Stage 4 preview authorization identity mismatch")
    if training.get("authorizedInitialization") != "project_random_stage0_then_current_run_progressive_checkpoint_chain":
        raise ValueError("V7 R5 Stage 4 initialization identity mismatch")
    if training.get("r5Stage3CheckpointContinuation", {}).get("loadingAuthorizedNow") is not False:
        raise ValueError("V7 R5 Stage 4 cannot activate the Stage 3 Smoke checkpoint")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 R5 Stage 4 dataset capacity is not 64")

    source_config_path = root / Path(authorization.get("sourceConfigPath", ""))
    selection_contract_path = root / Path(authorization.get("selectionContractPath", ""))
    stage3_report_path = root / Path(authorization.get("stage3ClosureReportPath", ""))
    stage3_terminal_path = root / Path(authorization.get("stage3ClosureTerminalPath", ""))
    for evidence_path, expected_hash, code in (
        (source_config_path, authorization.get("sourceConfigSha256"), "source_config"),
        (selection_contract_path, authorization.get("selectionContractSha256"), "selection_contract"),
        (stage3_report_path, authorization.get("stage3ClosureReportSha256"), "stage3_closure_report"),
        (stage3_terminal_path, authorization.get("stage3ClosureTerminalSha256"), "stage3_closure_terminal"),
    ):
        if not evidence_path.is_file() or sha256_file(evidence_path) != expected_hash:
            raise ValueError(f"V7 R5 Stage 4 {code} is missing or changed")
    if read_json(stage3_report_path).get("status") != "r5_stage3_coverage_convergence_gpu_smoke_passed_closed_after_offline_preview_review":
        raise ValueError("V7 R5 Stage 4 Stage 3 closure did not pass")

    active_true_flags = (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "fullTrainingAuthorized",
    )
    always_false_flags = (
        "singleSampleGpuOverfitSmokeAuthorized",
        "automaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if preflight_only:
        if any(authorization.get(name) is True for name in (*active_true_flags, *always_false_flags)):
            raise ValueError("V7 R5 Stage 4 preflight config carries an active execution flag")
        if authorization.get("trainingExecutionConsumptionPath") is not None or authorization.get("trainingExecutionConsumptionSha256") is not None:
            raise ValueError("V7 R5 Stage 4 preflight cannot bind a training execution consumption")
        return
    if any(authorization.get(name) is not True for name in active_true_flags):
        raise ValueError("V7 R5 Stage 4 active full training is missing an execution flag")
    if any(authorization.get(name) is not False for name in always_false_flags):
        raise ValueError("V7 R5 Stage 4 active full training opens a forbidden boundary")
    if authorization.get("trainingExecutionConsumptionPath") != V7_REPAIR_R5_STAGE4_TRAINING_CONSUMPTION_PATH:
        raise ValueError("V7 R5 Stage 4 training consumption path identity is invalid")
    consumption_hash = authorization.get("trainingExecutionConsumptionSha256")
    if not isinstance(consumption_hash, str) or len(consumption_hash) != 64:
        raise ValueError("V7 R5 Stage 4 training consumption hash identity is invalid")
    training_consumption_path = root / Path(V7_REPAIR_R5_STAGE4_TRAINING_CONSUMPTION_PATH)
    if not training_consumption_path.is_file() or sha256_file(training_consumption_path) != consumption_hash:
        raise ValueError("V7 R5 Stage 4 training execution consumption is missing or changed")
    consumption = read_json(training_consumption_path)
    if consumption.get("status") != "training_execution_scope_consumed_after_all_preflights_passed":
        raise ValueError("V7 R5 Stage 4 training execution scope was not consumed after preflight")
    if consumption.get("authorizationSha256") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256:
        raise ValueError("V7 R5 Stage 4 training consumption authorization hash mismatch")
    if consumption.get("commandRef") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SCOPE:
        raise ValueError("V7 R5 Stage 4 training consumption identity mismatch")
    if int(consumption.get("allowedTrainingExecutionCount", 0)) != 1 or consumption.get("allPreflightsPassed") is not True:
        raise ValueError("V7 R5 Stage 4 training execution count or preflight state is invalid")


def validate_v7_repair_r4_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID:
        raise ValueError("V7 repair R4 Smoke authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R4 Smoke authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 Smoke authorization pinned hash is invalid")
    if authorization.get("authorizationConsumptionPath") != V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH:
        raise ValueError("V7 repair R4 Smoke consumption path is invalid")
    if authorization.get("authorizationConsumptionSha256") != V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R4 Smoke consumption pinned hash is invalid")
    if authorization.get("status") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R4 Smoke nested authorization status is invalid")
    if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R4 single-sample GPU Smoke is not authorized")
    if authorization.get("automaticRetryAuthorized") is not False:
        raise ValueError("V7 repair R4 Smoke cannot authorize automatic retry")
    for key in (
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(key) is not False:
            raise ValueError(f"V7 repair R4 improperly authorizes {key}")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R4 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R4 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R4 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R4 owner scope mismatch")
    resolution = record.get("resolution", {})
    for key in (
        "singleSampleGpuOverfitSmokeAuthorized",
        "fixedEpochPreviewGenerationAuthorized",
        "machinePreviewReviewAuthorized",
        "checkpointAndTokenEvidenceStorageAuthorized",
        "automaticTerminalStorageAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"V7 repair R4 authorization is missing {key}")
    for key in (
        "automaticRetryAuthorized",
        "parentCheckpointLoadingAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R4 authorization improperly opens {key}")
    if consumption.get("status") != "consumed_before_authorized_write":
        raise ValueError("V7 repair R4 authorization was not consumed before write")
    if consumption.get("authorizationSha256") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 consumed authorization hash mismatch")
    if consumption.get("commandRef") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R4 authorization consumption identity mismatch")
    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId") or identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R4 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R4 authorized sample identity mismatch")
    if identity.get("parentCheckpointPath") is not None or identity.get("parentCheckpointSha256") is not None:
        raise ValueError("V7 repair R4 random-initialization authorization cannot bind a parent checkpoint")
    if identity.get("initialization") != "project_random_multiscale_denoiser":
        raise ValueError("V7 repair R4 random initialization identity mismatch")
    if int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R4 random seed identity mismatch")
    smoke_contract = training.get("r4SmokeCandidateContract", {})
    if smoke_contract.get("status") != "owner_authorized_single_gpu_smoke_execution":
        raise ValueError("V7 repair R4 planned Smoke status is not active")
    if smoke_contract.get("gpuSmokeAuthorized") is not True:
        raise ValueError("V7 repair R4 planned Smoke GPU execution is not authorized")
    if identity.get("sampleId") != smoke_contract.get("plannedOverfitSampleId"):
        raise ValueError("V7 repair R4 planned Smoke sample mismatch")
    if int(identity.get("epochCount", 0)) != int(smoke_contract.get("plannedEpochs", -1)):
        raise ValueError("V7 repair R4 planned Smoke epoch count mismatch")
    if int(identity.get("evaluationInterval", 0)) != int(smoke_contract.get("plannedEvaluationInterval", -1)):
        raise ValueError("V7 repair R4 planned Smoke evaluation interval mismatch")
    if identity.get("requiredTailEpochs") != smoke_contract.get("requiredTailEpochs"):
        raise ValueError("V7 repair R4 planned Smoke tail gate mismatch")
    if smoke_contract.get("parentCheckpointAllowed") is not False:
        raise ValueError("V7 repair R4 Smoke parent checkpoint contract is invalid")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R4 dataset capacity is not 64")


def validate_v7_repair_r2_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("trainingAuthorizationStatus") != V7_REPAIR_R2_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R2 authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R2_AUTHORIZATION_ID:
        raise ValueError("V7 repair R2 authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R2_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R2 authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 authorization pinned hash is invalid")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R2_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R2_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R2_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R2 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R2_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R2 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R2 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R2_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R2 owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("repairImplementationAuthorized") is not True or resolution.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R2 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R2 improperly authorizes {key}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("requestSha256") != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R2_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R2 authorization consumption identity mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R2 dataset capacity is not 64")


def validate_v7_repair_r1_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("trainingAuthorizationStatus") != V7_REPAIR_R1_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R1 authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R1_AUTHORIZATION_ID:
        raise ValueError("V7 repair R1 authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R1_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R1 authorization path is invalid")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R1_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 repair R1 authorization record is missing")
    if sha256_file(authorization_path) != authorization.get("authorizationSha256"):
        raise ValueError("V7 repair R1 authorization hash mismatch")
    record = read_json(authorization_path)
    if record.get("requestId") != V7_REPAIR_R1_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R1 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R1_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R1 owner command mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("boundedDiagnosticsAuthorized") is not True or resolution.get("repairImplementationAuthorized") is not True or resolution.get("singleStage0SmokeAuthorized") is not True:
        raise ValueError("V7 repair R1 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R1 improperly authorizes {key}")
    task_identity = record.get("taskIdentity", {})
    if task_identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 repair R1 model identity mismatch")
    if task_identity.get("repairContractId") != training.get("repairContractId"):
        raise ValueError("V7 repair R1 contract identity mismatch")
    # package.splitCounts describes every dataset row (currently 112 rows), not
    # the V7 capacity subset.  The exact 48/8/4/4 contract is verified from the
    # rows the V7 Dataset actually selects in validate_loaded_v7_datasets().
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R1 dataset does not contain the locked 64 capacity rows")


def validate_v7_repair_r1_full_training_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID:
        raise ValueError("V7 repair R1 full-training authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R1 full-training authorization path is invalid")
    if authorization.get("status") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R1 full-training nested status is invalid")
    if authorization.get("gpuTrainingAuthorizedNow") is not True or authorization.get("fullTrainingAuthorized") is not True:
        raise ValueError("V7 repair R1 full GPU training is not active")
    if authorization.get("formalInferenceAuthorized") is not False:
        raise ValueError("V7 repair R1 full-training config improperly opens formal inference")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 repair R1 full-training authorization record is missing")
    if sha256_file(authorization_path) != authorization.get("authorizationSha256"):
        raise ValueError("V7 repair R1 full-training authorization hash mismatch")
    record = read_json(authorization_path)
    if record.get("requestId") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R1 full-training authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R1 full-training owner command mismatch")
    if decision.get("scope") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R1 full-training owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("fullTrainingAuthorized") is not True or resolution.get("requiredStagesAuthorized") != [0, 1, 2]:
        raise ValueError("V7 repair R1 full Stage 0/1/2 training is not authorized")
    if resolution.get("strictStageOrderRequired") is not True or resolution.get("newRandomStage0Required") is not True:
        raise ValueError("V7 repair R1 full-training lineage contract is incomplete")
    for key in ("revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R1 full-training authorization improperly opens {key}")
    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 repair R1 full-training model identity mismatch")
    if identity.get("architectureVersion") != config.get("architectureVersion"):
        raise ValueError("V7 repair R1 full-training architecture identity mismatch")
    if identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R1 full-training dataset identity mismatch")
    if identity.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS or identity.get("conditionChannelCount") != 23:
        raise ValueError("V7 repair R1 full-training data contract mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R1 full-training dataset does not contain 64 capacity rows")


def validate_v7_dataset_repair_authorization(root, config, package):
    authorization_path = root / Path(V7_DATASET_REPAIR_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 dataset repair authorization file is missing")
    if sha256_file(authorization_path) != V7_DATASET_REPAIR_AUTHORIZATION_SHA256:
        raise ValueError("V7 dataset repair authorization SHA-256 does not match")
    authorization = read_json(authorization_path)
    if authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1":
        raise ValueError("V7 dataset repair authorization schema is invalid")
    if authorization.get("requestId") != V7_DATASET_REPAIR_AUTHORIZATION_ID:
        raise ValueError("V7 dataset repair authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 dataset repair authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != V7_DATASET_REPAIR_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 dataset repair owner command is invalid")
    if decision.get("scope") != V7_DATASET_REPAIR_AUTHORIZATION_SCOPE:
        raise ValueError("V7 dataset repair authorization scope is invalid")
    identity = authorization.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 dataset repair model identity does not match")
    if identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 dataset repair package identity does not match")
    if identity.get("requiredV7CapacityCount") != 64 or identity.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 dataset repair capacity or split authorization is invalid")
    resolution = authorization.get("resolution", {})
    if resolution.get("datasetBindingRepairAuthorized") is not True or resolution.get("gpuRetrainingAuthorized") is not True:
        raise ValueError("V7 dataset repair and retraining are not authorized")
    if resolution.get("postTrainingValidationAuthorized") is not False:
        raise ValueError("V7 dataset repair authorization improperly opens post-training validation")
    if resolution.get("formalInferenceAuthorized") is not False or resolution.get("runtimeFrameAuthorized") is not False or resolution.get("worldEntryAuthorized") is not False:
        raise ValueError("V7 dataset repair authorization improperly opens downstream execution")


def validate_loaded_v7_datasets(datasets):
    split_counts = {split: len(dataset) for split, dataset in datasets.items()}
    if split_counts != V7_MVP64_SPLIT_COUNTS:
        raise ValueError(f"V7 actual loaded split must be 48/8/4/4, got {split_counts}")
    rows = [row for dataset in datasets.values() for row in dataset.rows]
    if len(rows) != 64:
        raise ValueError(f"V7 actual loaded capacity count must be 64, got {len(rows)}")
    if any(row.get("v7CapacityContributionRegistered") is not True for row in rows):
        raise ValueError("V7 loaded rows contain a non-registered capacity contribution")
    record_ids = [row.get("recordId") for row in rows]
    slot_ids = [row.get("v7CapacitySlotId") for row in rows]
    if any(not isinstance(value, str) or not value for value in record_ids) or len(set(record_ids)) != 64:
        raise ValueError("V7 loaded record identities are missing or duplicated")
    if any(not isinstance(value, str) or not value for value in slot_ids) or len(set(slot_ids)) != 64:
        raise ValueError("V7 loaded capacity slot identities are missing or duplicated")
    return {
        "selectionMode": "v7_registered_capacity_contribution_only",
        "actualLoadedConditionalSampleCount": len(rows),
        "actualLoadedV7CapacityCount": len(rows),
        "actualSplitCounts": split_counts,
        "allRowsCapacityRegistered": True,
        "uniqueRecordIdCount": len(set(record_ids)),
        "uniqueCapacitySlotCount": len(set(slot_ids)),
        "legacyCurrentConditionIdentityRowCount": sum(row.get("currentConditionIdentityMatches") is True for row in rows),
        "loadedRecordIds": record_ids,
        "loadedCapacitySlotIds": slot_ids,
    }


def build_training_token_accounting(config, datasets, stage, epoch_count, smoke_test, computes_latent_normalization, evaluation_epoch_count=None):
    """Count real model work without pretending that image training uses NLP/API tokens."""
    training = config["training"]
    batch_size = int(training["batchSize"])
    width = int(stage["width"])
    height = int(stage["height"])
    downsample = int(config["latentDownsampleFactor"])
    latent_width = width // downsample
    latent_height = height // downsample
    latent_spatial_positions = latent_width * latent_height
    latent_channels = int(config["latentChannels"])
    condition_channels = int(config["conditionChannels"])
    fixed_timestep_count = len(training["fixedValidationTimesteps"])
    evaluation_epoch_count = epoch_count if evaluation_epoch_count is None else int(evaluation_epoch_count)
    trajectory_supervision_steps = int(training.get("shortTrajectorySupervision", {}).get("steps", 0)) if training.get("shortTrajectorySupervision", {}).get("enabled") is True else 0
    cross_domain_rollout_steps = int(config["inferenceSteps"]) if training.get("stage4CrossDomainVisualConsistency", {}).get("enabled") is True else 0
    path_replay_passes = r5_path_replay_passes_per_epoch(config)
    train_samples_per_epoch = min(len(datasets["train"]), batch_size) if smoke_test else len(datasets["train"])
    effective_training_presentations_per_epoch = train_samples_per_epoch * (1 + path_replay_passes)
    optimizer_steps_per_epoch = ((train_samples_per_epoch + batch_size - 1) // batch_size) * (1 + path_replay_passes)
    validation_samples = len(datasets["validation"])
    fixed_validation_sample_passes = validation_samples * fixed_timestep_count
    rollout_seeds = int(training.get("checkpointRolloutSeedsPerSample", 2)) if uses_v7_rollout_validation(config) else 0
    rollout_steps = int(config["inferenceSteps"]) if uses_v7_rollout_validation(config) else 0
    rollout_trajectories = validation_samples * rollout_seeds
    rollout_sample_passes = rollout_trajectories * rollout_steps
    training_denoiser_passes_per_epoch = (
        effective_training_presentations_per_epoch * (1 + trajectory_supervision_steps)
        + train_samples_per_epoch * cross_domain_rollout_steps
    )
    evaluated_epoch_sample_passes = training_denoiser_passes_per_epoch + fixed_validation_sample_passes + rollout_sample_passes

    strict_held_out = training.get("strictHeldOutInferenceSplit")
    final_evaluation_samples = sum(
        len(dataset)
        for split, dataset in datasets.items()
        if split != strict_held_out
    )
    final_evaluation_sample_passes = final_evaluation_samples * fixed_timestep_count
    evidence_sample_passes = sum(
        len(datasets[split])
        for split in ("validation", "challenge", "regression")
        if split != strict_held_out
    )
    epoch_sample_passes = (
        training_denoiser_passes_per_epoch * epoch_count
        + (fixed_validation_sample_passes + rollout_sample_passes) * evaluation_epoch_count
    )
    total_sample_passes = epoch_sample_passes + final_evaluation_sample_passes + evidence_sample_passes
    decoded_rgb_training_frames_per_epoch = (
        effective_training_presentations_per_epoch * (1 + trajectory_supervision_steps)
        + (train_samples_per_epoch if cross_domain_rollout_steps else 0)
    )
    decoded_rgb_frames_per_evaluated_epoch = decoded_rgb_training_frames_per_epoch + fixed_validation_sample_passes + rollout_trajectories
    decoded_rgb_frames_total = (
        decoded_rgb_training_frames_per_epoch * epoch_count
        + (fixed_validation_sample_passes + rollout_trajectories) * evaluation_epoch_count
        + final_evaluation_sample_passes
        + evidence_sample_passes
    )

    def token_values(sample_passes):
        return {
            "denoiserSampleForwardPasses": sample_passes,
            "latentSpatialTokens": sample_passes * latent_spatial_positions,
            "latentChannelValues": sample_passes * latent_spatial_positions * latent_channels,
            "conditionScalarValues": sample_passes * width * height * condition_channels,
        }

    return {
        "schemaVersion": "ai-assisted-local-training-token-accounting-v1",
        "source": "training_program_exact_loop_accounting",
        "terminology": {
            "localTrainingTokenUnit": "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
            "isNlpToken": False,
            "tokenizerUsed": False,
            "noteZh": "本地V7是图像扩散模型，不使用文本Tokenizer；本账本中的Token是项目自定义的潜空间计算单位，不是API计费Token。",
        },
        "externalApi": {
            "providerCalls": 0,
            "promptTokens": 0,
            "completionTokens": 0,
            "totalTokens": 0,
            "costCny": 0,
            "measurementStatus": "not_applicable_local_pytorch_training",
            "externalAgentConversationTokensAvailableToLocalProgram": False,
        },
        "geometry": {
            "imageWidth": width,
            "imageHeight": height,
            "imagePixelsPerSample": width * height,
            "latentWidth": latent_width,
            "latentHeight": latent_height,
            "latentSpatialPositionsPerSample": latent_spatial_positions,
            "latentChannels": latent_channels,
            "conditionChannels": condition_channels,
            "latentDownsampleFactor": downsample,
        },
        "perEpoch": {
            "trainingSamplePresentations": effective_training_presentations_per_epoch,
            "primaryTrainingSamplePresentations": train_samples_per_epoch,
            "pathHardExampleReplayPassesPerEpoch": path_replay_passes,
            "optimizerSteps": optimizer_steps_per_epoch,
            "shortTrajectoryDenoiserStepsPerTrainingSample": trajectory_supervision_steps,
            "crossDomainRolloutDenoiserStepsPerPrimaryTrainingSample": cross_domain_rollout_steps,
            "fixedValidationSamplePasses": fixed_validation_sample_passes,
            "rolloutTrajectories": rollout_trajectories,
            "rolloutDenoiserSteps": rollout_sample_passes,
            "decodedRgbFramesOnEvaluatedEpoch": decoded_rgb_frames_per_evaluated_epoch,
            **token_values(evaluated_epoch_sample_passes),
        },
        "postEpochEvaluation": {
            "fixedGridSamplePasses": final_evaluation_sample_passes,
            "conditionEvidenceSamplePasses": evidence_sample_passes,
            "latentNormalizationEncoderSamples": len(datasets["train"]) if computes_latent_normalization else 0,
            **token_values(final_evaluation_sample_passes + evidence_sample_passes),
        },
        "runTotals": {
            "epochCount": epoch_count,
            "evaluationEpochCount": evaluation_epoch_count,
            "trainingSamplePresentations": effective_training_presentations_per_epoch * epoch_count,
            "primaryTrainingSamplePresentations": train_samples_per_epoch * epoch_count,
            "pathHardExampleReplaySamplePresentations": train_samples_per_epoch * path_replay_passes * epoch_count,
            "optimizerSteps": optimizer_steps_per_epoch * epoch_count,
            "shortTrajectoryDenoiserSteps": train_samples_per_epoch * trajectory_supervision_steps * epoch_count,
            "crossDomainRolloutDenoiserSteps": train_samples_per_epoch * cross_domain_rollout_steps * epoch_count,
            "fixedValidationSamplePasses": fixed_validation_sample_passes * evaluation_epoch_count,
            "rolloutTrajectories": rollout_trajectories * evaluation_epoch_count,
            "rolloutDenoiserSteps": rollout_sample_passes * evaluation_epoch_count,
            "decodedRgbFrames": decoded_rgb_frames_total,
            "decodedRgbPixelPredictions": decoded_rgb_frames_total * width * height,
            **token_values(total_sample_passes),
        },
        "scope": {
            "included": [
                "denoiser_training_forward_passes",
                "cross_domain_visual_consistency_rollout_denoiser_steps",
                "fixed_grid_validation_forward_passes",
                "checkpoint_rollout_denoiser_steps",
                "post_epoch_split_evaluation",
                "condition_evidence_forward_passes",
            ],
            "excluded": [
                "cpu_data_loading",
                "loss_scalar_arithmetic",
                "optimizer_internal_floating_point_operations",
                "external_agent_chat_tokens_not_exposed_to_local_program",
            ],
        },
    }


def load_autoencoder_checkpoint(path, config):
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    if checkpoint.get("schemaVersion") != config.get("autoencoderRequiredCheckpointProvenance", config.get("requiredCheckpointProvenance")):
        raise ValueError("autoencoder checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("autoencoder checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("autoencoder checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("autoencoderSourceModelId", config.get("modelId")) or checkpoint.get("architectureVersion") != config.get("autoencoderSourceArchitectureVersion", config.get("architectureVersion")):
        raise ValueError("autoencoder checkpoint model architecture does not match")
    if checkpoint.get("trainingStage") != "autoencoder_warmup_only" or checkpoint.get("denoiserTrained") is not False:
        raise ValueError("initial checkpoint is not the approved autoencoder-only checkpoint")
    if not isinstance(checkpoint.get("autoencoderState"), dict):
        raise ValueError("autoencoder checkpoint state is missing")
    return checkpoint


def load_denoiser_checkpoint(path, config, package, resolution_stage):
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    expected_stage = config["training"]["resolutionStages"][resolution_stage - 1]
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("parent denoiser checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("parent denoiser checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("parent denoiser checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("modelId") or checkpoint.get("architectureVersion") != config.get("architectureVersion"):
        raise ValueError("parent denoiser checkpoint model architecture does not match")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("parent denoiser checkpoint dataset package does not match")
    if checkpoint.get("actualLoadedConditionalSampleCount") != 64 or checkpoint.get("actualLoadedV7CapacityCount") != 64:
        raise ValueError("parent denoiser checkpoint was not trained on the repaired V7 64-row dataset")
    if checkpoint.get("actualLoadedSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("parent denoiser checkpoint split is not the repaired V7 48/8/4/4 split")
    if checkpoint.get("resolutionStage") != expected_stage or checkpoint.get("denoiserTrained") is not True:
        raise ValueError("parent denoiser checkpoint is not the completed preceding resolution stage")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("parent denoiser state is missing")
    return checkpoint


def load_r5_continuation_checkpoint(path, config, package):
    continuation = config.get("training", {}).get("r5Stage3CheckpointContinuation") or config.get("training", {}).get("r5CheckpointContinuation", {})
    if project_path(path) != continuation.get("sourceCheckpointPath"):
        raise ValueError("V7 R5 continuation checkpoint path is invalid")
    if sha256_file(path) != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 continuation checkpoint SHA-256 is invalid")
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("V7 R5 continuation checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("V7 R5 continuation checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("V7 R5 continuation checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("modelId"):
        raise ValueError("V7 R5 continuation checkpoint model identity is invalid")
    if checkpoint.get("architectureVersion") != continuation.get("sourceArchitectureVersion"):
        raise ValueError("V7 R5 continuation checkpoint source architecture is invalid")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 R5 continuation checkpoint dataset package does not match")
    if checkpoint.get("actualLoadedConditionalSampleCount") != 64 or checkpoint.get("actualLoadedV7CapacityCount") != 64:
        raise ValueError("V7 R5 continuation checkpoint capacity is not 64")
    if checkpoint.get("actualLoadedSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 R5 continuation checkpoint split is not 48/8/4/4")
    if checkpoint.get("resolutionStage") != config["training"]["resolutionStages"][0]:
        raise ValueError("V7 R5 continuation checkpoint is not a Stage 0 checkpoint")
    if checkpoint.get("trainingStage") != "conditional_denoiser_single_sample_overfit_smoke":
        raise ValueError("V7 R5 continuation source is not an authorized bounded Smoke checkpoint")
    if checkpoint.get("formalInferenceEligible") is not False:
        raise ValueError("V7 R5 continuation checkpoint improperly claims formal inference eligibility")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("V7 R5 continuation denoiser state is missing")
    return checkpoint


def load_stage4_bounded_repair_checkpoint(path, config, package):
    continuation = config.get("training", {}).get("r5Stage4BoundedRepairCheckpointContinuation", {})
    if project_path(path) != continuation.get("sourceCheckpointPath"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint path is invalid")
    if sha256_file(path) != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint SHA-256 is invalid")
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("modelId"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint model identity is invalid")
    if checkpoint.get("architectureVersion") != continuation.get("sourceArchitectureVersion"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint source architecture is invalid")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint dataset package does not match")
    if checkpoint.get("actualLoadedConditionalSampleCount") != 64 or checkpoint.get("actualLoadedV7CapacityCount") != 64:
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint capacity is not 64")
    if checkpoint.get("actualLoadedSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint split is not 48/8/4/4")
    if checkpoint.get("resolutionStage") != config["training"]["resolutionStages"][0]:
        raise ValueError("V7 R5 Stage 4 bounded-repair source is not a Stage 0 checkpoint")
    if checkpoint.get("trainingStage") != "conditional_denoiser_training":
        raise ValueError("V7 R5 Stage 4 bounded-repair source is not the bound failed formal Stage 0 checkpoint")
    if checkpoint.get("formalInferenceEligible") is not False:
        raise ValueError("V7 R5 Stage 4 bounded-repair checkpoint improperly claims formal inference eligibility")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("V7 R5 Stage 4 bounded-repair denoiser state is missing")
    return checkpoint


def validate_stage4_validation_kernel_phase0_cli(args, config, package):
    identity_path = args.phase0_execution_identity
    if identity_path is None or not identity_path.is_file():
        raise ValueError("Stage4 validation kernel Phase0 execution identity is required")
    identity = read_json(identity_path)
    if identity.get("schemaVersion") != "ai-painter-stage4-validation-kernel-phase0-execution-identity-v1":
        raise ValueError("Stage4 validation kernel Phase0 execution identity schema is invalid")
    if identity.get("status") != "phase0_execution_identity_active_not_completed":
        raise ValueError("Stage4 validation kernel Phase0 execution identity is not active")
    request_id = "owner-authorized-stage4-validation-kernel-through-stage5-20260810"
    authorization_path = Path(identity.get("authorizationPath", ""))
    consumption_path = Path(identity.get("phase0ConsumptionPath", ""))
    attestation_path = Path(identity.get("implementationAttestationPath", ""))
    source_config_path = Path(identity.get("sourceInactiveConfigPath", ""))
    for label, candidate, expected_sha in (
        ("authorization", authorization_path, identity.get("authorizationSha256")),
        ("Phase0 consumption", consumption_path, identity.get("phase0ConsumptionSha256")),
        ("implementation attestation", attestation_path, identity.get("implementationAttestationSha256")),
        ("source inactive config", source_config_path, identity.get("sourceInactiveConfigSha256")),
        ("dataset manifest", Path(identity.get("datasetManifestPath", "")), identity.get("datasetManifestSha256")),
        ("Autoencoder checkpoint", Path(identity.get("autoencoderCheckpointPath", "")), identity.get("autoencoderCheckpointSha256")),
    ):
        if not candidate.is_file() or sha256_file(candidate) != expected_sha:
            raise ValueError(f"Stage4 validation kernel bound {label} is missing or changed")
    if sha256_file(authorization_path) != "73776d1fb0db6e5e0b0e5de8df12a5727238e08969943e5ab25173d64182c229":
        raise ValueError("Stage4 validation kernel Owner authorization identity changed")
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    attestation = read_json(attestation_path)
    fixed = authorization.get("fixedTaskIdentity", {})
    if (
        authorization.get("requestId") != request_id
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != request_id
        or consumption.get("status") != "stage4_validation_kernel_phase0_gpu_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != identity.get("authorizationSha256")
        or consumption.get("runId") != identity.get("runId")
        or attestation.get("status") != "stage4_validation_kernel_phase0_implementation_cpu_verified"
        or attestation.get("authorizationSha256") != identity.get("authorizationSha256")
        or attestation.get("trainerSha256") != sha256_file(Path(__file__))
    ):
        raise ValueError("Stage4 validation kernel authorization lineage is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "phase0ProjectAutoencoderReadAndLoadFrozen", "phase0V9FixedRandomInitialization",
        "phase0OptimizerCreation", "phase0BackwardAndSingleOptimizerStep",
        "phase0BoundedWeightModification", "phase0DiagnosticCheckpointWriteAndReload",
        "phase0DoublePreviewReproduction",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"Stage4 validation kernel authorized action is closed: {key}")
    for key in ("formalInference", "checkpointFormalPromotion", "ownerFormalVisualAcceptance", "runtimeFrame", "worldEntry", "worldRuntime"):
        if actions.get(key) is not False:
            raise ValueError(f"Stage4 validation kernel forbidden action is open: {key}")
    if (
        fixed.get("architecture") != config.get("denoiserArchitecture")
        or fixed.get("sampleId") != args.overfit_sample_id
        or fixed.get("sampleSplit") != "validation"
        or fixed.get("seed") != int(config.get("training", {}).get("seed", -1))
        or fixed.get("requiredBoundarySides") != ["west"]
        or fixed.get("datasetSplit") != V7_MVP64_SPLIT_COUNTS
        or fixed.get("phase0Resolution") != {"width": 256, "height": 192}
    ):
        raise ValueError("Stage4 validation kernel fixed task identity changed")
    if sha256_file(args.config) != identity.get("sourceInactiveConfigSha256") or args.config.resolve() != source_config_path.resolve():
        raise ValueError("Stage4 validation kernel source config CLI identity changed")
    dataset_path = Path(identity["datasetManifestPath"])
    if args.dataset_package.resolve() != dataset_path.resolve():
        raise ValueError("Stage4 validation kernel dataset CLI identity changed")
    if args.autoencoder_checkpoint.resolve() != Path(identity["autoencoderCheckpointPath"]).resolve():
        raise ValueError("Stage4 validation kernel Autoencoder CLI identity changed")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("Stage4 validation kernel forbids old Denoiser Checkpoint input")
    if args.stage4_validation_kernel_phase0_reproduce:
        if args.phase0_diagnostic_checkpoint is None or not args.phase0_diagnostic_checkpoint.is_file():
            raise ValueError("Stage4 validation kernel reproduction requires its diagnostic Checkpoint")
        if (
            project_path(args.phase0_diagnostic_checkpoint) != identity.get("diagnosticCheckpointPath")
            or sha256_file(args.phase0_diagnostic_checkpoint) != identity.get("diagnosticCheckpointSha256")
        ):
            raise ValueError("Stage4 validation kernel diagnostic Checkpoint identity changed")
    elif args.phase0_diagnostic_checkpoint is not None:
        raise ValueError("Stage4 validation kernel update cannot load a Denoiser Checkpoint")
    return identity


def run_stage4_validation_kernel_phase0(
    args,
    config,
    package,
    datasets,
    dataset_binding_evidence,
    overfit_evidence,
    sample_bound_boundary_provenance,
):
    identity = validate_stage4_validation_kernel_phase0_cli(args, config, package)
    if not torch.cuda.is_available():
        raise RuntimeError("Stage4 validation kernel Phase0 requires CUDA device 0")
    device = torch.device("cuda:0")
    torch.cuda.init()
    if torch.cuda.current_device() != 0:
        raise RuntimeError("Stage4 validation kernel Phase0 CUDA device 0 confirmation failed")
    if torch.are_deterministic_algorithms_enabled():
        raise RuntimeError("Stage4 validation kernel training backward entered strict deterministic scope")
    seed = int(config["training"]["seed"])
    set_seed(seed)
    args.output_dir.mkdir(parents=True, exist_ok=False)
    telemetry_path = args.output_dir / "phase0-step-telemetry.json"
    write_json(telemetry_path, {
        "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-step-telemetry-v1",
        "status": "initialized",
        "runId": identity["runId"],
        "events": [],
    })

    def event(step, status, **details):
        payload = read_json(telemetry_path)
        payload["events"].append({
            "sequence": len(payload["events"]) + 1,
            "step": step,
            "status": status,
            "recordedAtUtc": utc_now(),
            **details,
        })
        payload["status"] = f"{step}_{status}"
        write_json(telemetry_path, payload)

    event("model_device_placement", "started")
    model = build_complete_world_system(config).to(device)
    event("model_device_placement", "completed")
    event("autoencoder_checkpoint_read_and_load", "started")
    autoencoder_checkpoint = load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(autoencoder_checkpoint["autoencoderState"])
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    event("autoencoder_checkpoint_read_and_load", "completed", frozen=True)
    diffusion = build_diffusion_schedule(config, device)

    if args.stage4_validation_kernel_phase0_update:
        return run_stage4_validation_kernel_phase0_update(
            args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
            sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
        )
    return run_stage4_validation_kernel_phase0_reproduce(
        args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
        sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
    )


def run_stage4_validation_kernel_phase0_update(
    args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
    sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
):
    event("latent_normalization", "started")
    latent_normalization = compute_latent_normalization(model, datasets["train"], device)
    event("latent_normalization", "completed", sampleCount=latent_normalization["sampleCount"])
    selected = build_optimization_datasets(datasets, overfit_evidence)
    loader = torch.utils.data.DataLoader(selected["train"], batch_size=1, shuffle=False, num_workers=0)
    event("optimizer_creation", "started")
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    event("optimizer_creation", "completed")
    before = state_dict_sha256(model.denoiser.state_dict())
    event("single_training_step", "started", deterministicAlgorithmsEnabled=torch.are_deterministic_algorithms_enabled())
    metrics = train_epoch(
        model, loader, optimizer, diffusion, latent_normalization, device, config, 0,
        max_batches=1, step_telemetry_path=None, enable_path_replay=False,
    )
    gradients = [parameter.grad.detach() for parameter in model.denoiser.parameters() if parameter.grad is not None]
    if not gradients or any(not bool(torch.isfinite(value).all()) for value in gradients):
        raise ValueError("Stage4 validation kernel Phase0 gradients are missing or non-finite")
    gradient_abs_sum = sum(float(value.abs().sum()) for value in gradients)
    gradient_nonzero_count = sum(int(torch.count_nonzero(value)) for value in gradients)
    if gradient_abs_sum <= 0.0 or gradient_nonzero_count <= 0:
        raise ValueError("Stage4 validation kernel Phase0 gradient is zero")
    after = state_dict_sha256(model.denoiser.state_dict())
    if before == after:
        raise ValueError("Stage4 validation kernel Phase0 optimizer step did not change model state")
    event("single_training_step", "completed", gradientFinite=True, gradientNonzero=True, weightsChanged=True)
    checkpoint_path = args.output_dir / "phase0-diagnostic-checkpoint.pt"
    event("diagnostic_checkpoint_write", "started")
    checkpoint = {
        "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-diagnostic-checkpoint-v1",
        "status": "phase0_diagnostic_checkpoint_nonpromotable_not_training_initialization",
        "runId": identity["runId"],
        "modelId": config["modelId"],
        "architectureId": config["denoiserArchitecture"],
        "denoiserState": {key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()},
        "optimizerState": optimizer.state_dict(),
        "epoch": 0,
        "step": 1,
        "cpuRngState": torch.get_rng_state(),
        "cudaRngStates": torch.cuda.get_rng_state_all(),
        "pythonRandomState": random.getstate(),
        "numpyRandomState": np.random.get_state(),
        "latentNormalization": serialize_latent_normalization(latent_normalization),
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "autoencoderCheckpointPath": project_path(args.autoencoder_checkpoint),
        "autoencoderCheckpointSha256": sha256_file(args.autoencoder_checkpoint),
        "sampleId": overfit_evidence["sampleId"],
        "sampleSplit": overfit_evidence["selectedSplit"],
        "seed": int(config["training"]["seed"]),
        "requiredBoundarySides": ["west"],
        "initialDenoiserStateSha256": before,
        "finalDenoiserStateSha256": after,
        "gradientFinite": True,
        "gradientNonzero": True,
        "gradientAbsSum": gradient_abs_sum,
        "gradientNonzeroCount": gradient_nonzero_count,
        "formalInferenceEligible": False,
        "checkpointPromotionEligible": False,
        "fullTrainingInitializationEligible": False,
    }
    torch.save(checkpoint, checkpoint_path)
    event("diagnostic_checkpoint_write", "completed", checkpointSha256=sha256_file(checkpoint_path))
    report = {
        "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-update-report-v1",
        "status": "phase0_single_cuda_optimizer_step_passed_closed",
        "recordedAtUtc": utc_now(),
        "runId": identity["runId"],
        "dataset": dataset_binding_evidence,
        "sample": overfit_evidence,
        "boundaryProvenance": sample_bound_boundary_provenance,
        "trainingDeterministicAlgorithmsEnabled": False,
        "lossFinite": all(math.isfinite(float(value)) for value in metrics.values()),
        "gradientFinite": True,
        "gradientNonzero": True,
        "gradientAbsSum": gradient_abs_sum,
        "gradientNonzeroCount": gradient_nonzero_count,
        "initialDenoiserStateSha256": before,
        "finalDenoiserStateSha256": after,
        "weightsChanged": before != after,
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": sha256_file(checkpoint_path),
        "telemetryPath": project_path(telemetry_path),
        "formalInferenceEligible": False,
        "checkpointPromotionEligible": False,
        "fullTrainingInitializationEligible": False,
    }
    report_path = args.output_dir / "phase0-update-report.json"
    write_json(report_path, report)
    print(json.dumps({**report, "reportPath": project_path(report_path), "reportSha256": sha256_file(report_path)}, ensure_ascii=False, indent=2))
    return 0


def run_stage4_validation_kernel_phase0_reproduce(
    args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
    sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
):
    event("diagnostic_checkpoint_read", "started")
    checkpoint = torch.load(args.phase0_diagnostic_checkpoint, map_location="cpu", weights_only=False)
    if (
        checkpoint.get("schemaVersion") != "ai-painter-stage4-validation-kernel-phase0-diagnostic-checkpoint-v1"
        or checkpoint.get("status") != "phase0_diagnostic_checkpoint_nonpromotable_not_training_initialization"
        or checkpoint.get("runId") != identity.get("runId")
        or checkpoint.get("configSha256") != sha256_file(args.config)
        or checkpoint.get("datasetManifestSha256") != sha256_file(args.dataset_package)
        or checkpoint.get("autoencoderCheckpointSha256") != sha256_file(args.autoencoder_checkpoint)
        or checkpoint.get("sampleId") != overfit_evidence.get("sampleId")
        or checkpoint.get("sampleSplit") != "validation"
        or checkpoint.get("formalInferenceEligible") is not False
        or checkpoint.get("checkpointPromotionEligible") is not False
        or checkpoint.get("fullTrainingInitializationEligible") is not False
    ):
        raise ValueError("Stage4 validation kernel diagnostic Checkpoint contract is invalid")
    model.denoiser.load_state_dict(checkpoint["denoiserState"])
    model_state_sha = state_dict_sha256(model.denoiser.state_dict())
    if model_state_sha != checkpoint.get("finalDenoiserStateSha256"):
        raise ValueError("Stage4 validation kernel restored model state identity changed")
    latent_normalization = load_latent_normalization(checkpoint, device)
    event("diagnostic_checkpoint_read", "completed", denoiserStateSha256=model_state_sha)
    selected = build_optimization_datasets(datasets, overfit_evidence)
    preview_root = args.output_dir / "fixed-preview"
    event("fixed_preview_generation", "started")
    with stage4_fixed_preview_determinism_scope(True):
        metrics = evaluate_deterministic_rollout_rgb_quality_v7(
            model, selected["validation"], diffusion, latent_normalization, device,
            int(config["training"]["seed"]) + 3000, config, preview_root, 1,
        )
    artifact = metrics.get("previewArtifact")
    if not isinstance(artifact, dict):
        raise ValueError("Stage4 validation kernel fixed preview artifact is missing")
    if artifact.get("denoiserStateSha256") != model_state_sha:
        raise ValueError("Stage4 validation kernel preview model state identity changed")
    event("fixed_preview_generation", "completed", rgbTensorSha256=artifact.get("rgbTensorSha256"), previewSha256=artifact.get("previewSha256"))
    report = {
        "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-reproduction-report-v1",
        "status": "phase0_checkpoint_fixed_preview_reproduction_passed_closed",
        "recordedAtUtc": utc_now(),
        "runId": identity["runId"],
        "dataset": dataset_binding_evidence,
        "sample": overfit_evidence,
        "boundaryProvenance": sample_bound_boundary_provenance,
        "checkpointPath": project_path(args.phase0_diagnostic_checkpoint),
        "checkpointSha256": sha256_file(args.phase0_diagnostic_checkpoint),
        "modelStateSha256": model_state_sha,
        "previewArtifact": artifact,
        "samplingIdentity": {
            "seed": int(config["training"]["seed"]) + 3000,
            "sampler": "deterministic_velocity_step",
            "timestepSequence": [int(value) for value in inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device).detach().cpu().tolist()],
            "normalization": "checkpoint_latent_normalization",
            "decode": "frozen_project_autoencoder_decode_clamp_0_1",
            "pngEncoder": "Pillow_PNG_optimize_true_no_dynamic_metadata",
        },
        "telemetryPath": project_path(telemetry_path),
        "formalInferenceEligible": False,
        "checkpointPromotionEligible": False,
    }
    report_path = args.output_dir / "phase0-reproduction-report.json"
    write_json(report_path, report)
    print(json.dumps({**report, "reportPath": project_path(report_path), "reportSha256": sha256_file(report_path)}, ensure_ascii=False, indent=2))
    return 0


def build_diffusion_schedule(config, device):
    beta_start = 0.0001
    beta_end = 0.02
    betas = torch.linspace(beta_start, beta_end, int(config["diffusionSteps"]), device=device)
    alphas_cumulative = torch.cumprod(1.0 - betas, dim=0)
    return {
        "alphasCumulative": alphas_cumulative,
        "betaStart": beta_start,
        "betaEnd": beta_end,
    }


def train_epoch(
    model,
    loader,
    optimizer,
    diffusion,
    latent_normalization,
    device,
    config,
    epoch_index,
    max_batches=None,
    on_batch_progress=None,
    step_telemetry_path=None,
    enable_path_replay=True,
):
    model.denoiser.train()
    totals = {}
    count = 0
    samples_processed = 0
    for batch_index, batch in enumerate(loader):
        if max_batches is not None and batch_index >= max_batches:
            break
        batch_started = time.perf_counter()
        record_stage4_step(
            step_telemetry_path,
            "batch_device_transfer",
            "started",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        image = batch["image"].to(device)
        conditions = batch["conditions"].to(device)
        record_stage4_step(
            step_telemetry_path,
            "batch_device_transfer",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        with torch.no_grad():
            latent = model.autoencoder.encode(image)
            latent = normalize_latent(latent, latent_normalization)
        timestep = training_timesteps(
            config,
            epoch_index,
            batch_index,
            len(loader),
            image.shape[0],
            diffusion["alphasCumulative"].shape[0],
            device,
        )
        noise = torch.randn_like(latent)
        noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
        optimizer.zero_grad(set_to_none=True)
        record_stage4_step(
            step_telemetry_path,
            "forward_loss",
            "started",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        loss_metrics = predict_and_measure(
            model,
            noisy_latent,
            target_velocity,
            latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            config,
            image,
            latent_normalization,
        )
        trajectory_metrics = short_trajectory_supervision(
            model,
            noisy_latent,
            latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            image,
            latent_normalization,
            config,
        )
        if trajectory_metrics is not None:
            loss_metrics["compositeLossTensor"] = (
                loss_metrics["compositeLossTensor"]
                + trajectory_metrics["shortTrajectoryLossTensor"]
            )
            loss_metrics["compositeLoss"] = loss_metrics["compositeLossTensor"]
            loss_metrics.update(trajectory_metrics)
        cross_domain_metrics = stage4_cross_domain_rollout_supervision(
            model,
            latent,
            conditions,
            image,
            diffusion["alphasCumulative"],
            latent_normalization,
            config,
        )
        if cross_domain_metrics is not None:
            loss_metrics["compositeLossTensor"] = (
                loss_metrics["compositeLossTensor"]
                + cross_domain_metrics["stage4CrossDomainVisualConsistencyLossTensor"]
            )
            loss_metrics["compositeLoss"] = loss_metrics["compositeLossTensor"]
            loss_metrics.update(cross_domain_metrics)
        record_stage4_step(
            step_telemetry_path,
            "forward_loss",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        record_stage4_step(
            step_telemetry_path,
            "backward",
            "started",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        loss_metrics["compositeLossTensor"].backward()
        record_stage4_step(
            step_telemetry_path,
            "backward",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        record_stage4_step(
            step_telemetry_path,
            "optimizer_step",
            "started",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        optimizer.step()
        record_stage4_step(
            step_telemetry_path,
            "optimizer_step",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        replay_passes = r5_path_replay_passes_per_epoch(config) if enable_path_replay else 0
        replay_totals = {}
        for replay_index in range(replay_passes):
            replay_timestep = training_timesteps(
                config,
                epoch_index,
                batch_index + (replay_index + 1) * len(loader),
                len(loader) * (1 + replay_passes),
                image.shape[0],
                diffusion["alphasCumulative"].shape[0],
                device,
            )
            replay_noise = torch.randn_like(latent)
            replay_noisy_latent = add_noise(
                latent,
                replay_noise,
                replay_timestep,
                diffusion["alphasCumulative"],
            )
            replay_target_velocity = velocity_target(
                latent,
                replay_noise,
                replay_timestep,
                diffusion["alphasCumulative"],
            )
            optimizer.zero_grad(set_to_none=True)
            replay_metrics = path_hard_example_replay_supervision(
                model,
                replay_noisy_latent,
                replay_target_velocity,
                latent,
                replay_timestep,
                diffusion["alphasCumulative"],
                conditions,
                image,
                latent_normalization,
                config,
            )
            replay_metrics["pathHardExampleReplayLossTensor"].backward()
            optimizer.step()
            for key, value in replay_metrics.items():
                if key.endswith("Tensor"):
                    continue
                replay_totals[key] = replay_totals.get(key, 0.0) + float(value.detach())
        if replay_passes:
            for key, value in replay_totals.items():
                loss_metrics[key] = loss_metrics["compositeLossTensor"].new_tensor(value / replay_passes)
            loss_metrics["pathHardExampleReplayPasses"] = loss_metrics["compositeLossTensor"].new_tensor(float(replay_passes))
        for key, value in loss_metrics.items():
            if key.endswith("Tensor"):
                continue
            totals[key] = totals.get(key, 0.0) + float(value.detach())
        count += 1
        samples_processed += int(image.shape[0])
        if on_batch_progress is not None:
            on_batch_progress({
                "batch": count,
                "batchTarget": min(len(loader), max_batches) if max_batches is not None else len(loader),
                "batchLoss": float(loss_metrics["compositeLoss"].detach()),
                "rollingEpochLoss": totals["compositeLoss"] / count,
                "lastBatchDurationSeconds": time.perf_counter() - batch_started,
                "samplesInBatch": int(image.shape[0]),
                "samplesProcessedInEpoch": samples_processed,
                "optimizerStepsCompletedInEpoch": count * (1 + replay_passes),
            })
    if count == 0:
        raise ValueError("conditional denoiser training loader produced no batches")
    return {key: value / count for key, value in totals.items()}


def stage4_cross_domain_rollout_supervision(
    model,
    clean_latent,
    conditions,
    target_image,
    alpha_bars,
    latent_normalization,
    config,
):
    contract = config.get("training", {}).get("stage4CrossDomainVisualConsistency", {})
    if contract.get("enabled") is not True:
        return None
    validate_v7_r5_stage4_cross_domain_visual_consistency_contract(config)
    stability_contract = config.get("training", {}).get("stage4StructuredTrajectoryStability", {})
    stability_enabled = stability_contract.get("enabled") is True
    if stability_enabled:
        validate_v7_r5_stage4_structured_stability_candidate_contract(config)
    inference_steps = inference_timesteps(
        int(config["diffusionSteps"]),
        int(config["inferenceSteps"]),
        clean_latent.device,
    )
    gradient_tail_steps = int(contract["gradientTailSteps"])
    no_gradient_steps = len(inference_steps) - gradient_tail_steps
    seed = int(config["training"]["seed"]) + int(contract["previewSeedOffset"])
    generated_latents = []
    for sample_index in range(clean_latent.shape[0]):
        generator = torch.Generator(device=clean_latent.device).manual_seed(seed + sample_index)
        generated_latents.append(torch.randn(
            clean_latent[sample_index:sample_index + 1].shape,
            device=clean_latent.device,
            dtype=clean_latent.dtype,
            generator=generator,
        ))
    rollout_latent = torch.cat(generated_latents, dim=0)
    stability_tail_latents = []
    stability_tail_steps = int(stability_contract.get("tailStepCount", 0)) if stability_enabled else 0
    for step_index, timestep in enumerate(inference_steps):
        timestep_value = int(timestep.item())
        previous = int(inference_steps[step_index + 1].item()) if step_index + 1 < len(inference_steps) else -1
        timestep_batch = torch.full(
            (rollout_latent.shape[0],),
            timestep_value,
            device=rollout_latent.device,
            dtype=torch.long,
        )
        if step_index < no_gradient_steps:
            with torch.no_grad():
                velocity = model.predict_velocity(rollout_latent, timestep_batch, conditions)
                rollout_latent = deterministic_velocity_step(
                    rollout_latent,
                    velocity,
                    timestep_value,
                    previous,
                    alpha_bars,
                )
            rollout_latent = rollout_latent.detach()
        else:
            velocity = model.predict_velocity(rollout_latent, timestep_batch, conditions)
            rollout_latent = deterministic_velocity_step(
                rollout_latent,
                velocity,
                timestep_value,
                previous,
                alpha_bars,
            )
        if stability_enabled and step_index >= len(inference_steps) - stability_tail_steps:
            stability_tail_latents.append(rollout_latent)
    predicted_rgb_steps = [
        model.autoencoder.decode(
            denormalize_latent(value, latent_normalization)
        ).clamp(0.0, 1.0)
        for value in stability_tail_latents
    ] if stability_enabled else []
    predicted_rgb = predicted_rgb_steps[-1] if predicted_rgb_steps else model.autoencoder.decode(
        denormalize_latent(rollout_latent, latent_normalization)
    ).clamp(0.0, 1.0)
    result = stage4_cross_domain_visual_consistency_losses(
        predicted_rgb,
        target_image,
        conditions,
        config,
        len(inference_steps),
        gradient_tail_steps,
    )
    if stability_enabled:
        stability = stage4_cross_domain_trajectory_stability_losses(
            predicted_rgb_steps,
            target_image,
            conditions,
            config,
        )
        result["stage4CrossDomainVisualConsistencyLossTensor"] = (
            result["stage4CrossDomainVisualConsistencyLossTensor"]
            + stability["stage4StructuredTrajectoryStabilityLossTensor"]
        )
        result["stage4CrossDomainVisualConsistencyWeightedLoss"] = result["stage4CrossDomainVisualConsistencyLossTensor"]
        result.update(stability)
    return result


def stage4_cross_domain_visual_consistency_losses(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
    rollout_steps=None,
    gradient_tail_steps=None,
):
    training = config.get("training", {})
    contract = training.get("stage4CrossDomainVisualConsistency", {})
    if contract.get("enabled") is not True:
        return None
    route_contract = contract["route"]
    rock_contract = contract["rock"]
    path_rgb = path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config)
    activation_mass = path_activation_mass_calibration_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
    )
    required_boundary = required_boundary_contact_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
    )
    route_loss = (
        path_rgb * float(training["denoiserLossWeights"]["pathInteriorRgb"])
        + activation_mass * float(training["pathActivationMassCalibration"]["weight"])
        + required_boundary * float(training["stage4RequiredBoundaryContact"]["weight"])
    )
    rock_rgb = masked_condition_rgb_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
        "object_rock",
    )
    rock_edge = masked_condition_gradient_rgb_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
        "object_rock",
    )
    rock_loss = (
        rock_rgb * float(rock_contract["rgbWeight"])
        + rock_edge * float(rock_contract["edgeWeight"])
    )
    raw = route_loss + rock_loss
    weighted = raw * float(contract["weight"])
    return {
        "stage4CrossDomainVisualConsistencyLossTensor": weighted,
        "stage4CrossDomainVisualConsistencyWeightedLoss": weighted,
        "stage4CrossDomainVisualConsistencyRawLoss": raw,
        "stage4CrossDomainRouteLoss": route_loss,
        "stage4CrossDomainRoutePathInteriorRgbMae": path_rgb,
        "stage4CrossDomainRouteActivationMassLoss": activation_mass,
        "stage4CrossDomainRouteRequiredBoundaryContactLoss": required_boundary,
        "stage4CrossDomainRockLoss": rock_loss,
        "stage4CrossDomainRockRgbMae": rock_rgb,
        "stage4CrossDomainRockEdgeMae": rock_edge,
        "stage4CrossDomainRolloutStepCount": predicted_rgb.new_tensor(float(
            int(config["inferenceSteps"]) if rollout_steps is None else rollout_steps
        )),
        "stage4CrossDomainGradientTailStepCount": predicted_rgb.new_tensor(float(
            int(contract["gradientTailSteps"]) if gradient_tail_steps is None else gradient_tail_steps
        )),
    }


def stage4_cross_domain_trajectory_stability_losses(
    predicted_rgb_steps,
    target_rgb,
    conditions,
    config,
):
    training = config.get("training", {})
    contract = training.get("stage4StructuredTrajectoryStability", {})
    if contract.get("enabled") is not True:
        return None
    validate_v7_r5_stage4_structured_stability_candidate_contract(config)
    required_steps = int(contract["tailStepCount"])
    if len(predicted_rgb_steps) != required_steps or required_steps < 2:
        raise ValueError("Stage 4 structured stability requires the selected tail prediction count")
    route_reference = torch.stack([
        path_interior_rgb_loss(value, target_rgb, conditions, config)
        + required_boundary_contact_loss(value, target_rgb, conditions, config)
        for value in predicted_rgb_steps
    ]).mean()
    route_temporal = torch.stack([
        masked_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
            "terrain_path_ground",
        )
        for index in range(1, len(predicted_rgb_steps))
    ]).mean()
    rock_reference = torch.stack([
        masked_condition_rgb_loss(value, target_rgb, conditions, config, "object_rock")
        + masked_condition_gradient_rgb_loss(value, target_rgb, conditions, config, "object_rock")
        for value in predicted_rgb_steps
    ]).mean()
    rock_temporal = torch.stack([
        masked_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
            "object_rock",
        )
        for index in range(1, len(predicted_rgb_steps))
    ]).mean()
    route_raw = (route_reference + route_temporal) * 0.5
    rock_raw = (rock_reference + rock_temporal) * 0.5
    weighted = (
        route_raw * float(contract["route"]["weight"])
        + rock_raw * float(contract["rock"]["weight"])
    )
    return {
        "stage4StructuredTrajectoryStabilityLossTensor": weighted,
        "stage4StructuredTrajectoryStabilityWeightedLoss": weighted,
        "stage4StructuredRouteTrajectoryRawLoss": route_raw,
        "stage4StructuredRouteReferenceLoss": route_reference,
        "stage4StructuredRouteAdjacentStepConsistencyLoss": route_temporal,
        "stage4StructuredRockTrajectoryRawLoss": rock_raw,
        "stage4StructuredRockReferenceLoss": rock_reference,
        "stage4StructuredRockAdjacentStepConsistencyLoss": rock_temporal,
        "stage4StructuredTrajectoryTailStepCount": target_rgb.new_tensor(float(required_steps)),
    }


def masked_condition_gradient_rgb_loss(predicted_rgb, target_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
    horizontal_mask = torch.maximum(mask[:, :, :, 1:], mask[:, :, :, :-1])
    vertical_mask = torch.maximum(mask[:, :, 1:, :], mask[:, :, :-1, :])
    predicted_horizontal = predicted_rgb[:, :, :, 1:] - predicted_rgb[:, :, :, :-1]
    target_horizontal = target_rgb[:, :, :, 1:] - target_rgb[:, :, :, :-1]
    predicted_vertical = predicted_rgb[:, :, 1:, :] - predicted_rgb[:, :, :-1, :]
    target_vertical = target_rgb[:, :, 1:, :] - target_rgb[:, :, :-1, :]
    horizontal_denominator = (horizontal_mask.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    vertical_denominator = (vertical_mask.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    horizontal_loss = ((predicted_horizontal - target_horizontal).abs() * horizontal_mask).sum() / horizontal_denominator
    vertical_loss = ((predicted_vertical - target_vertical).abs() * vertical_mask).sum() / vertical_denominator
    return (horizontal_loss + vertical_loss) * 0.5


def r5_path_replay_passes_per_epoch(config):
    contract = config.get("training", {}).get("pathHardExampleReplay", {})
    if contract.get("enabled") is not True:
        return 0
    if contract.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("R5 path replay requires original Owner-approved RGB and bound conditions")
    if contract.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("R5 path replay cannot use failed preview pixels as targets")
    passes = int(contract.get("passesPerEpoch", 0))
    if passes not in {1, 2}:
        raise ValueError("R5 path replay passes per epoch must be one or two")
    return passes


def path_hard_example_replay_supervision(
    model,
    noisy_latent,
    target_velocity,
    clean_latent,
    timesteps,
    alpha_bars,
    conditions,
    target_image,
    latent_normalization,
    config,
):
    if r5_path_replay_passes_per_epoch(config) == 0:
        raise ValueError("path hard-example replay is not enabled")
    measured = predict_and_measure(
        model,
        noisy_latent,
        target_velocity,
        clean_latent,
        timesteps,
        alpha_bars,
        conditions,
        config,
        target_image,
        latent_normalization,
    )
    loss_weights = config["training"]["denoiserLossWeights"]
    replay_loss = (
        measured["pathInteriorRgbMae"] * float(loss_weights["pathInteriorRgb"])
        + measured["pathForbiddenBoundaryRgbMae"] * float(loss_weights["pathForbiddenBoundaryRgb"])
    )
    coverage_loss = path_coverage_calibration_loss(
        measured["predictedRgbTensor"],
        target_image,
        conditions,
        config,
    )
    boundary_topology_loss = authorized_boundary_topology_loss(
        measured["predictedRgbTensor"],
        target_image,
        conditions,
        config,
    )
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    if coverage_contract.get("enabled") is True:
        replay_loss = replay_loss + coverage_loss * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        replay_loss = replay_loss + boundary_topology_loss * float(boundary_contract["weight"])
    trajectory = short_trajectory_supervision(
        model,
        noisy_latent,
        clean_latent,
        timesteps,
        alpha_bars,
        conditions,
        target_image,
        latent_normalization,
        config,
    )
    if trajectory is None or "pathShortTrajectoryConsistencyLossTensor" not in trajectory:
        raise ValueError("R5 path replay requires path short-trajectory consistency supervision")
    replay_loss = replay_loss + trajectory["pathShortTrajectoryConsistencyLossTensor"]
    return {
        "pathHardExampleReplayLossTensor": replay_loss,
        "pathHardExampleReplayWeightedLoss": replay_loss,
        "pathHardExampleReplayInteriorRgbMae": measured["pathInteriorRgbMae"],
        "pathHardExampleReplayForbiddenBoundaryRgbMae": measured["pathForbiddenBoundaryRgbMae"],
        "pathHardExampleReplayTrajectoryConsistencyLoss": trajectory["pathShortTrajectoryConsistencyWeightedLoss"],
        "pathHardExampleReplayCoverageCalibrationLoss": coverage_loss,
        "pathHardExampleReplayAuthorizedBoundaryTopologyLoss": boundary_topology_loss,
    }


def short_trajectory_supervision(model, noisy_latent, clean_latent, timesteps, alpha_bars, conditions, target_image, latent_normalization, config):
    contract = config.get("training", {}).get("shortTrajectorySupervision", {})
    if contract.get("enabled") is not True:
        return None
    steps = int(contract["steps"])
    step_gap = int(contract["stepGap"])
    current_latent = noisy_latent
    current_timesteps = timesteps
    predicted_clean = None
    predicted_rgb_steps = []
    for step_index in range(steps):
        velocity = model.predict_velocity(current_latent, current_timesteps, conditions)
        recovered = [
            recover_from_velocity(current_latent[index:index + 1], velocity[index:index + 1], int(current_timesteps[index].item()), alpha_bars)[0]
            for index in range(current_latent.shape[0])
        ]
        step_predicted_clean = torch.cat(recovered, dim=0)
        predicted_rgb_steps.append(
            model.autoencoder.decode(denormalize_latent(step_predicted_clean, latent_normalization))
        )
        if step_index + 1 == steps:
            predicted_clean = step_predicted_clean
            break
        previous_values = [max(0, int(value.item()) - step_gap) for value in current_timesteps]
        current_latent = torch.cat([
            deterministic_velocity_step(
                current_latent[index:index + 1],
                velocity[index:index + 1],
                int(current_timesteps[index].item()),
                previous_values[index],
                alpha_bars,
            )
            for index in range(current_latent.shape[0])
        ], dim=0)
        current_timesteps = torch.tensor(previous_values, device=current_latent.device, dtype=torch.long)
    if predicted_clean is None:
        raise ValueError("short trajectory supervision did not produce a clean latent prediction")
    predicted_rgb = predicted_rgb_steps[-1]
    latent_loss = torch.nn.functional.l1_loss(predicted_clean, clean_latent)
    rgb_loss = torch.nn.functional.l1_loss(predicted_rgb, target_image)
    rgb_gradient_loss, _ = multiscale_latent_hierarchy_losses(predicted_rgb, target_image, config)
    raw = (
        latent_loss * float(contract.get("cleanLatentWeight", 1.0))
        + rgb_loss * float(contract.get("decodedRgbWeight", 1.0))
        + rgb_gradient_loss * float(contract.get("decodedRgbGradientWeight", 0.5))
    )
    weighted = raw * float(contract["weight"])
    result = {
        "shortTrajectoryLossTensor": weighted,
        "shortTrajectoryWeightedLoss": weighted,
        "shortTrajectoryRawLoss": raw,
        "shortTrajectoryCleanLatentMae": latent_loss,
        "shortTrajectoryDecodedRgbMae": rgb_loss,
        "shortTrajectoryDecodedRgbGradientMae": rgb_gradient_loss,
        "shortTrajectoryStepCount": predicted_clean.new_tensor(float(steps)),
    }
    path_consistency = path_short_trajectory_consistency_loss(
        predicted_rgb_steps,
        target_image,
        conditions,
        config,
    )
    if path_consistency is not None:
        result["shortTrajectoryLossTensor"] = (
            result["shortTrajectoryLossTensor"]
            + path_consistency["pathShortTrajectoryConsistencyLossTensor"]
        )
        result["shortTrajectoryWeightedLoss"] = result["shortTrajectoryLossTensor"]
        result.update(path_consistency)
    coverage_boundary = path_coverage_boundary_short_trajectory_loss(
        predicted_rgb_steps,
        target_image,
        conditions,
        config,
    )
    if coverage_boundary is not None:
        result["shortTrajectoryLossTensor"] = (
            result["shortTrajectoryLossTensor"]
            + coverage_boundary["pathCoverageBoundaryShortTrajectoryLossTensor"]
        )
        result["shortTrajectoryWeightedLoss"] = result["shortTrajectoryLossTensor"]
        result.update(coverage_boundary)
    return result


def path_short_trajectory_consistency_loss(predicted_rgb_steps, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathShortTrajectoryConsistency", {})
    if contract.get("enabled") is not True:
        return None
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path short-trajectory consistency requires terrain_path_ground")
    if len(predicted_rgb_steps) < 2:
        raise ValueError("path short-trajectory consistency requires at least two RGB predictions")

    path_target_losses = [
        path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config)
        for predicted_rgb in predicted_rgb_steps
    ]
    forbidden_target_losses = [
        path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)
        for predicted_rgb in predicted_rgb_steps
    ]
    path_step_consistency = [
        masked_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
            "terrain_path_ground",
        )
        for index in range(1, len(predicted_rgb_steps))
    ]
    forbidden_step_consistency = [
        forbidden_boundary_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
        )
        for index in range(1, len(predicted_rgb_steps))
    ]
    path_target = torch.stack(path_target_losses).mean()
    forbidden_target = torch.stack(forbidden_target_losses).mean()
    path_temporal = torch.stack(path_step_consistency).mean()
    forbidden_temporal = torch.stack(forbidden_step_consistency).mean()
    raw = path_target + forbidden_target + path_temporal + forbidden_temporal
    weighted = raw * float(contract["weight"])
    return {
        "pathShortTrajectoryConsistencyLossTensor": weighted,
        "pathShortTrajectoryConsistencyWeightedLoss": weighted,
        "pathShortTrajectoryConsistencyRawLoss": raw,
        "pathShortTrajectoryTargetInteriorRgbMae": path_target,
        "pathShortTrajectoryTargetForbiddenBoundaryRgbMae": forbidden_target,
        "pathShortTrajectoryStepInteriorConsistencyMae": path_temporal,
        "pathShortTrajectoryStepForbiddenBoundaryConsistencyMae": forbidden_temporal,
    }


def path_coverage_boundary_short_trajectory_loss(predicted_rgb_steps, target_rgb, conditions, config):
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    activation_mass_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    coverage_drift_contract = config.get("training", {}).get("shortTrajectoryCoverageDrift", {})
    if not any(contract.get("enabled") is True for contract in (
        coverage_contract,
        boundary_contract,
        activation_mass_contract,
        coverage_drift_contract,
    )):
        return None
    reference = predicted_rgb_steps[0]
    coverage = reference.new_zeros(())
    boundary = reference.new_zeros(())
    activation_mass = reference.new_zeros(())
    coverage_drift = reference.new_zeros(())
    if coverage_contract.get("enabled") is True:
        coverage = torch.stack([
            path_coverage_calibration_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if boundary_contract.get("enabled") is True:
        boundary = torch.stack([
            authorized_boundary_topology_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if activation_mass_contract.get("enabled") is True:
        activation_mass = torch.stack([
            path_activation_mass_calibration_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if coverage_drift_contract.get("enabled") is True:
        coverage_drift = short_trajectory_coverage_drift_loss(
            predicted_rgb_steps,
            target_rgb,
            conditions,
            config,
        )
    weighted = reference.new_zeros(())
    if coverage_contract.get("enabled") is True:
        weighted = weighted + coverage * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        weighted = weighted + boundary * float(boundary_contract["weight"])
    if activation_mass_contract.get("enabled") is True:
        weighted = weighted + activation_mass * float(activation_mass_contract["weight"])
    if coverage_drift_contract.get("enabled") is True:
        weighted = weighted + coverage_drift * float(coverage_drift_contract["weight"])
    return {
        "pathCoverageBoundaryShortTrajectoryLossTensor": weighted,
        "pathCoverageBoundaryShortTrajectoryWeightedLoss": weighted,
        "pathCoverageShortTrajectoryRawLoss": coverage,
        "authorizedBoundaryShortTrajectoryRawLoss": boundary,
        "pathActivationMassShortTrajectoryRawLoss": activation_mass,
        "shortTrajectoryCoverageDriftRawLoss": coverage_drift,
    }


def evaluate_velocity_prediction(model, loader, diffusion, latent_normalization, device, seed, timesteps, config):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {}
    count = 0
    with torch.no_grad():
        for batch_index, batch in enumerate(loader):
            image = batch["image"].to(device)
            conditions = batch["conditions"].to(device)
            latent = model.autoencoder.encode(image)
            latent = normalize_latent(latent, latent_normalization)
            for timestep_value in timesteps:
                timestep = torch.full((image.shape[0],), int(timestep_value), device=device, dtype=torch.long)
                generator = torch.Generator(device=device).manual_seed(seed + batch_index * 10007 + int(timestep_value))
                noise = torch.randn(latent.shape, device=device, dtype=latent.dtype, generator=generator)
                noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
                target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
                loss_metrics = predict_and_measure(
                    model,
                    noisy_latent,
                    target_velocity,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    conditions,
                    config,
                    image,
                    latent_normalization,
                )
                for key, value in loss_metrics.items():
                    if key.endswith("Tensor") or key == "compositeLoss":
                        continue
                    totals[key] = totals.get(key, 0.0) + float(value.detach())
                count += 1
    if was_training:
        model.denoiser.train()
    if count == 0:
        raise ValueError("conditional denoiser evaluation loader produced no batches")
    return {
        **{key: value / count for key, value in totals.items()},
        "fixedTimesteps": [int(value) for value in timesteps],
    }


def predict_and_measure(model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars, conditions, config, target_image=None, latent_normalization=None):
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    if is_v5_or_later(config):
        stage4_alignment_readout = None
        stage4_object_alignment = None
        if is_v9_stage4_object_semantic_decoded_alignment(config):
            predicted_velocity, stage4_object_alignment = model.predict_velocity_with_stage4_object_alignment(
                noisy_latent, timesteps, conditions
            )
        elif is_v8_stage4_decoded_alignment(config):
            predicted_velocity, stage4_alignment_readout = model.predict_velocity_with_stage4_alignment(
                noisy_latent, timesteps, conditions
            )
        else:
            predicted_velocity = model.predict_velocity(noisy_latent, timesteps, conditions)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        if is_v6_or_later(config):
            if target_image is None or latent_normalization is None:
                raise ValueError("V6 decoded RGB supervision requires target image and latent normalization")
            predicted_rgb = model.autoencoder.decode(denormalize_latent(predicted_clean, latent_normalization))
            if is_v9_stage4_object_semantic_decoded_alignment(config):
                return composite_denoiser_losses_v9_stage4(
                    predicted_velocity,
                    target_velocity,
                    predicted_clean,
                    clean_latent,
                    predicted_conditions,
                    target_conditions,
                    predicted_rgb,
                    target_image,
                    conditions,
                    stage4_object_alignment,
                    config,
                )
            if is_v8_stage4_decoded_alignment(config):
                return composite_denoiser_losses_v8_stage4(
                    predicted_velocity,
                    target_velocity,
                    predicted_clean,
                    clean_latent,
                    predicted_conditions,
                    target_conditions,
                    predicted_rgb,
                    target_image,
                    conditions,
                    stage4_alignment_readout,
                    config,
                )
            return composite_denoiser_losses_v6(
                predicted_velocity,
                target_velocity,
                predicted_clean,
                clean_latent,
                predicted_conditions,
                target_conditions,
                predicted_rgb,
                target_image,
                conditions,
                config,
            )
        return composite_denoiser_losses_v5(
            predicted_velocity,
            target_velocity,
            predicted_clean,
            clean_latent,
            predicted_conditions,
            target_conditions,
            config,
        )
    predicted_velocity, predicted_conditions, target_conditions = model.predict_velocity_with_condition_reconstruction(
        noisy_latent,
        timesteps,
        conditions,
    )
    return composite_denoiser_losses(
        predicted_velocity,
        target_velocity,
        noisy_latent,
        clean_latent,
        timesteps,
        alpha_bars,
        predicted_conditions,
        target_conditions,
        config,
    )


def composite_denoiser_losses(predicted_velocity, target_velocity, noisy_latent, clean_latent, timesteps, alpha_bars, predicted_conditions, target_conditions, config):
    functional = torch.nn.functional
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
    velocity_loss = functional.mse_loss(predicted_velocity, target_velocity)
    clean_loss = functional.l1_loss(predicted_clean, clean_latent)
    gradient_loss = latent_gradient_mae(predicted_clean, clean_latent)
    discrete_indices, continuous_indices = condition_type_indices(config)
    discrete_condition_loss = functional.binary_cross_entropy(
        predicted_conditions[:, discrete_indices],
        target_conditions[:, discrete_indices],
    )
    continuous_condition_loss = functional.l1_loss(
        predicted_conditions[:, continuous_indices],
        target_conditions[:, continuous_indices],
    )
    weights = config["training"]["denoiserLossWeights"]
    composite_loss = (
        velocity_loss * float(weights["velocity"])
        + clean_loss * float(weights["cleanLatent"])
        + gradient_loss * float(weights["cleanLatentGradient"])
        + discrete_condition_loss * float(weights["discreteConditionReconstruction"])
        + continuous_condition_loss * float(weights["continuousConditionReconstruction"])
    )
    checkpoint_weights = config["training"]["bestCheckpointMetricWeights"]
    checkpoint_score = (
        velocity_loss * float(checkpoint_weights["velocityPredictionMse"])
        + clean_loss * float(checkpoint_weights["cleanLatentMae"])
        + gradient_loss * float(checkpoint_weights["cleanLatentGradientMae"])
        + discrete_condition_loss * float(checkpoint_weights["discreteConditionReconstructionBce"])
        + continuous_condition_loss * float(checkpoint_weights["continuousConditionReconstructionMae"])
    )
    return {
        "compositeLossTensor": composite_loss,
        "compositeLoss": composite_loss,
        "velocityPredictionMse": velocity_loss,
        "cleanLatentMae": clean_loss,
        "cleanLatentGradientMae": gradient_loss,
        "discreteConditionReconstructionBce": discrete_condition_loss,
        "continuousConditionReconstructionMae": continuous_condition_loss,
        "compositeConditionQualityScore": checkpoint_score,
    }


def composite_denoiser_losses_v5(predicted_velocity, target_velocity, predicted_clean, clean_latent, predicted_conditions, target_conditions, config):
    functional = torch.nn.functional
    velocity_loss = functional.mse_loss(predicted_velocity, target_velocity)
    clean_loss = functional.l1_loss(predicted_clean, clean_latent)
    gradient_loss, laplacian_loss = multiscale_latent_hierarchy_losses(predicted_clean, clean_latent, config)
    quiet_region_loss = quiet_region_excess_loss(predicted_clean, clean_latent, config)
    discrete_indices, continuous_indices = condition_type_indices(config)
    discrete_condition_loss = balanced_binary_condition_loss(
        predicted_conditions[:, discrete_indices],
        target_conditions[:, discrete_indices],
    )
    continuous_condition_loss = functional.l1_loss(
        predicted_conditions[:, continuous_indices],
        target_conditions[:, continuous_indices],
    )
    values = {
        "velocityPredictionMse": velocity_loss,
        "cleanLatentMae": clean_loss,
        "multiscaleLatentGradientMae": gradient_loss,
        "multiscaleLatentLaplacianMae": laplacian_loss,
        "quietRegionExcess": quiet_region_loss,
        "discreteConditionOutputBindingBce": discrete_condition_loss,
        "continuousConditionOutputBindingMae": continuous_condition_loss,
    }
    training_key_map = {
        "velocity": "velocityPredictionMse",
        "cleanLatent": "cleanLatentMae",
        "multiscaleLatentGradient": "multiscaleLatentGradientMae",
        "multiscaleLatentLaplacian": "multiscaleLatentLaplacianMae",
        "quietRegionExcess": "quietRegionExcess",
        "discreteConditionOutputBinding": "discreteConditionOutputBindingBce",
        "continuousConditionOutputBinding": "continuousConditionOutputBindingMae",
    }
    composite_loss = sum(
        values[training_key_map[key]] * float(weight)
        for key, weight in config["training"]["denoiserLossWeights"].items()
        if key in training_key_map
    )
    checkpoint_score = sum(
        values[key] * float(weight)
        for key, weight in config["training"]["bestCheckpointMetricWeights"].items()
        if key in values
    )
    return {
        "compositeLossTensor": composite_loss,
        "compositeLoss": composite_loss,
        **values,
        "compositeConditionQualityScore": checkpoint_score,
    }


def composite_denoiser_losses_v6(predicted_velocity, target_velocity, predicted_clean, clean_latent, predicted_conditions, target_conditions, predicted_rgb, target_rgb, full_conditions, config):
    base = composite_denoiser_losses_v5(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean_latent,
        predicted_conditions,
        target_conditions,
        config,
    )
    rgb_mae = torch.nn.functional.l1_loss(predicted_rgb, target_rgb)
    rgb_gradient, rgb_laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
    rgb_quiet = quiet_region_excess_loss(predicted_rgb, target_rgb, config)
    sparse_region = sparse_region_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    sparse_contrast = sparse_region_contrast_loss(predicted_rgb, target_rgb, full_conditions, config)
    spatial_grid = spatial_grid_rgb_loss(predicted_rgb, target_rgb)
    path_boundary = path_boundary_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    object_semantic = object_semantic_rgb_losses(predicted_rgb, target_rgb, full_conditions, config)
    path_interior = path_interior_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_forbidden_boundary = path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_coverage_calibration = path_coverage_calibration_loss(predicted_rgb, target_rgb, full_conditions, config)
    authorized_boundary_topology = authorized_boundary_topology_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_activation_mass_calibration = path_activation_mass_calibration_loss(
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    stage4_required_boundary_contact = required_boundary_contact_loss(
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    stage4_failure_diagnostics = stage4_failure_diagnostic_metrics(
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    values = {
        key: value
        for key, value in base.items()
        if key not in {"compositeLossTensor", "compositeLoss", "compositeConditionQualityScore"}
    }
    values.update({
        "decodedRgbMae": rgb_mae,
        "decodedRgbGradientMae": rgb_gradient,
        "decodedRgbLaplacianMae": rgb_laplacian,
        "decodedRgbQuietRegionExcess": rgb_quiet,
        "sparseRegionDecodedRgbMae": sparse_region,
        "sparseRegionContrastMae": sparse_contrast,
        "spatialGridRgbMae": spatial_grid,
        "pathBoundaryRgbMae": path_boundary,
        **object_semantic,
        "pathInteriorRgbMae": path_interior,
        "pathForbiddenBoundaryRgbMae": path_forbidden_boundary,
        "pathCoverageCalibrationLoss": path_coverage_calibration,
        "authorizedBoundaryTopologyLoss": authorized_boundary_topology,
        "pathActivationMassCalibrationLoss": path_activation_mass_calibration,
        "stage4RequiredBoundaryContactLoss": stage4_required_boundary_contact,
        **stage4_failure_diagnostics,
        "predictedRgbTensor": predicted_rgb,
    })
    key_map = {
        "velocity": "velocityPredictionMse",
        "cleanLatent": "cleanLatentMae",
        "multiscaleLatentGradient": "multiscaleLatentGradientMae",
        "multiscaleLatentLaplacian": "multiscaleLatentLaplacianMae",
        "quietRegionExcess": "quietRegionExcess",
        "discreteConditionOutputBinding": "discreteConditionOutputBindingBce",
        "continuousConditionOutputBinding": "continuousConditionOutputBindingMae",
        "decodedRgb": "decodedRgbMae",
        "decodedRgbGradient": "decodedRgbGradientMae",
        "decodedRgbLaplacian": "decodedRgbLaplacianMae",
        "decodedRgbQuietRegionExcess": "decodedRgbQuietRegionExcess",
        "sparseRegionDecodedRgb": "sparseRegionDecodedRgbMae",
        "sparseRegionContrast": "sparseRegionContrastMae",
        "spatialGridRgb": "spatialGridRgbMae",
        "pathBoundaryRgb": "pathBoundaryRgbMae",
        "objectSemanticRgb": "objectSemanticRgbMae",
        "pathInteriorRgb": "pathInteriorRgbMae",
        "pathForbiddenBoundaryRgb": "pathForbiddenBoundaryRgbMae",
    }
    composite = sum(
        values[key_map[key]] * float(weight)
        for key, weight in config["training"]["denoiserLossWeights"].items()
        if key in key_map
    )
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    activation_mass_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    required_contact_contract = config.get("training", {}).get("stage4RequiredBoundaryContact", {})
    if coverage_contract.get("enabled") is True:
        composite = composite + path_coverage_calibration * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        composite = composite + authorized_boundary_topology * float(boundary_contract["weight"])
    if activation_mass_contract.get("enabled") is True:
        composite = composite + path_activation_mass_calibration * float(activation_mass_contract["weight"])
    if required_contact_contract.get("enabled") is True:
        composite = composite + stage4_required_boundary_contact * float(required_contact_contract["weight"])
    checkpoint = sum(
        values[key] * float(weight)
        for key, weight in config["training"]["bestCheckpointMetricWeights"].items()
        if key in values
    )
    return {
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        **values,
        "compositeConditionQualityScore": checkpoint,
    }


def composite_denoiser_losses_v8_stage4(
    predicted_velocity,
    target_velocity,
    predicted_clean,
    clean_latent,
    predicted_conditions,
    target_conditions,
    predicted_rgb,
    target_rgb,
    full_conditions,
    alignment_readout,
    config,
):
    base = composite_denoiser_losses_v6(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean_latent,
        predicted_conditions,
        target_conditions,
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    targets, channel_order = stage4_decoded_alignment_targets(
        full_conditions,
        alignment_readout.shape[-2:],
        config,
    )
    channel_losses = [
        balanced_binary_condition_loss(
            alignment_readout[:, index:index + 1],
            targets[:, index:index + 1],
        )
        for index in range(len(channel_order))
    ]
    shared_readout_loss = torch.stack(channel_losses).mean()
    reused_weight = float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"])
    checkpoint_weight = float(
        config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"]
    )
    composite = base["compositeLossTensor"] + shared_readout_loss * reused_weight
    checkpoint = base["compositeConditionQualityScore"] + shared_readout_loss * checkpoint_weight
    metrics = {
        "stage4DecodedAlignmentSharedReadoutBce": shared_readout_loss,
        "stage4DecodedAlignmentReusedDiscreteConditionWeight": alignment_readout.new_tensor(reused_weight),
    }
    for name, value in zip(channel_order, channel_losses):
        metrics[f"stage4DecodedAlignment{upper_camel(name)}Bce"] = value
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


def composite_denoiser_losses_v9_stage4(
    predicted_velocity,
    target_velocity,
    predicted_clean,
    clean_latent,
    predicted_conditions,
    target_conditions,
    predicted_rgb,
    target_rgb,
    full_conditions,
    alignment,
    config,
):
    if not isinstance(alignment, dict):
        raise ValueError("V9 Stage 4 object alignment outputs are missing")
    object_order = list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS)
    object_up1 = alignment.get("objectReadoutUp1")
    object_up0 = alignment.get("objectReadoutUp0")
    route_readout = alignment.get("routeReadout")
    features_up1 = tuple(alignment.get("objectProjectionFeaturesUp1", ()))
    features_up0 = tuple(alignment.get("objectProjectionFeaturesUp0", ()))
    if (
        object_up1 is None or object_up0 is None or route_readout is None
        or object_up1.shape[1] != 4 or object_up0.shape[1] != 4
        or route_readout.shape[1] != 2
        or len(features_up1) != 4 or len(features_up0) != 4
    ):
        raise ValueError("V9 Stage 4 object or route readout shape is invalid")

    base = composite_denoiser_losses_v6(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean_latent,
        predicted_conditions,
        target_conditions,
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    target_up1 = stage4_v9_object_targets(full_conditions, object_up1.shape[-2:], config)
    target_up0 = stage4_v9_object_targets(full_conditions, object_up0.shape[-2:], config)
    route_targets, _ = stage4_decoded_alignment_targets(
        full_conditions,
        route_readout.shape[-2:],
        config,
    )
    route_targets = route_targets[:, :2]
    object_losses = []
    object_gradients = []
    metrics = {}
    reused_weight = float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"])
    prefix_by_channel = {
        "object_footprints": "ObjectFootprints",
        "object_tree": "ObjectTree",
        "object_rock": "ObjectRock",
        "object_vegetation": "ObjectVegetation",
    }
    for index, name in enumerate(object_order):
        up1_loss = balanced_binary_condition_loss(
            object_up1[:, index:index + 1],
            target_up1[:, index:index + 1],
        )
        up0_loss = balanced_binary_condition_loss(
            object_up0[:, index:index + 1],
            target_up0[:, index:index + 1],
        )
        independent_loss = (up1_loss + up0_loss) * 0.5
        object_losses.append(independent_loss)
        gradient = predicted_rgb.new_zeros(())
        if torch.is_grad_enabled() and independent_loss.requires_grad:
            contributions = torch.autograd.grad(
                independent_loss * reused_weight,
                (features_up1[index], features_up0[index]),
                retain_graph=True,
                create_graph=False,
                allow_unused=True,
            )
            finite_contributions = [
                value.abs().mean().detach()
                for value in contributions
                if value is not None
            ]
            if finite_contributions:
                gradient = torch.stack(finite_contributions).sum()
        object_gradients.append(gradient)
        prefix = prefix_by_channel[name]
        metrics.update({
            f"stage4V9{prefix}Up1ReadoutBce": up1_loss,
            f"stage4V9{prefix}Up0ReadoutBce": up0_loss,
            f"stage4Diagnostic{prefix}IndependentLoss": independent_loss.detach(),
            f"stage4Diagnostic{prefix}GradientContribution": gradient,
            f"stage4Diagnostic{prefix}DecodedResponsePrototypeMae": masked_rgb_prototype_mae(
                predicted_rgb,
                target_rgb,
                full_conditions,
                config,
                name,
            ).detach(),
        })
    gradient_stack = torch.stack(object_gradients)
    metrics["stage4DiagnosticObjectGradientAvailable"] = (
        torch.isfinite(gradient_stack) & (gradient_stack > 0.0)
    ).all().to(predicted_rgb.dtype)

    route_channel_losses = [
        balanced_binary_condition_loss(
            route_readout[:, index:index + 1],
            route_targets[:, index:index + 1],
        )
        for index in range(2)
    ]
    route_loss = torch.stack(route_channel_losses).mean()
    independent_object_loss = torch.stack(object_losses).mean()
    object_and_route_loss = torch.stack((*object_losses, route_loss)).mean()
    checkpoint_weight = float(
        config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"]
    )
    composite = base["compositeLossTensor"] + object_and_route_loss * reused_weight
    checkpoint = base["compositeConditionQualityScore"] + object_and_route_loss * checkpoint_weight
    metrics.update({
        "stage4V9IndependentObjectSemanticReadoutBce": independent_object_loss,
        "stage4V9PreservedRouteTopologyReadoutBce": route_loss,
        "stage4V9ReusedDiscreteConditionWeight": predicted_rgb.new_tensor(reused_weight),
    })
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


def stage4_v9_object_targets(full_conditions, output_size, config):
    order = list(config["conditionChannelOrder"])
    resized = torch.nn.functional.interpolate(full_conditions, size=output_size, mode="nearest")
    return torch.cat([
        resized[:, order.index(name):order.index(name) + 1].clamp(0.0, 1.0)
        for name in V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS
    ], dim=1)


def stage4_decoded_alignment_targets(full_conditions, output_size, config):
    order = list(config["conditionChannelOrder"])
    channel_names = [
        "terrain_path_ground",
        "route_required_boundary",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    ]
    resized = torch.nn.functional.interpolate(full_conditions, size=output_size, mode="nearest")
    path_index = order.index("terrain_path_ground")
    path = resized[:, path_index:path_index + 1].clamp(0.0, 1.0)
    required_boundary = torch.zeros_like(path)
    topology = config.get("training", {}).get("authorizedBoundaryTopology", {})
    required_sides = list(topology.get("requiredBoundarySides", []))
    if not required_sides or any(side not in {"north", "south", "west", "east"} for side in required_sides):
        raise ValueError("V8 Stage 4 decoded alignment requires valid world-fact boundary sides")
    band = max(1, round(min(path.shape[-2:]) * float(topology.get("boundaryBandRatio", 0.04))))
    for side in required_sides:
        if side == "north":
            required_boundary[:, :, :band, :] = path[:, :, :band, :]
        elif side == "south":
            required_boundary[:, :, -band:, :] = path[:, :, -band:, :]
        elif side == "west":
            required_boundary[:, :, :, :band] = path[:, :, :, :band]
        else:
            required_boundary[:, :, :, -band:] = path[:, :, :, -band:]
    target_channels = [path, required_boundary]
    for name in channel_names[2:]:
        index = order.index(name)
        target_channels.append(resized[:, index:index + 1].clamp(0.0, 1.0))
    return torch.cat(target_channels, dim=1), channel_names


def sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    losses = []
    for name in config["training"].get("sparseRgbConditionChannels", []):
        mask = conditions[:, order.index(name):order.index(name) + 1]
        mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
        denominator = mask.sum() * predicted_rgb.shape[1]
        if float(denominator.detach()) > 0.0:
            losses.append(((predicted_rgb - target_rgb).abs() * mask).sum() / denominator)
    if not losses:
        return predicted_rgb.new_zeros(())
    return torch.stack(losses).mean()


def masked_condition_rgb_loss(predicted_rgb, target_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
    denominator = mask.sum() * predicted_rgb.shape[1]
    if float(denominator.detach()) <= 0.0:
        return predicted_rgb.new_zeros(())
    return ((predicted_rgb - target_rgb).abs() * mask).sum() / denominator


def object_semantic_rgb_losses(predicted_rgb, target_rgb, conditions, config):
    training = config.get("training", {})
    channels = list(training.get("semanticRgbConditionChannels", []))
    if not channels:
        zero = predicted_rgb.new_zeros(())
        return {
            "objectFootprintsRgbMae": zero,
            "objectTreeRgbMae": zero,
            "objectRockRgbMae": zero,
            "objectVegetationRgbMae": zero,
            "objectSemanticRgbMae": zero,
        }
    weights = training.get("objectSemanticChannelWeights", {})
    losses = {
        name: masked_condition_rgb_loss(predicted_rgb, target_rgb, conditions, config, name)
        for name in channels
    }
    denominator = sum(float(weights.get(name, 1.0)) for name in channels)
    aggregate = sum(losses[name] * float(weights.get(name, 1.0)) for name in channels) / denominator
    zero = predicted_rgb.new_zeros(())
    return {
        "objectFootprintsRgbMae": losses.get("object_footprints", zero),
        "objectTreeRgbMae": losses.get("object_tree", zero),
        "objectRockRgbMae": losses.get("object_rock", zero),
        "objectVegetationRgbMae": losses.get("object_vegetation", zero),
        "objectSemanticRgbMae": aggregate,
    }


def stage4_failure_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("stage4FailureDiagnostics", {})
    if contract.get("enabled") is not True:
        return {}
    if is_v9_stage4_object_semantic_decoded_alignment(config):
        validate_v9_stage4_diagnostic_manifest_support_contract(config)
        return route_late_regression_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config)
    validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    return {
        **object_semantic_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config),
        **route_late_regression_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config),
    }


def validate_v9_stage4_diagnostic_manifest_support_contract(config):
    contract = config.get("training", {}).get("stage4FailureDiagnostics", {})
    object_contract = contract.get("objectSemanticDiagnostics", {})
    route_contract = contract.get("routeLateRegressionDiagnostics", {})
    if (
        contract.get("enabled") is not True
        or contract.get("status") != "v9_diagnostic_manifest_registry_supported_inactive"
        or object_contract.get("channels") != list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS)
        or object_contract.get("measurements") != list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_MEASUREMENTS)
        or object_contract.get("gradientTarget") != "matching_v9_object_projection_features_up1_and_up0"
        or object_contract.get("changesTrainingWeightsNow") is not False
        or route_contract.get("measurements") != list(V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS)
        or route_contract.get("conditionChannel") != "terrain_path_ground"
        or route_contract.get("requiredBoundarySidesSource") != "authorizedBoundaryTopology.requiredBoundarySides"
        or route_contract.get("preserveExistingPathLossWeights") is not True
    ):
        raise ValueError("V9 Stage 4 diagnostic Manifest support contract is invalid")
    for key in (
        "reviewThresholdsModified", "failedPreviewPixelsUsedAsTrainingTargets",
        "executionValuesSelected", "trainingConfigApplied", "checkpointFileReadAuthorized",
        "gpuUseAuthorized", "trainingAuthorized",
    ):
        if contract.get(key) is not False:
            raise ValueError(f"V9 Stage 4 diagnostic execution boundary is invalid: {key}")
    return {
        "status": "v9_stage4_diagnostic_manifest_support_contract_valid_inactive",
        "exactFields": list(V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
    }


def object_semantic_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config):
    training = config.get("training", {})
    weights = training.get("objectSemanticChannelWeights", {})
    aggregate_weight = float(training.get("denoiserLossWeights", {}).get("objectSemanticRgb", 0.0))
    weight_denominator = sum(float(weights[name]) for name in V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS)
    if aggregate_weight <= 0.0 or weight_denominator <= 0.0:
        raise ValueError("V7 R5 Stage 4 object diagnostic weight basis is invalid")
    prefix_by_channel = {
        "object_footprints": ("ObjectFootprints", "objectFootprints"),
        "object_tree": ("ObjectTree", "objectTree"),
        "object_rock": ("ObjectRock", "objectRock"),
        "object_vegetation": ("ObjectVegetation", "objectVegetation"),
    }
    result = {}
    gradient_available = torch.is_grad_enabled() and predicted_rgb.requires_grad
    for channel in V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS:
        formal_prefix, legacy_prefix = prefix_by_channel[channel]
        loss = masked_condition_rgb_loss(predicted_rgb, target_rgb, conditions, config, channel)
        independent_loss = loss.detach()
        prototype_mae = masked_rgb_prototype_mae(
            predicted_rgb,
            target_rgb,
            conditions,
            config,
            channel,
        ).detach()
        gradient = predicted_rgb.new_zeros(())
        if gradient_available and loss.requires_grad:
            contribution_loss = (
                loss
                * aggregate_weight
                * float(weights[channel])
                / weight_denominator
            )
            contribution = torch.autograd.grad(
                contribution_loss,
                predicted_rgb,
                retain_graph=True,
                create_graph=False,
                allow_unused=True,
            )[0]
            if contribution is not None:
                gradient = contribution.abs().mean().detach()
        formal_values = {
            f"stage4Diagnostic{formal_prefix}IndependentLoss": independent_loss,
            f"stage4Diagnostic{formal_prefix}GradientContribution": gradient,
            f"stage4Diagnostic{formal_prefix}DecodedResponsePrototypeMae": prototype_mae,
        }
        result.update(formal_values)
        result[f"stage4Diagnostic{legacy_prefix}IndependentLoss"] = independent_loss
        result[f"stage4Diagnostic{legacy_prefix}GradientContribution"] = gradient
        result[f"stage4Diagnostic{legacy_prefix}DecodedResponsePrototypeMae"] = prototype_mae
    result["stage4DiagnosticObjectGradientAvailable"] = predicted_rgb.new_tensor(
        1.0 if gradient_available else 0.0
    )
    return result


def masked_rgb_prototype_mae(predicted_rgb, target_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
    denominator = mask.sum(dim=(2, 3), keepdim=True).clamp_min(1.0)
    predicted_prototype = (predicted_rgb * mask).sum(dim=(2, 3), keepdim=True) / denominator
    target_prototype = (target_rgb * mask).sum(dim=(2, 3), keepdim=True) / denominator
    present = (mask.sum(dim=(2, 3), keepdim=True) > 0.0).to(predicted_rgb.dtype)
    return ((predicted_prototype - target_prototype).abs().mean(dim=1, keepdim=True) * present).sum() / present.sum().clamp_min(1.0)


def route_late_regression_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config):
    training = config.get("training", {})
    diagnostic = training["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"]
    activation_contract = training.get("pathActivationMassCalibration", {})
    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, activation_contract)
    temperature = float(activation_contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature) * support
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature) * support
    epsilon = max(float(activation_contract.get("epsilon", 1e-6)), 1e-8)
    predicted_mass = predicted_activation.sum(dim=(2, 3))
    target_mass = target_activation.sum(dim=(2, 3)).clamp_min(epsilon)
    coverage_ratio = (predicted_mass / target_mass).mean()
    predicted_distribution = predicted_activation / predicted_mass.view(-1, 1, 1, 1).clamp_min(epsilon)
    target_distribution = target_activation / target_mass.view(-1, 1, 1, 1)
    grid_size = int(diagnostic.get("spatialGridSize", 4))
    if grid_size < 2 or grid_size > 16:
        raise ValueError("V7 R5 Stage 4 route diagnostic grid size is invalid")
    predicted_grid = torch.nn.functional.adaptive_avg_pool2d(predicted_distribution, (grid_size, grid_size))
    target_grid = torch.nn.functional.adaptive_avg_pool2d(target_distribution, (grid_size, grid_size))
    spatial_distribution = (predicted_grid - target_grid).abs().sum(dim=(1, 2, 3)).mean()
    centroid_drift = activation_centroid_drift(predicted_activation, target_activation, epsilon)
    required_sides = list(training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides", []))
    if not required_sides:
        raise ValueError("V7 R5 Stage 4 route diagnostics require at least one authorized boundary side")
    boundary_contact = required_boundary_contact_minimum(
        predicted_activation,
        path_mask,
        required_sides,
        float(training.get("authorizedBoundaryTopology", {}).get("boundaryBandRatio", training.get("pathBoundaryBandRatio", 0.04))),
    )
    return {
        "stage4DiagnosticRouteActivationMassRatio": coverage_ratio.detach(),
        "stage4DiagnosticRouteSpatialDistributionL1": spatial_distribution.detach(),
        "stage4DiagnosticRouteCentroidDrift": centroid_drift.detach(),
        "stage4DiagnosticRouteRequiredBoundaryContactMinimum": boundary_contact.detach(),
    }


def activation_centroid_drift(predicted_activation, target_activation, epsilon=1e-6):
    height, width = predicted_activation.shape[-2:]
    y = torch.linspace(0.0, 1.0, height, device=predicted_activation.device, dtype=predicted_activation.dtype).view(1, 1, height, 1)
    x = torch.linspace(0.0, 1.0, width, device=predicted_activation.device, dtype=predicted_activation.dtype).view(1, 1, 1, width)
    predicted_mass = predicted_activation.sum(dim=(2, 3), keepdim=True).clamp_min(epsilon)
    target_mass = target_activation.sum(dim=(2, 3), keepdim=True).clamp_min(epsilon)
    predicted_x = (predicted_activation * x).sum(dim=(2, 3), keepdim=True) / predicted_mass
    predicted_y = (predicted_activation * y).sum(dim=(2, 3), keepdim=True) / predicted_mass
    target_x = (target_activation * x).sum(dim=(2, 3), keepdim=True) / target_mass
    target_y = (target_activation * y).sum(dim=(2, 3), keepdim=True) / target_mass
    return torch.sqrt((predicted_x - target_x).square() + (predicted_y - target_y).square()).mean()


def required_boundary_contact_minimum(predicted_activation, path_mask, required_sides, band_ratio):
    band = max(1, round(min(predicted_activation.shape[-2:]) * float(band_ratio)))
    scores = []
    for side in required_sides:
        side_mask = torch.zeros_like(path_mask)
        if side == "north":
            side_mask[:, :, :band, :] = 1.0
        elif side == "south":
            side_mask[:, :, -band:, :] = 1.0
        elif side == "west":
            side_mask[:, :, :, :band] = 1.0
        elif side == "east":
            side_mask[:, :, :, -band:] = 1.0
        else:
            raise ValueError(f"V7 R5 Stage 4 route diagnostic boundary side is invalid: {side}")
        required_support = side_mask * path_mask
        denominator = required_support.sum(dim=(2, 3)).clamp_min(1.0)
        scores.append(((predicted_activation * required_support).sum(dim=(2, 3)) / denominator).mean())
    return torch.stack(scores).amin()


def path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    return masked_condition_rgb_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
        "terrain_path_ground",
    )


def masked_pair_rgb_l1(left_rgb, right_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=left_rgb.shape[-2:], mode="nearest")
    denominator = (mask.sum() * left_rgb.shape[1]).clamp_min(1.0)
    return ((left_rgb - right_rgb).abs() * mask).sum() / denominator


def evaluate_deterministic_rollout_rgb_quality(model, dataset, diffusion, latent_normalization, device, seed, config):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {"rolloutRgbMae": 0.0, "rolloutRgbGradientMae": 0.0, "rolloutRgbLaplacianMae": 0.0, "rolloutSparseRegionRgbMae": 0.0}
    count = min(len(dataset), int(config["training"].get("checkpointRolloutSampleCount", 1)))
    if count == 0:
        raise ValueError("V6 rollout checkpoint validation has no validation samples")
    with torch.no_grad():
        for index in range(count):
            row = dataset[index]
            target_rgb = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            latent_shape = model.autoencoder.encode(target_rgb).shape
            generator = torch.Generator(device=device).manual_seed(seed + index)
            latent = torch.randn(latent_shape, device=device, generator=generator)
            steps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)
            for step_index, timestep in enumerate(steps):
                timestep_batch = torch.full((1,), int(timestep.item()), device=device, dtype=torch.long)
                velocity = model.predict_velocity(latent, timestep_batch, conditions)
                previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
                latent = deterministic_velocity_step(latent, velocity, int(timestep.item()), previous, diffusion["alphasCumulative"])
            predicted_rgb = model.autoencoder.decode(denormalize_latent(latent, latent_normalization))
            gradient, laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
            sparse = sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config)
            totals["rolloutRgbMae"] += float(torch.nn.functional.l1_loss(predicted_rgb, target_rgb))
            totals["rolloutRgbGradientMae"] += float(gradient)
            totals["rolloutRgbLaplacianMae"] += float(laplacian)
            totals["rolloutSparseRegionRgbMae"] += float(sparse)
    if was_training:
        model.denoiser.train()
    result = {key: value / count for key, value in totals.items()}
    weights = config["training"]["rolloutCheckpointMetricWeights"]
    result["rolloutRgbQualityScore"] = sum(result[key] * float(weight) for key, weight in weights.items())
    result["rolloutSampleCount"] = count
    return result


def evaluate_deterministic_rollout_rgb_quality_v7(model, dataset, diffusion, latent_normalization, device, seed, config, preview_output_dir=None, epoch_number=None):
    was_training = model.denoiser.training
    model.denoiser.eval()
    preview_artifact = None
    totals = {
        "rolloutRgbMae": 0.0,
        "rolloutRgbGradientMae": 0.0,
        "rolloutRgbLaplacianMae": 0.0,
        "rolloutSparseRegionRgbMae": 0.0,
        "rolloutRegionContrastMae": 0.0,
        "rolloutSpatialGridRgbMae": 0.0,
        "rolloutPathBoundaryRgbMae": 0.0,
        "rolloutObjectSemanticRgbMae": 0.0,
        "rolloutPathInteriorRgbMae": 0.0,
        "rolloutPathForbiddenBoundaryRgbMae": 0.0,
    }
    sample_count = len(dataset)
    seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    if sample_count == 0:
        raise ValueError("V7 rollout checkpoint validation has no validation samples")
    trajectory_scores = []
    with torch.no_grad():
        for index in range(sample_count):
            row = dataset[index]
            target_rgb = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            latent_shape = model.autoencoder.encode(target_rgb).shape
            for seed_index in range(seed_count):
                generator = torch.Generator(device=device).manual_seed(seed + index * seed_count + seed_index)
                latent = torch.randn(latent_shape, device=device, generator=generator)
                steps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)
                for step_index, timestep in enumerate(steps):
                    timestep_batch = torch.full((1,), int(timestep.item()), device=device, dtype=torch.long)
                    velocity = model.predict_velocity(latent, timestep_batch, conditions)
                    previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
                    latent = deterministic_velocity_step(latent, velocity, int(timestep.item()), previous, diffusion["alphasCumulative"])
                predicted_rgb = model.autoencoder.decode(denormalize_latent(latent, latent_normalization)).clamp(0.0, 1.0)
                gradient, laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
                object_semantic = object_semantic_rgb_losses(predicted_rgb, target_rgb, conditions, config)
                values = {
                    "rolloutRgbMae": float(torch.nn.functional.l1_loss(predicted_rgb, target_rgb)),
                    "rolloutRgbGradientMae": float(gradient),
                    "rolloutRgbLaplacianMae": float(laplacian),
                    "rolloutSparseRegionRgbMae": float(sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutRegionContrastMae": float(sparse_region_contrast_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutSpatialGridRgbMae": float(spatial_grid_rgb_loss(predicted_rgb, target_rgb)),
                    "rolloutPathBoundaryRgbMae": float(path_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutObjectSemanticRgbMae": float(object_semantic["objectSemanticRgbMae"]),
                    "rolloutPathInteriorRgbMae": float(path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutPathForbiddenBoundaryRgbMae": float(path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                }
                for key, value in values.items():
                    totals[key] += value
                weights = config["training"]["rolloutCheckpointMetricWeights"]
                trajectory_scores.append(sum(values[key] * float(weight) for key, weight in weights.items()))
                if index == 0 and seed_index == 0 and should_save_epoch_preview(config, epoch_number):
                    preview_output_dir.mkdir(parents=True, exist_ok=True)
                    preview_path = preview_output_dir / f"epoch-{epoch_number:03d}-{row['conditionLabel']}-seed-{seed}.png"
                    save_tensor_png(predicted_rgb[0], preview_path)
                    preview_artifact = {
                        "schemaVersion": "stage4-unified-training-preview-artifact-v1",
                        "epoch": int(epoch_number),
                        "sampleId": row["sampleId"],
                        "conditionLabel": row["conditionLabel"],
                        "seed": int(seed),
                        "seedIndex": 0,
                        "sampleIndex": 0,
                        "denoiserStateSha256": state_dict_sha256(model.denoiser.state_dict()),
                        "conditionTensorSha256": tensor_sha256(conditions),
                        "rgbTensorSha256": tensor_sha256(predicted_rgb),
                        "latentNormalizationSha256": hashlib.sha256(
                            json.dumps(
                                serialize_latent_normalization(latent_normalization),
                                sort_keys=True,
                                separators=(",", ":"),
                            ).encode("utf-8")
                        ).hexdigest(),
                        "previewPath": project_path(preview_path),
                        "previewSha256": sha256_file(preview_path),
                        "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
                        "deterministicAlgorithmsEnabled": torch.are_deterministic_algorithms_enabled(),
                        "cudnnDeterministic": bool(torch.backends.cudnn.deterministic),
                        "cudnnBenchmark": bool(torch.backends.cudnn.benchmark),
                        "cublasWorkspaceConfig": os.environ.get("CUBLAS_WORKSPACE_CONFIG"),
                    }
    if was_training:
        model.denoiser.train()
    trajectory_count = sample_count * seed_count
    result = {key: value / trajectory_count for key, value in totals.items()}
    result["rolloutAverageQualityScore"] = sum(
        result[key] * float(weight)
        for key, weight in config["training"]["rolloutCheckpointMetricWeights"].items()
    )
    result["rolloutWorstTrajectoryQualityScore"] = max(trajectory_scores)
    result["rolloutRgbQualityScore"] = (
        result["rolloutAverageQualityScore"]
        + result["rolloutWorstTrajectoryQualityScore"] * float(config["training"].get("checkpointWorstTrajectoryWeight", 1.0))
    )
    result["rolloutSampleCount"] = sample_count
    result["rolloutSeedCountPerSample"] = seed_count
    result["rolloutTrajectoryCount"] = trajectory_count
    if preview_artifact is not None:
        result["previewArtifact"] = preview_artifact
    return result


def sparse_region_contrast_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    losses = []
    for name in config["training"].get("sparseRgbConditionChannels", []):
        mask = conditions[:, order.index(name):order.index(name) + 1]
        mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
        inside_count = mask.sum().clamp_min(1.0)
        outside = 1.0 - mask
        outside_count = outside.sum().clamp_min(1.0)
        predicted_contrast = (predicted_rgb * mask).sum(dim=(2, 3)) / inside_count - (predicted_rgb * outside).sum(dim=(2, 3)) / outside_count
        target_contrast = (target_rgb * mask).sum(dim=(2, 3)) / inside_count - (target_rgb * outside).sum(dim=(2, 3)) / outside_count
        losses.append(torch.nn.functional.l1_loss(predicted_contrast, target_contrast))
    if not losses:
        return predicted_rgb.new_zeros(())
    return torch.stack(losses).mean()


def spatial_grid_rgb_loss(predicted_rgb, target_rgb):
    predicted_grid = torch.nn.functional.adaptive_avg_pool2d(predicted_rgb, (6, 8))
    target_grid = torch.nn.functional.adaptive_avg_pool2d(target_rgb, (6, 8))
    return torch.nn.functional.l1_loss(predicted_grid, target_grid)


def path_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=predicted_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    mask = path_mask * boundary
    denominator = (mask.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    return ((predicted_rgb - target_rgb).abs() * mask).sum() / denominator


def path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=predicted_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    forbidden = boundary * (1.0 - path_mask.clamp(0.0, 1.0))
    denominator = (forbidden.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    return ((predicted_rgb - target_rgb).abs() * forbidden).sum() / denominator


def original_path_condition_mask(conditions, config, output_size):
    order = list(config["conditionChannelOrder"])
    if "terrain_path_ground" not in order:
        raise ValueError("terrain_path_ground condition channel is missing")
    mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    return torch.nn.functional.interpolate(mask, size=output_size, mode="nearest").clamp(0.0, 1.0)


def path_visual_activation(rgb, target_rgb, path_mask, temperature):
    denominator = path_mask.sum(dim=(2, 3), keepdim=True).clamp_min(1.0)
    prototype = (target_rgb * path_mask).sum(dim=(2, 3), keepdim=True) / denominator
    distance = (rgb - prototype).abs().mean(dim=1, keepdim=True)
    return torch.exp(-distance / max(float(temperature), 1e-4))


def path_support_corridor(path_mask, config, contract):
    ratio = float(contract.get("supportBandRatio", config.get("training", {}).get("pathBoundaryBandRatio", 0.04)))
    radius = max(1, round(min(path_mask.shape[-2:]) * ratio))
    kernel = radius * 2 + 1
    return torch.nn.functional.max_pool2d(path_mask, kernel_size=kernel, stride=1, padding=radius).clamp(0.0, 1.0)


def path_coverage_calibration_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathCoverageCalibration", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path coverage calibration requires terrain_path_ground")
    if contract.get("targetSource") != "original_condition_mask_support_only":
        raise ValueError("path coverage calibration target source is invalid")
    if contract.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("machine-review thresholds cannot be used as path coverage training targets")
    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, contract)
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    excess = torch.nn.functional.relu(predicted_activation - target_activation - float(contract.get("activationMargin", 0.0)))
    outside_support = 1.0 - support
    denominator = outside_support.sum().clamp_min(1.0)
    return (excess * outside_support).sum() / denominator


def path_activation_mass_calibration_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path activation-mass calibration requires terrain_path_ground")
    if contract.get("targetSource") != "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only":
        raise ValueError("path activation-mass calibration target source is invalid")
    if contract.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("failed preview pixels cannot be used as path activation-mass targets")
    if contract.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("machine-review thresholds cannot be used as path activation-mass targets")
    if contract.get("lossForm") != "symmetric_log_activation_mass_ratio_plus_outside_support_leakage":
        raise ValueError("path activation-mass calibration loss form is invalid")

    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, contract)
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    support_denominator = support.sum(dim=(2, 3)).clamp_min(1.0)
    predicted_mass = (predicted_activation * support).sum(dim=(2, 3)) / support_denominator
    target_mass = (target_activation * support).sum(dim=(2, 3)) / support_denominator
    epsilon = max(float(contract.get("epsilon", 1e-6)), 1e-8)
    symmetric_log_ratio = torch.abs(torch.log((predicted_mass + epsilon) / (target_mass + epsilon))).mean()

    outside_support = 1.0 - support
    excess = torch.nn.functional.relu(
        predicted_activation
        - target_activation
        - float(contract.get("activationMargin", 0.0))
    ) * outside_support
    outside_denominator = outside_support.sum(dim=(2, 3)).clamp_min(1.0)
    outside_support_leakage = (excess.sum(dim=(2, 3)) / outside_denominator).mean()
    return symmetric_log_ratio + outside_support_leakage


def short_trajectory_coverage_drift_loss(predicted_rgb_steps, target_rgb, conditions, config):
    contract = config.get("training", {}).get("shortTrajectoryCoverageDrift", {})
    if contract.get("enabled") is not True:
        return target_rgb.new_zeros(())
    if contract.get("source") != "current_training_prediction_steps_against_original_target_activation_mass_only":
        raise ValueError("short-trajectory coverage drift source is invalid")
    if contract.get("failedPreviewTrajectoryUsedAsTrainingTarget") is not False:
        raise ValueError("failed preview trajectories cannot be used as short-trajectory coverage targets")
    if len(predicted_rgb_steps) < 2:
        raise ValueError("short-trajectory coverage drift requires at least two current training predictions")

    activation_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    path_mask = original_path_condition_mask(conditions, config, target_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, activation_contract)
    temperature = float(activation_contract.get("appearanceTemperature", 0.2))
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    denominator = support.sum(dim=(2, 3)).clamp_min(1.0)
    target_mass = (target_activation * support).sum(dim=(2, 3)) / denominator
    epsilon = max(float(activation_contract.get("epsilon", 1e-6)), 1e-8)
    log_mass_ratios = []
    for predicted_rgb in predicted_rgb_steps:
        predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
        predicted_mass = (predicted_activation * support).sum(dim=(2, 3)) / denominator
        log_mass_ratios.append(torch.log((predicted_mass + epsilon) / (target_mass + epsilon)))
    adjacent_drift = [
        torch.abs(log_mass_ratios[index] - log_mass_ratios[index - 1]).mean()
        for index in range(1, len(log_mass_ratios))
    ]
    return torch.stack(adjacent_drift).mean()


def authorized_boundary_topology_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("authorized boundary topology requires terrain_path_ground")
    if contract.get("allowedSidesSource") != "original_condition_channel_boundary_contact_only":
        raise ValueError("authorized boundary topology source is invalid")
    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(contract.get("boundaryBandRatio", config.get("training", {}).get("pathBoundaryBandRatio", 0.04)))))
    side_masks = []
    for side in ("north", "south", "west", "east"):
        side_mask = torch.zeros_like(path_mask)
        if side == "north":
            side_mask[:, :, :band, :] = 1.0
        elif side == "south":
            side_mask[:, :, -band:, :] = 1.0
        elif side == "west":
            side_mask[:, :, :, :band] = 1.0
        else:
            side_mask[:, :, :, -band:] = 1.0
        side_masks.append(side_mask)
    forbidden = torch.zeros_like(path_mask)
    for side_mask in side_masks:
        authorized = (path_mask * side_mask).flatten(1).amax(dim=1).view(-1, 1, 1, 1)
        forbidden = torch.maximum(forbidden, side_mask * (1.0 - authorized))
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    excess = torch.nn.functional.relu(predicted_activation - target_activation - float(contract.get("activationMargin", 0.0)))
    denominator = forbidden.sum().clamp_min(1.0)
    return (excess * forbidden).sum() / denominator


def required_boundary_contact_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("stage4RequiredBoundaryContact", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("required-boundary contact loss requires terrain_path_ground")
    if contract.get("targetSource") != "original_owner_approved_rgb_required_boundary_activation_with_original_condition_mask_only":
        raise ValueError("required-boundary contact loss target source is invalid")
    if contract.get("requiredSidesSource") != "authorizedBoundaryTopology.requiredBoundarySides":
        raise ValueError("required-boundary contact loss side source is invalid")
    if contract.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("failed preview pixels cannot be used as required-boundary contact targets")
    if contract.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("machine-review thresholds cannot be used as required-boundary contact targets")
    if contract.get("lossForm") != "required_side_target_activation_deficit":
        raise ValueError("required-boundary contact loss form is invalid")

    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    topology = config.get("training", {}).get("authorizedBoundaryTopology", {})
    required_sides = list(topology.get("requiredBoundarySides", []))
    if not required_sides:
        raise ValueError("required-boundary contact loss requires at least one authorized side")
    band_ratio = float(contract.get("boundaryBandRatio", topology.get("boundaryBandRatio", 0.04)))
    band = max(1, round(min(predicted_rgb.shape[-2:]) * band_ratio))
    temperature = float(contract.get("appearanceTemperature", topology.get("appearanceTemperature", 0.2)))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    margin = float(contract.get("activationMargin", 0.0))
    losses = []
    for side in required_sides:
        side_mask = torch.zeros_like(path_mask)
        if side == "north":
            side_mask[:, :, :band, :] = 1.0
        elif side == "south":
            side_mask[:, :, -band:, :] = 1.0
        elif side == "west":
            side_mask[:, :, :, :band] = 1.0
        elif side == "east":
            side_mask[:, :, :, -band:] = 1.0
        else:
            raise ValueError(f"required-boundary contact side is invalid: {side}")
        required_support = side_mask * path_mask
        support_count = required_support.sum(dim=(2, 3))
        if bool((support_count <= 0.0).any().detach()):
            raise ValueError(f"required-boundary contact source mask does not contact side: {side}")
        deficit = torch.nn.functional.relu(target_activation - predicted_activation - margin)
        losses.append(
            ((deficit * required_support).sum(dim=(2, 3)) / support_count.clamp_min(1.0)).mean()
        )
    return torch.stack(losses).mean()


def forbidden_boundary_pair_rgb_l1(left_rgb, right_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=left_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(left_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    forbidden = boundary * (1.0 - path_mask.clamp(0.0, 1.0))
    denominator = (forbidden.sum() * left_rgb.shape[1]).clamp_min(1.0)
    return ((left_rgb - right_rgb).abs() * forbidden).sum() / denominator


def should_save_epoch_preview(config, epoch_number):
    if epoch_number is None:
        return False
    policy = config.get("training", {}).get("fixedEpochPreviewPolicy", {})
    return int(epoch_number) in [int(value) for value in policy.get("smoke", []) + policy.get("formalStage", [])]


def save_tensor_png(tensor, output_path):
    pixels = tensor.detach().clamp(0.0, 1.0).mul(255).byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(pixels).save(output_path, format="PNG", optimize=True)


def latent_gradient_mae(predicted, target):
    horizontal = torch.nn.functional.l1_loss(predicted[:, :, :, 1:] - predicted[:, :, :, :-1], target[:, :, :, 1:] - target[:, :, :, :-1])
    vertical = torch.nn.functional.l1_loss(predicted[:, :, 1:, :] - predicted[:, :, :-1, :], target[:, :, 1:, :] - target[:, :, :-1, :])
    return (horizontal + vertical) * 0.5


def multiscale_latent_hierarchy_losses(predicted, target, config):
    functional = torch.nn.functional
    gradient_losses = []
    laplacian_losses = []
    for scale in config["training"].get("textureHierarchyScales", [1.0, 0.5, 0.25]):
        if float(scale) == 1.0:
            predicted_level, target_level = predicted, target
        else:
            size = (
                max(2, round(predicted.shape[-2] * float(scale))),
                max(2, round(predicted.shape[-1] * float(scale))),
            )
            predicted_level = functional.interpolate(predicted, size=size, mode="area")
            target_level = functional.interpolate(target, size=size, mode="area")
        gradient_losses.append(latent_gradient_mae(predicted_level, target_level))
        laplacian_losses.append(functional.l1_loss(latent_laplacian(predicted_level), latent_laplacian(target_level)))
    return torch.stack(gradient_losses).mean(), torch.stack(laplacian_losses).mean()


def latent_laplacian(value):
    functional = torch.nn.functional
    padded = functional.pad(value, (1, 1, 1, 1), mode="replicate")
    return (
        padded[:, :, 1:-1, :-2]
        + padded[:, :, 1:-1, 2:]
        + padded[:, :, :-2, 1:-1]
        + padded[:, :, 2:, 1:-1]
        - 4.0 * value
    )


def latent_activity(value):
    horizontal = torch.nn.functional.pad((value[:, :, :, 1:] - value[:, :, :, :-1]).abs(), (0, 1, 0, 0))
    vertical = torch.nn.functional.pad((value[:, :, 1:, :] - value[:, :, :-1, :]).abs(), (0, 0, 0, 1))
    return (horizontal + vertical).mean(dim=1, keepdim=True) * 0.5


def quiet_region_excess_loss(predicted, target, config):
    target_activity = latent_activity(target)
    predicted_activity = latent_activity(predicted)
    quantile = float(config["training"].get("quietRegionQuantile", 0.3))
    margin = float(config["training"].get("quietRegionMargin", 0.02))
    thresholds = torch.quantile(target_activity.flatten(1), quantile, dim=1).view(-1, 1, 1, 1)
    quiet_mask = (target_activity <= thresholds).to(predicted.dtype)
    excess = torch.relu(predicted_activity - target_activity - margin) * quiet_mask
    return excess.sum() / quiet_mask.sum().clamp_min(1.0)


def balanced_binary_condition_loss(predicted, target):
    epsilon = 1e-6
    predicted = predicted.clamp(epsilon, 1.0 - epsilon)
    positive_mask = target >= 0.5
    negative_mask = ~positive_mask
    channel_losses = []
    for channel_index in range(target.shape[1]):
        channel_predicted = predicted[:, channel_index]
        channel_positive = positive_mask[:, channel_index]
        channel_negative = negative_mask[:, channel_index]
        parts = []
        if channel_positive.any():
            parts.append(-torch.log(channel_predicted[channel_positive]).mean())
        if channel_negative.any():
            parts.append(-torch.log1p(-channel_predicted[channel_negative]).mean())
        channel_losses.append(torch.stack(parts).mean())
    return torch.stack(channel_losses).mean()


def training_timesteps(config, epoch_index, batch_index, batch_count, batch_size, diffusion_steps, device):
    sampling = config.get("training", {}).get("timestepSampling")
    if sampling == "deterministic_full_schedule_cover_v2":
        stride = int(config.get("training", {}).get("timestepCoverageStride", 997))
        if math.gcd(stride, diffusion_steps) != 1:
            raise ValueError("timestep coverage stride must be coprime with diffusion step count")
        offset = int(config.get("training", {}).get("seed", 0)) % diffusion_steps
        epoch_width = batch_count * batch_size
        values = [
            (offset + (epoch_index * epoch_width + batch_index * batch_size + item_index) * stride) % diffusion_steps
            for item_index in range(batch_size)
        ]
        return torch.tensor(values, device=device, dtype=torch.long)
    if not is_v5_or_later(config):
        return torch.randint(0, diffusion_steps, (batch_size,), device=device)
    bucket_count = max(1, batch_count * batch_size)
    values = []
    for item_index in range(batch_size):
        bucket = (batch_index * batch_size + item_index + epoch_index) % bucket_count
        value = 0 if bucket_count == 1 else round((bucket / (bucket_count - 1)) * (diffusion_steps - 1))
        values.append(value)
    return torch.tensor(values, device=device, dtype=torch.long)


def is_v5(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v5"


def is_v6(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v6"


def is_v7(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v7"


def is_v8_stage4_decoded_alignment(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v8_stage4_decoded_alignment"


def is_v9_stage4_object_semantic_decoded_alignment(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"


def uses_stage4_unified_preview_sampling_contract(config):
    contract = config.get("training", {}).get("stage4UnifiedTrainingPreviewSamplingContract", {})
    return (
        config.get("training", {}).get("trainingAuthorizationStatus") in {
            V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS,
            V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS,
        }
        and contract.get("enabled") is True
        and contract.get("status") == "active_owner_authorized_single_execution"
        and contract.get("samplingFunction") == "evaluate_deterministic_rollout_rgb_quality_v7"
        and contract.get("checkpointPreviewIdentityGate") == "byte_exact_best_epoch_reproduction"
    )


@contextmanager
def stage4_fixed_preview_determinism_scope(enabled=True):
    """Limit strict CUDA determinism to fixed-preview sampling and restore training state."""
    if not enabled:
        yield
        return
    previous_debug_mode = torch.get_deterministic_debug_mode()
    previous_cudnn_deterministic = bool(torch.backends.cudnn.deterministic)
    previous_cudnn_benchmark = bool(torch.backends.cudnn.benchmark)
    previous_workspace = os.environ.get("CUBLAS_WORKSPACE_CONFIG")
    try:
        os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        torch.use_deterministic_algorithms(True)
        yield
    finally:
        torch.set_deterministic_debug_mode(previous_debug_mode)
        torch.backends.cudnn.deterministic = previous_cudnn_deterministic
        torch.backends.cudnn.benchmark = previous_cudnn_benchmark
        if previous_workspace is None:
            os.environ.pop("CUBLAS_WORKSPACE_CONFIG", None)
        else:
            os.environ["CUBLAS_WORKSPACE_CONFIG"] = previous_workspace


def uses_registered_v7_capacity_dataset(config):
    return is_v7(config) or is_v8_stage4_decoded_alignment(config) or is_v9_stage4_object_semantic_decoded_alignment(config)


def uses_v7_rollout_validation(config):
    return is_v7(config) or is_v8_stage4_decoded_alignment(config) or is_v9_stage4_object_semantic_decoded_alignment(config)


def conditional_dataset_selection_contract(config):
    return (
        "registered_v7_capacity_contribution_v1"
        if uses_registered_v7_capacity_dataset(config)
        else "current_condition_identity_v1"
    )


def is_v6_or_later(config):
    return is_v6(config) or is_v7(config) or is_v8_stage4_decoded_alignment(config) or is_v9_stage4_object_semantic_decoded_alignment(config)


def is_v5_or_later(config):
    return is_v5(config) or is_v6_or_later(config)


def upper_camel(value):
    return value[:1].upper() + value[1:]


def condition_type_indices(config):
    order = list(config["conditionChannelOrder"])
    channel_types = config["conditionChannelTypes"]
    return (
        [order.index(value) for value in channel_types["discrete"]],
        [order.index(value) for value in channel_types["continuous"]],
    )


def serialize_condition_evidence_metrics(loss_metrics):
    serialized = {}
    preset_scalar_keys = {
        "compositeLossTensor",
        "compositeLoss",
        "velocityPredictionMse",
        "cleanLatentMae",
        "compositeConditionQualityScore",
    }
    for key, value in loss_metrics.items():
        if key in preset_scalar_keys:
            continue
        if key == "predictedRgbTensor":
            if not isinstance(value, torch.Tensor) or value.ndim != 4 or value.shape[1] != 3:
                raise ValueError("condition evidence predictedRgbTensor must be a batched RGB image tensor")
            continue
        if isinstance(value, torch.Tensor):
            if value.numel() != 1:
                raise ValueError(f"condition evidence metric must be scalar: {key}")
            serialized[key] = float(value.detach())
            continue
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            serialized[key] = float(value)
            continue
        raise ValueError(f"condition evidence metric has unsupported type: {key}")
    return serialized


def register_v9_stage4_diagnostic_manifest_fields(row, train_metrics, epoch, config):
    if not is_v9_stage4_object_semantic_decoded_alignment(config):
        return row
    registry = config.get("training", {}).get("stage4ObjectSemanticDecoderAlignment", {}).get(
        "diagnosticManifestRegistry", {}
    )
    if int(epoch) not in registry.get("fixedEpochs", []):
        return row
    expected = list(V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
    if registry.get("exactFields") != expected or registry.get("exactFieldCount") != len(expected):
        raise ValueError("V9 Stage 4 diagnostic Manifest registry identity changed")
    actual = sorted(key for key in train_metrics if key.startswith("stage4Diagnostic"))
    if actual != sorted(expected):
        missing = sorted(set(expected) - set(actual))
        unknown = sorted(set(actual) - set(expected))
        raise ValueError(f"V9 Stage 4 diagnostic Manifest field set changed: missing={missing}, unknown={unknown}")
    for key in expected:
        value = float(train_metrics[key])
        if not math.isfinite(value) or value < 0.0:
            raise ValueError(f"V9 Stage 4 diagnostic Manifest metric is not finite nonnegative: {key}")
        row[key] = value
    return row


def save_condition_evidence(model, datasets, diffusion, latent_normalization, device, seed, output_path, config):
    records = []
    was_training = model.denoiser.training
    model.denoiser.eval()
    with torch.no_grad():
        for split_index, split in enumerate(("validation", "challenge", "regression")):
            dataset = datasets[split]
            if is_v6_or_later(config) and split == config["training"].get("strictHeldOutInferenceSplit"):
                records.append({
                    "split": split,
                    "sampleCount": len(dataset),
                    "status": "reserved_for_post_training_held_out_inference",
                    "metricsReadDuringTraining": False,
                })
                continue
            for sample_index in range(len(dataset)):
                row = dataset[sample_index]
                image = row["image"].unsqueeze(0).to(device)
                conditions = row["conditions"].unsqueeze(0).to(device)
                latent = model.autoencoder.encode(image)
                latent = normalize_latent(latent, latent_normalization)
                timestep_value = (seed + split_index * 97 + sample_index * 31) % diffusion["alphasCumulative"].shape[0]
                timestep = torch.tensor([timestep_value], device=device, dtype=torch.long)
                generator = torch.Generator(device=device).manual_seed(seed + split_index * 1000 + sample_index)
                noise = torch.randn(latent.shape, device=device, dtype=latent.dtype, generator=generator)
                noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
                target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
                loss_metrics = predict_and_measure(
                    model,
                    noisy_latent,
                    target_velocity,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    conditions,
                    config,
                    image,
                    latent_normalization,
                )
                record = {
                    "split": split,
                    "sampleId": row["sampleId"],
                    "conditionLabel": row["conditionLabel"],
                    "conditionPackPath": row["conditionPackPath"],
                    "conditionChannelCount": int(conditions.shape[1]),
                    "timestep": int(timestep_value),
                    "velocityPredictionLoss": float(loss_metrics["velocityPredictionMse"].detach()),
                    "cleanLatentMae": float(loss_metrics["cleanLatentMae"].detach()),
                    "compositeConditionQualityScore": float(loss_metrics["compositeConditionQualityScore"].detach()),
                    "generatedRgb": False,
                    "formalCandidate": False,
                }
                record.update(serialize_condition_evidence_metrics(loss_metrics))
                records.append(record)
    if was_training:
        model.denoiser.train()
    payload = {
        "schemaVersion": "ai-assisted-conditional-denoiser-evidence-v4" if uses_v7_rollout_validation(config) else ("ai-assisted-conditional-denoiser-evidence-v3" if is_v6(config) else ("ai-assisted-conditional-denoiser-evidence-v2" if is_v5(config) else "ai-assisted-conditional-denoiser-evidence-v1")),
        "createdAtUtc": utc_now(),
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "records": records,
        "automaticStorage": True,
    }
    write_json(output_path, payload)
    return records


def compute_latent_normalization(model, dataset, device):
    channel_sum = None
    channel_square_sum = None
    value_count = 0
    model.autoencoder.eval()
    with torch.no_grad():
        for index in range(len(dataset)):
            image = dataset[index]["image"].unsqueeze(0).to(device)
            latent = model.autoencoder.encode(image).double()
            current_sum = latent.sum(dim=(0, 2, 3))
            current_square_sum = latent.square().sum(dim=(0, 2, 3))
            channel_sum = current_sum if channel_sum is None else channel_sum + current_sum
            channel_square_sum = current_square_sum if channel_square_sum is None else channel_square_sum + current_square_sum
            value_count += latent.shape[0] * latent.shape[2] * latent.shape[3]
    if value_count == 0 or channel_sum is None or channel_square_sum is None:
        raise ValueError("training split produced no latent normalization values")
    mean = channel_sum / value_count
    variance = (channel_square_sum / value_count - mean.square()).clamp_min(1e-8)
    standard_deviation = variance.sqrt().clamp_min(1e-4)
    return {
        "version": "per_channel_train_split_v1",
        "mean": mean.float().view(1, -1, 1, 1).to(device),
        "standardDeviation": standard_deviation.float().view(1, -1, 1, 1).to(device),
        "sampleCount": len(dataset),
        "valueCountPerChannel": value_count,
    }


def load_latent_normalization(checkpoint, device):
    value = checkpoint.get("latentNormalization")
    if not isinstance(value, dict) or value.get("version") != "per_channel_train_split_v1":
        raise ValueError("parent checkpoint latent normalization is missing")
    mean = value.get("mean")
    standard_deviation = value.get("standardDeviation")
    if not isinstance(mean, list) or not isinstance(standard_deviation, list) or len(mean) != len(standard_deviation):
        raise ValueError("parent checkpoint latent normalization values are invalid")
    return {
        **value,
        "mean": torch.tensor(mean, dtype=torch.float32, device=device).view(1, -1, 1, 1),
        "standardDeviation": torch.tensor(standard_deviation, dtype=torch.float32, device=device).view(1, -1, 1, 1),
    }


def normalize_latent(latent, normalization):
    return (latent - normalization["mean"]) / normalization["standardDeviation"]


def denormalize_latent(latent, normalization):
    return latent * normalization["standardDeviation"] + normalization["mean"]


def serialize_latent_normalization(normalization):
    return {
        "version": normalization["version"],
        "mean": normalization["mean"].detach().cpu().reshape(-1).tolist(),
        "standardDeviation": normalization["standardDeviation"].detach().cpu().reshape(-1).tolist(),
        "sampleCount": normalization["sampleCount"],
        "valueCountPerChannel": normalization["valueCountPerChannel"],
    }


def write_progress(
    output_dir,
    config,
    package,
    stage,
    started_at,
    started_at_shanghai,
    row,
    metrics,
    status,
    smoke_test,
    manifest=None,
    live_progress=None,
):
    payload = {
        "schemaVersion": "project-owned-ai-assisted-conditional-denoiser-progress-v1",
        "status": status,
        "startedAtUtc": started_at,
        "startedAtAsiaShanghai": started_at_shanghai,
        "updatedAtUtc": utc_now(),
        "updatedAtAsiaShanghai": asia_shanghai_now(),
        "modelId": config["modelId"],
        "datasetPackageId": package["packageId"],
        "trainingLane": "ai_assisted_cold_start",
        "resolutionStage": stage,
        "currentStage": row["stage"] if row else ("completed" if status == "completed" else "initializing"),
        "currentEpoch": live_progress["epoch"] if live_progress else (row["epoch"] if row else None),
        "liveProgress": live_progress,
        "smokeTest": smoke_test,
        "metrics": metrics,
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "formalInferenceEligible": False,
        "automaticStorage": True,
    }
    if manifest:
        payload["checkpointPath"] = manifest["checkpointPath"]
        payload["checkpointSha256"] = manifest["checkpointSha256"]
        payload["remainingBlockers"] = manifest["remainingBlockers"]
    write_json_atomic(output_dir / "progress.json", payload)


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def asia_shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat()


def project_path(path):
    resolved = Path(path).resolve()
    project_root = Path.cwd().resolve()
    try:
        relative = resolved.relative_to(project_root)
    except ValueError:
        default_data_root = Path("D:/AI-PET-WORLD-DATA") if os.name == "nt" else project_root / ".ai-pet-world-data"
        data_root = Path(os.environ.get("AI_PET_WORLD_DATA_ROOT", default_data_root)).resolve()
        physical_runtime_root = data_root / "hot" / "runtime"
        relative = Path(".runtime") / resolved.relative_to(physical_runtime_root)
    return str(relative).replace("\\", "/")


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def state_dict_sha256(state_dict):
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def tensor_sha256(tensor):
    value = tensor.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(value.dtype).encode("ascii"))
    digest.update(json.dumps(list(value.shape), separators=(",", ":")).encode("ascii"))
    digest.update(value.numpy().tobytes(order="C"))
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
