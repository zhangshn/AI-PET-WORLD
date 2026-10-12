"""Zero-update train-mode check for the V26 object-head candidate.

This is an execution component, not a qualification or training entry. The
caller must separately authenticate package, GPU, data and resource identity.
"""
from __future__ import annotations

import random
from contextlib import nullcontext
from unittest.mock import patch

import numpy as np
import torch

from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    ARCHITECTURE, CAPABILITY, CONTEXT_RULE, AGGREGATION_RULE,
    DeterministicObjectAssemblyRenderer,
)


def _same_numpy_rng(left, right):
    return (left[0] == right[0]
            and np.array_equal(left[1], right[1])
            and left[2:] == right[2:])


def train_mode_zero_update_probe(model, critic, sample, order, *,
                                 profile, resource_check):
    """Exercise actual V24 objective with V26 private context isolation; preserve all inputs/state."""
    if (model.architecture_id != ARCHITECTURE
            or model.capability_version != CAPABILITY
            or model.execution_qualified is not False
            or sample.get("split") != "train"):
        raise ValueError("V26 model or train sample identity differs")
    heads = model.object_rgb_heads
    if (set(heads) != {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
            or not isinstance(model.core.core, DeterministicObjectAssemblyRenderer)
            or model.object_aggregation_rule != AGGREGATION_RULE
            or model.object_context_rule != CONTEXT_RULE
            or any(isinstance(module, torch.nn.Dropout2d) for module in model.modules())):
        raise ValueError("V26 isolated context graph differs")

    if not callable(resource_check):
        raise ValueError("resource check required")
    core = profile.core
    before = {"Model": core.cpu.state_hash(model),
              "Critic": core.cpu.state_hash(critic)}
    source = {key: core.cpu.tensor_hash(sample[key])
              for key in ("conditions", "image")}
    enabled = tuple((parameter, bool(parameter.requires_grad))
                    for network in (model, critic)
                    for parameter in network.parameters())
    if any(parameter.grad is not None for parameter, _ in enabled):
        raise ValueError("V26 probe requires empty parameter.grad fields")
    torch_rng = torch.get_rng_state().clone()
    cuda_rng = torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else None
    python_rng, numpy_rng = random.getstate(), np.random.get_state()
    modes = tuple((module, bool(module.training))
                  for network in (model, critic) for module in network.modules())
    result = None
    try:
        model.train()
        critic.eval().requires_grad_(False)

        def forward(_kind, bound):
            if not model.training:
                raise ValueError("V26 model not in training mode")
            return model(bound["conditions"][None], bound["objectInstanceTable"])

        resource_check()
        with (patch.object(torch.optim.Optimizer, "__init__",
                           side_effect=RuntimeError("V26 probe optimizer prohibited")),
              patch.object(torch, "load",
                           side_effect=RuntimeError("V26 probe checkpoint load prohibited")),
              patch.object(torch, "save",
                           side_effect=RuntimeError("V26 probe checkpoint write prohibited"))):
            prediction, loss, _, gradients, facts = profile.generator_candidate_for_sample(
                model, critic, sample, order, forward, "training")
            critic.train().requires_grad_(True)
            device = next(model.parameters()).device
            with torch.no_grad(), (profile.ORIGINAL_AUTOCAST(
                    "cuda", dtype=torch.bfloat16)
                    if device.type == "cuda" else nullcontext()):
                detached = forward("training", sample)
            with (profile.ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                  if device.type == "cuda" else nullcontext()):
                critic_loss, _ = core.gpu.detached_discriminator_objective(
                    critic, detached, sample)
            critic_gradients = torch.autograd.grad(
                critic_loss, tuple(critic.parameters()), allow_unused=True)
            if (not all(value is not None and bool(torch.isfinite(value).all())
                        for value in critic_gradients)
                    or not any(bool(torch.count_nonzero(value))
                               for value in critic_gradients)):
                raise ValueError("V26 critic gradient probe failed")
        if (not bool(torch.isfinite(prediction).all())
                or not bool(torch.isfinite(loss))
                or facts.get("autogradGradCalls") != 4
                or any(value <= 0 for value in facts["generatorGradientFacts"]
                       ["headCandidateL2"].values())
                or len(gradients) != len(tuple(model.parameters()))
                or any(gradient is None or not bool(torch.isfinite(gradient).all())
                       for gradient in gradients)):
            raise ValueError("V26 train-mode gradient probe failed")
        resource_check()
        result = {"passed": True, "sampleId": sample["sampleId"],
                  "split": "train", "modelArchitecture": ARCHITECTURE,
                  "modelCapability": CAPABILITY, "contextIsolationRule": CONTEXT_RULE,
                  "aggregationRule": AGGREGATION_RULE,
                  "autogradGradCalls": 4,
                  "discriminatorAutogradGradCalls": 1,
                  "headGradientL2": facts["generatorGradientFacts"]["headCandidateL2"],
                  "optimizerCreated": False,
                  "optimizerSteps": {"generator": 0, "discriminator": 0},
                  "initialStateSha256": before}
    finally:
        for parameter, flag in enabled:
            parameter.requires_grad_(flag)
            parameter.grad = None
        for module, flag in modes:
            module.training = flag
        torch.set_rng_state(torch_rng)
        if cuda_rng is not None:
            torch.cuda.set_rng_state_all(cuda_rng)
        random.setstate(python_rng)
        np.random.set_state(numpy_rng)
    after = {"Model": core.cpu.state_hash(model),
             "Critic": core.cpu.state_hash(critic)}
    if (after != before
            or source != {key: core.cpu.tensor_hash(sample[key]) for key in source}
            or not torch.equal(torch_rng, torch.get_rng_state())
            or (cuda_rng is not None and not all(
                torch.equal(left, right) for left, right in
                zip(cuda_rng, torch.cuda.get_rng_state_all())))
            or python_rng != random.getstate()
            or not _same_numpy_rng(numpy_rng, np.random.get_state())
            or any(parameter.grad is not None for parameter, _ in enabled)):
        raise ValueError("V26 zero-update probe changed state, inputs, or RNG")
    return {**result, "finalStateSha256": after,
            "sourceTensorsUnchanged": True, "rngRestored": True,
            "gradFieldsCleared": True}
