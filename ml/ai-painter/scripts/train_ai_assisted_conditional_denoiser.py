from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import random
import time
from copy import deepcopy
from types import MappingProxyType

import numpy as np
from PIL import Image
import torch

from ai_painter_authorization_policy import (
    resolve_control_refactor_grant,
    resolve_stage_execution_grant,
)
from ai_painter_execution_grant import ExecutionAction
from ai_painter_preview_reproduction import (
    fixed_preview_determinism_scope as stage4_fixed_preview_determinism_scope,
    state_dict_sha256,
    tensor_sha256,
)
from ai_painter_stage_mode_registry import (
    FORMAL_MODE_REGISTRY,
    V7_R5_STAGE3_COVERAGE_SMOKE_STATUS,
    V7_R5_STAGE3_SMOKE_STATUS,
    V7_R5_STAGE4_BOUNDED_PREFLIGHT_STATUS,
    V7_R5_STAGE4_BOUNDED_SMOKE_STATUS,
    V7_R5_STAGE4_FULL_TRAINING_STATUS,
    V7_R5_STAGE4_PREFLIGHT_STATUS,
    V8_STAGE4_INACTIVE_STATUS,
    V8_STAGE4_PREFLIGHT_STATUS,
    V8_STAGE4_SMOKE_STATUS,
    V9_STAGE4_INACTIVE_STATUS,
    V9_STAGE4_SMOKE_STATUS,
    V9_STAGE4_UNIFIED_PREVIEW_SMOKE_STATUS,
    V9_STAGE4_VALIDATION_KERNEL_SMOKE_STATUS,
    STRUCTURE_FACT_FIRST_STAGE4_INACTIVE_STATUS,
    STRUCTURE_FACT_FIRST_STAGE4_PHASE0_STATUS,
    STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS,
    CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_INACTIVE_STATUS,
    CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_SMOKE_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
    CONTROLLED_STRUCTURE_SMOKE_ARMS,
    fact_conditioned_semantic_mixture_smoke_supports_objective,
    fact_conditioned_semantic_mixture_smoke_supports_controlled_structure_arm,
    resolve_stage_mode,
)

from ai_painter.complete_world import (
    STAGE4_STRUCTURE_FACT_CHANNEL_ORDER,
    add_noise,
    build_complete_world_system,
    deterministic_velocity_step,
    inference_timesteps,
    recover_from_velocity,
    resize_stage4_structure_fact_layout,
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
V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS = V7_R5_STAGE3_SMOKE_STATUS
V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage3-condition-evidence-serialization-fix-and-one-checkpoint-smoke-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE = "r5_stage3_condition_evidence_non_scalar_image_tensor_serialization_fix_cpu_regression_and_one_same_checkpoint_gpu_smoke_retry_only"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/request.json"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256 = "df0de715098933533468668776573cfa88abc17ec0716e4883e005baf7782708"
V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/authorization-consumption.json"
V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256 = "10873531ed7e9804b9cdc76fde78f7ecc4faf764a4626b277d70373a3f1aea6a"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS = V7_R5_STAGE3_COVERAGE_SMOKE_STATUS
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SCOPE = "rebind_r5_stage3_coverage_convergence_smoke_runner_and_trainer_gate_cpu_regression_then_one_checkpoint_continuation_single_sample_30_epoch_gpu_smoke_only"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805/request.json"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256 = "037741e42eeb3c73b7b9fdfc1eae8a0536ce9208e053cfec4aac4d4977515d19"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-single-sample-gpu-smoke-20260805/authorization-consumption.json"
V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256 = "9281a8ba10c58a68f93a056995a2bfb8f9d7d62430aa5c73ca4a7a0dccb42bc8"
V7_REPAIR_R5_STAGE4_PREFLIGHT_AUTHORIZATION_STATUS = V7_R5_STAGE4_PREFLIGHT_STATUS
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_STATUS = V7_R5_STAGE4_FULL_TRAINING_STATUS
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SCOPE = "split_stage3_smoke_30_epoch_and_stage4_formal_40_epoch_contract_then_one_bounded_stage4_execution_only"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/request.json"
V7_REPAIR_R5_STAGE4_FULL_TRAINING_AUTHORIZATION_SHA256 = "2bc4993cf339476d786a5c4a90dc60bb61bd0ade632f366c2414ef60bba5a07c"
V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/implementation-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_IMPLEMENTATION_CONSUMPTION_SHA256 = "698788ed3a5b5b87f25f92ef2234a5345be9a92b2aebb7ce8c8c20127ae690b4"
V7_REPAIR_R5_STAGE4_TRAINING_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/training-execution-authorization-consumption.json"
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_PREFLIGHT_STATUS = V7_R5_STAGE4_BOUNDED_PREFLIGHT_STATUS
V7_REPAIR_R5_STAGE4_BOUNDED_SMOKE_STATUS = V7_R5_STAGE4_BOUNDED_SMOKE_STATUS
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
V8_STAGE4_SMOKE_INACTIVE_STATUS = V8_STAGE4_INACTIVE_STATUS
V8_STAGE4_SMOKE_PREFLIGHT_STATUS = V8_STAGE4_PREFLIGHT_STATUS
V8_STAGE4_SMOKE_ACTIVE_STATUS = V8_STAGE4_SMOKE_STATUS
V9_STAGE4_CPU_INACTIVE_STATUS = V9_STAGE4_INACTIVE_STATUS
V9_STAGE4_SMOKE_ACTIVE_STATUS = V9_STAGE4_SMOKE_STATUS
V9_STAGE4_UNIFIED_PREVIEW_SMOKE_ACTIVE_STATUS = V9_STAGE4_UNIFIED_PREVIEW_SMOKE_STATUS
V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS = V9_STAGE4_VALIDATION_KERNEL_SMOKE_STATUS
STRUCTURE_FACT_FIRST_STAGE4_CPU_INACTIVE_STATUS = STRUCTURE_FACT_FIRST_STAGE4_INACTIVE_STATUS
STRUCTURE_FACT_FIRST_STAGE4_SMOKE_ACTIVE_STATUS = STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS
CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_CPU_INACTIVE_STATUS = (
    CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_INACTIVE_STATUS
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS = (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_ACTIVE_STATUS = (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_FULL_TRAINING_STATUSES = (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
)
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
STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS = V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS = MappingProxyType({
    "terrain_path_ground": "stage4StructureFactTerrain_path_groundBce",
    "route_required_boundary": "stage4StructureFactRoute_required_boundaryBce",
    "object_footprints": "stage4StructureFactObject_footprintsBce",
    "object_tree": "stage4StructureFactObject_treeBce",
    "object_rock": "stage4StructureFactObject_rockBce",
    "object_vegetation": "stage4StructureFactObject_vegetationBce",
})
CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "route_required_boundary",
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "terrain_path_ground",
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS = tuple(
    f"stage4SemanticRenderer{prefix}IndependentLoss"
    for prefix in ("Footprints", "Tree", "Rock", "Vegetation", "RouteBoundary")
) + (
    "stage4SemanticRendererFusionResponseMae",
    "stage4SemanticRendererPrimaryPathAvailable",
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_STATUS = (
    "condition_preserving_semantic_renderer_diagnostic_manifest_supported_inactive"
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_GRADIENT_TARGET = (
    "matching_condition_preserving_semantic_renderer_typed_readout_features"
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES = (
    "route",
    "footprints",
    "tree",
    "rock",
    "vegetation",
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS = (
    "terrain_path_ground",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_OBLIGATION_ID = (
    "stage4_per_class_final_visible_rgb_obligation_v1"
)
STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID = (
    "stage4_conflict_aware_existing_gradient_aggregation_v1"
)
STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_EVIDENCE_BINDINGS = {
    "diagnosticTerminal": {
        "path": ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/phase-terminal.json",
        "sha256": "f4ec93aaf924a8e8bc21483c09a14fedfd52e05436ec7f0014d9334b6f843e4e",
    },
    "gpuReport": {
        "path": ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/gpu-report.json",
        "sha256": "040f8a721bc8b54d2237787ecb714a8ec9fc35cb5eda4d7fab8c4ba69b421e62",
    },
    "analysisReport": {
        "path": ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/multisample-capacity-gradient-interference-analysis.json",
        "sha256": "f37e0f5637f03ea45ca87474efdc09755893e27502cf5a9c5d56d27a7edfacc9",
    },
    "adjudication": {
        "path": ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/adjudication.json",
        "sha256": "adbd2e1e1113c497630d4de091f6af787ab365e4ac7dfcb582dbea038a51fb10",
    },
    "inactiveTrainingParadigmContract": {
        "path": ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/inactive-contract-or-owner-request.json",
        "sha256": "f81c8a776a3a8b68d99fb15df61515174df85377db71e840e5f3a9722ff78153",
    },
}
STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_OBLIGATION_ID = (
    "stage4_distribution_aware_visible_spatial_semantic_obligation_v1"
)
STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS = tuple(
    {
        "identity": identity,
        "sourceChannel": source,
        "metric": f"stage4SemanticMixture{prefix}FinalTypedRgbMae",
    }
    for identity, source, prefix in zip(
        FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES,
        FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS,
        ("Route", "Footprints", "Tree", "Rock", "Vegetation"),
    )
)
STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_EVIDENCE_BINDINGS = {
    "sufficiencyTerminal": {
        "path": ".runtime/ai-painter/stage4-training-objective-sufficiency-reassessments/20260812-183940631/phase-terminal.json",
        "sha256": "1c30147809b740a6c92eb8ff64589c189efcfdc70b8b9754b60d173712c3ce7d",
    },
    "sufficiencyReport": {
        "path": ".runtime/ai-painter/stage4-training-objective-sufficiency-reassessments/20260812-183940631/training-objective-sufficiency-report.json",
        "sha256": "544ef5a2bb913ed251bae79bad13054724c37fad538ae4ca04ea2e5b94f126fd",
    },
    "threeWayDecision": {
        "path": ".runtime/ai-painter/stage4-training-objective-sufficiency-reassessments/20260812-183940631/three-way-decision.json",
        "sha256": "dcecc4dd463a20e18d9b9d26c77d3363b17f33e8fe4bab85db4ed0a5f7171a16",
    },
    "inactiveTrainingObjectiveContract": {
        "path": ".runtime/ai-painter/stage4-training-objective-sufficiency-reassessments/20260812-183940631/inactive-training-objective-contract.json",
        "sha256": "b725cd51b6380772a9f5d92a11f41c9515b86a59b457a82b3165a2aadf2aa5c7",
    },
}
STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-final-visible-rgb-obligation-cpu-20260812-190738093/implementation-authorization.json",
    "authorizationSha256": "a606a8d5b525d7e01b5f5fbaae3bb4c35368bbfa94fef2f0ee083302548ceb5e",
    "implementationConsumptionPath": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-final-visible-rgb-obligation-cpu-20260812-190738093/implementation-consumption.json",
    "implementationConsumptionSha256": "48c00d7c6e2322c3f6b676f4d5de5497769e5421b3a2cc489beecc3c19ddd33e",
}
STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_EVIDENCE_BINDINGS = {
    "causalTerminal": {
        "path": ".runtime/ai-painter/stage4-stage0-generalization-causal-adjudications/20260813-062536922/phase-terminal.json",
        "sha256": "3edba5e5f514982a0e134780ce59c983441f21731bd3f79e0cc9461bb0c1a552",
    },
    "causalDecision": {
        "path": ".runtime/ai-painter/stage4-stage0-generalization-causal-adjudications/20260813-062536922/adjudication.json",
        "sha256": "1abbad98362466fbf7ae7fa6e36cf793f41f9c8905f3090b54a119f1a62ff1d1",
    },
    "inactiveRepairContract": {
        "path": ".runtime/ai-painter/stage4-stage0-generalization-causal-adjudications/20260813-062536922/inactive-repair-contract.json",
        "sha256": "e958c43f8827e2fbeebefb1c3eeb72db46af2684198d07756bdbd5ad9e2a77d8",
    },
}
STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-distribution-aware-visible-spatial-semantic-obligation-20260813-062820868/implementation-authorization.json",
    "authorizationSha256": "3984273525101528a9258937bc6c7716ab518999b6f76c2c5af8fd4c23a85bcd",
    "implementationConsumptionPath": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-distribution-aware-visible-spatial-semantic-obligation-20260813-062820868/implementation-consumption.json",
    "implementationConsumptionSha256": "49f749b642fd9fd6aa25896f7511773d60363823e52c62655d735889b3ca1745",
}
STAGE4_EPOCH_WORST_SAMPLE_CLASS_REPLAY_ID = (
    "stage4_epoch_global_worst_sample_class_final_visible_replay_v1"
)
STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID = (
    "stage4_epoch_worst_sample_class_reference_feature_structure_replay_v1"
)
STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_EVIDENCE_BINDINGS = {
    "causalAnalysisReport": {
        "path": ".runtime/ai-painter/stage4-epoch-worst-reference-feature-replay-cpu-implementations/20260818-050914433/causal-analysis-report.json",
        "sha256": "da74b9d5f060e02a6d2d8750fd1f13621f6c6369d2fa2a307e7349f35167294b",
    },
    "causalAdjudication": {
        "path": ".runtime/ai-painter/stage4-epoch-worst-reference-feature-replay-cpu-implementations/20260818-050914433/adjudication.json",
        "sha256": "2a59d965a321c9a2e07bd0eeebdb7533b3ea29442d91a0cede6493de79b8680c",
    },
    "inactiveRepairContract": {
        "path": ".runtime/ai-painter/stage4-epoch-worst-reference-feature-replay-cpu-implementations/20260818-050914433/inactive-repair-contract.json",
        "sha256": "dae32864957a58b76313e86b1da28194a83d3c0c0eae79301380ee36230b6f7a",
    },
}
STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-epoch-worst-reference-feature-replay-cpu-"
        "implementation-20260818-050914433/authorization.json"
    ),
    "authorizationSha256": "54e00e885875ee8d1d7195e34f1a06cc549842c0621d1df87b768387e573b2a2",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-epoch-worst-reference-feature-replay-cpu-"
        "implementation-20260818-050914433/consumption.json"
    ),
    "implementationConsumptionSha256": "8d85ad1a918ac0cd3ff19d535fedb8fc2542f26314976601295a36a84bdd7b84",
}
STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"
)
STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_EVIDENCE_BINDINGS = {
    "causalTerminal": {
        "path": (
            ".runtime/ai-painter/stage4-reference-feature-replay-stage0-causal-"
            "adjudications/20260821-002458923/phase-terminal.json"
        ),
        "sha256": "52f90653dbae87f5ff17eb52b29022e5f897c9733510732f9e4010efc9b007af",
    },
    "causalDecision": {
        "path": (
            ".runtime/ai-painter/stage4-reference-feature-replay-stage0-causal-"
            "adjudications/20260821-002458923/adjudication.json"
        ),
        "sha256": "ce6dfaf0ecbddb58ee103ed544127b78014796fa844edcab48bc4b96963eb89e",
    },
    "inactiveRepairContract": {
        "path": (
            ".runtime/ai-painter/stage4-reference-feature-replay-stage0-causal-"
            "adjudications/20260821-002458923/inactive-repair-contract.json"
        ),
        "sha256": "a9b109c29602c57e4e4d96b9271104e6e5c23803b77ecdd5b59beb86395add91",
    },
}
STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-"
        "worst-sample-reference-feature-structure-cpu-20260821-003955788/"
        "implementation-authorization.json"
    ),
    "authorizationSha256": "78a3bc75d4eab0f9ab30ba1b9a8ffee18f363eb83e4cfd4129e73ce344dc34b8",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-"
        "worst-sample-reference-feature-structure-cpu-20260821-003955788/"
        "implementation-consumption.json"
    ),
    "implementationConsumptionSha256": "383fd7a52437ad28c3ffdd6dc314207efa1f334a6bae1f35be3577cfc3942446",
}
STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"
)
STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS = {
    "designTerminal": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/phase-terminal.json"
        ),
        "sha256": "381a6f6d8c7b3d19f499751ad48de94aa890f813026432c8457b59cc90ed2fa4",
    },
    "designReport": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/supervision-design-report.json"
        ),
        "sha256": "9cff3f738734e183a98e37ffa47bd91043e7f7c9be8d174f0d60882b233edf0c",
    },
    "designDecision": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/adjudication.json"
        ),
        "sha256": "305b0adfad393253cf259c25924f1cde4e55799e18470102ee6a9461ff7e907e",
    },
    "inactiveTrainingObjectiveContract": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/inactive-training-objective-contract.json"
        ),
        "sha256": "b8429eae3481faca6cb54a31c04db8f2801e7f89a60a060a821bcc098904c63b",
    },
    "designCpuReport": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/cpu-report.json"
        ),
        "sha256": "a4609e49d1a907ed3134cbe465f4ed07a739e145b9a4e4d2861952913e030c50",
    },
    "dataSupervisionAudit": {
        "path": (
            ".runtime/ai-painter/stage4-vegetation-legal-supervision-design-"
            "reviews/20260821-051308595/data-supervision-audit.json"
        ),
        "sha256": "3bc3642e46645362a069907598a849449a69ef0d4d781df8d8977c02eed67371",
    },
}
STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-"
        "class-worst-sample-final-visible-luminance-structure-cpu-"
        "20260821-051855146/implementation-authorization.json"
    ),
    "authorizationSha256": "1040a6bd3402c8e184710391d72cbfb739bd10808a28e058625349b99ff8d3c4",
}
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID = (
    "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_"
    "selection_and_checkpoint_identity_v1"
)
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_EVIDENCE_BINDINGS = {
    "causalTerminal": {
        "path": (
            ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-"
            "causal-adjudications/20260821-090907108/phase-terminal.json"
        ),
        "sha256": "e1c65ace0033a65dd64ab40579ac1b9298cea6253e925fa286a7170fecc200f5",
    },
    "causalReport": {
        "path": (
            ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-"
            "causal-adjudications/20260821-090907108/causal-analysis-report.json"
        ),
        "sha256": "15315a214731fe09da279afdf076bdb9ae1bb31feaef922a5df8c53c4352605e",
    },
    "causalDecision": {
        "path": (
            ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-"
            "causal-adjudications/20260821-090907108/adjudication.json"
        ),
        "sha256": "25bc7e138da75fc4fb1a4e453558423eeca6c294c865802078c70531c92ca9dd",
    },
    "inactiveRepairContract": {
        "path": (
            ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-"
            "causal-adjudications/20260821-090907108/inactive-repair-contract.json"
        ),
        "sha256": "b64ca468422eb47054d7b09649c9284e3b4231be0fec3ea4c868b7a36ba26729",
    },
    "causalCpuReport": {
        "path": (
            ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-"
            "causal-adjudications/20260821-090907108/cpu-report.json"
        ),
        "sha256": "5162a728595dd3880ea4c5fdd733678c26b21f82a464676969e2355ba27af9e7",
    },
}
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-"
        "complete-per-class-worst-luminance-cpu-20260821-092701121/"
        "implementation-authorization.json"
    ),
    "authorizationSha256": "91cfb1b6ee64d314461a201d8f398d5213f368ae6a08fc7e9a4327a44ed6456f",
}
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID = (
    "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_"
    "selection_and_shared_replay_v1"
)
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_EVIDENCE_BINDINGS = {
    "terminal": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/phase-terminal.json"
        ),
        "sha256": "c489842ee9e3c11f6b16f108a740e4ed7f11bf02569a170fc264c892e335ed13",
    },
    "designReport": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/supervision-design-report.json"
        ),
        "sha256": "7055d987ed0350994f973ede746d957ee3af78e8498ed6fda6687f407c4a7aa8",
    },
    "decision": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/adjudication.json"
        ),
        "sha256": "6a253fa55e96dfe97f44ca0122f36896b7c993721fc91867b4c5eaed4abbac15",
    },
    "inactiveTrainingObjectiveContract": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/inactive-training-objective-contract.json"
        ),
        "sha256": "aa22e17d80b5103d2682cebe395e45b546aa18fb132faf3a318dedc8c8779d81",
    },
    "dataSupervisionAudit": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/data-supervision-audit.json"
        ),
        "sha256": "e7c0a704d6a80074f2614ce82ab3f57119fb62344aca64888a29b41194c50338",
    },
    "supervisionCoverageAudit": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/supervision-coverage-audit.json"
        ),
        "sha256": "16e7a1bf4022e0a1ce94399ce43a4d15c19739727ebfa81e10000cf8f99b92ff",
    },
    "cpuReport": {
        "path": (
            ".runtime/ai-painter/stage4-three-class-supervision-identifiability-"
            "reviews/20260822-071517942/cpu-report.json"
        ),
        "sha256": "a82574a7dfffce00c9aa2b8f95e67667061a573dba500bc24507d0b79899516f",
    },
}
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-"
        "complete-per-class-worst-reference-feature-shared-replay-cpu-"
        "20260822-072101387/implementation-authorization.json"
    ),
    "authorizationSha256": "e022f4339324ae3a3f64e5548072f42fb2ce6d754d38d73351cf8079eaf62f0a",
}
STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID = (
    "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
)
STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_ID = (
    "stage4_vegetation_final_visible_semantic_repair_v1"
)
STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-vegetation-final-visible-semantic-repair-"
        "20260813-025311970/implementation-authorization.json"
    ),
    "authorizationSha256": "68d33f0c6bbfe20fffdb1a70842a898a6cdc9abb24a891a649562b53e335bc54",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-vegetation-final-visible-semantic-repair-"
        "20260813-025311970/implementation-consumption-corrected.json"
    ),
    "implementationConsumptionSha256": "cc79fcc114c929097837f5a085ad89ba664d0c32dec33058089330aac963b1ff",
}
FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS = tuple(
    f"stage4SemanticMixture{prefix}{measurement}"
    for prefix in ("Route", "Footprints", "Tree", "Rock", "Vegetation")
    for measurement in (
        "ParticipationBce", "ContributionAbsMean", "GatedContributionAbsMean",
        "CounterfactualRgbMae", "FinalTypedRgbMae",
    )
) + (
    "stage4SemanticMixtureFinalResponseMae",
    "stage4SemanticMixtureTypedIdentityCount",
)
STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS = (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
    + ("stage4SemanticMixtureVegetationFinalTypedEdgeMae",)
)
STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_SUPERVISION_ID = (
    "stage4_vegetation_luminance_spatial_structure_supervision_v1"
)
STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-"
        "20260813-034000000/implementation-authorization.json"
    ),
    "authorizationSha256": "dd56bca1cd5dfd1e623b554d5a4dd5c1005d6d6dac9f771b7c588e6607540b5c",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-"
        "20260813-034000000/implementation-consumption.json"
    ),
    "implementationConsumptionSha256": "c5142f93352d6d30edd051e7ec5845041ec873c7fec4d84d1bf15a23c15c3902",
}
STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_DIAGNOSTIC_FIELDS = (
    STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    + ("stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss",)
)
STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID = (
    "stage4_four_typed_object_visible_structure_supervision_v1"
)
STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)
STAGE4_OBJECT_VISIBLE_STRUCTURE_EVIDENCE_BINDINGS = {
    "formalDesign": {
        "path": ".runtime/ai-painter/stage4-semantic-mixture-object-visible-structure-supervision-designs/20260815-000700000/object-visible-structure-supervision-design.json",
        "sha256": "f6b33d0edb30c391eb896b02bcbd78040f95c923fa5928a7acce25bb6a73dccc",
    },
    "formalDesignTerminal": {
        "path": ".runtime/ai-painter/stage4-semantic-mixture-object-visible-structure-supervision-designs/20260815-000700000/phase-terminal.json",
        "sha256": "8ddddfdf1924fdfdfcd167083a0cf5c7ce1f0360a52dba55b1994d3454e19d5d",
    },
    "inactiveImplementationContract": {
        "path": ".runtime/ai-painter/stage4-semantic-mixture-object-visible-structure-supervision-designs/20260815-000700000/inactive-candidate-implementation-contract.json",
        "sha256": "7ef8b2b676e275785124fc2caa731937cc0a754e8943a63ce47c751456cb2184",
    },
}
STAGE4_OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-semantic-mixture-object-visible-structure-"
        "supervision-implementation-20260815-002000000/authorization.json"
    ),
    "authorizationSha256": "62105816997550a94d3610e3c0d9cb356db27930b58789e747ad05ad9bdaf576",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-semantic-mixture-object-visible-structure-"
        "supervision-implementation-20260815-002000000/implementation-consumption.json"
    ),
    "implementationConsumptionSha256": "70b1b267b7d8d94ab3f7544c2dcb94e5ba2469368c798c639f8197b761586c4e",
}
STAGE4_OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS = (
    STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    + tuple(
        f"stage4SemanticMixture{prefix}FinalTypedLuminanceCorrelationLoss"
        for prefix in ("Footprints", "Tree", "Rock", "Vegetation")
    )
)
STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID = (
    "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
)
STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES = (1.0, 0.5, 0.25)
STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS = {
    "formalDesign": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-luminance-structure-supervision-designs/20260815-140100000/object-reference-multiscale-luminance-structure-supervision-design.json",
        "sha256": "796ca9d239feb0154459f3e43663bee06394391014eebaa32b3f7c41e7be5265",
    },
    "formalDesignTerminal": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-luminance-structure-supervision-designs/20260815-140100000/phase-terminal.json",
        "sha256": "15a8dae16354067351f06987e24bafa905e736cf2bdda8597185fb188604e7e0",
    },
    "inactiveImplementationContract": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-luminance-structure-supervision-designs/20260815-140100000/inactive-candidate-implementation-contract.json",
        "sha256": "efa22c613926446314b0e40eb9ff4e19a4e66d87c6dcd7e91bb8eea2647e5a90",
    },
}
STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION = {
    "authorizationPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-object-reference-multiscale-luminance-structure-"
        "supervision-cpu-implementation-20260815-141934048/authorization.json"
    ),
    "authorizationSha256": "582f235fd0f91e005ac8e828e6a47c2b93f4c3da9a22d32b41c06492351a6946",
    "implementationConsumptionPath": (
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-object-reference-multiscale-luminance-structure-"
        "supervision-cpu-implementation-20260815-141934048/consumption.json"
    ),
    "implementationConsumptionSha256": "e088624b02db39b665aed2dc5a9f7aebd00a29bda5770d5da24df186494a7166",
}
STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_DIAGNOSTIC_FIELDS = (
    STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    + tuple(
        f"stage4SemanticMixture{prefix}FinalTyped{suffix}"
        for prefix in ("Footprints", "Tree", "Rock", "Vegetation")
        for suffix in (
            "NativeLuminanceCorrelationLoss",
            "HalfLuminanceCorrelationLoss",
            "QuarterLuminanceCorrelationLoss",
            "CrossScaleStructureConsistencyLoss",
            "MultiscaleLuminanceStructureLoss",
        )
    )
)
STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID = (
    "stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_v1"
)
STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS = {
    "causalAdjudicationTerminal": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-final-visible-generalization-adjudications/20260816-101044293/phase-terminal.json",
        "sha256": "d80a4494eb1171b6a242df64204e043c0634dfde951f6d9c6c8d56aa695f904c",
    },
    "causalAnalysisReport": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-final-visible-generalization-adjudications/20260816-101044293/causal-analysis-report.json",
        "sha256": "513ef4ce43c555f95121407d4548ecc1cd8c0d21407e2eda32cdbfddd6cd0ad1",
    },
    "causalAdjudication": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-final-visible-generalization-adjudications/20260816-101044293/adjudication.json",
        "sha256": "4fbe4ffc9ffad03d3b1afada6d7f420b1719e5eaa4c0fe6f24c938e99c49e677",
    },
    "inactiveRepairContract": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-final-visible-generalization-adjudications/20260816-101044293/inactive-repair-contract.json",
        "sha256": "90c437da599b3632e63d0ab0e6cfaf60708470c22672dbe42af069e167c3a1a9",
    },
}
STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID = (
    "stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1"
)
STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_EVIDENCE_BINDINGS = {
    "causalAdjudicationTerminal": {
        "path": ".runtime/ai-painter/stage4-stage0-visual-generalization-causal-adjudications/20260817-024048736/phase-terminal.json",
        "sha256": "416298185947d37068c265cfaabd73128fb34e1e7ec340102a8696195e1f77d2",
    },
    "causalAnalysisReport": {
        "path": ".runtime/ai-painter/stage4-stage0-visual-generalization-causal-adjudications/20260817-024048736/causal-analysis-report.json",
        "sha256": "815688e0a21ab75e12d44e1206464e82a43872ada280698e29e85d9a13350495",
    },
    "causalAdjudication": {
        "path": ".runtime/ai-painter/stage4-stage0-visual-generalization-causal-adjudications/20260817-024048736/adjudication.json",
        "sha256": "fe4dab3afc812198de8e69d055550414d9ad9dfae9cd09570bd8d944e09b4ada",
    },
    "inactiveRepairContract": {
        "path": ".runtime/ai-painter/stage4-stage0-visual-generalization-causal-adjudications/20260817-024048736/inactive-repair-contract.json",
        "sha256": "a613e7a9b57edc2a9b28e45dcd1b78e3a957434fd0d999727cf017b97b9c4180",
    },
}
STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_final_visible_reference_feature_structure_obligation_v1"
)
STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_EVIDENCE_BINDINGS = {
    "causalAdjudicationTerminal": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-visible-semantic-causal-adjudications/20260817-144141271-stage0-four-object-adjudication/phase-terminal.json",
        "sha256": "313f18feaee309176cc1939e6300ed0731d8f39c9fc2c5d5bc46e6f25c54136b",
    },
    "causalAdjudication": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-visible-semantic-causal-adjudications/20260817-144141271-stage0-four-object-adjudication/adjudication.json",
        "sha256": "0a51964b062210e0aa5e850c80ca80062cf47a38ae348a32a60f42b36712703b",
    },
    "inactiveRepairContract": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-visible-semantic-causal-adjudications/20260817-144141271-stage0-four-object-adjudication/inactive-repair-contract.json",
        "sha256": "6e572faf2c3cfafbd3e19d957a0aa229dd37b4533ff2d9495f21804aa4b953b2",
    },
    "ownerActionRequest": {
        "path": ".runtime/ai-painter/stage4-stage0-four-object-visible-semantic-causal-adjudications/20260817-144141271-stage0-four-object-adjudication/owner-action-request.json",
        "sha256": "ca8b2b0d227c2af0f3bb9a0006d1c96a0ea606751d9625214b2bae09181d2d3c",
    },
}
STAGE4_BEST_CHECKPOINT_TERMINAL_QUALIFICATION_IDENTITY_SEPARATION_ID = (
    "stage4_best_checkpoint_and_terminal_qualification_identity_separation_v1"
)
STAGE4_BEST_CHECKPOINT_TERMINAL_QUALIFICATION_IDENTITY_SEPARATION_EVIDENCE = {
    "causalAdjudicationTerminalSha256": "7f8b54f783376ac8dac3c1dc526786c5b5230967a1e8c70c5feaea6cade37545",
    "analysisReportSha256": "ad23107489a1e8f8a9e5823d485670a1b05526fcb5570f27ac058ebc631afb69",
    "decisionSha256": "0a5c78edc4ead6cd93a03431281c93ebf2acefb27f1ef88ae28e2721217e68e7",
    "inactiveRepairContractSha256": "57d3489cce2235867d99617cd1f311eedab0580f3f68f82edf13751469155761",
}


def fact_conditioned_semantic_mixture_diagnostic_fields(config):
    """Keep exact historical registries and extend only the selected bounded repair."""
    if "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision" in config.get("training", {}):
        return STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_DIAGNOSTIC_FIELDS
    if "stage4ObjectVisibleStructureSupervision" in config.get("training", {}):
        return STAGE4_OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS
    if "stage4VegetationLuminanceSpatialStructureSupervision" in config.get("training", {}):
        return STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_DIAGNOSTIC_FIELDS
    if "stage4VegetationFinalVisibleSemanticRepair" in config.get("training", {}):
        return STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    return FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
FACT_CONDITIONED_SEMANTIC_MIXTURE_REGISTRATION_DECISION_BINDINGS = {
    "ownershipAnalysisTerminal": {
        "path": ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-diagnostic-field-analyses/20260812-021851078/phase-terminal.json",
        "sha256": "62d383a67277e0dc839afd946e2036cffbd61187cec47db1728d59fe6aceb77b",
    },
    "ownershipAnalysisReport": {
        "path": ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-diagnostic-field-analyses/20260812-021851078/analysis-report.json",
        "sha256": "e8381db6ca0b21f043b9cd8ba129552b597447e2df6b6dbf342e6848df179a2c",
    },
    "inactiveRegistrationDecisionContract": {
        "path": ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-diagnostic-field-analyses/20260812-021851078/inactive-registration-decision-contract.json",
        "sha256": "0b7c3e89c92d443852277e6b97692b4504ca809b7fc2f4d2b564447a4236d405",
    },
}


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
    parser.add_argument("--stage4-structure-fact-first-phase0-c-reproduce", action="store_true")
    parser.add_argument("--stage4-structure-fact-first-phase0-causal", action="store_true")
    parser.add_argument("--phase0-execution-identity", type=Path)
    parser.add_argument("--phase0-diagnostic-checkpoint", type=Path)
    parser.add_argument("--stage-control-dry-run", action="store_true")
    parser.add_argument("--stage-control-authorization", type=Path)
    parser.add_argument("--stage-control-authorization-sha256")
    parser.add_argument("--authorization-lineage-preflight", action="store_true")
    parser.add_argument("--stage4-responsibility-component-smoke", action="store_true")
    parser.add_argument("--stage4-predecessor-output-identity", type=Path)
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    if args.stage4_responsibility_component_smoke:
        from train_stage4_isolated_responsibility_component_smoke import run as run_component_smoke
        return run_component_smoke(args, config, package)
    training_identity = config.get("training", {})
    structure_smoke_owner = training_identity.get("ownerTrainingAuthorization", {})
    structure_smoke_registered = (
        training_identity.get("trainingAuthorizationStatus")
        == STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS
    )
    structure_smoke_preflight = (
        structure_smoke_registered
        and structure_smoke_owner.get("executionState") == "preflight_unconsumed"
        and structure_smoke_owner.get("preflightOnly") is True
    )
    if structure_smoke_registered:
        if structure_smoke_preflight and not args.preflight_only:
            raise ValueError("structure-fact-first Smoke preflight identity requires --preflight-only")
        if args.preflight_only and not structure_smoke_preflight:
            raise ValueError("structure-fact-first Smoke --preflight-only requires the preflight_unconsumed identity")
    lineage_fixture = config.get("training", {}).get("v9Stage4SmokeExecution", {}).get("cpuContractFixture") is True
    if lineage_fixture and not args.authorization_lineage_preflight:
        raise ValueError("CPU authorization lineage fixture cannot enter a normal trainer execution")
    if args.authorization_lineage_preflight and not args.preflight_only:
        raise ValueError("Authorization lineage preflight requires --preflight-only")
    validate_training_inputs(config, package)
    stage_mode = None
    stage_execution_grant = None
    try:
        stage_mode = resolve_stage_mode(config)
        stage_execution_grant = resolve_stage_execution_grant(
            config,
            verify_owner_files=args.stage_control_dry_run,
        )
    except ValueError:
        if is_registered_stage_control_config(config):
            raise
    if args.stage_control_dry_run:
        if not args.preflight_only:
            raise ValueError("Stage control dry-run requires --preflight-only")
        if stage_mode is not None and stage_mode.mode_id in {
            "structure_fact_first_stage4_phase0",
            "structure_fact_first_stage4_smoke",
            "condition_preserving_semantic_renderer_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            if stage_execution_grant.dataset_constraints.get("selectedSplit") is not None:
                stage_execution_grant.require(ExecutionAction.SELECT_BOUND_SAMPLE)
            stage_execution_grant.require(ExecutionAction.INSPECT_AUTOENCODER_IDENTITY)
            stage_execution_grant.require(ExecutionAction.INSPECT_CHECKPOINT_IDENTITY)
        else:
            if args.stage_control_authorization is None or not args.stage_control_authorization_sha256:
                raise ValueError("Stage control dry-run requires the immutable control authorization identity")
            control_grant = resolve_control_refactor_grant(
                args.stage_control_authorization,
                args.stage_control_authorization_sha256,
            )
            control_grant.require(ExecutionAction.SELECT_BOUND_SAMPLE)
            control_grant.require(ExecutionAction.INSPECT_AUTOENCODER_IDENTITY)
            control_grant.require(ExecutionAction.INSPECT_CHECKPOINT_IDENTITY)
    phase0_mode = (
        args.stage4_validation_kernel_phase0_update
        or args.stage4_validation_kernel_phase0_reproduce
        or args.stage4_structure_fact_first_phase0_c_reproduce
        or args.stage4_structure_fact_first_phase0_causal
    )
    if sum(bool(value) for value in (
        args.stage4_validation_kernel_phase0_update,
        args.stage4_validation_kernel_phase0_reproduce,
        args.stage4_structure_fact_first_phase0_c_reproduce,
        args.stage4_structure_fact_first_phase0_causal,
    )) > 1:
        raise ValueError("Stage4 validation kernel Phase0 execution modes are mutually exclusive")
    if phase0_mode and not args.stage_control_dry_run:
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
        and stage_mode is not None
        and stage_mode.adapter_binding in {"legacy_v7_stage3_adapter", "legacy_v7_stage4_adapter"}
    ):
        training = config["training"]
        authorization_status = training.get("trainingAuthorizationStatus")
        stage4_bounded_smoke = stage_mode.mode_id in {
            "v7_r5_stage4_bounded_preflight",
            "v7_r5_stage4_bounded_smoke",
        }
        stage4_mode = stage_mode.mode_id in {
            "v7_r5_stage4_preflight",
            "v7_r5_stage4_full_training",
        }
        if stage4_bounded_smoke:
            smoke_contract = training.get("r5Stage4BoundedRepairSmokeContract", {})
            continuation = training.get("r5Stage4BoundedRepairCheckpointContinuation", {})
            if stage_mode.execution_kind == "single_sample_preflight" and args.preflight_only is not True:
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
            if stage_mode.execution_kind == "full_training_preflight" and args.preflight_only is not True:
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
    if stage_mode is not None and stage_mode.adapter_binding == "legacy_v8_stage4_adapter":
        training = config["training"]
        if stage_mode.execution_kind == "cpu_inactive":
            if args.preflight_only is not True:
                raise ValueError("V8 Stage 4 inactive Smoke config cannot execute training")
            if args.initial_denoiser_checkpoint is not None:
                raise ValueError("V8 Stage 4 Smoke must start from project random V8 initialization")
        elif stage_mode.execution_kind in {"single_sample_preflight", "single_sample_smoke"}:
            if stage_mode.execution_kind == "single_sample_preflight" and args.preflight_only is not True:
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
    if stage_mode is not None and stage_mode.adapter_binding == "legacy_v9_stage4_adapter":
        training = config["training"]
        smoke_contract = training.get("v9Stage4SingleSampleSmokeContract", {})
        if stage_mode.execution_kind == "cpu_inactive":
            if args.preflight_only is not True and not phase0_mode:
                raise ValueError("V9 Stage 4 inactive CPU support configuration cannot execute training")
        elif stage_mode.execution_kind == "single_sample_smoke":
            if args.preflight_only is True and not args.stage_control_dry_run and not args.authorization_lineage_preflight:
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
    if stage_mode is not None and stage_mode.adapter_binding == "structure_fact_first_phase0_adapter":
        training = config["training"]
        phase0_contract = training.get("structureFactFirstPhase0Contract", {})
        execution_state = training.get("ownerTrainingAuthorization", {}).get("executionState")
        if args.stage_control_dry_run:
            if execution_state != "preflight_unconsumed":
                raise ValueError("structure-fact-first Phase0 dry-run requires an unconsumed execution identity")
        elif execution_state != "consumed":
            raise ValueError("structure-fact-first Phase0 execution requires an atomically consumed identity")
        if not phase0_mode:
            raise ValueError("structure-fact-first Phase0 ModeSpec cannot enter a non-Phase0 execution")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("structure-fact-first Phase0 forbids every parent Denoiser Checkpoint")
        if args.single_sample_overfit_smoke is not True or args.smoke_test:
            raise ValueError("structure-fact-first Phase0 requires its bound single-sample path")
        if args.overfit_sample_id != phase0_contract.get("sampleId") or args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("structure-fact-first Phase0 fixed sample identity does not match")
        if int(args.overfit_epochs or 0) != 1 or int(args.overfit_evaluation_interval) != 1:
            raise ValueError("structure-fact-first Phase0 requires exactly one bounded step schedule")
        if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_structure_fact_first_denoiser":
            raise ValueError("structure-fact-first Phase0 initialization or resolution is invalid")
        if phase0_contract.get("sampleSplit") != "validation" or phase0_contract.get("requiredBoundarySides") != ["west"]:
            raise ValueError("structure-fact-first Phase0 sample split or topology is invalid")
    if stage_mode is not None and stage_mode.adapter_binding == "structure_fact_first_stage4_smoke_adapter":
        training = config["training"]
        smoke_contract = training.get("structureFactFirstStage4SingleSampleSmokeContract", {})
        if phase0_mode:
            raise ValueError("structure-fact-first model Smoke cannot enter Phase0")
        if stage_mode.execution_kind != "single_sample_smoke":
            raise ValueError("structure-fact-first model Smoke ModeSpec is invalid")
        execution_state = training.get("ownerTrainingAuthorization", {}).get("executionState")
        if args.preflight_only is True:
            if execution_state != "preflight_unconsumed" or not args.stage_control_dry_run:
                raise ValueError("structure-fact-first Smoke preflight requires the isolated unconsumed dry-run identity")
        elif execution_state != "consumed":
            raise ValueError("structure-fact-first model Smoke execution requires an atomically consumed identity")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("structure-fact-first model Smoke forbids every parent Denoiser Checkpoint")
        if args.single_sample_overfit_smoke is not True or args.smoke_test:
            raise ValueError("structure-fact-first authorization permits only the bound single-sample Smoke")
        if args.overfit_sample_id != smoke_contract.get("sampleId") or args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("structure-fact-first fixed Smoke sample identity does not match")
        if int(args.overfit_epochs or 0) != 30 or int(smoke_contract.get("epochCount", 0)) != 30:
            raise ValueError("structure-fact-first model Smoke requires exactly 30 Epoch")
        if int(args.overfit_evaluation_interval) != 5 or smoke_contract.get("previewEpochs") != [1, 5, 10, 20, 30]:
            raise ValueError("structure-fact-first model Smoke preview schedule does not match")
        if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_structure_fact_first_denoiser":
            raise ValueError("structure-fact-first model Smoke initialization or resolution is invalid")
        if smoke_contract.get("sampleSplit") != "validation" or smoke_contract.get("requiredBoundarySides") != ["west"]:
            raise ValueError("structure-fact-first model Smoke split or topology is invalid")
    if stage_mode is not None and stage_mode.adapter_binding == "condition_preserving_semantic_renderer_stage4_smoke_adapter":
        training = config["training"]
        smoke_contract = training.get("conditionPreservingSemanticRendererStage4SingleSampleSmokeContract", {})
        if phase0_mode:
            raise ValueError("condition-preserving semantic renderer model Smoke cannot enter Phase0")
        if stage_mode.execution_kind != "single_sample_smoke":
            raise ValueError("condition-preserving semantic renderer model Smoke ModeSpec is invalid")
        execution_state = training.get("ownerTrainingAuthorization", {}).get("executionState")
        if args.stage_control_dry_run:
            if execution_state != "consumed" or args.preflight_only is not True:
                raise ValueError("semantic renderer Smoke dry-run requires the isolated consumed CPU fixture identity")
        elif args.preflight_only:
            raise ValueError("semantic renderer active Smoke cannot use --preflight-only outside the CPU dry-run")
        elif execution_state != "consumed":
            raise ValueError("semantic renderer model Smoke execution requires an atomically consumed identity")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("semantic renderer model Smoke forbids every parent Denoiser Checkpoint")
        if args.single_sample_overfit_smoke is not True or args.smoke_test:
            raise ValueError("semantic renderer authorization permits only the bound single-sample Smoke")
        if args.overfit_sample_id != smoke_contract.get("sampleId") or args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("semantic renderer fixed Smoke sample identity does not match")
        if int(args.overfit_epochs or 0) != 30 or int(smoke_contract.get("epochCount", 0)) != 30:
            raise ValueError("semantic renderer model Smoke requires exactly 30 Epoch")
        if int(args.overfit_evaluation_interval) != 5 or smoke_contract.get("previewEpochs") != [1, 5, 10, 20, 30]:
            raise ValueError("semantic renderer model Smoke preview schedule does not match")
        if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_condition_preserving_semantic_renderer":
            raise ValueError("semantic renderer model Smoke initialization or resolution is invalid")
        if smoke_contract.get("sampleSplit") != "validation" or smoke_contract.get("requiredBoundarySides") != ["west"]:
            raise ValueError("semantic renderer model Smoke split or topology is invalid")
    if stage_mode is not None and stage_mode.adapter_binding == "fact_conditioned_semantic_mixture_stage4_smoke_adapter":
        training = config["training"]
        smoke_contract = training.get("factConditionedSemanticMixtureStage4SingleSampleSmokeContract", {})
        if phase0_mode:
            raise ValueError("fact-conditioned semantic mixture model Smoke cannot enter Phase0")
        if stage_mode.execution_kind != "single_sample_smoke":
            raise ValueError("fact-conditioned semantic mixture model Smoke ModeSpec is invalid")
        execution_state = training.get("ownerTrainingAuthorization", {}).get("executionState")
        if args.stage_control_dry_run:
            if execution_state != "consumed" or args.preflight_only is not True:
                raise ValueError("fact-conditioned semantic mixture Smoke dry-run requires the consumed CPU fixture identity")
        elif args.preflight_only:
            raise ValueError("fact-conditioned semantic mixture active Smoke cannot use --preflight-only outside CPU dry-run")
        elif execution_state != "consumed":
            raise ValueError("fact-conditioned semantic mixture model Smoke requires an atomically consumed identity")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("fact-conditioned semantic mixture model Smoke forbids every parent Denoiser Checkpoint")
        if args.single_sample_overfit_smoke is not True or args.smoke_test:
            raise ValueError("fact-conditioned semantic mixture authorization permits only the bound single-sample Smoke")
        if args.overfit_sample_id != smoke_contract.get("sampleId") or args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("fact-conditioned semantic mixture fixed Smoke sample identity does not match")
        if int(args.overfit_epochs or 0) != 30 or int(smoke_contract.get("epochCount", 0)) != 30:
            raise ValueError("fact-conditioned semantic mixture model Smoke requires exactly 30 Epoch")
        if int(args.overfit_evaluation_interval) != 5 or smoke_contract.get("previewEpochs") != [1, 5, 10, 20, 30]:
            raise ValueError("fact-conditioned semantic mixture model Smoke preview schedule does not match")
        if args.resolution_stage != 0 or training.get("authorizedInitialization") != "project_random_fact_conditioned_semantic_mixture":
            raise ValueError("fact-conditioned semantic mixture model Smoke initialization or resolution is invalid")
        if smoke_contract.get("sampleSplit") != "validation" or smoke_contract.get("requiredBoundarySides") != ["west"]:
            raise ValueError("fact-conditioned semantic mixture model Smoke split or topology is invalid")
    if stage_mode is not None and stage_mode.adapter_binding == "fact_conditioned_semantic_mixture_full_training_adapter":
        training = config["training"]
        full_contract = training.get("factConditionedSemanticMixtureStage4FullTrainingContract", {})
        expected_stage = {
            "full_training_stage0": 0,
            "full_training_stage1": 1,
            "full_training_stage2": 2,
        }.get(stage_mode.execution_kind)
        if expected_stage is None or stage_mode.stage != expected_stage:
            raise ValueError("semantic mixture formal Stage ModeSpec is invalid")
        if phase0_mode or args.single_sample_overfit_smoke or args.smoke_test:
            raise ValueError("semantic mixture formal Stage cannot enter Phase0 or Smoke")
        if args.overfit_sample_id is not None or args.overfit_epochs is not None:
            raise ValueError("semantic mixture formal Stage cannot carry single-sample arguments")
        if args.resolution_stage != expected_stage:
            raise ValueError("semantic mixture formal Stage resolution identity is invalid")
        if int(training.get("denoiserEpochs", 0)) != 40:
            raise ValueError("semantic mixture formal Stage requires exactly 40 Epoch")
        if training.get("fixedEpochPreviewPolicy", {}).get("formalStage") != [1, 5, 10, 20, 30, 40]:
            raise ValueError("semantic mixture formal Stage preview schedule is invalid")
        if full_contract != {
            "status": "active_owner_authorized_independent_stage_execution",
            "stage": expected_stage,
            "resolution": training["resolutionStages"][expected_stage],
            "epochCount": 40,
            "previewEpochs": [1, 5, 10, 20, 30, 40],
            "datasetCapacity": 64,
            "splitCounts": V7_MVP64_SPLIT_COUNTS,
            "initialization": (
                "project_random_fact_conditioned_semantic_mixture"
                if expected_stage == 0
                else f"current_run_stage_{expected_stage - 1}_checkpoint_only"
            ),
            "parentCheckpointRequired": expected_stage > 0,
            "smokeCheckpointAllowed": False,
            "historicalCheckpointAllowed": False,
            "automaticRetryAllowed": False,
        }:
            raise ValueError("semantic mixture formal Stage execution contract is invalid")
        if expected_stage == 0 and args.initial_denoiser_checkpoint is not None:
            raise ValueError("semantic mixture Stage 0 must use fixed random initialization")
        if expected_stage > 0 and args.initial_denoiser_checkpoint is None and not args.preflight_only:
            raise ValueError("semantic mixture progressive Stage requires its current-run parent Checkpoint")
        if training.get("authorizedInitialization") != (
            "project_random_fact_conditioned_semantic_mixture"
            if expected_stage == 0
            else f"current_run_stage_{expected_stage - 1}_checkpoint_only"
        ):
            raise ValueError("semantic mixture formal Stage initialization contract is invalid")
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
    overfit_evidence = build_single_sample_overfit_evidence(
        datasets,
        args,
        config,
        execution_grant=stage_execution_grant,
    )
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
            "stageControlMode": stage_mode.mode_id if stage_mode else None,
            "stageControlExecutionGrant": stage_execution_grant.as_dict() if stage_execution_grant else None,
            "stageControlDryRun": bool(args.stage_control_dry_run),
            "phase0ExecutionAuthorizationLineageValidated": bool(
                phase0_mode and not args.stage_control_dry_run
            ),
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
        if stage_mode is not None and stage_mode.mode_id == "v7_r5_stage4_bounded_smoke":
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
        if stage_mode is not None and stage_mode.mode_id == "v7_r5_stage4_bounded_smoke":
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
        stage_execution_grant is not None
        and (
            stage_execution_grant.permits(ExecutionAction.WRITE_SMOKE_CHECKPOINT)
            or any(stage_execution_grant.permits(action) for action in (
                ExecutionAction.RUN_STAGE0,
                ExecutionAction.RUN_STAGE1,
                ExecutionAction.RUN_STAGE2,
            ))
        )
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
    best_checkpoint_route_required_boundary_contact = None
    terminal_identity_contract = (
        validate_stage4_best_checkpoint_and_terminal_qualification_identity_separation(
            config
        )
    )
    terminal_qualification_state = None
    terminal_qualification_preview_reproduction = None
    batch_target = min(len(loaders["train"]), max_train_batches) if max_train_batches is not None else len(loaders["train"])
    epoch_worst_replay_contract = validate_stage4_epoch_worst_sample_class_replay(config)
    path_replay_passes = (
        0 if epoch_worst_replay_contract is not None
        else r5_path_replay_passes_per_epoch(config)
    )
    epoch_worst_replay_passes = (
        int(epoch_worst_replay_contract["replay"]["passesPerObservedPrimaryBatch"])
        if epoch_worst_replay_contract is not None else 0
    )
    optimizer_steps_per_batch = 1 + path_replay_passes + epoch_worst_replay_passes
    optimizer_steps_per_epoch = batch_target * optimizer_steps_per_batch
    optimizer_step_target = epoch_count * optimizer_steps_per_epoch
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
    epoch_complete_selection_state = {}

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
                epoch * optimizer_steps_per_epoch
                + batch_progress["optimizerStepsCompletedInEpoch"]
            )
            completed_training_samples = (
                epoch * train_samples_target_per_epoch
                + batch_progress["samplesProcessedInEpoch"]
            )
            local_denoiser_sample_forward_passes = completed_training_samples * (
                (1 + trajectory_steps_per_sample) * (1 + path_replay_passes)
                + epoch_worst_replay_passes
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
            epoch_complete_selection_state=epoch_complete_selection_state,
            # A bounded single-sample Smoke keeps sample 194 as its primary
            # optimization/preview identity, while this contract's detached
            # selector must still observe the immutable 48-record train split.
            epoch_complete_train_dataset=datasets["train"],
        )
        epoch_complete_train_result = epoch_complete_selection_state.get(
            "priorEpochResult"
        )
        epoch_complete_reference_feature_train_result = (
            epoch_complete_selection_state.get("priorReferenceFeatureEpochResult")
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
            if epoch_complete_train_result is not None:
                row[
                    "trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections"
                ] = deepcopy(epoch_complete_train_result["perClassSelections"])
            if epoch_complete_reference_feature_train_result is not None:
                row[
                    "trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections"
                ] = deepcopy(
                    epoch_complete_reference_feature_train_result["perClassSelections"]
                )
            register_v9_stage4_diagnostic_manifest_fields(row, train_metrics, epoch + 1, config)
            metrics.append(row)
            latest_live_progress = build_live_progress(
                phase="epoch_completed",
                epoch=epoch + 1,
                epoch_target=epoch_count,
                batch=batch_target,
                batch_target=batch_target,
                optimizer_step=(epoch + 1) * optimizer_steps_per_epoch,
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
            optimizer_step=(epoch + 1) * optimizer_steps_per_epoch,
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
                    (
                        datasets["validation"]
                        if config.get("training", {}).get(
                            "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
                            {},
                        ).get("status") == "training_loss_active_owner_authorized"
                        else optimization_datasets["validation"]
                    ),
                    diffusion,
                    latent_normalization,
                    device,
                    seed + 3000,
                    config,
                    args.output_dir / "fixed-epoch-previews",
                    epoch + 1,
                )
            if uses_stage4_unified_preview_sampling_contract(config):
                preview_epoch = epoch + 1
                if should_reproduce_stage4_fixed_epoch_preview(config, preview_epoch):
                    source_preview = rollout_validation.get("previewArtifact")
                    with stage4_fixed_preview_determinism_scope(True):
                        repeated_metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                            model,
                            (
                                datasets["validation"]
                                if config.get("training", {}).get(
                                    "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
                                    {},
                                ).get("status") == "training_loss_active_owner_authorized"
                                else optimization_datasets["validation"]
                            ),
                            diffusion,
                            latent_normalization,
                            device,
                            seed + 3000,
                            config,
                            args.output_dir / "fixed-epoch-preview-reproductions",
                            preview_epoch,
                        )
                    repeated_preview = repeated_metrics.get("previewArtifact")
                    rollout_validation["previewReproductionArtifact"] = validate_stage4_fixed_epoch_preview_reproduction(
                        source_preview,
                        repeated_preview,
                        preview_epoch,
                    )
                else:
                    rollout_validation["previewReproductionArtifact"] = build_stage4_fixed_epoch_preview_skip_record(
                        rollout_validation,
                        preview_epoch,
                    )
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
        if epoch_complete_train_result is not None:
            row[
                "trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections"
            ] = deepcopy(epoch_complete_train_result["perClassSelections"])
        if epoch_complete_reference_feature_train_result is not None:
            row[
                "trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections"
            ] = deepcopy(
                epoch_complete_reference_feature_train_result["perClassSelections"]
            )
        for key, value in validation.items():
            if key not in {"compositeConditionQualityScore", "velocityPredictionMse", "cleanLatentMae", "fixedTimesteps"}:
                row[f"validationFixedGrid{upper_camel(key)}"] = value
        register_v9_stage4_diagnostic_manifest_fields(row, train_metrics, epoch + 1, config)
        if terminal_identity_contract is not None and epoch + 1 == 30:
            terminal_qualification_state = deepcopy({
                key: value.detach().cpu()
                for key, value in model.denoiser.state_dict().items()
            })
            terminal_qualification_preview_reproduction = row.get(
                "validationPreviewReproductionArtifact"
            )
            if not isinstance(terminal_qualification_preview_reproduction, dict):
                raise ValueError(
                    "Stage 4 terminal qualification Epoch 30 preview reproduction is missing"
                )
            if not all(
                terminal_qualification_preview_reproduction.get(key) is True
                for key in (
                    "modelStateSha256Matches",
                    "conditionTensorSha256Matches",
                    "rgbTensorSha256Matches",
                    "pngByteSha256Matches",
                )
            ):
                raise ValueError(
                    "Stage 4 terminal qualification Epoch 30 preview is not byte-exact"
                )
        route_required_boundary_contact = validation.get(
            "stage4DiagnosticRouteRequiredBoundaryContactMinimum"
        )
        worst_sample_class_contract_active = config.get("training", {}).get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("status") == "training_loss_active_owner_authorized"
        if worst_sample_class_contract_active and route_required_boundary_contact is None:
            raise ValueError(
                "Stage 4 worst sample-class checkpoint qualification requires the route west-boundary metric"
            )
        route_non_regression_passed = (
            stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(
                config,
                route_required_boundary_contact,
                best_checkpoint_route_required_boundary_contact,
            )
        )
        if worst_sample_class_contract_active:
            row["stage4CheckpointRouteWestBoundaryNonRegressionPassed"] = (
                route_non_regression_passed
            )
        if validation_loss < best_validation_loss and route_non_regression_passed:
            best_validation_loss = validation_loss
            best_epoch = epoch + 1
            best_denoiser_state = deepcopy({key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()})
            if worst_sample_class_contract_active:
                best_checkpoint_route_required_boundary_contact = float(
                    route_required_boundary_contact
                )
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
            optimizer_step=(epoch + 1) * optimizer_steps_per_epoch,
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
    terminal_qualification_identity = None
    if terminal_identity_contract is not None:
        if terminal_qualification_state is None:
            raise ValueError("Stage 4 terminal qualification Epoch 30 state is missing")
        terminal_state_sha256 = state_dict_sha256(terminal_qualification_state)
        best_state_sha256 = state_dict_sha256(best_denoiser_state)
        source_preview = terminal_qualification_preview_reproduction.get("sourcePreview")
        repeated_preview = terminal_qualification_preview_reproduction.get("repeatedPreview")
        if not isinstance(source_preview, dict) or not isinstance(repeated_preview, dict):
            raise ValueError("Stage 4 terminal qualification preview identities are missing")
        if not (
            source_preview.get("denoiserStateSha256")
            == terminal_state_sha256
            == repeated_preview.get("denoiserStateSha256")
        ):
            raise ValueError("Stage 4 terminal qualification state identity mismatch")
        terminal_identity_dir = args.output_dir / "terminal-qualification-identity"
        terminal_identity_dir.mkdir(parents=True, exist_ok=False)
        terminal_state_path = terminal_identity_dir / "epoch-030-denoiser-state.pt"
        torch.save({
            "schemaVersion": "stage4-terminal-qualification-model-state-artifact-v1",
            "role": "non_promotable_late_stability_qualification_evidence_only",
            "terminalEpoch": 30,
            "stage0InitializationEligible": False,
            "denoiserStateSha256": terminal_state_sha256,
            "denoiserState": terminal_qualification_state,
        }, terminal_state_path)
        terminal_qualification_identity = {
            "schemaVersion": "stage4-best-checkpoint-terminal-qualification-identity-separation-evidence-v1",
            "status": "terminal_epoch_30_identity_saved_and_preview_reproduced_exactly",
            "contractId": STAGE4_BEST_CHECKPOINT_TERMINAL_QUALIFICATION_IDENTITY_SEPARATION_ID,
            "terminalEpoch": 30,
            "terminalDenoiserStateSha256": terminal_state_sha256,
            "terminalStateArtifactPath": project_path(terminal_state_path),
            "terminalStateArtifactSha256": sha256_file(terminal_state_path),
            "terminalStateArtifactRole": "non_promotable_late_stability_qualification_evidence_only",
            "terminalCheckpointPromotable": False,
            "stage0InitializationEligible": False,
            "sourcePreview": source_preview,
            "reproducedPreview": repeated_preview,
            "denoiserStateIdentityMatches": True,
            "previewSha256Matches": source_preview.get("previewSha256") == repeated_preview.get("previewSha256"),
            "bestCheckpointEpoch": int(best_epoch),
            "bestCheckpointDenoiserStateSha256": best_state_sha256,
            "bestCheckpointSelectionContractUnchanged": True,
            "identityRolesSeparated": True,
            "crossIdentitySubstitutionAllowed": False,
            "mainCheckpointFormatChanged": False,
            "machineReviewThresholdsChanged": False,
        }
        if terminal_qualification_identity["previewSha256Matches"] is not True:
            raise ValueError("Stage 4 terminal qualification byte-exact preview mismatch")
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
        if not isinstance(source_preview, dict) and not run_is_smoke:
            with stage4_fixed_preview_determinism_scope(True):
                source_metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                    model,
                    optimization_datasets["validation"],
                    diffusion,
                    latent_normalization,
                    device,
                    seed + 3000,
                    config,
                    args.output_dir / "checkpoint-bound-preview-source",
                    best_epoch,
                    force_checkpoint_bound_preview=True,
                )
            source_preview = source_metrics.get("previewArtifact")
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
                force_checkpoint_bound_preview=True,
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
    if terminal_qualification_identity is not None:
        manifest["stage4TerminalQualificationIdentity"] = terminal_qualification_identity
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
            (1 + trajectory_steps_per_sample) * (1 + path_replay_passes)
            + epoch_worst_replay_passes
            + cross_domain_rollout_steps_per_sample
        ),
        local_training_token_count=epoch_count * train_samples_target_per_epoch * (
            (1 + trajectory_steps_per_sample) * (1 + path_replay_passes)
            + epoch_worst_replay_passes
            + cross_domain_rollout_steps_per_sample
        ) * latent_spatial_positions,
    )
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "completed", run_is_smoke, manifest, completed_live_progress)
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


def build_single_sample_overfit_evidence(datasets, args, config, execution_grant=None):
    if not args.single_sample_overfit_smoke:
        return {
            "enabled": False,
            "nonFormal": False,
        }
    if args.smoke_test:
        raise ValueError("single-sample overfit smoke and program smoke-test are mutually exclusive")
    configured_split = "train"
    training = config.get("training", {})
    if execution_grant is None and (
        is_v8_stage4_decoded_alignment(config)
        or is_v9_stage4_object_semantic_decoded_alignment(config)
        or training.get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate"
    ):
        try:
            execution_grant = resolve_stage_execution_grant(config)
        except ValueError:
            if is_registered_stage_control_config(config):
                raise
            execution_grant = None
    if execution_grant is not None and execution_grant.permits(ExecutionAction.SELECT_BOUND_SAMPLE):
        configured_split = execution_grant.dataset_constraints.get("selectedSplit") or "train"
        if is_v8_stage4_decoded_alignment(config) or is_v9_stage4_object_semantic_decoded_alignment(config):
            if configured_split != "validation":
                raise ValueError("V8/V9 Stage 4 must preserve the bound validation sample")
        expected_sample_id = execution_grant.dataset_constraints.get("sampleId")
        if expected_sample_id and args.overfit_sample_id != expected_sample_id:
            raise ValueError("single-sample selection does not match ExecutionGrant dataset constraints")
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
    try:
        execution_grant = resolve_stage_execution_grant(config)
    except ValueError:
        if is_registered_stage_control_config(config):
            raise
        execution_grant = None
    if execution_grant is None or not execution_grant.permits(ExecutionAction.SELECT_BOUND_SAMPLE):
        return {
            "enabled": False,
            "status": "not_applicable_non_stage4_bounded_smoke",
        }
    if overfit_evidence.get("enabled") is not True:
        raise ValueError("Stage4 sample-bound boundary provenance requires the fixed Smoke sample")
    if is_structure_fact_first_stage4(config):
        smoke_contract = training.get("structureFactFirstStage4SingleSampleSmokeContract") or training.get("structureFactFirstPhase0Contract", {})
    elif is_condition_preserving_semantic_renderer_stage4(config):
        smoke_contract = (
            training.get("conditionPreservingSemanticRendererStage4SingleSampleSmokeContract")
            or training.get("conditionPreservingSemanticRendererSampleBinding", {})
        )
    elif is_fact_conditioned_semantic_mixture_stage4(config):
        smoke_contract = (
            training.get("factConditionedSemanticMixtureStage4SingleSampleSmokeContract")
            or training.get("factConditionedSemanticMixtureSampleBinding", {})
        )
    elif is_v9_stage4_object_semantic_decoded_alignment(config):
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
    try:
        execution_grant = resolve_stage_execution_grant(config)
    except ValueError:
        if is_registered_stage_control_config(config):
            raise
        execution_grant = None
    if execution_grant is None or not execution_grant.permits(ExecutionAction.CREATE_OPTIMIZER):
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
        "epoch_worst_sample_class_replay",
        "epoch_complete_per_class_selected_luminance_replay",
        "epoch_complete_per_class_selected_reference_feature_replay",
        "checkpoint_write",
    }
    if step not in allowed_steps or status not in {"started", "completed", "failed"}:
        raise ValueError("Stage4 step telemetry event is invalid")
    if step in {
        "epoch_complete_per_class_selected_luminance_replay",
        "epoch_complete_per_class_selected_reference_feature_replay",
    }:
        required_detail_fields = {
            "epoch", "batch", "replayPass", "sampleId", "classIdentity",
            "selectionScore",
        }
        integer_fields_valid = all(
            isinstance(details.get(name), int)
            and not isinstance(details.get(name), bool)
            and details[name] > 0
            for name in ("epoch", "batch", "replayPass")
        )
        selection_score = details.get("selectionScore")
        if (
            status != "completed"
            or set(details) != required_detail_fields
            or not integer_fields_valid
            or not isinstance(details.get("sampleId"), str)
            or not details["sampleId"]
            or details.get("classIdentity")
            not in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
            or not isinstance(selection_score, (int, float))
            or isinstance(selection_score, bool)
            or not math.isfinite(float(selection_score))
        ):
            raise ValueError(
                "Stage4 epoch-complete replay telemetry details are invalid"
            )
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


STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER = (
    "terrain_grass",
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "terrain_natural_boundary",
    "terrain_mud_patch",
    "terrain_tall_grass",
    "walkable",
    "collision",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "focal_area",
    "object_instance",
    "coordinate_x",
    "coordinate_y",
    "signed_distance_path",
    "signed_distance_water",
    "signed_distance_shoreline",
    "signed_distance_object_ground",
    "signed_distance_boundary",
    "moisture_proximity",
)

# The existing Phase0 order is the formal complete-world 23-channel order.
# Architecture-specific validators must reference this shared identity rather
# than accepting any 23 distinct names or defining another ordered list.
FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER = (
    STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER
)


def stage4_structure_fact_first_phase0_condition_sha256(tensor, config) -> str:
    """Return one canonical single-sample identity for Phase0 condition tensors."""
    if tuple(config.get("conditionChannelOrder", ())) != STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER:
        raise ValueError("structure-fact-first Phase0 condition channel order changed")
    if int(config.get("conditionChannels", -1)) != len(STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER):
        raise ValueError("structure-fact-first Phase0 condition channel count changed")
    value = tensor
    if value.ndim == 4:
        if int(value.shape[0]) != 1:
            raise ValueError("structure-fact-first Phase0 condition identity requires a singleton batch")
        value = value[0]
    elif value.ndim != 3:
        raise ValueError("structure-fact-first Phase0 condition identity requires rank three or four")
    expected_shape = (len(STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER), 192, 256)
    if tuple(int(item) for item in value.shape) != expected_shape:
        raise ValueError("structure-fact-first Phase0 condition identity shape changed")
    if value.dtype != torch.float32:
        raise ValueError("structure-fact-first Phase0 condition identity dtype changed")
    return tensor_sha256(value)


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
    elif architecture == "stage4_structure_fact_first_dual_stage_generator_v1":
        validate_structure_fact_first_stage4_cpu_contract(config, package)
    elif architecture == "stage4_condition_preserving_semantic_renderer_v1":
        validate_condition_preserving_semantic_renderer_stage4_cpu_contract(config, package)
    elif architecture == "stage4_fact_conditioned_semantic_mixture_decoder_v1":
        validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(config, package)
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
    mode = resolve_stage_mode(config)
    if mode.mode_id in {
        "v9_stage4_unified_preview_smoke",
        "v9_stage4_validation_kernel_smoke",
    }:
        return validate_v9_stage4_unified_preview_active_contract(config, package, project_root)
    if mode.mode_id == "v9_stage4_smoke":
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
    if mode.execution_kind != "cpu_inactive":
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


def validate_condition_preserving_semantic_renderer_stage4_cpu_contract(
    config, package, project_root=None,
):
    mode = resolve_stage_mode(config)
    architecture = "stage4_condition_preserving_semantic_renderer_v1"
    smoke_mode = mode.mode_id == "condition_preserving_semantic_renderer_stage4_smoke"
    if (
        mode.mode_id not in {
            "condition_preserving_semantic_renderer_stage4_inactive",
            "condition_preserving_semantic_renderer_stage4_smoke",
        }
        or (smoke_mode and (mode.execution_kind != "single_sample_smoke" or mode.active_execution is not True))
        or (not smoke_mode and (mode.execution_kind != "cpu_inactive" or mode.active_execution is not False))
        or config.get("denoiserArchitecture") != architecture
    ):
        raise ValueError("Stage 4 semantic renderer mode identity is invalid")
    condition_channel_order = tuple(config.get("conditionChannelOrder", ()))
    if (
        config.get("conditionChannels")
        != len(FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER)
        or condition_channel_order != FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        or config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1"
        or config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1"
    ):
        raise ValueError("Stage 4 semantic renderer changed the locked condition or latent contract")
    if (
        conditional_dataset_selection_contract(config) != "registered_v7_capacity_contribution_v1"
        or package.get("v7CapacityContributionCount") != 64
    ):
        raise ValueError("Stage 4 semantic renderer changed the approved 64-row dataset identity")

    training = config.get("training", {})
    contract = training.get("stage4ConditionPreservingSemanticRenderer", {})
    expected_contract_fields = {
        "enabled", "status", "contractId", "architectureId", "conditionChannelCount",
        "latentOutputShapeChanged", "autoencoderFrozen", "newCheckpointSchemaRequired",
        "oldDenoiserCheckpointCompatible", "newRandomInitializationRequired",
        "programmaticPixelDrawingAllowed", "ruleTexturePastingAllowed",
        "reviewThresholdDrivenRenderingAllowed", "newFreeHyperparameterSelected",
        "learnedSemanticRenderer", "legalSupervision", "diagnosticManifestRegistry",
        "evidenceBindings", "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_contract_fields:
        raise ValueError("Stage 4 semantic renderer contract contains missing or unknown fields")
    expected_identity = {
        "enabled": smoke_mode,
        "status": "training_loss_active_owner_authorized" if smoke_mode else "cpu_support_verified_not_active",
        "contractId": architecture,
        "architectureId": architecture,
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "autoencoderFrozen": True,
        "newCheckpointSchemaRequired": True,
        "oldDenoiserCheckpointCompatible": False,
        "newRandomInitializationRequired": True,
        "programmaticPixelDrawingAllowed": False,
        "ruleTexturePastingAllowed": False,
        "reviewThresholdDrivenRenderingAllowed": False,
        "newFreeHyperparameterSelected": False,
    }
    for key, expected in expected_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"Stage 4 semantic renderer contract {key} is invalid")

    renderer = contract.get("learnedSemanticRenderer", {})
    if set(renderer) != {
        "channels", "sourceConditionChannels", "fusionScales", "fusionKind",
        "independentPerSemanticType", "primaryRgbPathPreserved",
        "dimensionsDerivedFromExistingModelScales",
    }:
        raise ValueError("Stage 4 learned semantic renderer contains unknown fields")
    if (
        renderer.get("channels") != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS)
        or renderer.get("sourceConditionChannels")
        != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS)
        or renderer.get("fusionScales") != ["up1", "up0"]
        or renderer.get("fusionKind") != "learned_condition_preserving_residual_gate_v1"
        or renderer.get("independentPerSemanticType") is not True
        or renderer.get("primaryRgbPathPreserved") is not True
        or renderer.get("dimensionsDerivedFromExistingModelScales") is not True
    ):
        raise ValueError("Stage 4 learned semantic renderer or fusion identity is invalid")

    allowed_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_visual_fact_manifest_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "frozen_project_autoencoder_encoder_and_decoder_features",
        "current_model_prediction_derived_without_failed_preview_targets",
    ]
    supervision = contract.get("legalSupervision", {})
    if set(supervision) != {
        "allowedSources", "semanticTargetChannels", "weightSource",
        "failedPreviewPixelsUsedAsTargets", "machineReviewThresholdsUsedAsTargets",
        "reviewPassFailUsedAsLossTarget", "failedSmokeCheckpointUsedAsTarget",
    }:
        raise ValueError("Stage 4 semantic renderer supervision contains unknown fields")
    if (
        supervision.get("allowedSources") != allowed_sources
        or supervision.get("semanticTargetChannels")
        != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS)
        or supervision.get("weightSource")
        != "training.denoiserLossWeights.discreteConditionOutputBinding"
        or supervision.get("failedPreviewPixelsUsedAsTargets") is not False
        or supervision.get("machineReviewThresholdsUsedAsTargets") is not False
        or supervision.get("reviewPassFailUsedAsLossTarget") is not False
        or supervision.get("failedSmokeCheckpointUsedAsTarget") is not False
    ):
        raise ValueError("Stage 4 semantic renderer legal supervision boundary is invalid")
    if float(training.get("denoiserLossWeights", {}).get("discreteConditionOutputBinding", 0.0)) <= 0.0:
        raise ValueError("Stage 4 semantic renderer cannot derive its existing supervision weight")

    registry = contract.get("diagnosticManifestRegistry", {})
    if (
        registry.get("exactFields")
        != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)
        or registry.get("exactFieldCount")
        != len(CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)
        or registry.get("rejectUnknownFields") is not True
    ):
        raise ValueError("Stage 4 semantic renderer diagnostic Manifest registry is invalid")
    validate_condition_preserving_semantic_renderer_stage4_diagnostic_manifest_support_contract(
        config
    )

    activation = contract.get("activationGate", {})
    activation_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smoke30EpochNow", "stage4FullTrainingNow",
        "strictRevalidationNow", "formalInferenceNow", "checkpointPromotionNow",
        "runtimeFrameNow", "worldEntryNow",
    }
    active_smoke_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smoke30EpochNow",
    } if smoke_mode else set()
    if set(activation) != activation_fields or any(
        activation.get(key) is not (key in active_smoke_fields)
        for key in activation_fields
    ):
        raise ValueError("Stage 4 semantic renderer activation gate is invalid")

    sample = training.get("conditionPreservingSemanticRendererSampleBinding", {})
    if (
        sample.get("sampleId")
        != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or sample.get("sampleSplit") != "validation"
        or sample.get("seed") != 20263722
        or sample.get("requiredBoundarySides") != ["west"]
        or sample.get("resolution") != {"width": 256, "height": 192}
        or sample.get("requiredSplitCounts")
        != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
    ):
        raise ValueError("Stage 4 semantic renderer fixed sample or topology identity is invalid")

    root = Path(project_root or Path.cwd()).resolve()
    evidence = contract.get("evidenceBindings", {})
    expected_evidence = {
        "routeDecisionTerminal": "30adadb0b9fcef58939ca177cbf850e171e17b3fba9f11285fdb3d6966317b2b",
        "binaryDecision": "94426b1f71021034731adf01ab0cbbd1f88f50450572976325044737923a67f3",
        "analysisReport": "ec7931e5f88dc74bdddbad3052af1a15cf1da651c42eece14c884e2f90a55cac",
        "inactiveArchitectureContract": "d0670cd224fbbd84a0d1ebdedfe3c2f26a4ee4d82ccfbf769b14023d06cfc8d8",
        "decisionCpuReport": "31cdff05ed5009595aee6e10f260d504e77d873786d6478522b9a817eba2e32b",
    }
    verified = {}
    for key, expected_sha in expected_evidence.items():
        binding = evidence.get(key, {})
        if binding.get("sha256") != expected_sha:
            raise ValueError(f"Stage 4 semantic renderer evidence identity changed: {key}")
        verified[key] = verify_config_bound_project_file(
            root, binding.get("path"), expected_sha, key,
        )
    decision_contract = read_json(verified["inactiveArchitectureContract"])
    if (
        decision_contract.get("contractId") != architecture
        or decision_contract.get("status") != "owner_review_required_not_implemented_not_activated"
        or decision_contract.get("implementationBoundary", {}).get("cpuSupportOnlyUntilSeparatelyAuthorized") is not True
    ):
        raise ValueError("Stage 4 semantic renderer route decision contract is invalid")

    implementation = contract.get("ownerImplementationAuthorization", {})
    authorization_path = verify_config_bound_project_file(
        root, implementation.get("authorizationPath"), implementation.get("authorizationSha256"),
        "semantic renderer implementation authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root, implementation.get("implementationConsumptionPath"),
        implementation.get("implementationConsumptionSha256"),
        "semantic renderer implementation consumption",
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    command_ref = "owner-authorized-stage4-condition-preserving-semantic-renderer-cpu-support-20260811-195316458"
    scope = "implement_stage4_condition_preserving_semantic_renderer_v1_cpu_support_inactive_only"
    if (
        authorization.get("requestId") != command_ref
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or consumption.get("status")
        != "stage4_condition_preserving_semantic_renderer_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != implementation.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("Stage 4 semantic renderer implementation lineage is invalid")

    actions = authorization.get("authorizedActions", {})
    required = (
        "modelCpuArchitectureBranchImplementation", "modeRegistryInactiveModeRegistration",
        "trainerLegalSupervisionImplementation", "inactiveConfigCompilerImplementation",
        "cpuCheckerImplementation", "syntheticCpuTensorForward",
        "syntheticCpuAutogradGradInspection", "cpuPositiveNegativeRegression",
        "completeInactiveConfigurationAudit", "inactiveConfigWrite",
        "architectureSupportContractWrite", "cpuReportWrite", "ownerActionRequestWrite",
        "terminalEvidenceWrite", "uniquePlanUpdate", "localTaskCapsuleUpdate",
    )
    forbidden = (
        "checkpointReadOrLoad", "optimizerCreation", "backwardExecution",
        "modelWeightModification", "gpuUse", "training", "smoke30Epoch",
        "stage4FullTraining", "stage5StrictRevalidation", "formalInference",
        "checkpointPromotion", "runtimeFrame", "worldEntry", "automaticRetry",
    )
    if any(actions.get(key) is not True for key in required):
        raise ValueError("Stage 4 semantic renderer implementation actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden):
        raise ValueError("Stage 4 semantic renderer implementation opens a forbidden action")
    owner = training.get("ownerTrainingAuthorization", {})
    if smoke_mode:
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
            owner.get("status") != CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_SMOKE_STATUS
            or any(owner.get(key) is not expected for key, expected in expected_owner_flags.items())
        ):
            raise ValueError("Stage 4 semantic renderer Smoke Owner actions are invalid")
        validate_condition_preserving_semantic_renderer_stage4_smoke_execution_contract(
            config, project_root,
        )
    elif owner.get("status") != "not_authorized_cpu_support_only" or any(
        owner.get(key) is not False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
            "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
            "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized",
            "strictRevalidationAuthorized", "validationAuthorized",
            "formalInferenceAuthorized", "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
        )
    ):
        raise ValueError("Stage 4 semantic renderer nested execution authorization is not closed")
    return {
        "status": (
            "stage4_condition_preserving_semantic_renderer_smoke_contract_valid"
            if smoke_mode
            else "stage4_condition_preserving_semantic_renderer_cpu_contract_valid_inactive"
        ),
        "conditionChannelOrder": list(FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER),
        "semanticChannels": list(CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS),
        "fusionScales": ["up1", "up0"],
        "diagnosticManifestFields": list(CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
        "reusedWeight": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
    }


def validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
    config, package, project_root=None,
):
    architecture = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
    mode = resolve_stage_mode(config)
    smoke_mode = mode.mode_id == "fact_conditioned_semantic_mixture_stage4_smoke"
    formal_stage_modes = {
        "fact_conditioned_semantic_mixture_stage0_full_training": 0,
        "fact_conditioned_semantic_mixture_stage1_full_training": 1,
        "fact_conditioned_semantic_mixture_stage2_full_training": 2,
    }
    formal_stage = formal_stage_modes.get(mode.mode_id)
    active_training = smoke_mode or formal_stage is not None
    if (
        mode.mode_id not in {
            "fact_conditioned_semantic_mixture_stage4_inactive",
            "fact_conditioned_semantic_mixture_stage4_smoke",
            *formal_stage_modes,
        }
        or (smoke_mode and (mode.execution_kind != "single_sample_smoke" or mode.active_execution is not True))
        or (
            formal_stage is not None
            and (
                mode.execution_kind != f"full_training_stage{formal_stage}"
                or mode.active_execution is not True
                or mode.stage != formal_stage
            )
        )
        or (
            not active_training
            and (mode.execution_kind != "cpu_inactive" or mode.active_execution is not False)
        )
        or (formal_stage is None and mode.sample_split != "validation")
        or (formal_stage is not None and mode.sample_split is not None)
        or config.get("denoiserArchitecture") != architecture
    ):
        raise ValueError("Stage 4 semantic mixture Mode identity is invalid")
    if (
        config.get("conditionChannels") != len(FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER)
        or tuple(config.get("conditionChannelOrder", ()))
        != FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        or config.get("conditionResizeContract")
        != "discrete_nearest_continuous_bilinear_v1"
        or config.get("conditionOutputBinding")
        != "predicted_clean_latent_and_decoded_rgb_v1"
    ):
        raise ValueError("Stage 4 semantic mixture changed the formal condition or output contract")
    if (
        conditional_dataset_selection_contract(config)
        != "registered_v7_capacity_contribution_v1"
        or package.get("v7CapacityContributionCount") != 64
    ):
        raise ValueError("Stage 4 semantic mixture changed the approved dataset identity")

    training = config.get("training", {})
    contract = training.get("stage4FactConditionedSemanticMixture", {})
    expected_fields = {
        "enabled", "status", "contractId", "architectureId",
        "conditionChannelCount", "latentOutputShapeChanged", "autoencoderFrozen",
        "newCheckpointIdentityRequired", "oldDenoiserCheckpointCompatible",
        "newRandomInitializationRequired", "singleFormalMainline",
        "parallelBackendCreated", "programmaticPixelRenderingAllowed",
        "freeHyperparametersSelected", "typedExperts", "learnedCompositor",
        "legalSupervision", "diagnosticManifestRegistry", "evidenceBindings",
        "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 semantic mixture contract contains missing or unknown fields")
    expected_identity = {
        "enabled": active_training,
        "status": "training_loss_active_owner_authorized" if active_training else "cpu_support_verified_not_active",
        "contractId": architecture,
        "architectureId": architecture,
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "autoencoderFrozen": True,
        "newCheckpointIdentityRequired": True,
        "oldDenoiserCheckpointCompatible": False,
        "newRandomInitializationRequired": True,
        "singleFormalMainline": True,
        "parallelBackendCreated": False,
        "programmaticPixelRenderingAllowed": False,
        "freeHyperparametersSelected": False,
    }
    for key, expected in expected_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"Stage 4 semantic mixture contract {key} is invalid")

    experts = contract.get("typedExperts", {})
    if (
        set(experts) != {
            "identities", "sourceConditionChannels", "count",
            "privateContributionBranches", "velocityChannelsDerivedFromExistingOutput",
            "typedIdentityCollapsedBeforeOutput", "otherExpertPrivateGradientAllowed",
        }
        or experts.get("identities")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
        or experts.get("sourceConditionChannels")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS)
        or experts.get("count") != len(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
        or experts.get("privateContributionBranches") is not True
        or experts.get("velocityChannelsDerivedFromExistingOutput") is not True
        or experts.get("typedIdentityCollapsedBeforeOutput") is not False
        or experts.get("otherExpertPrivateGradientAllowed") is not False
    ):
        raise ValueError("Stage 4 semantic mixture typed expert identity is invalid")

    compositor = contract.get("learnedCompositor", {})
    if compositor != {
        "kind": "typed_fact_conditioned_gated_additive_mixture_v1",
        "baseContributionPreserved": True,
        "typedContributionsIndividuallyObservable": True,
        "meanCollapseBeforeOutputAllowed": False,
        "ruleDrawnPixelsAllowed": False,
    }:
        raise ValueError("Stage 4 semantic mixture learned compositor contract is invalid")

    supervision = contract.get("legalSupervision", {})
    expected_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts",
        "visual_fact_manifest",
        "project_route_geometry",
        "original_object_semantic_masks",
        "frozen_project_autoencoder_features",
    ]
    if (
        set(supervision) != {
            "allowedSources", "participationTargetChannels",
            "typedDecodedCounterfactualRequired", "finalTypedRegionMetricsSeparate",
            "weightSource", "failedPreviewPixelsUsedAsTargets",
            "machineReviewThresholdsUsedAsTargets", "reviewResultsUsedAsTargets",
            "failedSmokeCheckpointUsedAsTargetOrInitialization",
        }
        or supervision.get("allowedSources") != expected_sources
        or supervision.get("participationTargetChannels")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS)
        or supervision.get("typedDecodedCounterfactualRequired") is not True
        or supervision.get("finalTypedRegionMetricsSeparate") is not True
        or supervision.get("weightSource")
        != "training.denoiserLossWeights.discreteConditionOutputBinding"
        or any(supervision.get(key) is not False for key in (
            "failedPreviewPixelsUsedAsTargets",
            "machineReviewThresholdsUsedAsTargets",
            "reviewResultsUsedAsTargets",
            "failedSmokeCheckpointUsedAsTargetOrInitialization",
        ))
    ):
        raise ValueError("Stage 4 semantic mixture supervision boundary is invalid")
    if float(training.get("denoiserLossWeights", {}).get("discreteConditionOutputBinding", 0.0)) <= 0.0:
        raise ValueError("Stage 4 semantic mixture existing supervision weight is unavailable")
    if "stage4PerClassFinalVisibleRgbObligation" in training:
        validate_stage4_per_class_final_visible_rgb_obligation(config)
    if "stage4VegetationFinalVisibleSemanticRepair" in training:
        validate_stage4_vegetation_final_visible_semantic_repair(config)
    if "stage4VegetationLuminanceSpatialStructureSupervision" in training:
        validate_stage4_vegetation_luminance_spatial_structure_supervision(config)
    if "stage4FullRolloutFinalVisibleConsistency" in training:
        validate_stage4_full_rollout_final_visible_consistency(config)
    if "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation" in training:
        validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            config
        )
    if "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation" in training:
        validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            config
        )
    if "stage4PerClassFinalVisibleReferenceFeatureStructureObligation" in training:
        validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
    if "stage4EpochWorstSampleClassReplay" in training:
        validate_stage4_epoch_worst_sample_class_replay(config)
    if "stage4EpochWorstSampleClassReferenceFeatureStructureReplay" in training:
        validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
            config
        )
    if "stage4PerClassWorstSampleReferenceFeatureStructureObligation" in training:
        validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    if "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation" in training:
        validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            config
        )
    if (
        "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"
        in training
    ):
        validate_stage4_epoch_complete_per_class_worst_luminance_selection(config)
    if (
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"
        in training
    ):
        validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    if "stage4ConflictAwareExistingGradientAggregation" in training:
        validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    if "stage4ControlledStructureThreeArm" in training:
        validate_stage4_controlled_structure_three_arm_contract(config)
    if "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization" in training:
        validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )

    registry = contract.get("diagnosticManifestRegistry", {})
    diagnostic_fields = fact_conditioned_semantic_mixture_diagnostic_fields(config)
    expected_registry_fields = {
        "exactFields", "exactFieldCount", "rejectUnknownFields",
        "configurationProvenance", "registrationDecisionBindings",
    } | ({"fixedEpochs"} if smoke_mode else set())
    reused_weight_provenance = registry.get("configurationProvenance", {}).get(
        "reusedDiscreteConditionWeight", {}
    )
    if (
        set(registry) != expected_registry_fields
        or registry.get("exactFields")
        != list(diagnostic_fields)
        or registry.get("exactFieldCount")
        != len(diagnostic_fields)
        or registry.get("rejectUnknownFields") is not True
        or reused_weight_provenance != {
            "source": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "value": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
            "epochDiagnosticField": False,
        }
        or registry.get("registrationDecisionBindings")
        != FACT_CONDITIONED_SEMANTIC_MIXTURE_REGISTRATION_DECISION_BINDINGS
        or "stage4SemanticMixtureReusedDiscreteConditionWeight"
        in registry.get("exactFields", ())
    ):
        raise ValueError("Stage 4 semantic mixture diagnostic registry is invalid")

    activation = contract.get("activationGate", {})
    activation_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smoke30EpochNow", "stage4FullTrainingNow",
        "strictRevalidationNow", "formalInferenceNow", "checkpointPromotionNow",
        "runtimeFrameNow", "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smoke30EpochNow",
    } if smoke_mode else ({
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    } if formal_stage is not None else set())
    if set(activation) != activation_fields or any(
        activation.get(key) is not (key in active_fields)
        for key in activation_fields
    ):
        raise ValueError("Stage 4 semantic mixture activation gate is invalid")

    sample = training.get("factConditionedSemanticMixtureSampleBinding", {})
    if (
        sample.get("sampleId")
        != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or sample.get("sampleSplit") != "validation"
        or sample.get("seed") != 20263722
        or sample.get("requiredBoundarySides") != ["west"]
        or sample.get("resolution") != {"width": 256, "height": 192}
        or sample.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS
    ):
        raise ValueError("Stage 4 semantic mixture sample binding is invalid")
    if formal_stage is not None:
        full_contract = training.get(
            "factConditionedSemanticMixtureStage4FullTrainingContract", {}
        )
        expected_full_contract = {
            "status": "active_owner_authorized_independent_stage_execution",
            "stage": formal_stage,
            "resolution": training.get("resolutionStages", [])[formal_stage],
            "epochCount": 40,
            "previewEpochs": [1, 5, 10, 20, 30, 40],
            "datasetCapacity": 64,
            "splitCounts": V7_MVP64_SPLIT_COUNTS,
            "initialization": (
                "project_random_fact_conditioned_semantic_mixture"
                if formal_stage == 0
                else f"current_run_stage_{formal_stage - 1}_checkpoint_only"
            ),
            "parentCheckpointRequired": formal_stage > 0,
            "smokeCheckpointAllowed": False,
            "historicalCheckpointAllowed": False,
            "automaticRetryAllowed": False,
        }
        if full_contract != expected_full_contract:
            raise ValueError("Stage 4 semantic mixture formal Stage contract changed")
        if (
            int(training.get("denoiserEpochs", 0)) != 40
            or training.get("fixedEpochPreviewPolicy", {}).get("formalStage")
            != [1, 5, 10, 20, 30, 40]
            or training.get("authorizedInitialization")
            != expected_full_contract["initialization"]
        ):
            raise ValueError("Stage 4 semantic mixture formal Stage schedule changed")

    root = Path(project_root or Path.cwd()).resolve()
    for key, binding in FACT_CONDITIONED_SEMANTIC_MIXTURE_REGISTRATION_DECISION_BINDINGS.items():
        verify_config_bound_project_file(
            root,
            registry["registrationDecisionBindings"][key]["path"],
            binding["sha256"],
            f"semantic mixture diagnostic registration decision {key}",
        )
    evidence = contract.get("evidenceBindings", {})
    expected_evidence = {
        "designTerminal": "18d8791ab39998e023bbfdb87359225441a0b83bef2a0299157ad148d998ada3",
        "designReport": "e8be3bf92e094d5552f5d699be6b4664fa99b945e1df73db27059aba56aa08aa",
        "inactiveDesignContract": "93b34d56f2ed90922e2600d42923bdc28978bc0c29880456172af7d32f46da32",
        "designCpuRegression": "84fa31bb5d7f77df6e51a20f01ff75207e4af995486d7675bc1f28cf3bc42af2",
    }
    verified = {}
    for key, expected_sha in expected_evidence.items():
        binding = evidence.get(key, {})
        if binding.get("sha256") != expected_sha:
            raise ValueError(f"Stage 4 semantic mixture evidence identity changed: {key}")
        verified[key] = verify_config_bound_project_file(
            root, binding.get("path"), expected_sha, key,
        )
    design = read_json(verified["inactiveDesignContract"])
    if (
        design.get("status") != "owner_review_required_not_activated"
        or design.get("architectureId") != architecture
        or design.get("activationGate", {}).get("implementationNow") is not False
    ):
        raise ValueError("Stage 4 semantic mixture design prerequisite is invalid")

    implementation = contract.get("ownerImplementationAuthorization", {})
    authorization_path = verify_config_bound_project_file(
        root, implementation.get("authorizationPath"),
        implementation.get("authorizationSha256"),
        "semantic mixture implementation authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root, implementation.get("implementationConsumptionPath"),
        implementation.get("implementationConsumptionSha256"),
        "semantic mixture implementation consumption",
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    request_id = "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363"
    command_ref = "stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363"
    scope = "implement_stage4_fact_conditioned_semantic_mixture_decoder_v1_cpu_support_compile_inactive_config_and_regressions_only"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or authorization.get("status") != "owner_authorized_unconsumed"
        or consumption.get("status")
        != "stage4_fact_conditioned_semantic_mixture_decoder_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256")
        != implementation.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("Stage 4 semantic mixture implementation lineage is invalid")
    actions = authorization.get("authorizedActions", {})
    required = (
        "modelArchitectureBranchCpuImplementation",
        "trainerLegalSupervisionAndInactiveAuthorizationImplementation",
        "modeRegistryInactiveModeImplementation",
        "inactiveConfigCompilerImplementation", "cpuCheckerImplementation",
        "syntheticCpuForward", "torchAutogradGradInspection",
        "cpuPositiveNegativeRegression", "inactiveConfigWrite",
        "supportContractWrite", "cpuReportWrite", "ownerActionRequestWrite",
        "terminalEvidenceWrite", "uniquePlanAndTaskCapsuleSync",
    )
    forbidden = (
        "freeHyperparameterSelection", "checkpointReadOrLoad", "optimizerCreation",
        "backwardExecution", "modelWeightModification", "gpuUse", "smoke",
        "fullTraining", "stage5StrictRevalidation", "formalInference",
        "checkpointPromotion", "runtimeFrame", "worldEntry",
    )
    if any(actions.get(key) is not True for key in required):
        raise ValueError("Stage 4 semantic mixture implementation actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden):
        raise ValueError("Stage 4 semantic mixture implementation opens a forbidden action")

    owner = training.get("ownerTrainingAuthorization", {})
    if smoke_mode:
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
            owner.get("status") != FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS
            or any(owner.get(key) is not expected for key, expected in expected_owner_flags.items())
        ):
            raise ValueError("Stage 4 semantic mixture Smoke Owner actions are invalid")
        validate_fact_conditioned_semantic_mixture_stage4_smoke_execution_contract(
            config, project_root,
        )
    elif formal_stage is not None:
        expected_statuses = FACT_CONDITIONED_SEMANTIC_MIXTURE_FULL_TRAINING_STATUSES
        expected_owner_flags = {
            "checkpointLoadingAuthorized": formal_stage > 0,
            "optimizerCreationAuthorized": True,
            "backwardExecutionAuthorized": True,
            "modelWeightMutationAuthorized": True,
            "gpuTrainingAuthorizedNow": True,
            "singleSampleGpuOverfitSmokeAuthorized": False,
            "fullTrainingAuthorized": True,
            "stage1Authorized": formal_stage == 1,
            "stage2Authorized": formal_stage == 2,
            "strictRevalidationAuthorized": False,
            "validationAuthorized": False,
            "formalInferenceAuthorized": False,
            "checkpointPromotionAuthorized": False,
            "runtimeFrameAuthorized": False,
            "worldEntryAuthorized": False,
            "automaticRetryAuthorized": False,
        }
        if (
            owner.get("status") != expected_statuses[formal_stage]
            or any(owner.get(key) is not expected for key, expected in expected_owner_flags.items())
        ):
            raise ValueError("Stage 4 semantic mixture formal Stage Owner actions are invalid")
    elif owner.get("status") != "not_authorized_cpu_support_only" or any(
        owner.get(key) is not False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
            "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
            "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized",
            "strictRevalidationAuthorized", "validationAuthorized",
            "formalInferenceAuthorized", "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
        )
    ):
        raise ValueError("Stage 4 semantic mixture nested execution authorization is not closed")
    return {
        "status": (
            "stage4_fact_conditioned_semantic_mixture_smoke_contract_valid"
            if smoke_mode
            else (
                f"stage4_fact_conditioned_semantic_mixture_stage{formal_stage}_full_training_contract_valid"
                if formal_stage is not None
                else "stage4_fact_conditioned_semantic_mixture_cpu_contract_valid_inactive"
            )
        ),
        "expertIdentities": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES),
        "sourceConditionChannels": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
        "diagnosticManifestFields": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS),
        "reusedWeight": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
    }


def derive_stage4_per_class_final_visible_rgb_weights(config):
    """Derive typed final-RGB weights without selecting a free value."""
    training = config.get("training", {})
    loss_weights = training.get("denoiserLossWeights", {})
    object_weights = training.get("objectSemanticChannelWeights", {})
    expected_objects = FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS[1:]
    if set(object_weights) != set(expected_objects):
        raise ValueError("Stage 4 final visible RGB object weight identity changed")
    object_semantic = float(loss_weights.get("objectSemanticRgb", float("nan")))
    path_boundary = float(loss_weights.get("pathBoundaryRgb", float("nan")))
    path_interior = float(loss_weights.get("pathInteriorRgb", float("nan")))
    values = [float(object_weights[name]) for name in expected_objects]
    denominator = sum(values)
    if (
        not all(math.isfinite(value) and value > 0.0 for value in values)
        or not math.isfinite(object_semantic) or object_semantic <= 0.0
        or not math.isfinite(path_boundary) or path_boundary <= 0.0
        or not math.isfinite(path_interior) or path_interior <= 0.0
        or denominator <= 0.0
    ):
        raise ValueError("Stage 4 final visible RGB weights are not uniquely derivable")
    derived = {"route": path_interior}
    for identity, value in zip(
        FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:], values,
    ):
        derived[identity] = object_semantic * value / denominator
    return {
        "weights": derived,
        "sources": {
            "route": "training.denoiserLossWeights.pathInteriorRgb",
            "routeBoundaryPreserved": "training.denoiserLossWeights.pathBoundaryRgb",
            "objects": (
                "training.denoiserLossWeights.objectSemanticRgb * "
                "training.objectSemanticChannelWeights[channel] / sum(objectSemanticChannelWeights)"
            ),
        },
        "sourceValues": {
            "pathInteriorRgb": path_interior,
            "pathBoundaryRgb": path_boundary,
            "objectSemanticRgb": object_semantic,
            "objectSemanticChannelWeights": {
                name: float(object_weights[name]) for name in expected_objects
            },
        },
    }


def validate_stage4_per_class_final_visible_rgb_obligation(config):
    if not is_fact_conditioned_semantic_mixture_stage4(config):
        raise ValueError("Stage 4 final visible RGB obligation requires semantic mixture architecture")
    contract = config.get("training", {}).get(
        "stage4PerClassFinalVisibleRgbObligation", {}
    )
    expected_fields = {
        "enabled", "status", "contractId", "terms", "derivedWeights",
        "weightDerivation", "legalSupervision", "checkpointQualification",
        "compatibility", "evidenceBindings", "ownerImplementationAuthorization",
        "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 final visible RGB obligation has missing or unknown fields")
    formal_stage_active = resolve_stage_mode(config).mode_id in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized"
            if formal_stage_active else "cpu_support_verified_inactive"
        )
        or contract.get("contractId") != STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_OBLIGATION_ID
        or contract.get("terms") != list(STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS)
    ):
        raise ValueError("Stage 4 final visible RGB obligation identity is invalid")
    derived = derive_stage4_per_class_final_visible_rgb_weights(config)
    actual_weights = contract.get("derivedWeights", {})
    if set(actual_weights) != set(derived["weights"]) or any(
        not math.isclose(
            float(actual_weights[name]), float(derived["weights"][name]),
            rel_tol=0.0, abs_tol=1e-12,
        )
        for name in derived["weights"]
    ):
        raise ValueError("Stage 4 final visible RGB derived weights changed")
    if contract.get("weightDerivation") != {
        **derived["sources"],
        "sourceValues": derived["sourceValues"],
        "freeValueSelectionAllowed": False,
    }:
        raise ValueError("Stage 4 final visible RGB weight provenance changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
        "lossFunction": "masked_condition_rgb_loss",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 final visible RGB legal supervision changed")
    if contract.get("checkpointQualification") != {
        "explicitTerms": [term["metric"] for term in STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS],
        "usesSameDerivedWeightsAsTraining": True,
        "aggregateObjectSemanticRgbCannotReplaceExplicitTerms": True,
    }:
        raise ValueError("Stage 4 final visible RGB checkpoint qualification changed")
    if contract.get("compatibility") != {
        "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
        "oldDenoiserCheckpointCompatible": False,
        "newModelArchitectureCreated": False,
    }:
        raise ValueError("Stage 4 final visible RGB compatibility boundary changed")
    if contract.get("evidenceBindings") != STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_EVIDENCE_BINDINGS:
        raise ValueError("Stage 4 final visible RGB evidence bindings changed")
    if (
        contract.get("ownerImplementationAuthorization")
        != STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 final visible RGB implementation lineage changed")
    activation = contract.get("activationGate", {})
    expected_activation = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    } if formal_stage_active else set()
    if set(activation) != expected_activation or any(
        activation.get(key) is not (key in active_fields) for key in expected_activation
    ):
        raise ValueError("Stage 4 final visible RGB inactive gate changed")
    return {
        "status": (
            "stage4_per_class_final_visible_rgb_obligation_contract_valid_active_full_training"
            if formal_stage_active
            else "stage4_per_class_final_visible_rgb_obligation_cpu_contract_valid_inactive"
        ),
        "terms": list(STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS),
        "derivedWeights": derived["weights"],
    }


def validate_stage4_distribution_aware_visible_spatial_semantic_obligation(config):
    base = validate_stage4_per_class_final_visible_rgb_obligation(config)
    contract = config.get("training", {}).get(
        "stage4DistributionAwareVisibleSpatialSemanticObligation", {}
    )
    expected_fields = {
        "enabled", "status", "contractId", "requiredIdentities", "sourceChannels",
        "aggregation", "trajectoryBinding", "checkpointQualification",
        "legalSupervision", "compatibility", "evidenceBindings",
        "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 distribution-aware obligation has missing or unknown fields")
    formal_stage_active = resolve_stage_mode(config).mode_id in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized"
            if formal_stage_active else "cpu_support_verified_inactive"
        )
        or contract.get("contractId")
        != STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_OBLIGATION_ID
        or contract.get("requiredIdentities")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
        or contract.get("sourceChannels")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS)
    ):
        raise ValueError("Stage 4 distribution-aware obligation identity changed")
    if contract.get("aggregation") != {
        "perSamplePerClass": True,
        "classReduction": "maximum_of_existing_derived_weighted_class_obligations",
        "batchReduction": "maximum_of_per_sample_worst_class_obligations",
        "freeNumericWeightSelected": False,
    }:
        raise ValueError("Stage 4 distribution-aware aggregation changed")
    if contract.get("trajectoryBinding") != {
        "source": "existing_short_trajectory_current_training_predictions",
        "stepReduction": "maximum_across_existing_fixed_trajectory_steps",
        "newTrajectoryStepCountSelected": False,
    }:
        raise ValueError("Stage 4 distribution-aware trajectory binding changed")
    if contract.get("checkpointQualification") != {
        "includeWorstValidationSampleClassObligation": True,
        "aggregateMeanCannotReplaceWorstSampleClass": True,
        "usesExistingDerivedClassWeights": True,
    }:
        raise ValueError("Stage 4 distribution-aware checkpoint qualification changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
        "decode": "current_training_prediction_decoded_by_frozen_project_autoencoder",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 distribution-aware legal supervision changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetSplitChanged": False,
        "oldModesPreserved": True,
    }:
        raise ValueError("Stage 4 distribution-aware compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 distribution-aware implementation lineage changed")
    activation = contract.get("activationGate", {})
    expected_activation = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    } if formal_stage_active else set()
    if set(activation) != expected_activation or any(
        activation.get(key) is not (key in active_fields) for key in expected_activation
    ):
        raise ValueError("Stage 4 distribution-aware activation gate changed")
    return {"status": (
        "stage4_distribution_aware_visible_spatial_semantic_contract_valid_active_full_training"
        if formal_stage_active
        else "stage4_distribution_aware_visible_spatial_semantic_contract_valid_inactive"
    ), "derivedWeights": base["derivedWeights"]}


def validate_stage4_epoch_worst_sample_class_replay(config):
    training = config.get("training", {})
    contract = training.get("stage4EpochWorstSampleClassReplay", {})
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "selection", "replay",
        "legalSupervision", "compatibility", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 epoch-worst replay fields changed")
    if (
        contract.get("enabled") is not True
        or contract.get("contractId") != STAGE4_EPOCH_WORST_SAMPLE_CLASS_REPLAY_ID
        or contract.get("selection") != {
            "population": "observed_current_train_split_epoch_prefix_with_complete_epoch_finalization",
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES),
            "score": "direct_plus_full_rollout_existing_derived_weighted_final_visible_rgb",
            "tieBreak": "lexicographic_sample_id_then_fixed_class_order",
        }
    ):
        raise ValueError("Stage 4 epoch-worst replay selection changed")
    expected_passes = r5_path_replay_passes_per_epoch(config)
    if contract.get("replay") != {
        "passesPerObservedPrimaryBatch": expected_passes,
        "passesSource": "training.pathHardExampleReplay.passesPerEpoch",
        "replacesPerBatchPathOnlyReplay": True,
        "loss": "selected_existing_derived_weighted_final_visible_rgb",
        "freeNumericWeightSelected": False,
    }:
        raise ValueError("Stage 4 epoch-worst replay execution changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "validationSamplesUsedAsTrainingTargets": False,
    }:
        raise ValueError("Stage 4 epoch-worst replay supervision changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetSplitChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 epoch-worst replay compatibility changed")
    mode = resolve_stage_mode(config).mode_id
    active = mode in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
        "fact_conditioned_semantic_mixture_stage4_smoke",
    }
    expected_active = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow",
        "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
    } if active else set()
    if mode in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }:
        expected_active.add("stage4FullTrainingNow")
    if mode == "fact_conditioned_semantic_mixture_stage4_smoke":
        expected_active.add("smokeNow")
    activation = contract.get("activationGate", {})
    expected_gate = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    if (
        set(activation) != expected_gate
        or any(activation.get(key) is not (key in expected_active) for key in expected_gate)
        or contract.get("status") != (
            "training_loss_active_owner_authorized" if active
            else "cpu_support_verified_inactive"
        )
    ):
        raise ValueError("Stage 4 epoch-worst replay activation changed")
    return contract


def validate_stage4_object_reference_multiscale_early_convergence_stabilization(
    config,
):
    training = config.get("training", {})
    contract = training.get(
        "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization", {}
    )
    if not contract:
        return None
    if set(contract) != {
        "enabled", "status", "contractId", "sourceRunId", "replayBudget",
        "lanes", "preservedSupervision", "legalSupervision", "compatibility",
        "evidenceBindings", "activationGate",
    }:
        raise ValueError("Stage 4 early-convergence stabilization fields changed")
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID
        or contract.get("sourceRunId") != "20260815-190000000"
    ):
        raise ValueError("Stage 4 early-convergence stabilization identity changed")
    epoch_worst = validate_stage4_epoch_worst_sample_class_replay(config)
    if (
        epoch_worst is None
        or epoch_worst["replay"]["passesPerObservedPrimaryBatch"] != 2
        or contract.get("replayBudget") != {
            "totalReplayPassesPerObservedPrimaryBatch": 2,
            "source": "training.stage4EpochWorstSampleClassReplay.replay.passesPerObservedPrimaryBatch",
            "addsReplayPasses": False,
            "addsOptimizerSteps": False,
        }
    ):
        raise ValueError("Stage 4 early-convergence stabilization replay budget changed")
    object_channels = list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    expected_lanes = [
        {
            "laneId": "lane_1_existing_global_worst_sample_class",
            "passIndex": 0,
            "passCount": 1,
            "selection": "existing_global_worst_sample_class_selection_unchanged",
            "loss": "selected_existing_derived_weighted_final_visible_rgb",
            "includesRoute": True,
        },
        {
            "laneId": "lane_2_joint_four_object_reference_multiscale",
            "passIndex": 1,
            "passCount": 1,
            "selection": "all_four_typed_objects_in_fixed_existing_channel_order",
            "loss": "existing_typed_object_multiscale_luminance_structure_losses_jointly_aggregated_with_existing_derived_weights",
            "includesRoute": False,
            "objectChannels": object_channels,
            "aggregation": "sum_of_existing_typed_weighted_object_obligations",
        },
    ]
    if contract.get("lanes") != expected_lanes:
        raise ValueError("Stage 4 early-convergence stabilization lane allocation changed")
    multiscale = (
        validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            config
        )
    )
    expected_preserved = {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "objectChannels": object_channels,
        "pyramidScales": [1, 0.5, 0.25],
        "pyramidAuthority": "training.textureHierarchyScales_exact_inheritance",
        "derivedWeights": multiscale["derivedWeights"],
        "derivedWeightAuthority": "training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision.derivedWeights",
        "freeNumericWeightSelectionAllowed": False,
    }
    if contract.get("preservedSupervision") != expected_preserved:
        raise ValueError("Stage 4 early-convergence stabilization supervision changed")
    if contract.get("legalSupervision") != {
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "validationSamplesUsedAsTrainingTargets": False,
    }:
        raise ValueError("Stage 4 early-convergence stabilization target authority changed")
    if contract.get("compatibility") != {
        "firstWorstClassLanePreserved": True,
        "routeAndWaterBaseLossesPreserved": True,
        "existingTwoReplayPassBudgetPreserved": True,
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetOrSplitChanged": False,
        "conditionPackChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 early-convergence stabilization compatibility changed")
    if contract.get("evidenceBindings") != {
        "design": {
            "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/early-convergence-stabilization-design.json",
            "sha256": "09a276d9f6c655ddef8c91d2604d9442043804a4662d5b6ebba42ad50ad7c735",
        },
        "cpuReport": {
            "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/cpu-contract-regression.json",
            "sha256": "9bf2ee1a5cefff227d6da7a9a9d900323d6e5c6048a84bd8a2d408cdaf1e7191",
        },
        "inactiveImplementationContract": {
            "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/inactive-implementation-contract.json",
            "sha256": "9d225b9cbf6ebbdb4a0a923f3d72c3bcaa5bab8ce5cf89bb3fba866c58f210c8",
        },
    }:
        raise ValueError("Stage 4 early-convergence stabilization evidence changed")
    activation = contract.get("activationGate", {})
    expected_gate = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        expected_active = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
            "fact_conditioned_semantic_mixture_stage4_smoke",
        }:
            raise ValueError("Stage 4 early-convergence stabilization mode is invalid")
        expected_active = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        if mode == "fact_conditioned_semantic_mixture_stage4_smoke":
            expected_active.add("smokeNow")
        else:
            expected_active.add("stage4FullTrainingNow")
    else:
        raise ValueError("Stage 4 early-convergence stabilization status changed")
    if (
        set(activation) != expected_gate
        or any(activation.get(key) is not (key in expected_active) for key in expected_gate)
    ):
        raise ValueError("Stage 4 early-convergence stabilization activation changed")
    return contract


def derive_stage4_vegetation_final_visible_semantic_repair_weight(config):
    """Reuse the existing vegetation final-RGB weight; never select a new value."""
    final_visible = derive_stage4_per_class_final_visible_rgb_weights(config)
    vegetation_weight = float(final_visible["weights"]["vegetation"])
    if not math.isfinite(vegetation_weight) or vegetation_weight <= 0.0:
        raise ValueError("Stage 4 vegetation edge weight is not uniquely derivable")
    return {
        "weight": vegetation_weight,
        "source": "stage4PerClassFinalVisibleRgbObligation.derivedWeights.vegetation",
        "sourceValue": vegetation_weight,
        "freeValueSelectionAllowed": False,
    }


def derive_stage4_object_visible_structure_weights(config):
    """Reuse the existing typed final-RGB weights; never select a new number."""
    base = derive_stage4_per_class_final_visible_rgb_weights(config)
    identities = FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    weights = {identity: float(base["weights"][identity]) for identity in identities}
    if not all(math.isfinite(value) and value > 0.0 for value in weights.values()):
        raise ValueError("Stage 4 object visible-structure weights are not uniquely derivable")
    return {
        "weights": weights,
        "source": "stage4PerClassFinalVisibleRgbObligation.derivedWeights",
        "sourceValues": weights,
        "freeValueSelectionAllowed": False,
    }


def validate_stage4_object_visible_structure_supervision(config):
    if not is_fact_conditioned_semantic_mixture_stage4(config):
        raise ValueError("Stage 4 object visible-structure supervision requires semantic mixture architecture")
    training = config.get("training", {})
    contract = training.get("stage4ObjectVisibleStructureSupervision", {})
    expected_fields = {
        "enabled", "status", "contractId", "sourceChannels",
        "luminanceCoefficients", "lossFunction", "derivedWeights",
        "weightDerivation", "legalSupervision", "compatibility",
        "evidenceBindings", "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 object visible-structure supervision fields changed")
    if "stage4VegetationLuminanceSpatialStructureSupervision" in training:
        raise ValueError("Stage 4 single-object luminance contract must be replaced, not duplicated")
    derived = derive_stage4_object_visible_structure_weights(config)
    mode = resolve_stage_mode(config).mode_id
    active = mode in {
        "fact_conditioned_semantic_mixture_stage4_smoke",
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized" if active
            else "cpu_support_verified_inactive"
        )
        or contract.get("contractId") != STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID
        or tuple(contract.get("sourceChannels", ()))
        != STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS
        or contract.get("luminanceCoefficients") != [0.2126, 0.7152, 0.0722]
        or contract.get("lossFunction")
        != "one_minus_masked_zero_mean_normalized_luminance_correlation"
        or contract.get("derivedWeights") != derived["weights"]
        or contract.get("weightDerivation") != derived
    ):
        raise ValueError("Stage 4 object visible-structure supervision identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "worldFacts": "approved_world_facts",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "failedPreviewPixelsUsedAsTargets": False,
        "failedCheckpointWeightsReadOrLoaded": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 object visible-structure legal supervision changed")
    if contract.get("compatibility") != {
        "waterAndPathBehaviorPreserved": True,
        "existingColorAndEdgeObligationsPreserved": True,
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetOrSplitChanged": False,
        "conditionPackChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 object visible-structure compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_OBJECT_VISIBLE_STRUCTURE_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 object visible-structure implementation lineage changed")
    expected_gate = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
    } if active else set()
    if mode == "fact_conditioned_semantic_mixture_stage4_smoke":
        active_fields.add("smokeNow")
    if mode in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }:
        active_fields.add("stage4FullTrainingNow")
    gate = contract.get("activationGate", {})
    if set(gate) != expected_gate or any(
        gate.get(key) is not (key in active_fields) for key in expected_gate
    ):
        raise ValueError("Stage 4 object visible-structure activation gate changed")
    return {
        "status": (
            "stage4_object_visible_structure_supervision_contract_valid_active"
            if active else "stage4_object_visible_structure_supervision_contract_valid_inactive"
        ),
        "sourceChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "derivedWeights": derived["weights"],
    }


def validate_stage4_object_reference_multiscale_luminance_structure_supervision(config):
    """Validate the novel inactive four-object multiscale supervision contract."""
    if not is_fact_conditioned_semantic_mixture_stage4(config):
        raise ValueError("Stage 4 object multiscale supervision requires semantic mixture architecture")
    training = config.get("training", {})
    contract = training.get(
        "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
    )
    expected_fields = {
        "enabled", "status", "contractId", "sourceChannels",
        "luminanceCoefficients", "pyramidScales", "pyramidAuthority",
        "perScaleLossFunction", "crossScaleLossFunction", "aggregation",
        "derivedWeights", "weightDerivation", "noveltyBoundary",
        "legalSupervision", "compatibility", "evidenceBindings",
        "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 object multiscale supervision fields changed")
    if (
        "stage4ObjectVisibleStructureSupervision" in training
        or "stage4VegetationLuminanceSpatialStructureSupervision" in training
    ):
        raise ValueError("Failed single-scale luminance contracts must be replaced, not reused")
    derived = derive_stage4_object_visible_structure_weights(config)
    mode = resolve_stage_mode(config).mode_id
    active = mode in {
        "fact_conditioned_semantic_mixture_stage4_smoke",
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    exact_scales = list(STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES)
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized" if active
            else "cpu_support_verified_inactive"
        )
        or contract.get("contractId")
        != STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID
        or tuple(contract.get("sourceChannels", ()))
        != STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS
        or contract.get("luminanceCoefficients") != [0.2126, 0.7152, 0.0722]
        or contract.get("pyramidScales") != exact_scales
        or list(training.get("textureHierarchyScales", ())) != exact_scales
        or contract.get("pyramidAuthority")
        != "training.textureHierarchyScales_exact_inheritance"
        or contract.get("perScaleLossFunction")
        != "masked_zero_mean_normalized_luminance_correlation_at_each_inherited_scale"
        or contract.get("crossScaleLossFunction")
        != "masked_laplacian_pyramid_structure_consistency"
        or contract.get("aggregation") != {
            "perObject": "arithmetic_mean_of_three_per_scale_correlations_and_one_cross_scale_structure_consistency",
            "crossObject": "sum_of_existing_typed_weighted_object_obligations",
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("derivedWeights") != derived["weights"]
        or contract.get("weightDerivation") != derived
    ):
        raise ValueError("Stage 4 object multiscale supervision identity changed")
    if contract.get("noveltyBoundary") != {
        "rejectedCandidateContractId": STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID,
        "rejectedCandidateLossFunction": "one_minus_masked_zero_mean_normalized_luminance_correlation",
        "failedSingleScaleContractReuseAllowed": False,
        "distinctMechanism": "per_scale_masked_luminance_correlation_plus_cross_scale_structure_consistency",
    }:
        raise ValueError("Stage 4 object multiscale novelty boundary changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "worldFacts": "approved_world_facts",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "failedPreviewPixelsUsedAsTargets": False,
        "failedCheckpointWeightsReadOrLoaded": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 object multiscale legal supervision changed")
    if contract.get("compatibility") != {
        "waterAndPathBehaviorPreserved": True,
        "existingColorAndEdgeObligationsPreserved": True,
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetOrSplitChanged": False,
        "conditionPackChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 object multiscale compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 object multiscale implementation lineage changed")
    expected_gate = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
    } if active else set()
    if mode == "fact_conditioned_semantic_mixture_stage4_smoke":
        active_fields.add("smokeNow")
    if mode in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }:
        active_fields.add("stage4FullTrainingNow")
    gate = contract.get("activationGate", {})
    if set(gate) != expected_gate or any(
        gate.get(key) is not (key in active_fields) for key in expected_gate
    ):
        raise ValueError("Stage 4 object multiscale activation gate changed")
    return {
        "status": (
            "stage4_object_reference_multiscale_luminance_structure_contract_valid_active"
            if active else
            "stage4_object_reference_multiscale_luminance_structure_contract_valid_inactive"
        ),
        "sourceChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "pyramidScales": exact_scales,
        "derivedWeights": derived["weights"],
    }


def validate_stage4_vegetation_final_visible_semantic_repair(config):
    base = validate_stage4_per_class_final_visible_rgb_obligation(config)
    contract = config.get("training", {}).get(
        "stage4VegetationFinalVisibleSemanticRepair", {}
    )
    expected_fields = {
        "enabled", "status", "contractId", "sourceChannel", "finalRgbColorTerm",
        "finalRgbEdgeStructureTerm", "derivedWeight", "weightDerivation",
        "legalSupervision", "compatibility", "sourceFailureEvidence",
        "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 vegetation semantic repair has missing or unknown fields")
    derived = derive_stage4_vegetation_final_visible_semantic_repair_weight(config)
    formal_stage_active = resolve_stage_mode(config).mode_id in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized"
            if formal_stage_active else "cpu_support_verified_inactive"
        )
        or contract.get("contractId") != STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_ID
        or contract.get("sourceChannel") != "object_vegetation"
        or contract.get("finalRgbColorTerm")
        != "stage4SemanticMixtureVegetationFinalTypedRgbMae"
        or contract.get("finalRgbEdgeStructureTerm")
        != "stage4SemanticMixtureVegetationFinalTypedEdgeMae"
        or not math.isclose(
            float(contract.get("derivedWeight", float("nan"))),
            derived["weight"], rel_tol=0.0, abs_tol=1e-12,
        )
        or contract.get("weightDerivation") != derived
    ):
        raise ValueError("Stage 4 vegetation semantic repair identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannel": "object_vegetation",
        "lossFunction": "masked_condition_gradient_rgb_loss",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 vegetation semantic repair supervision changed")
    if contract.get("compatibility") != {
        "existingColorObligationPreserved": True,
        "otherFourTypedObligationsPreserved": True,
        "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
        "newModelArchitectureCreated": False,
        "failedSmokeCheckpointCompatible": False,
    }:
        raise ValueError("Stage 4 vegetation semantic repair compatibility changed")
    evidence = contract.get("sourceFailureEvidence", {})
    if evidence != {
        "smokeTerminalSha256": "2550750455a2b1587ad4916a0ef27cd2e82654bf3c8468c1f96ef772bd8bc32c",
        "manifestSha256": "e9a16f8b085802dab6beb1ef2679c2c0ebd74bc906d9edace7fc54583dd64edc",
        "machineReviewSha256": "253d183f882cb33b105f3ffc7cc5bfca5d687921a8a01fd19b5e96b99ff1369f",
        "epoch30OnlyIssue": "condition_object_vegetation_reference_semantic_mismatch",
        "reviewThresholdsChanged": False,
    }:
        raise ValueError("Stage 4 vegetation semantic repair source evidence changed")
    if (
        contract.get("ownerImplementationAuthorization")
        != STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_AUTHORIZATION
    ):
        raise ValueError("Stage 4 vegetation semantic repair implementation lineage changed")
    activation = contract.get("activationGate", {})
    expected_activation = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    } if formal_stage_active else set()
    if set(activation) != expected_activation or any(
        activation.get(key) is not (key in active_fields) for key in expected_activation
    ):
        raise ValueError("Stage 4 vegetation semantic repair inactive gate changed")
    return {
        "status": (
            "stage4_vegetation_final_visible_semantic_repair_contract_valid_active_full_training"
            if formal_stage_active
            else "stage4_vegetation_final_visible_semantic_repair_cpu_contract_valid_inactive"
        ),
        "baseObjectiveStatus": base["status"],
        "derivedWeight": derived["weight"],
    }


def validate_stage4_vegetation_luminance_spatial_structure_supervision(config):
    repair = validate_stage4_vegetation_final_visible_semantic_repair(config)
    contract = config.get("training", {}).get(
        "stage4VegetationLuminanceSpatialStructureSupervision", {}
    )
    expected_fields = {
        "enabled", "status", "contractId", "sourceChannel", "luminanceCoefficients",
        "lossFunction", "derivedWeight", "weightDerivation", "legalSupervision",
        "compatibility", "sourceFailureEvidence", "ownerImplementationAuthorization",
        "activationGate",
    }
    derived = derive_stage4_vegetation_final_visible_semantic_repair_weight(config)
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 vegetation luminance supervision has missing or unknown fields")
    formal_stage_active = resolve_stage_mode(config).mode_id in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    if (
        contract.get("enabled") is not True
        or contract.get("status") != (
            "training_loss_active_owner_authorized"
            if formal_stage_active else "cpu_support_verified_inactive"
        )
        or contract.get("contractId")
        != STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_SUPERVISION_ID
        or contract.get("sourceChannel") != "object_vegetation"
        or contract.get("luminanceCoefficients") != [0.2126, 0.7152, 0.0722]
        or contract.get("lossFunction")
        != "one_minus_masked_zero_mean_normalized_luminance_correlation"
        or not math.isclose(
            float(contract.get("derivedWeight", float("nan"))),
            derived["weight"], rel_tol=0.0, abs_tol=1e-12,
        )
        or contract.get("weightDerivation") != derived
    ):
        raise ValueError("Stage 4 vegetation luminance supervision identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannel": "object_vegetation",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 vegetation luminance supervision source changed")
    if contract.get("compatibility") != {
        "existingColorAndEdgeObligationsPreserved": True,
        "otherFourTypedObligationsPreserved": True,
        "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
        "newModelArchitectureCreated": False,
        "failedSmokeCheckpointCompatible": False,
    }:
        raise ValueError("Stage 4 vegetation luminance supervision compatibility changed")
    if contract.get("sourceFailureEvidence") != {
        "smokeTerminalSha256": "4da637c83543e7b0c43a033231b22c854f74bc7f0583e0321263e42b31f0ab97",
        "manifestSha256": "b5460272d2864cec3bba6f7d7bbdcb3f43d075d27ee00930b5c6e1065cdf99b6",
        "machineReviewSha256": "72aac2ba1a1ce23d90e0d46c091ba1ba775666b174cb2526bb0cbe186b00a40b",
        "epoch30OnlyIssue": "condition_object_vegetation_reference_semantic_mismatch",
        "reviewThresholdsChanged": False,
        "reviewThresholdUsedAsTrainingTarget": False,
    }:
        raise ValueError("Stage 4 vegetation luminance source evidence changed")
    if (
        contract.get("ownerImplementationAuthorization")
        != STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_AUTHORIZATION
    ):
        raise ValueError("Stage 4 vegetation luminance implementation lineage changed")
    expected_activation = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    activation = contract.get("activationGate", {})
    active_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    } if formal_stage_active else set()
    if set(activation) != expected_activation or any(
        activation.get(key) is not (key in active_fields) for key in expected_activation
    ):
        raise ValueError("Stage 4 vegetation luminance inactive gate changed")
    return {
        "status": (
            "stage4_vegetation_luminance_spatial_structure_contract_valid_active_full_training"
            if formal_stage_active
            else "stage4_vegetation_luminance_spatial_structure_cpu_contract_valid_inactive"
        ),
        "derivedWeight": derived["weight"],
        "previousRepair": repair,
    }


def is_stage4_object_reference_multiscale_early_convergence_qualification(
    *,
    terminal: dict,
    diagnostic: dict,
    cuda_telemetry: dict,
    cpu_report: dict,
    identity: dict,
    source: dict,
) -> bool:
    early_convergence = source.get("training", {}).get(
        "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization", {}
    )
    two_lane = diagnostic.get("gradientEvidence", {}).get(
        "twoLaneEarlyConvergenceStabilization", {}
    )
    four_object = diagnostic.get("gradientEvidence", {}).get(
        "fourObjectVisibleStructure", {}
    )
    return (
        terminal.get("status")
        == "stage4_two_lane_early_convergence_gpu_qualification_passed_closed"
        and terminal.get("optimizerCreated") is False
        and terminal.get("backwardMethodExecuted") is False
        and terminal.get("modelWeightsModified") is False
        and terminal.get("checkpointWritten") is False
        and terminal.get("trainingStarted") is False
        and terminal.get("automaticRetryStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_stage4_two_lane_early_convergence_gpu_gradient_qualification"
        and diagnostic.get("identity", {}).get("trainingObjectiveContractId")
        == STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID
        and diagnostic.get("identity", {}).get("replayLaneCount") == 2
        and diagnostic.get("diagnosticManifest", {}).get("fieldCount") == 48
        and four_object.get("combined", {}).get("finiteAndStrictlyNonzero") is True
        and float(two_lane.get("lane1DenoiserGradientNorm", 0.0)) > 0.0
        and float(two_lane.get("lane2DenoiserGradientNorm", 0.0)) > 0.0
        and float(two_lane.get("combinedTwoLaneDenoiserGradientNorm", 0.0)) > 0.0
        and two_lane.get("replayPassesAdded") == 0
        and diagnostic.get("optimizerCreated") is False
        and diagnostic.get("backwardMethodExecuted") is False
        and diagnostic.get("modelWeightsModified") is False
        and diagnostic.get("checkpointWritten") is False
        and diagnostic.get("trainingStarted") is False
        and cuda_telemetry.get("status")
        == "collected_after_readonly_forward_and_autograd_grad"
        and cpu_report.get("status")
        == "early_convergence_gpu_qualification_finalization_cpu_contract_passed"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID
        and identity.get("objectSemanticChannels")
        == ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
        and identity.get("pyramidScales")
        == list(STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES)
        and identity.get("replayLaneCount") == 2
        and early_convergence.get("contractId")
        == STAGE4_OBJECT_REFERENCE_MULTISCALE_EARLY_CONVERGENCE_STABILIZATION_ID
        and early_convergence.get("status") == "cpu_support_verified_inactive"
        and early_convergence.get("replayBudget", {}).get("addsReplayPasses") is False
        and early_convergence.get("replayBudget", {}).get("addsOptimizerSteps") is False
    )


def validate_fact_conditioned_semantic_mixture_stage4_smoke_execution_contract(
    config, project_root=None,
):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    sample = training.get("factConditionedSemanticMixtureSampleBinding", {})
    smoke = training.get("factConditionedSemanticMixtureStage4SingleSampleSmokeContract", {})
    expected_smoke = {
        "status": "active_owner_authorized_single_execution",
        "sampleId": "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "sampleSplit": "validation",
        "imagePath": sample.get("imagePath"),
        "conditionPackPath": sample.get("conditionPackPath"),
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "resolution": {"width": 256, "height": 192},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "diagnosticCheckpointReadAuthorized": False,
        "initialization": "project_random_fact_conditioned_semantic_mixture",
    }
    if (
        sample.get("sampleId") != expected_smoke["sampleId"]
        or sample.get("sampleSplit") != "validation"
        or sample.get("requiredBoundarySides") != ["west"]
        or not expected_smoke["imagePath"]
        or not expected_smoke["conditionPackPath"]
        or smoke != expected_smoke
    ):
        raise ValueError("Stage 4 semantic mixture active Smoke identity is invalid")
    preview = training.get("stage4UnifiedTrainingPreviewSamplingContract", {})
    if (
        preview.get("enabled") is not True
        or preview.get("status") != "active_owner_authorized_single_execution"
        or preview.get("samplingFunction") != "evaluate_deterministic_rollout_rgb_quality_v7"
        or preview.get("modelStateBinding") != "sha256_sorted_tensor_bytes_v1"
        or preview.get("checkpointPreviewIdentityGate") != "byte_exact_best_epoch_reproduction"
        or preview.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or preview.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
    ):
        raise ValueError("Stage 4 semantic mixture fixed preview reproduction contract is invalid")
    identity_separation = (
        validate_stage4_best_checkpoint_and_terminal_qualification_identity_separation(
            config
        )
    )
    if (
        training.get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("status") == "training_loss_active_owner_authorized"
        and identity_separation is None
    ):
        raise ValueError(
            "Stage 4 worst sample-class Smoke requires checkpoint-terminal identity separation"
        )
    execution = training.get("factConditionedSemanticMixtureStage4SmokeExecution", {})
    required_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "gpuConsumptionPath", "gpuConsumptionSha256",
        "implementationAuthorizationPath", "implementationAuthorizationSha256",
        "implementationConsumptionPath", "implementationConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
        "readonlyGpuTerminalPath", "readonlyGpuTerminalSha256",
        "readonlyGpuDiagnosticPath", "readonlyGpuDiagnosticSha256",
        "cudaTelemetryPath", "cudaTelemetrySha256",
        "readonlyCpuReportPath", "readonlyCpuReportSha256",
    }
    if set(execution) != required_fields:
        raise ValueError("Stage 4 semantic mixture Smoke execution identity fields are invalid")
    verified = {
        key: verify_config_bound_project_file(
            root, execution[f"{key}Path"], execution[f"{key}Sha256"],
            f"semantic mixture Smoke {key}",
        )
        for key in (
            "sourceInactiveConfig", "ownerAuthorization", "gpuConsumption",
            "implementationAuthorization", "implementationConsumption",
            "implementationAttestation", "readonlyGpuTerminal",
            "readonlyGpuDiagnostic", "cudaTelemetry", "readonlyCpuReport",
        )
    }
    source = read_json(verified["sourceInactiveConfig"])
    authorization = read_json(verified["ownerAuthorization"])
    consumption = read_json(verified["gpuConsumption"])
    implementation_authorization = read_json(verified["implementationAuthorization"])
    implementation_consumption = read_json(verified["implementationConsumption"])
    attestation = read_json(verified["implementationAttestation"])
    terminal = read_json(verified["readonlyGpuTerminal"])
    diagnostic = read_json(verified["readonlyGpuDiagnostic"])
    cuda_telemetry = read_json(verified["cudaTelemetry"])
    cpu_report = read_json(verified["readonlyCpuReport"])
    expected_actions = sorted(
        action.value for action in (
            ExecutionAction.SELECT_BOUND_SAMPLE,
            ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
            ExecutionAction.LOAD_AUTOENCODER,
            ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
            ExecutionAction.CREATE_OPTIMIZER,
            ExecutionAction.EXECUTE_BACKWARD,
            ExecutionAction.MUTATE_MODEL_WEIGHTS,
            ExecutionAction.WRITE_SMOKE_CHECKPOINT,
        )
    )
    legacy_qualification = (
        terminal.get("status")
        == "fact_conditioned_semantic_mixture_gradient_diagnostic_passed_closed"
        and diagnostic.get("status")
        == "passed_readonly_fact_conditioned_semantic_mixture_gpu_causal_and_gradient_diagnostic"
        and cpu_report.get("status")
        == "passed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
    )
    final_visible_rgb_qualification = (
        terminal.get("status")
        == "stage4_per_class_final_visible_rgb_gpu_qualification_passed_closed"
        and diagnostic.get("status")
        == "passed_readonly_stage4_per_class_final_visible_rgb_gpu_gradient_qualification"
        and cpu_report.get("status")
        == "passed_stage4_final_visible_rgb_readonly_gpu_diagnostic_cpu_authorization_regression"
    )
    vegetation_repair_qualification = (
        terminal.get("status")
        == "stage4_vegetation_final_visible_gpu_qualification_passed_closed"
        and diagnostic.get("status")
        == "passed_readonly_stage4_vegetation_final_visible_gpu_gradient_qualification"
        and cpu_report.get("status")
        == "passed_stage4_vegetation_final_visible_readonly_gpu_diagnostic_cpu_authorization_regression"
    )
    vegetation_luminance_qualification = (
        terminal.get("status")
        == "stage4_per_class_final_visible_rgb_gpu_qualification_passed_closed"
        and diagnostic.get("status")
        == "passed_readonly_stage4_per_class_final_visible_rgb_gpu_gradient_qualification"
        and cpu_report.get("status")
        == "passed_stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_cpu_authorization_regression"
        and diagnostic.get("identity", {}).get("trainingObjectiveContractId")
        == STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_SUPERVISION_ID
        and diagnostic.get("gradientEvidence", {}).get(
            "vegetationLuminanceSpatialStructure", {}
        ).get("reachesFinalDenoiserRgbPath") is True
        and diagnostic.get("gradientEvidence", {}).get(
            "vegetationLuminanceSpatialStructure", {}
        ).get("reachesFrozenAutoencoderDecodedRgb") is True
    )
    full_rollout_qualification = (
        terminal.get("status")
        == "stage4_full_rollout_readonly_gpu_qualification_succeeded_closed"
        and diagnostic.get("status")
        == "passed_readonly_full_50_step_rollout_gradient_qualification"
        and cpu_report.get("status")
        == "passed_stage4_full_rollout_final_visible_consistency_cpu"
        and source.get("training", {}).get(
            "stage4FullRolloutFinalVisibleConsistency", {}
        ).get("contractId") == "stage4_full_rollout_final_visible_consistency_v1"
        and source.get("training", {}).get(
            "stage4FullRolloutFinalVisibleConsistency", {}
        ).get("rolloutSteps") == 50
        and source.get("training", {}).get(
            "stage4FullRolloutFinalVisibleConsistency", {}
        ).get("gradientTailSteps") == 5
    )
    epoch_worst_replay_qualification = (
        terminal.get("status")
        == "stage4_epoch_worst_readonly_gpu_qualification_succeeded_closed"
        and diagnostic.get("status")
        == "passed_stage4_epoch_worst_readonly_gpu_qualification"
        and cpu_report.get("status")
        == "passed_stage4_epoch_worst_sample_class_replay_cpu"
        and source.get("training", {}).get(
            "stage4EpochWorstSampleClassReplay", {}
        ).get("contractId")
        == STAGE4_EPOCH_WORST_SAMPLE_CLASS_REPLAY_ID
        and source.get("training", {}).get(
            "stage4EpochWorstSampleClassReplay", {}
        ).get("replay", {}).get("passesSource")
        == "training.pathHardExampleReplay.passesPerEpoch"
    )
    object_visible_structure_qualification = (
        terminal.get("status")
        == "stage4_object_visible_structure_phase0_passed_closed"
        and terminal.get("diagnosticCheckpointPromotable") is False
        and terminal.get("smokeStarted") is False
        and terminal.get("formalTrainingStarted") is False
        and diagnostic.get("status")
        == "stage4_object_visible_structure_phase0_passed_closed"
        and diagnostic.get("optimizerSteps") == 1
        and diagnostic.get("smokeQuotaConsumed") is False
        and all(value is True for value in diagnostic.get("equality", {}).values())
        and len(diagnostic.get("equality", {})) == 5
        and cuda_telemetry.get("status")
        == "phase0_single_cuda_optimizer_step_passed_closed"
        and cuda_telemetry.get("weightsChanged") is True
        and cuda_telemetry.get("autoencoderWeightsChanged") is False
        and cuda_telemetry.get("fullTrainingInitializationEligible") is False
        and cpu_report.get("status")
        == "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction_cpu_contract_passed"
        and source.get("training", {}).get(
            "stage4ObjectVisibleStructureSupervision", {}
        ).get("contractId") == STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID
        and source.get("training", {}).get(
            "stage4ObjectVisibleStructureSupervision", {}
        ).get("status") == "cpu_support_verified_inactive"
    )
    identity = authorization.get("taskIdentity", {})
    full_rollout_per_class_luminance_qualification = (
        terminal.get("status")
        == "stage4_full_rollout_per_class_luminance_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_50_step_per_class_final_visible_luminance_structure_gradient_qualification"
        and len(diagnostic.get("perClassGradientEvidence", {})) == 4
        and all(
            value.get("lossFinite") is True
            and value.get("decodedRgbGradientFinite") is True
            and value.get("insideMaskDecodedRgbGradientAbsSum", 0) > 0
            and value.get("outsideMaskDecodedRgbGradientAbsSum") == 0
            and value.get("denoiserGradientFinite") is True
            and value.get("denoiserGradientAbsSum", 0) > 0
            for value in diagnostic.get("perClassGradientEvidence", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_full_rollout_per_class_luminance_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
        ).get("contractId")
        == STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
        ).get("status") == "cpu_support_verified_inactive"
        and source.get("training", {}).get(
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
        ).get("rolloutBinding", {}).get("rolloutSteps") == 50
        and source.get("training", {}).get(
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
        ).get("rolloutBinding", {}).get("gradientTailSteps") == 5
    )
    full_rollout_worst_sample_class_reference_luminance_qualification = (
        terminal.get("status")
        == "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_50_step_worst_sample_class_reference_luminance_gradient_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "worstWeightedSampleClass", 0
        ) > 0
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "decodedRgbGradientFinite"
        ) is True
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "insideMaskDecodedRgbGradientAbsSum", 0
        ) > 0
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "outsideMaskDecodedRgbGradientAbsSum"
        ) == 0
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "denoiserGradientFinite"
        ) is True
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "denoiserGradientAbsSum", 0
        ) > 0
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "routeWestBoundary", {}
        ).get("equalCandidatePasses") is True
        and diagnostic.get("worstSampleClassEvidence", {}).get(
            "routeWestBoundary", {}
        ).get("syntheticRegressionRejected") is True
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("contractId")
        == STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("status") == "cpu_support_verified_inactive"
        and source.get("training", {}).get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("rolloutBinding", {}).get("rolloutSteps") == 50
        and source.get("training", {}).get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
        ).get("rolloutBinding", {}).get("gradientTailSteps") == 5
    )
    per_class_reference_feature_structure_qualification = (
        terminal.get("status")
        == "stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_50_step_per_class_final_visible_reference_feature_structure_gradient_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("referenceFeatureStructureEvidence", {}).get(
            "featureStageCount", 0
        ) >= 2
        and len(
            diagnostic.get("referenceFeatureStructureEvidence", {}).get(
                "perClass", {}
            )
        ) == 4
        and all(
            value.get("lossFinite") is True
            and value.get("decodedRgbGradientFinite") is True
            and value.get("insideMaskDecodedRgbGradientAbsSum", 0) > 0
            and value.get("outsideMaskDecodedRgbGradientAbsSum") == 0
            and value.get("denoiserGradientFinite") is True
            and value.get("denoiserGradientAbsSum", 0) > 0
            and value.get("crossClassConditionSourcesIsolated") is True
            for value in diagnostic.get(
                "referenceFeatureStructureEvidence", {}
            ).get("perClass", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
        ).get("contractId")
        == STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
        ).get("status") == "cpu_support_verified_inactive"
        and source.get("training", {}).get(
            "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
        ).get("rolloutBinding", {}).get("rolloutSteps") == 50
        and source.get("training", {}).get(
            "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
        ).get("rolloutBinding", {}).get("gradientTailSteps") == 5
    )
    source_isolation_causal_boundary_qualification = (
        terminal.get("status")
        == "stage4_epoch_worst_reference_feature_replay_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_50_step_epoch_worst_reference_feature_replay_gradient_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
        and diagnostic.get("taskIdentity", {}).get("sampleId")
        == "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        and diagnostic.get("taskIdentity", {}).get("sampleSplit") == "validation"
        and diagnostic.get("taskIdentity", {}).get("seed") == 20263722
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "sourceIsolationCausalBoundaryContractId"
        ) == "stage4_reference_feature_source_isolation_causal_boundary_v1"
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "selectionIdentityPreservedAfterOtherSourceAblation"
        ) is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "selectedReplayReusesWeightedTensor"
        ) is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "selectedReplayLossPreservedAfterOtherSourceAblation"
        ) is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "selectedReplayDecodedRgbGradientPreservedAfterOtherSourceAblation"
        ) is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "selectedReplayDecodedRgbGradientEquivalence", {}
        ).get("equivalent") is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "canonicalParameterGradientRouteFinite"
        ) is True
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "canonicalParameterGradientRouteAbsSum", 0
        ) > 0
        and diagnostic.get("epochWorstReferenceFeatureReplayEvidence", {}).get(
            "independentFullParameterGradientIdentityComparisonExecuted"
        ) is False
        and len(
            diagnostic.get("referenceFeatureStructureEvidence", {}).get(
                "perClass", {}
            )
        ) == 4
        and all(
            value.get("lossFinite") is True
            and value.get("decodedRgbGradientFinite") is True
            and value.get("insideMaskDecodedRgbGradientAbsSum", 0) > 0
            and value.get("outsideMaskDecodedRgbGradientAbsSum") == 0
            and value.get("sourceIsolationCausalBoundaryContractId")
            == "stage4_reference_feature_source_isolation_causal_boundary_v1"
            and value.get("ownLossIdenticalAfterOtherSourceAblation") is True
            and value.get("ownPerSampleClassTensorIdenticalAfterOtherSourceAblation") is True
            and value.get("ownDecodedRgbGradientEquivalentAfterOtherSourceAblation") is True
            and value.get("crossClassConditionSourcesIsolated") is True
            for value in diagnostic.get(
                "referenceFeatureStructureEvidence", {}
            ).get("perClass", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_epoch_worst_reference_feature_replay_cpu_contract"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
        and identity.get("sourceIsolationCausalBoundaryContractId")
        == "stage4_reference_feature_source_isolation_causal_boundary_v1"
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4EpochWorstSampleClassReferenceFeatureStructureReplay", {}
        ).get("contractId") == STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
        and source.get("training", {}).get(
            "stage4EpochWorstSampleClassReferenceFeatureStructureReplay", {}
        ).get("status") == "cpu_support_verified_inactive"
    )
    per_class_worst_reference_feature_structure_qualification = (
        terminal.get("status")
        == "stage4_per_class_worst_sample_reference_feature_structure_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_stage4_per_class_worst_sample_reference_feature_structure_readonly_gpu_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and diagnostic.get("taskIdentity", {}).get("trainSplitSampleCount") == 48
        and diagnostic.get("taskIdentity", {}).get("validationSplitSampleCount") == 8
        and diagnostic.get("taskIdentity", {}).get("seed") == 20263722
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and len(diagnostic.get("gradientEvidence", {})) == 4
        and all(
            value.get("finite") is True
            and value.get("insideMaskDecodedRgbGradientAbsSum", 0) > 0
            and value.get("outsideMaskDecodedRgbGradientAbsSum") == 0
            and value.get("denoiserParameterGradientAbsSum", 0) > 0
            for value in diagnostic.get("gradientEvidence", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_per_class_worst_sample_reference_feature_structure_gpu_entry_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4PerClassWorstSampleReferenceFeatureStructureObligation", {}
        ).get("contractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4PerClassWorstSampleReferenceFeatureStructureObligation", {}
        ).get("status") == "cpu_support_verified_inactive"
    )
    per_class_worst_sample_final_visible_luminance_structure_qualification = (
        terminal.get("status")
        == "stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_readonly_50_step_per_class_worst_sample_final_visible_luminance_structure_gradient_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        and diagnostic.get("taskIdentity", {}).get("trainSampleSelection")
        == "first_four_train_records_in_source_index_order"
        and diagnostic.get("taskIdentity", {}).get("trainSampleCount") == 4
        and diagnostic.get("taskIdentity", {}).get("validationIdentitySampleId")
        == "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        and diagnostic.get("taskIdentity", {}).get("seed") == 20263722
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("perClassWorstSampleLuminanceEvidence", {}).get(
            "cpuOracleExactlyMatched"
        ) is True
        and diagnostic.get("perClassWorstSampleLuminanceEvidence", {}).get(
            "sameFinalVisibleLossSlotExact"
        ) is True
        and diagnostic.get("perClassWorstSampleLuminanceEvidence", {}).get(
            "sameCheckpointQualificationTensorExact"
        ) is True
        and len(
            diagnostic.get("perClassWorstSampleLuminanceEvidence", {}).get(
                "perClassGradientEvidence", {}
            )
        ) == 4
        and all(
            value.get("cpuOracleExactlyMatched") is True
            and value.get("decodedRgbGradientFinite") is True
            and value.get("insideSelectedClassMaskGradientAbsSum", 0) > 0
            and value.get("outsideSelectedClassMaskGradientAbsSum") == 0
            and value.get("denoiserGradientFinite") is True
            and value.get("denoiserGradientAbsSum", 0) > 0
            for value in diagnostic.get(
                "perClassWorstSampleLuminanceEvidence", {}
            ).get("perClassGradientEvidence", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_per_class_worst_sample_final_visible_luminance_structure_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation", {}
        ).get("contractId")
        == STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        and source.get("training", {}).get(
            "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation", {}
        ).get("status") == "cpu_support_verified_inactive"
    )
    epoch_complete_per_class_worst_luminance_selection_qualification = (
        terminal.get("status")
        == "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        and diagnostic.get("taskIdentity", {}).get("trainPopulation")
        == "all_48_train_records_in_source_index_order"
        and diagnostic.get("taskIdentity", {}).get("validationPopulation")
        == "all_8_validation_records_all_existing_rollout_seeds"
        and diagnostic.get("taskIdentity", {}).get("seed") == 20263722
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("trainSelection", {}).get("identityCount") == 48
        and len(diagnostic.get("trainSelection", {}).get("perClassSelections", [])) == 4
        and diagnostic.get("validationCheckpointIdentity", {}).get("identityCount") == 16
        and len(diagnostic.get("validationCheckpointIdentity", {}).get("perClassSelections", [])) == 4
        and len(diagnostic.get("selectedGradientEvidence", {})) == 4
        and all(
            value.get("selectionScoreExactlyReproduced") is True
            and value.get("decodedRgbGradientFinite") is True
            and value.get("insideMaskGradientAbsSum", 0) > 0
            and value.get("outsideMaskGradientAbsSum") == 0
            and value.get("denoiserGradientAbsSum", 0) > 0
            for value in diagnostic.get("selectedGradientEvidence", {}).values()
        )
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
            {},
        ).get("contractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        and source.get("training", {}).get(
            "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
            {},
        ).get("status") == "cpu_support_verified_inactive"
    )
    epoch_complete_per_class_worst_reference_feature_shared_replay_qualification = (
        terminal.get("status")
        == "stage4_reference_feature_shared_replay_readonly_gpu_qualification_succeeded_closed"
        and terminal.get("automaticRetryStarted") is False
        and terminal.get("laterExecutionStarted") is False
        and diagnostic.get("status")
        == "passed_stage4_reference_feature_shared_replay_readonly_gpu_qualification"
        and diagnostic.get("taskIdentity", {}).get("contractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID
        and diagnostic.get("taskIdentity", {}).get("trainPopulation")
        == "all_48_train_records_in_source_index_order"
        and diagnostic.get("taskIdentity", {}).get("validationPopulation")
        == "all_8_validation_records_all_existing_rollout_seeds"
        and diagnostic.get("taskIdentity", {}).get("seed") == 20263722
        and diagnostic.get("taskIdentity", {}).get("rolloutSteps") == 50
        and diagnostic.get("taskIdentity", {}).get("gradientTailSteps") == 5
        and diagnostic.get("trainSelection", {}).get("identityCount") == 48
        and len(diagnostic.get("trainSelection", {}).get("perClassSelections", [])) == 4
        and diagnostic.get("validationCheckpointIdentity", {}).get("identityCount") == 16
        and len(diagnostic.get("validationCheckpointIdentity", {}).get("perClassSelections", [])) == 4
        and len(diagnostic.get("selectedGradientEvidence", {})) == 4
        and all(
            value.get("numericallyEquivalent") is True
            and value.get("gradientFinite") is True
            and value.get("insideMaskGradientAbsSum", 0) > 0
            and value.get("outsideMaskGradientAbsSum") == 0
            and value.get("denoiserGradientAbsSum", 0) > 0
            for value in diagnostic.get("selectedGradientEvidence", {}).values()
        )
        and len(diagnostic.get("sharedReplaySchedule", [])) == 8
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cpu_report.get("status")
        == "passed_stage4_reference_feature_shared_replay_readonly_gpu_cpu_gate"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
            {},
        ).get("contractId")
        == STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID
        and source.get("training", {}).get(
            "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
            {},
        ).get("status") == "cpu_support_verified_inactive"
    )
    conflict_aware_existing_gradient_aggregation_qualification = (
        terminal.get("status")
        == "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_succeeded_closed"
        and terminal.get("optimizerCreated") is False
        and terminal.get("backwardExecuted") is False
        and terminal.get("trainingStarted") is False
        and diagnostic.get("status")
        == "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_qualification_passed"
        and diagnostic.get("contractId")
        == STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID
        and diagnostic.get("population") == {"train": 48, "validation": 8}
        and diagnostic.get("sourceOrderPreserved") is True
        and diagnostic.get("classIdentityOrder")
        == ["footprints", "tree", "rock", "vegetation"]
        and diagnostic.get("totalNegativeProjectionCount", 0) > 0
        and diagnostic.get("totalNonNegativeUnchangedCount", 0) > 0
        and len(diagnostic.get("sampleDiagnostics", [])) == 56
        and all(
            value.get("negativeProjectionCount", 0)
            + value.get("nonNegativeUnchangedCount", 0) == 12
            and value.get("aggregatedSharedGradientFiniteNonZero") is True
            and value.get("nonSharedGradientContractUnchanged") is True
            and value.get("additionalOptimizerSteps") == 0
            and value.get("additionalReplayPasses") == 0
            for value in diagnostic.get("sampleDiagnostics", [])
        )
        and diagnostic.get("executionBudget", {}).get("additionalOptimizerSteps") == 0
        and diagnostic.get("executionBudget", {}).get("additionalReplayPasses") == 0
        and diagnostic.get("executionBudget", {}).get("freeNumericalToleranceUsed") is False
        and diagnostic.get("stateHashes", {}).get("denoiserBefore")
        == diagnostic.get("stateHashes", {}).get("denoiserAfter")
        and diagnostic.get("stateHashes", {}).get("autoencoderBefore")
        == diagnostic.get("stateHashes", {}).get("autoencoderAfter")
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cuda_telemetry.get("status") == "completed"
        and cpu_report.get("status") == "passed"
        and cpu_report.get("positive", {}).get("passed")
        == cpu_report.get("positive", {}).get("total")
        and cpu_report.get("negative", {}).get("passed")
        == cpu_report.get("negative", {}).get("total")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID
        and fact_conditioned_semantic_mixture_smoke_supports_objective(
            identity.get("trainingObjectiveContractId", "")
        )
        and source.get("training", {}).get(
            "stage4ConflictAwareExistingGradientAggregation", {}
        ).get("contractId")
        == STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID
        and source.get("training", {}).get(
            "stage4ConflictAwareExistingGradientAggregation", {}
        ).get("status") == "cpu_support_verified_inactive"
    )
    controlled_structure_arm = source.get("stage4ControlledStructureArm")
    controlled_structure_qualification = (
        fact_conditioned_semantic_mixture_smoke_supports_controlled_structure_arm(
            controlled_structure_arm or ""
        )
        and terminal.get("status")
        == "controlled_structure_arm_readonly_gpu_qualification_succeeded"
        and terminal.get("arm") == controlled_structure_arm
        and diagnostic.get("status")
        == "controlled_structure_arm_readonly_gpu_qualification_succeeded"
        and diagnostic.get("arm") == controlled_structure_arm
        and diagnostic.get("conditionChannelCount") == 23
        and diagnostic.get("latentChannelCount") == 12
        and diagnostic.get("gradientEvidence", {}).get(
            "conditionGradientFiniteNonZero"
        ) is True
        and diagnostic.get("stateHashes", {}).get("denoiserUnchanged") is True
        and diagnostic.get("stateHashes", {}).get("autoencoderUnchanged") is True
        and diagnostic.get("safety", {}).get("optimizerCreated") is False
        and diagnostic.get("safety", {}).get("backwardExecuted") is False
        and diagnostic.get("safety", {}).get("modelWeightsModified") is False
        and diagnostic.get("safety", {}).get("checkpointWritten") is False
        and diagnostic.get("safety", {}).get("trainingStarted") is False
        and cuda_telemetry.get("status") == "completed"
        and cpu_report.get("status") == "passed"
        and cpu_report.get("positive", {}).get("passed")
        == cpu_report.get("positive", {}).get("total")
        and cpu_report.get("negative", {}).get("passed")
        == cpu_report.get("negative", {}).get("total")
        and source.get("training", {}).get(
            "stage4ControlledStructureThreeArm", {}
        ).get("status") == "cpu_support_verified_inactive"
        and source.get("training", {}).get(
            "stage4ControlledStructureThreeArm", {}
        ).get("armId") == controlled_structure_arm
    )
    object_reference_multiscale_qualification = (
        terminal.get("status")
        == "stage4_object_reference_multiscale_phase0_passed_closed"
        and terminal.get("diagnosticCheckpointPromotable") is False
        and terminal.get("smokeStarted") is False
        and terminal.get("formalTrainingStarted") is False
        and diagnostic.get("status")
        == "stage4_object_reference_multiscale_phase0_passed_closed"
        and diagnostic.get("optimizerSteps") == 1
        and diagnostic.get("backwardCalls") == 1
        and diagnostic.get("replayOptimizerSteps") == 0
        and diagnostic.get("diagnosticManifestMetricCount") == 48
        and diagnostic.get("requiredGradientGroupCount") == 5
        and diagnostic.get("smokeQuotaConsumed") is False
        and len(diagnostic.get("equality", {})) == 5
        and all(value is True for value in diagnostic.get("equality", {}).values())
        and cuda_telemetry.get("status")
        == "phase0_single_cuda_optimizer_step_passed_closed"
        and cuda_telemetry.get("optimizerStepCount") == 1
        and cuda_telemetry.get("backwardCallCount") == 1
        and cuda_telemetry.get("replayOptimizerStepCount") == 0
        and cuda_telemetry.get("parameterGradientsCleared") is True
        and cuda_telemetry.get("weightsChanged") is True
        and cuda_telemetry.get("autoencoderWeightsChanged") is False
        and cuda_telemetry.get("diagnosticManifest", {}).get("fieldCount") == 48
        and list(cuda_telemetry.get("requiredGradientGroups", {}))
        == ["footprints", "tree", "rock", "vegetation", "combined"]
        and cpu_report.get("status")
        == "stage4_object_reference_multiscale_phase0_success_continuation_path_correction_cpu_passed"
        and cpu_report.get("positivePassed") == cpu_report.get("positiveTotal")
        and cpu_report.get("negativePassed") == cpu_report.get("negativeTotal")
        and identity.get("trainingObjectiveContractId")
        == STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID
        and identity.get("objectSemanticChannels")
        == ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
        and identity.get("pyramidScales")
        == list(STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES)
        and source.get("training", {}).get(
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
        ).get("contractId")
        == STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID
        and source.get("training", {}).get(
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
        ).get("status") == "cpu_support_verified_inactive"
        and source.get("training", {}).get(
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
        ).get("noveltyBoundary", {}).get("failedSingleScaleContractReuseAllowed") is False
        and source.get("training", {}).get("stage4ObjectVisibleStructureSupervision") is None
    )
    object_reference_multiscale_early_convergence_qualification = (
        is_stage4_object_reference_multiscale_early_convergence_qualification(
            terminal=terminal,
            diagnostic=diagnostic,
            cuda_telemetry=cuda_telemetry,
            cpu_report=cpu_report,
            identity=identity,
            source=source,
        )
    )
    if (
        source.get("denoiserArchitecture")
        != "stage4_fact_conditioned_semantic_mixture_decoder_v1"
        or source.get("training", {}).get("trainingAuthorizationStatus")
        != FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or sorted(authorization.get("executionActions", [])) != expected_actions
        or consumption.get("status")
        != "fact_conditioned_semantic_mixture_stage4_smoke_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != execution["ownerAuthorizationSha256"]
        or consumption.get("oneTimeConsumption") is not True
        or implementation_authorization.get("status")
        not in {"resolved_owner_authorized_not_consumed", "owner_authorized_unconsumed"}
        or implementation_consumption.get("authorizationSha256")
        != execution["implementationAuthorizationSha256"]
        or implementation_consumption.get("oneTimeConsumption") is not True
        or not (
            attestation.get("status")
            == "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified"
            or (
                attestation.get("status")
                == "stage4_controlled_structure_smoke_entry_implementation_cpu_verified"
                and attestation.get("arm") == controlled_structure_arm
                and controlled_structure_qualification
            )
        )
        or attestation.get("trainerSha256") != sha256_file(Path(__file__))
        or not (
            legacy_qualification
            or final_visible_rgb_qualification
            or vegetation_repair_qualification
            or vegetation_luminance_qualification
            or full_rollout_qualification
            or full_rollout_per_class_luminance_qualification
            or full_rollout_worst_sample_class_reference_luminance_qualification
            or per_class_reference_feature_structure_qualification
            or source_isolation_causal_boundary_qualification
            or per_class_worst_reference_feature_structure_qualification
            or per_class_worst_sample_final_visible_luminance_structure_qualification
            or epoch_complete_per_class_worst_luminance_selection_qualification
            or epoch_complete_per_class_worst_reference_feature_shared_replay_qualification
            or conflict_aware_existing_gradient_aggregation_qualification
            or controlled_structure_qualification
            or epoch_worst_replay_qualification
            or object_visible_structure_qualification
            or object_reference_multiscale_qualification
            or object_reference_multiscale_early_convergence_qualification
        )
        or cpu_report.get("positivePassed") != cpu_report.get("positiveTotal")
        or cpu_report.get("negativePassed") != cpu_report.get("negativeTotal")
    ):
        raise ValueError("Stage 4 semantic mixture Smoke execution lineage is invalid")
    return {
        "status": "stage4_fact_conditioned_semantic_mixture_smoke_execution_contract_valid"
    }


def validate_condition_preserving_semantic_renderer_stage4_smoke_execution_contract(
    config, project_root=None,
):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    sample = training.get("conditionPreservingSemanticRendererSampleBinding", {})
    smoke = training.get("conditionPreservingSemanticRendererStage4SingleSampleSmokeContract", {})
    expected_smoke = {
        "status": "active_owner_authorized_single_execution",
        "sampleId": "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "sampleSplit": "validation",
        "imagePath": sample.get("imagePath"),
        "conditionPackPath": sample.get("conditionPackPath"),
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "resolution": {"width": 256, "height": 192},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "initialization": "project_random_condition_preserving_semantic_renderer",
    }
    if (
        sample.get("sampleId") != expected_smoke["sampleId"]
        or sample.get("sampleSplit") != "validation"
        or sample.get("requiredBoundarySides") != ["west"]
        or not expected_smoke["imagePath"]
        or not expected_smoke["conditionPackPath"]
        or smoke != expected_smoke
    ):
        raise ValueError("Stage 4 semantic renderer active Smoke identity is invalid")
    preview = training.get("stage4UnifiedTrainingPreviewSamplingContract", {})
    if (
        preview.get("enabled") is not True
        or preview.get("status") != "active_owner_authorized_single_execution"
        or preview.get("samplingFunction") != "evaluate_deterministic_rollout_rgb_quality_v7"
        or preview.get("modelStateBinding") != "sha256_sorted_tensor_bytes_v1"
        or preview.get("checkpointPreviewIdentityGate") != "byte_exact_best_epoch_reproduction"
        or preview.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or preview.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
    ):
        raise ValueError("Stage 4 semantic renderer fixed preview reproduction contract is invalid")
    execution = training.get("conditionPreservingSemanticRendererStage4SmokeExecution", {})
    required_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "gpuConsumptionPath", "gpuConsumptionSha256",
        "implementationAuthorizationPath", "implementationAuthorizationSha256",
        "implementationConsumptionPath", "implementationConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
        "readonlyGpuTerminalPath", "readonlyGpuTerminalSha256",
        "readonlyGpuDiagnosticPath", "readonlyGpuDiagnosticSha256",
        "cudaTelemetryPath", "cudaTelemetrySha256",
        "readonlyCpuReportPath", "readonlyCpuReportSha256",
    }
    if set(execution) != required_fields:
        raise ValueError("Stage 4 semantic renderer Smoke execution identity fields are invalid")
    verified = {
        key: verify_config_bound_project_file(
            root,
            execution[f"{key}Path"],
            execution[f"{key}Sha256"],
            f"semantic renderer Smoke {key}",
        )
        for key in (
            "sourceInactiveConfig", "ownerAuthorization", "gpuConsumption",
            "implementationAuthorization", "implementationConsumption",
            "implementationAttestation", "readonlyGpuTerminal",
            "readonlyGpuDiagnostic", "cudaTelemetry", "readonlyCpuReport",
        )
    }
    source = read_json(verified["sourceInactiveConfig"])
    authorization = read_json(verified["ownerAuthorization"])
    consumption = read_json(verified["gpuConsumption"])
    implementation_authorization = read_json(verified["implementationAuthorization"])
    implementation_consumption = read_json(verified["implementationConsumption"])
    attestation = read_json(verified["implementationAttestation"])
    terminal = read_json(verified["readonlyGpuTerminal"])
    diagnostic = read_json(verified["readonlyGpuDiagnostic"])
    cpu_report = read_json(verified["readonlyCpuReport"])
    expected_actions = sorted(
        action.value for action in (
            ExecutionAction.SELECT_BOUND_SAMPLE,
            ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
            ExecutionAction.LOAD_AUTOENCODER,
            ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
            ExecutionAction.CREATE_OPTIMIZER,
            ExecutionAction.EXECUTE_BACKWARD,
            ExecutionAction.MUTATE_MODEL_WEIGHTS,
            ExecutionAction.WRITE_SMOKE_CHECKPOINT,
        )
    )
    if (
        source.get("denoiserArchitecture") != "stage4_condition_preserving_semantic_renderer_v1"
        or source.get("training", {}).get("trainingAuthorizationStatus")
        != CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_INACTIVE_STATUS
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or sorted(authorization.get("executionActions", [])) != expected_actions
        or consumption.get("status")
        != "condition_preserving_semantic_renderer_stage4_smoke_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != execution["ownerAuthorizationSha256"]
        or consumption.get("oneTimeConsumption") is not True
        or implementation_authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or implementation_consumption.get("authorizationSha256")
        != execution["implementationAuthorizationSha256"]
        or implementation_consumption.get("oneTimeConsumption") is not True
        or attestation.get("status")
        != "condition_preserving_semantic_renderer_stage4_smoke_implementation_cpu_verified"
        or attestation.get("trainerSha256") != sha256_file(Path(__file__))
        or terminal.get("status")
        != "stage4_condition_preserving_semantic_renderer_readonly_gpu_diagnostic_passed_closed"
        or diagnostic.get("status")
        != "passed_readonly_semantic_renderer_gpu_forward_and_gradient_routing_weights_unchanged"
        or cpu_report.get("status") != "passed_cpu_only_gpu_not_started"
        or cpu_report.get("positivePassed") != cpu_report.get("positiveTotal")
        or cpu_report.get("negativePassed") != cpu_report.get("negativeTotal")
    ):
        raise ValueError("Stage 4 semantic renderer Smoke execution lineage is invalid")
    return {"status": "stage4_condition_preserving_semantic_renderer_smoke_execution_contract_valid"}


def validate_structure_fact_first_stage4_cpu_contract(config, package, project_root=None):
    mode = resolve_stage_mode(config)
    architecture = "stage4_structure_fact_first_dual_stage_generator_v1"
    phase0_mode = mode.mode_id == "structure_fact_first_stage4_phase0"
    smoke_mode = mode.mode_id == "structure_fact_first_stage4_smoke"
    if (
        mode.mode_id not in {"structure_fact_first_stage4_inactive", "structure_fact_first_stage4_phase0", "structure_fact_first_stage4_smoke"}
        or (not phase0_mode and not smoke_mode and mode.execution_kind != "cpu_inactive")
        or (phase0_mode and mode.execution_kind != "phase0_engineering")
        or (smoke_mode and mode.execution_kind != "single_sample_smoke")
        or mode.active_execution is not (phase0_mode or smoke_mode)
        or config.get("denoiserArchitecture") != architecture
    ):
        raise ValueError("Stage 4 structure-fact-first mode identity is invalid")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("Stage 4 structure-fact-first must preserve all 23 condition channels")
    if config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("Stage 4 structure-fact-first typed resize contract changed")
    if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
        raise ValueError("Stage 4 structure-fact-first latent output binding changed")
    if conditional_dataset_selection_contract(config) != "registered_v7_capacity_contribution_v1":
        raise ValueError("Stage 4 structure-fact-first must use the registered V7 capacity dataset")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("Stage 4 structure-fact-first dataset capacity must remain 64")

    training = config.get("training", {})
    structure_smoke_preflight = (
        smoke_mode
        and training.get("ownerTrainingAuthorization", {}).get("executionState")
        == "preflight_unconsumed"
        and training.get("ownerTrainingAuthorization", {}).get("preflightOnly") is True
    )
    if training.get("denoiserLossVersion") != "velocity_structure_fact_layout_condition_preserving_rgb_v1":
        raise ValueError("Stage 4 structure-fact-first Loss identity is invalid")
    if training.get("bestCheckpointMetric") != "fixed_grid_structure_fact_and_rgb_semantic_score_v1":
        raise ValueError("Stage 4 structure-fact-first checkpoint metric identity is invalid")
    contract = training.get("stage4StructureFactFirstDualStage", {})
    expected_identity = {
        "enabled": smoke_mode,
        "status": (
            "preflight_owner_authorized_readonly"
            if structure_smoke_preflight
            else "training_loss_active_owner_authorized"
            if smoke_mode
            else "cpu_support_verified_not_active"
        ),
        "contractId": "stage4_structure_fact_first_dual_stage_generator_v1",
        "architectureId": architecture,
        "conditionChannelCount": 23,
        "conditionSchemaChanged": False,
        "latentOutputShapeChanged": False,
        "autoencoderWeightsChanged": False,
        "datasetCapacityOrSplitChanged": False,
        "legacyV7V8V9ModesPreserved": True,
        "oldDenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": (
            "implemented_preflight_readonly"
            if structure_smoke_preflight
            else "implemented_active_owner_authorized"
            if smoke_mode
            else "implemented_cpu_verified_not_active"
        ),
    }
    for key, expected in expected_identity.items():
        if contract.get(key) != expected:
            raise ValueError(f"Stage 4 structure-fact-first contract {key} is invalid")

    expected_channels = [
        "terrain_path_ground", "route_required_boundary", "object_footprints",
        "object_tree", "object_rock", "object_vegetation",
    ]
    stage_a = contract.get("stageA", {})
    if (
        stage_a.get("component") != "typed_semantic_topology_layout_predictor"
        or stage_a.get("inputChannels") != config.get("conditionChannelOrder")
        or stage_a.get("outputChannels") != expected_channels
        or stage_a.get("independentTypedHeads") is not True
        or stage_a.get("auditableIntermediate") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first Stage A contract is invalid")
    stage_b = contract.get("stageB", {})
    if (
        stage_b.get("component") != "condition_preserving_rgb_latent_denoiser"
        or stage_b.get("originalConditionChannels") != config.get("conditionChannelOrder")
        or stage_b.get("structureInputChannels") != expected_channels
        or stage_b.get("injectionScales") != ["level0", "level1", "middle", "up1", "up0"]
        or stage_b.get("originalConditionsPreservedAtEveryScale") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first Stage B contract is invalid")

    expected_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_visual_fact_manifest_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "frozen_project_autoencoder_encoder_and_decoder_features",
        "current_model_prediction_derived_without_failed_preview_targets",
    ]
    supervision = contract.get("legalSupervision", {})
    if (
        supervision.get("allowedSources") != expected_sources
        or supervision.get("layoutLoss") != "balanced_binary_condition_loss_over_six_typed_structure_channels"
        or supervision.get("weightSource") != "training.denoiserLossWeights.discreteConditionOutputBinding"
        or supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
        or supervision.get("machineReviewLabelsUsedAsTrainingTargets") is not False
        or supervision.get("newFreeHyperparameterSelected") is not False
    ):
        raise ValueError("Stage 4 structure-fact-first legal supervision contract is invalid")
    if float(training.get("denoiserLossWeights", {}).get("discreteConditionOutputBinding", 0.0)) <= 0.0:
        raise ValueError("Stage 4 structure-fact-first must reuse the existing condition binding weight")
    if contract.get("hyperparameterSelections") != []:
        raise ValueError("Stage 4 structure-fact-first CPU support cannot select hyperparameters")

    checkpoint = contract.get("checkpointIsolation", {})
    if checkpoint != {
        "v7V8V9DenoiserReadOrLoadAuthorized": False,
        "newRouteCheckpointReadOrLoadAuthorized": False,
        "fixedRandomInitializationRequiredForFutureQualification": True,
        "checkpointSchema": "stage4_structure_fact_first_dual_stage_generator_v1_only",
    }:
        raise ValueError("Stage 4 structure-fact-first checkpoint isolation is invalid")
    preview = contract.get("previewReproductionIdentity", {})
    if (
        preview.get("status") != (
            "preflight_owner_authorized_readonly"
            if structure_smoke_preflight
            else "active_owner_authorized_single_execution"
            if smoke_mode
            else "contract_supported_inactive"
        )
        or preview.get("fixedEpochs") != [1, 5, 10, 20, 30]
        or preview.get("dynamicMetadataForbidden") is not True
        or preview.get("configurationActiveNow") is not smoke_mode
        or set(preview.get("requiredIdentityFields", [])) != {
            "modelStateSha256", "seed", "sampler", "timestepSequence",
            "conditionTensorSha256", "autoencoderSha256", "decodeConfigSha256",
            "rgbTensorSha256", "pngSha256",
        }
    ):
        raise ValueError("Stage 4 structure-fact-first preview identity contract is invalid")
    registry = contract.get("diagnosticManifestRegistry", {})
    if (
        registry.get("exactFieldCount") != len(STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
        or registry.get("exactFields") != list(STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
        or registry.get("fixedEpochs") != [1, 5, 10, 20, 30]
        or registry.get("rejectUnknownDiagnosticFields") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first diagnostic Manifest registry is invalid")

    activation_gate = contract.get("activationGate", {})
    expected_activation_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
        "checkpointWriteNow", "stage4FullTrainingNow", "stage5StrictRevalidationNow",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
    }
    active_smoke_fields = {"configurationActiveNow"} if structure_smoke_preflight else {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
        "checkpointWriteNow",
    } if smoke_mode else set()
    if set(activation_gate) != expected_activation_fields or any(
        activation_gate.get(key) is not (key in active_smoke_fields)
        for key in expected_activation_fields
    ):
        raise ValueError("Stage 4 structure-fact-first activation gate is not fully closed")

    root = Path(project_root or Path.cwd()).resolve()
    evidence = contract.get("evidenceBindings", {})
    evidence_specs = {
        "designTerminal": "63fc3b3c59943f8ff7028746551113d65bf16665e6aaa395582c1feae0f6f197",
        "architectureComparison": "d6d33c0819b180562846d6fc449bfc050dca588bd97aa9d057f2589995469203",
        "inactiveImplementationContract": "039b2dba38e5c3f42ee48a982a1401302bcdb1f50e3233a9e6bb0bfa0e20e75a",
        "designCpuRegression": "6b3114124d471f8e3585033fe3eb87a415b08919ef55b259266e0ac7415b7652",
    }
    for key, expected_sha in evidence_specs.items():
        identity = evidence.get(key, {})
        if identity.get("sha256") != expected_sha:
            raise ValueError(f"Stage 4 structure-fact-first evidence identity is invalid: {key}")
        verify_config_bound_project_file(root, identity.get("path"), expected_sha, key)

    implementation = contract.get("ownerImplementationAuthorization", {})
    authorization_path = verify_config_bound_project_file(
        root, implementation.get("authorizationPath"), implementation.get("authorizationSha256"),
        "Stage 4 structure-fact-first implementation authorization",
    )
    consumption_path = verify_config_bound_project_file(
        root, implementation.get("implementationConsumptionPath"), implementation.get("implementationConsumptionSha256"),
        "Stage 4 structure-fact-first implementation consumption",
    )
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    command_ref = "owner-authorized-stage4-structure-fact-first-dual-stage-cpu-support-20260810-212419895"
    scope = "implement_stage4_structure_fact_first_dual_stage_generator_v1_cpu_support_inactive_only"
    if (
        authorization.get("requestId") != command_ref
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or consumption.get("status") != "consumed_once_before_cpu_implementation"
        or consumption.get("requestId") != command_ref
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != implementation.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first implementation lineage is invalid")
    owner = training.get("ownerTrainingAuthorization", {})
    if smoke_mode:
        if owner.get("status") != STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS:
            raise ValueError("Stage 4 structure-fact-first Smoke Owner status is invalid")
        active_owner_value = not structure_smoke_preflight
        expected_owner_flags = {
            "checkpointLoadingAuthorized": active_owner_value,
            "optimizerCreationAuthorized": active_owner_value,
            "backwardExecutionAuthorized": active_owner_value,
            "modelWeightMutationAuthorized": active_owner_value,
            "gpuTrainingAuthorizedNow": active_owner_value,
            "singleSampleGpuOverfitSmokeAuthorized": active_owner_value,
            "fullTrainingAuthorized": False,
            "stage1Authorized": False,
            "stage2Authorized": False,
            "strictRevalidationAuthorized": False,
            "formalInferenceAuthorized": False,
            "checkpointPromotionAuthorized": False,
            "runtimeFrameAuthorized": False,
            "worldEntryAuthorized": False,
            "automaticRetryAuthorized": False,
        }
        if any(owner.get(key) is not expected for key, expected in expected_owner_flags.items()):
            raise ValueError("Stage 4 structure-fact-first Smoke Owner actions are invalid")
        validate_structure_fact_first_stage4_smoke_execution_contract(config, project_root)
    elif not phase0_mode:
        if owner.get("status") != "not_authorized_cpu_support_only" or any(
            owner.get(key) is not False for key in (
                "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized",
                "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized",
                "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized",
                "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
            )
        ):
            raise ValueError("Stage 4 structure-fact-first nested training authorization is not fully closed")
    elif owner.get("status") != STRUCTURE_FACT_FIRST_STAGE4_PHASE0_STATUS:
        raise ValueError("Stage 4 structure-fact-first Phase0 Owner status is invalid")
    return {
        "status": (
            "stage4_structure_fact_first_phase0_contract_valid"
            if phase0_mode
            else "stage4_structure_fact_first_smoke_contract_valid"
            if smoke_mode
            else "stage4_structure_fact_first_dual_stage_cpu_contract_valid_inactive"
        ),
        "structureChannels": expected_channels,
        "stageBInjectionScales": ["level0", "level1", "middle", "up1", "up0"],
        "diagnosticManifestFields": list(STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
        "oldDenoiserCheckpointCompatible": False,
    }


def validate_structure_fact_first_stage4_smoke_execution_contract(config, project_root=None):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    owner = training.get("ownerTrainingAuthorization", {})
    preflight_only = (
        owner.get("executionState") == "preflight_unconsumed"
        and owner.get("preflightOnly") is True
    )
    smoke = training.get("structureFactFirstStage4SingleSampleSmokeContract", {})
    qualification = training.get("stage4StructureFactFirstQualificationContract", {})
    expected_smoke = {
        "status": "preflight_owner_authorized_readonly" if preflight_only else "active_owner_authorized_single_execution",
        "sampleId": "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "sampleSplit": "validation",
        "imagePath": qualification.get("imagePath"),
        "conditionPackPath": qualification.get("conditionPackPath"),
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "resolution": {"width": 256, "height": 192},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "initialization": "project_random_structure_fact_first_denoiser",
        "phase0DiagnosticCheckpointUsedAsInitialization": False,
    }
    if (
        qualification.get("sampleId") != expected_smoke["sampleId"]
        or qualification.get("sampleSplit") != "validation"
        or qualification.get("requiredBoundarySides") != ["west"]
        or not expected_smoke["imagePath"]
        or not expected_smoke["conditionPackPath"]
        or smoke != expected_smoke
    ):
        raise ValueError("Stage 4 structure-fact-first active Smoke identity is invalid")
    preview = training.get("stage4UnifiedTrainingPreviewSamplingContract", {})
    if (
        preview.get("enabled") is not True
        or preview.get("status") != ("preflight_owner_authorized_readonly" if preflight_only else "active_owner_authorized_single_execution")
        or preview.get("samplingFunction") != "evaluate_deterministic_rollout_rgb_quality_v7"
        or preview.get("modelStateBinding") != "sha256_sorted_tensor_bytes_v1"
        or preview.get("checkpointPreviewIdentityGate") != "byte_exact_best_epoch_reproduction"
        or preview.get("failedPreviewPixelsUsedAsTrainingTargets") is not False
        or preview.get("machineReviewThresholdsUsedAsTrainingTargets") is not False
    ):
        raise ValueError("Stage 4 structure-fact-first fixed preview reproduction contract is invalid")
    execution = training.get("structureFactFirstStage4SmokeExecution", {})
    required_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "implementationAuthorizationPath", "implementationAuthorizationSha256",
        "implementationConsumptionPath", "implementationConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
        "phase0TerminalPath", "phase0TerminalSha256",
    }
    if preflight_only:
        required_fields.add("preflightOnly")
    else:
        required_fields.update({"gpuConsumptionPath", "gpuConsumptionSha256"})
    if set(execution) != required_fields:
        raise ValueError("Stage 4 structure-fact-first Smoke execution identity fields are invalid")
    verified = {
        key: verify_config_bound_project_file(
            root,
            execution[f"{key}Path"],
            execution[f"{key}Sha256"],
            f"structure-fact-first Smoke {key}",
        )
        for key in (
            "sourceInactiveConfig", "ownerAuthorization",
            *(tuple() if preflight_only else ("gpuConsumption",)),
            "implementationAuthorization", "implementationConsumption",
            "implementationAttestation", "phase0Terminal",
        )
    }
    source = read_json(verified["sourceInactiveConfig"])
    phase0_terminal = read_json(verified["phase0Terminal"])
    authorization = read_json(verified["ownerAuthorization"])
    consumption = None if preflight_only else read_json(verified["gpuConsumption"])
    implementation_authorization = read_json(verified["implementationAuthorization"])
    implementation_consumption = read_json(verified["implementationConsumption"])
    attestation = read_json(verified["implementationAttestation"])
    if (
        source.get("denoiserArchitecture") != "stage4_structure_fact_first_dual_stage_generator_v1"
        or source.get("training", {}).get("trainingAuthorizationStatus") != STRUCTURE_FACT_FIRST_STAGE4_INACTIVE_STATUS
        or phase0_terminal.get("status") != "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or (
            preflight_only
            and (
                execution.get("preflightOnly") is not True
                or authorization.get("preflightOnly") is not True
                or sorted(authorization.get("executionActions", []))
                != ["inspect_autoencoder_identity", "inspect_checkpoint_identity", "select_bound_sample"]
            )
        )
        or (
            not preflight_only
            and (
                consumption.get("status") != "structure_fact_first_stage4_smoke_authorization_atomically_consumed"
                or consumption.get("authorizationSha256") != execution["ownerAuthorizationSha256"]
                or consumption.get("oneTimeConsumption") is not True
            )
        )
        or implementation_authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or implementation_consumption.get("authorizationSha256") != execution["implementationAuthorizationSha256"]
        or implementation_consumption.get("oneTimeConsumption") is not True
        or attestation.get("status") != "structure_fact_first_stage4_smoke_implementation_cpu_verified"
        or attestation.get("trainerSha256") != sha256_file(Path(__file__))
    ):
        raise ValueError("Stage 4 structure-fact-first Smoke execution lineage is invalid")
    return {
        "status": "stage4_structure_fact_first_smoke_preflight_contract_valid"
        if preflight_only
        else "stage4_structure_fact_first_smoke_execution_contract_valid"
    }


def validate_v9_stage4_unified_preview_active_contract(config, package, project_root=None):
    root = Path(project_root or Path.cwd()).resolve()
    training = config.get("training", {})
    mode = resolve_stage_mode(config)
    validation_kernel_mode = mode.mode_id == "v9_stage4_validation_kernel_smoke"
    execution = training.get("v9Stage4SmokeExecution", {})
    required_execution_fields = {
        "sourceInactiveConfigPath", "sourceInactiveConfigSha256",
        "ownerAuthorizationPath", "ownerAuthorizationSha256",
        "gpuConsumptionPath", "gpuConsumptionSha256",
        "implementationAttestationPath", "implementationAttestationSha256",
    }
    if validation_kernel_mode:
        required_execution_fields.update({"phase0TerminalPath", "phase0TerminalSha256"})
    if execution.get("cpuContractFixture") is True:
        required_execution_fields.add("cpuContractFixture")
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
    dual_identity_gpu_authorization = (
        validation_kernel_mode
        and authorization.get("schemaVersion") == "ai-painter-stage4-v9-gpu-execution-authorization-v2"
    )
    if dual_identity_gpu_authorization:
        request_id = authorization.get("requestId")
        scope = authorization.get("ownerDecision", {}).get("scope")
        request_prefix = "owner-authorized-stage4-v9-model-smoke-gpu-execution-"
        if (
            not isinstance(request_id, str)
            or not request_id.startswith(request_prefix)
            or not request_id[len(request_prefix):]
            or any(not (character.islower() or character.isdigit() or character == "-") for character in request_id)
            or scope != "stage4_v9_single_sample_model_smoke_execution_only"
            or Path(execution.get("ownerAuthorizationPath", "")).parent.name != request_id
            or Path(execution.get("ownerAuthorizationPath", "")).name != "gpu-execution-authorization.json"
        ):
            raise ValueError("V9 Stage 4 dynamic GPU command identity is invalid")
    else:
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
        "stage4_dual_identity_implementation_code_attested_cpu_pending"
        if dual_identity_gpu_authorization
        else (
            "stage4_validation_kernel_model_smoke_implementation_cpu_verified"
            if validation_kernel_mode
            else "stage4_unified_preview_pipeline_implementation_cpu_verified"
        )
    )
    expected_attestation_authorization_sha256 = (
        authorization.get("implementationIdentity", {}).get("authorizationSha256")
        if dual_identity_gpu_authorization
        else execution.get("ownerAuthorizationSha256")
    )
    if (
        authorization.get("requestId") != request_id
        or authorization.get("status") != (
            "owner_authorized_gpu_execution_not_consumed"
            if dual_identity_gpu_authorization
            else "resolved_owner_authorized"
        )
        or authorization.get("ownerDecision", {}).get("commandRef") != request_id
        or authorization.get("ownerDecision", {}).get("scope") != scope
        or consumption.get("status") != expected_consumption_status
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != execution.get("ownerAuthorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
        or attestation.get("status") != expected_attestation_status
        or (
            attestation.get(
                "implementationAuthorizationSha256" if dual_identity_gpu_authorization else "authorizationSha256"
            )
            != expected_attestation_authorization_sha256
        )
        or (validation_kernel_mode and phase0_terminal.get("status") != "stage4_validation_kernel_phase0_passed_closed")
    ):
        raise ValueError("V9 Stage 4 unified preview authorization lineage is invalid")
    if dual_identity_gpu_authorization:
        if "implementationActions" in authorization or "authorizedActions" in authorization:
            raise ValueError("V9 Stage 4 GPU execution authorization contains implementation permissions")
        expected_execution_actions = {
            "cpuPositiveNegativeAuthorizationGate": True,
            "realNodeStartupPreflight": True,
            "pythonPreflight": True,
            "cudaResourcePreflight": True,
            "diskBudgetPreflight": True,
            "atomicGpuAuthorizationConsumption": True,
            "projectAutoencoderReadAndLoadFrozen": True,
            "v9FixedRandomInitialization": True,
            "optimizerCreation": True,
            "backwardExecution": True,
            "boundedModelWeightMutation": True,
            "singleThirtyEpochV9Smoke": True,
            "fiveBoundPreviewWrites": True,
            "seventeenDiagnosticMetricWrites": True,
            "machineReview": True,
            "smokeCheckpointWrite": True,
            "stage4FullTraining": False,
            "stage1OrStage2": False,
            "stage5StrictRevalidation": False,
            "formalInference": False,
            "checkpointPromotion": False,
            "ownerFormalVisualAcceptance": False,
            "runtimeFrame": False,
            "worldEntry": False,
            "worldRuntime": False,
            "automaticRetry": False,
            "machineReviewThresholdReduction": False,
            "failedPreviewPixelsAsTrainingTarget": False,
            "freeHyperparameterSearch": False,
        }
        if authorization.get("executionActions") != expected_execution_actions:
            raise ValueError("V9 Stage 4 GPU execution action contract is invalid")
        implementation = authorization.get("implementationIdentity", {})
        expected_implementation_fields = {
            "authorizationPath", "authorizationSha256", "consumptionPath", "consumptionSha256",
            "attestationPath", "attestationSha256",
        }
        if set(implementation) != expected_implementation_fields:
            raise ValueError("V9 Stage 4 implementation identity fields are invalid")
        implementation_authorization_path = verify_config_bound_project_file(root, implementation.get("authorizationPath"), implementation.get("authorizationSha256"), "V9 implementation authorization")
        implementation_consumption_path = verify_config_bound_project_file(root, implementation.get("consumptionPath"), implementation.get("consumptionSha256"), "V9 implementation consumption")
        if Path(implementation.get("attestationPath", "")) != Path(execution.get("implementationAttestationPath", "")) or implementation.get("attestationSha256") != execution.get("implementationAttestationSha256"):
            raise ValueError("V9 Stage 4 implementation attestation identities differ")
        implementation_authorization = read_json(implementation_authorization_path)
        implementation_consumption = read_json(implementation_consumption_path)
        if (
            implementation_authorization.get("schemaVersion") != "ai-painter-owner-implementation-authorization-v1"
            or implementation_authorization.get("status") != "owner_authorized_implementation_not_consumed"
            or implementation_consumption.get("status") != "stage4_dual_identity_lineage_implementation_authorization_atomically_consumed"
            or implementation_consumption.get("authorizationSha256") != implementation.get("authorizationSha256")
            or implementation_consumption.get("requestId") != implementation_authorization.get("requestId")
            or implementation_consumption.get("commandRef") != implementation_authorization.get("requestId")
            or implementation_consumption.get("scope") != implementation_authorization.get("ownerDecision", {}).get("scope")
            or implementation_consumption.get("oneTimeConsumption") is not True
            or attestation.get("implementationConsumptionSha256") != implementation.get("consumptionSha256")
            or attestation.get("runnerSha256") != sha256_file(root / "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
            or attestation.get("trainerSha256") != sha256_file(root / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
            or attestation.get("cpuCheckerSha256") != sha256_file(root / "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py")
            or bool(authorization.get("cpuContractFixture")) != bool(execution.get("cpuContractFixture"))
        ):
            raise ValueError("V9 Stage 4 dual-identity implementation lineage is invalid")
    else:
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
        or owner.get("status") != mode.authorization_status
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
    mode = resolve_stage_mode(config)
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
        or owner.get("status") != mode.authorization_status
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
    epoch_worst_contract = validate_stage4_epoch_worst_sample_class_replay(config)
    path_replay_passes = (
        0 if epoch_worst_contract is not None
        else r5_path_replay_passes_per_epoch(config)
    )
    epoch_worst_replay_passes = (
        int(epoch_worst_contract["replay"]["passesPerObservedPrimaryBatch"])
        if epoch_worst_contract is not None else 0
    )
    train_samples_per_epoch = min(len(datasets["train"]), batch_size) if smoke_test else len(datasets["train"])
    effective_training_presentations_per_epoch = (
        train_samples_per_epoch * (1 + path_replay_passes + epoch_worst_replay_passes)
    )
    optimizer_steps_per_epoch = (
        ((train_samples_per_epoch + batch_size - 1) // batch_size)
        * (1 + path_replay_passes + epoch_worst_replay_passes)
    )
    validation_samples = len(datasets["validation"])
    fixed_validation_sample_passes = validation_samples * fixed_timestep_count
    rollout_seeds = int(training.get("checkpointRolloutSeedsPerSample", 2)) if uses_v7_rollout_validation(config) else 0
    rollout_steps = int(config["inferenceSteps"]) if uses_v7_rollout_validation(config) else 0
    rollout_trajectories = validation_samples * rollout_seeds
    rollout_sample_passes = rollout_trajectories * rollout_steps
    training_denoiser_passes_per_epoch = (
        train_samples_per_epoch * (1 + path_replay_passes) * (1 + trajectory_supervision_steps)
        + train_samples_per_epoch * epoch_worst_replay_passes
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
        train_samples_per_epoch * (1 + path_replay_passes) * (1 + trajectory_supervision_steps)
        + train_samples_per_epoch * epoch_worst_replay_passes
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
            "epochWorstSampleClassReplayPassesPerEpoch": epoch_worst_replay_passes,
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
            "epochWorstSampleClassReplaySamplePresentations": train_samples_per_epoch * epoch_worst_replay_passes * epoch_count,
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
    if identity.get("schemaVersion") == "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1":
        return validate_structure_fact_first_phase0_cli(args, config, identity)
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
    if args.stage4_validation_kernel_phase0_reproduce or args.stage4_structure_fact_first_phase0_c_reproduce:
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


def validate_structure_fact_first_phase0_cli(args, config, identity):
    if identity.get("status") != "phase0_execution_identity_active_not_completed":
        raise ValueError("structure-fact-first Phase0 execution identity is not active")
    expected_step = (
        "causal_readonly" if (
            args.stage4_structure_fact_first_phase0_causal
            or args.stage4_structure_fact_first_phase0_c_reproduce
        )
        else "single_step_update" if args.stage4_validation_kernel_phase0_update
        else "checkpoint_reproduction"
    )
    if identity.get("phase0Step") != expected_step:
        raise ValueError("structure-fact-first Phase0 execution part is inconsistent")
    owner = config.get("training", {}).get("ownerTrainingAuthorization", {})
    if owner.get("phase0Step") != expected_step:
        raise ValueError("structure-fact-first Phase0 Owner step is inconsistent")
    bound_files = (
        ("authorization", "authorizationPath", "authorizationSha256"),
        ("execution consumption", "phase0ConsumptionPath", "phase0ConsumptionSha256"),
        ("implementation authorization", "implementationAuthorizationPath", "implementationAuthorizationSha256"),
        ("implementation consumption", "implementationConsumptionPath", "implementationConsumptionSha256"),
        ("source config", "sourceConfigPath", "sourceConfigSha256"),
        ("dataset manifest", "datasetManifestPath", "datasetManifestSha256"),
        ("Autoencoder checkpoint", "autoencoderCheckpointPath", "autoencoderCheckpointSha256"),
        ("trainer", "trainerPath", "trainerSha256"),
        ("Validation Kernel runner", "runnerPath", "runnerSha256"),
        ("CPU checker", "cpuCheckerPath", "cpuCheckerSha256"),
    )
    for label, path_key, sha_key in bound_files:
        candidate = Path(str(identity.get(path_key, "")))
        if not candidate.is_file() or sha256_file(candidate) != identity.get(sha_key):
            raise ValueError(f"structure-fact-first Phase0 bound {label} is missing or changed")
    authorization = read_json(Path(identity["authorizationPath"]))
    consumption = read_json(Path(identity["phase0ConsumptionPath"]))
    request_id = identity.get("requestId")
    command_ref = identity.get("commandRef")
    scope = identity.get("scope")
    if (
        authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId") != request_id
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or expected_step not in authorization.get("authorizedPhase0Steps", [])
        or authorization.get("executionActions") != owner.get("executionActions")
        or authorization.get("execution", {}).get("consumptionPath") != identity.get("phase0ConsumptionPath")
        or consumption.get("status") != "structure_fact_first_phase0_execution_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != command_ref
        or consumption.get("scope") != scope
        or consumption.get("authorizationPath") != identity.get("authorizationPath")
        or consumption.get("authorizationSha256") != identity.get("authorizationSha256")
        or consumption.get("oneTimeConsumption") is not True
        or expected_step not in consumption.get("authorizedPhase0Steps", [])
    ):
        raise ValueError("structure-fact-first Phase0 authorization lineage is invalid")
    c_only_operation = "checkpoint_reproduction_only"
    if args.stage4_structure_fact_first_phase0_c_reproduce:
        if (
            identity.get("phase0Operation") != c_only_operation
            or authorization.get("phase0Operation") != c_only_operation
            or consumption.get("phase0Operation") != c_only_operation
        ):
            raise ValueError("structure-fact-first Phase0-C-only operation identity changed")
        validate_stage4_structure_fact_first_phase0_c_source_lineage(identity)
    elif any(
        value.get("phase0Operation") == c_only_operation
        for value in (identity, authorization, consumption)
    ):
        raise ValueError("structure-fact-first Phase0-C-only operation entered a legacy Phase0 path")
    if (
        owner.get("authorizationPath") != identity.get("authorizationPath")
        or owner.get("authorizationSha256") != identity.get("authorizationSha256")
        or owner.get("executionConsumptionPath") != identity.get("phase0ConsumptionPath")
        or owner.get("executionConsumptionSha256") != identity.get("phase0ConsumptionSha256")
        or owner.get("requestId") != request_id
        or owner.get("commandRef") != command_ref
        or owner.get("scope") != scope
    ):
        raise ValueError("structure-fact-first Phase0 config Owner binding changed")
    fixed = identity.get("fixedTaskIdentity", {})
    if (
        fixed.get("architecture") != "stage4_structure_fact_first_dual_stage_generator_v1"
        or fixed.get("sampleId") != args.overfit_sample_id
        or fixed.get("sampleSplit") != "validation"
        or fixed.get("seed") != int(config.get("training", {}).get("seed", -1))
        or fixed.get("requiredBoundarySides") != ["west"]
        or fixed.get("datasetSplit") != V7_MVP64_SPLIT_COUNTS
        or fixed.get("phase0Resolution") != {"width": 256, "height": 192}
        or fixed.get("timestep") != 999
    ):
        raise ValueError("structure-fact-first Phase0 fixed task identity changed")
    if args.config.resolve() != Path(identity["sourceConfigPath"]).resolve() or sha256_file(args.config) != identity.get("sourceConfigSha256"):
        raise ValueError("structure-fact-first Phase0 config CLI identity changed")
    if args.dataset_package.resolve() != Path(identity["datasetManifestPath"]).resolve():
        raise ValueError("structure-fact-first Phase0 dataset CLI identity changed")
    if args.autoencoder_checkpoint.resolve() != Path(identity["autoencoderCheckpointPath"]).resolve():
        raise ValueError("structure-fact-first Phase0 Autoencoder CLI identity changed")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("structure-fact-first Phase0 forbids old Denoiser Checkpoint input")
    if expected_step == "checkpoint_reproduction" or args.stage4_structure_fact_first_phase0_c_reproduce:
        if args.phase0_diagnostic_checkpoint is None or not args.phase0_diagnostic_checkpoint.is_file():
            raise ValueError("structure-fact-first Phase0 reproduction requires its diagnostic Checkpoint")
        if (
            project_path(args.phase0_diagnostic_checkpoint) != identity.get("diagnosticCheckpointPath")
            or sha256_file(args.phase0_diagnostic_checkpoint) != identity.get("diagnosticCheckpointSha256")
        ):
            raise ValueError("structure-fact-first Phase0 diagnostic Checkpoint identity changed")
    elif args.phase0_diagnostic_checkpoint is not None:
        raise ValueError("structure-fact-first Phase0 causal/update execution cannot load a Denoiser Checkpoint")
    return identity


def validate_stage4_structure_fact_first_phase0_c_source_lineage(identity):
    source = identity.get("diagnosticCheckpointSource")
    if not isinstance(source, dict):
        raise ValueError("structure-fact-first Phase0-C diagnostic Checkpoint source lineage is missing")
    required_files = (
        ("single-step update report", "updateReportPath", "updateReportSha256"),
        ("single-step update identity", "updateIdentityPath", "updateIdentitySha256"),
        ("source execution authorization", "executionAuthorizationPath", "executionAuthorizationSha256"),
        ("source execution consumption", "executionConsumptionPath", "executionConsumptionSha256"),
    )
    for label, path_key, sha_key in required_files:
        path = Path(str(source.get(path_key, "")))
        if not path.is_file() or sha256_file(path) != source.get(sha_key):
            raise ValueError(f"structure-fact-first Phase0-C bound {label} is missing or changed")

    update_report = read_json(Path(source["updateReportPath"]))
    update_identity = read_json(Path(source["updateIdentityPath"]))
    source_authorization = read_json(Path(source["executionAuthorizationPath"]))
    source_consumption = read_json(Path(source["executionConsumptionPath"]))
    source_run_id = source.get("runId")
    fixed = identity.get("fixedTaskIdentity", {})
    if (
        not isinstance(source_run_id, str)
        or not source_run_id
        or source_run_id == identity.get("runId")
        or update_report.get("status") != "phase0_single_cuda_optimizer_step_passed_closed"
        or update_report.get("runId") != source_run_id
        or update_report.get("optimizerStepCount") != 1
        or update_report.get("weightsChanged") is not True
        or update_report.get("autoencoderWeightsChanged") is not False
        or update_report.get("checkpointPath") != identity.get("diagnosticCheckpointPath")
        or update_report.get("checkpointSha256") != identity.get("diagnosticCheckpointSha256")
        or update_report.get("conditionTensorSha256") != "dbc65181f60013c1f3cd05e6c7334e8fe4a96e2dd6252f60c47bd79017692847"
        or update_identity.get("schemaVersion") != "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1"
        or update_identity.get("status") != "phase0_execution_identity_active_not_completed"
        or update_identity.get("phase0Step") != "single_step_update"
        or update_identity.get("runId") != source_run_id
        or update_identity.get("fixedTaskIdentity") != fixed
        or update_identity.get("authorizationPath") != source.get("executionAuthorizationPath")
        or update_identity.get("authorizationSha256") != source.get("executionAuthorizationSha256")
        or update_identity.get("phase0ConsumptionPath") != source.get("executionConsumptionPath")
        or update_identity.get("phase0ConsumptionSha256") != source.get("executionConsumptionSha256")
        or source_authorization.get("schemaVersion") != "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1"
        or source_authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or source_authorization.get("requestId") != update_identity.get("requestId")
        or source_authorization.get("commandRef") != update_identity.get("commandRef")
        or source_authorization.get("scope") != update_identity.get("scope")
        or "single_step_update" not in source_authorization.get("authorizedPhase0Steps", [])
        or source_authorization.get("taskIdentity") != {
            "architecture": fixed.get("architecture"),
            "sampleId": fixed.get("sampleId"),
            "sampleSplit": fixed.get("sampleSplit"),
            "seed": fixed.get("seed"),
            "timestep": fixed.get("timestep"),
            "resolution": fixed.get("phase0Resolution"),
            "requiredBoundarySides": fixed.get("requiredBoundarySides"),
            "datasetSplit": fixed.get("datasetSplit"),
        }
        or source_consumption.get("schemaVersion") != "ai-painter-stage4-structure-fact-first-phase0-execution-consumption-v1"
        or source_consumption.get("status") != "structure_fact_first_phase0_execution_authorization_atomically_consumed"
        or source_consumption.get("requestId") != source_authorization.get("requestId")
        or source_consumption.get("commandRef") != source_authorization.get("commandRef")
        or source_consumption.get("scope") != source_authorization.get("scope")
        or source_consumption.get("runId") != source_run_id
        or source_consumption.get("authorizationPath") != source.get("executionAuthorizationPath")
        or source_consumption.get("authorizationSha256") != source.get("executionAuthorizationSha256")
        or source_consumption.get("oneTimeConsumption") is not True
        or "single_step_update" not in source_consumption.get("authorizedPhase0Steps", [])
    ):
        raise ValueError("structure-fact-first Phase0-C diagnostic Checkpoint source lineage is invalid")
    return source


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

    if args.stage4_structure_fact_first_phase0_causal:
        return run_structure_fact_first_phase0_causal(
            args, config, datasets, dataset_binding_evidence, overfit_evidence,
            sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
        )
    if args.stage4_validation_kernel_phase0_update:
        return run_stage4_validation_kernel_phase0_update(
            args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
            sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
        )
    return run_stage4_validation_kernel_phase0_reproduce(
        args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
        sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
    )


def run_structure_fact_first_phase0_causal(
    args, config, datasets, dataset_binding_evidence, overfit_evidence,
    sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
):
    model.eval()
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    selected = build_optimization_datasets(datasets, overfit_evidence)
    sample = selected["validation"][0]
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    with torch.no_grad():
        raw_latent = model.autoencoder.encode(image)
        mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
        std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
        clean_latent = (raw_latent - mean) / std
    timestep = torch.tensor([999], dtype=torch.long, device=device)
    set_seed(int(config["training"]["seed"]))
    noise = torch.randn(clean_latent.shape, device=device, dtype=clean_latent.dtype)
    noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
    alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
    channel_names = tuple(STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS)

    def decode_velocity(velocity):
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * velocity
        return model.autoencoder.decode(predicted_clean * std + mean)

    def deterministic_backend_state():
        return {
            "deterministicAlgorithmsEnabled": bool(torch.are_deterministic_algorithms_enabled()),
            "cudnnDeterministic": bool(torch.backends.cudnn.deterministic),
            "cudnnBenchmark": bool(torch.backends.cudnn.benchmark),
            "cublasWorkspaceConfig": os.environ.get("CUBLAS_WORKSPACE_CONFIG"),
        }

    determinism_state_before = deterministic_backend_state()
    determinism_state_after = None
    route_reproduction_evidence = {}
    try:
        with stage4_fixed_preview_determinism_scope(True):
            determinism_state_inside = deterministic_backend_state()
            event("phase0_a_local_determinism_scope", "started", backendState=determinism_state_inside)
            event("phase0_a_normal_forward", "started", backendState=determinism_state_inside)
            try:
                normal_velocity, normal_alignment = model.predict_velocity_with_stage4_structure_fact(
                    noisy_latent, timestep, conditions,
                )
                normal_heads = {
                    name: value.detach()
                    for name, value in zip(channel_names, normal_alignment["structureHeadOutputs"])
                }
                normal_rgb = decode_velocity(normal_velocity)
            except Exception as error:
                event("phase0_a_normal_forward", "failed", backendState=deterministic_backend_state(), errorType=type(error).__name__, errorMessage=str(error))
                raise
            route_reproduction_evidence["normal"] = {
                "backendState": deterministic_backend_state(),
                "velocitySha256": tensor_sha256(normal_velocity),
                "decodedRgbSha256": tensor_sha256(normal_rgb),
            }
            event("phase0_a_normal_forward", "completed", **route_reproduction_evidence["normal"])

            def run_with_head_override(route):
                handles = []
                permutation = tuple(reversed(channel_names))
                try:
                    for index, name in enumerate(channel_names):
                        if route == "zero":
                            hook = lambda module, inputs, output: torch.zeros_like(output)
                        else:
                            source = normal_heads[permutation[index]]
                            shift = (index + 1, (index * 3 + 1) % max(1, source.shape[-1]))
                            transformed = torch.roll(source, shifts=shift, dims=(-2, -1))
                            hook = lambda module, inputs, output, value=transformed: value.to(
                                device=output.device, dtype=output.dtype
                            )
                        handles.append(model.denoiser.structure_fact_heads[name].register_forward_hook(hook))
                    with torch.no_grad():
                        velocity, alignment = model.predict_velocity_with_stage4_structure_fact(
                            noisy_latent, timestep, conditions.detach(),
                        )
                        rgb = decode_velocity(velocity)
                    return velocity, rgb, alignment
                finally:
                    for handle in handles:
                        handle.remove()

            def run_marked_causal_route(step, route, evidence_key):
                event(step, "started", route=route, backendState=deterministic_backend_state())
                try:
                    result = run_with_head_override(route)
                except Exception as error:
                    event(step, "failed", route=route, backendState=deterministic_backend_state(), errorType=type(error).__name__, errorMessage=str(error))
                    raise
                route_reproduction_evidence[evidence_key] = {
                    "route": route,
                    "backendState": deterministic_backend_state(),
                    "velocitySha256": tensor_sha256(result[0]),
                    "decodedRgbSha256": tensor_sha256(result[1]),
                }
                event(step, "completed", **route_reproduction_evidence[evidence_key])
                return result

            zero_velocity, zero_rgb, zero_alignment = run_marked_causal_route("phase0_a_zero_forward", "zero", "zeroFirst")
            shuffle_velocity, shuffle_rgb, shuffle_alignment = run_marked_causal_route("phase0_a_shuffle_forward", "shuffle", "shuffleFirst")
            zero_velocity_repeat, zero_rgb_repeat, _ = run_marked_causal_route("phase0_a_zero_repeat_forward", "zero", "zeroRepeat")
            shuffle_velocity_repeat, shuffle_rgb_repeat, _ = run_marked_causal_route("phase0_a_shuffle_repeat_forward", "shuffle", "shuffleRepeat")

            route_tensors = {
                "normal": (normal_velocity.detach(), normal_rgb.detach()),
                "zero": (zero_velocity, zero_rgb),
                "shuffle": (shuffle_velocity, shuffle_rgb),
            }
            route_hashes = {
                name: {
                    "velocitySha256": tensor_sha256(values[0]),
                    "decodedRgbSha256": tensor_sha256(values[1]),
                }
                for name, values in route_tensors.items()
            }
            repeat_matches = {
                "zeroVelocity": route_reproduction_evidence["zeroFirst"]["velocitySha256"] == route_reproduction_evidence["zeroRepeat"]["velocitySha256"],
                "zeroDecodedRgb": route_reproduction_evidence["zeroFirst"]["decodedRgbSha256"] == route_reproduction_evidence["zeroRepeat"]["decodedRgbSha256"],
                "shuffleVelocity": route_reproduction_evidence["shuffleFirst"]["velocitySha256"] == route_reproduction_evidence["shuffleRepeat"]["velocitySha256"],
                "shuffleDecodedRgb": route_reproduction_evidence["shuffleFirst"]["decodedRgbSha256"] == route_reproduction_evidence["shuffleRepeat"]["decodedRgbSha256"],
            }
            event("phase0_a_repeat_determinism", "started", matches=repeat_matches, routes=route_reproduction_evidence)
            try:
                if not all(repeat_matches.values()):
                    raise ValueError("structure-fact-first Phase0-A causal routes are not deterministic")
            except Exception as error:
                event("phase0_a_repeat_determinism", "failed", matches=repeat_matches, routes=route_reproduction_evidence, errorType=type(error).__name__, errorMessage=str(error))
                raise
            event("phase0_a_repeat_determinism", "completed", matches=repeat_matches)
            differences = {}
            event("phase0_a_causal_difference_qualification", "started")
            try:
                for route in ("zero", "shuffle"):
                    velocity_mae = float((route_tensors["normal"][0] - route_tensors[route][0]).abs().mean().cpu())
                    rgb_mae = float((route_tensors["normal"][1] - route_tensors[route][1]).abs().mean().cpu())
                    if not math.isfinite(velocity_mae) or not math.isfinite(rgb_mae) or velocity_mae <= 0.0 or rgb_mae <= 0.0:
                        raise ValueError(f"structure-fact-first Phase0-A {route} route has no finite nonzero causal response")
                    differences[route] = {"velocityMaeFromNormal": velocity_mae, "decodedRgbMaeFromNormal": rgb_mae}
            except Exception as error:
                event("phase0_a_causal_difference_qualification", "failed", errorType=type(error).__name__, errorMessage=str(error))
                raise
            event("phase0_a_causal_difference_qualification", "completed")
            event("phase0_a_local_determinism_scope", "completed", backendState=deterministic_backend_state())
    finally:
        determinism_state_after = deterministic_backend_state()
        event(
            "phase0_a_local_determinism_scope_restore",
            "completed",
            backendStateBefore=determinism_state_before,
            backendStateAfter=determinism_state_after,
            restored=determinism_state_after == determinism_state_before,
        )

    if determinism_state_after != determinism_state_before:
        raise ValueError("structure-fact-first Phase0-A deterministic backend state was not restored")

    head_parameters = [
        parameter
        for name in channel_names
        for parameter in model.denoiser.structure_fact_heads[name].parameters()
    ]
    stage_b_parameters = [
        next(model.denoiser.structure_fact_stage_b_adapters[name].parameters())
        for name in ("level0", "level1", "middle", "up1", "up0")
    ]
    base_parameter = model.denoiser.latent_stem.weight
    stage_a_parameter = next(model.denoiser.structure_fact_shared_trunk.parameters())
    event("phase0_a_gradient_qualification", "started")
    try:
        gradients = torch.autograd.grad(
            normal_velocity.square().mean(),
            (stage_a_parameter, *head_parameters, *stage_b_parameters, base_parameter, conditions),
            retain_graph=False,
            create_graph=False,
            allow_unused=True,
        )
        if any(value is None or not bool(torch.isfinite(value).all()) or float(value.abs().sum()) <= 0.0 for value in gradients):
            raise ValueError("structure-fact-first Phase0-A response gradient route is missing or invalid")
        condition_gradient = gradients[-1]
        condition_norms = [float(condition_gradient[:, index:index + 1].abs().mean().cpu()) for index in range(23)]
        if any(not math.isfinite(value) or value <= 0.0 for value in condition_norms):
            raise ValueError("structure-fact-first Phase0-A original 23-channel response is incomplete")
    except Exception as error:
        event("phase0_a_gradient_qualification", "failed", errorType=type(error).__name__, errorMessage=str(error))
        raise
    event("phase0_a_gradient_qualification", "completed")

    base_height, base_width = clean_latent.shape[-2:]
    if tuple(channel_names) != STAGE4_STRUCTURE_FACT_CHANNEL_ORDER:
        raise ValueError("structure-fact-first Phase0-A topology channel order changed")
    synthetic = torch.zeros((1, len(channel_names), base_height, base_width), device=device)
    synthetic[:, 0, :, : max(1, base_width // 8)] = 1.0
    synthetic[:, 1, :, 0] = 1.0
    synthetic[:, 2, base_height // 3: max(base_height // 3 + 1, base_height * 2 // 3), base_width // 3: max(base_width // 3 + 1, base_width * 2 // 3)] = 1.0
    scale_sizes = {
        "level0": (base_height, base_width),
        "level1": (max(1, base_height // 2), max(1, base_width // 2)),
        "middle": (max(1, base_height // 4), max(1, base_width // 4)),
        "up1": (max(1, base_height // 2), max(1, base_width // 2)),
        "up0": (base_height, base_width),
    }
    topology = {}
    event("phase0_a_multiscale_topology_qualification", "started")
    try:
        for scale, size in scale_sizes.items():
            transferred = resize_stage4_structure_fact_layout(
                synthetic,
                size=size,
                channel_order=channel_names,
            )
            row = {
                "shape": list(transferred.shape),
                "finite": bool(torch.isfinite(transferred).all()),
                "westBoundaryContact": float(transferred[:, 1, :, 0].sum().cpu()),
                "routeNonEmptySupport": int(torch.count_nonzero(transferred[:, 0:2] > 0).cpu()),
                "footprintNonEmptyArea": int(torch.count_nonzero(transferred[:, 2] > 0).cpu()),
            }
            if not row["finite"] or row["westBoundaryContact"] <= 0.0 or row["routeNonEmptySupport"] <= 0 or row["footprintNonEmptyArea"] <= 0:
                raise ValueError(f"structure-fact-first Phase0-A bilinear topology evidence failed:{scale}")
            topology[scale] = row
    except Exception as error:
        event("phase0_a_multiscale_topology_qualification", "failed", errorType=type(error).__name__, errorMessage=str(error))
        raise
    event("phase0_a_multiscale_topology_qualification", "completed")

    torch.cuda.synchronize(0)
    cuda = {
        "deviceIndex": 0,
        "deviceName": torch.cuda.get_device_name(0),
        "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
        "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
        "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
    }
    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("structure-fact-first Phase0-A changed model state")
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-a-causal-report-v1",
        "status": "structure_fact_first_phase0_a_causal_and_topology_qualification_passed_closed",
        "recordedAtUtc": utc_now(),
        "runId": identity["runId"],
        "dataset": dataset_binding_evidence,
        "sample": overfit_evidence,
        "boundaryProvenance": sample_bound_boundary_provenance,
        "routeTensorHashes": route_hashes,
        "routeReproductionEvidence": route_reproduction_evidence,
        "repeatMatches": repeat_matches,
        "determinismScope": {
            "backendStateBefore": determinism_state_before,
            "backendStateInside": determinism_state_inside,
            "backendStateAfter": determinism_state_after,
            "restored": determinism_state_after == determinism_state_before,
        },
        "causalDifferences": differences,
        "stageAHeadCount": len(channel_names),
        "stageBScaleCount": len(stage_b_parameters),
        "conditionChannelGradientNorms": condition_norms,
        "topologyPreservation": topology,
        "cuda": cuda,
        "denoiserStateSha256Before": denoiser_before,
        "denoiserStateSha256After": denoiser_after,
        "autoencoderStateSha256Before": autoencoder_before,
        "autoencoderStateSha256After": autoencoder_after,
        "modelStateUnchanged": True,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "checkpointWritten": False,
        "telemetryPath": project_path(telemetry_path),
    }
    topology_path = args.output_dir / "phase0-a-topology-report.json"
    report_path = args.output_dir / "phase0-a-causal-report.json"
    write_json(topology_path, {"schemaVersion": "ai-painter-stage4-phase0-a-bilinear-topology-report-v1", "status": "bilinear_topology_preserved_at_all_five_scales", "scales": topology})
    write_json(report_path, report)
    print(json.dumps({**report, "reportPath": project_path(report_path), "reportSha256": sha256_file(report_path), "topologyReportPath": project_path(topology_path), "topologyReportSha256": sha256_file(topology_path)}, ensure_ascii=False, indent=2))
    return 0


def stage4_object_reference_multiscale_phase0_pre_step_gradient_evidence(
    model, loss_metrics, config,
):
    expected_fields = tuple(fact_conditioned_semantic_mixture_diagnostic_fields(config))
    registry = config["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    if (
        len(expected_fields) != 48
        or registry.get("exactFieldCount") != 48
        or registry.get("exactFields") != list(expected_fields)
    ):
        raise ValueError("object-reference-multiscale Phase0 diagnostic field contract changed")
    diagnostic_values = {}
    for field in expected_fields:
        value = loss_metrics.get(field)
        if not isinstance(value, torch.Tensor):
            raise ValueError(f"object-reference-multiscale Phase0 metric missing:{field}")
        scalar = float(value.detach().cpu())
        if not math.isfinite(scalar) or scalar < 0.0:
            raise ValueError(f"object-reference-multiscale Phase0 metric invalid:{field}")
        diagnostic_values[field] = scalar

    object_contract = validate_stage4_object_reference_multiscale_luminance_structure_supervision(
        config
    )
    object_terms = (
        ("footprints", "object_footprints", "Footprints"),
        ("tree", "object_tree", "Tree"),
        ("rock", "object_rock", "Rock"),
        ("vegetation", "object_vegetation", "Vegetation"),
    )
    all_denoiser_parameters = tuple(
        parameter for parameter in model.denoiser.parameters() if parameter.requires_grad
    )
    if not all_denoiser_parameters:
        raise ValueError("object-reference-multiscale Phase0 Denoiser parameters are missing")

    def gradient_summary(values):
        present = tuple(value for value in values if value is not None)
        finite = bool(present) and all(bool(torch.isfinite(value).all()) for value in present)
        absolute_sum = sum(float(value.detach().abs().sum().cpu()) for value in present)
        if not finite or not math.isfinite(absolute_sum) or absolute_sum <= 0.0:
            raise ValueError("object-reference-multiscale Phase0 required gradient is missing")
        return {"finite": True, "absoluteSum": absolute_sum}

    groups = {}
    combined_loss = loss_metrics["compositeLossTensor"].new_zeros(())
    for identity, source_channel, prefix in object_terms:
        metric = f"stage4SemanticMixture{prefix}FinalTypedMultiscaleLuminanceStructureLoss"
        loss = loss_metrics.get(metric)
        if not isinstance(loss, torch.Tensor):
            raise ValueError(f"object-reference-multiscale Phase0 loss missing:{identity}")
        denoiser = gradient_summary(torch.autograd.grad(
            loss, all_denoiser_parameters, retain_graph=True, allow_unused=True,
        ))
        matching_parameters = tuple(
            model.denoiser.semantic_mixture_experts[identity].parameters()
        )
        matching = gradient_summary(torch.autograd.grad(
            loss, matching_parameters, retain_graph=True, allow_unused=True,
        ))
        weight = float(object_contract["derivedWeights"][identity])
        if not math.isfinite(weight) or weight <= 0.0:
            raise ValueError(f"object-reference-multiscale Phase0 weight invalid:{identity}")
        combined_loss = combined_loss + loss * weight
        groups[identity] = {
            "sourceChannel": source_channel,
            "metric": metric,
            "lossValue": float(loss.detach().cpu()),
            "derivedWeight": weight,
            "denoiserGradient": denoiser,
            "matchingSemanticMixtureExpertGradient": matching,
            "finiteAndStrictlyNonzero": True,
        }
    groups["combined"] = {
        "metric": "weightedFourObjectReferenceMultiscaleLoss",
        "lossValue": float(combined_loss.detach().cpu()),
        "denoiserGradient": gradient_summary(torch.autograd.grad(
            combined_loss, all_denoiser_parameters, retain_graph=True, allow_unused=True,
        )),
        "finiteAndStrictlyNonzero": True,
    }
    if any(parameter.grad is not None for parameter in model.denoiser.parameters()):
        raise ValueError("object-reference-multiscale pre-step gate populated parameter.grad")
    return {
        "fourObjectReferenceMultiscale": groups,
        "diagnosticManifest": {
            "fieldCount": 48,
            "fields": list(expected_fields),
            "values": diagnostic_values,
        },
    }


def run_stage4_validation_kernel_phase0_update(
    args, config, package, datasets, dataset_binding_evidence, overfit_evidence,
    sample_bound_boundary_provenance, identity, model, diffusion, device, event, telemetry_path,
):
    structure_phase0 = identity.get("schemaVersion") == "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1"
    object_reference_multiscale_phase0 = identity.get("schemaVersion") == (
        "ai-painter-stage4-object-reference-multiscale-phase0-execution-identity-v1"
    )
    selected = build_optimization_datasets(datasets, overfit_evidence)
    event("latent_normalization", "started")
    latent_normalization = compute_latent_normalization(
        model, selected["train"] if structure_phase0 else datasets["train"], device
    )
    event("latent_normalization", "completed", sampleCount=latent_normalization["sampleCount"])
    loader = torch.utils.data.DataLoader(selected["train"], batch_size=1, shuffle=False, num_workers=0)
    event("optimizer_creation", "started")
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    event("optimizer_creation", "completed")
    before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    event("single_training_step", "started", deterministicAlgorithmsEnabled=torch.are_deterministic_algorithms_enabled())
    phase0_pre_step_evidence = {}
    metrics = train_epoch(
        model, loader, optimizer, diffusion, latent_normalization, device, config, 0,
        max_batches=1, step_telemetry_path=None, enable_path_replay=False,
        enable_epoch_worst_replay=not object_reference_multiscale_phase0,
        phase0_pre_step_gate=(
            stage4_object_reference_multiscale_phase0_pre_step_gradient_evidence
            if object_reference_multiscale_phase0 else None
        ),
        phase0_pre_step_evidence=phase0_pre_step_evidence,
    )
    gradients = [parameter.grad.detach() for parameter in model.denoiser.parameters() if parameter.grad is not None]
    if not gradients or any(not bool(torch.isfinite(value).all()) for value in gradients):
        raise ValueError("Stage4 validation kernel Phase0 gradients are missing or non-finite")
    gradient_abs_sum = sum(float(value.abs().sum()) for value in gradients)
    gradient_nonzero_count = sum(int(torch.count_nonzero(value)) for value in gradients)
    if gradient_abs_sum <= 0.0 or gradient_nonzero_count <= 0:
        raise ValueError("Stage4 validation kernel Phase0 gradient is zero")
    gradient_groups = {}
    if structure_phase0:
        groups = {
            **{
                f"stageA.{name}": tuple(model.denoiser.structure_fact_heads[name].parameters())
                for name in STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS
            },
            **{
                f"stageB.{name}": tuple(model.denoiser.structure_fact_stage_b_adapters[name].parameters())
                for name in ("level0", "level1", "middle", "up1", "up0")
            },
            "baseDenoiser": (model.denoiser.latent_stem.weight,),
        }
        for name, parameters in groups.items():
            values = [parameter.grad for parameter in parameters if parameter.grad is not None]
            finite = bool(values) and all(bool(torch.isfinite(value).all()) for value in values)
            absolute_sum = sum(float(value.abs().sum()) for value in values)
            if not finite or absolute_sum <= 0.0:
                raise ValueError(f"structure-fact-first Phase0-B required gradient is missing:{name}")
            gradient_groups[name] = {"finite": True, "absoluteSum": absolute_sum}
    optimizer_steps = {
        int(value["step"].detach().cpu()) if torch.is_tensor(value.get("step")) else int(value.get("step", 0))
        for value in optimizer.state.values()
    }
    if (structure_phase0 or object_reference_multiscale_phase0) and optimizer_steps != {1}:
        raise ValueError("Stage4 Phase0 optimizer step count is not exactly one")
    after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    if before == after:
        raise ValueError("Stage4 validation kernel Phase0 optimizer step did not change model state")
    if autoencoder_before != autoencoder_after:
        raise ValueError("Stage4 validation kernel Phase0 changed the frozen Autoencoder")
    optimizer.zero_grad(set_to_none=True)
    parameter_gradients_cleared = all(
        parameter.grad is None for parameter in model.denoiser.parameters()
    )
    if object_reference_multiscale_phase0 and not parameter_gradients_cleared:
        raise ValueError("object-reference-multiscale Phase0 parameter gradients were not cleared")
    multiscale_gradient_groups = (
        phase0_pre_step_evidence.get("fourObjectReferenceMultiscale", {})
        if object_reference_multiscale_phase0 else gradient_groups
    )
    diagnostic_manifest = (
        phase0_pre_step_evidence.get("diagnosticManifest")
        if object_reference_multiscale_phase0 else None
    )
    event("single_training_step", "completed", gradientFinite=True, gradientNonzero=True, weightsChanged=True)
    checkpoint_path = args.output_dir / "phase0-diagnostic-checkpoint.pt"
    event("diagnostic_checkpoint_write", "started")
    selected_sample = selected["validation"][0]
    condition_sha256 = (
        stage4_structure_fact_first_phase0_condition_sha256(selected_sample["conditions"], config)
        if structure_phase0
        else tensor_sha256(selected_sample["conditions"])
    )
    effective_config_sha256 = phase0_effective_config_sha256(config) if structure_phase0 else sha256_file(args.config)
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
        "phase0EffectiveConfigSha256": effective_config_sha256,
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "autoencoderCheckpointPath": project_path(args.autoencoder_checkpoint),
        "autoencoderCheckpointSha256": sha256_file(args.autoencoder_checkpoint),
        "sampleId": overfit_evidence["sampleId"],
        "sampleSplit": overfit_evidence["selectedSplit"],
        "conditionTensorSha256": condition_sha256,
        "seed": int(config["training"]["seed"]),
        "requiredBoundarySides": ["west"],
        "initialDenoiserStateSha256": before,
        "finalDenoiserStateSha256": after,
        "autoencoderStateSha256": autoencoder_after,
        "executionAuthorizationIdentity": {
            "requestId": identity.get("requestId"),
            "commandRef": identity.get("commandRef"),
            "scope": identity.get("scope"),
            "authorizationPath": identity.get("authorizationPath"),
            "authorizationSha256": identity.get("authorizationSha256"),
            "consumptionPath": identity.get("phase0ConsumptionPath"),
            "consumptionSha256": identity.get("phase0ConsumptionSha256"),
        },
        "gradientFinite": True,
        "gradientNonzero": True,
        "gradientAbsSum": gradient_abs_sum,
        "gradientNonzeroCount": gradient_nonzero_count,
        "requiredGradientGroups": multiscale_gradient_groups,
        "diagnosticManifest": diagnostic_manifest,
        "optimizerStepCount": 1 if (structure_phase0 or object_reference_multiscale_phase0) else None,
        "backwardCallCount": 1 if object_reference_multiscale_phase0 else None,
        "replayOptimizerStepCount": 0 if object_reference_multiscale_phase0 else None,
        "parameterGradientsCleared": parameter_gradients_cleared,
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
        "initialAutoencoderStateSha256": autoencoder_before,
        "finalAutoencoderStateSha256": autoencoder_after,
        "autoencoderWeightsChanged": autoencoder_before != autoencoder_after,
        "requiredGradientGroups": multiscale_gradient_groups,
        "diagnosticManifest": diagnostic_manifest,
        "optimizerStepCount": 1 if (structure_phase0 or object_reference_multiscale_phase0) else None,
        "backwardCallCount": 1 if object_reference_multiscale_phase0 else None,
        "replayOptimizerStepCount": 0 if object_reference_multiscale_phase0 else None,
        "parameterGradientsCleared": parameter_gradients_cleared,
        "conditionTensorSha256": condition_sha256,
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
    structure_phase0 = identity.get("schemaVersion") == "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1"
    c_only_source = (
        validate_stage4_structure_fact_first_phase0_c_source_lineage(identity)
        if args.stage4_structure_fact_first_phase0_c_reproduce
        else None
    )
    expected_checkpoint_run_id = c_only_source.get("runId") if c_only_source else identity.get("runId")
    expected_checkpoint_execution_identity = None
    if c_only_source:
        source_identity = read_json(Path(c_only_source["updateIdentityPath"]))
        expected_checkpoint_execution_identity = {
            "requestId": source_identity.get("requestId"),
            "commandRef": source_identity.get("commandRef"),
            "scope": source_identity.get("scope"),
            "authorizationPath": c_only_source.get("executionAuthorizationPath"),
            "authorizationSha256": c_only_source.get("executionAuthorizationSha256"),
            "consumptionPath": c_only_source.get("executionConsumptionPath"),
            "consumptionSha256": c_only_source.get("executionConsumptionSha256"),
        }
    if (
        checkpoint.get("schemaVersion") != "ai-painter-stage4-validation-kernel-phase0-diagnostic-checkpoint-v1"
        or checkpoint.get("status") != "phase0_diagnostic_checkpoint_nonpromotable_not_training_initialization"
        or checkpoint.get("runId") != expected_checkpoint_run_id
        or (
            c_only_source is not None
            and checkpoint.get("executionAuthorizationIdentity") != expected_checkpoint_execution_identity
        )
        or (
            checkpoint.get("phase0EffectiveConfigSha256") != phase0_effective_config_sha256(config)
            if structure_phase0
            else checkpoint.get("configSha256") != sha256_file(args.config)
        )
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
    model.denoiser.eval()
    model_state_sha = state_dict_sha256(model.denoiser.state_dict())
    if model_state_sha != checkpoint.get("finalDenoiserStateSha256"):
        raise ValueError("Stage4 validation kernel restored model state identity changed")
    latent_normalization = load_latent_normalization(checkpoint, device)
    if structure_phase0:
        torch.set_rng_state(checkpoint["cpuRngState"])
        torch.cuda.set_rng_state_all(checkpoint["cudaRngStates"])
        random.setstate(checkpoint["pythonRandomState"])
        np.random.set_state(checkpoint["numpyRandomState"])
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
    if structure_phase0:
        execution_condition_sha256 = artifact.get("conditionTensorSha256")
        artifact["executionConditionTensorSha256"] = execution_condition_sha256
        artifact["conditionTensorSha256"] = stage4_structure_fact_first_phase0_condition_sha256(
            selected["validation"][0]["conditions"],
            config,
        )
        artifact["conditionIdentityContract"] = "stage4_structure_fact_first_phase0_canonical_single_sample_v1"
    if artifact.get("denoiserStateSha256") != model_state_sha:
        raise ValueError("Stage4 validation kernel preview model state identity changed")
    if structure_phase0 and artifact.get("conditionTensorSha256") != checkpoint.get("conditionTensorSha256"):
        raise ValueError("structure-fact-first Phase0 preview condition identity changed")
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


def phase0_effective_config_sha256(config):
    value = deepcopy(config)
    training = value.get("training", {})
    training.pop("ownerTrainingAuthorization", None)
    training["trainingAuthorizationStatus"] = STRUCTURE_FACT_FIRST_STAGE4_PHASE0_STATUS
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


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
    enable_epoch_worst_replay=True,
    phase0_pre_step_gate=None,
    phase0_pre_step_evidence=None,
    epoch_complete_selection_state=None,
    epoch_complete_train_dataset=None,
):
    model.denoiser.train()
    totals = {}
    count = 0
    samples_processed = 0
    configured_epoch_worst_contract = validate_stage4_epoch_worst_sample_class_replay(config)
    epoch_worst_contract = (
        configured_epoch_worst_contract if enable_epoch_worst_replay else None
    )
    configured_reference_feature_replay_contract = (
        validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
            config
        )
    )
    reference_feature_replay_contract = (
        configured_reference_feature_replay_contract
        if (
            enable_epoch_worst_replay
            and configured_reference_feature_replay_contract is not None
            and configured_reference_feature_replay_contract["status"]
            == "training_loss_active_owner_authorized"
        )
        else None
    )
    configured_epoch_complete_contract = (
        validate_stage4_epoch_complete_per_class_worst_luminance_selection(config)
    )
    epoch_complete_contract = (
        configured_epoch_complete_contract
        if (
            enable_epoch_worst_replay
            and configured_epoch_complete_contract is not None
            and configured_epoch_complete_contract["status"]
            == "training_loss_active_owner_authorized"
        )
        else None
    )
    configured_epoch_complete_reference_feature_contract = (
        validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    )
    epoch_complete_reference_feature_contract = (
        configured_epoch_complete_reference_feature_contract
        if (
            enable_epoch_worst_replay
            and configured_epoch_complete_reference_feature_contract is not None
            and configured_epoch_complete_reference_feature_contract["status"]
            == "training_loss_active_owner_authorized"
        )
        else None
    )
    configured_conflict_aware_gradient_contract = (
        validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    )
    conflict_aware_gradient_contract = (
        configured_conflict_aware_gradient_contract
        if (
            configured_conflict_aware_gradient_contract is not None
            and configured_conflict_aware_gradient_contract["status"]
            == "training_paradigm_active_owner_authorized"
        )
        else None
    )
    configured_early_convergence_contract = (
        validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )
    )
    early_convergence_contract = (
        configured_early_convergence_contract
        if (
            enable_epoch_worst_replay
            and configured_early_convergence_contract is not None
            and configured_early_convergence_contract["status"]
            == "training_loss_active_owner_authorized"
        )
        else None
    )
    if early_convergence_contract is not None and epoch_worst_contract is None:
        raise ValueError(
            "Stage 4 early-convergence stabilization requires epoch-worst replay"
        )
    if reference_feature_replay_contract is not None and epoch_worst_contract is None:
        raise ValueError(
            "Stage 4 reference-feature replay requires epoch-worst replay"
        )
    if epoch_complete_contract is not None and epoch_worst_contract is None:
        raise ValueError(
            "Stage 4 epoch-complete per-class selection requires epoch-worst replay"
        )
    if (
        epoch_complete_reference_feature_contract is not None
        and (
            epoch_complete_contract is None
            or reference_feature_replay_contract is None
            or epoch_worst_contract is None
        )
    ):
        raise ValueError(
            "Stage 4 reference-feature shared replay requires active luminance, "
            "reference-feature and epoch-worst parent contracts"
        )
    if epoch_worst_contract is not None and int(config["training"]["batchSize"]) != 1:
        raise ValueError("Stage 4 epoch-worst replay requires the locked batchSize=1 contract")
    epoch_complete_ledger = None
    epoch_complete_reference_feature_ledger = None
    prior_epoch_complete_result = None
    prior_epoch_complete_reference_feature_result = None
    epoch_complete_dataset_index = None
    if epoch_complete_contract is not None:
        if (
            not isinstance(epoch_complete_selection_state, dict)
            or epoch_complete_train_dataset is None
            or len(epoch_complete_train_dataset) != 48
        ):
            raise ValueError(
                "Stage 4 epoch-complete selector requires the exact 48-record train split"
            )
        epoch_complete_dataset_index = {
            str(row["sampleId"]): index
            for index, row in enumerate(epoch_complete_train_dataset.rows)
        }
        if (
            len(epoch_complete_dataset_index) != 48
            or len(set(epoch_complete_dataset_index)) != 48
        ):
            raise ValueError(
                "Stage 4 epoch-complete selector train identities changed"
            )
        prior_epoch_complete_result = epoch_complete_selection_state.get(
            "priorEpochResult"
        )
        prior_epoch_complete_reference_feature_result = (
            epoch_complete_selection_state.get("priorReferenceFeatureEpochResult")
        )
        prior_epoch_number = epoch_complete_selection_state.get("priorEpochNumber")
        if epoch_index == 0:
            if (
                prior_epoch_complete_result is not None
                or prior_epoch_complete_reference_feature_result is not None
                or prior_epoch_number is not None
            ):
                raise ValueError(
                    "Stage 4 epoch-complete selector carried cross-run state into Epoch 1"
                )
        elif (
            not isinstance(prior_epoch_complete_result, dict)
            or (
                epoch_complete_reference_feature_contract is not None
                and not isinstance(
                    prior_epoch_complete_reference_feature_result, dict
                )
            )
            or int(prior_epoch_number or -1) != epoch_index
        ):
            raise ValueError(
                "Stage 4 epoch-complete selector previous-Epoch identity is missing"
            )
        epoch_complete_ledger = stage4_epoch_complete_per_class_selection_ledger(
            config, "train", 48,
        )
        if epoch_complete_reference_feature_contract is not None:
            epoch_complete_reference_feature_ledger = (
                stage4_epoch_complete_per_class_selection_ledger(
                    config, "train", 48,
                    objective_identity="reference_feature_structure",
                )
            )
    epoch_worst = None
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
        full_rollout_metrics = stage4_full_rollout_final_visible_consistency(
            model,
            conditions,
            image,
            diffusion["alphasCumulative"],
            latent_normalization,
            config,
            batch_index,
        )
        if full_rollout_metrics is not None:
            loss_metrics["compositeLossTensor"] = (
                loss_metrics["compositeLossTensor"]
                + full_rollout_metrics["stage4FullRolloutFinalVisibleConsistencyLossTensor"]
            )
            loss_metrics["compositeLoss"] = loss_metrics["compositeLossTensor"]
            loss_metrics.update(full_rollout_metrics)
            per_class_worst_luminance_contract = config.get("training", {}).get(
                "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation",
                {},
            )
            if (
                per_class_worst_luminance_contract.get("status")
                == "training_loss_active_owner_authorized"
            ):
                weighted_per_sample_class = full_rollout_metrics.get(
                    "stage4FullRolloutWeightedPerSampleClassLuminanceStructureTensor"
                )
                if epoch_complete_ledger is not None and len(loader.dataset) == 48:
                    stage4_collect_epoch_complete_per_class_selection_scores(
                        epoch_complete_ledger,
                        weighted_per_sample_class,
                        batch["sampleId"],
                        config,
                    )
                else:
                    per_class_worst_luminance = (
                        stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(
                            weighted_per_sample_class,
                            batch["sampleId"],
                            config,
                        )
                    )
                    existing_global_worst = full_rollout_metrics.get(
                        "stage4FullRolloutWorstSampleClassReferenceLuminanceWeightedLoss"
                    )
                    replacement = per_class_worst_luminance[
                        "checkpointQualificationTensor"
                    ]
                    if not isinstance(existing_global_worst, torch.Tensor):
                        raise ValueError(
                            "Stage 4 global worst luminance Loss slot is unavailable"
                        )
                    loss_metrics["compositeLossTensor"] = (
                        loss_metrics["compositeLossTensor"]
                        - existing_global_worst
                        + replacement
                    )
                    loss_metrics["compositeLoss"] = loss_metrics[
                        "compositeLossTensor"
                    ]
                    loss_metrics[
                        "stage4PerClassWorstSampleFinalVisibleLuminanceStructureWeightedLoss"
                    ] = replacement
                    for selection in per_class_worst_luminance["perClassSelections"]:
                        identity = upper_camel(selection["classIdentity"])
                        loss_metrics[
                            f"stage4PerClassWorstSample{identity}FinalVisibleLuminanceStructureLoss"
                        ] = per_class_worst_luminance["perClassWorstTensors"][
                            selection["classIdentity"]
                        ]
            per_class_worst_contract = (
                validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
                    config
                )
            )
            if (
                epoch_complete_reference_feature_ledger is not None
                and len(loader.dataset) == 48
            ):
                stage4_collect_epoch_complete_per_class_selection_scores(
                    epoch_complete_reference_feature_ledger,
                    full_rollout_metrics.get(
                        "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
                    ),
                    batch["sampleId"],
                    config,
                    objective_identity="reference_feature_structure",
                )
            if (
                per_class_worst_contract is not None
                and per_class_worst_contract["status"]
                == "training_loss_active_owner_authorized"
            ):
                per_class_worst = (
                    stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
                        full_rollout_metrics.get(
                            "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
                        ),
                        batch["sampleId"],
                        config,
                    )
                )
                existing_reference_feature = full_rollout_metrics.get(
                    "stage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss"
                )
                if (
                    not isinstance(existing_reference_feature, torch.Tensor)
                    or not torch.allclose(
                        per_class_worst["checkpointQualificationTensor"],
                        existing_reference_feature,
                        atol=0.0,
                        rtol=0.0,
                    )
                ):
                    raise ValueError(
                        "Stage 4 per-class worst reference-feature Smoke Loss slot changed"
                    )
                loss_metrics[
                    "stage4PerClassWorstSampleReferenceFeatureStructureWeightedLoss"
                ] = per_class_worst["checkpointQualificationTensor"]
                for selection in per_class_worst["perClassSelections"]:
                    identity = upper_camel(selection["classIdentity"])
                    loss_metrics[
                        f"stage4PerClassWorstSample{identity}ReferenceFeatureStructureLoss"
                    ] = per_class_worst["perClassWorstTensors"][
                        selection["classIdentity"]
                    ]
        conflict_aware_gradient_result = None
        conflict_aware_shared_parameters = None
        if conflict_aware_gradient_contract is not None:
            per_sample_class = loss_metrics.get(
                "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
            )
            if (
                not isinstance(per_sample_class, torch.Tensor)
                or per_sample_class.ndim != 2
                or per_sample_class.shape[1]
                != len(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES) - 1
            ):
                raise ValueError(
                    "Stage 4 conflict-aware per-class gradient source is unavailable"
                )
            conflict_aware_shared_parameters = tuple(model.denoiser.output.parameters())
            if not conflict_aware_shared_parameters:
                raise ValueError(
                    "Stage 4 conflict-aware shared output parameter group is empty"
                )
            source_contract = validate_stage4_full_rollout_final_visible_consistency(
                config
            )
            if source_contract is None:
                raise ValueError(
                    "Stage 4 conflict-aware full-rollout source contract is unavailable"
                )
            rollout_weight = float(source_contract["weight"])
            per_class_gradients = {}
            for class_index, identity in enumerate(
                conflict_aware_gradient_contract["classOrder"]
            ):
                raw_class_loss = per_sample_class[:, class_index].mean() * rollout_weight
                gradients = torch.autograd.grad(
                    raw_class_loss,
                    conflict_aware_shared_parameters,
                    retain_graph=True,
                    allow_unused=True,
                )
                per_class_gradients[identity] = tuple(
                    torch.zeros_like(parameter) if gradient is None else gradient
                    for parameter, gradient in zip(
                        conflict_aware_shared_parameters, gradients
                    )
                )
            conflict_aware_gradient_result = (
                stage4_conflict_aware_existing_gradient_aggregation(
                    per_class_gradients, config
                )
            )
            negative_projection_count = sum(
                1
                for interaction in conflict_aware_gradient_result["interactions"]
                if interaction["projected"] is True
            )
            nonnegative_unchanged_count = sum(
                1
                for interaction in conflict_aware_gradient_result["interactions"]
                if interaction["projected"] is False
            )
            loss_metrics["stage4ConflictAwareNegativeProjectionCount"] = (
                per_sample_class.new_tensor(float(negative_projection_count))
            )
            loss_metrics["stage4ConflictAwareNonNegativeUnchangedCount"] = (
                per_sample_class.new_tensor(float(nonnegative_unchanged_count))
            )
            loss_metrics["stage4ConflictAwareApplied"] = per_sample_class.new_tensor(1.0)
        if epoch_worst_contract is not None:
            if reference_feature_replay_contract is not None:
                reference_feature_tensor = loss_metrics.get(
                    "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
                )
                candidate = stage4_epoch_worst_reference_feature_candidate(
                    reference_feature_tensor, batch["sampleId"], config
                )
                if candidate is None:
                    raise ValueError(
                        "Stage 4 epoch-worst reference-feature candidate is unavailable"
                    )
                sample_index = candidate["sampleIndex"]
                if epoch_worst is None or candidate["selectionKey"] < epoch_worst["selectionKey"]:
                    epoch_worst = {
                        **candidate,
                        "sampleId": str(batch["sampleId"][sample_index]),
                        "rolloutBatchIndex": batch_index,
                        "image": image[sample_index:sample_index + 1].detach().cpu().clone(),
                        "conditions": conditions[sample_index:sample_index + 1].detach().cpu().clone(),
                    }
            else:
                weighted_classes = loss_metrics.get(
                    "stage4DistributionAwareWeightedPerSampleClassTensor"
                )
                if not isinstance(weighted_classes, torch.Tensor) or weighted_classes.shape != (
                    image.shape[0], len(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
                ):
                    raise ValueError("Stage 4 epoch-worst replay class ledger is unavailable")
                rollout_score = loss_metrics.get(
                    "stage4FullRolloutFinalVisibleConsistencyWeightedLoss",
                    weighted_classes.new_zeros(()),
                )
                for sample_index in range(image.shape[0]):
                    class_index = int(weighted_classes[sample_index].argmax().detach())
                    score = float(
                        (weighted_classes[sample_index, class_index] + rollout_score).detach()
                    )
                    sample_id = str(batch["sampleId"][sample_index])
                    candidate_key = (
                        -score, sample_id,
                        FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[class_index],
                    )
                    if epoch_worst is None or candidate_key < epoch_worst["selectionKey"]:
                        epoch_worst = {
                            "selectionKey": candidate_key,
                            "score": score,
                            "sampleId": sample_id,
                            "classIndex": class_index,
                            "image": image[sample_index:sample_index + 1].detach().cpu().clone(),
                            "conditions": conditions[sample_index:sample_index + 1].detach().cpu().clone(),
                        }
        record_stage4_step(
            step_telemetry_path,
            "forward_loss",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        if phase0_pre_step_gate is not None:
            if batch_index != 0 or phase0_pre_step_evidence is None:
                raise ValueError("Phase0 pre-step gradient gate invocation is invalid")
            phase0_pre_step_evidence.clear()
            phase0_pre_step_evidence.update(
                phase0_pre_step_gate(model, loss_metrics, config)
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
        if conflict_aware_gradient_result is not None:
            stage4_apply_conflict_aware_existing_gradient_replacement(
                conflict_aware_shared_parameters,
                conflict_aware_gradient_result,
            )
        optimizer.step()
        record_stage4_step(
            step_telemetry_path,
            "optimizer_step",
            "completed",
            epoch=epoch_index + 1,
            batch=batch_index + 1,
        )
        replay_passes = (
            r5_path_replay_passes_per_epoch(config)
            if enable_path_replay and epoch_worst_contract is None else 0
        )
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
        epoch_worst_replay_passes = (
            int(epoch_worst_contract["replay"]["passesPerObservedPrimaryBatch"])
            if epoch_worst_contract is not None else 0
        )
        epoch_worst_replay_totals = {}
        if epoch_worst_replay_passes:
            if epoch_worst is None:
                raise ValueError("Stage 4 epoch-worst replay did not observe a training sample")
            for replay_index in range(epoch_worst_replay_passes):
                epoch_complete_selection = (
                    stage4_epoch_complete_shared_replay_selection_for_epoch(
                        prior_epoch_complete_result,
                        prior_epoch_complete_reference_feature_result,
                        epoch_complete_selection_state.get("priorEpochNumber"),
                        epoch_index,
                        epoch_index * len(loader) + batch_index,
                        replay_index,
                        config,
                    )
                    if epoch_complete_reference_feature_contract is not None
                    else stage4_epoch_complete_per_class_replay_selection(
                        prior_epoch_complete_result,
                        epoch_index * len(loader) + batch_index,
                        replay_index,
                        config,
                    )
                    if prior_epoch_complete_result is not None
                    else None
                )
                if epoch_complete_selection is not None:
                    selected_sample_id = epoch_complete_selection["sampleId"]
                    if selected_sample_id not in epoch_complete_dataset_index:
                        raise ValueError(
                            "Stage 4 epoch-complete selected sample left the train split"
                        )
                    selected_item = epoch_complete_train_dataset[
                        epoch_complete_dataset_index[selected_sample_id]
                    ]
                    replay_image = selected_item["image"].unsqueeze(0).to(device)
                    replay_conditions = selected_item["conditions"].unsqueeze(0).to(device)
                    optimizer.zero_grad(set_to_none=True)
                    selected_rollout = stage4_full_rollout_final_visible_consistency(
                        model,
                        replay_conditions,
                        replay_image,
                        diffusion["alphasCumulative"],
                        latent_normalization,
                        config,
                        epoch_complete_dataset_index[selected_sample_id],
                    )
                    reference_feature_replay = (
                        epoch_complete_selection.get("objectiveIdentity")
                        == "reference_feature_structure"
                    )
                    selected_loss = (
                        stage4_epoch_complete_selected_reference_feature_replay_loss_from_tensor(
                            selected_rollout.get(
                                "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
                            ),
                            epoch_complete_selection["classIdentity"],
                            config,
                        )
                        if reference_feature_replay
                        else stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
                            selected_rollout.get(
                                "stage4FullRolloutWeightedPerSampleClassLuminanceStructureTensor"
                            ),
                            epoch_complete_selection["classIdentity"],
                            config,
                        )
                    )
                    selected_loss.backward()
                    optimizer.step()
                    epoch_worst_replay_totals[
                        "stage4EpochCompletePerClassSelectedReferenceFeatureReplayLoss"
                        if reference_feature_replay
                        else "stage4EpochCompletePerClassSelectedLuminanceReplayLoss"
                    ] = (
                        epoch_worst_replay_totals.get(
                            "stage4EpochCompletePerClassSelectedReferenceFeatureReplayLoss"
                            if reference_feature_replay
                            else "stage4EpochCompletePerClassSelectedLuminanceReplayLoss",
                            0.0,
                        )
                        + float(selected_loss.detach())
                    )
                    record_stage4_step(
                        step_telemetry_path,
                        "epoch_complete_per_class_selected_reference_feature_replay"
                        if reference_feature_replay
                        else "epoch_complete_per_class_selected_luminance_replay",
                        "completed",
                        epoch=epoch_index + 1,
                        batch=batch_index + 1,
                        replayPass=replay_index + 1,
                        sampleId=selected_sample_id,
                        classIdentity=epoch_complete_selection["classIdentity"],
                        selectionScore=epoch_complete_selection["weightedScore"],
                    )
                    continue
                replay_image = epoch_worst["image"].to(device)
                replay_conditions = epoch_worst["conditions"].to(device)
                with torch.no_grad():
                    replay_latent = normalize_latent(
                        model.autoencoder.encode(replay_image), latent_normalization,
                    )
                replay_timestep = training_timesteps(
                    config, epoch_index,
                    batch_index + (replay_index + 1) * len(loader),
                    len(loader) * (1 + epoch_worst_replay_passes),
                    replay_image.shape[0],
                    diffusion["alphasCumulative"].shape[0], device,
                )
                replay_noise = torch.randn_like(replay_latent)
                replay_noisy_latent = add_noise(
                    replay_latent, replay_noise, replay_timestep,
                    diffusion["alphasCumulative"],
                )
                replay_target_velocity = velocity_target(
                    replay_latent, replay_noise, replay_timestep,
                    diffusion["alphasCumulative"],
                )
                optimizer.zero_grad(set_to_none=True)
                epoch_replay_metrics = stage4_epoch_worst_sample_class_replay_supervision(
                    model, replay_noisy_latent, replay_target_velocity, replay_latent,
                    replay_timestep, diffusion["alphasCumulative"], replay_conditions,
                    replay_image, latent_normalization, config, epoch_worst["classIndex"],
                    replay_index=replay_index,
                    full_rollout_batch_index=epoch_worst.get("rolloutBatchIndex"),
                )
                epoch_replay_metrics["stage4EpochWorstSampleClassReplayLossTensor"].backward()
                optimizer.step()
                for key, value in epoch_replay_metrics.items():
                    if key.endswith("Tensor"):
                        continue
                    epoch_worst_replay_totals[key] = (
                        epoch_worst_replay_totals.get(key, 0.0) + float(value.detach())
                    )
                record_stage4_step(
                    step_telemetry_path, "epoch_worst_sample_class_replay", "completed",
                    epoch=epoch_index + 1, batch=batch_index + 1,
                    replayPass=replay_index + 1, sampleId=epoch_worst["sampleId"],
                    classIdentity=(
                        epoch_worst["classIdentity"]
                        if reference_feature_replay_contract is not None
                        else
                        "joint_four_object_reference_multiscale"
                        if early_convergence_contract is not None and replay_index == 1
                        else FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[
                            epoch_worst["classIndex"]
                        ]
                    ),
                    replayLane=(
                        "same_selected_reference_feature_structure_sample_class"
                        if reference_feature_replay_contract is not None
                        else
                        early_convergence_contract["lanes"][replay_index]["laneId"]
                        if early_convergence_contract is not None
                        else "legacy_global_worst_sample_class"
                    ),
                    selectionScore=epoch_worst["score"],
                )
            for key, value in epoch_worst_replay_totals.items():
                loss_metrics[key] = loss_metrics["compositeLossTensor"].new_tensor(
                    value / epoch_worst_replay_passes
                )
            loss_metrics["stage4EpochWorstSampleClassSelectionScore"] = (
                loss_metrics["compositeLossTensor"].new_tensor(epoch_worst["score"])
            )
            loss_metrics["stage4EpochWorstSampleClassReplayPasses"] = (
                loss_metrics["compositeLossTensor"].new_tensor(
                    float(epoch_worst_replay_passes)
                )
            )
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
                "optimizerStepsCompletedInEpoch": count * (
                    1 + replay_passes + epoch_worst_replay_passes
                ),
            })
    if count == 0:
        raise ValueError("conditional denoiser training loader produced no batches")
    if epoch_complete_ledger is not None and len(loader.dataset) != 48:
        # Single-sample Smoke keeps the primary optimization identity fixed,
        # but the selector is defined over the complete approved train split.
        # This detached scan adds no optimizer step; selected identities are
        # applied only through the existing two replay steps next epoch.
        was_training = model.denoiser.training
        model.denoiser.eval()
        with torch.no_grad():
            for selection_index in range(len(epoch_complete_train_dataset)):
                selection_item = epoch_complete_train_dataset[selection_index]
                selection_image = selection_item["image"].unsqueeze(0).to(device)
                selection_conditions = selection_item["conditions"].unsqueeze(0).to(device)
                selection_rollout = stage4_full_rollout_final_visible_consistency(
                    model,
                    selection_conditions,
                    selection_image,
                    diffusion["alphasCumulative"],
                    latent_normalization,
                    config,
                    selection_index,
                )
                stage4_collect_epoch_complete_per_class_selection_scores(
                    epoch_complete_ledger,
                    selection_rollout[
                        "stage4FullRolloutWeightedPerSampleClassLuminanceStructureTensor"
                    ],
                    [selection_item["sampleId"]],
                    config,
                )
                if epoch_complete_reference_feature_ledger is not None:
                    stage4_collect_epoch_complete_per_class_selection_scores(
                        epoch_complete_reference_feature_ledger,
                        selection_rollout[
                            "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
                        ],
                        [selection_item["sampleId"]],
                        config,
                        objective_identity="reference_feature_structure",
                    )
        if was_training:
            model.denoiser.train()
    if epoch_complete_ledger is not None:
        finalized = stage4_finalize_epoch_complete_per_class_selection(
            epoch_complete_ledger, config,
        )
        epoch_complete_selection_state.clear()
        state_update = {
            "priorEpochNumber": epoch_index + 1,
            "priorEpochResult": finalized,
        }
        if epoch_complete_reference_feature_ledger is not None:
            reference_feature_finalized = (
                stage4_finalize_epoch_complete_per_class_selection(
                    epoch_complete_reference_feature_ledger,
                    config,
                    objective_identity="reference_feature_structure",
                )
            )
            state_update[
                "priorReferenceFeatureEpochResult"
            ] = reference_feature_finalized
            totals[
                "stage4EpochCompletePerClassReferenceFeatureSelectionIdentityCount"
            ] = float(reference_feature_finalized["identityCount"]) * count
        epoch_complete_selection_state.update(state_update)
        totals[
            "stage4EpochCompletePerClassSelectionIdentityCount"
        ] = float(finalized["identityCount"]) * count
    return {key: value / count for key, value in totals.items()}


def validate_stage4_full_rollout_final_visible_consistency(config):
    training = config.get("training", {})
    contract = training.get("stage4FullRolloutFinalVisibleConsistency", {})
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "sampler", "rolloutInitialization",
        "rolloutSteps", "gradientTailSteps", "gradientTailSource", "weight",
        "weightSource", "finalVisibleTerms", "legalSupervision", "compatibility",
        "evidenceBindings", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 full-rollout final-visible contract fields changed")
    if (
        contract.get("enabled") is not True
        or contract.get("contractId") != "stage4_full_rollout_final_visible_consistency_v1"
        or contract.get("sampler") != "same_deterministic_velocity_sampler_as_fixed_preview"
        or contract.get("rolloutInitialization") != "deterministic_noise_from_training_seed_plus_existing_preview_offset"
        or int(contract.get("rolloutSteps", 0)) != int(config.get("inferenceSteps", 0))
        or int(contract.get("gradientTailSteps", 0)) != 5
        or contract.get("gradientTailSource") != "existing_v7_r5_cross_domain_visual_consistency_contract"
        or not math.isclose(
            float(contract.get("weight", float("nan"))),
            float(training["shortTrajectorySupervision"]["weight"]),
            rel_tol=0.0,
            abs_tol=1e-12,
        )
        or contract.get("weightSource") != "training.shortTrajectorySupervision.weight"
    ):
        raise ValueError("Stage 4 full-rollout final-visible identity changed")
    expected_terms = {
        "decodedRgb": float(training["denoiserLossWeights"]["decodedRgb"]),
        "spatialGridRgb": float(training["denoiserLossWeights"]["spatialGridRgb"]),
        "terrainWaterMaskedRgb": float(training["denoiserLossWeights"]["sparseRegionDecodedRgb"]),
        "routeInteriorRgb": float(training["denoiserLossWeights"]["pathInteriorRgb"]),
        "routeForbiddenBoundaryRgb": float(training["denoiserLossWeights"]["pathForbiddenBoundaryRgb"]),
        "routeCoverage": float(training["pathCoverageCalibration"]["weight"]),
        "routeActivationMass": float(training["pathActivationMassCalibration"]["weight"]),
        "routeRequiredBoundary": float(training["denoiserLossWeights"]["pathBoundaryRgb"]),
        "perClassDistributionAware": "reuse_stage4_distribution_aware_visible_spatial_semantic_obligation",
    }
    if contract.get("finalVisibleTerms") != expected_terms:
        raise ValueError("Stage 4 full-rollout final-visible weight provenance changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": [
            "terrain_water", "terrain_path_ground", "object_footprints",
            "object_tree", "object_rock", "object_vegetation",
        ],
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 full-rollout supervision source changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "checkpointFormatChanged": False,
        "datasetSplitChanged": False,
        "oldModesPreserved": True,
    }:
        raise ValueError("Stage 4 full-rollout compatibility changed")
    active = training.get("trainingAuthorizationStatus") in {
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_single_sample_gpu_smoke",
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage0_full_training",
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage1_full_training",
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage2_full_training",
    }
    expected_true = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
    }
    if active and "single_sample_gpu_smoke" in training.get("trainingAuthorizationStatus", ""):
        expected_true.add("smokeNow")
    if active and training.get("trainingAuthorizationStatus") in {
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage0_full_training",
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage1_full_training",
        "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage2_full_training",
    }:
        expected_true.add("stage4FullTrainingNow")
    gate = contract.get("activationGate", {})
    if set(gate) != {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
    }:
        raise ValueError("Stage 4 full-rollout activation gate fields changed")
    if active:
        if contract.get("status") != "training_loss_active_owner_authorized":
            raise ValueError("Stage 4 full-rollout active status is invalid")
        if any(gate.get(key) is not True for key in expected_true):
            raise ValueError("Stage 4 full-rollout required active gate is closed")
        if any(gate.get(key) is not False for key in set(gate) - expected_true):
            raise ValueError("Stage 4 full-rollout forbidden active gate is open")
    elif contract.get("status") != "cpu_support_verified_inactive" or any(gate.values()):
        raise ValueError("Stage 4 full-rollout inactive gate is not closed")
    return contract


def validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
    config,
):
    """Validate the bounded per-class obligation on the final 50-step decoded RGB."""
    training = config.get("training", {})
    contract = training.get(
        "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
    )
    if not contract:
        return None
    if set(contract) != {
        "enabled", "status", "contractId", "sourceContract", "requiredClasses",
        "rolloutBinding", "aggregation", "legalSupervision",
        "checkpointQualification", "compatibility", "evidenceBindings",
        "activationGate",
    }:
        raise ValueError("Stage 4 full-rollout per-class luminance fields changed")
    multiscale = validate_stage4_object_reference_multiscale_luminance_structure_supervision(
        config
    )
    rollout = validate_stage4_full_rollout_final_visible_consistency(config)
    expected_classes = list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        or contract.get("sourceContract") != {
            "contractId": STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID,
            "function": "stage4_object_reference_multiscale_luminance_structure_supervision_losses",
            "pyramidScales": list(STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES),
            "derivedWeights": multiscale["derivedWeights"],
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("requiredClasses") != expected_classes
        or contract.get("rolloutBinding") != {
            "parentContractId": "stage4_full_rollout_final_visible_consistency_v1",
            "decodedRgbSource": "same_50_step_final_decoded_rgb_before_detach",
            "rolloutSteps": int(config.get("inferenceSteps", 0)),
            "gradientTailSteps": int(rollout["gradientTailSteps"]),
            "entersTotalLoss": True,
        }
        or contract.get("aggregation") != {
            "perClass": "reuse_native_half_quarter_and_cross_scale_structure_consistency",
            "crossClass": "sum_existing_derived_weighted_object_obligations",
            "rolloutWeight": float(rollout["weight"]),
            "rolloutWeightSource": "training.stage4FullRolloutFinalVisibleConsistency.weight",
            "freeNumericalWeightSelectionAllowed": False,
        }
    ):
        raise ValueError("Stage 4 full-rollout per-class luminance identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": expected_classes,
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 full-rollout per-class legal supervision changed")
    if contract.get("checkpointQualification") != {
        "metric": "validationCheckpointSelectionScore",
        "source": "same_final_rollout_per_class_weighted_luminance_structure_obligation",
        "sameDerivedClassWeightsRequired": True,
        "sameRolloutWeightRequired": True,
    }:
        raise ValueError("Stage 4 full-rollout per-class checkpoint qualification changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "lossWeightsChanged": False,
        "datasetOrSplitChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 full-rollout per-class compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
    ):
        raise ValueError("Stage 4 full-rollout per-class evidence identity changed")
    gate = contract.get("activationGate", {})
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError("Stage 4 full-rollout per-class active mode is invalid")
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 full-rollout per-class status changed")
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 full-rollout per-class activation gate changed")
    return contract


def stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
):
    """Reuse the existing typed multiscale terms on the final rollout RGB."""
    contract = (
        validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            config
        )
    )
    if contract is None:
        return None
    source = stage4_object_reference_multiscale_luminance_structure_supervision_losses(
        predicted_rgb, target_rgb, conditions, config,
    )
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation")
    per_class = {}
    metrics = {}
    for identity, prefix in zip(
        FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:], prefixes,
    ):
        value = source["objectTotalTensors"][identity]
        per_class[identity] = value
        metrics[
            f"stage4FullRollout{prefix}FinalVisibleMultiscaleLuminanceStructureLoss"
        ] = value
    return {
        "status": contract["status"],
        "perClassLossTensors": per_class,
        "weightedTotalTensor": source["weightedTotalTensor"],
        "metrics": metrics,
        "sourceChannels": list(contract["requiredClasses"]),
        "derivedWeights": dict(contract["sourceContract"]["derivedWeights"]),
    }


def validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
    config,
):
    """Validate the source-derived worst sample-class final-visible obligation."""
    training = config.get("training", {})
    contract = training.get(
        "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
    )
    if not contract:
        return None
    if set(contract) != {
        "enabled", "status", "contractId", "sourceContract", "requiredClasses",
        "rolloutBinding", "aggregation", "legalSupervision",
        "checkpointQualification", "routeWestBoundaryNonRegression",
        "compatibility", "evidenceBindings", "activationGate",
    }:
        raise ValueError("Stage 4 worst sample-class luminance fields changed")
    source = (
        validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            config
        )
    )
    rollout = validate_stage4_full_rollout_final_visible_consistency(config)
    required_classes = list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    expected_source = {
        "contractId": STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID,
        "function": "stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses",
        "perClassFunction": "stage4_object_reference_multiscale_luminance_structure_supervision_losses",
        "derivedWeights": dict(source["sourceContract"]["derivedWeights"]),
        "freeNumericalWeightSelectionAllowed": False,
    }
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
        or contract.get("sourceContract") != expected_source
        or contract.get("requiredClasses") != required_classes
        or contract.get("rolloutBinding") != {
            "parentContractId": "stage4_full_rollout_final_visible_consistency_v1",
            "decodedRgbSource": "same_50_step_final_decoded_rgb_before_detach",
            "rolloutSteps": int(config.get("inferenceSteps", 0)),
            "gradientTailSteps": int(rollout["gradientTailSteps"]),
            "entersExistingFullRolloutLossSlot": True,
            "replacesCrossClassSumInThatSlot": True,
        }
        or contract.get("aggregation") != {
            "perSample": "retain_each_batch_sample_before_aggregation",
            "perClass": "reuse_native_half_quarter_and_cross_scale_structure_consistency",
            "classWeighting": "multiply_each_sample_class_by_existing_derived_class_weight",
            "selection": "maximum_over_sample_and_class",
            "rolloutWeight": float(rollout["weight"]),
            "rolloutWeightSource": "training.stage4FullRolloutFinalVisibleConsistency.weight",
            "freeNumericalWeightSelectionAllowed": False,
        }
    ):
        raise ValueError("Stage 4 worst sample-class luminance identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": required_classes,
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 worst sample-class legal supervision changed")
    if contract.get("checkpointQualification") != {
        "metric": "validationCheckpointSelectionScore",
        "source": "maximum_existing_derived_weighted_validation_sample_class_luminance_obligation",
        "scope": "all_validation_samples_all_rollout_seeds_all_required_classes",
        "sameDerivedClassWeightsRequired": True,
        "sameRolloutWeightRequired": True,
        "replacesAveragedCrossClassSum": True,
    }:
        raise ValueError("Stage 4 worst sample-class checkpoint qualification changed")
    required_sides = list(
        training.get("authorizedBoundaryTopology", {}).get("requiredBoundarySides", [])
    )
    if contract.get("routeWestBoundaryNonRegression") != {
        "sourceMetric": "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
        "requiredBoundarySidesSource": "training.authorizedBoundaryTopology.requiredBoundarySides",
        "requiredBoundarySides": required_sides,
        "requiredSide": "west",
        "candidateRule": "candidate_value_must_be_greater_than_or_equal_to_selected_checkpoint_value",
        "freeThresholdSelected": False,
    } or required_sides != ["west"]:
        raise ValueError("Stage 4 route west-boundary non-regression contract changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "lossWeightsChanged": False,
        "datasetOrSplitChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 worst sample-class compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_EVIDENCE_BINDINGS
    ):
        raise ValueError("Stage 4 worst sample-class evidence identity changed")
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError("Stage 4 worst sample-class active mode is invalid")
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 worst sample-class status changed")
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 worst sample-class activation gate changed")
    return contract


def stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
):
    """Retain each sample/class source obligation and select its weighted maximum."""
    contract = validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        config
    )
    if contract is None:
        return None
    if not (
        predicted_rgb.shape[0] == target_rgb.shape[0] == conditions.shape[0]
    ) or predicted_rgb.shape[0] < 1:
        raise ValueError("Stage 4 worst sample-class batch identity changed")
    identities = FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    derived_weights = contract["sourceContract"]["derivedWeights"]
    per_sample_class = []
    for sample_index in range(predicted_rgb.shape[0]):
        source = stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses(
            predicted_rgb[sample_index:sample_index + 1],
            target_rgb[sample_index:sample_index + 1],
            conditions[sample_index:sample_index + 1],
            config,
        )
        per_sample_class.append(torch.stack([
            source["perClassLossTensors"][identity] * float(derived_weights[identity])
            for identity in identities
        ]))
    matrix = torch.stack(per_sample_class)
    worst = matrix.reshape(-1).amax()
    return {
        "status": contract["status"],
        "weightedPerSampleClassTensors": matrix,
        "worstWeightedSampleClassTensor": worst,
        "sampleCount": predicted_rgb.shape[0],
        "classIdentityOrder": list(identities),
        "derivedWeights": dict(derived_weights),
    }


def validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
    config,
):
    """Validate the source-derived per-class worst-sample luminance contract."""
    training = config.get("training", {})
    contract = training.get(
        "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation", {}
    )
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "sourceContracts", "selection",
        "totalLoss", "checkpointQualification", "legalSupervision",
        "compatibility", "evidenceBindings", "ownerImplementationAuthorization",
        "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError(
            "Stage 4 per-class worst-sample luminance fields changed"
        )
    per_class = (
        validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            config
        )
    )
    global_worst = (
        validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            config
        )
    )
    rollout = validate_stage4_full_rollout_final_visible_consistency(config)
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    derived_weights = dict(per_class["sourceContract"]["derivedWeights"])
    rollout_weight = float(rollout["weight"])
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        or contract.get("sourceContracts") != {
            "perClassLuminanceStructureContractId": (
                STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
            ),
            "globalWorstSampleClassContractId": (
                STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
            ),
            "weightedPerSampleClassTensorSource": (
                "stage4_full_rollout_worst_sample_class_reference_luminance_"
                "obligation_losses.weightedPerSampleClassTensors"
            ),
            "derivedClassWeights": derived_weights,
            "classWeightSource": (
                "training.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation."
                "sourceContract.derivedWeights"
            ),
            "rolloutWeight": rollout_weight,
            "rolloutWeightSource": (
                "training.stage4FullRolloutFinalVisibleConsistency.weight"
            ),
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("selection") != {
            "trainingPopulation": "all_48_train_split_records",
            "checkpointPopulation": "all_8_validation_split_records",
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": identities,
            "perClassRule": "maximum_over_samples_within_each_bound_object_class",
            "tieBreak": "lexicographic_sample_id_within_class",
            "globalCrossClassMaximumAllowed": False,
            "validationSamplesUsedForWeightUpdates": False,
            "challengeOrRegressionUsedForWeightUpdates": False,
        }
        or contract.get("totalLoss") != {
            "aggregation": "sum_four_already_derived_weighted_per_class_maxima",
            "entersExistingFullRolloutLossSlot": True,
            "replacesGlobalSampleClassMaximumInThatSlot": True,
            "additionalLossWeight": False,
            "additionalOptimizerSteps": 0,
            "freeNumericWeightSelected": False,
        }
        or contract.get("checkpointQualification") != {
            "metric": "validationCheckpointSelectionScore",
            "perClassRule": "maximum_over_validation_trajectories_within_each_class",
            "aggregation": "sum_four_already_derived_weighted_per_class_maxima",
            "sameRolloutWeightRequired": True,
            "entersQualificationScore": True,
            "replacesGlobalSampleClassMaximum": True,
        }
    ):
        raise ValueError(
            "Stage 4 per-class worst-sample luminance identity changed"
        )
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError(
            "Stage 4 per-class worst-sample luminance supervision changed"
        )
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "optimizerStepBudgetChanged": False,
        "datasetOrSplitChanged": False,
        "conditionChannelOrderChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError(
            "Stage 4 per-class worst-sample luminance compatibility changed"
        )
    if (
        global_worst is None
        or contract.get("evidenceBindings")
        != STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError(
            "Stage 4 per-class worst-sample luminance lineage changed"
        )
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        active_modes = {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }
        if mode not in active_modes:
            raise ValueError(
                "Stage 4 per-class worst-sample luminance active mode is invalid"
            )
        if (
            per_class.get("status") != "training_loss_active_owner_authorized"
            or global_worst.get("status") != "training_loss_active_owner_authorized"
        ):
            raise ValueError(
                "Stage 4 per-class worst-sample luminance active source is invalid"
            )
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        if mode == "fact_conditioned_semantic_mixture_stage4_smoke":
            active_fields.add("smokeNow")
        else:
            active_fields.add("stage4FullTrainingNow")
    else:
        raise ValueError(
            "Stage 4 per-class worst-sample luminance status changed"
        )
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError(
            "Stage 4 per-class worst-sample luminance activation changed"
        )
    return contract


def stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(
    weighted_per_sample_class_tensor,
    sample_ids,
    config,
):
    """Select one differentiable luminance obligation per object class."""
    contract = (
        validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            config
        )
    )
    if contract is None:
        return None
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        not isinstance(weighted_per_sample_class_tensor, torch.Tensor)
        or weighted_per_sample_class_tensor.ndim != 2
        or weighted_per_sample_class_tensor.shape[0] < 1
        or weighted_per_sample_class_tensor.shape[1] != len(identities)
        or not torch.isfinite(weighted_per_sample_class_tensor).all()
    ):
        raise ValueError(
            "Stage 4 per-class worst-sample luminance tensor identity changed"
        )
    sample_ids = [str(value) for value in sample_ids]
    if (
        len(sample_ids) != weighted_per_sample_class_tensor.shape[0]
        or len(set(sample_ids)) != len(sample_ids)
    ):
        raise ValueError(
            "Stage 4 per-class worst-sample luminance sample identity changed"
        )
    per_class_worst = {}
    selections = []
    for class_index, identity in enumerate(identities):
        selected = None
        for sample_index, sample_id in enumerate(sample_ids):
            value = weighted_per_sample_class_tensor[sample_index, class_index]
            score = float(value.detach())
            key = (-score, sample_id)
            if selected is None or key < selected["selectionKey"]:
                selected = {
                    "selectionKey": key,
                    "sampleIndex": sample_index,
                    "sampleId": sample_id,
                    "classIndex": class_index + 1,
                    "classIdentity": identity,
                    "score": score,
                    "tensor": value,
                }
        per_class_worst[identity] = selected["tensor"]
        selections.append({
            key: value for key, value in selected.items()
            if key not in {"selectionKey", "tensor"}
        })
    weighted_total = sum(per_class_worst.values())
    rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])
    return {
        "status": contract["status"],
        "perClassWorstTensors": per_class_worst,
        "perClassSelections": selections,
        "weightedTotalTensor": weighted_total,
        "checkpointQualificationTensor": weighted_total * rollout_weight,
        "derivedClassWeights": dict(
            contract["sourceContracts"]["derivedClassWeights"]
        ),
        "rolloutWeight": rollout_weight,
    }


def validate_stage4_epoch_complete_per_class_worst_luminance_selection(config):
    """Validate the epoch-complete selector and Checkpoint identity contract."""
    training = config.get("training", {})
    contract = training.get(
        "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
        {},
    )
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "sourceContracts",
        "trainingSelection", "checkpointQualification", "legalSupervision",
        "compatibility", "evidenceBindings", "ownerImplementationAuthorization",
        "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 epoch-complete selector fields changed")
    source = (
        validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            config
        )
    )
    replay = validate_stage4_epoch_worst_sample_class_replay(config)
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if source is None or replay is None:
        raise ValueError("Stage 4 epoch-complete selector source is missing")
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        or contract.get("sourceContracts") != {
            "perClassWorstSampleContractId": (
                STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
            ),
            "weightedPerSampleClassTensorSource": (
                "stage4_full_rollout_worst_sample_class_reference_luminance_"
                "obligation_losses.weightedPerSampleClassTensors"
            ),
            "derivedClassWeights": dict(
                source["sourceContracts"]["derivedClassWeights"]
            ),
            "rolloutWeight": float(source["sourceContracts"]["rolloutWeight"]),
            "replayPassesPerObservedPrimaryBatch": int(
                replay["replay"]["passesPerObservedPrimaryBatch"]
            ),
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("trainingSelection") != {
            "population": "all_48_train_split_records_in_one_completed_epoch",
            "classIdentities": identities,
            "scoreCollection": "detach_score_and_identity_only_during_current_epoch",
            "selection": "one_maximum_per_class_with_lexicographic_sample_id_tie_break",
            "differentiableApplication": (
                "recompute_selected_sample_class_from_same_approved_sources_in_existing_epoch_replay_budget"
            ),
            "classSchedule": (
                "round_robin_formal_class_order_across_existing_two_replay_passes"
            ),
            "firstEpochBehavior": (
                "collect_identity_only_keep_existing_non_selected_primary_supervision"
            ),
            "replacesBatchLocalMaximum": True,
            "additionalLossWeight": False,
            "additionalOptimizerSteps": 0,
        }
        or contract.get("checkpointQualification") != {
            "population": "all_8_validation_records_all_existing_rollout_seeds",
            "selection": (
                "one_maximum_per_class_with_sample_id_then_seed_index_tie_break"
            ),
            "requiredPersistedFields": [
                "classIdentity", "sampleId", "seedIndex", "rawScore",
                "weightedScore",
            ],
            "aggregation": (
                "sum_four_existing_derived_weighted_class_maxima_times_existing_rollout_weight"
            ),
            "mustEqualReportedCheckpointObligation": True,
            "metric": "validationCheckpointSelectionScore",
            "entersQualificationScore": True,
        }
    ):
        raise ValueError("Stage 4 epoch-complete selector identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "rollout": "existing_50_step_final_decoded_rgb",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 epoch-complete selector supervision changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "batchSizeChanged": False,
        "optimizerStepBudgetChanged": False,
        "datasetOrSplitChanged": False,
        "conditionChannelOrderChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 epoch-complete selector compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 epoch-complete selector lineage changed")
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError("Stage 4 epoch-complete selector active mode is invalid")
        if source.get("status") != "training_loss_active_owner_authorized":
            raise ValueError("Stage 4 epoch-complete selector active source is invalid")
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 epoch-complete selector status changed")
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 epoch-complete selector activation changed")
    return contract


def validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
    config,
):
    """Validate the full-Epoch reference-feature selector and shared replay contract."""
    training = config.get("training", {})
    contract = training.get(
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
        {},
    )
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "sourceContracts",
        "epochSelection", "sharedReplay", "checkpointQualification",
        "legalSupervision", "compatibility", "evidenceBindings",
        "ownerImplementationAuthorization", "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 reference-feature shared replay fields changed")
    reference_source = (
        validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    )
    luminance_source = (
        validate_stage4_epoch_complete_per_class_worst_luminance_selection(config)
    )
    if reference_source is None or luminance_source is None:
        raise ValueError("Stage 4 reference-feature shared replay source is missing")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    expected_source = {
        "referenceFeatureContractId": (
            STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        ),
        "luminanceSelectionContractId": (
            STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        ),
        "perSampleClassTensorSource": (
            "stage4_per_class_final_visible_reference_feature_structure_"
            "obligation_losses.perSampleClassTensors"
        ),
        "derivedClassWeights": dict(
            reference_source["sourceContracts"]["derivedClassWeights"]
        ),
        "rolloutWeight": float(
            reference_source["sourceContracts"]["rolloutWeight"]
        ),
        "replayPassesPerObservedPrimaryBatch": int(
            luminance_source["sourceContracts"]
            ["replayPassesPerObservedPrimaryBatch"]
        ),
        "freeNumericalWeightSelectionAllowed": False,
    }
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID
        or contract.get("sourceContracts") != expected_source
        or contract.get("epochSelection") != {
            "population": "all_48_train_records_in_one_completed_epoch",
            "classIdentities": identities,
            "scoreCollection": "detach_score_and_identity_only",
            "selection": "one_maximum_per_class_with_lexicographic_sample_id_tie_break",
            "firstEpochBehavior": "collect_identity_only_keep_existing_supervision",
        }
        or contract.get("sharedReplay") != {
            "optimizerStepBudget": "reuse_existing_two_replay_passes_per_primary_batch",
            "objectiveOrder": ["luminance", "reference_feature_structure"],
            "classOrder": identities,
            "schedule": "deterministic_class_major_objective_minor_round_robin",
            "addsOptimizerSteps": False,
            "addsReplayPasses": False,
            "existingCompleteEpochLuminanceReplayPreserved": True,
        }
        or contract.get("checkpointQualification") != {
            "population": "all_8_validation_records_all_existing_rollout_seeds",
            "selection": "one_maximum_per_class_with_sample_id_then_seed_index_tie_break",
            "requiredIdentityFields": [
                "classIdentity", "sampleId", "seedIndex", "rawScore",
                "weightedScore",
            ],
            "aggregation": "existing_derived_class_weights_and_rollout_weight",
            "metric": "validationCheckpointSelectionScore",
            "entersQualificationScore": True,
        }
    ):
        raise ValueError("Stage 4 reference-feature shared replay identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "featureSource": "existing_frozen_project_autoencoder_unique_spatial_stages",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 reference-feature shared replay supervision changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "optimizerStepBudgetChanged": False,
        "datasetOrSplitChanged": False,
        "conditionChannelOrderChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 reference-feature shared replay compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 reference-feature shared replay lineage changed")
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError(
                "Stage 4 reference-feature shared replay active mode is invalid"
            )
        if (
            reference_source.get("status")
            != "training_loss_active_owner_authorized"
            or luminance_source.get("status")
            != "training_loss_active_owner_authorized"
        ):
            raise ValueError(
                "Stage 4 reference-feature shared replay active source is invalid"
            )
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 reference-feature shared replay status changed")
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 reference-feature shared replay activation changed")
    return contract


def _stage4_epoch_complete_selection_contract(config, objective_identity):
    if objective_identity == "luminance":
        return validate_stage4_epoch_complete_per_class_worst_luminance_selection(
            config
        )
    if objective_identity == "reference_feature_structure":
        return validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    raise ValueError("Stage 4 epoch-complete selector objective changed")


def stage4_epoch_complete_per_class_selection_ledger(
    config, population, expected_identity_count, objective_identity="luminance",
):
    """Create a score/identity-only ledger; tensors and sample pixels are never stored."""
    contract = _stage4_epoch_complete_selection_contract(config, objective_identity)
    if contract is None:
        return None
    if population not in {"train", "validation"}:
        raise ValueError("Stage 4 epoch-complete selector population changed")
    expected = 48 if population == "train" else int(expected_identity_count)
    if (
        int(expected_identity_count) != expected
        or (population == "validation" and expected < 8)
    ):
        raise ValueError("Stage 4 epoch-complete selector population size changed")
    return {
        "objectiveIdentity": objective_identity,
        "population": population,
        "expectedIdentityCount": expected,
        "classIdentities": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]),
        "entries": {},
        "finalized": False,
    }


def stage4_collect_epoch_complete_per_class_selection_scores(
    ledger, weighted_per_sample_class_tensor, sample_ids, config, seed_indices=None,
    objective_identity="luminance",
):
    """Collect detached scores and identities without retaining a computation graph."""
    contract = _stage4_epoch_complete_selection_contract(config, objective_identity)
    if (
        contract is None or not isinstance(ledger, dict) or ledger.get("finalized")
        or ledger.get("objectiveIdentity") != objective_identity
    ):
        raise ValueError("Stage 4 epoch-complete selector ledger is unavailable")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        ledger.get("classIdentities") != identities
        or not isinstance(weighted_per_sample_class_tensor, torch.Tensor)
        or weighted_per_sample_class_tensor.ndim != 2
        or weighted_per_sample_class_tensor.shape[1] != len(identities)
        or not bool(torch.isfinite(weighted_per_sample_class_tensor).all())
    ):
        raise ValueError("Stage 4 epoch-complete selector tensor changed")
    sample_ids = [str(value) for value in sample_ids]
    if len(sample_ids) != weighted_per_sample_class_tensor.shape[0]:
        raise ValueError("Stage 4 epoch-complete selector sample identity changed")
    if seed_indices is None:
        seed_indices = [None] * len(sample_ids)
    if len(seed_indices) != len(sample_ids):
        raise ValueError("Stage 4 epoch-complete selector seed identity changed")
    if ledger["population"] == "train" and any(
        value is not None for value in seed_indices
    ):
        raise ValueError("Stage 4 training selector cannot carry validation seeds")
    weights = contract["sourceContracts"]["derivedClassWeights"]
    for sample_index, (sample_id, seed_index) in enumerate(
        zip(sample_ids, seed_indices)
    ):
        if not sample_id:
            raise ValueError("Stage 4 epoch-complete selector sampleId is empty")
        if ledger["population"] == "validation":
            if not isinstance(seed_index, int) or seed_index < 0:
                raise ValueError("Stage 4 validation selector seedIndex changed")
            entry_key = f"{sample_id}\u0000{seed_index}"
        else:
            entry_key = sample_id
        if entry_key in ledger["entries"]:
            raise ValueError("Stage 4 epoch-complete selector duplicate identity")
        scores = {}
        for class_index, identity in enumerate(identities):
            weighted_score = float(
                weighted_per_sample_class_tensor[sample_index, class_index].detach()
            )
            class_weight = float(weights[identity])
            if not math.isfinite(class_weight) or class_weight <= 0.0:
                raise ValueError("Stage 4 epoch-complete selector class weight changed")
            raw_score = weighted_score / class_weight
            if not math.isfinite(raw_score):
                raise ValueError("Stage 4 epoch-complete selector score changed")
            scores[identity] = {
                "rawScore": raw_score,
                "weightedScore": weighted_score,
            }
        ledger["entries"][entry_key] = {
            "sampleId": sample_id,
            "seedIndex": seed_index,
            "scores": scores,
        }
    if len(ledger["entries"]) > int(ledger["expectedIdentityCount"]):
        raise ValueError("Stage 4 epoch-complete selector population overflow")
    return ledger


def stage4_finalize_epoch_complete_per_class_selection(
    ledger, config, objective_identity="luminance",
):
    """Finalize exactly one deterministic maximum for every formal object class."""
    contract = _stage4_epoch_complete_selection_contract(config, objective_identity)
    if (
        contract is None or not isinstance(ledger, dict) or ledger.get("finalized")
        or ledger.get("objectiveIdentity") != objective_identity
    ):
        raise ValueError("Stage 4 epoch-complete selector cannot finalize")
    if len(ledger.get("entries", {})) != int(ledger.get("expectedIdentityCount", -1)):
        raise ValueError("Stage 4 epoch-complete selector population is incomplete")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    selections = []
    for identity in identities:
        selected = None
        for entry in ledger["entries"].values():
            scores = entry["scores"][identity]
            seed_tie = -1 if entry["seedIndex"] is None else int(entry["seedIndex"])
            key = (-float(scores["weightedScore"]), entry["sampleId"], seed_tie)
            if selected is None or key < selected["selectionKey"]:
                selected = {
                    "selectionKey": key,
                    "classIdentity": identity,
                    "sampleId": entry["sampleId"],
                    "seedIndex": entry["seedIndex"],
                    "rawScore": float(scores["rawScore"]),
                    "weightedScore": float(scores["weightedScore"]),
                }
        selections.append({
            key: value for key, value in selected.items() if key != "selectionKey"
        })
    result = {
        "objectiveIdentity": objective_identity,
        "population": ledger["population"],
        "identityCount": len(ledger["entries"]),
        "perClassSelections": selections,
        "weightedScoreSum": sum(row["weightedScore"] for row in selections),
        "rolloutWeight": float(contract["sourceContracts"]["rolloutWeight"]),
    }
    result["checkpointQualificationScore"] = (
        result["weightedScoreSum"] * result["rolloutWeight"]
    )
    ledger["finalized"] = True
    ledger["result"] = result
    return result


def stage4_epoch_complete_per_class_replay_selection(
    prior_epoch_result, batch_index, replay_index, config,
):
    """Map the existing two replay lanes onto the formal class order."""
    contract = validate_stage4_epoch_complete_per_class_worst_luminance_selection(
        config
    )
    if contract is None or prior_epoch_result is None:
        return None
    passes = int(
        contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"]
    )
    if replay_index < 0 or replay_index >= passes or batch_index < 0:
        raise ValueError("Stage 4 epoch-complete replay schedule changed")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    rows = prior_epoch_result.get("perClassSelections", [])
    if [row.get("classIdentity") for row in rows] != identities:
        raise ValueError("Stage 4 epoch-complete replay identity order changed")
    class_index = (int(batch_index) * passes + int(replay_index)) % len(identities)
    return {**rows[class_index], "classIndex": class_index + 1}


def stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
    weighted_per_sample_class_tensor, selected_identity, config,
):
    """Recompute one selected sample/class loss in the existing replay step."""
    contract = validate_stage4_epoch_complete_per_class_worst_luminance_selection(
        config
    )
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        contract is None
        or not isinstance(weighted_per_sample_class_tensor, torch.Tensor)
        or tuple(weighted_per_sample_class_tensor.shape) != (1, len(identities))
        or selected_identity not in identities
        or not bool(torch.isfinite(weighted_per_sample_class_tensor).all())
    ):
        raise ValueError("Stage 4 epoch-complete replay tensor identity changed")
    value = weighted_per_sample_class_tensor[0, identities.index(selected_identity)]
    return value * float(contract["sourceContracts"]["rolloutWeight"])


def stage4_epoch_complete_shared_replay_selection(
    prior_luminance_result,
    prior_reference_feature_result,
    batch_index,
    replay_index,
    config,
):
    """Use the existing two replay lanes for both full-Epoch objectives."""
    contract = (
        validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    )
    if contract is None:
        return None
    passes = int(contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"])
    if batch_index < 0 or replay_index < 0 or replay_index >= passes:
        raise ValueError("Stage 4 shared replay schedule changed")
    objectives = list(contract["sharedReplay"]["objectiveOrder"])
    identities = list(contract["sharedReplay"]["classOrder"])
    cycle = [(identity, objective) for identity in identities for objective in objectives]
    class_identity, objective_identity = cycle[
        (int(batch_index) * passes + int(replay_index)) % len(cycle)
    ]
    source = (
        prior_luminance_result
        if objective_identity == "luminance"
        else prior_reference_feature_result
    )
    if not isinstance(source, dict):
        raise ValueError("Stage 4 shared replay prior-Epoch identity is missing")
    expected_objective = (
        "luminance"
        if objective_identity == "luminance"
        else "reference_feature_structure"
    )
    if source.get("objectiveIdentity", "luminance") != expected_objective:
        raise ValueError("Stage 4 shared replay objective identity changed")
    rows = source.get("perClassSelections", [])
    if [row.get("classIdentity") for row in rows] != identities:
        raise ValueError("Stage 4 shared replay class identity order changed")
    selected = rows[identities.index(class_identity)]
    return {
        **selected,
        "classIndex": identities.index(class_identity) + 1,
        "objectiveIdentity": objective_identity,
    }


def stage4_epoch_complete_shared_replay_selection_for_epoch(
    prior_luminance_result,
    prior_reference_feature_result,
    prior_epoch_number,
    epoch_index,
    batch_index,
    replay_index,
    config,
):
    """Start shared replay only after one complete Epoch produced both identities."""
    contract = (
        validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    )
    if contract is None:
        return None
    epoch_index = int(epoch_index)
    if epoch_index < 0:
        raise ValueError("Stage 4 shared replay Epoch identity changed")
    if epoch_index == 0:
        if (
            prior_luminance_result is not None
            or prior_reference_feature_result is not None
            or prior_epoch_number is not None
        ):
            raise ValueError(
                "Stage 4 shared replay carried prior-Epoch identity into Epoch 1"
            )
        return None
    if (
        int(prior_epoch_number or -1) != epoch_index
        or not isinstance(prior_luminance_result, dict)
        or not isinstance(prior_reference_feature_result, dict)
    ):
        raise ValueError(
            "Stage 4 shared replay complete prior-Epoch lifecycle identity is missing"
        )
    return stage4_epoch_complete_shared_replay_selection(
        prior_luminance_result,
        prior_reference_feature_result,
        batch_index,
        replay_index,
        config,
    )


def stage4_epoch_complete_selected_reference_feature_replay_loss_from_tensor(
    per_sample_class_tensor, selected_identity, config,
):
    """Recompute one selected reference-feature loss inside an existing replay lane."""
    contract = (
        validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(
            config
        )
    )
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        contract is None
        or not isinstance(per_sample_class_tensor, torch.Tensor)
        or tuple(per_sample_class_tensor.shape) != (1, len(identities))
        or selected_identity not in identities
        or not bool(torch.isfinite(per_sample_class_tensor).all())
    ):
        raise ValueError("Stage 4 selected reference-feature replay tensor changed")
    source = contract["sourceContracts"]
    class_weight = float(source["derivedClassWeights"][selected_identity])
    rollout_weight = float(source["rolloutWeight"])
    value = per_sample_class_tensor[0, identities.index(selected_identity)]
    return value * class_weight * rollout_weight


def validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
    config,
):
    """Validate the inactive per-class final-visible frozen-reference feature contract."""
    training = config.get("training", {})
    contract = training.get(
        "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
    )
    if not contract:
        return None
    expected_fields = {
        "enabled", "status", "contractId", "sourceContract", "requiredClasses",
        "featureExtraction", "rolloutBinding", "aggregation", "legalSupervision",
        "checkpointQualification", "compatibility", "evidenceBindings",
        "activationGate",
    }
    if set(contract) != expected_fields:
        raise ValueError("Stage 4 reference-feature obligation fields changed")
    source = validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        config
    )
    rollout = validate_stage4_full_rollout_final_visible_consistency(config)
    expected_classes = list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        or contract.get("sourceContract") != {
            "contractId": (
                STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
            ),
            "derivedClassWeights": source["sourceContract"]["derivedWeights"],
            "classWeightSource": (
                "training.stage4FullRolloutWorstSampleClassReferenceLuminanceObligation."
                "sourceContract.derivedWeights"
            ),
            "rolloutWeight": float(rollout["weight"]),
            "rolloutWeightSource": "training.stage4FullRolloutFinalVisibleConsistency.weight",
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("requiredClasses") != expected_classes
        or contract.get("featureExtraction") != {
            "autoencoderSource": "frozen_project_autoencoder",
            "encoderPath": "existing_project_autoencoder_encoder_sequential",
            "spatialStageSelection": (
                "ordered_unique_spatial_shapes_after_each_existing_encoder_module"
            ),
            "stageAggregation": "arithmetic_mean_over_all_unique_existing_spatial_stages",
            "predictionInput": (
                "final_decoded_rgb_inside_bound_class_mask_reference_rgb_outside_mask"
            ),
            "targetInput": "original_owner_approved_reference_rgb",
            "targetFeaturesDetached": True,
            "autoencoderParametersFrozen": True,
            "freeFeatureScaleOrWeightSelectionAllowed": False,
        }
        or contract.get("rolloutBinding") != {
            "parentContractId": "stage4_full_rollout_final_visible_consistency_v1",
            "decodedRgbSource": "same_50_step_final_decoded_rgb_before_detach",
            "rolloutSteps": int(config.get("inferenceSteps", 0)),
            "gradientTailSteps": int(rollout["gradientTailSteps"]),
            "entersExistingFullRolloutLossSlot": True,
        }
        or contract.get("aggregation") != {
            "perSample": "preserve_batch_samples_before_class_aggregation",
            "perClass": "one_independent_reference_feature_structure_obligation",
            "withinClassStages": (
                "arithmetic_mean_over_all_unique_existing_autoencoder_spatial_stages"
            ),
            "crossClass": "sum_existing_derived_weighted_object_obligations",
            "rolloutWeight": float(rollout["weight"]),
            "freeNumericalWeightSelectionAllowed": False,
        }
    ):
        raise ValueError("Stage 4 reference-feature obligation identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": expected_classes,
        "featureSource": "frozen_project_autoencoder_features",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
    }:
        raise ValueError("Stage 4 reference-feature legal supervision changed")
    if contract.get("checkpointQualification") != {
        "metric": "validationCheckpointSelectionScore",
        "source": "same_final_rollout_per_class_reference_feature_structure_obligation",
        "sameDerivedClassWeightsRequired": True,
        "sameRolloutWeightRequired": True,
        "entersQualificationScore": True,
    }:
        raise ValueError("Stage 4 reference-feature checkpoint qualification changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "datasetOrSplitChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 reference-feature compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_EVIDENCE_BINDINGS
    ):
        raise ValueError("Stage 4 reference-feature evidence identity changed")
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError("Stage 4 reference-feature active mode is invalid")
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 reference-feature status changed")
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 reference-feature activation gate changed")
    return contract


def validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
    config,
):
    """Validate reuse of the same per-sample/class feature tensor in selection and replay."""
    training = config.get("training", {})
    contract = training.get(
        "stage4EpochWorstSampleClassReferenceFeatureStructureReplay", {}
    )
    if not contract:
        return None
    if set(contract) != {
        "enabled", "status", "contractId", "sourceContracts", "selection",
        "replay", "legalSupervision", "compatibility", "evidenceBindings",
        "ownerImplementationAuthorization", "activationGate",
    }:
        raise ValueError("Stage 4 epoch-worst reference-feature replay fields changed")
    reference_feature = (
        validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
    )
    epoch_worst = validate_stage4_epoch_worst_sample_class_replay(config)
    if reference_feature is None or epoch_worst is None:
        raise ValueError("Stage 4 epoch-worst reference-feature replay source is missing")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    derived_weights = reference_feature["sourceContract"]["derivedClassWeights"]
    rollout_weight = float(reference_feature["sourceContract"]["rolloutWeight"])
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
        or contract.get("sourceContracts") != {
            "referenceFeatureStructureContractId": (
                STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            ),
            "epochWorstReplayContractId": STAGE4_EPOCH_WORST_SAMPLE_CLASS_REPLAY_ID,
            "perSampleClassTensorSource": (
                "stage4_per_class_final_visible_reference_feature_structure_"
                "obligation_losses.perSampleClassTensors"
            ),
            "derivedClassWeights": derived_weights,
            "classWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.derivedClassWeights"
            ),
            "rolloutWeight": rollout_weight,
            "rolloutWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.rolloutWeight"
            ),
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("selection") != {
            "population": (
                "observed_current_train_split_epoch_prefix_with_complete_epoch_"
                "finalization"
            ),
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": identities,
            "score": (
                "same_derived_weighted_per_sample_class_reference_feature_"
                "structure_tensor"
            ),
            "tieBreak": "lexicographic_sample_id_then_fixed_class_order",
        }
        or contract.get("replay") != {
            "passesPerObservedPrimaryBatch": int(
                epoch_worst["replay"]["passesPerObservedPrimaryBatch"]
            ),
            "passesSource": (
                "training.stage4EpochWorstSampleClassReplay.replay."
                "passesPerObservedPrimaryBatch"
            ),
            "addsReplayPasses": False,
            "addsOptimizerSteps": False,
            "loss": "same_selected_reference_feature_structure_sample_class_tensor",
            "recomputeFromSameBoundSampleAndClass": True,
            "freeNumericWeightSelected": False,
        }
    ):
        raise ValueError("Stage 4 epoch-worst reference-feature replay identity changed")
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "featureSource": "frozen_project_autoencoder_features",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
        "validationSamplesUsedAsTrainingTargets": False,
    }:
        raise ValueError("Stage 4 epoch-worst reference-feature replay supervision changed")
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "optimizerStepBudgetChanged": False,
        "datasetOrSplitChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError("Stage 4 epoch-worst reference-feature replay compatibility changed")
    if (
        contract.get("evidenceBindings")
        != STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError("Stage 4 epoch-worst reference-feature replay lineage changed")
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError("Stage 4 epoch-worst reference-feature replay active mode is invalid")
        if (
            reference_feature.get("status") != "training_loss_active_owner_authorized"
            or epoch_worst.get("status") != "training_loss_active_owner_authorized"
        ):
            raise ValueError("Stage 4 epoch-worst reference-feature active source is invalid")
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError("Stage 4 epoch-worst reference-feature replay status changed")
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError("Stage 4 epoch-worst reference-feature replay activation changed")
    return contract


def stage4_epoch_worst_reference_feature_weighted_per_sample_class_tensor(
    per_sample_class_tensor,
    config,
):
    contract = validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
        config
    )
    if contract is None:
        return None
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        not isinstance(per_sample_class_tensor, torch.Tensor)
        or per_sample_class_tensor.ndim != 2
        or per_sample_class_tensor.shape[0] < 1
        or per_sample_class_tensor.shape[1] != len(identities)
        or not torch.isfinite(per_sample_class_tensor).all()
    ):
        raise ValueError("Stage 4 epoch-worst reference-feature tensor identity changed")
    source = contract["sourceContracts"]
    weights = per_sample_class_tensor.new_tensor([
        float(source["derivedClassWeights"][identity])
        for identity in identities
    ]) * float(source["rolloutWeight"])
    return per_sample_class_tensor * weights.unsqueeze(0)


def stage4_epoch_worst_reference_feature_candidate(
    per_sample_class_tensor,
    sample_ids,
    config,
):
    weighted = stage4_epoch_worst_reference_feature_weighted_per_sample_class_tensor(
        per_sample_class_tensor, config
    )
    if weighted is None:
        return None
    if len(sample_ids) != weighted.shape[0] or len(set(map(str, sample_ids))) != len(sample_ids):
        raise ValueError("Stage 4 epoch-worst reference-feature sample identity changed")
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    selected = None
    for sample_index, sample_id in enumerate(map(str, sample_ids)):
        for object_class_index, identity in enumerate(identities):
            score = float(weighted[sample_index, object_class_index].detach())
            candidate_key = (-score, sample_id, identity)
            if selected is None or candidate_key < selected["selectionKey"]:
                selected = {
                    "selectionKey": candidate_key,
                    "score": score,
                    "sampleIndex": sample_index,
                    "classIndex": object_class_index + 1,
                    "classIdentity": identity,
                }
    return selected


def stage4_epoch_worst_reference_feature_replay_loss_from_tensor(
    per_sample_class_tensor,
    config,
    class_index,
):
    weighted = stage4_epoch_worst_reference_feature_weighted_per_sample_class_tensor(
        per_sample_class_tensor, config
    )
    if weighted is None:
        return None
    class_index = int(class_index)
    object_class_index = class_index - 1
    if weighted.shape[0] != 1 or object_class_index not in range(weighted.shape[1]):
        raise ValueError("Stage 4 epoch-worst reference-feature replay class changed")
    value = weighted[0, object_class_index]
    return {
        "stage4EpochWorstSampleClassReplayLossTensor": value,
        "stage4EpochWorstSampleClassReplayDirectWeightedLoss": value,
        "stage4EpochWorstSampleClassReplayJointFourObjectMultiscaleWeightedLoss": value.new_zeros(()),
        "stage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss": value,
        "stage4EpochWorstSampleClassReplayClassIndex": value.new_tensor(float(class_index)),
        "stage4EpochWorstSampleClassReplayLaneIndex": value.new_tensor(2.0),
    }


def validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
    config,
):
    """Validate one independent worst approved sample obligation per object class."""
    training = config.get("training", {})
    contract = training.get(
        "stage4PerClassWorstSampleReferenceFeatureStructureObligation", {}
    )
    if not contract:
        return None
    if set(contract) != {
        "enabled", "status", "contractId", "sourceContracts", "selection",
        "totalLoss", "checkpointQualification", "legalSupervision",
        "compatibility", "evidenceBindings", "ownerImplementationAuthorization",
        "activationGate",
    }:
        raise ValueError(
            "Stage 4 per-class worst reference-feature obligation fields changed"
        )
    reference_feature = (
        validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
    )
    reference_feature_replay = (
        validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
            config
        )
    )
    if reference_feature is None or reference_feature_replay is None:
        raise ValueError(
            "Stage 4 per-class worst reference-feature source contract is missing"
        )
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    derived_weights = reference_feature["sourceContract"]["derivedClassWeights"]
    rollout_weight = float(reference_feature["sourceContract"]["rolloutWeight"])
    if (
        contract.get("enabled") is not True
        or contract.get("contractId")
        != STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        or contract.get("sourceContracts") != {
            "referenceFeatureStructureContractId": (
                STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            ),
            "epochWorstReferenceFeatureReplayContractId": (
                STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
            ),
            "perSampleClassTensorSource": (
                "stage4_per_class_final_visible_reference_feature_structure_"
                "obligation_losses.perSampleClassTensors"
            ),
            "derivedClassWeights": derived_weights,
            "classWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.derivedClassWeights"
            ),
            "rolloutWeight": rollout_weight,
            "rolloutWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.rolloutWeight"
            ),
            "freeNumericalWeightSelectionAllowed": False,
        }
        or contract.get("selection") != {
            "population": "observed_current_train_split_samples",
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": identities,
            "perClassRule": "maximum_over_samples_within_each_bound_object_class",
            "tieBreak": "lexicographic_sample_id_within_class",
            "globalCrossClassMaximumAllowed": False,
        }
        or contract.get("totalLoss") != {
            "aggregation": (
                "sum_four_per_class_maxima_using_existing_derived_class_weights"
            ),
            "entersExistingFullRolloutLossSlot": True,
            "replacesCrossClassMeanInThatSlot": True,
            "additionalReplayPasses": 0,
            "additionalOptimizerSteps": 0,
            "freeNumericWeightSelected": False,
        }
        or contract.get("checkpointQualification") != {
            "metric": "validationCheckpointSelectionScore",
            "population": "all_validation_samples_all_existing_rollout_seeds",
            "perClassRule": "maximum_over_validation_trajectories_within_each_class",
            "aggregation": (
                "sum_four_per_class_maxima_using_same_derived_class_weights"
            ),
            "sameRolloutWeightRequired": True,
            "entersQualificationScore": True,
        }
    ):
        raise ValueError(
            "Stage 4 per-class worst reference-feature obligation identity changed"
        )
    if contract.get("legalSupervision") != {
        "reference": "original_owner_approved_reference_rgb",
        "conditionPack": "original_compiled_23_channel_condition_pack",
        "maskChannels": list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "featureSource": "frozen_project_autoencoder_features",
        "failedPreviewPixelsUsedAsTargets": False,
        "machineReviewThresholdsUsedAsTargets": False,
        "machineReviewResultsUsedAsTargets": False,
        "validationSamplesUsedAsTrainingTargets": False,
    }:
        raise ValueError(
            "Stage 4 per-class worst reference-feature supervision changed"
        )
    if contract.get("compatibility") != {
        "modelArchitectureChanged": False,
        "existingLossValuesOrWeightsChanged": False,
        "optimizerStepBudgetChanged": False,
        "datasetOrSplitChanged": False,
        "checkpointFormatChanged": False,
        "reviewThresholdsChanged": False,
        "oldModesWithoutContractPreserved": True,
    }:
        raise ValueError(
            "Stage 4 per-class worst reference-feature compatibility changed"
        )
    if (
        contract.get("evidenceBindings")
        != STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_EVIDENCE_BINDINGS
        or contract.get("ownerImplementationAuthorization")
        != STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
    ):
        raise ValueError(
            "Stage 4 per-class worst reference-feature lineage changed"
        )
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    if status == "cpu_support_verified_inactive":
        active_fields = set()
    elif status == "training_loss_active_owner_authorized":
        mode = resolve_stage_mode(config).mode_id
        if mode not in {
            "fact_conditioned_semantic_mixture_stage4_smoke",
            "fact_conditioned_semantic_mixture_stage0_full_training",
            "fact_conditioned_semantic_mixture_stage1_full_training",
            "fact_conditioned_semantic_mixture_stage2_full_training",
        }:
            raise ValueError(
                "Stage 4 per-class worst reference-feature active mode is invalid"
            )
        if (
            reference_feature.get("status") != "training_loss_active_owner_authorized"
            or reference_feature_replay.get("status")
            != "training_loss_active_owner_authorized"
        ):
            raise ValueError(
                "Stage 4 per-class worst reference-feature active source is invalid"
            )
        active_fields = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow",
        }
        active_fields.add(
            "smokeNow"
            if mode == "fact_conditioned_semantic_mixture_stage4_smoke"
            else "stage4FullTrainingNow"
        )
    else:
        raise ValueError(
            "Stage 4 per-class worst reference-feature status changed"
        )
    gate = contract.get("activationGate", {})
    if set(gate) != gate_fields or any(
        gate.get(name) is not (name in active_fields) for name in gate_fields
    ):
        raise ValueError(
            "Stage 4 per-class worst reference-feature activation changed"
        )
    return contract


def stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
    per_sample_class_tensor,
    sample_ids,
    config,
):
    """Select one differentiable worst sample independently for every object class."""
    contract = (
        validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    )
    if contract is None:
        return None
    identities = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    if (
        not isinstance(per_sample_class_tensor, torch.Tensor)
        or per_sample_class_tensor.ndim != 2
        or per_sample_class_tensor.shape[0] < 1
        or per_sample_class_tensor.shape[1] != len(identities)
        or not torch.isfinite(per_sample_class_tensor).all()
    ):
        raise ValueError(
            "Stage 4 per-class worst reference-feature tensor identity changed"
        )
    sample_ids = [str(value) for value in sample_ids]
    if (
        len(sample_ids) != per_sample_class_tensor.shape[0]
        or len(set(sample_ids)) != len(sample_ids)
    ):
        raise ValueError(
            "Stage 4 per-class worst reference-feature sample identity changed"
        )
    source = contract["sourceContracts"]
    per_class_worst = {}
    selections = []
    for class_index, identity in enumerate(identities):
        selected = None
        for sample_index, sample_id in enumerate(sample_ids):
            value = per_sample_class_tensor[sample_index, class_index]
            score = float(value.detach())
            key = (-score, sample_id)
            if selected is None or key < selected["selectionKey"]:
                selected = {
                    "selectionKey": key,
                    "sampleIndex": sample_index,
                    "sampleId": sample_id,
                    "classIndex": class_index + 1,
                    "classIdentity": identity,
                    "score": score,
                    "tensor": value,
                }
        per_class_worst[identity] = selected["tensor"]
        selections.append({
            key: value for key, value in selected.items()
            if key not in {"selectionKey", "tensor"}
        })
    weighted_total = sum(
        per_class_worst[identity]
        * float(source["derivedClassWeights"][identity])
        for identity in identities
    )
    rollout_weight = float(source["rolloutWeight"])
    return {
        "status": contract["status"],
        "perClassWorstTensors": per_class_worst,
        "perClassSelections": selections,
        "weightedTotalTensor": weighted_total,
        "checkpointQualificationTensor": weighted_total * rollout_weight,
        "derivedClassWeights": dict(source["derivedClassWeights"]),
        "rolloutWeight": rollout_weight,
    }


def stage4_frozen_autoencoder_unique_spatial_feature_pyramid(autoencoder, value):
    """Return the final feature at every existing encoder spatial stage."""
    encoder = getattr(autoencoder, "encoder", None)
    if encoder is None or not hasattr(encoder, "__iter__"):
        raise ValueError("Stage 4 frozen Autoencoder encoder path is unavailable")
    if any(parameter.requires_grad for parameter in autoencoder.parameters()):
        raise ValueError("Stage 4 reference-feature Autoencoder must remain frozen")
    current = value
    ordered_shapes = []
    features_by_shape = {}
    for module in encoder:
        current = module(current)
        spatial_shape = tuple(int(item) for item in current.shape[-2:])
        if spatial_shape not in features_by_shape:
            ordered_shapes.append(spatial_shape)
        features_by_shape[spatial_shape] = current
    if len(ordered_shapes) < 2:
        raise ValueError("Stage 4 reference-feature spatial stages are insufficient")
    return tuple(features_by_shape[shape] for shape in ordered_shapes)


def stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
    autoencoder,
    predicted_rgb,
    target_rgb,
    conditions,
    config,
):
    """Compare frozen reference features while keeping gradients inside each class mask."""
    contract = validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
        config
    )
    if contract is None:
        return None
    if (
        predicted_rgb.shape != target_rgb.shape
        or predicted_rgb.ndim != 4
        or predicted_rgb.shape[1] != 3
        or predicted_rgb.shape[0] != conditions.shape[0]
    ):
        raise ValueError("Stage 4 reference-feature input identity changed")
    order = list(config.get("conditionChannelOrder", []))
    required_classes = list(STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    if any(name not in order for name in required_classes):
        raise ValueError("Stage 4 reference-feature condition channel is missing")
    with torch.no_grad():
        target_features = stage4_frozen_autoencoder_unique_spatial_feature_pyramid(
            autoencoder, target_rgb.detach(),
        )
    per_sample_rows = []
    derived_weights = contract["sourceContract"]["derivedClassWeights"]
    identities = FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    for sample_index in range(predicted_rgb.shape[0]):
        class_row = []
        for identity in identities:
            channel_name = f"object_{identity}"
            mask = conditions[
                sample_index:sample_index + 1,
                order.index(channel_name):order.index(channel_name) + 1,
            ]
            mask = torch.nn.functional.interpolate(
                mask, size=predicted_rgb.shape[-2:], mode="nearest",
            ).clamp(0.0, 1.0)
            if float(mask.sum().detach()) <= 0.0:
                class_loss = predicted_rgb.new_zeros(())
            else:
                predicted_sample = predicted_rgb[sample_index:sample_index + 1]
                target_sample = target_rgb[sample_index:sample_index + 1]
                masked_prediction = (
                    predicted_sample * mask + target_sample.detach() * (1.0 - mask)
                )
                predicted_features = (
                    stage4_frozen_autoencoder_unique_spatial_feature_pyramid(
                        autoencoder, masked_prediction,
                    )
                )
                if len(predicted_features) != len(target_features):
                    raise ValueError("Stage 4 reference-feature stage count changed")
                stage_losses = []
                for predicted_feature, target_feature in zip(
                    predicted_features, target_features,
                ):
                    target_sample_feature = target_feature[
                        sample_index:sample_index + 1
                    ]
                    feature_mask = torch.nn.functional.interpolate(
                        mask, size=predicted_feature.shape[-2:], mode="nearest",
                    )
                    denominator = feature_mask.sum() * predicted_feature.shape[1]
                    if float(denominator.detach()) <= 0.0:
                        continue
                    stage_losses.append(
                        (
                            (predicted_feature - target_sample_feature).abs()
                            * feature_mask
                        ).sum() / denominator
                    )
                if not stage_losses:
                    raise ValueError("Stage 4 reference-feature mask has no spatial support")
                class_loss = torch.stack(stage_losses).mean()
            class_row.append(class_loss)
        per_sample_rows.append(torch.stack(class_row))
    per_sample_class = torch.stack(per_sample_rows)
    per_class = {
        identity: per_sample_class[:, class_index].mean()
        for class_index, identity in enumerate(identities)
    }
    metrics = {}
    for identity in identities:
        metrics[
            f"stage4PerClassFinalVisible{upper_camel(identity)}ReferenceFeatureStructureLoss"
        ] = per_class[identity]
    weighted_total = sum(
        per_class[identity] * float(derived_weights[identity])
        for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    )
    return {
        "status": contract["status"],
        "perClassLossTensors": per_class,
        "perSampleClassTensors": per_sample_class,
        "weightedTotalTensor": weighted_total,
        "metrics": metrics,
        "derivedClassWeights": dict(derived_weights),
        "featureStageCount": len(target_features),
    }


def stage4_best_checkpoint_and_terminal_qualification_identity_separation_contract():
    return {
        "schemaVersion": "stage4-best-checkpoint-terminal-qualification-identity-separation-contract-v1",
        "enabled": True,
        "status": "active_owner_authorized_single_execution",
        "contractId": STAGE4_BEST_CHECKPOINT_TERMINAL_QUALIFICATION_IDENTITY_SEPARATION_ID,
        "bestCheckpointIdentity": {
            "selectionContract": "existing_validation_score_plus_west_boundary_non_regression_unchanged",
            "previewIdentityGate": "byte_exact_best_epoch_reproduction",
            "mainCheckpointFormatChanged": False,
        },
        "terminalQualificationIdentity": {
            "terminalEpoch": 30,
            "stateArtifactFileName": "epoch-030-denoiser-state.pt",
            "stateArtifactRole": "non_promotable_late_stability_qualification_evidence_only",
            "previewIdentityGate": "byte_exact_terminal_epoch_reproduction",
            "stage0InitializationEligible": False,
        },
        "identitySeparationRequired": True,
        "crossIdentitySubstitutionAllowed": False,
        "machineReviewThresholdsChanged": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewResultsUsedAsTrainingTargets": False,
        "evidenceBindings": dict(
            STAGE4_BEST_CHECKPOINT_TERMINAL_QUALIFICATION_IDENTITY_SEPARATION_EVIDENCE
        ),
    }


def validate_stage4_best_checkpoint_and_terminal_qualification_identity_separation(
    config,
):
    """Keep the best training checkpoint and Epoch 30 qualification identity separate."""
    contract = config.get("training", {}).get(
        "stage4BestCheckpointAndTerminalQualificationIdentitySeparation", {}
    )
    if not contract:
        return None
    expected = stage4_best_checkpoint_and_terminal_qualification_identity_separation_contract()
    if contract != expected:
        raise ValueError(
            "Stage 4 best-checkpoint and terminal-qualification identity contract changed"
        )
    if resolve_stage_mode(config).mode_id != "fact_conditioned_semantic_mixture_stage4_smoke":
        raise ValueError("Stage 4 terminal qualification identity is Smoke-only")
    worst_sample = validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        config
    )
    if worst_sample is None or worst_sample.get("status") != "training_loss_active_owner_authorized":
        raise ValueError(
            "Stage 4 terminal qualification identity requires the active worst sample-class obligation"
        )
    return contract


def stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(
    config,
    candidate_value,
    selected_value,
):
    contract = validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        config
    )
    if contract is None or contract.get("status") != "training_loss_active_owner_authorized":
        return True
    if selected_value is None:
        return True
    return float(candidate_value) >= float(selected_value)


def stage4_full_rollout_final_visible_consistency(
    model,
    conditions,
    target_image,
    alpha_bars,
    latent_normalization,
    config,
    batch_index,
):
    contract = validate_stage4_full_rollout_final_visible_consistency(config)
    if contract is None:
        return None
    steps = inference_timesteps(
        int(config["diffusionSteps"]), int(config["inferenceSteps"]), target_image.device,
    )
    gradient_tail_steps = int(contract["gradientTailSteps"])
    no_gradient_steps = len(steps) - gradient_tail_steps
    latent_shape = model.autoencoder.encode(target_image).shape
    generator = torch.Generator(device=target_image.device).manual_seed(
        int(config["training"]["seed"]) + 3000 + int(batch_index)
    )
    latent = torch.randn(latent_shape, device=target_image.device, generator=generator)
    for step_index, timestep in enumerate(steps):
        timestep_value = int(timestep.item())
        previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
        timestep_batch = torch.full(
            (latent.shape[0],), timestep_value, device=latent.device, dtype=torch.long,
        )
        if step_index < no_gradient_steps:
            with torch.no_grad():
                velocity = model.predict_velocity(latent, timestep_batch, conditions)
                latent = deterministic_velocity_step(
                    latent, velocity, timestep_value, previous, alpha_bars,
                )
            latent = latent.detach()
        else:
            velocity = model.predict_velocity(latent, timestep_batch, conditions)
            latent = deterministic_velocity_step(
                latent, velocity, timestep_value, previous, alpha_bars,
            )
    predicted_rgb = model.autoencoder.decode(
        denormalize_latent(latent, latent_normalization)
    ).clamp(0.0, 1.0)
    terms = contract["finalVisibleTerms"]
    water_rgb = masked_condition_rgb_loss(
        predicted_rgb, target_image, conditions, config, "terrain_water",
    )
    path_inside = path_interior_rgb_loss(predicted_rgb, target_image, conditions, config)
    path_forbidden = path_forbidden_boundary_rgb_loss(
        predicted_rgb, target_image, conditions, config,
    )
    coverage = path_coverage_calibration_loss(
        predicted_rgb, target_image, conditions, config,
    )
    activation = path_activation_mass_calibration_loss(
        predicted_rgb, target_image, conditions, config,
    )
    boundary = required_boundary_contact_loss(
        predicted_rgb, target_image, conditions, config,
    )
    distribution = stage4_distribution_aware_visible_spatial_semantic_obligation(
        [predicted_rgb], target_image, conditions, config,
    )
    per_class_luminance = None
    per_class_contract = config.get("training", {}).get(
        "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
    )
    if per_class_contract.get("status") == "training_loss_active_owner_authorized":
        per_class_luminance = (
            stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses(
                predicted_rgb, target_image, conditions, config,
            )
        )
    worst_sample_class_luminance = None
    worst_sample_class_contract = config.get("training", {}).get(
        "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
    )
    if worst_sample_class_contract.get("status") == "training_loss_active_owner_authorized":
        worst_sample_class_luminance = (
            stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                predicted_rgb, target_image, conditions, config,
            )
        )
    reference_feature_structure = None
    reference_feature_contract = config.get("training", {}).get(
        "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
    )
    if reference_feature_contract.get("status") == "training_loss_active_owner_authorized":
        reference_feature_structure = (
            stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                model.autoencoder, predicted_rgb, target_image, conditions, config,
            )
        )
    rgb = torch.nn.functional.l1_loss(predicted_rgb, target_image)
    grid = spatial_grid_rgb_loss(predicted_rgb, target_image)
    raw = (
        rgb * float(terms["decodedRgb"])
        + grid * float(terms["spatialGridRgb"])
        + water_rgb * float(terms["terrainWaterMaskedRgb"])
        + path_inside * float(terms["routeInteriorRgb"])
        + path_forbidden * float(terms["routeForbiddenBoundaryRgb"])
        + coverage * float(terms["routeCoverage"])
        + activation * float(terms["routeActivationMass"])
        + boundary * float(terms["routeRequiredBoundary"])
        + distribution["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
        + (
            reference_feature_structure["weightedTotalTensor"]
            if reference_feature_structure is not None
            else predicted_rgb.new_zeros(())
        )
        + (
            worst_sample_class_luminance["worstWeightedSampleClassTensor"]
            if worst_sample_class_luminance is not None
            else per_class_luminance["weightedTotalTensor"]
            if per_class_luminance is not None else predicted_rgb.new_zeros(())
        )
    )
    weighted = raw * float(contract["weight"])
    result = {
        "stage4FullRolloutFinalVisibleConsistencyLossTensor": weighted,
        "stage4FullRolloutFinalVisibleConsistencyWeightedLoss": weighted,
        "stage4FullRolloutFinalVisibleConsistencyRawLoss": raw,
        "stage4FullRolloutFinalVisibleRgbMae": rgb,
        "stage4FullRolloutTerrainWaterRgbMae": water_rgb,
        "stage4FullRolloutRouteInteriorRgbMae": path_inside,
        "stage4FullRolloutRouteForbiddenBoundaryRgbMae": path_forbidden,
        "stage4FullRolloutRouteCoverageLoss": coverage,
        "stage4FullRolloutRouteActivationMassLoss": activation,
        "stage4FullRolloutRouteRequiredBoundaryLoss": boundary,
        "stage4FullRolloutWorstSampleClassFinalRgbObligation": distribution[
            "stage4DistributionAwareWorstSampleClassFinalRgbObligation"
        ],
        "stage4FullRolloutStepCount": predicted_rgb.new_tensor(float(len(steps))),
        "stage4FullRolloutGradientTailStepCount": predicted_rgb.new_tensor(float(gradient_tail_steps)),
    }
    if per_class_luminance is not None:
        result.update(per_class_luminance["metrics"])
        result[
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureWeightedLoss"
        ] = per_class_luminance["weightedTotalTensor"] * float(contract["weight"])
    if worst_sample_class_luminance is not None:
        result[
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"
        ] = worst_sample_class_luminance["worstWeightedSampleClassTensor"]
        result[
            "stage4FullRolloutWeightedPerSampleClassLuminanceStructureTensor"
        ] = worst_sample_class_luminance["weightedPerSampleClassTensors"]
        result[
            "stage4FullRolloutWorstSampleClassReferenceLuminanceWeightedLoss"
        ] = (
            worst_sample_class_luminance["worstWeightedSampleClassTensor"]
            * float(contract["weight"])
        )
    if reference_feature_structure is not None:
        result.update(reference_feature_structure["metrics"])
        result[
            "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
        ] = reference_feature_structure["perSampleClassTensors"]
        result[
            "stage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss"
        ] = (
            reference_feature_structure["weightedTotalTensor"]
            * float(contract["weight"])
        )
    return result


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


def masked_condition_luminance_correlation_loss(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
    channel_name,
):
    """Match visible spatial luminance structure inside one typed condition mask."""
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    if predicted_rgb.shape[1] != 3 or target_rgb.shape[1] != 3:
        raise ValueError("masked luminance correlation requires RGB tensors")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(
        mask,
        size=predicted_rgb.shape[-2:],
        mode="nearest",
    )
    support = mask.sum()
    if float(support.detach().cpu()) <= 1.0:
        raise ValueError("masked luminance correlation requires non-empty spatial support")
    coefficients = predicted_rgb.new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    predicted_luminance = (predicted_rgb * coefficients).sum(dim=1, keepdim=True)
    target_luminance = (target_rgb * coefficients).sum(dim=1, keepdim=True)
    predicted_mean = (predicted_luminance * mask).sum() / support
    target_mean = (target_luminance * mask).sum() / support
    predicted_centered = (predicted_luminance - predicted_mean) * mask
    target_centered = (target_luminance - target_mean) * mask
    numerator = (predicted_centered * target_centered).sum()
    predicted_energy = predicted_centered.square().sum()
    target_energy = target_centered.square().sum()
    epsilon = torch.finfo(predicted_rgb.dtype).eps
    if float(target_energy.detach().cpu()) <= epsilon:
        raise ValueError("masked reference luminance must contain spatial variation")
    denominator = torch.sqrt(predicted_energy * target_energy).clamp_min(epsilon)
    return predicted_rgb.new_tensor(1.0) - numerator / denominator


def stage4_object_visible_structure_supervision_losses(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
):
    """Compute four typed forward losses without creating an optimizer or running backward."""
    contract = validate_stage4_object_visible_structure_supervision(config)
    identities = FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation")
    losses = {}
    weighted = []
    for identity, prefix, channel in zip(
        identities, prefixes, STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS,
    ):
        value = masked_condition_luminance_correlation_loss(
            predicted_rgb, target_rgb, conditions, config, channel,
        )
        losses[
            f"stage4SemanticMixture{prefix}FinalTypedLuminanceCorrelationLoss"
        ] = value
        weighted.append(value * float(contract["derivedWeights"][identity]))
    return {
        "status": contract["status"],
        "losses": losses,
        "weightedTotalTensor": torch.stack(weighted).sum(),
        "sourceChannels": contract["sourceChannels"],
        "derivedWeights": contract["derivedWeights"],
    }


def _stage4_masked_luminance_correlation_from_mask(
    predicted_rgb,
    target_rgb,
    mask,
):
    if predicted_rgb.shape[1] != 3 or target_rgb.shape[1] != 3:
        raise ValueError("masked multiscale luminance correlation requires RGB tensors")
    support = mask.sum()
    if float(support.detach().cpu()) <= 1.0:
        raise ValueError("masked multiscale luminance correlation requires spatial support")
    coefficients = predicted_rgb.new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    predicted_luminance = (predicted_rgb * coefficients).sum(dim=1, keepdim=True)
    target_luminance = (target_rgb * coefficients).sum(dim=1, keepdim=True)
    predicted_mean = (predicted_luminance * mask).sum() / support
    target_mean = (target_luminance * mask).sum() / support
    predicted_centered = (predicted_luminance - predicted_mean) * mask
    target_centered = (target_luminance - target_mean) * mask
    numerator = (predicted_centered * target_centered).sum()
    predicted_energy = predicted_centered.square().sum()
    target_energy = target_centered.square().sum()
    epsilon = torch.finfo(predicted_rgb.dtype).eps
    if float(target_energy.detach().cpu()) <= epsilon:
        raise ValueError("masked multiscale reference luminance must contain spatial variation")
    denominator = torch.sqrt(predicted_energy * target_energy).clamp_min(epsilon)
    return predicted_rgb.new_tensor(1.0) - numerator / denominator


def _stage4_reference_luminance_energy_from_mask(target_rgb, mask):
    coefficients = target_rgb.new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    target_luminance = (target_rgb * coefficients).sum(dim=1, keepdim=True)
    support = mask.sum()
    if float(support.detach().cpu()) <= 1.0:
        return target_rgb.new_tensor(0.0)
    target_mean = (target_luminance * mask).sum() / support
    target_centered = (target_luminance - target_mean) * mask
    return target_centered.square().sum()


def _stage4_resolve_multiscale_support_mask(mask, size, target_rgb=None):
    """Preserve the primary mask, with bounded area fallbacks for undefined correlation."""
    functional = torch.nn.functional
    nearest = functional.interpolate(mask, size=size, mode="nearest")
    resolved = []
    for sample_index in range(nearest.shape[0]):
        nearest_sample = nearest[sample_index:sample_index + 1]
        nearest_support = float(nearest_sample.sum().detach().cpu())
        if nearest_support > 1.0:
            selected_sample = nearest_sample
        else:
            selected_sample = functional.interpolate(
                mask[sample_index:sample_index + 1], size=size, mode="area",
            )
            area_support = float(selected_sample.sum().detach().cpu())
            area_nonzero = int(torch.count_nonzero(selected_sample).detach().cpu())
            if area_support <= 1.0 or area_nonzero < 2:
                raise ValueError(
                    "masked multiscale luminance correlation requires spatial support "
                    "after sparse area occupancy fallback"
                )
        if target_rgb is not None:
            target_sample = target_rgb[sample_index:sample_index + 1]
            selected_energy = _stage4_reference_luminance_energy_from_mask(
                target_sample, selected_sample,
            )
            epsilon = torch.finfo(target_sample.dtype).eps
            if float(selected_energy.detach().cpu()) <= epsilon:
                area_sample = functional.interpolate(
                    mask[sample_index:sample_index + 1], size=size, mode="area",
                )
                area_support = float(area_sample.sum().detach().cpu())
                area_nonzero = int(torch.count_nonzero(area_sample).detach().cpu())
                area_energy = _stage4_reference_luminance_energy_from_mask(
                    target_sample, area_sample,
                )
                if (
                    area_support <= 1.0
                    or area_nonzero < 2
                    or float(area_energy.detach().cpu()) <= epsilon
                ):
                    raise ValueError(
                        "masked multiscale reference luminance must contain spatial variation "
                        "after area occupancy fallback"
                    )
                selected_sample = area_sample
        resolved.append(selected_sample)
    return torch.cat(resolved, dim=0)


def _stage4_object_luminance_structure_pyramid(predicted_rgb, target_rgb, mask, scales):
    functional = torch.nn.functional
    pyramid = []
    height, width = predicted_rgb.shape[-2:]
    predicted_masked = predicted_rgb * mask
    target_masked = target_rgb * mask
    for scale in scales:
        size = (max(2, round(height * float(scale))), max(2, round(width * float(scale))))
        if size == (height, width):
            predicted_scale = predicted_masked
            target_scale = target_masked
        else:
            predicted_scale = functional.interpolate(
                predicted_masked, size=size, mode="bilinear", align_corners=False,
            )
            target_scale = functional.interpolate(
                target_masked, size=size, mode="bilinear", align_corners=False,
            )
        mask_scale = _stage4_resolve_multiscale_support_mask(
            mask, size, target_rgb=target_scale,
        )
        pyramid.append((predicted_scale, target_scale, mask_scale))
    return pyramid


def _stage4_masked_cross_scale_structure_consistency(pyramid):
    functional = torch.nn.functional
    coefficients = pyramid[0][0].new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    pair_losses = []
    for current, lower in zip(pyramid, pyramid[1:]):
        predicted_current, target_current, mask_current = current
        predicted_lower, target_lower, _ = lower
        current_size = predicted_current.shape[-2:]
        predicted_lower_up = functional.interpolate(
            predicted_lower, size=current_size, mode="bilinear", align_corners=False,
        )
        target_lower_up = functional.interpolate(
            target_lower, size=current_size, mode="bilinear", align_corners=False,
        )
        predicted_laplacian = (
            (predicted_current * coefficients).sum(dim=1, keepdim=True)
            - (predicted_lower_up * coefficients).sum(dim=1, keepdim=True)
        )
        target_laplacian = (
            (target_current * coefficients).sum(dim=1, keepdim=True)
            - (target_lower_up * coefficients).sum(dim=1, keepdim=True)
        )
        support = mask_current.sum()
        if float(support.detach().cpu()) <= 1.0:
            raise ValueError("masked cross-scale structure consistency requires spatial support")
        pair_losses.append(
            ((predicted_laplacian - target_laplacian).abs() * mask_current).sum()
            / support
        )
    return torch.stack(pair_losses).mean()


def stage4_object_reference_multiscale_luminance_structure_supervision_losses(
    predicted_rgb,
    target_rgb,
    conditions,
    config,
):
    """Compute the bounded multiscale CPU forward contract without backward or an optimizer."""
    contract = validate_stage4_object_reference_multiscale_luminance_structure_supervision(
        config
    )
    order = list(config["conditionChannelOrder"])
    identities = FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation")
    scale_suffixes = ("Native", "Half", "Quarter")
    losses = {}
    weighted = []
    object_totals = {}
    for identity, prefix, channel in zip(
        identities, prefixes, STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS,
    ):
        if channel not in order:
            raise ValueError(f"condition channel is missing: {channel}")
        mask = conditions[:, order.index(channel):order.index(channel) + 1]
        mask = torch.nn.functional.interpolate(
            mask, size=predicted_rgb.shape[-2:], mode="nearest",
        )
        pyramid = _stage4_object_luminance_structure_pyramid(
            predicted_rgb, target_rgb, mask, contract["pyramidScales"],
        )
        obligations = []
        for suffix, (predicted_scale, target_scale, mask_scale) in zip(
            scale_suffixes, pyramid,
        ):
            value = _stage4_masked_luminance_correlation_from_mask(
                predicted_scale, target_scale, mask_scale,
            )
            losses[
                f"stage4SemanticMixture{prefix}FinalTyped{suffix}LuminanceCorrelationLoss"
            ] = value
            obligations.append(value)
        cross_scale = _stage4_masked_cross_scale_structure_consistency(pyramid)
        losses[
            f"stage4SemanticMixture{prefix}FinalTypedCrossScaleStructureConsistencyLoss"
        ] = cross_scale
        obligations.append(cross_scale)
        object_total = torch.stack(obligations).mean()
        losses[
            f"stage4SemanticMixture{prefix}FinalTypedMultiscaleLuminanceStructureLoss"
        ] = object_total
        object_totals[identity] = object_total
        weighted.append(object_total * float(contract["derivedWeights"][identity]))
    return {
        "status": contract["status"],
        "losses": losses,
        "objectTotalTensors": object_totals,
        "weightedTotalTensor": torch.stack(weighted).sum(),
        "sourceChannels": contract["sourceChannels"],
        "pyramidScales": contract["pyramidScales"],
        "derivedWeights": contract["derivedWeights"],
    }


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


def stage4_epoch_worst_sample_class_replay_loss_from_measurements(
    distribution,
    multiscale,
    config,
    class_index,
    replay_index=0,
    allow_inactive_stabilization=False,
):
    contract = validate_stage4_epoch_worst_sample_class_replay(config)
    if contract is None:
        raise ValueError("Stage 4 epoch-worst replay is not enabled")
    class_index = int(class_index)
    replay_index = int(replay_index)
    if class_index < 0 or class_index >= len(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES):
        raise ValueError("Stage 4 epoch-worst replay class index is invalid")
    if replay_index < 0 or replay_index >= int(
        contract["replay"]["passesPerObservedPrimaryBatch"]
    ):
        raise ValueError("Stage 4 epoch-worst replay pass index is invalid")
    per_class = distribution.get(
        "stage4DistributionAwareWeightedPerSampleClassTensor"
    )
    if not isinstance(per_class, torch.Tensor) or per_class.ndim != 2:
        raise ValueError("Stage 4 epoch-worst replay measurement ledger is invalid")
    direct = per_class[0, class_index]
    stabilization = (
        validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )
    )
    use_stabilization = stabilization is not None and (
        allow_inactive_stabilization
        or stabilization["status"] == "training_loss_active_owner_authorized"
    )
    joint = direct.new_zeros(())
    lane_index = 0
    replay_loss = direct
    if use_stabilization:
        lane = stabilization["lanes"][replay_index]
        lane_index = replay_index
        if lane["laneId"] == "lane_2_joint_four_object_reference_multiscale":
            if not isinstance(multiscale, dict) or not isinstance(
                multiscale.get("weightedTotalTensor"), torch.Tensor
            ):
                raise ValueError(
                    "Stage 4 joint four-object multiscale replay measurement is unavailable"
                )
            joint = multiscale["weightedTotalTensor"]
            replay_loss = joint
        elif lane["laneId"] != "lane_1_existing_global_worst_sample_class":
            raise ValueError("Stage 4 early-convergence replay lane is invalid")
    return {
        "stage4EpochWorstSampleClassReplayLossTensor": replay_loss,
        "stage4EpochWorstSampleClassReplayDirectWeightedLoss": direct,
        "stage4EpochWorstSampleClassReplayJointFourObjectMultiscaleWeightedLoss": joint,
        "stage4EpochWorstSampleClassReplayClassIndex": direct.new_tensor(
            float(class_index)
        ),
        "stage4EpochWorstSampleClassReplayLaneIndex": direct.new_tensor(
            float(lane_index)
        ),
    }


def stage4_epoch_worst_sample_class_replay_supervision(
    model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars,
    conditions, target_image, latent_normalization, config, class_index,
    replay_index=0, full_rollout_batch_index=None,
):
    contract = validate_stage4_epoch_worst_sample_class_replay(config)
    if contract is None:
        raise ValueError("Stage 4 epoch-worst replay is not enabled")
    reference_feature_replay = (
        validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
            config
        )
    )
    if (
        reference_feature_replay is not None
        and reference_feature_replay["status"]
        == "training_loss_active_owner_authorized"
    ):
        if full_rollout_batch_index is None:
            raise ValueError(
                "Stage 4 epoch-worst reference-feature rollout identity is missing"
            )
        full_rollout = stage4_full_rollout_final_visible_consistency(
            model,
            conditions,
            target_image,
            alpha_bars,
            latent_normalization,
            config,
            int(full_rollout_batch_index),
        )
        per_sample_class = full_rollout.get(
            "stage4PerClassFinalVisibleReferenceFeatureStructurePerSampleClassTensor"
        )
        result = stage4_epoch_worst_reference_feature_replay_loss_from_tensor(
            per_sample_class, config, class_index
        )
        if result is None:
            raise ValueError(
                "Stage 4 epoch-worst reference-feature replay tensor is unavailable"
            )
        return result
    measured = predict_and_measure(
        model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars,
        conditions, config, target_image, latent_normalization,
    )
    distribution = stage4_distribution_aware_visible_spatial_semantic_obligation(
        [measured["predictedRgbTensor"]], target_image, conditions, config,
    )
    stabilization = (
        validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )
    )
    multiscale = None
    if (
        stabilization is not None
        and stabilization["status"] == "training_loss_active_owner_authorized"
        and int(replay_index) == 1
    ):
        multiscale = (
            stage4_object_reference_multiscale_luminance_structure_supervision_losses(
                measured["predictedRgbTensor"], target_image, conditions, config
            )
        )
    return stage4_epoch_worst_sample_class_replay_loss_from_measurements(
        distribution,
        multiscale,
        config,
        class_index,
        replay_index=replay_index,
    )


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
    if "stage4DistributionAwareVisibleSpatialSemanticObligation" in config.get("training", {}):
        distribution = stage4_distribution_aware_visible_spatial_semantic_obligation(
            predicted_rgb_steps, target_image, conditions, config,
        )
        result["shortTrajectoryLossTensor"] = (
            result["shortTrajectoryLossTensor"]
            + distribution["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
        )
        result["shortTrajectoryWeightedLoss"] = result["shortTrajectoryLossTensor"]
        result["stage4DistributionAwareTrajectoryWorstSampleClassFinalRgbObligation"] = (
            distribution["stage4DistributionAwareWorstSampleClassFinalRgbObligation"]
        )
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
    worst_distribution_obligation = None
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
                distribution_value = loss_metrics.get(
                    "stage4DistributionAwareWorstSampleClassFinalRgbObligation"
                )
                if distribution_value is not None:
                    current = float(distribution_value.detach())
                    worst_distribution_obligation = (
                        current if worst_distribution_obligation is None
                        else max(worst_distribution_obligation, current)
                    )
                count += 1
    if was_training:
        model.denoiser.train()
    if count == 0:
        raise ValueError("conditional denoiser evaluation loader produced no batches")
    result = {
        **{key: value / count for key, value in totals.items()},
        "fixedTimesteps": [int(value) for value in timesteps],
    }
    if worst_distribution_obligation is not None:
        averaged = result["compositeConditionQualityScore"]
        averaged_embedded = result.get(
            "stage4DistributionAwareWorstSampleClassFinalRgbObligation", 0.0
        )
        result["compositeConditionQualityScore"] = (
            averaged - averaged_embedded + worst_distribution_obligation
        )
        result["stage4DistributionAwareWorstValidationSampleClassFinalRgbObligation"] = (
            worst_distribution_obligation
        )
    return result


def predict_and_measure(model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars, conditions, config, target_image=None, latent_normalization=None):
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    if is_v5_or_later(config):
        stage4_alignment_readout = None
        stage4_object_alignment = None
        stage4_structure_fact = None
        stage4_semantic_renderer = None
        stage4_semantic_mixture = None
        if is_fact_conditioned_semantic_mixture_stage4(config):
            predicted_velocity, stage4_semantic_mixture = model.predict_velocity_with_stage4_semantic_mixture(
                noisy_latent, timesteps, conditions
            )
        elif is_condition_preserving_semantic_renderer_stage4(config):
            predicted_velocity, stage4_semantic_renderer = model.predict_velocity_with_stage4_semantic_renderer(
                noisy_latent, timesteps, conditions
            )
        elif is_structure_fact_first_stage4(config):
            predicted_velocity, stage4_structure_fact = model.predict_velocity_with_stage4_structure_fact(
                noisy_latent, timesteps, conditions
            )
        elif is_v9_stage4_object_semantic_decoded_alignment(config):
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
            if is_fact_conditioned_semantic_mixture_stage4(config):
                typed_counterfactual_rgb = {}
                for identity, gated_contribution in zip(
                    stage4_semantic_mixture["expertIdentityOrder"],
                    stage4_semantic_mixture["gatedContributions"],
                ):
                    owned_velocity = (
                        stage4_semantic_mixture["baseVelocity"].detach()
                        + gated_contribution
                    )
                    owned_clean = (
                        alpha.sqrt() * noisy_latent
                        - (1.0 - alpha).sqrt() * owned_velocity
                    )
                    typed_counterfactual_rgb[identity] = model.autoencoder.decode(
                        denormalize_latent(owned_clean, latent_normalization)
                    )
                return composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
                    predicted_velocity,
                    target_velocity,
                    predicted_clean,
                    clean_latent,
                    predicted_conditions,
                    target_conditions,
                    predicted_rgb,
                    target_image,
                    conditions,
                    stage4_semantic_mixture,
                    typed_counterfactual_rgb,
                    config,
                )
            if is_condition_preserving_semantic_renderer_stage4(config):
                return composite_denoiser_losses_condition_preserving_semantic_renderer_stage4(
                    predicted_velocity,
                    target_velocity,
                    predicted_clean,
                    clean_latent,
                    predicted_conditions,
                    target_conditions,
                    predicted_rgb,
                    target_image,
                    conditions,
                    stage4_semantic_renderer,
                    config,
                )
            if is_structure_fact_first_stage4(config):
                return composite_denoiser_losses_structure_fact_first_stage4(
                    predicted_velocity,
                    target_velocity,
                    predicted_clean,
                    clean_latent,
                    predicted_conditions,
                    target_conditions,
                    predicted_rgb,
                    target_image,
                    conditions,
                    stage4_structure_fact,
                    config,
                )
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


def composite_denoiser_losses_condition_preserving_semantic_renderer_stage4(
    predicted_velocity,
    target_velocity,
    predicted_clean,
    clean_latent,
    predicted_conditions,
    target_conditions,
    predicted_rgb,
    target_rgb,
    full_conditions,
    renderer,
    config,
):
    if not isinstance(renderer, dict):
        raise ValueError("Stage 4 semantic renderer outputs are missing")
    readout = renderer.get("semanticReadout")
    features_up1 = tuple(renderer.get("semanticFeaturesUp1", ()))
    features_up0 = tuple(renderer.get("semanticFeaturesUp0", ()))
    channel_order = tuple(renderer.get("semanticChannelOrder", ()))
    source_order = tuple(renderer.get("semanticSourceChannels", ()))
    primary_velocity = renderer.get("primaryVelocity")
    expected_channels = CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS
    if (
        readout is None
        or readout.shape[1] != len(expected_channels)
        or len(features_up1) != len(expected_channels)
        or len(features_up0) != len(expected_channels)
        or channel_order != expected_channels
        or source_order != CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS
        or tuple(renderer.get("fusionScales", ())) != ("up1", "up0")
        or renderer.get("fusionKind") != "learned_condition_preserving_residual_gate_v1"
        or primary_velocity is None
        or primary_velocity.shape != predicted_velocity.shape
    ):
        raise ValueError("Stage 4 semantic renderer identity, fusion, or primary path is invalid")

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
    legal_targets, target_order = stage4_decoded_alignment_targets(
        full_conditions,
        readout.shape[-2:],
        config,
    )
    target_by_name = {
        name: legal_targets[:, index:index + 1]
        for index, name in enumerate(target_order)
    }
    if any(name not in target_by_name for name in expected_channels):
        raise ValueError("Stage 4 semantic renderer legal targets are incomplete")
    channel_losses = [
        balanced_binary_condition_loss(
            readout[:, index:index + 1],
            target_by_name[name],
        )
        for index, name in enumerate(expected_channels)
    ]
    renderer_loss = torch.stack(channel_losses).mean()
    reused_weight = float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"])
    checkpoint_weight = float(
        config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"]
    )
    composite = base["compositeLossTensor"] + renderer_loss * reused_weight
    checkpoint = base["compositeConditionQualityScore"] + renderer_loss * checkpoint_weight
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation", "RouteBoundary")
    metrics = {
        f"stage4SemanticRenderer{prefix}IndependentLoss": channel_losses[index]
        for index, prefix in enumerate(prefixes)
    }
    fusion_response = (predicted_velocity - primary_velocity).abs().mean()
    metrics.update({
        "stage4SemanticRendererFusionResponseMae": fusion_response,
        "stage4SemanticRendererPrimaryPathAvailable": predicted_velocity.new_tensor(1.0),
        "stage4SemanticRendererReusedDiscreteConditionWeight": predicted_velocity.new_tensor(reused_weight),
    })
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


def composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
    predicted_velocity,
    target_velocity,
    predicted_clean,
    clean_latent,
    predicted_conditions,
    target_conditions,
    predicted_rgb,
    target_rgb,
    full_conditions,
    mixture,
    typed_counterfactual_rgb,
    config,
):
    if not isinstance(mixture, dict) or not isinstance(typed_counterfactual_rgb, dict):
        raise ValueError("Stage 4 semantic mixture outputs are missing")
    identities = tuple(mixture.get("expertIdentityOrder", ()))
    sources = tuple(mixture.get("sourceConditionChannels", ()))
    contributions = tuple(mixture.get("expertContributions", ()))
    gated_contributions = tuple(mixture.get("gatedContributions", ()))
    participation = mixture.get("participation")
    base_velocity = mixture.get("baseVelocity")
    if (
        identities != FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
        or sources != FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS
        or len(contributions) != len(identities)
        or len(gated_contributions) != len(identities)
        or participation is None
        or participation.shape[1] != len(identities)
        or base_velocity is None
        or base_velocity.shape != predicted_velocity.shape
        or mixture.get("compositorKind")
        != "typed_fact_conditioned_gated_additive_mixture_v1"
        or mixture.get("typedIdentityCollapsedBeforeOutput") is not False
        or tuple(typed_counterfactual_rgb) != identities
    ):
        raise ValueError("Stage 4 semantic mixture identity or final contribution contract is invalid")

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
    legal_targets, legal_order = stage4_decoded_alignment_targets(
        full_conditions,
        participation.shape[-2:],
        config,
    )
    legal_by_name = {
        name: legal_targets[:, index:index + 1]
        for index, name in enumerate(legal_order)
    }
    participation_losses = []
    counterfactual_losses = []
    final_typed_losses = []
    for index, (identity, source_channel) in enumerate(zip(identities, sources)):
        if source_channel not in legal_by_name:
            raise ValueError(f"Stage 4 semantic mixture target is unavailable: {source_channel}")
        participation_losses.append(balanced_binary_condition_loss(
            participation[:, index:index + 1],
            legal_by_name[source_channel],
        ))
        counterfactual_losses.append(masked_condition_rgb_loss(
            typed_counterfactual_rgb[identity],
            target_rgb,
            full_conditions,
            config,
            source_channel,
        ))
        final_typed_losses.append(masked_condition_rgb_loss(
            predicted_rgb,
            target_rgb,
            full_conditions,
            config,
            source_channel,
        ))

    typed_supervision = torch.stack(
        participation_losses + counterfactual_losses,
    ).mean()
    reused_weight = float(
        config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"]
    )
    checkpoint_weight = float(
        config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"]
    )
    composite = base["compositeLossTensor"] + typed_supervision * reused_weight
    checkpoint = base["compositeConditionQualityScore"] + typed_supervision * checkpoint_weight
    if "stage4PerClassFinalVisibleRgbObligation" in config.get("training", {}):
        objective = validate_stage4_per_class_final_visible_rgb_obligation(config)
        explicit_final_rgb = sum(
            final_typed_losses[index] * float(objective["derivedWeights"][identity])
            for index, identity in enumerate(identities)
        )
        composite = composite + explicit_final_rgb
        checkpoint = checkpoint + explicit_final_rgb
    if "stage4DistributionAwareVisibleSpatialSemanticObligation" in config.get("training", {}):
        distribution = stage4_distribution_aware_visible_spatial_semantic_obligation(
            [predicted_rgb], target_rgb, full_conditions, config,
        )
        composite = composite + distribution[
            "stage4DistributionAwareVisibleSpatialSemanticLossTensor"
        ]
        checkpoint = checkpoint + distribution[
            "stage4DistributionAwareVisibleSpatialSemanticLossTensor"
        ]
    if "stage4VegetationFinalVisibleSemanticRepair" in config.get("training", {}):
        repair = validate_stage4_vegetation_final_visible_semantic_repair(config)
        vegetation_edge = masked_condition_gradient_rgb_loss(
            predicted_rgb,
            target_rgb,
            full_conditions,
            config,
            "object_vegetation",
        )
        weighted_vegetation_edge = vegetation_edge * float(repair["derivedWeight"])
        composite = composite + weighted_vegetation_edge
        checkpoint = checkpoint + weighted_vegetation_edge
    if "stage4VegetationLuminanceSpatialStructureSupervision" in config.get("training", {}):
        luminance_contract = validate_stage4_vegetation_luminance_spatial_structure_supervision(
            config
        )
        vegetation_luminance_correlation = masked_condition_luminance_correlation_loss(
            predicted_rgb,
            target_rgb,
            full_conditions,
            config,
            "object_vegetation",
        )
        weighted_vegetation_luminance_correlation = (
            vegetation_luminance_correlation * float(luminance_contract["derivedWeight"])
        )
        composite = composite + weighted_vegetation_luminance_correlation
        checkpoint = checkpoint + weighted_vegetation_luminance_correlation
    if "stage4ObjectVisibleStructureSupervision" in config.get("training", {}):
        object_visible_structure = stage4_object_visible_structure_supervision_losses(
            predicted_rgb,
            target_rgb,
            full_conditions,
            config,
        )
        composite = composite + object_visible_structure["weightedTotalTensor"]
        checkpoint = checkpoint + object_visible_structure["weightedTotalTensor"]
    if "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision" in config.get("training", {}):
        object_multiscale_structure = (
            stage4_object_reference_multiscale_luminance_structure_supervision_losses(
                predicted_rgb,
                target_rgb,
                full_conditions,
                config,
            )
        )
        composite = composite + object_multiscale_structure["weightedTotalTensor"]
        checkpoint = checkpoint + object_multiscale_structure["weightedTotalTensor"]
    prefixes = ("Route", "Footprints", "Tree", "Rock", "Vegetation")
    metrics = {}
    for index, prefix in enumerate(prefixes):
        metrics[f"stage4SemanticMixture{prefix}ParticipationBce"] = participation_losses[index]
        metrics[f"stage4SemanticMixture{prefix}ContributionAbsMean"] = contributions[index].abs().mean()
        metrics[f"stage4SemanticMixture{prefix}GatedContributionAbsMean"] = gated_contributions[index].abs().mean()
        metrics[f"stage4SemanticMixture{prefix}CounterfactualRgbMae"] = counterfactual_losses[index]
        metrics[f"stage4SemanticMixture{prefix}FinalTypedRgbMae"] = final_typed_losses[index]
    if "stage4VegetationFinalVisibleSemanticRepair" in config.get("training", {}):
        metrics["stage4SemanticMixtureVegetationFinalTypedEdgeMae"] = vegetation_edge
    if "stage4VegetationLuminanceSpatialStructureSupervision" in config.get("training", {}):
        metrics[
            "stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss"
        ] = vegetation_luminance_correlation
    if "stage4ObjectVisibleStructureSupervision" in config.get("training", {}):
        metrics.update(object_visible_structure["losses"])
    if "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision" in config.get("training", {}):
        metrics.update(object_multiscale_structure["losses"])
    metrics.update({
        "stage4SemanticMixtureFinalResponseMae": (
            predicted_velocity - base_velocity
        ).abs().mean(),
        "stage4SemanticMixtureTypedIdentityCount": predicted_velocity.new_tensor(
            float(len(identities))
        ),
    })
    if "stage4DistributionAwareVisibleSpatialSemanticObligation" in config.get("training", {}):
        metrics["stage4DistributionAwareWorstSampleClassFinalRgbObligation"] = distribution[
            "stage4DistributionAwareWorstSampleClassFinalRgbObligation"
        ]
        metrics["stage4DistributionAwareMeanSampleWorstClassFinalRgbObligation"] = distribution[
            "stage4DistributionAwareMeanSampleWorstClassFinalRgbObligation"
        ]
        metrics["stage4DistributionAwareWeightedPerSampleClassTensor"] = distribution[
            "stage4DistributionAwareWeightedPerSampleClassTensor"
        ]
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


def composite_denoiser_losses_structure_fact_first_stage4(
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
        raise ValueError("Stage 4 structure-fact-first outputs are missing")
    layout = alignment.get("structureLayout")
    head_outputs = tuple(alignment.get("structureHeadOutputs", ()))
    channel_order = list(alignment.get("structureChannelOrder", ()))
    expected_order = list(STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS)
    if (
        layout is None
        or layout.shape[1] != len(expected_order)
        or len(head_outputs) != len(expected_order)
        or channel_order != expected_order
        or list(alignment.get("stageBInjectionScales", ()))
        != ["level0", "level1", "middle", "up1", "up0"]
    ):
        raise ValueError("Stage 4 structure-fact-first layout identity or shape is invalid")

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
    targets, target_order = stage4_decoded_alignment_targets(
        full_conditions,
        layout.shape[-2:],
        config,
    )
    if target_order != expected_order or targets.shape != layout.shape:
        raise ValueError("Stage 4 structure-fact-first legal layout targets are invalid")
    channel_losses = [
        balanced_binary_condition_loss(
            layout[:, index:index + 1],
            targets[:, index:index + 1],
        )
        for index in range(len(expected_order))
    ]
    layout_loss = torch.stack(channel_losses).mean()
    reused_weight = float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"])
    checkpoint_weight = float(
        config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"]
    )
    composite = base["compositeLossTensor"] + layout_loss * reused_weight
    checkpoint = base["compositeConditionQualityScore"] + layout_loss * checkpoint_weight
    prefix_by_channel = {
        "object_footprints": "ObjectFootprints",
        "object_tree": "ObjectTree",
        "object_rock": "ObjectRock",
        "object_vegetation": "ObjectVegetation",
    }
    metrics = {
        "stage4StructureFactLayoutBce": layout_loss,
        "stage4StructureFactReusedDiscreteConditionWeight": layout.new_tensor(reused_weight),
    }
    object_gradients = []
    for index, name in enumerate(expected_order):
        metrics[STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS[name]] = channel_losses[index]
        if name not in prefix_by_channel:
            continue
        gradient = predicted_rgb.new_zeros(())
        if torch.is_grad_enabled() and channel_losses[index].requires_grad:
            contribution = torch.autograd.grad(
                channel_losses[index] * reused_weight,
                head_outputs[index],
                retain_graph=True,
                create_graph=False,
                allow_unused=True,
            )[0]
            if contribution is not None:
                gradient = contribution.abs().mean().detach()
        object_gradients.append(gradient)
        prefix = prefix_by_channel[name]
        metrics.update({
            f"stage4Diagnostic{prefix}IndependentLoss": channel_losses[index].detach(),
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


def per_sample_masked_condition_rgb_loss(
    predicted_rgb, target_rgb, conditions, config, channel_name,
):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    if predicted_rgb.shape != target_rgb.shape or predicted_rgb.shape[0] != conditions.shape[0]:
        raise ValueError("per-sample final RGB tensors have incompatible shapes")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
    denominator = (mask.sum(dim=(1, 2, 3)) * predicted_rgb.shape[1]).clamp_min(1.0)
    return ((predicted_rgb - target_rgb).abs() * mask).sum(dim=(1, 2, 3)) / denominator


def stage4_distribution_aware_visible_spatial_semantic_obligation(
    predicted_rgb_values, target_rgb, conditions, config,
):
    contract = validate_stage4_distribution_aware_visible_spatial_semantic_obligation(config)
    if not isinstance(predicted_rgb_values, (list, tuple)) or not predicted_rgb_values:
        raise ValueError("Stage 4 distribution-aware obligation requires decoded RGB predictions")
    weighted_steps = []
    raw_steps = []
    for predicted_rgb in predicted_rgb_values:
        raw = torch.stack([
            per_sample_masked_condition_rgb_loss(
                predicted_rgb, target_rgb, conditions, config, source,
            )
            for source in FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS
        ], dim=1)
        weights = predicted_rgb.new_tensor([
            float(contract["derivedWeights"][identity])
            for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
        ]).view(1, -1)
        raw_steps.append(raw)
        weighted_steps.append(raw * weights)
    raw_tensor = torch.stack(raw_steps, dim=0)
    weighted_tensor = torch.stack(weighted_steps, dim=0)
    per_sample_worst = weighted_tensor.amax(dim=(0, 2))
    per_sample_class_worst = weighted_tensor.amax(dim=0)
    return {
        "stage4DistributionAwareVisibleSpatialSemanticLossTensor": per_sample_worst.amax(),
        "stage4DistributionAwareWorstSampleClassFinalRgbObligation": per_sample_worst.amax(),
        "stage4DistributionAwareMeanSampleWorstClassFinalRgbObligation": per_sample_worst.mean(),
        "stage4DistributionAwareRawPerStepSampleClass": raw_tensor,
        "stage4DistributionAwareWeightedPerSampleClassTensor": per_sample_class_worst,
        "stage4DistributionAwareWorstClassIndexTensor": per_sample_class_worst.argmax(dim=1),
    }


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
    if is_fact_conditioned_semantic_mixture_stage4(config):
        validate_fact_conditioned_semantic_mixture_stage4_diagnostic_manifest_support_contract(
            config
        )
        return route_late_regression_diagnostic_metrics(
            predicted_rgb, target_rgb, conditions, config
        )
    if is_condition_preserving_semantic_renderer_stage4(config):
        validate_condition_preserving_semantic_renderer_stage4_diagnostic_manifest_support_contract(
            config
        )
        return route_late_regression_diagnostic_metrics(
            predicted_rgb, target_rgb, conditions, config
        )
    if is_v9_stage4_object_semantic_decoded_alignment(config) or is_structure_fact_first_stage4(config):
        if is_structure_fact_first_stage4(config):
            validate_structure_fact_first_stage4_diagnostic_manifest_support_contract(config)
        else:
            validate_v9_stage4_diagnostic_manifest_support_contract(config)
        return route_late_regression_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config)
    validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    return {
        **object_semantic_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config),
        **route_late_regression_diagnostic_metrics(predicted_rgb, target_rgb, conditions, config),
    }


def validate_condition_preserving_semantic_renderer_stage4_diagnostic_manifest_support_contract(
    config,
):
    smoke_active = (
        resolve_stage_mode(config).mode_id
        == "condition_preserving_semantic_renderer_stage4_smoke"
    )
    contract = config.get("training", {}).get("stage4FailureDiagnostics", {})
    expected_contract_fields = {
        "enabled", "status", "semanticRendererDiagnostics",
        "routeLateRegressionDiagnostics", "reviewThresholdsModified",
        "failedPreviewPixelsUsedAsTrainingTargets", "executionValuesSelected",
        "trainingConfigApplied", "checkpointFileReadAuthorized", "gpuUseAuthorized",
        "trainingAuthorized",
    }
    if set(contract) != expected_contract_fields:
        raise ValueError(
            "Stage 4 semantic renderer diagnostic contract contains missing or unknown fields"
        )
    semantic_contract = contract.get("semanticRendererDiagnostics", {})
    route_contract = contract.get("routeLateRegressionDiagnostics", {})
    if set(semantic_contract) != {
        "channels", "measurements", "gradientTarget", "manifestFields",
        "changesTrainingWeightsNow",
    }:
        raise ValueError("Stage 4 semantic renderer diagnostic registry contains unknown fields")
    if (
        contract.get("enabled") is not True
        or contract.get("status")
        != CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_STATUS
        or semantic_contract.get("channels")
        != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS)
        or semantic_contract.get("measurements")
        != ["independent_loss", "fusion_response", "primary_path_availability"]
        or semantic_contract.get("gradientTarget")
        != CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_GRADIENT_TARGET
        or semantic_contract.get("manifestFields")
        != list(CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)
        or semantic_contract.get("changesTrainingWeightsNow") is not False
    ):
        raise ValueError(
            "Stage 4 semantic renderer diagnostic Manifest support contract is invalid"
        )
    if set(route_contract) != {
        "measurements", "conditionChannel", "requiredBoundarySidesSource",
        "preserveExistingPathLossWeights", "spatialGridSize",
    } or (
        route_contract.get("measurements")
        != list(V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS)
        or route_contract.get("conditionChannel") != "terrain_path_ground"
        or route_contract.get("requiredBoundarySidesSource")
        != "authorizedBoundaryTopology.requiredBoundarySides"
        or route_contract.get("preserveExistingPathLossWeights") is not True
        or route_contract.get("spatialGridSize") != 4
    ):
        raise ValueError("Stage 4 semantic renderer route diagnostic contract is invalid")
    for key in (
        "reviewThresholdsModified", "failedPreviewPixelsUsedAsTrainingTargets",
        "executionValuesSelected",
    ):
        if contract.get(key) is not False:
            raise ValueError(f"Stage 4 semantic renderer diagnostic boundary is invalid: {key}")
    for key in (
        "trainingConfigApplied", "checkpointFileReadAuthorized",
        "gpuUseAuthorized", "trainingAuthorized",
    ):
        if contract.get(key) is not smoke_active:
            raise ValueError(f"Stage 4 semantic renderer diagnostic activation is invalid: {key}")
    return {
        "status": (
            "stage4_condition_preserving_semantic_renderer_diagnostic_manifest_contract_valid_active_smoke"
            if smoke_active
            else "stage4_condition_preserving_semantic_renderer_diagnostic_manifest_contract_valid_inactive"
        ),
        "exactFields": list(CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
    }


def validate_fact_conditioned_semantic_mixture_stage4_diagnostic_manifest_support_contract(
    config,
):
    resolved_mode = resolve_stage_mode(config)
    smoke_active = resolved_mode.mode_id in {
        "fact_conditioned_semantic_mixture_stage4_smoke",
        "stage4_global_visual_native_decode_component_smoke",
    }
    formal_stage_active = resolved_mode.mode_id in {
        "fact_conditioned_semantic_mixture_stage0_full_training",
        "fact_conditioned_semantic_mixture_stage1_full_training",
        "fact_conditioned_semantic_mixture_stage2_full_training",
    }
    execution_active = smoke_active or formal_stage_active
    contract = config.get("training", {}).get("stage4FailureDiagnostics", {})
    expected_contract_fields = {
        "enabled", "status", "semanticMixtureDiagnostics",
        "routeLateRegressionDiagnostics", "reviewThresholdsModified",
        "failedPreviewPixelsUsedAsTrainingTargets", "executionValuesSelected",
        "trainingConfigApplied", "checkpointFileReadAuthorized", "gpuUseAuthorized",
        "trainingAuthorized",
    }
    if set(contract) != expected_contract_fields:
        raise ValueError(
            "Stage 4 fact-conditioned semantic mixture diagnostic contract contains "
            "missing or unknown fields"
        )
    semantic_contract = contract.get("semanticMixtureDiagnostics", {})
    route_contract = contract.get("routeLateRegressionDiagnostics", {})
    if set(semantic_contract) != {
        "identities", "sourceConditionChannels", "measurements", "gradientTarget",
        "manifestFields", "changesTrainingWeightsNow",
    }:
        raise ValueError(
            "Stage 4 fact-conditioned semantic mixture diagnostic registry contains "
            "unknown fields"
        )
    if (
        contract.get("enabled") is not True
        or contract.get("status")
        != (
            "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_smoke"
            if smoke_active else
            "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_full_training"
            if formal_stage_active
            else "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
        )
        or semantic_contract.get("identities")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
        or semantic_contract.get("sourceConditionChannels")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS)
        or semantic_contract.get("measurements")
        != [
            "participation_bce", "contribution_abs_mean",
            "gated_contribution_abs_mean", "counterfactual_rgb_mae",
            "final_typed_rgb_mae", "final_response",
        ]
        or semantic_contract.get("gradientTarget")
        != "matching_fact_conditioned_semantic_mixture_private_expert_contributions"
        or semantic_contract.get("manifestFields")
        != list(FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS)
        or semantic_contract.get("changesTrainingWeightsNow") is not False
    ):
        raise ValueError(
            "Stage 4 fact-conditioned semantic mixture diagnostic Manifest support "
            "contract is invalid"
        )
    if set(route_contract) != {
        "measurements", "conditionChannel", "requiredBoundarySidesSource",
        "preserveExistingPathLossWeights", "spatialGridSize",
    } or (
        route_contract.get("measurements")
        != list(V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS)
        or route_contract.get("conditionChannel") != "terrain_path_ground"
        or route_contract.get("requiredBoundarySidesSource")
        != "authorizedBoundaryTopology.requiredBoundarySides"
        or route_contract.get("preserveExistingPathLossWeights") is not True
        or route_contract.get("spatialGridSize") != 4
    ):
        raise ValueError(
            "Stage 4 fact-conditioned semantic mixture route diagnostic contract is invalid"
        )
    for key in (
        "reviewThresholdsModified", "failedPreviewPixelsUsedAsTrainingTargets",
        "executionValuesSelected",
    ):
        if contract.get(key) is not False:
            raise ValueError(
                f"Stage 4 fact-conditioned semantic mixture diagnostic boundary is invalid: {key}"
            )
    for key in (
        "trainingConfigApplied", "checkpointFileReadAuthorized",
        "gpuUseAuthorized", "trainingAuthorized",
    ):
        if contract.get(key) is not execution_active:
            raise ValueError(
                f"Stage 4 fact-conditioned semantic mixture diagnostic activation is invalid: {key}"
            )
    return {
        "status": (
            "stage4_fact_conditioned_semantic_mixture_diagnostic_manifest_contract_valid_active_smoke"
            if smoke_active else
            "stage4_fact_conditioned_semantic_mixture_diagnostic_manifest_contract_valid_active_full_training"
            if formal_stage_active
            else "stage4_fact_conditioned_semantic_mixture_diagnostic_manifest_contract_valid_inactive"
        ),
        "exactFields": list(FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS),
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


def validate_structure_fact_first_stage4_diagnostic_manifest_support_contract(config):
    contract = config.get("training", {}).get("stage4FailureDiagnostics", {})
    object_contract = contract.get("objectSemanticDiagnostics", {})
    route_contract = contract.get("routeLateRegressionDiagnostics", {})
    if (
        contract.get("enabled") is not True
        or contract.get("status") != "structure_fact_first_diagnostic_manifest_supported_inactive"
        or object_contract.get("channels") != list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS)
        or object_contract.get("measurements") != list(V7_R5_STAGE4_OBJECT_DIAGNOSTIC_MEASUREMENTS)
        or object_contract.get("gradientTarget") != "matching_structure_fact_independent_typed_head_output"
        or object_contract.get("changesTrainingWeightsNow") is not False
        or route_contract.get("measurements") != list(V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS)
        or route_contract.get("conditionChannel") != "terrain_path_ground"
        or route_contract.get("requiredBoundarySidesSource") != "authorizedBoundaryTopology.requiredBoundarySides"
        or route_contract.get("preserveExistingPathLossWeights") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first diagnostic Manifest support contract is invalid")
    for key in (
        "reviewThresholdsModified", "failedPreviewPixelsUsedAsTrainingTargets",
        "executionValuesSelected", "trainingConfigApplied", "checkpointFileReadAuthorized",
        "gpuUseAuthorized", "trainingAuthorized",
    ):
        if contract.get(key) is not False:
            raise ValueError(f"Stage 4 structure-fact-first diagnostic boundary is invalid: {key}")
    return {
        "status": "stage4_structure_fact_first_diagnostic_manifest_contract_valid_inactive",
        "exactFields": list(STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
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


def evaluate_deterministic_rollout_rgb_quality_v7(
    model,
    dataset,
    diffusion,
    latent_normalization,
    device,
    seed,
    config,
    preview_output_dir=None,
    epoch_number=None,
    *,
    force_checkpoint_bound_preview=False,
):
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
    per_class_luminance_totals = {
        identity: 0.0 for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    }
    per_class_luminance_weighted_total = 0.0
    worst_sample_class_luminance_values = []
    worst_sample_class_luminance_per_class_values = {
        identity: [] for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    }
    reference_feature_structure_totals = {
        identity: 0.0 for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    }
    reference_feature_structure_weighted_total = 0.0
    reference_feature_structure_per_class_values = {
        identity: [] for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
    }
    per_class_luminance_active = config.get("training", {}).get(
        "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation", {}
    ).get("status") == "training_loss_active_owner_authorized"
    worst_sample_class_luminance_active = config.get("training", {}).get(
        "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation", {}
    ).get("status") == "training_loss_active_owner_authorized"
    per_class_worst_sample_luminance_active = config.get("training", {}).get(
        "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation", {}
    ).get("status") == "training_loss_active_owner_authorized"
    epoch_complete_per_class_luminance_active = config.get("training", {}).get(
        "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
        {},
    ).get("status") == "training_loss_active_owner_authorized"
    epoch_complete_validation_ledger = (
        stage4_epoch_complete_per_class_selection_ledger(
            config, "validation", sample_count * seed_count,
        )
        if (
            epoch_complete_per_class_luminance_active
            and not force_checkpoint_bound_preview
        )
        else None
    )
    reference_feature_structure_active = config.get("training", {}).get(
        "stage4PerClassFinalVisibleReferenceFeatureStructureObligation", {}
    ).get("status") == "training_loss_active_owner_authorized"
    per_class_worst_reference_feature_active = config.get("training", {}).get(
        "stage4PerClassWorstSampleReferenceFeatureStructureObligation", {}
    ).get("status") == "training_loss_active_owner_authorized"
    epoch_complete_reference_feature_active = config.get("training", {}).get(
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
        {},
    ).get("status") == "training_loss_active_owner_authorized"
    epoch_complete_reference_feature_validation_ledger = (
        stage4_epoch_complete_per_class_selection_ledger(
            config,
            "validation",
            sample_count * seed_count,
            objective_identity="reference_feature_structure",
        )
        if (
            epoch_complete_reference_feature_active
            and not force_checkpoint_bound_preview
        )
        else None
    )
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
                if per_class_luminance_active:
                    per_class_luminance = (
                        stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses(
                            predicted_rgb, target_rgb, conditions, config,
                        )
                    )
                    rollout_weight = float(
                        config["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"]
                    )
                    per_class_luminance_weighted_total += float(
                        per_class_luminance["weightedTotalTensor"]
                    ) * rollout_weight
                    for identity, value in per_class_luminance["perClassLossTensors"].items():
                        per_class_luminance_totals[identity] += float(value)
                    if worst_sample_class_luminance_active:
                        worst_sample_class = (
                            stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                                predicted_rgb, target_rgb, conditions, config,
                            )
                        )
                        worst_sample_class_luminance_values.extend(
                            float(value)
                            for value in worst_sample_class[
                                "weightedPerSampleClassTensors"
                            ].reshape(-1)
                        )
                        for class_index, identity in enumerate(
                            FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
                        ):
                            worst_sample_class_luminance_per_class_values[
                                identity
                            ].extend(
                                float(value)
                                for value in worst_sample_class[
                                    "weightedPerSampleClassTensors"
                                ][:, class_index]
                            )
                        if epoch_complete_validation_ledger is not None:
                            stage4_collect_epoch_complete_per_class_selection_scores(
                                epoch_complete_validation_ledger,
                                worst_sample_class["weightedPerSampleClassTensors"],
                                [row["sampleId"]],
                                config,
                                seed_indices=[seed_index],
                            )
                if reference_feature_structure_active:
                    reference_feature_structure = (
                        stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                            model.autoencoder, predicted_rgb, target_rgb, conditions, config,
                        )
                    )
                    rollout_weight = float(
                        config["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"]
                    )
                    reference_feature_structure_weighted_total += float(
                        reference_feature_structure["weightedTotalTensor"]
                    ) * rollout_weight
                    for identity, value in reference_feature_structure[
                        "perClassLossTensors"
                    ].items():
                        reference_feature_structure_totals[identity] += float(value)
                    for class_index, identity in enumerate(
                        FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
                    ):
                        reference_feature_structure_per_class_values[identity].extend(
                            float(value)
                            for value in reference_feature_structure[
                                "perSampleClassTensors"
                            ][:, class_index]
                        )
                    if epoch_complete_reference_feature_validation_ledger is not None:
                        reference_feature_source = config["training"][
                            "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"
                        ]["sourceContracts"]
                        weighted_reference_feature_tensor = torch.stack(
                            [
                                reference_feature_structure["perSampleClassTensors"][:, class_index]
                                * float(reference_feature_source["derivedClassWeights"][identity])
                                for class_index, identity in enumerate(
                                    FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
                                )
                            ],
                            dim=1,
                        )
                        stage4_collect_epoch_complete_per_class_selection_scores(
                            epoch_complete_reference_feature_validation_ledger,
                            weighted_reference_feature_tensor,
                            [row["sampleId"]],
                            config,
                            seed_indices=[seed_index],
                            objective_identity="reference_feature_structure",
                        )
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
                if index == 0 and seed_index == 0 and (
                    should_save_epoch_preview(config, epoch_number)
                    or force_checkpoint_bound_preview
                ):
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
    if per_class_luminance_active:
        checkpoint_obligation = per_class_luminance_weighted_total / trajectory_count
        result[
            "rolloutPerClassFinalVisibleLuminanceStructureCheckpointObligation"
        ] = checkpoint_obligation
        if worst_sample_class_luminance_active:
            if not worst_sample_class_luminance_values:
                raise ValueError("Stage 4 worst sample-class checkpoint evidence is empty")
            if per_class_worst_sample_luminance_active:
                if any(
                    not values
                    for values in worst_sample_class_luminance_per_class_values.values()
                ):
                    raise ValueError(
                        "Stage 4 per-class worst-sample luminance checkpoint evidence is empty"
                    )
                if epoch_complete_validation_ledger is not None:
                    epoch_complete_checkpoint = (
                        stage4_finalize_epoch_complete_per_class_selection(
                            epoch_complete_validation_ledger, config,
                        )
                    )
                    worst_checkpoint_obligation = epoch_complete_checkpoint[
                        "checkpointQualificationScore"
                    ]
                    result[
                        "rolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections"
                    ] = epoch_complete_checkpoint["perClassSelections"]
                    result[
                        "rolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount"
                    ] = epoch_complete_checkpoint["identityCount"]
                else:
                    worst_checkpoint_obligation = sum(
                        max(worst_sample_class_luminance_per_class_values[identity])
                        for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
                    ) * float(
                        config["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"]
                    )
                result[
                    "rolloutPerClassWorstSampleFinalVisibleLuminanceStructureCheckpointObligation"
                ] = worst_checkpoint_obligation
            else:
                worst_checkpoint_obligation = (
                    max(worst_sample_class_luminance_values)
                    * float(config["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"])
                )
            result[
                "rolloutWorstSampleClassReferenceLuminanceCheckpointObligation"
            ] = worst_checkpoint_obligation
            result["rolloutRgbQualityScore"] += worst_checkpoint_obligation
        else:
            result["rolloutRgbQualityScore"] += checkpoint_obligation
        for identity, total in per_class_luminance_totals.items():
            result[
                f"rollout{upper_camel(identity)}FinalVisibleMultiscaleLuminanceStructureLoss"
            ] = total / trajectory_count
    if reference_feature_structure_active:
        checkpoint_obligation = (
            reference_feature_structure_weighted_total / trajectory_count
        )
        result[
            "rolloutPerClassFinalVisibleReferenceFeatureStructureCheckpointObligation"
        ] = checkpoint_obligation
        if per_class_worst_reference_feature_active:
            per_class_worst_contract = (
                validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
                    config
                )
            )
            source = per_class_worst_contract["sourceContracts"]
            if epoch_complete_reference_feature_validation_ledger is not None:
                epoch_complete_reference_feature_checkpoint = (
                    stage4_finalize_epoch_complete_per_class_selection(
                        epoch_complete_reference_feature_validation_ledger,
                        config,
                        objective_identity="reference_feature_structure",
                    )
                )
                per_class_worst_checkpoint = (
                    epoch_complete_reference_feature_checkpoint[
                        "checkpointQualificationScore"
                    ]
                )
                result[
                    "rolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointSelections"
                ] = epoch_complete_reference_feature_checkpoint["perClassSelections"]
                result[
                    "rolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointIdentityCount"
                ] = epoch_complete_reference_feature_checkpoint["identityCount"]
            else:
                per_class_worst_checkpoint = sum(
                    max(reference_feature_structure_per_class_values[identity])
                    * float(source["derivedClassWeights"][identity])
                    for identity in FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:]
                ) * float(source["rolloutWeight"])
            result[
                "rolloutPerClassWorstSampleReferenceFeatureStructureCheckpointObligation"
            ] = per_class_worst_checkpoint
            result["rolloutRgbQualityScore"] += per_class_worst_checkpoint
        else:
            result["rolloutRgbQualityScore"] += checkpoint_obligation
        for identity, total in reference_feature_structure_totals.items():
            result[
                f"rollout{upper_camel(identity)}FinalVisibleReferenceFeatureStructureLoss"
            ] = total / trajectory_count
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


def should_reproduce_stage4_fixed_epoch_preview(config, epoch_number):
    return uses_stage4_unified_preview_sampling_contract(config) and should_save_epoch_preview(config, epoch_number)


def validate_stage4_fixed_epoch_preview_reproduction(source_preview, repeated_preview, epoch_number):
    if not isinstance(source_preview, dict):
        raise ValueError("Stage4 fixed Epoch preview artifact is missing")
    reproduction = {
        "schemaVersion": "stage4-fixed-epoch-preview-reproduction-v1",
        "status": "fixed_epoch_preview_reproduced_exactly",
        "epoch": int(epoch_number),
        "scheduled": True,
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
    return reproduction


def build_stage4_fixed_epoch_preview_skip_record(rollout_validation, epoch_number):
    if "previewArtifact" in rollout_validation:
        raise ValueError("Stage4 non-preview Epoch emitted an unexpected preview artifact")
    return {
        "schemaVersion": "stage4-fixed-epoch-preview-reproduction-v1",
        "status": "fixed_epoch_preview_reproduction_skipped_not_scheduled",
        "epoch": int(epoch_number),
        "scheduled": False,
    }


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


def is_structure_fact_first_stage4(config):
    return config.get("denoiserArchitecture") == "stage4_structure_fact_first_dual_stage_generator_v1"


def is_condition_preserving_semantic_renderer_stage4(config):
    return config.get("denoiserArchitecture") == "stage4_condition_preserving_semantic_renderer_v1"


def is_fact_conditioned_semantic_mixture_stage4(config):
    return config.get("denoiserArchitecture") == "stage4_fact_conditioned_semantic_mixture_decoder_v1"


def is_registered_stage_control_config(config):
    status = str(config.get("training", {}).get("trainingAuthorizationStatus", ""))
    return status in FORMAL_MODE_REGISTRY.snapshot()


def uses_stage4_unified_preview_sampling_contract(config):
    contract = config.get("training", {}).get("stage4UnifiedTrainingPreviewSamplingContract", {})
    try:
        execution_grant = resolve_stage_execution_grant(config)
    except ValueError:
        if is_registered_stage_control_config(config):
            raise
        return False
    return (
        execution_grant.preview_constraints.get("enabled") is True
        and contract.get("enabled") is True
        and contract.get("status") == "active_owner_authorized_single_execution"
        and contract.get("samplingFunction") == "evaluate_deterministic_rollout_rgb_quality_v7"
        and contract.get("checkpointPreviewIdentityGate") == "byte_exact_best_epoch_reproduction"
    )


def uses_registered_v7_capacity_dataset(config):
    return (
        is_v7(config)
        or is_v8_stage4_decoded_alignment(config)
        or is_v9_stage4_object_semantic_decoded_alignment(config)
        or is_structure_fact_first_stage4(config)
        or is_condition_preserving_semantic_renderer_stage4(config)
        or is_fact_conditioned_semantic_mixture_stage4(config)
    )


def uses_v7_rollout_validation(config):
    return (
        is_v7(config)
        or is_v8_stage4_decoded_alignment(config)
        or is_v9_stage4_object_semantic_decoded_alignment(config)
        or is_structure_fact_first_stage4(config)
        or is_condition_preserving_semantic_renderer_stage4(config)
        or is_fact_conditioned_semantic_mixture_stage4(config)
    )


def conditional_dataset_selection_contract(config):
    return (
        "registered_v7_capacity_contribution_v1"
        if uses_registered_v7_capacity_dataset(config)
        else "current_condition_identity_v1"
    )


def is_v6_or_later(config):
    return (
        is_v6(config)
        or is_v7(config)
        or is_v8_stage4_decoded_alignment(config)
        or is_v9_stage4_object_semantic_decoded_alignment(config)
        or is_structure_fact_first_stage4(config)
        or is_condition_preserving_semantic_renderer_stage4(config)
        or is_fact_conditioned_semantic_mixture_stage4(config)
    )


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


STAGE4_DISTRIBUTION_AWARE_INTERNAL_TENSOR_FIELDS = {
    "stage4DistributionAwareRawPerStepSampleClass": (3, -1),
    "stage4DistributionAwareWeightedPerSampleClassTensor": (2, -1),
    "stage4DistributionAwareWorstClassIndexTensor": (1, None),
}


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
        if key in STAGE4_DISTRIBUTION_AWARE_INTERNAL_TENSOR_FIELDS:
            expected_ndim, class_axis = STAGE4_DISTRIBUTION_AWARE_INTERNAL_TENSOR_FIELDS[key]
            if not isinstance(value, torch.Tensor) or value.ndim != expected_ndim:
                raise ValueError(
                    f"condition evidence internal distribution ledger is invalid: {key}"
                )
            if (
                class_axis is not None
                and value.shape[class_axis]
                != len(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
            ):
                raise ValueError(
                    f"condition evidence internal distribution class axis is invalid: {key}"
                )
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
    if not (
        is_v9_stage4_object_semantic_decoded_alignment(config)
        or is_structure_fact_first_stage4(config)
        or is_fact_conditioned_semantic_mixture_stage4(config)
    ):
        return row
    contract_key = (
        "stage4FactConditionedSemanticMixture"
        if is_fact_conditioned_semantic_mixture_stage4(config)
        else
        "stage4StructureFactFirstDualStage"
        if is_structure_fact_first_stage4(config)
        else "stage4ObjectSemanticDecoderAlignment"
    )
    registry = config.get("training", {}).get(contract_key, {}).get("diagnosticManifestRegistry", {})
    if int(epoch) not in registry.get("fixedEpochs", []):
        return row
    expected = list(
        fact_conditioned_semantic_mixture_diagnostic_fields(config)
        if is_fact_conditioned_semantic_mixture_stage4(config)
        else STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
    )
    if registry.get("exactFields") != expected or registry.get("exactFieldCount") != len(expected):
        raise ValueError("V9 Stage 4 diagnostic Manifest registry identity changed")
    diagnostic_prefix = (
        "stage4SemanticMixture"
        if is_fact_conditioned_semantic_mixture_stage4(config)
        else "stage4Diagnostic"
    )
    actual = sorted(key for key in train_metrics if key.startswith(diagnostic_prefix))
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


def validate_stage4_conflict_aware_existing_gradient_aggregation(config):
    """Validate the inactive or explicitly Owner-activated aggregation contract."""
    contract = config.get("training", {}).get(
        "stage4ConflictAwareExistingGradientAggregation", {}
    )
    if not contract:
        return None
    expected_classes = list(FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    source = config.get("training", {}).get(
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
        {},
    )
    source_weights = source.get("sourceContracts", {}).get("derivedClassWeights", {})
    expected_fields = {
        "enabled", "status", "contractId", "classOrder", "gradientBoundary",
        "sourceLossContract", "derivedClassWeights", "projection",
        "optimizerBudget", "nonSharedParameters", "checkpointQualification",
        "compatibility", "legalTargets", "evidenceBindings", "activationGate",
    }
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
        "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
        "worldEntryNow",
    }
    status = contract.get("status")
    inactive = status == "cpu_support_verified_inactive"
    active = status == "training_paradigm_active_owner_authorized"
    expected_smoke_active_gates = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow",
    }
    expected_formal_active_gates = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    }
    gate = contract.get("activationGate", {})
    gate_valid = (
        inactive and not any(gate.values())
    ) or (
        active
        and {
            key for key, value in gate.items() if value is True
        } in (expected_smoke_active_gates, expected_formal_active_gates)
        and all(isinstance(value, bool) for value in gate.values())
    )
    if (
        set(contract) != expected_fields
        or contract.get("enabled") is not True
        or not (inactive or active)
        or contract.get("contractId")
        != STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID
        or contract.get("classOrder") != expected_classes
        or contract.get("gradientBoundary") != {
            "parameterGroup": "current_denoiser_shared_final_output_path",
            "scope": "shared_parameters_only",
            "nonSharedParametersUseExistingGradient": True,
        }
        or contract.get("sourceLossContract") != {
            "contractId": STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID,
            "lossValuesChanged": False,
            "lossWeightsChanged": False,
        }
        or contract.get("derivedClassWeights") != source_weights
        or list(source_weights) != expected_classes
        or contract.get("projection") != {
            "condition": "strict_dot_product_less_than_zero",
            "operation": "remove_current_gradient_component_along_conflicting_original_weighted_gradient",
            "referenceGradient": "original_existing_weighted_gradient_in_formal_class_order",
            "numericTolerance": None,
            "nonNegativeDotProductBehavior": "bitwise_unchanged",
            "finiteNonZeroGradientsRequired": True,
        }
        or contract.get("optimizerBudget") != {
            "existingOptimizerStepsPreserved": True,
            "additionalOptimizerSteps": 0,
            "additionalReplayPasses": 0,
        }
        or contract.get("nonSharedParameters")
        != "retain_existing_formal_weighted_gradient_sum_unchanged"
        or contract.get("checkpointQualification") != {
            "lossValuesChanged": False,
            "validationMetricsChanged": False,
            "selectionContractChanged": False,
        }
        or contract.get("compatibility") != {
            "modelStructureChanged": False,
            "datasetOrSplitChanged": False,
            "conditionChannelOrderChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        }
        or contract.get("legalTargets") != {
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        }
        or contract.get("evidenceBindings")
        != STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_EVIDENCE_BINDINGS
        or set(contract.get("activationGate", {})) != gate_fields
        or not gate_valid
    ):
        raise ValueError("Stage 4 conflict-aware gradient aggregation contract changed")
    return contract


def validate_stage4_controlled_structure_three_arm_contract(config):
    """Validate the Owner-bounded inactive, Smoke-active, or formal structure arm."""
    training = config.get("training", {})
    contract = training.get("stage4ControlledStructureThreeArm", {})
    arm = config.get("stage4ControlledStructureArm")
    expected_fields = {
        "contractId", "status", "armId", "sourceThreeArmContract",
        "architecture", "conditionChannels", "latentChannels",
        "denoiserBaseChannels", "activationGate",
    }
    gate_fields = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage1Now",
        "stage2Now", "formalInferenceNow", "checkpointPromotionNow",
        "runtimeFrameNow", "worldEntryNow",
    }
    smoke_gates = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow",
    }
    formal_gates = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    }
    gate = contract.get("activationGate", {})
    status = contract.get("status")
    active_keys = {key for key, value in gate.items() if value is True}
    expected_width = 128 if arm == "capacity_only_base_width_64_to_existing_level1_128" else 64
    if (
        set(contract) != expected_fields
        or contract.get("contractId")
        != "stage4_controlled_structure_three_arm_cpu_inactive_support_v1"
        or not fact_conditioned_semantic_mixture_smoke_supports_controlled_structure_arm(arm or "")
        or contract.get("armId") != arm
        or contract.get("architecture")
        != "stage4_fact_conditioned_semantic_mixture_decoder_v1"
        or contract.get("conditionChannels") != 23
        or contract.get("latentChannels") != 12
        or contract.get("denoiserBaseChannels") != expected_width
        or set(gate) != gate_fields
        or not all(isinstance(value, bool) for value in gate.values())
        or not (
            (status == "cpu_support_verified_inactive" and not active_keys)
            or (
                status == "structure_active_owner_authorized"
                and active_keys == smoke_gates
                and training.get("trainingAuthorizationStatus")
                == FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS
            )
            or (
                status == "structure_active_owner_authorized"
                and arm in {
                    "condition_fusion_only_final_direct_residual_23_64_12",
                    "capacity_only_base_width_64_to_existing_level1_128",
                }
                and active_keys == formal_gates
                and training.get("trainingAuthorizationStatus") in {
                    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
                    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
                    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
                }
            )
        )
    ):
        raise ValueError("Stage 4 controlled structure arm contract changed")
    return contract


def stage4_conflict_aware_existing_gradient_aggregation(per_class_gradients, config):
    """Project only strictly conflicting weighted gradients on the shared final path."""
    contract = validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    if contract is None:
        raise ValueError("Stage 4 conflict-aware gradient aggregation contract missing")
    class_order = tuple(contract["classOrder"])
    if tuple(per_class_gradients) != class_order:
        raise ValueError("Stage 4 conflict-aware gradient class order changed")
    parameter_count = None
    originals = {}
    weights = contract["derivedClassWeights"]
    for identity in class_order:
        tensors = tuple(per_class_gradients[identity])
        if not tensors:
            raise ValueError("Stage 4 conflict-aware gradient parameter group empty")
        if parameter_count is None:
            parameter_count = len(tensors)
        if len(tensors) != parameter_count:
            raise ValueError("Stage 4 conflict-aware gradient parameter count changed")
        weighted = tuple(tensor * float(weights[identity]) for tensor in tensors)
        if any(not bool(torch.isfinite(tensor).all()) for tensor in weighted):
            raise ValueError("Stage 4 conflict-aware gradient contains NaN or Inf")
        norm_squared = sum((tensor * tensor).sum() for tensor in weighted)
        if not bool(torch.isfinite(norm_squared)) or float(norm_squared.detach()) <= 0.0:
            raise ValueError("Stage 4 conflict-aware gradient must be finite and nonzero")
        originals[identity] = weighted
    reference_shapes = tuple(tensor.shape for tensor in originals[class_order[0]])
    if any(
        tuple(tensor.shape for tensor in originals[identity]) != reference_shapes
        for identity in class_order[1:]
    ):
        raise ValueError("Stage 4 conflict-aware gradient parameter shapes changed")
    projected = {}
    interactions = []
    for identity in class_order:
        current = tuple(tensor.clone() for tensor in originals[identity])
        for other_identity in class_order:
            if other_identity == identity:
                continue
            reference = originals[other_identity]
            dot = sum((left * right).sum() for left, right in zip(current, reference))
            denominator = sum((tensor * tensor).sum() for tensor in reference)
            if not bool(torch.isfinite(dot)) or not bool(torch.isfinite(denominator)):
                raise ValueError("Stage 4 conflict-aware projection scalar is nonfinite")
            conflicting = float(dot.detach()) < 0.0
            if conflicting:
                coefficient = dot / denominator
                current = tuple(
                    left - coefficient * right
                    for left, right in zip(current, reference)
                )
            interactions.append({
                "currentClass": identity,
                "referenceClass": other_identity,
                "dotProduct": float(dot.detach()),
                "projected": conflicting,
            })
        projected[identity] = current
    aggregated = tuple(
        sum(projected[identity][parameter_index] for identity in class_order)
        for parameter_index in range(parameter_count)
    )
    if any(not bool(torch.isfinite(tensor).all()) for tensor in aggregated):
        raise ValueError("Stage 4 conflict-aware aggregate is nonfinite")
    return {
        "status": contract["status"],
        "classOrder": list(class_order),
        "originalWeightedGradients": originals,
        "projectedWeightedGradients": projected,
        "aggregatedSharedGradients": aggregated,
        "interactions": interactions,
        "additionalOptimizerSteps": 0,
        "additionalReplayPasses": 0,
        "freeNumericalToleranceUsed": False,
    }


def stage4_apply_conflict_aware_existing_gradient_replacement(
    shared_parameters, aggregation_result,
):
    """Replace only the already-backpropagated four-class shared gradient sum."""
    parameters = tuple(shared_parameters)
    originals = aggregation_result.get("originalWeightedGradients", {})
    class_order = tuple(aggregation_result.get("classOrder", ()))
    replacement = tuple(aggregation_result.get("aggregatedSharedGradients", ()))
    if (
        not parameters
        or not class_order
        or tuple(originals) != class_order
        or len(replacement) != len(parameters)
        or any(len(originals[identity]) != len(parameters) for identity in class_order)
    ):
        raise ValueError("Stage 4 conflict-aware replacement identity changed")
    for parameter_index, parameter in enumerate(parameters):
        if parameter.grad is None:
            raise ValueError(
                "Stage 4 conflict-aware shared parameter gradient is missing"
            )
        original_sum = sum(
            originals[identity][parameter_index] for identity in class_order
        )
        parameter.grad.add_(replacement[parameter_index] - original_sum)
        if not bool(torch.isfinite(parameter.grad).all()):
            raise ValueError("Stage 4 conflict-aware replaced gradient is nonfinite")
    return {
        "sharedParameterCount": len(parameters),
        "otherLossGradientsPreserved": True,
        "nonSharedParametersTouched": False,
        "additionalBackwardCalls": 0,
        "additionalOptimizerSteps": 0,
    }


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


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
