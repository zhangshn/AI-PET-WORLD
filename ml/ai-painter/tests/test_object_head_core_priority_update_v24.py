"""CPU tests for the managed-entry V24 gradient integration."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import numpy as np
import torch
from torch import nn

from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    build_conditional_texture_discriminator,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import (
    ADAMW_BETAS, ADAMW_EPS, ADAMW_WEIGHT_DECAY, CANDIDATE_ID,
    EXPECTED_HEAD_PARAMETER_ELEMENTS, EXPECTED_HEAD_PARAMETER_TENSORS,
    bind_v23_object_head_parameters, commit_generator_step,
    compute_v24_generator_candidate_gradients,
    generator_full_fp32_backend,
)


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
    "ai-painter-complete-map-condition-contract-v1.json").read_text(encoding="utf8"))
    ["tensorContract"]["channelOrder"])


class V24ManagedUpdateCpuTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.model = build_fresh_native_rgb_complete_support_partition_v23_cpu(
            condition_channel_order=ORDER)
        self.critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
        self.sample = {"split": "train", "image": torch.zeros(3, 192, 256),
                       "conditions": torch.zeros(23, 192, 256)}

    def losses(self):
        parameters, indexes = bind_v23_object_head_parameters(self.model)
        heads = {index for values in indexes.values() for index in values}
        tree = set(indexes["object_tree"])
        core = sum((parameters[index].sum() for index in heads), torch.zeros(()))
        whole = sum((-2 * parameters[index].sum() for index in tree), torch.zeros(()))
        structured = sum((parameters[index].sum() for index in range(len(parameters))
                          if index not in heads), torch.zeros(()))
        total = (structured.float() + whole).float() + core
        return parameters, indexes, total, structured, whole, core

    def compute(self):
        _, _, total, structured, whole, core = self.losses()
        return compute_v24_generator_candidate_gradients(
            model=self.model, critic=self.critic, sample=self.sample,
            actual_total=total, structured_objective=structured,
            whole_frame_fidelity=whole, object_core_rgb=core)

    def test_real_v23_heads_full_identity_and_cpu_reference_equivalence(self):
        parameters, indexes, *_ = self.losses()
        self.assertEqual(len(parameters), 106)
        self.assertEqual(sum(len(value) for value in indexes.values()),
                         EXPECTED_HEAD_PARAMETER_TENSORS)
        self.assertEqual(sum(parameters[index].numel() for values in indexes.values()
                             for index in values), EXPECTED_HEAD_PARAMETER_ELEMENTS)
        with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
            candidate, facts = self.compute()
        self.assertEqual(grad.call_count, 4)
        self.assertEqual(facts["candidateId"], CANDIDATE_ID)
        self.assertTrue(facts["actualTotalIndependentFullModelGradient"])
        self.assertTrue(facts["cpuReferenceExact"])
        self.assertFalse(facts["fullModelAuxiliaryGradientsCopiedToCpu"])
        self.assertEqual(facts["headDiagnostics"]["object_tree"]["branch"],
                         "conflict_projected")
        for key in ("object_footprints", "object_rock", "object_vegetation"):
            self.assertEqual(facts["headDiagnostics"][key]["branch"],
                             "non_conflict_preserve_actual_total")
        self.assertEqual(len(candidate), len(parameters))

    def test_nonheads_and_nonconflict_heads_reuse_actual_gradient_objects(self):
        parameters, indexes, total, structured, whole, core = self.losses()
        actual = torch.autograd.grad(total, parameters, retain_graph=True, allow_unused=True)
        candidate, facts = compute_v24_generator_candidate_gradients(
            model=self.model, critic=self.critic, sample=self.sample,
            actual_total=total, structured_objective=structured,
            whole_frame_fidelity=whole, object_core_rgb=core)
        # A separate autograd call cannot share tensor object identity, so prove
        # the integration's stated branches and exact bytes instead.
        tree = set(indexes["object_tree"])
        for index, (left, right) in enumerate(zip(candidate, actual)):
            if index not in tree:
                self.assertTrue(torch.equal(left.contiguous().view(torch.uint8),
                                            right.contiguous().view(torch.uint8)))
        self.assertGreater(facts["headDiagnostics"]["object_tree"]["changedByteCount"], 0)

    def test_nontrain_attached_inputs_trainable_critic_precision_and_nonfinite_rejected(self):
        _, _, total, structured, whole, core = self.losses()
        arguments = dict(model=self.model, critic=self.critic, sample=self.sample,
            actual_total=total, structured_objective=structured,
            whole_frame_fidelity=whole, object_core_rgb=core)
        bad = dict(arguments); bad["sample"] = {**self.sample, "split": "validation"}
        with self.assertRaisesRegex(ValueError, "non-train"):
            compute_v24_generator_candidate_gradients(**bad)
        bad = dict(arguments); bad["sample"] = {**self.sample,
            "conditions": self.sample["conditions"].requires_grad_()}
        with self.assertRaisesRegex(ValueError, "detached"):
            compute_v24_generator_candidate_gradients(**bad)
        self.sample["conditions"] = self.sample["conditions"].detach()
        self.critic.requires_grad_(True)
        with self.assertRaisesRegex(ValueError, "critic must be frozen"):
            compute_v24_generator_candidate_gradients(**arguments)
        self.critic.requires_grad_(False)
        with patch.object(torch, "is_autocast_enabled", return_value=True), \
             self.assertRaisesRegex(ValueError, "forbids autocast"):
            compute_v24_generator_candidate_gradients(**arguments)
        bad = dict(arguments); bad["actual_total"] = total.double()
        with self.assertRaisesRegex(ValueError, "native float32"):
            compute_v24_generator_candidate_gradients(**bad)
        bad = dict(arguments); bad["actual_total"] = total * torch.tensor(float("nan"))
        with self.assertRaisesRegex(ValueError, "finite"):
            compute_v24_generator_candidate_gradients(**bad)

    def test_distinct_parameters_sharing_actual_head_storage_are_rejected(self):
        tree = self.model.object_rgb_heads["object_tree"][0].weight
        self.model.object_rgb_heads["object_rock"][0].weight = nn.Parameter(tree.detach())
        self.assertIsNot(tree, self.model.object_rgb_heads["object_rock"][0].weight)
        self.assertEqual(tree.untyped_storage().data_ptr(),
                         self.model.object_rgb_heads["object_rock"][0].weight
                         .untyped_storage().data_ptr())
        with self.assertRaisesRegex(ValueError, "shared model parameter storage"):
            bind_v23_object_head_parameters(self.model)

    def test_computation_preserves_model_grad_rng_and_source_tensors(self):
        state = deepcopy(self.model.state_dict())
        image = self.sample["image"].clone(); conditions = self.sample["conditions"].clone()
        torch_rng = torch.get_rng_state().clone(); python_rng = random.getstate()
        numpy_rng = np.random.get_state()
        candidate, _ = self.compute()
        self.assertTrue(all(parameter.grad is None for parameter in self.model.parameters()))
        self.assertTrue(all(torch.equal(value, self.model.state_dict()[key])
                            for key, value in state.items()))
        self.assertTrue(torch.equal(image, self.sample["image"]))
        self.assertTrue(torch.equal(conditions, self.sample["conditions"]))
        self.assertTrue(torch.equal(torch_rng, torch.get_rng_state()))
        self.assertEqual(python_rng, random.getstate())
        after = np.random.get_state(); self.assertEqual(numpy_rng[0], after[0])
        self.assertTrue(np.array_equal(numpy_rng[1], after[1])); self.assertEqual(numpy_rng[2:], after[2:])
        self.assertTrue(all(value.grad_fn is None for value in candidate))

    def test_synthetic_optimizer_step_and_failure_count_are_exact(self):
        model = nn.Linear(2, 1, bias=False)
        optimizer = torch.optim.AdamW(model.parameters(), lr=.0001,
            betas=ADAMW_BETAS, eps=ADAMW_EPS, weight_decay=ADAMW_WEIGHT_DECAY,
            foreach=False, fused=False)
        gradient = (torch.ones_like(model.weight),)
        counts = {"generator": 0}
        commit_generator_step(optimizer=optimizer, model=model,
            candidate_gradients=gradient, sample={"split": "train"}, counts=counts,
            limit=1, check_resource=lambda: None,
            gradient_validator=lambda network, device: None)
        self.assertEqual(counts["generator"], 1)

        model = nn.Linear(2, 1, bias=False)
        optimizer = torch.optim.AdamW(model.parameters(), lr=.0001,
            betas=ADAMW_BETAS, eps=ADAMW_EPS, weight_decay=ADAMW_WEIGHT_DECAY,
            foreach=False, fused=False)
        counts = {"generator": 0}; calls = []
        def resource():
            calls.append(1)
            if len(calls) == 2:
                raise RuntimeError("post-step failure")
        with self.assertRaisesRegex(RuntimeError, "post-step failure"):
            commit_generator_step(optimizer=optimizer, model=model,
                candidate_gradients=(torch.ones_like(model.weight),),
                sample={"split": "train"}, counts=counts, limit=1,
                check_resource=resource, gradient_validator=lambda network, device: None)
        self.assertEqual(counts["generator"], 1)

    def test_current_fp32_backend_context_restores_normal_exception_and_partial_setter_failure(self):
        matmul_before = torch.backends.cuda.matmul.fp32_precision
        conv_before = torch.backends.cudnn.conv.fp32_precision
        with generator_full_fp32_backend():
            self.assertEqual(torch.backends.cuda.matmul.fp32_precision, "ieee")
            self.assertEqual(torch.backends.cudnn.conv.fp32_precision, "ieee")
        self.assertEqual(torch.backends.cuda.matmul.fp32_precision, matmul_before)
        self.assertEqual(torch.backends.cudnn.conv.fp32_precision, conv_before)
        with self.assertRaisesRegex(RuntimeError, "inside"):
            with generator_full_fp32_backend():
                raise RuntimeError("inside")
        self.assertEqual(torch.backends.cuda.matmul.fp32_precision, matmul_before)
        self.assertEqual(torch.backends.cudnn.conv.fp32_precision, conv_before)

        class Backend:
            def __init__(self, value, fail=False):
                object.__setattr__(self, "value", value)
                object.__setattr__(self, "fail", fail)
            @property
            def fp32_precision(self):
                return self.value
            @fp32_precision.setter
            def fp32_precision(self, value):
                if self.fail and value == "ieee":
                    raise RuntimeError("second setter failed")
                object.__setattr__(self, "value", value)

        matmul = Backend("none")
        conv = Backend("tf32", fail=True)
        with self.assertRaisesRegex(RuntimeError, "second setter failed"):
            with generator_full_fp32_backend(cuda_matmul=matmul, cudnn_conv=conv):
                self.fail("context body must not run")
        self.assertEqual(matmul.fp32_precision, "none")
        self.assertEqual(conv.fp32_precision, "tf32")


if __name__ == "__main__":
    unittest.main()
