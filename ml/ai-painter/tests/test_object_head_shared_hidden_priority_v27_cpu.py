"""Hand-computable five-group projections and strict alias/error controls."""
import unittest
from unittest.mock import patch
from pathlib import Path
import sys
import tempfile
import hashlib
import json
import torch
from torch import nn
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    ROLES, GROUPS, bind_parameter_groups, apply_shared_hidden_priority_v27_cpu,
    compute_shared_hidden_priority_gradients_v27_cpu,
)


class Tiny(nn.Module):
    def __init__(self):
        super().__init__()
        self.other = nn.Linear(2, 1, bias=False)
        self.object_shared_hidden = nn.Linear(2, 1, bias=False)
        self.object_rgb_adapters = nn.ModuleDict({r: nn.Linear(2, 1, bias=False) for r in ROLES})


def apply(model, core, whole, structured, total):
    return apply_shared_hidden_priority_v27_cpu(model=model, parameters=tuple(model.parameters()),
        core_gradients=core, whole_frame_gradients=whole, structured_gradients=structured, total_gradients=total)


class PriorityTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.model = Tiny()
        self.params, self.groups = bind_parameter_groups(self.model)

    def case(self, c, o):
        core = tuple(torch.tensor([c], dtype=torch.float32).reshape_as(p) for p in self.params)
        whole = tuple(torch.tensor([o], dtype=torch.float32).reshape_as(p) for p in self.params)
        structured = tuple(torch.zeros_like(p) for p in self.params)
        total = tuple((s+w)+v for s, w, v in zip(structured, whole, core))
        return core, whole, structured, total

    def test_all_five_conflict_groups_once_and_original_non_group(self):
        inputs = self.case([1, 0], [-2, 1])
        before = tuple(p.detach().clone() for p in self.params)
        result, facts = apply(self.model, *inputs)
        self.assertEqual(tuple(facts["groupDiagnostics"]), GROUPS)
        for indexes in self.groups.values():
            self.assertTrue(torch.equal(result[indexes[0]], torch.tensor([[1., 1.]])))
        self.assertIs(result[0], inputs[3][0])
        self.assertTrue(all(torch.equal(p, b) for p, b in zip(self.params, before)))
        self.assertTrue(all(p.grad is None for p in self.params))

    def test_zero_nonconflict_orthogonal_byte_and_identity_preservation(self):
        for c, o in (([0, 0], [-2, 1]), ([1, 0], [2, 1]), ([1, 0], [0, 2])):
            inputs = self.case(c, o)
            result, facts = apply(self.model, *inputs)
            self.assertTrue(all(a is b for a, b in zip(result, inputs[3])))
            self.assertTrue(all(f["changedByteCount"] == 0 for f in facts["groupDiagnostics"].values()))

    def test_alias_registration_storage_missing_and_sequence_rejected(self):
        self.model.alias = self.model.object_shared_hidden
        with self.assertRaisesRegex(ValueError, "alias"):
            bind_parameter_groups(self.model)
        del self.model.alias
        self.model.object_rgb_adapters[ROLES[0]].weight = nn.Parameter(self.model.object_shared_hidden.weight.detach())
        with self.assertRaisesRegex(ValueError, "storage"):
            bind_parameter_groups(self.model)
        with self.assertRaisesRegex(ValueError, "canonical"):
            bind_parameter_groups(Tiny(), self.params[::-1])

    def test_invalid_gradient_metadata_and_independent_identity(self):
        inputs = list(self.case([1, 0], [-2, 1]))
        for value in (torch.tensor([[float("nan"), 0]]), torch.ones(1, 2, dtype=torch.float64), torch.ones(3)):
            bad = list(inputs[0]); bad[1] = value
            with self.assertRaises(ValueError):
                apply(self.model, tuple(bad), *inputs[1:])
        bad = list(inputs[3]); bad[1] = bad[1] + 1
        with self.assertRaisesRegex(ValueError, "identity"):
            apply(self.model, *inputs[:3], tuple(bad))

    def test_counter_tracks_failed_autograd_without_updates(self):
        critic = nn.Linear(1, 1).eval().requires_grad_(False)
        core = sum(p.sum() for p in self.params)
        whole = core * 2; structured = core * 3; total = (structured+whole)+core
        sample = {"split": "train", "image": torch.zeros(1), "conditions": torch.zeros(1)}
        counter = {}
        with patch.object(torch.autograd, "grad", side_effect=RuntimeError("injected")):
            with self.assertRaisesRegex(RuntimeError, "injected"):
                compute_shared_hidden_priority_gradients_v27_cpu(model=self.model, critic=critic,
                    sample=sample, actual_total=total, structured_objective=structured,
                    whole_frame_fidelity=whole, object_core_rgb=core, counter=counter)
        self.assertEqual(counter, {"autogradGradCallsAttempted": 1})
        self.assertTrue(all(p.grad is None for p in self.params))

    def test_complete_aggregated_core_reaches_shared_exactly_once(self):
        critic = nn.Linear(1, 1).eval().requires_grad_(False)
        shared = self.model.object_shared_hidden.weight
        core = sum((i+1) * (shared.sum() + self.model.object_rgb_adapters[r].weight.sum())
                   for i, r in enumerate(ROLES))
        whole = shared.sum() * -20
        structured = self.model.other.weight.sum() * 3
        total = (structured + whole) + core
        sample = {"split": "train", "image": torch.zeros(1), "conditions": torch.zeros(1)}
        result, facts = compute_shared_hidden_priority_gradients_v27_cpu(model=self.model, critic=critic,
            sample=sample, actual_total=total, structured_objective=structured,
            whole_frame_fidelity=whole, object_core_rgb=core)
        # sum(1..4)=10: complete aggregate reaches shared once, projected
        # negative other removes -20, yielding [10,10], not four updates.
        self.assertTrue(torch.equal(result[self.groups["shared_hidden"][0]], torch.tensor([[10., 10.]])))
        self.assertEqual(facts["groupDiagnostics"]["shared_hidden"]["qCoreSquaredL2"], 200)
        self.assertTrue(torch.equal(result[0], torch.tensor([[3., 3.]])))


class CheckerControlsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml/ai-painter/scripts"))
        import check_stage4_mvp256_dry_v27_cpu as checker
        cls.checker = checker

    def test_cpu_guard_blocks_optimizer_checkpoint_backward(self):
        with self.checker.zero_update_guard():
            with self.assertRaisesRegex(RuntimeError, "optimizer"):
                torch.optim.SGD([nn.Parameter(torch.ones(1))], lr=.1)
            with self.assertRaisesRegex(RuntimeError, "checkpoint"):
                torch.load("synthetic-unused")
            with self.assertRaisesRegex(RuntimeError, "checkpoint"):
                torch.save({}, "synthetic-unused")
            with self.assertRaisesRegex(RuntimeError, "backward"):
                torch.ones(1, requires_grad=True).backward()

    def test_failure_is_immutable_claim_consumed_and_global_state_restored(self):
        checker = self.checker
        threads = torch.get_num_threads(); rng = torch.random.get_rng_state().clone()
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "ROOT", Path(directory)):
            contract_path = checker.project_file(checker.CONTRACT_PATH)
            contract_path.parent.mkdir(parents=True)
            payload = b'{"synthetic":true}'
            contract_path.write_bytes(payload)
            binding = {"path": checker.CONTRACT_PATH, "sha256": hashlib.sha256(payload).hexdigest()}
            def fail(*_args):
                torch.manual_seed(9)
                raise RuntimeError("synthetic contract rejection")
            with patch.object(checker, "validate_contract", side_effect=fail):
                with self.assertRaisesRegex(RuntimeError, "synthetic contract rejection"):
                    checker.execute(binding)
            failure_path = checker.project_file(checker.DIRECTORY+"/failure.json")
            original = failure_path.read_bytes()
            failure = json.loads(original)
            self.assertEqual(failure["realCallCounts"], {"modelForwardsAttempted": 0,
                "modelForwardsCompleted": 0, "autogradGradCallsAttempted": 0, "autogradGradCallsCompleted": 0})
            with self.assertRaisesRegex(ValueError, "consumed"):
                checker.execute(binding)
            self.assertEqual(original, failure_path.read_bytes())
            self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
            self.assertEqual(threads, torch.get_num_threads())

    def test_contract_changed_bytes_rejected_before_claim_and_unsafe_paths(self):
        checker = self.checker
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "ROOT", Path(directory)):
            path = checker.project_file(checker.CONTRACT_PATH); path.parent.mkdir(parents=True)
            path.write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError, "SHA mismatch"):
                checker.execute({"path": checker.CONTRACT_PATH, "sha256": "0"*64})
            self.assertFalse(checker.project_file(checker.DIRECTORY+"/claim.json").exists())
            for unsafe in ("../escape", "C:/escape", "/escape", "a\\b"):
                with self.assertRaises(ValueError): checker.project_file(unsafe)

    def test_contract_activation_tamper_rejected_without_assets(self):
        checker = self.checker
        class Reader:
            def json(self, _binding):
                return {"schemaVersion": checker.SCHEMA, "status": "cpu_only_inactive_not_execution_qualified",
                    "immutable": True, "capabilityVersion": checker.CAPABILITY,
                    "modelPlan": checker.MODEL_PLAN, "gradientPlan": checker.GRADIENT_PLAN,
                    "resourceBound": checker.RESOURCES, "activation": {**checker.ACTIVATION, "gpuAllowed": True}}
        with self.assertRaisesRegex(ValueError, "activation"):
            checker.validate_contract(Reader(), {"path": checker.CONTRACT_PATH, "sha256": "0"*64})


if __name__ == "__main__":
    unittest.main()
