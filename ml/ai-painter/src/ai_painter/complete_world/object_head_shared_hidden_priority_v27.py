"""Five-group device bridge and V24 pair execution for the frozen V27 model.

Only the ten object parameters and their gradients cross the CPU boundary.
Importing this module creates no model, optimizer, CUDA context or process.
"""
from __future__ import annotations
from contextlib import nullcontext
from unittest.mock import patch
import torch
from torch import nn
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    GROUPS, apply_shared_hidden_priority_v27_cpu,
)
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import (
    CAPABILITY as MODEL_CAPABILITY, ARCHITECTURE, AGGREGATION_RULE, CONTEXT_RULE,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import (
    generator_full_fp32_backend, commit_generator_step, _autocast_enabled,
)
CANDIDATE_ID = "stage4_mvp_v27_shared_hidden_core_priority_device_v1"


def require(value, message):
    if not value:
        raise ValueError(message)


def bind_parameter_groups(model):
    parameters = tuple(model.parameters())
    named = tuple(model.named_parameters(remove_duplicate=False))
    require(len(parameters) == len(named) == 100
            and sum(p.numel() for p in parameters) == 2236015,
            "V27 complete parameter graph differs")
    require(len({id(p) for _, p in named}) == 100
            and len({p.untyped_storage().data_ptr() for p in parameters}) == 100,
            "parameter registration or storage alias prohibited")
    require(len({p.device for p in parameters}) == 1
            and all(p.dtype == torch.float32 and bool(torch.isfinite(p).all())
                    for p in parameters), "finite same-device FP32 parameters required")
    shared, adapters = model.object_shared_hidden, model.object_rgb_adapters
    require(tuple(adapters) == GROUPS[1:], "adapter order differs")
    lookup = {id(p): i for i, p in enumerate(parameters)}
    groups, owned = {}, set()
    for name, module in ((GROUPS[0], shared),
                        *((r, adapters[r]) for r in GROUPS[1:])):
        indexes = tuple(lookup[id(p)] for p in module.parameters())
        require(len(indexes) == 2 and not owned.intersection(indexes),
                "five two-tensor groups must be disjoint")
        owned.update(indexes)
        groups[name] = indexes
    require(len(owned) == 10 and sum(parameters[i].numel() for i in owned) == 1372,
            "V27 object parameter graph differs")
    require(owned == {lookup[id(p)] for name, p in named if name.startswith(
                     ("object_shared_hidden.", "object_rgb_adapters."))},
            "group coverage differs")
    return parameters, groups


def _normalize(values, parameters, name):
    require(len(values) == len(parameters), name + " count differs")
    result, unused = [], []
    for i, (value, parameter) in enumerate(zip(values, parameters)):
        if value is None:
            value = torch.zeros_like(parameter)
            unused.append(i)
        require(value.shape == parameter.shape and value.dtype == torch.float32
                and value.device == parameter.device
                and bool(torch.isfinite(value).all()), name + " metadata or finite check failed")
        result.append(value)
    return tuple(result), unused


def _carrier(parameters, groups):
    carrier = nn.Module()
    carrier.object_shared_hidden = nn.ParameterList()
    carrier.object_rgb_adapters = nn.ModuleDict()
    for name, indexes in groups.items():
        values = nn.ParameterList([nn.Parameter(parameters[i].detach().cpu().clone(),
                                   requires_grad=False) for i in indexes])
        if name == GROUPS[0]:
            carrier.object_shared_hidden = values
        else:
            carrier.object_rgb_adapters[name] = values
    return carrier


def compute_v27_generator_candidate_gradients(*, model, critic, sample,
        actual_total, structured_objective, whole_frame_fidelity, object_core_rgb,
        counter=None, resource_check=lambda: None):
    require(sample.get("split") == "train", "train-only differentiation required")
    require(all(isinstance(sample.get(k), torch.Tensor) and not sample[k].requires_grad
                for k in ("image", "conditions")), "detached source required")
    require(all(not m.training for m in critic.modules())
            and all(not p.requires_grad for p in critic.parameters()), "frozen eval critic required")
    require(not _autocast_enabled(torch), "generator autocast prohibited")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb)
    require(all(isinstance(v, torch.Tensor) and v.numel() == 1
                and v.dtype == torch.float32 and bool(torch.isfinite(v)) for v in losses),
            "finite native FP32 scalars required")
    require(torch.equal(actual_total.detach(), ((structured_objective.float()
            + whole_frame_fidelity).float() + object_core_rgb).detach()),
            "total scalar identity differs")
    parameters, groups = bind_parameter_groups(model)
    if parameters[0].is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee"
                and torch.backends.cudnn.conv.fp32_precision == "ieee",
                "explicit CUDA IEEE FP32 required")
    indexes = tuple(i for members in groups.values() for i in members)
    selected = tuple(parameters[i] for i in indexes)
    counter = {} if counter is None else counter
    def grad(loss, params, retain):
        resource_check()
        counter["autogradGradCallsAttempted"] = counter.get("autogradGradCallsAttempted", 0) + 1
        raw = torch.autograd.grad(loss, params, retain_graph=retain, allow_unused=True)
        counter["autogradGradCallsCompleted"] = counter.get("autogradGradCallsCompleted", 0) + 1
        return raw
    actual, unused = _normalize(grad(actual_total, parameters, True), parameters, "total")
    auxiliary = [_normalize(grad(loss, selected, n < 2), selected, name)
                 for n, (loss, name) in enumerate(((object_core_rgb, "core"),
                      (whole_frame_fidelity, "whole"), (structured_objective, "structured")))]
    carrier = _carrier(parameters, groups)
    selected_actual = tuple(actual[i].detach().cpu().clone() for i in indexes)
    cpu_auxiliary = [tuple(g.detach().cpu().clone() for g in values) for values, _ in auxiliary]
    candidate_cpu, reference = apply_shared_hidden_priority_v27_cpu(
        model=carrier, parameters=tuple(carrier.parameters()),
        core_gradients=cpu_auxiliary[0], whole_frame_gradients=cpu_auxiliary[1],
        structured_gradients=cpu_auxiliary[2], total_gradients=selected_actual)
    candidate = list(actual)
    offset = 0
    for name, members in groups.items():
        projected = reference["groupDiagnostics"][name]["branch"] == "conflict_projected"
        for i in members:
            if projected:
                candidate[i] = candidate_cpu[offset].to(device=parameters[i].device)
            else:
                require(torch.equal(candidate_cpu[offset].contiguous().view(torch.uint8),
                                    selected_actual[offset].contiguous().view(torch.uint8)),
                        "nonconflict reference changed bytes")
            offset += 1
    owned = set(indexes)
    require(all(candidate[i] is actual[i] for i in range(100) if i not in owned),
            "non-group actual gradient identity changed")
    diagnostics = reference["groupDiagnostics"]
    l2 = {name: float(torch.linalg.vector_norm(torch.cat(
          [candidate[i].reshape(-1) for i in members]))) for name, members in groups.items()}
    return tuple(candidate), {
        "candidateId": CANDIDATE_ID, "autogradGradCalls": 4,
        "actualTotalIndependentFullModelGradient": True,
        "auxiliaryParameterTensorCount": 10,
        "cpuCopiedParameterTensorCount": 10, "cpuCopiedParameterElementCount": 1372,
        "fullModelAuxiliaryGradientsCopiedToCpu": False,
        "groupDiagnostics": diagnostics, "headDiagnostics": diagnostics,
        "nonGroupActualTotalIdentityPreserved": True,
        "nonHeadActualTotalIdentityPreserved": True,
        "nonConflictHeadActualTotalBytesPreserved": True,
        "crossClassCouplingChanged": True,
        "parameterIdentity": {"modelParameterTensorCount": 100,
            "modelParameterElementCount": 2236015, "objectParameterTensorCount": 10,
            "groups": {name: list(members) for name, members in groups.items()}},
        "generatorGradientFacts": {"tensorCount": 100,
            "nonzeroTensorCount": sum(bool(torch.count_nonzero(g)) for g in candidate),
            "nonzeroElementCount": sum(int(torch.count_nonzero(g)) for g in candidate),
            "allFinite": True, "headCandidateL2": l2},
        "unusedGradientIndexes": {"actualTotal": unused, **{
            name: indexes for name, (_, indexes) in zip(
                ("objectCoreRgb", "wholeFrameFidelity", "structuredObjective"), auxiliary)}},
    }


