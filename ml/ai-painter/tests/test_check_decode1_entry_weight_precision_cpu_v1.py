"""Synthetic request and five-VJP regressions; not the one real CPU verification."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import check_decode1_entry_weight_precision_cpu_v1 as worker

torch.set_num_threads(2)


class RequestTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / worker.POLICY_PATH).read_text(encoding="utf-8"))
        self.request = dict(schemaVersion="decode1-entry-precision-cpu-request-v1",
            runId="decode1-entry-cpu-00000000-0000-4000-8000-000000000001",
            outputRoot=self.policy["outputRoot"] + "/decode1-entry-cpu-00000000-0000-4000-8000-000000000001",
            policy=dict(path=worker.POLICY_PATH, sha256="a" * 64),
            programBindings=[deepcopy(self.policy["metadataCanonicalProgram"])],
            interpreter=dict(path=sys.executable, sha256="b" * 64),
            nodeInterpreter=deepcopy(self.policy["nodeInterpreter"]), deadlineUnixMs=110000, mode="cpu_candidate_check")

    def check(self):
        worker.validate_request(self.request, self.policy, now=100)

    def test_exact_registered_request(self): self.check()

    def test_wrong_mode(self):
        self.request["mode"] = "train"
        with self.assertRaises(ValueError): self.check()

    def test_unknown_field(self):
        self.request["skipChecks"] = True
        with self.assertRaises(ValueError): self.check()

    def test_old_namespace(self):
        self.request["runId"] = "parameter48-gpu-00000000-0000-4000-8000-000000000001"
        with self.assertRaises(ValueError): self.check()

    def test_wrong_target(self):
        self.policy["target"]["parameterIndex"] = 52
        with self.assertRaises(ValueError): self.check()

    def test_validation_not_accepted(self):
        self.policy["scope"]["split"] = "validation"
        with self.assertRaises(ValueError): self.check()

    def test_failed_state_initialization_not_accepted(self):
        self.policy["scope"]["failureStateInitializationAllowed"] = True
        with self.assertRaises(ValueError): self.check()

    def test_extra_forward_not_accepted(self):
        self.policy["limits"]["fullCandidateForwards"] = 2
        with self.assertRaises(ValueError): self.check()

    def test_relaxed_threshold_not_accepted(self):
        self.policy["comparison"]["atol"] = 1e-4
        with self.assertRaises(ValueError): self.check()

    def test_higher_resource_budget_not_accepted(self):
        self.policy["resources"]["maxWallSeconds"] = 121
        with self.assertRaises(ValueError): self.check()

    def test_gpu_not_accepted(self):
        self.policy["qualification"]["gpuExecutionAllowed"] = True
        with self.assertRaises(ValueError): self.check()

    def test_expired_or_extended_deadline(self):
        for deadline in (100000, 221000):
            self.request["deadlineUnixMs"] = deadline
            with self.assertRaises(ValueError): self.check()

    def test_wrong_output_or_claim(self):
        self.request["outputRoot"] += "/extra"
        with self.assertRaises(ValueError): self.check()

    def test_missing_canonical_source(self):
        self.request["programBindings"] = [dict(path="scripts/x.mjs", sha256="a" * 64)]
        with self.assertRaises(ValueError): self.check()

    def test_duplicate_source(self):
        self.request["programBindings"] *= 2
        with self.assertRaises(ValueError): self.check()

    def test_wrong_node(self):
        self.request["nodeInterpreter"]["sha256"] = "0" * 64
        with self.assertRaises(ValueError): self.check()


class FiveGradientTests(unittest.TestCase):
    def setUp(self):
        self.model = torch.nn.ParameterList([torch.nn.Parameter(torch.tensor(float(i + 1) / 1000)) for i in range(108)])
        self.carrier = torch.nn.ParameterList([torch.nn.Parameter(v.detach().clone()) for v in self.model])
        self.model.capability_version = worker.candidate.CAPABILITY
        self.carrier.capability_version = worker.parent.CAPABILITY
        self.parts = tuple(sum((v.square() * scale for v in self.model)) for scale in (.03, .02, .05, .01))
        total = ((self.parts[0] + self.parts[1]) + self.parts[2]) + self.parts[3]
        self.losses = (total, *self.parts)
        self.counts = {key: 0 for key in worker.LIMITS}

    def apply(self, **kwargs):
        self.assertIs(kwargs["model"], self.carrier)
        self.assertEqual(len(kwargs["total_gradients"]), 108)
        self.assertTrue(all(v is not None for v in kwargs["total_gradients"]))
        return kwargs["total_gradients"], dict(nonHeadActualTotalIdentityPreserved=True)

    def test_five_independent_vjps_use_candidate_not_carrier(self):
        original = torch.autograd.grad
        with patch.object(worker, "verify_parameter_mapping"), \
             patch.object(worker.arithmetic, "apply_object_joint_rgb_structure_priority_update_cpu", side_effect=self.apply) as gate, \
             patch.object(torch.autograd, "grad", wraps=original) as observed:
            facts = worker.compute_checked_gradients(self.model, self.carrier, self.losses, self.counts, lambda: None)
        self.assertEqual(observed.call_count, 5)
        self.assertEqual([row.kwargs["retain_graph"] for row in observed.call_args_list], [True, True, True, True, False])
        self.assertEqual(gate.call_count, 1)
        self.assertEqual(self.counts["fullGeneratorAutogradCalls"], 5)
        self.assertEqual(facts["independentFullParameterGradientTensorCounts"], [108] * 5)
        self.assertEqual(facts["arithmeticCarrierCapabilityVersion"], worker.parent.CAPABILITY)
        self.assertFalse(facts["carrierQualificationInherited"])
        self.assertTrue(all(v.grad is None for v in (*self.model, *self.carrier)))

    def test_other_layer_failure_propagates_after_exactly_five_calls(self):
        with patch.object(worker, "verify_parameter_mapping"), patch.object(worker.arithmetic,
                "apply_object_joint_rgb_structure_priority_update_cpu", side_effect=ValueError("gradient failure parameter 60")):
            with self.assertRaisesRegex(ValueError, "parameter 60"):
                worker.compute_checked_gradients(self.model, self.carrier, self.losses, self.counts, lambda: None)
        self.assertEqual(self.counts["fullGeneratorAutogradCalls"], 5)
        self.assertTrue(all(v.grad is None for v in self.model))

    def test_changed_scalar_formula_fails_before_autograd(self):
        with patch.object(worker, "verify_parameter_mapping"), patch.object(torch.autograd, "grad") as grad:
            with self.assertRaisesRegex(ValueError, "scalar formula"):
                worker.compute_checked_gradients(self.model, self.carrier,
                    (self.losses[0] + 1, *self.parts), self.counts, lambda: None)
        grad.assert_not_called()

    def test_mapping_failure_precedes_autograd(self):
        with patch.object(worker, "verify_parameter_mapping", side_effect=ValueError("carrier bytes differ")), \
             patch.object(torch.autograd, "grad") as grad:
            with self.assertRaisesRegex(ValueError, "carrier bytes"):
                worker.compute_checked_gradients(self.model, self.carrier, self.losses, self.counts, lambda: None)
        grad.assert_not_called()

    def test_resource_failure_is_not_retried(self):
        with patch.object(worker, "verify_parameter_mapping"), patch.object(torch.autograd, "grad") as grad:
            with self.assertRaisesRegex(ValueError, "deadline"):
                worker.compute_checked_gradients(self.model, self.carrier, self.losses, self.counts,
                    lambda: (_ for _ in ()).throw(ValueError("deadline")))
        grad.assert_not_called()
        self.assertEqual(self.counts["fullGeneratorAutogradCalls"], 0)


if __name__ == "__main__": unittest.main()
