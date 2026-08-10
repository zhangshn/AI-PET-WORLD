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
    )
)


def resolve_stage_mode(config) -> ModeSpec:
    training = config.get("training", {})
    return FORMAL_MODE_REGISTRY.resolve(
        str(training.get("trainingAuthorizationStatus")),
        str(config.get("denoiserArchitecture")),
    )


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
