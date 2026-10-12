"""Real production V27 math on synthetic inputs, never GPU or real assets."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch
from torch import nn
ROOT = Path(__file__).resolve().parents[3]
for p in ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests"):
    sys.path.insert(0, str(ROOT / p))
from test_object_head_shared_hidden_v27_cpu import ORDER, scene
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import build_fresh_object_head_shared_hidden_v27_cpu
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    apply_shared_hidden_priority_v27_cpu,
)
from ai_painter.complete_world import object_head_shared_hidden_priority_v27 as bridge
import painter_stage4_v27_dry_single_world_checkpoint_worker as worker

def fixture():
    model, critic = worker.fresh_networks(ORDER)
    conditions, table = scene()
    sample = {"sampleId": "synthetic-v27", "split": "train",
        "conditions": conditions[0], "image": torch.linspace(0, 1, 256)
            [None, None, :].expand(3, 192, 256).contiguous(),
        "objectInstanceTable": table}
    return model, critic, sample


class DeviceBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_actual_full_loss_gradients_agree_with_frozen_reference(self):
        model, critic, sample = fixture()
        model.train()
        critic.eval().requires_grad_(False)
        raw = []
        original = torch.autograd.grad
        def capture(loss, parameters, **kwargs):
            parameters = tuple(parameters)
            values = original(loss, parameters, **kwargs)
            raw.append((parameters, values))
            return values
        def forward(_kind, bound):
            return model(bound["conditions"][None], bound["objectInstanceTable"])
        with patch.object(torch.autograd, "grad", capture):
            _, _, _, candidate, facts = bridge.generator_candidate_for_sample(
                model, critic, sample, ORDER, forward, "training")
        self.assertEqual([len(params) for params, _ in raw], [100, 10, 10, 10])
        parameters, groups = bridge.bind_parameter_groups(model)
        indexes = [i for members in groups.values() for i in members]
        auxiliaries = []
        for _, values in raw[1:]:
            expanded = [None] * 100
            for i, value in zip(indexes, values):
                expanded[i] = value
            auxiliaries.append(tuple(expanded))
        expected, reference = apply_shared_hidden_priority_v27_cpu(
            model=model, parameters=parameters, total_gradients=raw[0][1],
            core_gradients=auxiliaries[0], whole_frame_gradients=auxiliaries[1],
            structured_gradients=auxiliaries[2])
        self.assertEqual(tuple(facts["groupDiagnostics"]), bridge.GROUPS)
        self.assertEqual(facts["groupDiagnostics"], reference["groupDiagnostics"])
        for i, (value, wanted) in enumerate(zip(candidate, expected)):
            self.assertTrue(torch.equal(value.view(torch.uint8), wanted.view(torch.uint8)))
            if i not in indexes:
                self.assertIs(value, raw[0][1][i])
        self.assertEqual(facts["cpuCopiedParameterTensorCount"], 10)
        self.assertFalse(torch.cuda.is_initialized())

    def test_production_pair_commits_once_with_original_adamw_and_mode_switch(self):
        model, critic, sample = fixture()
        before = deepcopy(model.state_dict())
        source = sample["conditions"].clone()
        instances = deepcopy(sample["objectInstanceTable"])
        modes = [(module, module.training) for module in critic.modules()]
        opts = dict(lr=.0001, betas=(.9, .999), eps=1e-8,
                    weight_decay=.01, foreach=False, fused=False)
        generator = torch.optim.AdamW(model.parameters(), **opts)
        discriminator = torch.optim.AdamW(critic.parameters(), **opts)
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], **counts}
        phases = []
        def forward(kind, bound):
            phases.append((critic.training, all(p.requires_grad for p in critic.parameters()),
                           torch.is_autocast_enabled("cpu")))
            return model(bound["conditions"][None], bound["objectInstanceTable"])
        result = bridge.perform_pair(model, critic, sample, ORDER, generator, discriminator,
            counts, ledger, lambda: None, forward)
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual(ledger, {"sampleId": sample["sampleId"], **counts})
        self.assertEqual(phases, [(True, True, False), (False, False, False)])
        self.assertTrue(result["criticGeneratorPhaseUnchanged"])
        self.assertEqual(len(result["corePriorityHeadBranches"]), 5)
        self.assertTrue(any(not torch.equal(before[k], v) for k, v in model.state_dict().items()))
        self.assertTrue(torch.equal(source, sample["conditions"]))
        self.assertEqual(instances, sample["objectInstanceTable"])
        self.assertTrue(all(module.training == flag for module, flag in modes))
        for optimizer in (generator, discriminator):
            self.assertEqual(len(optimizer.state), len(list(optimizer.param_groups[0]["params"])))
            self.assertTrue(all(float(state["step"]) == 1 for state in optimizer.state.values()))
        model_state = deepcopy(model.state_dict())
        optimizer_state = worker.base.nested_state_hash(generator.state_dict())
        validation = {**sample, "split": "validation"}
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("validation gradient")):
            observed = worker.base.validation_observation(model, validation, ORDER, epoch=24)
        self.assertEqual(observed["split"], "validation")
        self.assertEqual(optimizer_state, worker.base.nested_state_hash(generator.state_dict()))
        self.assertTrue(all(torch.equal(model_state[k], v) for k, v in model.state_dict().items()))
        with self.assertRaisesRegex(ValueError, "source"):
            bridge.perform_pair(model, critic, validation, ORDER, generator, discriminator,
                counts, ledger, lambda: None, forward)
        self.assertEqual(optimizer_state, worker.base.nested_state_hash(generator.state_dict()))
        self.assertTrue(all(torch.equal(model_state[k], v) for k, v in model.state_dict().items()))
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertFalse(torch.cuda.is_initialized())

    def test_five_conflict_zero_and_nonconflict_branches_preserve_identity(self):
        model, critic, sample = fixture()
        critic.eval().requires_grad_(False)
        params, groups = bridge.bind_parameter_groups(model)
        for c, other in ((1., -2.), (0., -2.), (1., 2.), (1., 0.)):
            core = sum(p.sum() * c for p in params)
            whole = sum(p.sum() * other for p in params)
            structured = sum(p.sum() * 0 for p in params)
            total = (structured + whole) + core
            raw = []
            original = torch.autograd.grad
            def capture(loss, parameters, **kwargs):
                values = original(loss, parameters, **kwargs)
                raw.append(values)
                return values
            with patch.object(torch.autograd, "grad", capture):
                result, facts = bridge.compute_v27_generator_candidate_gradients(
                    model=model, critic=critic, sample=sample, actual_total=total,
                    structured_objective=structured, whole_frame_fidelity=whole,
                    object_core_rgb=core)
            for name, members in groups.items():
                diag = facts["groupDiagnostics"][name]
                if c and other < 0:
                    self.assertEqual(diag["branch"], "conflict_projected")
                    for i in members:
                        self.assertTrue(torch.equal(result[i], torch.ones_like(params[i])))
                else:
                    for i in members:
                        self.assertIs(result[i], raw[0][i])
                        self.assertEqual(diag["changedByteCount"], 0)

    def test_alias_metadata_and_partial_autograd_fault_fail_closed(self):
        model, critic, sample = fixture()
        model.alias = model.object_shared_hidden
        with self.assertRaisesRegex(ValueError, "graph|alias"):
            bridge.bind_parameter_groups(model)
        del model.alias
        critic.eval().requires_grad_(False)
        params = tuple(model.parameters())
        core = sum(p.sum() for p in params)
        whole, structured = core * 2, core * 3
        total, counter = (structured + whole) + core, {}
        original, calls = torch.autograd.grad, []
        def fail(loss, parameters, **kwargs):
            calls.append(1)
            if len(calls) == 3:
                raise RuntimeError("injected auxiliary failure")
            return original(loss, parameters, **kwargs)
        with patch.object(torch.autograd, "grad", fail), self.assertRaisesRegex(RuntimeError, "injected"):
            bridge.compute_v27_generator_candidate_gradients(model=model, critic=critic,
                sample=sample, actual_total=total, structured_objective=structured,
                whole_frame_fidelity=whole, object_core_rgb=core, counter=counter)
        self.assertEqual(counter, {"autogradGradCallsAttempted": 3, "autogradGradCallsCompleted": 2})
        self.assertTrue(all(p.grad is None for p in params))

    def test_zero_update_train_probe_restores_actual_state_rng_and_inputs(self):
        model, critic, sample = fixture()
        before = {label: worker.base.v24.core.cpu.state_hash(network)
                  for label, network in (("Model", model), ("Critic", critic))}
        rng = torch.get_rng_state().clone()
        result = bridge.train_mode_zero_update_probe(model, critic, sample, ORDER,
                                                     resource_check=lambda: None)
        self.assertEqual(result["initialStateSha256"], before)
        self.assertEqual(result["finalStateSha256"], before)
        self.assertEqual(tuple(result["groupGradientL2"]), bridge.GROUPS)
        self.assertTrue(all(value > 0 for value in result["groupGradientL2"].values()))
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())

    def test_zero_update_probe_checks_only_applicable_adapters(self):
        model, critic, sample = fixture()
        conditions, instances = scene(((40, 40, 7, "tree"),))
        sample.update(conditions=conditions[0], objectInstanceTable=instances)
        result = bridge.train_mode_zero_update_probe(model, critic, sample, ORDER,
                                                     resource_check=lambda: None)
        self.assertTrue(result["applicableGroups"]["shared_hidden"])
        self.assertTrue(result["applicableGroups"]["object_tree"])
        self.assertFalse(result["applicableGroups"]["object_rock"])
        self.assertFalse(result["applicableGroups"]["object_vegetation"])
        self.assertEqual(result["groupGradientL2"]["object_rock"], 0)
        self.assertEqual(result["groupGradientL2"]["object_vegetation"], 0)


if __name__ == "__main__":
    unittest.main()
