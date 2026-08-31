from __future__ import annotations

"""Fail-closed CPU support for the Stage 4 semantic-transport V2 Trainer lane.

The module contains no execution entry point.  It only validates an inactive
capability binding and the two responsibility-evidence structures consumed by
the existing formal V6 composite objective.
"""

from hashlib import sha256
import json
from pathlib import Path
from typing import Any


ARCHITECTURE_ID = (
    "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
)
TRAINER_SUPPORT_CONTRACT_ID = (
    "stage4-semantic-transport-v2-trainer-loss-support-contract-v1"
)
TRAINER_SUPPORT_CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json"
)
FORMAL_OBJECTIVE_CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json"
)
TRAINER_SUPPORT_BINDING_KEY = "stage4SemanticTransportV2TrainerSupport"
OBJECTIVE_MAPPING_ID = "formal_v6_composite_exact_reuse_v1"
CPU_INACTIVE_STATUS = "cpu_supported_inactive"
CPU_CHECKER_PATH = (
    "ml/ai-painter/scripts/"
    "check_stage4_semantic_transport_v2_trainer_support_cpu.py"
)
AUTOENCODER_BASE_CHANNELS = 48
DENOISER_BASE_CHANNELS = 64
LATENT_CHANNELS = 12
CONDITION_CHANNELS = 23
LATENT_DOWNSAMPLE_FACTOR = 4

FORMAL_CONDITION_CHANNEL_ORDER = (
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
FORMAL_DISCRETE_CONDITION_ORDER = FORMAL_CONDITION_CHANNEL_ORDER[:15]
FORMAL_CONTINUOUS_CONDITION_ORDER = FORMAL_CONDITION_CHANNEL_ORDER[15:]
RESPONSIBILITY_IDENTITIES = (
    "terrain_path_ground",
    "terrain_water",
    "terrain_shoreline",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
SPARSE_RGB_CONDITION_CHANNELS = (
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "object_footprints",
    "focal_area",
)
OBJECT_SEMANTIC_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
OBJECT_SEMANTIC_CHANNEL_WEIGHTS = {
    "object_footprints": 1.0,
    "object_tree": 1.0,
    "object_rock": 1.25,
    "object_vegetation": 1.0,
}
RESPONSIBILITY_OBJECTIVE_MAPPING = {
    "terrain_path_ground": (
        "pathBoundaryRgb",
        "pathInteriorRgb",
        "pathForbiddenBoundaryRgb",
    ),
    "terrain_water": (
        "sparseRegionDecodedRgb",
        "sparseRegionContrast",
        "decodedRgb",
    ),
    "terrain_shoreline": (
        "sparseRegionDecodedRgb",
        "sparseRegionContrast",
        "decodedRgb",
    ),
    "object_footprints": ("objectSemanticRgb",),
    "object_tree": ("objectSemanticRgb",),
    "object_rock": ("objectSemanticRgb",),
    "object_vegetation": ("objectSemanticRgb",),
}
GLOBAL_VISUAL_OBJECTIVE_TERMS = (
    "decodedRgb",
    "decodedRgbGradient",
    "decodedRgbLaplacian",
    "decodedRgbQuietRegionExcess",
    "spatialGridRgb",
)
CONDITION_PROBE_OBJECTIVE_TERMS = (
    "discreteConditionOutputBinding",
    "continuousConditionOutputBinding",
)
LATENT_VELOCITY_OBJECTIVE_TERMS = (
    "velocity",
    "cleanLatent",
    "multiscaleLatentGradient",
    "multiscaleLatentLaplacian",
    "quietRegionExcess",
)
EXPECTED_DENOISER_LOSS_WEIGHTS = {
    "velocity": 1.0,
    "cleanLatent": 0.75,
    "multiscaleLatentGradient": 0.35,
    "multiscaleLatentLaplacian": 0.2,
    "quietRegionExcess": 0.8,
    "discreteConditionOutputBinding": 0.9,
    "continuousConditionOutputBinding": 0.35,
    "decodedRgb": 0.75,
    "decodedRgbGradient": 0.35,
    "decodedRgbLaplacian": 0.15,
    "decodedRgbQuietRegionExcess": 1.0,
    "sparseRegionDecodedRgb": 1.0,
    "sparseRegionContrast": 1.25,
    "spatialGridRgb": 1.25,
    "pathBoundaryRgb": 1.5,
    "objectSemanticRgb": 1.0,
    "pathInteriorRgb": 2.0,
    "pathForbiddenBoundaryRgb": 2.0,
}


def _float_mapping(value: Any, label: str) -> dict[str, float]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} is missing")
    try:
        return {str(key): float(item) for key, item in value.items()}
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} contains a non-numeric value") from error


