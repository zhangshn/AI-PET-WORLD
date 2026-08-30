from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ML_ROOT = PROJECT_ROOT / "ml" / "ai-painter"
TEST_ROOT = ML_ROOT / "tests"
if str(ML_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ML_ROOT / "scripts"))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    compile_joint_condition_local_transport_cpu_inactive_config,
    validate_joint_condition_local_transport_cpu_inactive_config,
)


def main() -> None:
    positives: list[str] = []
    negatives: list[str] = []
    config = compile_joint_condition_local_transport_cpu_inactive_config()
    validation = validate_joint_condition_local_transport_cpu_inactive_config(
        config
    )
    assert validation["parameterCount"] == 22464
    positives.append("inactive_config_and_mode_registry_binding_are_exact")

    torch = require_torch()
    torch.manual_seed(20263722)
    model = build_complete_world_system(config).cpu().eval()
    transport_parameters = {
        name: parameter
        for name, parameter in model.named_parameters()
        if ".local_transport_" in name
    }
    assert len(transport_parameters) == 24
    assert sum(value.numel() for value in transport_parameters.values()) == 22464
    assert len({id(value) for value in transport_parameters.values()}) == 24
    assert not any(
        ".spatial_affine_" in name for name, _value in model.named_parameters()
    )
    positives.append("twelve_sites_twenty_four_tensors_and_parameter_math_passed")

    noisy_latent = torch.randn(1, 12, 8, 8)
    conditions = torch.randn(1, 23, 32, 32, requires_grad=True)
    output = model.predict_velocity(noisy_latent, torch.tensor([37]), conditions)
    assert tuple(output.shape) == (1, 12, 8, 8)
    assert bool(torch.isfinite(output).all())
    gradients = torch.autograd.grad(
        output.square().mean(),
        [conditions, *transport_parameters.values()],
        allow_unused=True,
    )
    assert all(gradient is not None for gradient in gradients)
    assert all(bool(torch.isfinite(gradient).all()) for gradient in gradients)
    assert all(float(gradient.abs().max()) > 0 for gradient in gradients)
    positives.append("cpu_forward_and_all_transport_parameter_gradients_passed")

    block = model.denoiser.block0
    constant = torch.full((1, 64, 5, 6), 2.75)
    block_conditions = torch.randn(1, 23, 5, 6)
    with torch.no_grad():
        weights = block.joint_condition_local_transport_weights(
            constant,
            block_conditions,
            block.local_transport_norm1,
        )
        transported = block.apply_joint_condition_local_transport(
            constant,
            block_conditions,
            block.local_transport_norm1,
        )
    assert bool(torch.all(weights >= 0))
    assert bool(torch.allclose(
        weights.sum(dim=1),
        torch.ones_like(weights[:, 0]),
        atol=1e-6,
        rtol=0,
    ))
    assert float(weights[0, 0, 0, 0]) == 0
    assert float(weights[0, 1, 0, 0]) == 0
    assert float(weights[0, 3, 0, 0]) == 0
    assert bool(torch.allclose(transported, constant, atol=1e-6, rtol=0))
    positives.append("simplex_off_canvas_and_constant_world_boundary_passed")

    mutation_specs = (
        ("condition_channel_change_rejected", lambda value: value.__setitem__(
            "conditionChannels", 24
        )),
        ("site_count_change_rejected", lambda value: value[
            "jointConditionLocalTransportContract"
        ].__setitem__("siteCount", 11)),
        ("temperature_change_rejected", lambda value: value[
            "jointConditionLocalTransportContract"
        ].__setitem__("softmaxTemperature", 0.5)),
        ("site_sharing_rejected", lambda value: value[
            "jointConditionLocalTransportContract"
        ].__setitem__("siteProjectionSharingAllowed", True)),
        ("affine_coexistence_rejected", lambda value: value[
            "jointConditionLocalTransportContract"
        ].__setitem__("spatialAffineCoexistenceAllowed", True)),
        ("objective_alignment_claim_rejected", lambda value: value[
            "jointConditionLocalTransportContract"
        ].__setitem__("objectiveReviewAlignmentClaimed", True)),
        ("checkpoint_gate_rejected", lambda value: value[
            "activationGates"
        ].__setitem__("checkpointReadNow", True)),
        ("gpu_gate_rejected", lambda value: value[
            "activationGates"
        ].__setitem__("gpuNow", True)),
        ("optimizer_gate_rejected", lambda value: value[
            "activationGates"
        ].__setitem__("optimizerNow", True)),
        ("training_gate_rejected", lambda value: value[
            "activationGates"
        ].__setitem__("trainingNow", True)),
    )
    for label, mutate in mutation_specs:
        invalid = deepcopy(config)
        mutate(invalid)
        try:
            validate_joint_condition_local_transport_cpu_inactive_config(
                invalid
            )
        except ValueError:
            negatives.append(label)
        else:
            raise AssertionError(f"invalid mutation accepted: {label}")

    report = {
        "schemaVersion": (
            "ai-painter-stage4-joint-condition-local-transport-cpu-report-v1"
        ),
        "status": "passed",
        "architectureId": ARCHITECTURE_ID,
        "exactDerivedIdentity": {
            "blockCount": 6,
            "siteCount": 12,
            "parameterTensorCount": 24,
            "parameterCount": 22464,
        },
        "positivePassed": len(positives),
        "positiveTotal": len(positives),
        "negativePassed": len(negatives),
        "negativeTotal": len(mutation_specs),
        "positives": positives,
        "negatives": negatives,
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "trainingStarted": False,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