def _profile():
    import painter_stage4_v24_object_head_core_priority_probe as profile
    return profile


def generator_candidate_for_sample(model, critic, sample, order, forward, kind):
    from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import (
        train_object_core_fidelity_candidate_objective,
    )
    with generator_full_fp32_backend():
        prediction = forward(kind, sample)
        total, parts = train_object_core_fidelity_candidate_objective(
            critic, prediction, sample, sample["objectInstanceTable"], order)
        gradients, facts = compute_v27_generator_candidate_gradients(
            model=model, critic=critic, sample=sample, actual_total=total,
            structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"],
            object_core_rgb=parts["objectCoreRgbWeighted"])
    return prediction, total, parts, gradients, facts


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
                 counts, ledger_row, resource, forward, after_update=lambda name, loss: None):
    profile = _profile()
    core = profile.core
    ORIGINAL_AUTOCAST = profile.ORIGINAL_AUTOCAST
    _critic_mode_snapshot = profile._critic_mode_snapshot
    _restore_critic_mode_snapshot = profile._restore_critic_mode_snapshot
    _require_critic_phase = profile._require_critic_phase
    _critic_gradient_snapshot = profile._critic_gradient_snapshot
    _critic_tensor_versions = profile._critic_tensor_versions
    critic_state_plan = profile.critic_state_plan
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
        train_structured_object_objective,
    )
    core.require(sample["split"] == "train" and sample["sampleId"] == ledger_row["sampleId"],
                 "update source differs")
    device = next(model.parameters()).device
    bound = {**sample, "conditions": sample["conditions"].detach().to(device),
             "image": sample["image"].detach().to(device)}

    def discriminator_update():
        before = counts["discriminator"]
        try:
            core.v21.update_network(critic_optimizer, d_loss, critic, bound, "discriminator",
                                    counts, 2304, resource)
        finally:
            ledger_row["discriminator"] += counts["discriminator"] - before
            after_update("discriminator", float(d_loss.detach()))

    entry = _critic_mode_snapshot(critic)
    try:
        generator_optimizer.zero_grad(set_to_none=True)
        critic.train().requires_grad_(True)
        _require_critic_phase(critic, training=True, trainable=True)
        with torch.no_grad(), (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                               if device.type == "cuda" else nullcontext()):
            detached = forward("training", bound)
        with (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
              if device.type == "cuda" else nullcontext()):
            d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, bound)
        discriminator_update()
        core.require(all(parameter.grad is None for parameter in model.parameters()),
                     "discriminator leaked generator gradient")
        critic_optimizer.zero_grad(set_to_none=True)

        critic.eval().requires_grad_(False)
        _require_critic_phase(critic, training=False, trainable=False)
        critic_before_generator = core.cpu.state_hash(critic)
        critic_gradients_before_generator = _critic_gradient_snapshot(critic)
        critic_versions_before_generator = _critic_tensor_versions(critic)
        core.require(all(value is None for value in critic_gradients_before_generator),
                     "generator phase requires cleared critic gradients")
        try:
            prediction, g_loss, parts, candidate, facts = generator_candidate_for_sample(
                model, critic, bound, order, forward, "training")
            before = counts["generator"]
            try:
                commit_generator_step(optimizer=generator_optimizer, model=model,
                    candidate_gradients=candidate, sample=bound, counts=counts, limit=2304,
                    check_resource=resource, gradient_validator=core.gpu.gradient_facts)
            finally:
                ledger_row["generator"] += counts["generator"] - before
                after_update("generator", float(g_loss.detach()))
        finally:
            core.require(core.cpu.state_hash(critic) == critic_before_generator
                and _critic_gradient_snapshot(critic) == critic_gradients_before_generator
                and _critic_tensor_versions(critic) == critic_versions_before_generator,
                "generator phase changed critic parameters, buffers, or gradients")
        core.require(all(parameter.grad is None for parameter in critic.parameters()),
                     "generator leaked frozen critic gradient")
        branches = {key: value["branch"] for key, value in facts["headDiagnostics"].items()}
        return {"generatorLoss": float(g_loss.detach()),
                "discriminatorLoss": float(d_loss.detach()),
                "corePriorityConflictHeadCount": sum(value == "conflict_projected"
                                                      for value in branches.values()),
                "corePriorityHeadBranches": branches,
                "criticStatePlan": critic_state_plan(),
                "criticGeneratorPhaseUnchanged": True}
    finally:
        _restore_critic_mode_snapshot(entry)
        core.require(all(module.training is training for module, training in entry["modules"])
            and all(parameter.requires_grad is requires_grad
                    for parameter, requires_grad in entry["parameters"]),
            "critic entry mode/trainability restoration failed")