def build_stage4_semantic_transport_v2_cpu_inactive_config(
    root: Path | None = None,
) -> dict[str, Any]:
    """Materialize only the immutable config needed for CPU contract checking.

    This helper deliberately does not build a model, allocate an optimizer, read a
    checkpoint, or import Torch.  It gives the checker an input that is entirely
    derived from the bound formal objective and support contract.
    """

    root = (root or project_root()).resolve()
    contract, contract_sha = load_stage4_semantic_transport_v2_trainer_support_contract(root)
    formal_path = root / FORMAL_OBJECTIVE_CONTRACT_PATH
    formal = _read_json(formal_path, "formal Stage 4 objective contract")
    training = formal.get("training")
    if not isinstance(training, dict):
        raise ValueError("formal Stage 4 objective training configuration is missing")
    return {
        "baseChannels": AUTOENCODER_BASE_CHANNELS,
        "denoiserBaseChannels": DENOISER_BASE_CHANNELS,
        "latentChannels": LATENT_CHANNELS,
        "latentDownsampleFactor": LATENT_DOWNSAMPLE_FACTOR,
        "conditionChannels": CONDITION_CHANNELS,
        "conditionChannelOrder": list(FORMAL_CONDITION_CHANNEL_ORDER),
        "conditionChannelTypes": {
            "discrete": list(FORMAL_DISCRETE_CONDITION_ORDER),
            "continuous": list(FORMAL_CONTINUOUS_CONDITION_ORDER),
        },
        "conditionResizeContract": "discrete_nearest_continuous_bilinear_v1",
        "conditionOutputBinding": "predicted_clean_latent_and_decoded_rgb_v1",
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "denoiserArchitecture": ARCHITECTURE_ID,
        "diffusionSteps": int(formal["modelBoundary"]["diffusionSteps"]),
        "inferenceSteps": int(formal["modelBoundary"]["inferenceSteps"]),
        "training": {
            **training,
            "denoiserLossVersion": "velocity_decoded_rgb_sparse_region_rollout_v6",
            "bestCheckpointMetric": "fixed_grid_plus_deterministic_rollout_rgb_score_v6",
            "strictHeldOutInferenceSplit": "challenge",
            "denoiserLossWeights": dict(formal["denoiserLossWeights"]),
            "bestCheckpointMetricWeights": dict(
                formal["bestCheckpointMetricWeights"]
            ),
            TRAINER_SUPPORT_BINDING_KEY: {
                "contractId": TRAINER_SUPPORT_CONTRACT_ID,
                "contractPath": TRAINER_SUPPORT_CONTRACT_PATH,
                "contractSha256": contract_sha,
                "status": CPU_INACTIVE_STATUS,
                "objectiveMappingId": OBJECTIVE_MAPPING_ID,
                "responsibilityIdentityOrder": list(RESPONSIBILITY_IDENTITIES),
                "machineReviewThresholdsUsedAsTrainingTargets": False,
                "failedPreviewPixelsUsedAsTrainingTargets": False,
            },
        },
    }


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def state_dict_sha256(state_dict: dict[str, Any]) -> str:
    """Use the project's sorted tensor-byte identity for model-state evidence."""

    digest = sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(
            json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii")
        )
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def stage4_semantic_transport_v2_optimizer_parameters(model: Any) -> tuple[Any, ...]:
    """Return exactly the trainable V2 Denoiser set and reject AE overlap."""

    autoencoder_parameters = tuple(model.autoencoder.parameters())
    denoiser_parameters = tuple(
        parameter
        for parameter in model.denoiser.parameters()
        if parameter.requires_grad
    )
    if not denoiser_parameters:
        raise ValueError("Stage 4 V2 trainable Denoiser parameter set is empty")
    autoencoder_ids = {id(parameter) for parameter in autoencoder_parameters}
    denoiser_ids = {id(parameter) for parameter in denoiser_parameters}
    if len(denoiser_ids) != len(denoiser_parameters):
        raise ValueError("Stage 4 V2 Denoiser optimizer parameters contain aliases")
    if autoencoder_ids & denoiser_ids:
        raise ValueError("Stage 4 V2 optimizer parameters include Autoencoder tensors")
    return denoiser_parameters


