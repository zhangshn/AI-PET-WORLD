from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Iterable


V7_R5_STAGE3_SMOKE_STATUS = "owner_authorized_v7_r5_single_sample_overfit_smoke"
V7_R5_STAGE3_COVERAGE_SMOKE_STATUS = (
    "owner_authorized_v7_r5_stage3_coverage_convergence_single_sample_gpu_smoke"
)
V7_R5_STAGE4_PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_full_training_preflight_only"
V7_R5_STAGE4_FULL_TRAINING_STATUS = "owner_authorized_v7_r5_stage4_full_training"
V7_R5_STAGE4_BOUNDED_PREFLIGHT_STATUS = (
    "owner_authorized_v7_r5_stage4_bounded_repair_smoke_preflight_only"
)
V7_R5_STAGE4_BOUNDED_SMOKE_STATUS = (
    "owner_authorized_v7_r5_stage4_bounded_repair_single_sample_gpu_smoke"
)
V8_STAGE4_INACTIVE_STATUS = "v8_stage4_shared_readout_training_loss_supported_inactive"
V8_STAGE4_PREFLIGHT_STATUS = "owner_authorized_v8_stage4_single_sample_smoke_preflight_only"
V8_STAGE4_SMOKE_STATUS = "owner_authorized_v8_stage4_single_sample_gpu_smoke"
V9_STAGE4_INACTIVE_STATUS = "v9_stage4_object_semantic_decoder_alignment_cpu_supported_inactive"
V9_STAGE4_SMOKE_STATUS = "owner_authorized_v9_stage4_single_sample_gpu_smoke"
V9_STAGE4_UNIFIED_PREVIEW_SMOKE_STATUS = (
    "owner_authorized_v9_stage4_unified_preview_pipeline_single_sample_gpu_smoke"
)
V9_STAGE4_VALIDATION_KERNEL_SMOKE_STATUS = (
    "owner_authorized_v9_stage4_validation_kernel_single_sample_gpu_smoke"
)
STRUCTURE_FACT_FIRST_STAGE4_INACTIVE_STATUS = (
    "stage4_structure_fact_first_dual_stage_cpu_supported_inactive"
)
STRUCTURE_FACT_FIRST_STAGE4_PHASE0_STATUS = (
    "owner_authorized_stage4_structure_fact_first_phase0_engineering"
)
STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS = (
    "owner_authorized_stage4_structure_fact_first_single_sample_gpu_smoke"
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_INACTIVE_STATUS = (
    "stage4_condition_preserving_semantic_renderer_cpu_supported_inactive"
)
CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_SMOKE_STATUS = (
    "owner_authorized_stage4_condition_preserving_semantic_renderer_single_sample_gpu_smoke"
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS = (
    "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
)
CONTROLLED_STRUCTURE_BASELINE_STAGE4_INACTIVE_STATUS = (
    "stage4_controlled_structure_baseline_cpu_supported_inactive"
)
CONTROLLED_STRUCTURE_FUSION_STAGE4_INACTIVE_STATUS = (
    "stage4_controlled_structure_condition_fusion_cpu_supported_inactive"
)
CONTROLLED_STRUCTURE_CAPACITY_STAGE4_INACTIVE_STATUS = (
    "stage4_controlled_structure_capacity_cpu_supported_inactive"
)
STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_INACTIVE_STATUS = (
    "stage4_terrain_route_hydrology_component_cpu_supported_inactive"
)
STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_INACTIVE_STATUS = (
    "stage4_per_class_object_semantic_component_cpu_supported_inactive"
)
STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_INACTIVE_STATUS = (
    "stage4_global_visual_native_decode_component_cpu_supported_inactive"
)
STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_SMOKE_STATUS = (
    "owner_authorized_stage4_terrain_route_hydrology_component_single_sample_gpu_smoke"
)
STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_SMOKE_STATUS = (
    "owner_authorized_stage4_per_class_object_semantic_component_single_sample_gpu_smoke"
)
STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_SMOKE_STATUS = (
    "owner_authorized_stage4_global_visual_native_decode_component_single_sample_gpu_smoke"
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS = (
    "owner_authorized_stage4_fact_conditioned_semantic_mixture_single_sample_gpu_smoke"
)
AUTHORITATIVE_SEMANTIC_CARRIER_STAGE4_INACTIVE_STATUS = (
    "stage4_authoritative_semantic_carrier_cpu_supported_inactive"
)
AUTHORITATIVE_SEMANTIC_CARRIER_STAGE4_SMOKE_STATUS = (
    "local_ai_authoritative_semantic_carrier_controlled_smoke_active"
)
AUTHORITATIVE_SEMANTIC_CARRIER_STAGE0_FULL_TRAINING_STATUS = (
    "local_ai_authoritative_semantic_carrier_stage0_full_training_active"
)
POST_DECODE_OBJECT_RGB_STAGE4_SMOKE_STATUS = (
    "local_ai_post_decode_object_rgb_controlled_smoke_active"
)
POST_DECODE_OBJECT_RGB_STAGE0_FULL_TRAINING_STATUS = (
    "local_ai_post_decode_object_rgb_stage0_full_training_active"
)
POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE4_INACTIVE_STATUS = (
    "stage4_post_decode_full_condition_route_object_responsibility_renderer_cpu_supported_inactive"
)
POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE4_SMOKE_STATUS = (
    "local_ai_post_decode_full_condition_responsibility_controlled_smoke_active"
)
POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE0_FULL_TRAINING_STATUS = (
    "local_ai_post_decode_full_condition_responsibility_stage0_full_training_active"
)
DIRECT_CLEAN_LATENT_STAGE4_INACTIVE_STATUS = (
    "stage4_direct_condition_clean_latent_generator_cpu_supported_inactive"
)
DIRECT_CLEAN_LATENT_STAGE4_SMOKE_STATUS = (
    "local_ai_direct_condition_clean_latent_controlled_smoke_active"
)
DIRECT_CLEAN_LATENT_STAGE0_FULL_TRAINING_STATUS = (
    "local_ai_direct_condition_clean_latent_stage0_full_training_active"
)
DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS = (
    "stage4_direct_clean_latent_responsibility_residual_cpu_supported_inactive"
)
DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS = (
    "local_ai_direct_clean_latent_responsibility_residual_controlled_smoke_active"
)
DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_FULL_TRAINING_STATUS = (
    "local_ai_direct_clean_latent_responsibility_residual_stage0_full_training_active"
)
NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS = (
    "stage4_native_condition_encoder_clean_latent_cpu_supported_inactive"
)
NATIVE_CONDITION_ENCODER_STAGE4_SMOKE_STATUS = (
    "local_ai_native_condition_encoder_clean_latent_controlled_smoke_active"
)
NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS = (
    "stage4_native_condition_encoder_responsibility_residual_cpu_supported_inactive"
)
NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS = (
    "local_ai_native_condition_encoder_responsibility_residual_controlled_smoke_active"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_INACTIVE_STATUS = (
    "stage4_native_condition_shared_weight_route_counterfactual_compositor_cpu_supported_inactive"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_SMOKE_STATUS = (
    "local_ai_native_route_counterfactual_compositor_controlled_smoke_active"
)
STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_final_visible_reference_feature_structure_obligation_v1"
)
STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID = (
    "stage4_epoch_worst_sample_class_reference_feature_structure_replay_v1"
)
STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"
)
STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID = (
    "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"
)
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID = (
    "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_"
    "selection_and_checkpoint_identity_v1"
)
STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID = (
    "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_"
    "selection_and_shared_replay_v1"
)
STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID = (
    "stage4_conflict_aware_existing_gradient_aggregation_v1"
)
CONTROLLED_STRUCTURE_SMOKE_ARMS = frozenset({
    "condition_fusion_only_final_direct_residual_23_64_12",
    "capacity_only_base_width_64_to_existing_level1_128",
})
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_OBJECTIVE_CONTRACT_IDS = frozenset({
    STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID,
    STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID,
    STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID,
    STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID,
    STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID,
    STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID,
    STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID,
})
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS = (
    "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage0_full_training"
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS = (
    "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage1_full_training"
)
FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS = (
    "owner_authorized_stage4_fact_conditioned_semantic_mixture_stage2_full_training"
)
SYNTHETIC_EXTENSION_TEST_STATUS = "synthetic_inactive_stage4_extension_contract_test_only"


@dataclass(frozen=True)
class ModeSpec:
    mode_id: str
    authorization_status: str
    architecture: str
    stage: int
    execution_kind: str
    adapter_binding: str
    sample_split: str | None
    active_execution: bool


class ModeRegistry:
    def __init__(self, specs: Iterable[ModeSpec] = ()) -> None:
        self._by_status: dict[str, ModeSpec] = {}
        self._by_mode_id: dict[str, ModeSpec] = {}
        for spec in specs:
            self.register(spec)

    def register(self, spec: ModeSpec) -> None:
        if spec.authorization_status in self._by_status:
            raise ValueError(
                f"duplicate Stage3/Stage4 authorization status: {spec.authorization_status}"
            )
        if spec.mode_id in self._by_mode_id:
            raise ValueError(f"duplicate Stage3/Stage4 mode id: {spec.mode_id}")
        if not spec.adapter_binding.endswith("_adapter"):
            raise ValueError("Mode Registry binding must be a thin adapter identity")
        self._by_status[spec.authorization_status] = spec
        self._by_mode_id[spec.mode_id] = spec

    def resolve(self, authorization_status: str, architecture: str) -> ModeSpec:
        spec = self._by_status.get(authorization_status)
        if spec is None:
            raise ValueError(f"unknown Stage3/Stage4 authorization status: {authorization_status}")
        if spec.architecture != architecture:
            raise ValueError("Stage3/Stage4 mode and architecture are inconsistent")
        return spec

    def resolve_mode_id(self, mode_id: str) -> ModeSpec:
        spec = self._by_mode_id.get(mode_id)
        if spec is None:
            raise ValueError(f"unknown Stage3/Stage4 mode id: {mode_id}")
        return spec

    def snapshot(self):
        return MappingProxyType(dict(self._by_status))


_V7 = "multiscale_condition_unet_v7"
_V8 = "multiscale_condition_unet_v8_stage4_decoded_alignment"
_V9 = "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"
_STRUCTURE_FACT_FIRST = "stage4_structure_fact_first_dual_stage_generator_v1"
_CONDITION_PRESERVING_SEMANTIC_RENDERER = "stage4_condition_preserving_semantic_renderer_v1"
_FACT_CONDITIONED_SEMANTIC_MIXTURE = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
_AUTHORITATIVE_SEMANTIC_CARRIER = "stage4_authoritative_visual_semantic_carrier_decoder_v1"
_POST_DECODE_OBJECT_RGB = "stage4_post_decode_authoritative_object_rgb_compositor_v1"
_POST_DECODE_FULL_CONDITION_RESPONSIBILITY = (
    "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
)
_DIRECT_CLEAN_LATENT = "stage4_direct_condition_clean_latent_generator_v1"
_DIRECT_RESPONSIBILITY_RESIDUAL = (
    "stage4_direct_condition_clean_latent_responsibility_residual_v1"
)
_NATIVE_CONDITION_ENCODER = (
    "stage4_native_condition_encoder_clean_latent_generator_v1"
)
_NATIVE_RESPONSIBILITY_RESIDUAL = (
    "stage4_native_condition_encoder_masked_responsibility_residual_v1"
)
_ROUTE_COUNTERFACTUAL_COMPOSITOR = (
    "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
)


FORMAL_MODE_REGISTRY = ModeRegistry(
    (
        ModeSpec("v7_r5_stage3_smoke", V7_R5_STAGE3_SMOKE_STATUS, _V7, 3, "single_sample_smoke", "legacy_v7_stage3_adapter", "train", True),
        ModeSpec("v7_r5_stage3_coverage_smoke", V7_R5_STAGE3_COVERAGE_SMOKE_STATUS, _V7, 3, "single_sample_smoke", "legacy_v7_stage3_adapter", "train", True),
        ModeSpec("v7_r5_stage4_preflight", V7_R5_STAGE4_PREFLIGHT_STATUS, _V7, 4, "full_training_preflight", "legacy_v7_stage4_adapter", None, False),
        ModeSpec("v7_r5_stage4_full_training", V7_R5_STAGE4_FULL_TRAINING_STATUS, _V7, 4, "full_training", "legacy_v7_stage4_adapter", None, True),
        ModeSpec("v7_r5_stage4_bounded_preflight", V7_R5_STAGE4_BOUNDED_PREFLIGHT_STATUS, _V7, 4, "single_sample_preflight", "legacy_v7_stage4_adapter", "validation", False),
        ModeSpec("v7_r5_stage4_bounded_smoke", V7_R5_STAGE4_BOUNDED_SMOKE_STATUS, _V7, 4, "single_sample_smoke", "legacy_v7_stage4_adapter", "validation", True),
        ModeSpec("v8_stage4_inactive", V8_STAGE4_INACTIVE_STATUS, _V8, 4, "cpu_inactive", "legacy_v8_stage4_adapter", "validation", False),
        ModeSpec("v8_stage4_preflight", V8_STAGE4_PREFLIGHT_STATUS, _V8, 4, "single_sample_preflight", "legacy_v8_stage4_adapter", "validation", False),
        ModeSpec("v8_stage4_smoke", V8_STAGE4_SMOKE_STATUS, _V8, 4, "single_sample_smoke", "legacy_v8_stage4_adapter", "validation", True),
        ModeSpec("v9_stage4_inactive", V9_STAGE4_INACTIVE_STATUS, _V9, 4, "cpu_inactive", "legacy_v9_stage4_adapter", "validation", False),
        ModeSpec("v9_stage4_smoke", V9_STAGE4_SMOKE_STATUS, _V9, 4, "single_sample_smoke", "legacy_v9_stage4_adapter", "validation", True),
        ModeSpec("v9_stage4_unified_preview_smoke", V9_STAGE4_UNIFIED_PREVIEW_SMOKE_STATUS, _V9, 4, "single_sample_smoke", "legacy_v9_stage4_adapter", "validation", True),
        ModeSpec("v9_stage4_validation_kernel_smoke", V9_STAGE4_VALIDATION_KERNEL_SMOKE_STATUS, _V9, 4, "single_sample_smoke", "legacy_v9_stage4_adapter", "validation", True),
        ModeSpec(
            "structure_fact_first_stage4_inactive",
            STRUCTURE_FACT_FIRST_STAGE4_INACTIVE_STATUS,
            _STRUCTURE_FACT_FIRST,
            4,
            "cpu_inactive",
            "structure_fact_first_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "structure_fact_first_stage4_phase0",
            STRUCTURE_FACT_FIRST_STAGE4_PHASE0_STATUS,
            _STRUCTURE_FACT_FIRST,
            4,
            "phase0_engineering",
            "structure_fact_first_phase0_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "structure_fact_first_stage4_smoke",
            STRUCTURE_FACT_FIRST_STAGE4_SMOKE_STATUS,
            _STRUCTURE_FACT_FIRST,
            4,
            "single_sample_smoke",
            "structure_fact_first_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "condition_preserving_semantic_renderer_stage4_inactive",
            CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_INACTIVE_STATUS,
            _CONDITION_PRESERVING_SEMANTIC_RENDERER,
            4,
            "cpu_inactive",
            "condition_preserving_semantic_renderer_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "condition_preserving_semantic_renderer_stage4_smoke",
            CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_SMOKE_STATUS,
            _CONDITION_PRESERVING_SEMANTIC_RENDERER,
            4,
            "single_sample_smoke",
            "condition_preserving_semantic_renderer_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "fact_conditioned_semantic_mixture_stage4_inactive",
            FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "fact_conditioned_semantic_mixture_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "controlled_structure_baseline_stage4_inactive",
            CONTROLLED_STRUCTURE_BASELINE_STAGE4_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "controlled_structure_baseline_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "controlled_structure_fusion_stage4_inactive",
            CONTROLLED_STRUCTURE_FUSION_STAGE4_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "controlled_structure_fusion_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "controlled_structure_capacity_stage4_inactive",
            CONTROLLED_STRUCTURE_CAPACITY_STAGE4_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "controlled_structure_capacity_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "stage4_terrain_route_hydrology_component_inactive",
            STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "stage4_terrain_route_hydrology_component_adapter",
            None,
            False,
        ),
        ModeSpec(
            "stage4_per_class_object_semantic_component_inactive",
            STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "stage4_per_class_object_semantic_component_adapter",
            None,
            False,
        ),
        ModeSpec(
            "stage4_global_visual_native_decode_component_inactive",
            STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_INACTIVE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "cpu_inactive",
            "stage4_global_visual_native_decode_component_adapter",
            None,
            False,
        ),
        ModeSpec(
            "stage4_terrain_route_hydrology_component_smoke",
            STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_SMOKE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "single_sample_smoke",
            "stage4_isolated_responsibility_component_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "stage4_per_class_object_semantic_component_smoke",
            STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_SMOKE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "single_sample_smoke",
            "stage4_isolated_responsibility_component_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "stage4_global_visual_native_decode_component_smoke",
            STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_SMOKE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "single_sample_smoke",
            "stage4_isolated_responsibility_component_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "fact_conditioned_semantic_mixture_stage4_smoke",
            FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            4,
            "single_sample_smoke",
            "fact_conditioned_semantic_mixture_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "authoritative_semantic_carrier_stage4_inactive",
            AUTHORITATIVE_SEMANTIC_CARRIER_STAGE4_INACTIVE_STATUS,
            _AUTHORITATIVE_SEMANTIC_CARRIER,
            4,
            "cpu_inactive",
            "authoritative_semantic_carrier_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "authoritative_semantic_carrier_stage4_smoke",
            AUTHORITATIVE_SEMANTIC_CARRIER_STAGE4_SMOKE_STATUS,
            _AUTHORITATIVE_SEMANTIC_CARRIER,
            4,
            "single_sample_smoke",
            "authoritative_semantic_carrier_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "authoritative_semantic_carrier_stage0_full_training",
            AUTHORITATIVE_SEMANTIC_CARRIER_STAGE0_FULL_TRAINING_STATUS,
            _AUTHORITATIVE_SEMANTIC_CARRIER,
            0,
            "full_training_stage0",
            "authoritative_semantic_carrier_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "post_decode_full_condition_responsibility_stage4_inactive",
            POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE4_INACTIVE_STATUS,
            _POST_DECODE_FULL_CONDITION_RESPONSIBILITY,
            4,
            "cpu_inactive",
            "post_decode_full_condition_responsibility_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "direct_clean_latent_stage4_inactive",
            DIRECT_CLEAN_LATENT_STAGE4_INACTIVE_STATUS,
            _DIRECT_CLEAN_LATENT,
            4,
            "cpu_inactive",
            "direct_clean_latent_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "direct_clean_latent_stage4_smoke",
            DIRECT_CLEAN_LATENT_STAGE4_SMOKE_STATUS,
            _DIRECT_CLEAN_LATENT,
            4,
            "single_sample_smoke",
            "direct_clean_latent_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "direct_clean_latent_stage0_full_training",
            DIRECT_CLEAN_LATENT_STAGE0_FULL_TRAINING_STATUS,
            _DIRECT_CLEAN_LATENT,
            0,
            "full_training_stage0",
            "direct_clean_latent_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "direct_responsibility_residual_stage4_inactive",
            DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS,
            _DIRECT_RESPONSIBILITY_RESIDUAL,
            4,
            "cpu_inactive",
            "direct_responsibility_residual_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "direct_responsibility_residual_stage4_smoke",
            DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS,
            _DIRECT_RESPONSIBILITY_RESIDUAL,
            4,
            "single_sample_smoke",
            "direct_responsibility_residual_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "direct_responsibility_residual_stage0_full_training",
            DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_FULL_TRAINING_STATUS,
            _DIRECT_RESPONSIBILITY_RESIDUAL,
            0,
            "full_training_stage0",
            "direct_responsibility_residual_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "native_condition_encoder_stage4_inactive",
            NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS,
            _NATIVE_CONDITION_ENCODER,
            4,
            "cpu_inactive",
            "native_condition_encoder_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "native_condition_encoder_stage4_smoke",
            NATIVE_CONDITION_ENCODER_STAGE4_SMOKE_STATUS,
            _NATIVE_CONDITION_ENCODER,
            4,
            "single_sample_smoke",
            "native_condition_encoder_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "native_responsibility_residual_stage4_inactive",
            NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS,
            _NATIVE_RESPONSIBILITY_RESIDUAL,
            4,
            "cpu_inactive",
            "native_responsibility_residual_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "native_responsibility_residual_stage4_smoke",
            NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS,
            _NATIVE_RESPONSIBILITY_RESIDUAL,
            4,
            "single_sample_smoke",
            "native_responsibility_residual_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "route_counterfactual_compositor_stage4_inactive",
            ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_INACTIVE_STATUS,
            _ROUTE_COUNTERFACTUAL_COMPOSITOR,
            4,
            "cpu_inactive",
            "route_counterfactual_compositor_stage4_adapter",
            "validation",
            False,
        ),
        ModeSpec(
            "route_counterfactual_compositor_stage4_smoke",
            ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_SMOKE_STATUS,
            _ROUTE_COUNTERFACTUAL_COMPOSITOR,
            4,
            "single_sample_smoke",
            "route_counterfactual_compositor_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "post_decode_full_condition_responsibility_stage4_smoke",
            POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE4_SMOKE_STATUS,
            _POST_DECODE_FULL_CONDITION_RESPONSIBILITY,
            4,
            "single_sample_smoke",
            "post_decode_full_condition_responsibility_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "post_decode_full_condition_responsibility_stage0_full_training",
            POST_DECODE_FULL_CONDITION_RESPONSIBILITY_STAGE0_FULL_TRAINING_STATUS,
            _POST_DECODE_FULL_CONDITION_RESPONSIBILITY,
            0,
            "full_training_stage0",
            "post_decode_full_condition_responsibility_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "post_decode_object_rgb_stage4_smoke",
            POST_DECODE_OBJECT_RGB_STAGE4_SMOKE_STATUS,
            _POST_DECODE_OBJECT_RGB,
            4,
            "single_sample_smoke",
            "post_decode_object_rgb_stage4_smoke_adapter",
            "validation",
            True,
        ),
        ModeSpec(
            "post_decode_object_rgb_stage0_full_training",
            POST_DECODE_OBJECT_RGB_STAGE0_FULL_TRAINING_STATUS,
            _POST_DECODE_OBJECT_RGB,
            0,
            "full_training_stage0",
            "post_decode_object_rgb_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "fact_conditioned_semantic_mixture_stage0_full_training",
            FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            0,
            "full_training_stage0",
            "fact_conditioned_semantic_mixture_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "fact_conditioned_semantic_mixture_stage1_full_training",
            FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            1,
            "full_training_stage1",
            "fact_conditioned_semantic_mixture_full_training_adapter",
            None,
            True,
        ),
        ModeSpec(
            "fact_conditioned_semantic_mixture_stage2_full_training",
            FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
            _FACT_CONDITIONED_SEMANTIC_MIXTURE,
            2,
            "full_training_stage2",
            "fact_conditioned_semantic_mixture_full_training_adapter",
            None,
            True,
        ),
    )
)


def resolve_stage_mode(config) -> ModeSpec:
    training = config.get("training", {})
    return FORMAL_MODE_REGISTRY.resolve(
        str(training.get("trainingAuthorizationStatus")),
        str(config.get("denoiserArchitecture")),
    )


def fact_conditioned_semantic_mixture_smoke_supports_objective(contract_id: str) -> bool:
    """Declare bounded objective variants supported by the existing Smoke ModeSpec."""
    return contract_id in FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_SMOKE_OBJECTIVE_CONTRACT_IDS


def fact_conditioned_semantic_mixture_smoke_supports_controlled_structure_arm(
    arm_id: str,
) -> bool:
    """Declare the two Owner-designed controlled structure Smoke variants."""
    return arm_id in CONTROLLED_STRUCTURE_SMOKE_ARMS


def build_synthetic_extension_registry() -> ModeRegistry:
    registry = ModeRegistry(FORMAL_MODE_REGISTRY.snapshot().values())
    registry.register(
        ModeSpec(
            mode_id="synthetic_stage4_extension",
            authorization_status=SYNTHETIC_EXTENSION_TEST_STATUS,
            architecture=_V9,
            stage=4,
            execution_kind="cpu_inactive",
            adapter_binding="synthetic_test_adapter",
            sample_split="validation",
            active_execution=False,
        )
    )
    return registry