def _zero_update_probe(model, critic, sample, order, resource, forward):
    profile = _profile()
    core = profile.core
    ORIGINAL_AUTOCAST = profile.ORIGINAL_AUTOCAST
    _require_critic_phase = profile._require_critic_phase
    precision_plan = profile.precision_plan
    critic_state_plan = profile.critic_state_plan
    object_core = profile.object_core
    import random
    import numpy as np
    before = {name: core.cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))}
    input_hashes = {key: core.cpu.tensor_hash(sample[key].detach().cpu())
                    for key in ("image", "conditions")}
    rng_before = {"torch": torch.get_rng_state().clone(), "python": random.getstate(),
                  "numpy": np.random.get_state()}
    enabled = [(value, value.requires_grad) for network in (model, critic)
               for value in network.parameters()]
    core.require(all(value.grad is None for value, _ in enabled), "probe requires clean gradients")
    with core.preserve_rng_and_modes(model, critic), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("probe optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("probe checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("probe checkpoint write prohibited")):
        try:
            model.train(); critic.eval().requires_grad_(False)
            _require_critic_phase(critic, training=False, trainable=False)
            prediction, total, parts, candidate, facts = generator_candidate_for_sample(
                model, critic, sample, order, forward, "probe")
            core.require(all(bool(torch.isfinite(value).all()) for value in candidate),
                         "nonfinite generator probe candidate")
            gradient_facts = facts["generatorGradientFacts"]
            applicable = {role: bool(sample["conditions"][order.index(role)].count_nonzero())
                          for role in GROUPS[1:]}
            core.require(gradient_facts["nonzeroTensorCount"] > 0
                and gradient_facts["nonzeroElementCount"] > 0
                and all(row["coreL2"] > 0 and row["candidateL2"] > 0
                        for name, row in facts["groupDiagnostics"].items()
                        if name == GROUPS[0] or applicable[name])
                and not facts["unusedGradientIndexes"]["actualTotal"]
                and facts["nonHeadActualTotalIdentityPreserved"] is True
                and facts["nonConflictHeadActualTotalBytesPreserved"] is True,
                "generator probe gradient reachability/preservation failed")
            core.require(all(value.grad is None for value in critic.parameters()),
                         "generator probe leaked frozen critic gradients")
            resource()
            critic.train().requires_grad_(True)
            _require_critic_phase(critic, training=True, trainable=True)
            with torch.no_grad(), (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                                   if next(model.parameters()).is_cuda else nullcontext()):
                detached = forward("probe", sample)
            with (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                  if next(model.parameters()).is_cuda else nullcontext()):
                d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, sample)
            critic_gradients = torch.autograd.grad(d_loss, tuple(critic.parameters()),
                                                   create_graph=False, allow_unused=True)
            critic_nonzero_tensors = sum(value is not None and bool(torch.count_nonzero(value))
                                         for value in critic_gradients)
            critic_nonzero_elements = sum(0 if value is None else int(torch.count_nonzero(value))
                                          for value in critic_gradients)
            core.require(all(value is not None and bool(torch.isfinite(value).all())
                             for value in critic_gradients)
                and critic_nonzero_tensors > 0 and critic_nonzero_elements > 0,
                "discriminator probe gradient reachability failed")
            core.require(all(value.grad is None for value in model.parameters()),
                         "discriminator probe leaked generator gradients")
            resource()
        finally:
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            for value, flag in enabled:
                value.requires_grad_(flag)
            core.require(before == {name: core.cpu.state_hash(network)
                         for name, network in (("Model", model), ("Critic", critic))},
                         "V24 zero-update probe changed state")
    rng_after = {"torch": torch.get_rng_state(), "python": random.getstate(),
                 "numpy": np.random.get_state()}
    rng_restored = (torch.equal(rng_before["torch"], rng_after["torch"])
        and rng_before["python"] == rng_after["python"]
        and rng_before["numpy"][0] == rng_after["numpy"][0]
        and np.array_equal(rng_before["numpy"][1], rng_after["numpy"][1])
        and rng_before["numpy"][2:] == rng_after["numpy"][2:])
    source_unchanged = input_hashes == {key: core.cpu.tensor_hash(sample[key].detach().cpu())
                                       for key in ("image", "conditions")}
    core.require(rng_restored and source_unchanged, "probe RNG or input tensors not restored")
    return {"passed": True, "optimizerCreated": False,
        "optimizerSteps": {"generator": 0, "discriminator": 0},
        "initialStateSha256": before, "finalStateSha256": before,
        "candidateId": CANDIDATE_ID, "precisionExecutionPlan": precision_plan(),
        "criticStatePlan": critic_state_plan(),
        "generatorCandidate": facts,
        "discriminatorGradientFacts": {"tensorCount": len(critic_gradients),
            "nonzeroTensorCount": critic_nonzero_tensors,
            "nonzeroElementCount": critic_nonzero_elements, "allFinite": True},
        "criticFrozenDuringGenerator": True, "criticGradientLeakDuringGenerator": False,
        "generatorGradientLeakDuringDiscriminator": False,
        "targetAndConditionsDetached": True, "sourceTensorHashesBeforeAndAfter": input_hashes,
        "sourceTensorsUnchanged": source_unchanged, "rngRestored": rng_restored,
        "gradFieldsCleared": all(value.grad is None for value, _ in enabled),
        "objectiveId": object_core.CANDIDATE_ID,
        "objectiveTerms": {key: float(parts[key].detach()) for key in
            ("v21UnchangedTotal", "wholeFrameFidelity", "objectCoreRgbWeighted", "total")}}


