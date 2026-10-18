"""Synthetic CPU objective tests; no real renderer, data, optimizer or CUDA."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import torch
from torch.nn import functional as F

from ai_painter.complete_world import native_rgb_object_support_structure_candidate_cpu_v1 as candidate
from ai_painter.complete_world import native_rgb_object_core_fidelity_candidate_cpu as inherited
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import complete_typed_support_partition
from ai_painter.complete_world.object_instance_supervision_cpu import SUPPORT_RADIUS
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER

ROOT = Path(__file__).absolute().parents[3]
ROLES = candidate.TYPED_ROLES
DEFAULT_OBJECTS = ((40, 40, 4, 7, "tree"), (100, 70, 2, 13, "rock"), (160, 120, 4, 21, "shrub"))


def scene(objects=DEFAULT_OBJECTS):
    conditions = torch.zeros((23, 192, 256))
    conditions[ORDER.index("terrain_grass")] = 1
    yy, xx = torch.meshgrid(torch.arange(192, dtype=torch.float32), torch.arange(256, dtype=torch.float32), indexing="ij")
    image = torch.stack([.5 + .15 * torch.sin(xx * (.13 + i*.03)) + .15 * torch.cos(yy * (.17 + i*.02)) for i in range(3)])
    table = []
    by_kind = {"tree": "object_tree", "rock": "object_rock", "shrub": "object_vegetation", "grass_detail": "object_vegetation"}
    for x, y, size, label, kind in objects:
        for role in ("object_footprints", by_kind[kind]):
            conditions[ORDER.index(role), y:y+size, x:x+size] = 1
        conditions[ORDER.index("object_instance"), y:y+size, x:x+size] = label / 255
        table.append({"value": label, "kind": kind, "footprint": {"x": x*4, "y": y*4, "width": size*4, "height": size*4}})
    return {"sampleId": "synthetic-only", "split": "train", "image": image, "conditions": conditions}, table


class SyntheticCritic(torch.nn.Module):
    def forward(self, values):
        return values[:, -3:].mean((1, 2, 3), keepdim=True)


class SupportStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def term(self, p, sample, table):
        return candidate.train_original_object_support_structure(p, sample, table, ORDER)

    def test_inactive_identity_fixed_formula_and_original_source_bytes(self):
        self.assertEqual(candidate.CANDIDATE_ID, "stage4_mvp256_dry_object_support_structure_loss_cpu_v1")
        self.assertFalse(candidate.EXECUTION_QUALIFIED)
        self.assertEqual(candidate.OBJECT_SUPPORT_STRUCTURE_WEIGHT, .1)
        self.assertEqual(candidate.EPSILON, 1e-8)
        path = ROOT / "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py"
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), "4bf0a03616bcad1f3549a0a607358a6f02fc56a7690993f3a9701cfa5d40ecb0")

    def test_policy_constants_and_cpu_execution_boundary(self):
        policy = json.loads((ROOT / "data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json").read_text(encoding="utf-8"))
        self.assertEqual(candidate.CANDIDATE_ID, policy["candidateId"])
        self.assertEqual(candidate.OBJECT_SUPPORT_STRUCTURE_WEIGHT, policy["formula"]["weight"])
        self.assertEqual(list(ROLES), policy["formula"]["roles"])
        self.assertEqual(list(candidate.LUMA_WEIGHTS), policy["formula"]["luminance"])
        self.assertEqual(candidate.MINIMUM_PIXELS, policy["formula"]["minimumPixels"])
        self.assertEqual(candidate.MINIMUM_REFERENCE_CENTERED_ENERGY, policy["formula"]["minimumReferenceCenteredEnergy"])
        self.assertEqual(candidate.OWNERSHIP_RULE, policy["support"]["supportOwnershipRule"])
        sample, table = scene()
        with patch.object(torch, "get_num_threads", return_value=3), self.assertRaisesRegex(ValueError, "threads"):
            self.term(sample["image"][None], sample, table)
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaisesRegex(ValueError, "autocast"):
            self.term(sample["image"][None], sample, table)

    def test_same_structure_better_than_rearranged_inside_support(self):
        sample, table = scene(); original = sample["image"][None]
        aligned, _ = self.term(original, sample, table)
        reordered = original.clone()
        masks = candidate._visible_support(sample["conditions"], table, ORDER)
        for mask in masks.values():
            m = mask[0, 0]; reordered[0, :, m] = reordered[0, :, m].flip(-1)
        rearranged, _ = self.term(reordered, sample, table)
        self.assertLess(float(aligned), float(rearranged))

    def test_exact_old_luma_epsilon_and_equal_role_aggregation(self):
        sample, table = scene(); predicted = (.2 + .5 * sample["image"].flip(-1))[None]
        weighted, parts = self.term(predicted, sample, table)
        expected = []
        masks = candidate._visible_support(sample["conditions"], table, ORDER)
        weights = predicted.new_tensor((.2126, .7152, .0722))[:, None, None]
        for role in ROLES:
            mask = masks[role][0, 0]
            p, t = (predicted[0] * weights).sum(0)[mask], (sample["image"] * weights).sum(0)[mask]
            p, t = p - p.mean(), t - t.mean()
            rho = ((p*t).sum() / torch.sqrt(p.square().sum() * t.square().sum() + 1e-8)).clamp(-1, 1)
            self.assertTrue(torch.equal(rho, parts["objectSupportStructureRoles"][role]["correlation"]))
            expected.append(1-rho)
        self.assertTrue(torch.equal(weighted, .1 * torch.stack(expected).mean()))

    def test_support_reproduces_original_partition_for_overlaps_and_boundaries(self):
        cases = (DEFAULT_OBJECTS,
            ((40, 40, 4, 7, "tree"), (46, 40, 4, 13, "rock"), (43, 47, 4, 21, "shrub")),
            ((0, 0, 2, 7, "tree"), (254, 190, 2, 13, "rock"), (150, 0, 2, 21, "shrub")),
            ((40, 40, 2, 7, "tree"), (45, 40, 2, 9, "tree")))
        for objects in cases:
            sample, table = scene(objects); conditions = sample["conditions"]
            coverage = {r: torch.zeros((1, 1, 192, 256)) for r in ROLES}
            labels = (conditions[ORDER.index("object_instance")] * 255).round()
            for row in table:
                role = {"tree": "object_tree", "rock": "object_rock", "shrub": "object_vegetation"}[row["kind"]]
                mask = (labels == row["value"])[None, None].float()
                radius = SUPPORT_RADIUS[role]
                coverage[role] = torch.maximum(coverage[role], F.max_pool2d(mask, 2*radius+1, stride=1, padding=radius))
            cores = {r: conditions[ORDER.index(r)][None, None] for r in ROLES}
            expected, _ = complete_typed_support_partition(cores, coverage)
            actual = candidate._visible_support(conditions, table, ORDER)
            with self.subTest(objects=objects):
                self.assertTrue(all(torch.equal(expected[r], actual[r]) and not actual[r].requires_grad for r in ROLES))
                self.assertFalse(bool((sum(m.to(torch.int32) for m in actual.values()) > 1).any()))

    def test_empty_and_constant_support_are_explicit_differentiable_na(self):
        for objects in ((), DEFAULT_OBJECTS):
            sample, table = scene(objects); sample["image"].fill_(.4)
            predicted = torch.full((1, 3, 192, 256), .6, requires_grad=True)
            value, parts = self.term(predicted, sample, table)
            self.assertEqual(float(value.detach()), 0)
            self.assertEqual(parts["objectSupportStructureStatus"], "not_applicable")
            self.assertEqual(parts["objectSupportStructureApplicableRoleCount"], 0)
            value.backward(); self.assertEqual(float(predicted.grad.abs().sum()), 0)
            self.assertTrue(all(r["correlation"] is None and r["status"] == "not_applicable"
                for r in parts["objectSupportStructureRoles"].values()))

    def test_one_constant_role_skips_only_that_role(self):
        sample, table = scene()
        masks = candidate._visible_support(sample["conditions"], table, ORDER)
        sample["image"][:, masks["object_rock"][0, 0]] = .4
        _, parts = self.term(sample["image"][None], sample, table)
        self.assertEqual(parts["objectSupportStructureApplicableRoleCount"], 2)
        self.assertEqual(parts["objectSupportStructureRoles"]["object_rock"]["reason"], "constant_reference_support")

    def test_gradient_only_prediction_and_only_visible_support(self):
        sample, table = scene(); sample["image"].requires_grad_(); sample["conditions"].requires_grad_()
        before = {k: sample[k].detach().clone() for k in ("image", "conditions")}; table_before = deepcopy(table)
        predicted = (.2 + .5 * before["image"].flip(-1))[None].clone().requires_grad_()
        value, _ = self.term(predicted, sample, table); value.backward()
        masks = candidate._visible_support(sample["conditions"].detach(), table, ORDER)
        union = torch.stack([v[0, 0] for v in masks.values()]).any(0)
        self.assertGreater(float(predicted.grad.abs().sum()), 0)
        self.assertEqual(float(predicted.grad[0, :, ~union].abs().sum()), 0)
        self.assertTrue(bool(torch.isfinite(predicted.grad).all()))
        self.assertIsNone(sample["image"].grad); self.assertIsNone(sample["conditions"].grad)
        self.assertEqual(table, table_before)
        self.assertTrue(all(torch.equal(sample[k], before[k]) for k in before))

    def test_four_simple_rgb_heads_receive_new_term_gradients_without_updates(self):
        sample, table = scene(); masks = candidate._visible_support(sample["conditions"], table, ORDER)
        yy, xx = torch.meshgrid(torch.arange(192, dtype=torch.float32), torch.arange(256, dtype=torch.float32), indexing="ij")
        pattern = torch.sin(xx*.19) + torch.cos(yy*.23)
        heads = [torch.nn.Parameter(torch.tensor([.2, -.3, .4])) for _ in range(4)]
        before = [h.detach().clone() for h in heads]
        logits = torch.zeros((1, 3, 192, 256))
        footprint = sample["conditions"][ORDER.index("object_footprints")] > 0
        for head, mask in zip(heads, (footprint, *(masks[r][0, 0] for r in ROLES))):
            logits = logits + head[None, :, None, None] * pattern[None, None] * mask[None, None]
        value, _ = self.term(torch.sigmoid(logits), sample, table)
        gradients = torch.autograd.grad(value, heads)
        self.assertTrue(all(bool(torch.isfinite(g).all()) and bool(g.abs().sum() > 0) for g in gradients))
        self.assertTrue(all(torch.equal(h, b) and h.grad is None for h, b in zip(heads, before)))

    def test_nontrain_rejected_before_inherited_objective(self):
        sample, table = scene()
        for split in ("validation", "challenge", "regression", None):
            with patch.object(candidate, "train_object_core_fidelity_candidate_objective") as old:
                with self.assertRaisesRegex(ValueError, "train split"):
                    candidate.train_object_support_structure_candidate_objective(SyntheticCritic(), sample["image"][None],
                        {**sample, "split": split}, table, ORDER)
                old.assert_not_called()

    def test_wrong_shapes_types_channels_and_nonfinite_rejected(self):
        sample, table = scene(); actual = sample["image"][None]
        for key, bad in (("image", torch.zeros(3, 96, 128)), ("conditions", torch.zeros(22, 192, 256)),
                ("image", sample["image"].double()), ("conditions", sample["conditions"].double()),
                ("image", torch.full_like(sample["image"], float("nan"))),
                ("conditions", torch.full_like(sample["conditions"], float("inf"))),
                ("image", torch.full_like(sample["image"], 1.1))):
            with self.subTest(key=key, shape=bad.shape), self.assertRaises(ValueError):
                self.term(actual, {**sample, key: bad}, table)
        for order in (ORDER[:-1], ORDER[::-1], "x"*23, ORDER[:-1]+(ORDER[0],)):
            with self.assertRaises(ValueError): candidate.train_original_object_support_structure(actual, sample, table, order)
        for bad in (actual.double(), torch.zeros(1, 3, 96, 128), torch.empty((1, 3, 192, 256), device="meta")):
            with self.assertRaises(ValueError): self.term(bad, sample, table)

    def test_instance_mismatch_fractional_mask_and_oversize_support_rejected(self):
        sample, table = scene()
        for kind in ("missing", "wrong_kind", "fractional", "footprint", "wide"):
            s, t = deepcopy(sample), deepcopy(table)
            if kind == "missing": t = t[:-1]
            elif kind == "wrong_kind": t[0]["kind"] = "rock"
            elif kind == "fractional": s["conditions"][ORDER.index("object_tree"), 40, 40] = .5
            elif kind == "footprint": t[0]["footprint"]["x"] += 100
            else:
                s, t = scene(((20, 20, 20, 7, "tree"),))
            with self.subTest(kind=kind), self.assertRaises(ValueError): self.term(s["image"][None], s, t)

    def test_no_caller_mask_override_or_prediction_defined_masks(self):
        sample, table = scene(); p = sample["image"][None]
        with self.assertRaises(TypeError):
            candidate.train_original_object_support_structure(p, sample, table, ORDER, mask_override={})
        with patch.object(candidate, "complete_typed_support_partition", wraps=complete_typed_support_partition) as partition:
            self.term(p, sample, table)
        self.assertEqual(partition.call_count, 1)
        self.assertTrue(all(not value.requires_grad for mapping in partition.call_args.args for value in mapping.values()))

    def test_wrapper_calls_old_once_detached_and_retains_all_parts(self):
        sample, table = scene(); sample["image"].requires_grad_(); sample["conditions"].requires_grad_()
        p = torch.full((1, 3, 192, 256), .6, requires_grad=True); old_total = p.sum() * .001
        old_parts = {"total": old_total, "existingPart": old_total * 2, "existingCount": 3}
        with patch.object(candidate, "train_object_core_fidelity_candidate_objective", return_value=(old_total, old_parts)) as old:
            total, parts = candidate.train_object_support_structure_candidate_objective(SyntheticCritic(), p, sample, table, ORDER)
        old.assert_called_once()
        self.assertIs(old.call_args.args[1], p)
        self.assertFalse(old.call_args.args[2]["image"].requires_grad)
        self.assertFalse(old.call_args.args[2]["conditions"].requires_grad)
        self.assertIs(parts["objectCoreFidelityUnchangedTotal"], old_total)
        self.assertIs(parts["objectCoreFidelityUnchangedParts"], old_parts)
        self.assertIs(parts["existingPart"], old_parts["existingPart"])
        self.assertTrue(torch.equal(total, old_total.float() + parts["objectSupportStructureWeighted"]))

    def test_actual_inherited_objective_with_synthetic_critic_end_to_end(self):
        sample, table = scene(); p = (.2 + .5 * sample["image"].flip(-1))[None].clone().requires_grad_()
        sample["image"].requires_grad_(); sample["conditions"].requires_grad_()
        bound = {**sample, "image": sample["image"].detach(), "conditions": sample["conditions"].detach()}
        critic = SyntheticCritic()
        old_total, old_parts = inherited.train_object_core_fidelity_candidate_objective(critic, p, bound, table, ORDER)
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA forbidden")), \
                patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer forbidden")):
            total, parts = candidate.train_object_support_structure_candidate_objective(critic, p, sample, table, ORDER)
            total.backward()
        self.assertTrue(torch.equal(old_total, parts["objectCoreFidelityUnchangedTotal"]))
        self.assertEqual(set(old_parts), set(parts["objectCoreFidelityUnchangedParts"]))
        for key, value in old_parts.items():
            actual = parts["objectCoreFidelityUnchangedParts"][key]
            self.assertTrue(torch.equal(value, actual) if isinstance(value, torch.Tensor) else value == actual)
        self.assertTrue(bool(torch.isfinite(p.grad).all()) and bool(p.grad.abs().sum() > 0))
        self.assertIsNone(sample["image"].grad); self.assertIsNone(sample["conditions"].grad)
        self.assertFalse(torch.cuda.is_initialized())

    def test_all_na_does_not_bypass_original_empty_core_failure(self):
        sample, table = scene(())
        value, parts = self.term(sample["image"][None], sample, table)
        self.assertEqual(parts["objectSupportStructureStatus"], "not_applicable")
        with self.assertRaisesRegex(ValueError, "no applicable"):
            candidate.train_object_support_structure_candidate_objective(SyntheticCritic(), sample["image"][None], sample, table, ORDER)

    def test_all_na_adds_zero_without_rejecting_an_existing_valid_sample(self):
        sample, table = scene()
        masks = candidate._visible_support(sample["conditions"], table, ORDER)
        for role, level in zip(ROLES, (.2, .4, .6)):
            sample["image"][:, masks[role][0, 0]] = level
        p = torch.full((1, 3, 192, 256), .5, requires_grad=True)
        old_total, _ = inherited.train_object_core_fidelity_candidate_objective(SyntheticCritic(), p, sample, table, ORDER)
        total, parts = candidate.train_object_support_structure_candidate_objective(SyntheticCritic(), p, sample, table, ORDER)
        self.assertEqual(parts["objectSupportStructureStatus"], "not_applicable")
        self.assertEqual(float(parts["objectSupportStructureWeighted"].detach()), 0)
        self.assertTrue(torch.equal(total, old_total))


if __name__ == "__main__": unittest.main()
