from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import shutil
import sys
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_authorization_policy import resolve_stage_execution_grant
from ai_painter_execution_grant import ExecutionAction
from ai_painter_stage_mode_registry import (
    FORMAL_MODE_REGISTRY,
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_INACTIVE_STATUS,
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_READONLY_GPU_STATUS,
    resolve_stage_mode,
)

from ai_painter_full_backbone_spatial_affine_contract import (
    ACTIVATION_GATE_KEYS,
    AFFINE_FORMULA,
    ARCHITECTURE_ID,
    APPROVED_64_SELECTION_SHA256,
    CAPABILITY_VERSION,
    CONDITION_RESIZE_CONTRACT,
    CPU_SUPPORT_TERMINAL_EVIDENCE,
    FIRST_TRAIN_SAMPLE_ID,
    FIXED_VALIDATION_SAMPLE_ID,
    READONLY_GPU_OUTPUT_ROOT,
    READONLY_GPU_TICKET_ROOT,
    build_full_backbone_spatial_affine_readonly_gpu_config_template,
    compile_full_backbone_spatial_affine_cpu_inactive_config,
    derive_formal_condition_identity,
    derive_full_backbone_block_contracts,
    derive_readonly_gpu_evidence_bindings,
    issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket,
    validate_full_backbone_spatial_affine_cpu_inactive_config,
    validate_full_backbone_spatial_affine_readonly_gpu_config,
)
from train_ai_assisted_conditional_denoiser import (
    validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary,
)