def validate_stage4_semantic_transport_v2_autoencoder_boundary(
    model: Any,
    *,
    phase: str,
    expected_state_sha256: str | None = None,
) -> dict[str, Any]:
    """Capture loaded/before/after AE identity without creating an optimizer."""

    if phase not in {"loaded", "before_training", "after_training"}:
        raise ValueError("Stage 4 V2 Autoencoder evidence phase is invalid")
    autoencoder_parameters = tuple(model.autoencoder.parameters())
    if model.autoencoder.training:
        raise ValueError("Stage 4 V2 Autoencoder must remain in eval mode")
    if any(parameter.requires_grad for parameter in autoencoder_parameters):
        raise ValueError("Stage 4 V2 Autoencoder contains a trainable parameter")
    optimizer_parameters = stage4_semantic_transport_v2_optimizer_parameters(model)
    state_sha = state_dict_sha256(model.autoencoder.state_dict())
    if expected_state_sha256 is not None and state_sha != expected_state_sha256:
        raise ValueError("Stage 4 V2 Autoencoder state changed across the training boundary")
    return {
        "phase": phase,
        "stateSha256": state_sha,
        "training": False,
        "requiresGradParameterCount": 0,
        "autoencoderParameterCount": len(autoencoder_parameters),
        "optimizerParameterCount": len(optimizer_parameters),
        "optimizerContainsAutoencoder": False,
        "optimizerScope": "denoiser_trainable_parameters_only",
    }


def _require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ValueError(
            f"{label} fields are not exact; missing={missing}, extra={extra}"
        )


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is not readable immutable JSON: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a top-level object")
    return value


def _validate_program_binding(root: Path, binding: dict[str, Any], label: str) -> None:
    _require_exact_keys(binding, {"path", "sha256"}, label)
    relative_path = str(binding["path"])
    expected_sha = str(binding["sha256"])
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"{label} escapes the project root") from error
    if not candidate.is_file():
        raise ValueError(f"{label} file is missing: {relative_path}")
    if len(expected_sha) != 64 or any(
        character not in "0123456789abcdef" for character in expected_sha
    ):
        raise ValueError(f"{label} SHA-256 is invalid")
    if file_sha256(candidate) != expected_sha:
        raise ValueError(f"{label} SHA-256 does not match the current file")


def load_stage4_semantic_transport_v2_trainer_support_contract(
    root: Path | None = None,
) -> tuple[dict[str, Any], str]:
    root = (root or project_root()).resolve()
    path = root / TRAINER_SUPPORT_CONTRACT_PATH
    contract = _read_json(path, "Stage 4 V2 Trainer support contract")
    return contract, file_sha256(path)


