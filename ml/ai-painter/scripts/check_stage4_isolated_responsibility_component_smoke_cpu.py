from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import inspect
import json
from pathlib import Path
from types import SimpleNamespace

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world import add_noise, velocity_target
from ai_painter_preview_reproduction import state_dict_sha256, tensor_sha256
from ai_painter_preview_reproduction import fixed_preview_determinism_scope
from ai_painter_stage_mode_registry import resolve_stage_mode
from prepare_stage4_isolated_responsibility_component_smoke_config import ROLES, SAMPLE_ID, compile_active, project_runtime_relative
from train_stage4_isolated_responsibility_component_smoke import _component_loss, _validate
import train_ai_assisted_conditional_denoiser as formal


SMOKE_ACTION = "--stage4-controlled-three-component-stage0-model-smoke"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    package = json.loads(args.dataset_package.read_text(encoding="utf-8"))
    positive = []
    negative = []

    def pos(name, condition):
        if not condition:
            raise AssertionError(name)
        positive.append(name)

    def reject(name, callback):
        try:
            callback()
        except (ValueError, KeyError, AssertionError):
            negative.append(name)
            return
        raise AssertionError(name)

    configs = []
    runner_source = (Path.cwd() / "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs").read_text(encoding="utf-8")
    trainer_source = inspect.getsource(__import__("train_stage4_isolated_responsibility_component_smoke"))
    loss_source = inspect.getsource(formal.multiscale_latent_hierarchy_losses)
    validate_real_node_entry(runner_source)
    pos("real_node_main_entry_registered", runner_source.count(SMOKE_ACTION) >= 2)
    pos("real_node_preflight_invocation_not_shadowed", "const trainerArgs = trainerArgs(" not in runner_source)
    pos("logical_registered_runtime_path_accepted", project_runtime_relative(Path(".runtime/ai-painter/cpu-fixture.json")) == ".runtime/ai-painter/cpu-fixture.json")
    validate_determinism_contract(trainer_source, loss_source)
    pos("training_and_preview_determinism_scopes_separated", True)
    deterministic_before = torch.get_deterministic_debug_mode()
    cudnn_before = bool(torch.backends.cudnn.deterministic)
    benchmark_before = bool(torch.backends.cudnn.benchmark)
    with fixed_preview_determinism_scope():
        pos("fixed_preview_scope_enables_strict_determinism", torch.are_deterministic_algorithms_enabled())
    pos("fixed_preview_scope_restores_global_state", torch.get_deterministic_debug_mode() == deterministic_before and bool(torch.backends.cudnn.deterministic) == cudnn_before and bool(torch.backends.cudnn.benchmark) == benchmark_before)
    for component in contract["components"]:
        role = component["roleId"]
        source_path = Path.cwd() / component["sourceConfig"]["path"]
        source = json.loads(source_path.read_text(encoding="utf-8"))
        authorization = {
            "packageId": contract["packageId"],
            "requestId": f"cpu-fixture-{role}", "commandRef": f"cpu-fixture-{role}",
            "scope": f"one_30_epoch_stage0_smoke_for_{role}",
            "authorizationPath": f".runtime/cpu-fixture/{role}.json",
            "authorizationSha256": "0" * 64,
            "bindings": {
                "sourceConfig": component["sourceConfig"],
                "compiledSmokeContract": {"path": str(args.contract.as_posix()), "sha256": "0" * 64},
            },
            "predecessor": component["predecessor"],
        }
        active = compile_active(source, authorization, None, "preflight_unconsumed")
        configs.append(active)
        mode = resolve_stage_mode(active)
        pos(f"{role}_active_mode_registered", mode.active_execution and mode.execution_kind == "single_sample_smoke")
        ns = SimpleNamespace(
            preflight_only=True, overfit_sample_id=SAMPLE_ID, overfit_epochs=30,
            overfit_evaluation_interval=5, initial_denoiser_checkpoint=None,
        )
        validated_role, smoke = _validate(ns, active, package)
        pos(f"{role}_trainer_gate_accepts_exact_contract", validated_role == role and smoke["roleId"] == role)
        diagnostics = active["training"]["stage4FailureDiagnostics"]
        diagnostic_active = role == ROLES[2]
        pos(
            f"{role}_diagnostic_identity_matches_responsibility",
            diagnostics["status"] == (
                "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_smoke"
                if diagnostic_active
                else "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
            )
            and all(
                diagnostics[key] is diagnostic_active
                for key in (
                    "trainingConfigApplied", "checkpointFileReadAuthorized",
                    "gpuUseAuthorized", "trainingAuthorized",
                )
            ),
        )
        model = build_complete_world_system(active)
        names = [name for name, _ in model.named_parameters() if name.startswith("stage4_responsibility_components.")]
        prefix = f"stage4_responsibility_components.{role}."
        pos(f"{role}_parameter_namespace_isolated", bool(names) and all(name.startswith(prefix) for name in names))
        conditions = torch.zeros(1, 23, 16, 16)
        output = model.predict_velocity(torch.zeros(1, 12, 16, 16), torch.tensor([999.0]), conditions)
        pos(f"{role}_output_shape_preserved", list(output.shape) == [1, 12, 16, 16])
        loss_audit = audit_real_component_loss(model, role, active)
        pos(f"{role}_condition_reconstruction_forwarding_exact", loss_audit["forwardingExact"])
        pos(f"{role}_real_loss_finite", loss_audit["lossFinite"])
        pos(f"{role}_formal_parameter_gradients_finite_nonzero", loss_audit["allFormalGradientsFiniteNonzero"])
        pos(f"{role}_state_dict_identity_unchanged", loss_audit["stateDictUnchanged"])
        pos(f"{role}_output_byte_identity_unchanged", loss_audit["outputByteIdentityUnchanged"])

    pos("three_roles_strict_order", [value["stage4ResponsibilityComponentRole"] for value in configs] == list(ROLES))
    pos("three_parameter_namespaces_pairwise_distinct", len({value["training"]["stage4IsolatedResponsibilityComponent"]["parameterNamespace"] for value in configs}) == 3)
    pos("all_forbidden_later_stage_gates_closed", all(not value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"][key] for value in configs for key in ("stage1Now", "stage2Now", "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow")))
    qualification_authorization = {
        "packageId": contract["packageId"], "requestId": "cpu-readonly-qualification",
        "commandRef": "cpu-readonly-qualification", "scope": "readonly_gpu_qualification",
        "authorizationPath": ".runtime/cpu-fixture/qualification.json", "authorizationSha256": "0" * 64,
        "bindings": {"sourceConfig": contract["components"][0]["sourceConfig"], "compiledSmokeContract": {"path": args.contract.as_posix(), "sha256": "0" * 64}},
        "predecessor": {"kind": "authoritative_world_structure_binding"},
    }
    qualification_config = compile_active(
        json.loads((Path.cwd() / contract["components"][0]["sourceConfig"]["path"]).read_text(encoding="utf-8")),
        qualification_authorization,
        {"path": ".runtime/cpu-fixture/qualification-consumption.json", "sha256": "1" * 64},
        "readonly_qualification_consumed",
    )
    qualification_gates = qualification_config["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"]
    qualification_owner = qualification_config["training"]["ownerTrainingAuthorization"]
    pos("readonly_gpu_qualification_gates_exact", {key for key, enabled in qualification_gates.items() if enabled} == {"configurationActiveNow", "checkpointReadNow", "gpuUseNow"})
    pos("readonly_gpu_qualification_forbids_optimizer_backward_and_weight_change", qualification_owner["optimizerCreationAuthorized"] is False and qualification_owner["backwardExecutionAuthorized"] is False and qualification_owner["modelWeightMutationAuthorized"] is False)

    fixture = configs[0]
    ns = SimpleNamespace(preflight_only=True, overfit_sample_id=SAMPLE_ID, overfit_epochs=30, overfit_evaluation_interval=5, initial_denoiser_checkpoint=None)
    reject("unknown_role_rejected", lambda: _validate(ns, {**fixture, "stage4ResponsibilityComponentRole": "unknown"}, package))
    reject("role_contract_swap_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4IsolatedResponsibilityComponent"].update({"roleId": ROLES[1]})), package))
    reject("missing_active_gate_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].update({"trainingNow": False})), package))
    reject("stage1_gate_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].update({"stage1Now": True})), package))
    reject("wrong_sample_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4ControlledThreeComponentStage0SmokeExecution"].update({"sampleId": "wrong"})), package))
    reject("wrong_seed_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4ControlledThreeComponentStage0SmokeExecution"].update({"seed": 1})), package))
    reject("wrong_epoch_count_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4ControlledThreeComponentStage0SmokeExecution"].update({"epochCount": 29})), package))
    reject("wrong_preview_order_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["stage4ControlledThreeComponentStage0SmokeExecution"].update({"previewEpochs": [1, 10, 5, 20, 30]})), package))
    reject("automatic_retry_rejected", lambda: _validate(ns, mutation(fixture, lambda value: value["training"]["ownerTrainingAuthorization"].update({"automaticRetryAuthorized": True})), package))
    reject("historical_checkpoint_rejected", lambda: _validate(SimpleNamespace(**{**vars(ns), "initial_denoiser_checkpoint": Path("old.pt")}), fixture, package))
    reject("dataset_capacity_change_rejected", lambda: _validate(ns, fixture, {**package, "v7CapacityContributionCount": 63}))
    reject("cli_epoch_change_rejected", lambda: _validate(SimpleNamespace(**{**vars(ns), "overfit_epochs": 29}), fixture, package))
    reject("missing_real_node_main_entry_rejected", lambda: validate_real_node_entry(runner_source.rsplit(SMOKE_ACTION, 1)[0]))
    reject("shadowed_trainer_preflight_invocation_rejected", lambda: validate_preflight_invocation("const trainerArgs = trainerArgs(active, output, null, true)"))
    reject("runtime_parent_traversal_rejected", lambda: project_runtime_relative(Path(".runtime/../outside.json")))
    reject("external_absolute_path_rejected", lambda: project_runtime_relative(Path("C:/external/component-smoke.json")))
    reject("global_training_determinism_rejected", lambda: validate_determinism_contract(trainer_source + "\ntorch.use_deterministic_algorithms(True)\n", loss_source))
    reject("warn_only_determinism_rejected", lambda: validate_determinism_contract(trainer_source + "\ntorch.use_deterministic_algorithms(True, warn_only=True)\n", loss_source))
    reject("fixed_seed_removal_rejected", lambda: validate_determinism_contract(trainer_source.replace("formal.set_seed(SEED)", ""), loss_source))
    reject("area_semantics_change_rejected", lambda: validate_determinism_contract(trainer_source, loss_source.replace('mode="area"', 'mode="bilinear"')))

    report = {
        "schemaVersion": "stage4-controlled-three-component-stage0-smoke-cpu-report-v1",
        "status": "passed",
        "positive": positive, "negative": negative,
        "positiveCount": len(positive), "negativeCount": len(negative),
        "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False,
        "trainingStarted": False,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def mutation(value, callback):
    result = deepcopy(value)
    callback(result)
    return result


def validate_real_node_entry(source: str) -> None:
    dispatch = f'argv.includes("{SMOKE_ACTION}")'
    main_entry = f'process.argv.includes("{SMOKE_ACTION}")'
    if dispatch not in source or main_entry not in source:
        raise ValueError("controlled_three_component_smoke_real_node_entry_missing")


def validate_preflight_invocation(source: str) -> None:
    if "const trainerArgs = trainerArgs(" in source:
        raise ValueError("controlled_three_component_smoke_trainer_preflight_shadowed")


def validate_determinism_contract(trainer_source: str, loss_source: str) -> None:
    if "formal.set_seed(SEED)" not in trainer_source:
        raise ValueError("component_smoke_fixed_seed_missing")
    if "torch.use_deterministic_algorithms(True)" in trainer_source:
        raise ValueError("component_smoke_training_global_strict_determinism_forbidden")
    if "warn_only=True" in trainer_source or "warn_only = True" in trainer_source:
        raise ValueError("component_smoke_determinism_difference_swallowing_forbidden")
    if "with fixed_preview_determinism_scope():" not in trainer_source:
        raise ValueError("component_smoke_fixed_preview_determinism_scope_missing")
    if 'mode="area"' not in loss_source:
        raise ValueError("component_smoke_area_loss_semantics_changed")


def audit_real_component_loss(model, role: str, config: dict) -> dict:
    torch.manual_seed(20263722)
    model.eval()
    clean = torch.randn(1, 12, 8, 8)
    source = torch.randn_like(clean)
    conditions = torch.rand(1, 23, 32, 32)
    image = torch.rand(1, 3, 32, 32)
    timestep = torch.tensor([500], dtype=torch.long)
    diffusion = formal.build_diffusion_schedule(config, torch.device("cpu"))
    target_velocity = velocity_target(clean, source, timestep, diffusion["alphasCumulative"])
    normalization = {
        "mean": torch.zeros(1, 12, 1, 1),
        "standardDeviation": torch.ones(1, 12, 1, 1),
    }
    state_before = state_dict_sha256(model.state_dict())
    with torch.no_grad():
        output_before = model.predict_velocity(source, timestep.float(), conditions)
        probe_input = torch.randn(1, 12, 8, 8)
        forwarded = model.reconstruct_conditions_from_clean_latent(probe_input)
        direct = model.denoiser.reconstruct_conditions_from_clean_latent(probe_input)
    metrics = _component_loss(
        model, role, source, clean, target_velocity, timestep, diffusion,
        conditions, image, normalization, config,
    )
    loss = metrics["compositeLossTensor"]
    named_parameters = [
        (name, parameter)
        for name, parameter in model.named_parameters()
        if name.startswith(f"stage4_responsibility_components.{role}.")
        and parameter.requires_grad
    ]
    gradients = torch.autograd.grad(loss, [parameter for _, parameter in named_parameters], allow_unused=True)
    gradient_checks = [
        gradient is not None
        and bool(torch.isfinite(gradient).all())
        and int(torch.count_nonzero(gradient)) > 0
        for gradient in gradients
    ]
    with torch.no_grad():
        output_after = model.predict_velocity(source, timestep.float(), conditions)
    return {
        "forwardingExact": tensor_sha256(forwarded) == tensor_sha256(direct),
        "lossFinite": bool(torch.isfinite(loss)),
        "allFormalGradientsFiniteNonzero": bool(named_parameters) and all(gradient_checks),
        "stateDictUnchanged": state_before == state_dict_sha256(model.state_dict()),
        "outputByteIdentityUnchanged": tensor_sha256(output_before) == tensor_sha256(output_after),
    }


if __name__ == "__main__":
    raise SystemExit(main())