CONDITION_ORDER = (
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
DECODER_ONLY_ARCHITECTURE = (
    "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
)
BLOCK_CHANNELS = (
    ("block0", 64),
    ("block1", 128),
    ("middle1", 256),
    ("middle2", 256),
    ("up_block1", 128),
    ("up_block0", 64),
)
BLOCK_SPATIAL_SIZES = {
    "block0": (8, 8),
    "block1": (4, 4),
    "middle1": (2, 2),
    "middle2": (2, 2),
    "up_block1": (4, 4),
    "up_block0": (8, 8),
}


def _model_config(architecture: str = ARCHITECTURE_ID) -> dict:
    condition_identity = derive_formal_condition_identity()
    return {
        "baseChannels": 8,
        "denoiserBaseChannels": 64,
        "latentChannels": 12,
        "conditionChannels": 23,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "latentDownsampleFactor": 4,
        "denoiserArchitecture": architecture,
        "conditionChannelOrder": list(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "diffusionSteps": 1000,
    }


def _expected_parameter_shapes() -> dict[str, tuple[int, ...]]:
    expected: dict[str, tuple[int, ...]] = {}
    for block_name, channels in BLOCK_CHANNELS:
        for norm_name in ("norm1", "norm2"):
            prefix = f"denoiser.{block_name}.spatial_affine_{norm_name}"
            expected[f"{prefix}.weight"] = (channels * 2, 23, 3, 3)
            expected[f"{prefix}.bias"] = (channels * 2,)
    return expected


def _expected_net_new_parameter_shapes() -> dict[str, tuple[int, ...]]:
    expected = _expected_parameter_shapes()
    return {
        name: shape
        for name, shape in expected.items()
        if any(
            name.startswith(f"denoiser.{block_name}.")
            for block_name, _channels in BLOCK_CHANNELS[:4]
        )
    }


def _typed_resize(torch, conditions, size):
    functional = torch.nn.functional
    identity = derive_formal_condition_identity()
    order = identity["conditionChannelOrder"]
    channel_types = identity["conditionChannelTypes"]
    discrete_indices = [
        order.index(channel_id)
        for channel_id in channel_types["discrete"]
    ]
    continuous_indices = [
        order.index(channel_id)
        for channel_id in channel_types["continuous"]
    ]
    grouped = [
        functional.interpolate(
            conditions[:, discrete_indices],
            size=size,
            mode="nearest",
        ),
        functional.interpolate(
            conditions[:, continuous_indices],
            size=size,
            mode="bilinear",
            align_corners=False,
        ),
    ]
    grouped_indices = discrete_indices + continuous_indices
    combined = torch.cat(grouped, dim=1)
    restore_order = [
        grouped_indices.index(index) for index in range(len(order))
    ]
    return combined[:, restore_order]


def _validate_complete_parameter_delta(
    candidate_parameters: dict[str, object],
    decoder_parameters: dict[str, object],
) -> dict:
    candidate_names = set(candidate_parameters)
    decoder_names = set(decoder_parameters)
    extra_names = candidate_names - decoder_names
    missing_names = decoder_names - candidate_names
    expected_extra = _expected_net_new_parameter_shapes()
    if extra_names != set(expected_extra) or missing_names:
        raise ValueError(
            "full-backbone candidate contains an unregistered parameter delta"
        )
    for name in candidate_names & decoder_names:
        if tuple(candidate_parameters[name].shape) != tuple(
            decoder_parameters[name].shape
        ):
            raise ValueError(f"shared parameter shape changed: {name}")
    actual_extra_shapes = {
        name: tuple(candidate_parameters[name].shape) for name in extra_names
    }
    if actual_extra_shapes != expected_extra:
        raise ValueError("full-backbone net-new parameter shapes changed")
    net_new_count = sum(
        candidate_parameters[name].numel() for name in extra_names
    )
    total_delta = (
        sum(value.numel() for value in candidate_parameters.values())
        - sum(value.numel() for value in decoder_parameters.values())
    )
    if len(extra_names) != 16 or net_new_count != 585728 or total_delta != 585728:
        raise ValueError("full-backbone net-new parameter identity changed")
    return {
        "netNewParameterTensorCount": len(extra_names),
        "netNewParameterCount": net_new_count,
        "completeParameterCountDelta": total_delta,
        "netNewParameterNames": sorted(extra_names),
    }


def _audit_actual_cpu_model() -> dict:
    torch = require_torch()
    torch.manual_seed(20263722)
    model = build_complete_world_system(_model_config()).eval()
    torch.manual_seed(20263722)
    decoder_only = build_complete_world_system(
        _model_config(DECODER_ONLY_ARCHITECTURE)
    ).eval()
    parameters = {
        name: parameter
        for name, parameter in model.named_parameters()
        if ".spatial_affine_" in name
    }
    actual_shapes = {
        name: tuple(parameter.shape)
        for name, parameter in parameters.items()
    }
    assert actual_shapes == _expected_parameter_shapes()
    assert len(parameters) == 24
    assert len({id(parameter) for parameter in parameters.values()}) == 24
    assert sum(parameter.numel() for parameter in parameters.values()) == 745472
    assert {parameter.device.type for parameter in parameters.values()} == {"cpu"}

    parameter_delta = _validate_complete_parameter_delta(
        dict(model.named_parameters()),
        dict(decoder_only.named_parameters()),
    )

    projection_calls: list[str] = []
    projection_inputs: dict[str, list[object]] = {}
    handles = []

    def capture(name):
        def hook(_module, inputs, _output):
            projection_calls.append(name)
            projection_inputs.setdefault(name, []).append(
                inputs[0].detach().clone()
            )

        return hook

    for block_name, _channels in BLOCK_CHANNELS:
        block = getattr(model.denoiser, block_name)
        for norm_name in ("norm1", "norm2"):
            name = f"{block_name}.{norm_name}"
            projection = getattr(block, f"spatial_affine_{norm_name}")
            handles.append(projection.register_forward_hook(capture(name)))

    noisy_latent = torch.randn(1, 12, 8, 8)
    timestep = torch.tensor([11])
    conditions = torch.randn(1, 23, 32, 32, requires_grad=True)
    try:
        output = model.predict_velocity(noisy_latent, timestep, conditions)
    finally:
        for handle in handles:
            handle.remove()
    assert tuple(output.shape) == (1, 12, 8, 8)
    expected_call_order = [
        f"{block_name}.{norm_name}"
        for block_name, _channels in BLOCK_CHANNELS
        for norm_name in ("norm1", "norm2")
    ]
    assert projection_calls == expected_call_order
    for block_name, _channels in BLOCK_CHANNELS:
        expected_conditions = _typed_resize(
            torch,
            conditions.detach(),
            BLOCK_SPATIAL_SIZES[block_name],
        )
        for norm_name in ("norm1", "norm2"):
            name = f"{block_name}.{norm_name}"
            assert len(projection_inputs[name]) == 1
            assert torch.equal(projection_inputs[name][0], expected_conditions)

    block = model.denoiser.block0
    normalized = torch.randn(1, 64, 8, 8)
    affine_conditions = _typed_resize(
        torch,
        conditions.detach(),
        (8, 8),
    )
    with torch.no_grad():
        gamma, beta = block.spatial_affine_norm1(affine_conditions).chunk(
            2,
            dim=1,
        )
        expected_affine = normalized * (1 + gamma) + beta
        actual_affine = block.apply_spatial_affine(
            normalized,
            affine_conditions,
            block.spatial_affine_norm1,
        )
    assert torch.equal(actual_affine, expected_affine)
    gradients = torch.autograd.grad(
        output.square().mean(),
        [conditions, *parameters.values()],
        allow_unused=True,
    )
    assert all(gradient is not None for gradient in gradients)
    assert all(bool(torch.isfinite(gradient).all()) for gradient in gradients)
    assert all(float(gradient.abs().max()) > 0.0 for gradient in gradients)

    return {
        "device": "cpu",
        "blockOrder": [name for name, _channels in BLOCK_CHANNELS],
        "projectionCount": 12,
        "parameterTensorCount": len(parameters),
        "parameterCount": sum(
            parameter.numel() for parameter in parameters.values()
        ),
        "parameterShapes": {
            name: list(shape) for name, shape in actual_shapes.items()
        },
        "forwardOutputShape": list(output.shape),
        "conditionGradientFiniteNonzero": True,
        "allFormalAffineParameterGradientsFiniteNonzero": True,
        "projectionCallOrder": projection_calls,
        "projectionInputsMatchOriginalOrderTypedResize": True,
        "affineFormulaBehaviorVerified": True,
        **parameter_delta,
    }


def _inactive_stage_config() -> dict:
    config = _model_config()
    config["training"] = {
        "trainingAuthorizationStatus": (
            FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_INACTIVE_STATUS
        ),
    }
    return config


def _audit_mode_registry_and_local_policy() -> tuple[dict, list[str]]:
    repository_root = PROJECT_ROOT.parents[1]
    config = _inactive_stage_config()
    spec = resolve_stage_mode(config)
    architecture_modes = [
        candidate
        for candidate in FORMAL_MODE_REGISTRY.snapshot().values()
        if candidate.architecture == ARCHITECTURE_ID
    ]
    assert len(architecture_modes) == 2
    assert spec in architecture_modes
    assert {
        candidate.mode_id for candidate in architecture_modes
    } == {
        "full_backbone_spatial_affine_denoiser_stage4_inactive",
        "full_backbone_spatial_affine_denoiser_stage4_readonly_gpu",
    }
    assert spec.mode_id == (
        "full_backbone_spatial_affine_denoiser_stage4_inactive"
    )
    assert spec.architecture == ARCHITECTURE_ID
    assert spec.stage == 4
    assert spec.execution_kind == "cpu_inactive"
    assert spec.active_execution is False
    assert spec.sample_split is None

    grant = resolve_stage_execution_grant(
        config,
        project_root=repository_root,
    )
    allowed = {action.value for action in grant.allowed_actions}
    expected_allowed = {
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
    }
    assert allowed == expected_allowed
    assert grant.authorization_identity["authority"] == (
        "local_ai_pet_world_program"
    )
    assert grant.authorization_identity["preflightOnly"] is True
    assert grant.authorization_identity["executionState"] == (
        "cpu_supported_inactive"
    )
    assert "localAiCapabilityTicket" not in config["training"]
    readonly_run_id = f"cpu-readonly-check-{uuid4()}"
    readonly_output = (
        f"{READONLY_GPU_OUTPUT_ROOT}/{readonly_run_id}"
    )
    template = build_full_backbone_spatial_affine_readonly_gpu_config_template(
        run_id=readonly_run_id,
        output_namespace=readonly_output,
        project_root=repository_root,
    )
    readonly_spec = resolve_stage_mode(template)
    assert readonly_spec.mode_id == (
        "full_backbone_spatial_affine_denoiser_stage4_readonly_gpu"
    )
    assert readonly_spec.authorization_status == (
        FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_READONLY_GPU_STATUS
    )
    assert readonly_spec.execution_kind == "readonly_gpu_qualification"
    assert readonly_spec.active_execution is True
    assert readonly_spec.sample_split is None
    assert template["ownerAuthorizationRequired"] is False
    assert template["ownerResponseRequired"] is False
    assert "localAiCapabilityTicket" not in template["training"]
    evidence = template["evidenceBindings"]
    assert evidence["cpuSupportTerminal"]["sha256"] == (
        CPU_SUPPORT_TERMINAL_EVIDENCE["sha256"]
    )
    assert evidence["approved64Selection"]["selectedRecordCount"] == 64
    assert evidence["approved64Selection"][
        "selectedRecordIdentitySha256"
    ] == APPROVED_64_SELECTION_SHA256
    assert evidence["approved64Selection"]["splitCounts"] == {
        "train": 48,
        "validation": 8,
        "challenge": 4,
        "regression": 4,
    }
    qualification_samples = evidence["qualificationSamples"]
    assert qualification_samples["preboundReadOnlySamples"] is True
    assert qualification_samples["freeSelectionAllowed"] is False
    assert qualification_samples["selectBoundSampleActionRequired"] is False
    assert qualification_samples["firstTrain"] == {
        "role": "firstTrain",
        "sampleId": FIRST_TRAIN_SAMPLE_ID,
        "recordId": FIRST_TRAIN_SAMPLE_ID,
        "split": "train",
        "sourceIndexOrdinal": 51,
        "selectionOrdinal": 0,
        "splitOrdinal": 0,
        "v7CapacitySlotId": "v7-capacity-slot-146",
        "sourceRecordPath": (
            "data/world-samples/original-image-library/natural-home-v1/"
            "complete-maps/ai-cold-start-v7-v7-capacity-slot-146-"
            "forested-low-mountain-v3/record.json"
        ),
        "sourceRecordSha256": (
            "e154405ec97ab9394a886301947a118cb8b26a9e2b9efffa622821431df2ffba"
        ),
        "conditionPackPath": (
            ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/"
            "earth-geospatial-v7-slot-condition-v7-capacity-slot-146-"
            "2026-07-31T14-45-28-337Z/complete-map-condition-task/"
            "compiled-conditions/condition-pack.json"
        ),
        "conditionPackSha256": (
            "05ff62ecdce5a4d545af0dc4652e64fe580d272f032049a8b464924bb751e3aa"
        ),
    }
    assert qualification_samples["fixedValidation"] == {
        "role": "fixedValidation",
        "sampleId": FIXED_VALIDATION_SAMPLE_ID,
        "recordId": FIXED_VALIDATION_SAMPLE_ID,
        "split": "validation",
        "sourceIndexOrdinal": 99,
        "selectionOrdinal": 48,
        "splitOrdinal": 0,
        "v7CapacitySlotId": "v7-capacity-slot-194",
        "sourceRecordPath": (
            "data/world-samples/original-image-library/natural-home-v1/"
            "complete-maps/ai-cold-start-v7-v7-capacity-slot-194-"
            "wet-season-drainage-hollow-v6/record.json"
        ),
        "sourceRecordSha256": (
            "ac8e4a6bb7b33a8de818b2850fe85c1c2a799b5861930be3573a1c2286a90dc9"
        ),
        "conditionPackPath": (
            ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/"
            "earth-geospatial-v7-slot-condition-v7-capacity-slot-194-"
            "2026-08-01T15-47-45-117Z/complete-map-condition-task/"
            "compiled-conditions/condition-pack.json"
        ),
        "conditionPackSha256": (
            "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9"
        ),
    }

    ticket_directory = (
        repository_root
        / READONLY_GPU_TICKET_ROOT
        / readonly_run_id
    )
    readonly_negatives: list[str] = []
    try:
        active, ticket_identity = (
            issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket(
                dataset_package_id=evidence["approved64Selection"][
                    "datasetPackageId"
                ],
                run_id=readonly_run_id,
                output_namespace=readonly_output,
                project_root=repository_root,
            )
        )
        validation = validate_full_backbone_spatial_affine_readonly_gpu_config(
            active,
            project_root=repository_root,
        )
        assert validation["internalExecutionTicketRequired"] is True
        readonly_grant = resolve_stage_execution_grant(
            active,
            project_root=repository_root,
        )
        readonly_allowed = {
            action.value for action in readonly_grant.allowed_actions
        }
        expected_readonly_allowed = {
            ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
            ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
            ExecutionAction.LOAD_AUTOENCODER.value,
        }
        assert readonly_allowed == expected_readonly_allowed
        assert readonly_grant.authorization_identity["authority"] == (
            "local_ai_pet_world_program"
        )
        grant_samples = readonly_grant.dataset_constraints[
            "qualificationSamples"
        ]
        assert grant_samples == qualification_samples
        assert readonly_grant.dataset_constraints[
            "preboundReadOnlySamples"
        ] is True
        assert readonly_grant.dataset_constraints[
            "freeSampleSelectionAllowed"
        ] is False
        assert readonly_grant.dataset_constraints[
            "selectBoundSampleActionRequired"
        ] is False
        assert ExecutionAction.SELECT_BOUND_SAMPLE not in (
            readonly_grant.allowed_actions
        )
        ticket = json.loads(
            (repository_root / ticket_identity["ticketPath"]).read_text(
                encoding="utf-8"
            )
        )
        assert ticket["ownerAuthorizationRequired"] is False
        assert ticket["capabilityAuthority"] == "local_ai_pet_world_program"
        assert ticket["executionActions"] == sorted(expected_readonly_allowed)

        try:
            issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket(
                dataset_package_id=evidence["approved64Selection"][
                    "datasetPackageId"
                ],
                run_id=readonly_run_id,
                output_namespace=readonly_output,
                project_root=repository_root,
            )
        except (FileExistsError, ValueError):
            readonly_negatives.append("readonly_internal_ticket_replay_rejected")
        else:
            raise AssertionError("readonly internal ticket was reusable")

        corrupted_ticket = deepcopy(active)
        corrupted_ticket["training"]["localAiCapabilityTicket"][
            "ticketSha256"
        ] = "0" * 64
        try:
            validate_full_backbone_spatial_affine_readonly_gpu_config(
                corrupted_ticket,
                project_root=repository_root,
            )
        except ValueError:
            readonly_negatives.append("readonly_ticket_hash_change_rejected")
        else:
            raise AssertionError("readonly ticket hash mutation was accepted")
    finally:
        if ticket_directory.exists():
            expected_parent = (
                repository_root / READONLY_GPU_TICKET_ROOT
            ).resolve()
            if ticket_directory.resolve().parent != expected_parent:
                raise AssertionError("readonly test ticket cleanup escaped namespace")
            shutil.rmtree(ticket_directory)

    return {
        "registeredModeCount": len(architecture_modes),
        "activeModeCount": sum(
            1 for candidate in architecture_modes if candidate.active_execution
        ),
        "inactive": {
            "modeId": spec.mode_id,
            "executionKind": spec.execution_kind,
            "activeExecution": spec.active_execution,
            "allowedReadOnlyActions": sorted(allowed),
            "localProgramAuthority": True,
            "ownerAuthorizationRequired": False,
            "internalExecutionTicketRequired": False,
        },
        "readonlyGpuQualification": {
            "modeId": readonly_spec.mode_id,
            "executionKind": readonly_spec.execution_kind,
            "activeExecution": readonly_spec.active_execution,
            "allowedReadOnlyActions": sorted(readonly_allowed),
            "explicitlyDeniedActions": sorted(
                action.value
                for action in readonly_grant.explicitly_denied_actions
            ),
            "localProgramAuthority": True,
            "ownerAuthorizationRequired": False,
            "internalExecutionTicketRequired": True,
            "oneTimeTicketConsumed": True,
            "cpuSupportTerminalSha256": CPU_SUPPORT_TERMINAL_EVIDENCE[
                "sha256"
            ],
            "approved64SelectionSha256": APPROVED_64_SELECTION_SHA256,
            "qualificationSamples": qualification_samples,
        },
    }, readonly_negatives


def _must_reject(name: str, baseline: dict, mutate) -> str:
    candidate = deepcopy(baseline)
    mutate(candidate)
    try:
        validate_full_backbone_spatial_affine_cpu_inactive_config(candidate)
    except ValueError:
        return name
    raise AssertionError(f"negative fixture unexpectedly passed: {name}")


def _must_reject_readonly(name: str, baseline: dict, mutate) -> str:
    candidate = deepcopy(baseline)
    mutate(candidate)
    try:
        validate_full_backbone_spatial_affine_readonly_gpu_config(
            candidate,
            project_root=PROJECT_ROOT.parents[1],
            require_execution_ticket=False,
        )
    except ValueError:
        return name
    raise AssertionError(f"readonly negative fixture unexpectedly passed: {name}")


def main() -> None:
    positives: list[str] = []
    negatives: list[str] = []

    config = compile_full_backbone_spatial_affine_cpu_inactive_config()
    validation = validate_full_backbone_spatial_affine_cpu_inactive_config(config)
    assert validation["status"] == (
        "full_backbone_spatial_affine_cpu_inactive_config_valid"
    )
    assert validation["architectureId"] == ARCHITECTURE_ID
    assert validation["capabilityVersion"] == CAPABILITY_VERSION == ARCHITECTURE_ID
    assert validation["activationGate"] is False
    positives.append("exact_inactive_config_validates")

    formal_condition_identity = derive_formal_condition_identity()
    assert config["conditionChannelOrder"] == formal_condition_identity[
        "conditionChannelOrder"
    ]
    assert config["conditionChannelTypes"] == formal_condition_identity[
        "conditionChannelTypes"
    ]
    assert (
        config["conditionResizeContract"]
        == formal_condition_identity["conditionResizeContract"]
        == CONDITION_RESIZE_CONTRACT
    )
    assert config["fullBackboneSpatialAffineContract"][
        "conditionChannelOrder"
    ] == formal_condition_identity["conditionChannelOrder"]
    assert config["fullBackboneSpatialAffineContract"][
        "conditionChannelTypes"
    ] == formal_condition_identity["conditionChannelTypes"]
    source_contract = formal_condition_identity["sourceContractIdentity"]
    assert source_contract["schemaVersion"] == (
        "ai-painter-stage4-formal-diffusion-objective-and-checkpoint-contract-v1"
    )
    assert source_contract["status"] == "active_machine_contract"
    assert source_contract[
        "historicalRuntimeArtifactIsExecutionSource"
    ] is False
    assert "conditionSourceArchitectureId" not in config[
        "fullBackboneSpatialAffineContract"
    ]
    positives.append("formal_machine_contract_typed_condition_identity_is_exact")

    blocks = derive_full_backbone_block_contracts()
    assert [block["blockId"] for block in blocks] == [
        "block0",
        "block1",
        "middle1",
        "middle2",
        "up_block1",
        "up_block0",
    ]
    assert [block["featureChannels"] for block in blocks] == [
        64, 128, 256, 256, 128, 64,
    ]
    assert [
        (block["stage0SpatialWidth"], block["stage0SpatialHeight"])
        for block in blocks
    ] == [(64, 48), (32, 24), (16, 12), (16, 12), (32, 24), (64, 48)]
    assert sum(block["projectionCount"] for block in blocks) == 12
    assert sum(block["parameterTensorCount"] for block in blocks) == 24
    assert sum(block["parameterCount"] for block in blocks) == 745472
    assert all(block["module"] == "TimeResidualBlock" for block in blocks)
    assert all(block["affineFormula"] == AFFINE_FORMULA for block in blocks)
    for block in blocks:
        assert block["normalizationPointCount"] == 2
        assert len(block["projections"]) == 2
        for projection in block["projections"]:
            assert projection["module"] == "Conv2d"
            assert projection["inputChannels"] == 23
            assert projection["outputChannels"] == 2 * block["featureChannels"]
            assert projection["kernelSize"] == 3
            assert projection["padding"] == 1
            assert projection["bias"] is True
    positives.append("six_blocks_twelve_projections_and_parameter_math_are_exact")

    assert all(value is False for value in config["activationGates"].values())
    assert set(config["activationGates"]) == set(ACTIVATION_GATE_KEYS)
    assert all(value is False for value in config["executionBoundary"].values())
    positives.append("all_checkpoint_gpu_optimizer_backward_and_training_gates_are_closed")

    actual_model = _audit_actual_cpu_model()
    positives.append("actual_model_factory_cpu_forward_and_autograd_contract_passed")

    mode_and_policy, readonly_policy_negatives = (
        _audit_mode_registry_and_local_policy()
    )
    negatives.extend(readonly_policy_negatives)
    positives.append(
        "inactive_and_readonly_mode_registry_local_ticket_policy_passed"
    )

    inactive_boundary = (
        validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
            {"denoiserArchitecture": ARCHITECTURE_ID},
            preflight_only=True,
        )
    )
    assert inactive_boundary["preflightOnly"] is True
    positives.append("trainer_preflight_only_boundary_passed")

    readonly_template_run_id = "cpu-readonly-template-20260829"
    readonly_template = (
        build_full_backbone_spatial_affine_readonly_gpu_config_template(
            run_id=readonly_template_run_id,
            output_namespace=(
                f"{READONLY_GPU_OUTPUT_ROOT}/{readonly_template_run_id}"
            ),
            project_root=PROJECT_ROOT.parents[1],
        )
    )
    readonly_validation = (
        validate_full_backbone_spatial_affine_readonly_gpu_config(
            readonly_template,
            project_root=PROJECT_ROOT.parents[1],
            require_execution_ticket=False,
        )
    )
    assert readonly_validation["ownerAuthorizationRequired"] is False
    assert readonly_validation["gpuExecutedByValidation"] is False
    assert readonly_template["evidenceBindings"] == (
        derive_readonly_gpu_evidence_bindings(PROJECT_ROOT.parents[1])
    )
    assert {key for key, value in readonly_template["activationGates"].items() if value} == {
        "gpuNow",
        "readonlyGpuQualificationNow",
    }
    positives.append(
        "readonly_gpu_template_recomputes_cpu_formal_64_and_autoencoder_identity"
    )

    negatives.extend([
        _must_reject_readonly(
            "readonly_cpu_terminal_sha_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["cpuSupportTerminal"].__setitem__(
                "sha256", "0" * 64
            ),
        ),
        _must_reject_readonly(
            "readonly_formal_contract_sha_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["formalObjectiveContract"].__setitem__(
                "sha256", "0" * 64
            ),
        ),
        _must_reject_readonly(
            "readonly_approved_64_selection_sha_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["approved64Selection"].__setitem__(
                "selectedRecordIdentitySha256", "0" * 64
            ),
        ),
        _must_reject_readonly(
            "readonly_approved_64_selection_count_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["approved64Selection"].__setitem__(
                "selectedRecordCount", 63
            ),
        ),
        _must_reject_readonly(
            "readonly_first_train_sample_identity_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"][
                "firstTrain"
            ].__setitem__("sampleId", FIXED_VALIDATION_SAMPLE_ID),
        ),
        _must_reject_readonly(
            "readonly_validation_split_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"][
                "fixedValidation"
            ].__setitem__("split", "train"),
        ),
        _must_reject_readonly(
            "readonly_source_record_hash_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"][
                "firstTrain"
            ].__setitem__("sourceRecordSha256", "0" * 64),
        ),
        _must_reject_readonly(
            "readonly_condition_pack_hash_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"][
                "fixedValidation"
            ].__setitem__("conditionPackSha256", "0" * 64),
        ),
        _must_reject_readonly(
            "readonly_free_sample_selection_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"].__setitem__(
                "freeSelectionAllowed", True
            ),
        ),
        _must_reject_readonly(
            "readonly_qualification_sample_digest_change_rejected",
            readonly_template,
            lambda value: value["evidenceBindings"]["qualificationSamples"].__setitem__(
                "identitySha256", "0" * 64
            ),
        ),
        _must_reject_readonly(
            "readonly_owner_authorization_true_rejected",
            readonly_template,
            lambda value: value.__setitem__("ownerAuthorizationRequired", True),
        ),
        _must_reject_readonly(
            "readonly_owner_response_true_rejected",
            readonly_template,
            lambda value: value.__setitem__("ownerResponseRequired", True),
        ),
        _must_reject_readonly(
            "readonly_cross_namespace_output_rejected",
            readonly_template,
            lambda value: value["executionIdentity"].__setitem__(
                "outputNamespace",
                f".runtime/ai-painter/other-qualifications/{readonly_template_run_id}",
            ),
        ),
        _must_reject_readonly(
            "readonly_run_output_identity_mismatch_rejected",
            readonly_template,
            lambda value: value["executionIdentity"].__setitem__(
                "runId", "cpu-readonly-template-mismatch-20260829"
            ),
        ),
        _must_reject_readonly(
            "readonly_optimizer_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "optimizerNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_backward_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "backwardNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_weight_mutation_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "weightModificationNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_training_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "trainingNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_stage0_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "stage0Now", True
            ),
        ),
        _must_reject_readonly(
            "readonly_formal_inference_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "formalInferenceNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_runtime_frame_gate_rejected",
            readonly_template,
            lambda value: value["activationGates"].__setitem__(
                "runtimeFrameNow", True
            ),
        ),
        _must_reject_readonly(
            "readonly_checkpoint_write_permission_rejected",
            readonly_template,
            lambda value: value["readOnlyGpuBoundary"].__setitem__(
                "checkpointWriteAllowed", True
            ),
        ),
        _must_reject_readonly(
            "readonly_parent_denoiser_load_permission_rejected",
            readonly_template,
            lambda value: value["readOnlyGpuBoundary"].__setitem__(
                "parentDenoiserLoadAllowed", True
            ),
        ),
        _must_reject_readonly(
            "readonly_ticket_injection_into_template_rejected",
            readonly_template,
            lambda value: value["training"].__setitem__(
                "localAiCapabilityTicket", {"ticketId": "forged"}
            ),
        ),
    ])
    try:
        validate_full_backbone_spatial_affine_readonly_gpu_config(
            readonly_template,
            project_root=PROJECT_ROOT.parents[1],
        )
    except ValueError:
        negatives.append("readonly_active_config_without_ticket_rejected")
    else:
        raise AssertionError("readonly active config ran without an internal ticket")

    contract_path = "fullBackboneSpatialAffineContract"
    negatives.extend([
        _must_reject(
            "block_omission_rejected",
            config,
            lambda value: value[contract_path]["blocks"].pop(),
        ),
        _must_reject(
            "middle_block_merge_rejected",
            config,
            lambda value: value[contract_path]["blocks"].__setitem__(
                slice(2, 4),
                [{
                    **value[contract_path]["blocks"][2],
                    "blockId": "middle",
                    "role": "bottleneck",
                }],
            ),
        ),
        _must_reject(
            "feature_width_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][1].__setitem__(
                "featureChannels", 96
            ),
        ),
        _must_reject(
            "projection_count_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0].__setitem__(
                "projectionCount", 1
            ),
        ),
        _must_reject(
            "projection_input_channel_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0]["projections"][0].__setitem__(
                "inputChannels", 24
            ),
        ),
        _must_reject(
            "projection_output_channel_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0]["projections"][0].__setitem__(
                "outputChannels", 64
            ),
        ),
        _must_reject(
            "kernel_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0]["projections"][0].__setitem__(
                "kernelSize", 1
            ),
        ),
        _must_reject(
            "padding_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0]["projections"][0].__setitem__(
                "padding", 0
            ),
        ),
        _must_reject(
            "bias_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0]["projections"][0].__setitem__(
                "bias", False
            ),
        ),
        _must_reject(
            "affine_formula_change_rejected",
            config,
            lambda value: value[contract_path]["blocks"][0].__setitem__(
                "affineFormula", "normalized * gamma + beta"
            ),
        ),
        _must_reject(
            "derived_parameter_count_change_rejected",
            config,
            lambda value: value[contract_path].__setitem__(
                "parameterCount", 745473
            ),
        ),
        _must_reject(
            "free_parameter_field_rejected",
            config,
            lambda value: value[contract_path].__setitem__(
                "hiddenWidth", 96
            ),
        ),
        _must_reject(
            "checkpoint_read_gate_rejected",
            config,
            lambda value: value["activationGates"].__setitem__(
                "checkpointReadNow", True
            ),
        ),
        _must_reject(
            "gpu_gate_rejected",
            config,
            lambda value: value["activationGates"].__setitem__("gpuNow", True),
        ),
        _must_reject(
            "training_gate_rejected",
            config,
            lambda value: value["activationGates"].__setitem__(
                "trainingNow", True
            ),
        ),
        _must_reject(
            "condition_order_change_rejected",
            config,
            lambda value: value.__setitem__(
                "conditionChannelOrder",
                list(reversed(value["conditionChannelOrder"])),
            ),
        ),
        _must_reject(
            "condition_type_change_rejected",
            config,
            lambda value: value["conditionChannelTypes"]["discrete"].pop(),
        ),
        _must_reject(
            "condition_resize_contract_change_rejected",
            config,
            lambda value: value.__setitem__(
                "conditionResizeContract", "bilinear_all_channels"
            ),
        ),
        _must_reject(
            "capability_version_hyphen_alias_rejected",
            config,
            lambda value: value.__setitem__(
                "capabilityVersion", ARCHITECTURE_ID.replace("_", "-")
            ),
        ),
    ])

    torch = require_torch()
    torch.manual_seed(20263722)
    candidate_parameters = dict(
        build_complete_world_system(_model_config()).named_parameters()
    )
    torch.manual_seed(20263722)
    decoder_parameters = dict(
        build_complete_world_system(
            _model_config(DECODER_ONLY_ARCHITECTURE)
        ).named_parameters()
    )
    injected_parameters = dict(candidate_parameters)
    injected_parameters["denoiser.unregistered_free_parameter"] = (
        torch.nn.Parameter(torch.zeros(1))
    )
    try:
        _validate_complete_parameter_delta(
            injected_parameters,
            decoder_parameters,
        )
    except ValueError:
        negatives.append("unregistered_parameter_outside_affine_namespace_rejected")
    else:
        raise AssertionError("checker accepted an unregistered free parameter")

    try:
        validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
            {"denoiserArchitecture": ARCHITECTURE_ID},
            preflight_only=False,
        )
    except ValueError:
        negatives.append("trainer_non_preflight_execution_rejected_early")
    else:
        raise AssertionError("Trainer accepted an active inactive candidate")

    wrong_architecture = _inactive_stage_config()
    wrong_architecture["denoiserArchitecture"] = (
        "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
    )
    try:
        resolve_stage_mode(wrong_architecture)
    except ValueError:
        negatives.append("new_mode_cross_architecture_binding_rejected")
    else:
        raise AssertionError("new mode accepted the retired decoder-only architecture")

    ticket_injection = _inactive_stage_config()
    ticket_injection["training"]["localAiCapabilityTicket"] = {
        "ticketId": "forbidden-for-cpu-inactive"
    }
    try:
        resolve_stage_execution_grant(
            ticket_injection,
            project_root=PROJECT_ROOT.parents[1],
        )
    except ValueError:
        negatives.append("cpu_inactive_ticket_injection_rejected")
    else:
        raise AssertionError("CPU inactive mode accepted an execution ticket")

    report = {
        "schemaVersion": (
            "ai-painter-stage4-full-backbone-spatial-affine-cpu-report-v1"
        ),
        "status": "passed",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionIdentity": formal_condition_identity,
        "exactDerivedIdentity": {
            "blockCount": 6,
            "projectionCount": 12,
            "parameterTensorCount": 24,
            "parameterCount": 745472,
            "currentDecoderOnlyParameterCount": 159744,
            "netNewParameterCount": 585728,
        },
        "actualImplementation": actual_model,
        "modeAndPolicy": mode_and_policy,
        "positivePassed": len(positives),
        "positiveTotal": len(positives),
        "negativePassed": len(negatives),
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelModified": False,
            "lossModified": False,
            "dataModified": False,
            "reviewThresholdsModified": False,
            "trainingStarted": False,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