def validate_stage4_semantic_transport_v2_trainer_contract(
    config: dict[str, Any],
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    """Validate the immutable CPU-inactive Trainer/Loss support boundary."""

    root = (root or project_root()).resolve()
    if str(config.get("denoiserArchitecture", "")) != ARCHITECTURE_ID:
        raise ValueError("Stage 4 V2 Trainer support requires the exact architecture identity")
    if int(config.get("conditionChannels", 0)) != CONDITION_CHANNELS:
        raise ValueError("Stage 4 V2 Trainer support requires 23 condition channels")
    if int(config.get("latentChannels", 0)) != LATENT_CHANNELS:
        raise ValueError("Stage 4 V2 Trainer support requires 12 latent channels")
    if int(config.get("denoiserBaseChannels", 0)) != DENOISER_BASE_CHANNELS:
        raise ValueError("Stage 4 V2 Trainer support requires the derived base width 64")
    if int(config.get("baseChannels", 0)) != AUTOENCODER_BASE_CHANNELS:
        raise ValueError("Stage 4 V2 Trainer support requires Autoencoder base width 48")
    if int(config.get("latentDownsampleFactor", 0)) != LATENT_DOWNSAMPLE_FACTOR:
        raise ValueError("Stage 4 V2 Trainer support requires the frozen four-times relation")
    if str(config.get("autoencoderArchitecture", "")) != "residual_4x_latent_pixel_detail_v2":
        raise ValueError("Stage 4 V2 Trainer support requires the frozen V2 Autoencoder")
    if tuple(config.get("conditionChannelOrder", ())) != FORMAL_CONDITION_CHANNEL_ORDER:
        raise ValueError("Stage 4 V2 Trainer condition order is not authoritative")
    types = config.get("conditionChannelTypes", {})
    if not isinstance(types, dict):
        raise ValueError("Stage 4 V2 Trainer condition types are missing")
    if tuple(types.get("discrete", ())) != FORMAL_DISCRETE_CONDITION_ORDER:
        raise ValueError("Stage 4 V2 Trainer discrete condition order is invalid")
    if tuple(types.get("continuous", ())) != FORMAL_CONTINUOUS_CONDITION_ORDER:
        raise ValueError("Stage 4 V2 Trainer continuous condition order is invalid")
    if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
        raise ValueError("Stage 4 V2 must preserve the formal V6 output binding")

    training = config.get("training", {})
    if not isinstance(training, dict):
        raise ValueError("Stage 4 V2 Trainer configuration is missing")
    binding = training.get(TRAINER_SUPPORT_BINDING_KEY)
    if not isinstance(binding, dict):
        raise ValueError("Stage 4 V2 immutable Trainer support binding is missing")
    _require_exact_keys(
        binding,
        {
            "contractId",
            "contractPath",
            "contractSha256",
            "status",
            "objectiveMappingId",
            "responsibilityIdentityOrder",
            "machineReviewThresholdsUsedAsTrainingTargets",
            "failedPreviewPixelsUsedAsTrainingTargets",
        },
        "Stage 4 V2 Trainer support binding",
    )
    if binding["contractId"] != TRAINER_SUPPORT_CONTRACT_ID:
        raise ValueError("Stage 4 V2 Trainer support contract identity is invalid")
    if binding["contractPath"] != TRAINER_SUPPORT_CONTRACT_PATH:
        raise ValueError("Stage 4 V2 Trainer support contract path is invalid")
    if binding["status"] != CPU_INACTIVE_STATUS:
        raise ValueError("Stage 4 V2 Trainer support must remain CPU inactive")
    if binding["objectiveMappingId"] != OBJECTIVE_MAPPING_ID:
        raise ValueError("Stage 4 V2 Trainer objective mapping identity is invalid")
    if tuple(binding["responsibilityIdentityOrder"]) != RESPONSIBILITY_IDENTITIES:
        raise ValueError("Stage 4 V2 Trainer responsibility order is invalid")
    if binding["machineReviewThresholdsUsedAsTrainingTargets"] is not False:
        raise ValueError("machine-review thresholds cannot be V2 training targets")
    if binding["failedPreviewPixelsUsedAsTrainingTargets"] is not False:
        raise ValueError("failed preview pixels cannot be V2 training targets")

    contract, contract_sha = load_stage4_semantic_transport_v2_trainer_support_contract(root)
    if binding["contractSha256"] != contract_sha:
        raise ValueError("Stage 4 V2 Trainer support contract SHA-256 is stale")
    if contract.get("schemaVersion") != TRAINER_SUPPORT_CONTRACT_ID:
        raise ValueError("Stage 4 V2 Trainer support contract schema is invalid")
    if contract.get("contractId") != TRAINER_SUPPORT_CONTRACT_ID:
        raise ValueError("Stage 4 V2 Trainer support contract ID is invalid")
    if contract.get("status") != CPU_INACTIVE_STATUS:
        raise ValueError("Stage 4 V2 Trainer support contract is not CPU inactive")
    if contract.get("architectureId") != ARCHITECTURE_ID:
        raise ValueError("Stage 4 V2 Trainer support architecture binding is invalid")
    if contract.get("objectiveMappingId") != OBJECTIVE_MAPPING_ID:
        raise ValueError("Stage 4 V2 Trainer support objective mapping is invalid")

    autoencoder_boundary = contract.get("autoencoderTrainingBoundary")
    if autoencoder_boundary != {
        "stateIdentityAlgorithm": "sha256_sorted_tensor_bytes_v1",
        "requiredEvidencePhases": ["loaded", "before_training", "after_training"],
        "allStateHashesMustMatch": True,
        "evalModeRequired": True,
        "requiresGradParameterCount": 0,
        "optimizerParameterSource": (
            "stage4_semantic_transport_v2_optimizer_parameters"
        ),
        "optimizerScope": "denoiser_trainable_parameters_only",
        "optimizerContainsAutoencoder": False,
        "checkpointEvidenceField": (
            "stage4SemanticTransportV2AutoencoderBoundary"
        ),
    }:
        raise ValueError("Stage 4 V2 Autoencoder training boundary changed")

    gates = contract.get("activationGates", {})
    if gates != {
        "gpuNow": False,
        "optimizerNow": False,
        "backwardNow": False,
        "weightModificationNow": False,
        "checkpointReadNow": False,
        "trainingNow": False,
        "formalInferenceNow": False,
        "runtimeFrameNow": False,
        "worldEntryNow": False,
    }:
        raise ValueError("Stage 4 V2 Trainer support contract contains an active execution gate")
    if contract.get("trainerDispatch") != {
        "velocityMethod": "predict_velocity_with_stage4_semantic_responsibility",
        "rgbMethod": "decode_stage4_semantic_responsibility_rgb",
        "conditionProbeMethod": "reconstruct_conditions_from_clean_latent",
        "conditionProbeRole": "non_responsibility_auxiliary_output_binding",
        "conditionProbeArchitecture": (
            "12_to_64_to_existing_residual_block_to_23_to_sigmoid"
        ),
        "conditionProbeFreeParameters": False,
        "conditionProbeSharesResponsibilityParameters": False,
        "legacyDispatchChanged": False,
    }:
        raise ValueError("Stage 4 V2 Trainer dispatch or auxiliary probe binding changed")
    program_bindings = contract.get("programBindings", {})
    if not isinstance(program_bindings, dict):
        raise ValueError("Stage 4 V2 Trainer program bindings are missing")
    _require_exact_keys(
        program_bindings,
        {
            "trainer",
            "trainerSupport",
            "modelFactory",
            "successorModule",
            "cpuTest",
            "cpuChecker",
        },
        "Stage 4 V2 Trainer program bindings",
    )
    for label, program_binding in program_bindings.items():
        if not isinstance(program_binding, dict):
            raise ValueError(f"Stage 4 V2 {label} program binding is invalid")
        _validate_program_binding(root, program_binding, f"Stage 4 V2 {label}")

    objective_binding = contract.get("formalObjectiveContract", {})
    if not isinstance(objective_binding, dict):
        raise ValueError("Stage 4 V2 formal objective binding is missing")
    _require_exact_keys(objective_binding, {"path", "sha256", "schemaVersion"}, "formal objective binding")
    if objective_binding["path"] != FORMAL_OBJECTIVE_CONTRACT_PATH:
        raise ValueError("Stage 4 V2 formal objective path is invalid")
    formal_path = root / FORMAL_OBJECTIVE_CONTRACT_PATH
    formal = _read_json(formal_path, "formal Stage 4 objective contract")
    if file_sha256(formal_path) != objective_binding["sha256"]:
        raise ValueError("formal Stage 4 objective contract SHA-256 is stale")
    if formal.get("schemaVersion") != objective_binding["schemaVersion"]:
        raise ValueError("formal Stage 4 objective schema is invalid")

    if training.get("denoiserLossVersion") != "velocity_decoded_rgb_sparse_region_rollout_v6":
        raise ValueError("Stage 4 V2 must reuse the formal V6 Loss version")
    if training.get("bestCheckpointMetric") != "fixed_grid_plus_deterministic_rollout_rgb_score_v6":
        raise ValueError("Stage 4 V2 must reuse the formal V6 checkpoint metric")
    if training.get("strictHeldOutInferenceSplit") != "challenge":
        raise ValueError("Stage 4 V2 strict held-out split must remain challenge")
    if tuple(training.get("sparseRgbConditionChannels", ())) != SPARSE_RGB_CONDITION_CHANNELS:
        raise ValueError("Stage 4 V2 sparse RGB condition order is invalid")
    if tuple(training.get("semanticRgbConditionChannels", ())) != OBJECT_SEMANTIC_CHANNELS:
        raise ValueError("Stage 4 V2 object semantic condition order is invalid")
    actual_object_weights = _float_mapping(
        training.get("objectSemanticChannelWeights"),
        "Stage 4 V2 object semantic weights",
    )
    if actual_object_weights != OBJECT_SEMANTIC_CHANNEL_WEIGHTS:
        raise ValueError("Stage 4 V2 object semantic weights changed")
    actual_loss_weights = _float_mapping(
        training.get("denoiserLossWeights"),
        "Stage 4 V2 denoiser Loss weights",
    )
    formal_loss_weights = _float_mapping(
        formal.get("denoiserLossWeights"),
        "bound formal Stage 4 denoiser Loss weights",
    )
    if actual_loss_weights != EXPECTED_DENOISER_LOSS_WEIGHTS:
        raise ValueError("Stage 4 V2 denoiser Loss weights changed")
    if formal_loss_weights != EXPECTED_DENOISER_LOSS_WEIGHTS:
        raise ValueError("bound formal Stage 4 denoiser Loss weights changed")
    if contract.get("denoiserLossWeights") != formal.get("denoiserLossWeights"):
        raise ValueError("Stage 4 V2 support contract does not exactly mirror formal Loss weights")
    if _float_mapping(
        training.get("bestCheckpointMetricWeights"),
        "Stage 4 V2 checkpoint metric weights",
    ) != _float_mapping(
        formal.get("bestCheckpointMetricWeights"),
        "bound formal Stage 4 checkpoint metric weights",
    ):
        raise ValueError("Stage 4 V2 checkpoint metric weights changed")
    for key in (
        "textureHierarchyScales",
        "quietRegionQuantile",
        "quietRegionMargin",
        "pathBoundaryBandRatio",
    ):
        if training.get(key) != formal["training"].get(key):
            raise ValueError(f"Stage 4 V2 formal V6 training value changed: {key}")
    for key in (
        "pathCoverageCalibration",
        "authorizedBoundaryTopology",
        "pathActivationMassCalibration",
        "stage4RequiredBoundaryContact",
    ):
        route_term = training.get(key)
        if isinstance(route_term, dict) and route_term.get("enabled") is True:
            raise ValueError("Stage 4 V2 cannot activate an unbound weighted Loss term")
    for key, value in training.items():
        normalized_key = str(key).lower()
        if (
            ("review" in normalized_key or "threshold" in normalized_key)
            and "target" in normalized_key
            and value is not False
        ):
            raise ValueError("Stage 4 V2 cannot use a review threshold or score as a training target")
    if contract.get("responsibilityIdentityOrder") != list(RESPONSIBILITY_IDENTITIES):
        raise ValueError("Stage 4 V2 support contract responsibility order changed")
    if contract.get("responsibilityObjectiveMapping") != {
        identity: list(terms)
        for identity, terms in RESPONSIBILITY_OBJECTIVE_MAPPING.items()
    }:
        raise ValueError("Stage 4 V2 responsibility-to-objective mapping changed")
    if contract.get("globalVisualObjectiveTerms") != list(GLOBAL_VISUAL_OBJECTIVE_TERMS):
        raise ValueError("Stage 4 V2 global visual objective mapping changed")
    if contract.get("conditionProbeObjectiveTerms") != list(CONDITION_PROBE_OBJECTIVE_TERMS):
        raise ValueError("Stage 4 V2 condition-probe objective mapping changed")
    if contract.get("latentVelocityObjectiveTerms") != list(LATENT_VELOCITY_OBJECTIVE_TERMS):
        raise ValueError("Stage 4 V2 latent/velocity objective mapping changed")
    objective_terms = contract.get("objectiveTerms")
    if not isinstance(objective_terms, dict) or set(objective_terms) != set(
        EXPECTED_DENOISER_LOSS_WEIGHTS
    ):
        raise ValueError("Stage 4 V2 formula binding terms changed")
    for term, expected_weight in EXPECTED_DENOISER_LOSS_WEIGHTS.items():
        binding = objective_terms[term]
        if not isinstance(binding, dict):
            raise ValueError(f"Stage 4 V2 formula binding is invalid: {term}")
        if float(binding.get("weight", float("nan"))) != expected_weight:
            raise ValueError(f"Stage 4 V2 formula weight changed: {term}")
        formula = binding.get("formula")
        formula_sha = binding.get("formulaSha256")
        implementation = binding.get("implementation")
        if not isinstance(formula, str) or not formula:
            raise ValueError(f"Stage 4 V2 formula is missing: {term}")
        if not isinstance(formula_sha, str) or len(formula_sha) != 64 or any(
            character not in "0123456789abcdef" for character in formula_sha
        ):
            raise ValueError(f"Stage 4 V2 formula SHA-256 is invalid: {term}")
        if sha256(formula.encode("utf-8")).hexdigest() != formula_sha:
            raise ValueError(f"Stage 4 V2 formula SHA-256 does not match: {term}")
        if not isinstance(implementation, str) or not implementation.startswith(
            "train_ai_assisted_conditional_denoiser.py:"
        ):
            raise ValueError(f"Stage 4 V2 formula path changed: {term}")
    composite_formula = contract.get("compositeFormula")
    if not isinstance(composite_formula, dict) or composite_formula != {
        "formula": (
            "sum(objectiveTerms[id].weight*objectiveTerms[id].metric for id in "
            "denoiserLossWeights in frozen contract order)"
        ),
        "aggregation": "one scalar; no V2-only additive term",
        "implementation": "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py:18231-18342",
        "implementationSha256": program_bindings["trainer"]["sha256"],
    }:
        raise ValueError("Stage 4 V2 composite formula binding changed")
    safeguards = contract.get("trainingTargetSafeguards", {})
    if safeguards != {
        "machineReviewThresholdsUsedAsTrainingTargets": False,
        "machineReviewScoresUsedAsTrainingTargets": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
    }:
        raise ValueError("Stage 4 V2 training-target safeguards changed")

    return {
        "status": "stage4_semantic_transport_v2_trainer_contract_valid_cpu_inactive",
        "contractId": TRAINER_SUPPORT_CONTRACT_ID,
        "contractPath": TRAINER_SUPPORT_CONTRACT_PATH,
        "contractSha256": contract_sha,
        "formalObjectiveSha256": objective_binding["sha256"],
        "responsibilityIdentityOrder": list(RESPONSIBILITY_IDENTITIES),
        "denoiserLossWeights": dict(EXPECTED_DENOISER_LOSS_WEIGHTS),
        "gpuActivated": False,
    }


def validate_stage4_semantic_transport_v2_responsibility_evidence(
    latent_evidence: dict[str, Any],
    rgb_evidence: dict[str, Any],
    predicted_velocity: Any,
    predicted_rgb: Any,
) -> None:
    """Reject missing, reordered, aliased or shape-incompatible V2 outputs."""

    if not isinstance(latent_evidence, dict) or not isinstance(rgb_evidence, dict):
        raise ValueError("Stage 4 V2 responsibility evidence is missing")
    if latent_evidence.get("architectureIdentity") != ARCHITECTURE_ID:
        raise ValueError("Stage 4 V2 latent evidence architecture identity changed")
    if tuple(latent_evidence.get("responsibilityIdentityOrder", ())) != RESPONSIBILITY_IDENTITIES:
        raise ValueError("Stage 4 V2 latent responsibility order changed")
    if tuple(rgb_evidence.get("responsibilityIdentityOrder", ())) != RESPONSIBILITY_IDENTITIES:
        raise ValueError("Stage 4 V2 RGB responsibility order changed")
    if rgb_evidence.get("compositorKind") != "typed_identity_isolated_authoritative_rgb_responsibility_v2":
        raise ValueError("Stage 4 V2 RGB compositor identity changed")
    if latent_evidence.get("typedIdentityCollapsedBeforeOutput") is not False:
        raise ValueError("Stage 4 V2 latent identities were collapsed before output")
    if rgb_evidence.get("maskOutsideMutationAllowed") is not False:
        raise ValueError("Stage 4 V2 RGB evidence allows mutation outside authoritative masks")
    if rgb_evidence.get("freeBlendWeightsPresent") is not False:
        raise ValueError("Stage 4 V2 RGB evidence contains free blend weights")

    contributions = tuple(latent_evidence.get("responsibilityContributions", ()))
    paths = latent_evidence.get("responsibilityEvidence", {})
    masks = tuple(rgb_evidence.get("responsibilityMasks", ()))
    proposals = tuple(rgb_evidence.get("responsibilityRgbProposals", ()))
    gated = tuple(rgb_evidence.get("authoritativelyGatedResponsibilityRgb", ()))
    if len(contributions) != len(RESPONSIBILITY_IDENTITIES):
        raise ValueError("Stage 4 V2 latent responsibility contribution count changed")
    if not isinstance(paths, dict) or tuple(paths) != RESPONSIBILITY_IDENTITIES:
        raise ValueError("Stage 4 V2 latent responsibility evidence namespaces changed")
    if not (
        len(masks)
        == len(proposals)
        == len(gated)
        == len(RESPONSIBILITY_IDENTITIES)
    ):
        raise ValueError("Stage 4 V2 RGB responsibility output count changed")
    base_output = latent_evidence.get("baseOutput")
    base_rgb = rgb_evidence.get("baseDecodedRgb")
    if base_output is None or tuple(base_output.shape) != tuple(predicted_velocity.shape):
        raise ValueError("Stage 4 V2 base velocity output shape changed")
    if base_rgb is None or tuple(base_rgb.shape) != tuple(predicted_rgb.shape):
        raise ValueError("Stage 4 V2 base decoded RGB shape changed")
    for index, identity in enumerate(RESPONSIBILITY_IDENTITIES):
        contribution = contributions[index]
        path = paths[identity]
        if tuple(contribution.shape) != tuple(predicted_velocity.shape):
            raise ValueError(f"Stage 4 V2 {identity} latent output shape changed")
        if not isinstance(path, dict):
            raise ValueError(f"Stage 4 V2 {identity} path evidence is missing")
        preserved_mask = path.get("preservedMask")
        transport_weights = path.get("transportWeights")
        if (
            preserved_mask is None
            or preserved_mask.ndim != 4
            or int(preserved_mask.shape[1]) != 1
            or tuple(preserved_mask.shape[-2:]) != tuple(predicted_velocity.shape[-2:])
        ):
            raise ValueError(f"Stage 4 V2 {identity} latent mask shape changed")
        if (
            transport_weights is None
            or transport_weights.ndim != 4
            or int(transport_weights.shape[1]) != 9
            or tuple(transport_weights.shape[-2:]) != tuple(predicted_velocity.shape[-2:])
        ):
            raise ValueError(f"Stage 4 V2 {identity} transport identity changed")
        if (
            masks[index].ndim != 4
            or int(masks[index].shape[1]) != 1
            or tuple(masks[index].shape[-2:]) != tuple(predicted_rgb.shape[-2:])
        ):
            raise ValueError(f"Stage 4 V2 {identity} RGB mask shape changed")
        if tuple(proposals[index].shape) != tuple(predicted_rgb.shape):
            raise ValueError(f"Stage 4 V2 {identity} RGB proposal shape changed")
        if tuple(gated[index].shape) != tuple(predicted_rgb.shape):
            raise ValueError(f"Stage 4 V2 {identity} gated RGB shape changed")
