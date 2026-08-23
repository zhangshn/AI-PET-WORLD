from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import gc
import hashlib
import json
from pathlib import Path
import sys

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SRC = PROJECT_ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world.model import build_complete_world_system
from compile_stage4_isolated_responsibility_component_inactive_configs import (
    COMPONENT_SPECS,
    GATE_FIELDS,
    OBJECT_MASK_ORDER,
    RESOLUTION_STAGES,
    ROLE_ORDER,
    build_inactive_config,
    read_json,
    resolve_registered_runtime_path,
    validate_inactive_config,
)


def tensor_sha256(tensor: torch.Tensor) -> str:
    value = tensor.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(value.dtype).encode())
    digest.update(json.dumps(list(value.shape)).encode())
    digest.update(value.numpy().tobytes())
    return digest.hexdigest()


def component_audit(config: dict, role: str) -> tuple[object, dict]:
    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    model.eval()
    namespace = f"stage4_responsibility_components.{role}."
    named = list(model.named_parameters())
    trainable = [(name, parameter) for name, parameter in named if parameter.requires_grad]
    frozen_autoencoder = [
        name for name, parameter in named
        if name.startswith("autoencoder.") and not parameter.requires_grad
    ]
    suffix_shapes = {
        name[len(namespace):]: list(parameter.shape)
        for name, parameter in trainable
        if name.startswith(namespace)
    }
    noisy = torch.linspace(-1.0, 1.0, steps=12 * 8 * 8, dtype=torch.float32).reshape(1, 12, 8, 8)
    conditions = torch.linspace(0.0, 1.0, steps=23 * 32 * 32, dtype=torch.float32).reshape(1, 23, 32, 32)
    timestep = torch.tensor([999.0], dtype=torch.float32)
    with torch.no_grad():
        output = model.predict_velocity(noisy, timestep, conditions)
    decoded_shape = None
    if role == ROLE_ORDER[2]:
        with torch.no_grad():
            decoded_shape = list(model.decode_stage4_native_complete_rgb(noisy).shape)
    audit = {
        "roleId": role,
        "reportedRoleId": model.stage4_responsibility_component_role(),
        "parameterNamespace": model.stage4_responsibility_parameter_namespace(),
        "allTrainableParametersRolePrefixed": bool(trainable) and all(
            name.startswith(namespace) for name, _ in trainable
        ),
        "trainableParameterCount": sum(parameter.numel() for _, parameter in trainable),
        "trainableTensorCount": len(trainable),
        "trainableObjectIds": {id(parameter) for _, parameter in trainable},
        "trainableDataPointers": {parameter.data_ptr() for _, parameter in trainable},
        "suffixShapes": suffix_shapes,
        "frozenAutoencoderTensorCount": len(frozen_autoencoder),
        "autoencoderAllFrozen": bool(frozen_autoencoder) and all(
            not parameter.requires_grad
            for name, parameter in named
            if name.startswith("autoencoder.")
        ),
        "outputShape": list(output.shape),
        "outputSha256": tensor_sha256(output),
        "nativeRgbDecodeShape": decoded_shape,
    }
    return model, audit


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--source-family-contract", type=Path, required=True)
    parser.add_argument("--source-parameter-audit", type=Path, required=True)
    parser.add_argument("--source-evidence-isolation", type=Path, required=True)
    args = parser.parse_args()
    source_path, _ = resolve_registered_runtime_path(args.source_config)
    family_path, family_logical = resolve_registered_runtime_path(args.source_family_contract)
    parameter_path, parameter_logical = resolve_registered_runtime_path(args.source_parameter_audit)
    isolation_path, isolation_logical = resolve_registered_runtime_path(args.source_evidence_isolation)
    source = read_json(source_path)
    family_contract = read_json(family_path)
    parameter_audit = read_json(parameter_path)
    evidence_isolation = read_json(isolation_path)
    positive: list[dict] = []
    negative: list[dict] = []

    def pos(name: str, condition: bool) -> None:
        positive.append({"name": name, "passed": bool(condition)})

    def reject(name: str, callback) -> None:
        passed = False
        try:
            callback()
        except (ValueError, KeyError, TypeError, RuntimeError):
            passed = True
        negative.append({"name": name, "passed": passed})

    pos("source_family_contract_role_order_exact", tuple(
        item["roleId"] for item in family_contract["components"]
    ) == ROLE_ORDER)
    pos("parameter_source_audit_has_no_free_values", all(
        parameter_audit[field] is False
        for field in (
            "freeModelNameChosen",
            "freeWidthChosen",
            "freeLayerCountChosen",
            "freeLossChosen",
            "freeLossWeightChosen",
            "freeHyperparameterChosen",
        )
    ))
    pos("source_evidence_requires_parameter_checkpoint_output_terminal_isolation", all(
        evidence_isolation[field] is True
        for field in (
            "parameterNamespacesIndependent",
            "checkpointIdentitiesIndependent",
            "phaseTerminalIdentitiesIndependent",
            "outputArtifactIdentitiesIndependent",
            "samePackageImmediatePredecessorOnly",
        )
    ) and evidence_isolation["sharedTrainableParametersAllowed"] is False)

    configs = {
        role: build_inactive_config(
            source,
            role,
            family_logical,
            parameter_logical,
            isolation_logical,
        )
        for role in ROLE_ORDER
    }
    for role, config in configs.items():
        validate_inactive_config(
            config,
            role,
            source,
            family_logical,
            parameter_logical,
            isolation_logical,
        )
        contract = config["training"]["stage4IsolatedResponsibilityComponent"]
        pos(f"{role}_inactive_gates_closed", tuple(contract["activationGate"]) == GATE_FIELDS and not any(contract["activationGate"].values()))
        pos(f"{role}_parameter_checkpoint_output_terminal_isolated", all((
            contract["parameterNamespaceIsolated"] is True,
            contract["sharedTrainableParametersAllowed"] is False,
            contract["checkpointIdentity"]["independent"] is True,
            contract["outputIdentity"]["independent"] is True,
            contract["phaseTerminalIdentity"]["independent"] is True,
        )))
    pos("component_predecessor_chain_exact", tuple(
        configs[role]["training"]["stage4IsolatedResponsibilityComponent"]["predecessorRoleId"]
        for role in ROLE_ORDER
    ) == ("authoritative_world_structure_binding", ROLE_ORDER[0], ROLE_ORDER[1]))
    pos("all_dimensions_uniquely_derived", all(
        configs[role]["training"]["stage4IsolatedResponsibilityComponent"]["parameterTopology"] == {
            "conditionChannels": 23,
            "latentChannels": 12,
            "autoencoderDownsampleFactor": 4,
            "baseWidth": 64,
            "widthHierarchy": [64, 128, 256],
            "timeEmbeddingChannels": 256,
            "resolutionStages": [dict(value) for value in RESOLUTION_STAGES],
        }
        for role in ROLE_ORDER
    ))
    pos("object_masks_immutable_and_ordered", configs[ROLE_ORDER[1]]["training"]["stage4IsolatedResponsibilityComponent"]["approvedObjectMaskOrder"] == list(OBJECT_MASK_ORDER) and configs[ROLE_ORDER[1]]["training"]["stage4IsolatedResponsibilityComponent"]["approvedObjectMasksModificationAllowed"] is False)
    final_boundary = configs[ROLE_ORDER[2]]["training"]["stage4IsolatedResponsibilityComponent"]["finalOutputBoundary"]
    pos("final_native_complete_rgb_boundary_exact", final_boundary == {
        "appliesToThisRole": True,
        "stage2OnlyFormalCandidate": True,
        "width": 1024,
        "height": 768,
        "channels": 3,
        "nativeCompleteFrame": True,
        "tileAllowed": False,
        "patchAllowed": False,
        "spriteAllowed": False,
        "localAssemblyAllowed": False,
        "lowResolutionUpscaleAllowed": False,
        "ruleProgramRenderingAllowed": False,
    })

    models = {}
    audits = {}
    for role in ROLE_ORDER:
        model, audit = component_audit(configs[role], role)
        models[role] = model
        audits[role] = audit
        pos(f"{role}_model_role_and_namespace_exact", audit["reportedRoleId"] == role and audit["parameterNamespace"] == f"stage4_responsibility_components.{role}")
        pos(f"{role}_only_role_namespace_trainable", audit["allTrainableParametersRolePrefixed"] and audit["autoencoderAllFrozen"])
        pos(f"{role}_latent_output_shape_exact", audit["outputShape"] == [1, 12, 8, 8])
    pos("three_component_parameter_objects_disjoint", all(
        audits[left]["trainableObjectIds"].isdisjoint(audits[right]["trainableObjectIds"])
        and audits[left]["trainableDataPointers"].isdisjoint(audits[right]["trainableDataPointers"])
        for index, left in enumerate(ROLE_ORDER)
        for right in ROLE_ORDER[index + 1:]
    ))
    common_topology_keys = {
        name for name in audits[ROLE_ORDER[0]]["suffixShapes"]
        if not name.startswith("semantic_mixture_")
    }
    pos("three_component_existing_shared_topology_shapes_equal", all(
        {name: audits[role]["suffixShapes"][name] for name in common_topology_keys}
        == {name: audits[ROLE_ORDER[0]]["suffixShapes"][name] for name in common_topology_keys}
        for role in ROLE_ORDER
    ))
    pos("responsibility_specific_existing_expert_sets_exact", all((
        {
            name.split(".")[1]
            for name in audits[ROLE_ORDER[0]]["suffixShapes"]
            if name.startswith("semantic_mixture_experts.")
        } == {"route"},
        {
            name.split(".")[1]
            for name in audits[ROLE_ORDER[1]]["suffixShapes"]
            if name.startswith("semantic_mixture_experts.")
        } == {"footprints", "tree", "rock", "vegetation"},
        not any(
            name.startswith("semantic_mixture_")
            for name in audits[ROLE_ORDER[2]]["suffixShapes"]
        ),
    )))
    topology = audits[ROLE_ORDER[0]]["suffixShapes"]
    pos("exact_64_128_256_and_time_256_shapes", all((
        topology["latent_stem.weight"] == [64, 12, 3, 3],
        topology["latent_down1.weight"] == [128, 64, 4, 4],
        topology["latent_down2.weight"] == [256, 128, 4, 4],
        topology["time_embedding.1.weight"] == [256, 64],
        topology["output.2.weight"] == [12, 64, 3, 3],
    )))
    pos("final_component_native_rgb_decode_uses_frozen_4x_autoencoder", audits[ROLE_ORDER[2]]["nativeRgbDecodeShape"] == [1, 3, 32, 32])
    reject("non_final_native_rgb_decode_rejected", lambda: models[ROLE_ORDER[0]].decode_stage4_native_complete_rgb(torch.zeros(1, 12, 8, 8)))

    unknown = deepcopy(configs[ROLE_ORDER[0]]); unknown["stage4ResponsibilityComponentRole"] = "unknown"
    reject("unknown_role_rejected", lambda: build_complete_world_system(unknown))
    controlled = deepcopy(configs[ROLE_ORDER[0]]); controlled["stage4ControlledStructureArm"] = "baseline_current_formal_structure"
    reject("controlled_arm_cross_injection_rejected", lambda: build_complete_world_system(controlled))
    wrong_width = deepcopy(configs[ROLE_ORDER[0]]); wrong_width["denoiserBaseChannels"] = 128
    reject("free_base_width_rejected", lambda: build_complete_world_system(wrong_width))
    wrong_condition = deepcopy(configs[ROLE_ORDER[0]]); wrong_condition["conditionChannels"] = 24
    reject("condition_channel_change_rejected", lambda: build_complete_world_system(wrong_condition))
    wrong_latent = deepcopy(configs[ROLE_ORDER[0]]); wrong_latent["latentChannels"] = 4
    reject("latent_channel_change_rejected", lambda: build_complete_world_system(wrong_latent))
    wrong_factor = deepcopy(configs[ROLE_ORDER[0]]); wrong_factor["latentDownsampleFactor"] = 8
    reject("autoencoder_factor_change_rejected", lambda: build_complete_world_system(wrong_factor))
    wrong_architecture = deepcopy(configs[ROLE_ORDER[0]]); wrong_architecture["denoiserArchitecture"] = "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"
    reject("free_architecture_rejected", lambda: build_complete_world_system(wrong_architecture))

    def invalid(role: str, mutate) -> None:
        value = deepcopy(configs[role])
        mutate(value)
        validate_inactive_config(value, role, source, family_logical, parameter_logical, isolation_logical)

    reject("missing_responsibility_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["responsibilities"].pop()))
    reject("reordered_roles_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["roleOrder"].reverse()))
    reject("shared_parameter_namespace_rejected", lambda: invalid(ROLE_ORDER[1], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("parameterNamespace", "shared")))
    reject("shared_trainable_parameters_rejected", lambda: invalid(ROLE_ORDER[1], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("sharedTrainableParametersAllowed", True)))
    reject("cross_run_predecessor_rejected", lambda: invalid(ROLE_ORDER[1], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("crossRunEvidenceAllowed", True)))
    reject("wrong_predecessor_rejected", lambda: invalid(ROLE_ORDER[2], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("predecessorRoleId", ROLE_ORDER[0])))
    reject("free_time_embedding_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["parameterTopology"].__setitem__("timeEmbeddingChannels", 512)))
    reject("free_width_hierarchy_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["parameterTopology"].__setitem__("widthHierarchy", [64, 96, 192])))
    reject("resolution_change_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["parameterTopology"]["resolutionStages"][0].__setitem__("width", 128)))
    reject("new_loss_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["lossBoundary"]["permittedExistingLossIdentities"].append("new_loss")))
    reject("loss_weight_change_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["lossBoundary"].__setitem__("lossWeightChangeAllowed", True)))
    reject("object_mask_order_change_rejected", lambda: invalid(ROLE_ORDER[1], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["approvedObjectMaskOrder"].reverse()))
    reject("object_mask_modification_rejected", lambda: invalid(ROLE_ORDER[1], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("approvedObjectMasksModificationAllowed", True)))
    reject("tile_output_rejected", lambda: invalid(ROLE_ORDER[2], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["finalOutputBoundary"].__setitem__("tileAllowed", True)))
    reject("upscaled_output_rejected", lambda: invalid(ROLE_ORDER[2], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["finalOutputBoundary"].__setitem__("lowResolutionUpscaleAllowed", True)))
    reject("checkpoint_injection_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["checkpointIdentity"].__setitem__("historicalCheckpointAllowed", True)))
    reject("gpu_activation_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].__setitem__("gpuUseNow", True)))
    reject("optimizer_activation_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].__setitem__("optimizerCreationNow", True)))
    reject("backward_activation_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].__setitem__("backwardExecutionNow", True)))
    reject("training_activation_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].__setitem__("trainingNow", True)))
    reject("data_change_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value.__setitem__("datasetPackageModelId", "changed")))
    reject("unknown_field_rejected", lambda: invalid(ROLE_ORDER[0], lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].__setitem__("freeField", 1)))

    for model in models.values():
        del model
    gc.collect()
    status = "passed" if all(item["passed"] for item in positive + negative) else "failed"
    serializable_audits = {
        role: {key: value for key, value in audit.items() if key not in {"trainableObjectIds", "trainableDataPointers", "suffixShapes"}}
        for role, audit in audits.items()
    }
    report = {
        "schemaVersion": "stage4-isolated-responsibility-component-cpu-report-v1",
        "status": status,
        "positive": {"passed": sum(item["passed"] for item in positive), "total": len(positive), "cases": positive},
        "negative": {"passed": sum(item["passed"] for item in negative), "total": len(negative), "cases": negative},
        "componentAudits": serializable_audits,
        "exactTopologyShapes": topology,
        "executionBoundary": {
            "checkpointRead": False,
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    torch.set_num_threads(1)
    raise SystemExit(main())