def train_mode_zero_update_probe(model, critic, sample, order, *, resource_check, profile=None):
    from copy import deepcopy
    require(model.capability_version == MODEL_CAPABILITY
            and model.architecture_id == ARCHITECTURE
            and model.execution_qualified is False, "V27 model identity differs")
    def forward(_kind, bound):
        require(model.training, "training-mode probe required")
        return model(bound["conditions"][None], bound["objectInstanceTable"])
    instances = deepcopy(sample["objectInstanceTable"])
    result = _zero_update_probe(model, critic, sample, order, resource_check, forward)
    require(sample["objectInstanceTable"] == instances, "object instances changed during probe")
    return {**result, "modelCapability": MODEL_CAPABILITY,
        "modelArchitecture": ARCHITECTURE, "contextIsolationRule": CONTEXT_RULE,
        "aggregationRule": AGGREGATION_RULE, "autogradGradCalls": 4,
        "discriminatorAutogradGradCalls": 1,
        "objectInstancesUnchanged": True,
        "applicableGroups": {GROUPS[0]: True, **{role:
            bool(sample["conditions"][order.index(role)].count_nonzero()) for role in GROUPS[1:]}},
        "groupGradientL2": result["generatorCandidate"]["generatorGradientFacts"]["headCandidateL2"]}
