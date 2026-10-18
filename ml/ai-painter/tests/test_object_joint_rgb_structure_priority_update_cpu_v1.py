"""Synthetic CPU parameter algebra; global guards forbid real execution."""
from contextlib import ExitStack
import hashlib
import math
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
STARTED = time.monotonic()
import psutil
PROCESS = psutil.Process()
ORIGINAL_AFFINITY = PROCESS.cpu_affinity()
PROCESS.cpu_affinity(ORIGINAL_AFFINITY[:2])
import torch
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2:
    torch.set_num_interop_threads(2)
GUARDS = ExitStack()
FORBIDDEN_CALLS = dict.fromkeys(("torch.load", "torch.save", "cuda_lazy_init", "optimizer", "module_forward"), 0)
RESOURCE_FACTS = {}


def prohibited(label):
    def fail(*args, **kwargs):
        FORBIDDEN_CALLS[label] += 1
        raise AssertionError("prohibited synthetic-suite side effect: " + label)
    return fail


for owner, key, label in ((torch, "load", "torch.load"), (torch, "save", "torch.save"),
        (torch.cuda, "_lazy_init", "cuda_lazy_init"), (torch.optim.Optimizer, "__init__", "optimizer"),
        (torch.nn.Module, "_call_impl", "module_forward")):
    GUARDS.enter_context(patch.object(owner, key, side_effect=prohibited(label)))

from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as joint
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER


def tearDownModule():
    info = PROCESS.memory_info()
    RESOURCE_FACTS.update(cpuThreads=torch.get_num_threads(), cpuInteropThreads=torch.get_num_interop_threads(),
        cpuAffinity=PROCESS.cpu_affinity(), cudaInitialized=torch.cuda.is_initialized(),
        rssBytes=info.rss, peakWorkingSetBytes=getattr(info, "peak_wset", None))
    GUARDS.close()
    PROCESS.cpu_affinity(ORIGINAL_AFFINITY)


def digest(model):
    value = hashlib.sha256()
    for name, tensor in model.state_dict().items():
        value.update(name.encode())
        value.update(tensor.detach().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes())
    return value.hexdigest()


class JointPriorityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rng = torch.get_rng_state().clone()
        cls.model = identity.build_fresh_object_ecology_final_rgb_base_weight_precision(
            condition_channel_order=FORMAL_CONDITION_CHANNEL_ORDER)
        cls.parameters, cls.groups, cls.season, cls.ecology = joint.bind_parameters(cls.model)
        cls.owned = {i for rows in cls.groups.values() for i in rows}
        cls.critic = torch.nn.Module()
        cls.critic.register_parameter("synthetic_weight", torch.nn.Parameter(torch.ones(2), requires_grad=False))
        cls.critic.eval()
        cls.sample = {"split": "train", "image": torch.zeros(3, 192, 256), "conditions": torch.zeros(23, 192, 256)}
        cls.initial_state = digest(cls.model), digest(cls.critic)
        cls.initial_rng = rng
        assert torch.equal(rng, torch.get_rng_state())
        cls.initial_ids = tuple(map(id, cls.parameters))

    def setUp(self):
        self.assertLess(time.monotonic() - STARTED, 120)

    def tearDown(self):
        self.assertTrue(all(p.grad is None for p in self.parameters))
        self.assertFalse(any(FORBIDDEN_CALLS.values()))

    @classmethod
    def tearDownClass(cls):
        assert (digest(cls.model), digest(cls.critic)) == cls.initial_state
        assert tuple(map(id, cls.model.parameters())) == cls.initial_ids
        assert torch.equal(torch.get_rng_state(), cls.initial_rng)

    def rows(self, value):
        return tuple(torch.full_like(p, value) for p in self.parameters)

    def fields(self, s=0., w=-3., c=1., support=1.):
        parts = [self.rows(v) for v in (s, w, c, support)]
        total = tuple((((a + b).float() + x).float() + y).float() for a, b, x, y in zip(*parts))
        return dict(model=self.model, parameters=self.parameters, total_gradients=total,
            structured_gradients=parts[0], whole_frame_gradients=parts[1], core_gradients=parts[2], support_gradients=parts[3])

    def apply(self, **kwargs):
        return joint.apply_object_joint_rgb_structure_priority_update_cpu(**self.fields(**kwargs))

    def components(self, factors=(.5, .5, 1., 1.), *, unused=False):
        selected = self.parameters[:1] if unused else self.parameters
        base = sum(p.square().sum() for p in selected)
        s, w, c, support = (base * factor for factor in factors)
        return dict(actual_total=(((s.float() + w).float() + c).float() + support),
            structured_objective=s, whole_frame_fidelity=w, object_core_rgb=c, object_support_structure=support)

    def compute(self, values=None, **kwargs):
        fields = dict(model=self.model, critic=self.critic, sample=self.sample,
            **(self.components() if values is None else values))
        fields.update(kwargs)
        return joint.compute_generator_candidate_gradients(**fields)

    def assert_heads(self, result, value):
        for i in self.owned:
            self.assertTrue(torch.equal(result[i], torch.full_like(result[i], value)))

    def test_identity_and_original_thresholds(self):
        self.assertEqual(joint.CANDIDATE_ID, "stage4_mvp256_dry_joint_object_priority_cpu_v1")
        self.assertEqual(joint.MODEL_CAPABILITY, identity.CAPABILITY)
        self.assertFalse(joint.EXECUTION_QUALIFIED)
        self.assertEqual((len(self.parameters), sum(p.numel() for p in self.parameters)), (108, 2242687))
        self.assertEqual((len(self.owned), sum(self.parameters[i].numel() for i in self.owned)), (16, 4876))
        self.assertEqual((joint.TOTAL_GRADIENT_ATOL, joint.TOTAL_GRADIENT_RTOL, joint.PROJECTION_ROUNDOFF_MULTIPLIER), (1e-6, 1e-5, 16))
        self.assertEqual(tuple(name for name, _ in self.model.named_buffers()), ("regime_identity", "numeric_identity", "ecology_identity"))

    def test_joint_conflict_changes_only_four_heads(self):
        fields = self.fields()
        result, facts = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
        self.assert_heads(result, 2.)
        for i in range(108):
            if i not in self.owned:
                self.assertIs(result[i], fields["total_gradients"][i])
                self.assertTrue(torch.equal(result[i].view(torch.uint8), fields["total_gradients"][i].view(torch.uint8)))
        for i in (self.season, self.ecology):
            self.assertIs(result[i], fields["total_gradients"][i])
        for item in facts["headDiagnostics"].values():
            self.assertEqual(item["branch"], "conflict_projected")
            self.assertEqual(item["coefficient"], -1.5)
            self.assertLessEqual(item["projectionResidualDot"], item["projectionRoundoffBound"])
        self.assertFalse(facts["actualTotalProvenanceVerified"])

    def test_nonconflict_and_zero_preserve_actual_identity_signed_zero(self):
        for s, w, c, support in ((0., 0., 0., 0.), (0., 2., 1., 1.)):
            fields = self.fields(s=s, w=w, c=c, support=support)
            if c == 0:
                fields["total_gradients"] = self.rows(-0.)
            result, _ = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
            self.assertTrue(all(a is b for a, b in zip(result, fields["total_gradients"])))
            if c == 0:
                self.assertTrue(all(bool(torch.signbit(v).all()) for v in result))

    def test_core_support_conflict_exact_cancellation(self):
        fields = self.fields(w=-2., c=1., support=-1.)
        result, facts = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
        self.assertTrue(all(a is b for a, b in zip(result, fields["total_gradients"])))
        self.assertTrue(all(v["qJointAnchorSquaredL2"] == 0 and v["branch"] == "joint_anchor_zero_preserve_actual_total"
            for v in facts["headDiagnostics"].values()))
        result, facts = self.apply(w=3., c=1., support=-2.)
        self.assert_heads(result, -1.)
        self.assertTrue(all(v["candidateCoreVsTotal"]["dot"] < 0 and v["candidateJointAnchorVsTotal"]["dot"] > 0
            for v in facts["headDiagnostics"].values()))

    def test_small_nonzero_anchor_no_new_epsilon(self):
        small = math.ldexp(1., -120)
        result, facts = self.apply(w=-small * 4, c=small, support=small)
        self.assert_heads(result, small * 2)
        self.assertTrue(all(v["qJointAnchorSquaredL2"] > 0 and v["branch"] == "conflict_projected"
            for v in facts["headDiagnostics"].values()))

    def test_support_zero_original_rule_independent_byte_reference(self):
        # Independent old-rule algebra; never invoke an old projection or carrier.
        for w, c in ((-3.5, 1.), (2., 1.), (-2., 0.)):
            fields = self.fields(s=.5, w=w, c=c, support=0.)
            result, _ = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
            for indexes in self.groups.values():
                core = torch.cat([fields["core_gradients"][i].flatten() for i in indexes]).double()
                other = (torch.cat([fields["whole_frame_gradients"][i].flatten() for i in indexes])
                    + torch.cat([fields["structured_gradients"][i].flatten() for i in indexes])).float().double()
                actual = torch.cat([fields["total_gradients"][i].flatten() for i in indexes])
                q, d = float(torch.dot(core, core)), float(torch.dot(core, other))
                expected = (actual.double() - d / q * core).float() if q and d < 0 else actual
                obtained = torch.cat([result[i].flatten() for i in indexes])
                self.assertTrue(torch.equal(obtained.view(torch.uint8), expected.view(torch.uint8)))

    def test_noncollinear_mixed_sign_heads_independent_fp64_reference(self):
        fields = self.fields(s=.25, w=.5, c=.75, support=.125)
        parts = [list(fields[name]) for name in
            ("structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients")]
        patterns = ((.25, -.5, .75, -1.), (-2.25, 1.5, -.25, 4.),
            (1., -2., 3., -1.), (-.5, .25, -1., .5))
        for ordinal, indexes in enumerate(self.groups.values()):
            offset = 0
            for i in indexes:
                n = self.parameters[i].numel()
                locations = torch.arange(offset, offset + n) % 4
                for rows, pattern in zip(parts, patterns):
                    rows[i] = (torch.tensor(pattern)[locations] * (ordinal + 1)).reshape_as(self.parameters[i])
                offset += n
        for name, rows in zip(("structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients"), parts):
            fields[name] = tuple(rows)
        fields["total_gradients"] = tuple((((s + w).float() + c).float() + u).float()
            for s, w, c, u in zip(*parts))
        snapshots = [tuple(v.clone() for v in rows) for rows in (*parts, fields["total_gradients"])]
        result, facts = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
        for key, indexes in self.groups.items():
            s, w, c, u, actual = (torch.cat([rows[i].flatten() for i in indexes])
                for rows in (*parts, fields["total_gradients"]))
            a, b = (c + u).float().double(), (w + s).float().double()
            q, d = torch.dot(a, a), torch.dot(a, b)
            self.assertLess(float(d), 0.)
            self.assertFalse(torch.equal(b, a * (d / q)))
            expected = (actual.double() - (d / q) * a).float()
            obtained = torch.cat([result[i].flatten() for i in indexes])
            self.assertTrue(torch.equal(obtained.view(torch.uint8), expected.view(torch.uint8)))
            self.assertLessEqual(facts["headDiagnostics"][key]["projectionResidualDot"],
                facts["headDiagnostics"][key]["projectionRoundoffBound"])
        self.assertTrue(all(result[i] is fields["total_gradients"][i] for i in range(108) if i not in self.owned))
        self.assertTrue(all(torch.equal(a.view(torch.uint8), b.view(torch.uint8))
            for before, after in zip(snapshots, (*parts, fields["total_gradients"])) for a, b in zip(before, after)))

    def test_original_total_order_not_joint_reassociation(self):
        fields = self.fields(s=1., w=-1e8, c=1., support=1e8)
        # Original (((1-1e8)+1)+1e8)=0; joint (1+1e8)+(-1e8+1)=0 here.
        self.assertTrue(all(bool((g == 0).all()) for g in fields["total_gradients"]))
        fields = self.fields(s=1e8, w=1., c=-1e8, support=1.)
        # Original result=1, while (core+support)+(whole+structured)=0.
        self.assertTrue(all(bool((g == 1).all()) for g in fields["total_gradients"]))
        joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
        fields["total_gradients"] = self.rows(0.)
        with self.assertRaisesRegex(ValueError, "total gradient identity"):
            joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)

    def test_actual_not_replaced_by_reconstructed_sum(self):
        fields = self.fields(w=1., c=1., support=1.)
        fields["total_gradients"] = tuple(v + 5e-7 for v in fields["total_gradients"])
        result, _ = joint.apply_object_joint_rgb_structure_priority_update_cpu(**fields)
        self.assertTrue(all(a is b for a, b in zip(result, fields["total_gradients"])))

    def test_support_already_weighted_no_second_weight(self):
        result, facts = self.apply(w=-.375, c=.125, support=.125)
        self.assert_heads(result, .25)
        self.assertTrue(all(v["coefficient"] == -1.5 for v in facts["headDiagnostics"].values()))

    def test_original_roundoff_bound_still_rejects_collinear_decimal_residual(self):
        # A real first-suite failure is retained as a rejection regression.  The
        # old 16*eps rule can reject a near-zero projected vector; do not relax it.
        with self.assertRaisesRegex(ValueError, "original projection roundoff bound exceeded"):
            self.apply(w=-.25, c=.1, support=.1)

    def test_all_five_sets_nonfinite_shape_count_dtype(self):
        for name in ("total_gradients", "structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients"):
            for kind in ("nan", "inf", "shape", "count", "dtype"):
                with self.subTest(name=name, kind=kind):
                    fields = self.fields()
                    bad = list(fields[name])
                    if kind in ("nan", "inf"):
                        bad[60].reshape(-1)[0] = float(kind)
                    elif kind == "shape":
                        bad[60] = torch.zeros(1)
                    elif kind == "dtype":
                        bad[60] = bad[60].double()
                    else:
                        bad.pop()
                    with self.assertRaises(ValueError):
                        joint.apply_object_joint_rgb_structure_priority_update_cpu(**{**fields, name: bad})

    def test_gradient_identity_alias_rejected_storage_views_allowed_readonly(self):
        fields = self.fields()
        bad = list(fields["core_gradients"])
        i, j = next((i, j) for i in range(108) for j in range(i + 1, 108) if bad[i].shape == bad[j].shape)
        bad[j] = bad[i]
        with self.assertRaisesRegex(ValueError, "alias"):
            joint.apply_object_joint_rgb_structure_priority_update_cpu(**{**fields, "core_gradients": bad})
        bad[j] = bad[i].view_as(bad[j])
        before = tuple(v.clone() for v in bad)
        joint.apply_object_joint_rgb_structure_priority_update_cpu(**{**fields, "core_gradients": bad})
        self.assertTrue(all(torch.equal(a.view(torch.uint8), b.view(torch.uint8)) for a, b in zip(before, bad)))

    def test_fake_model_parameter_alias_order_count(self):
        fields = self.fields()
        for params in (self.parameters[:-1], tuple(reversed(self.parameters))):
            with self.assertRaises(ValueError):
                joint.apply_object_joint_rgb_structure_priority_update_cpu(**{**fields, "parameters": params})
        with self.assertRaises(ValueError):
            joint.bind_parameters(torch.nn.Module())
        try:
            self.model.register_parameter("synthetic_alias", self.parameters[0])
            with self.assertRaises(ValueError):
                joint.bind_parameters(self.model)
        finally:
            del self.model._parameters["synthetic_alias"]

    def test_gradient_wrong_order_rejected(self):
        fields = self.fields()
        bad = list(fields["core_gradients"])
        bad[0], bad[1] = bad[1], bad[0]
        with self.assertRaises(ValueError):
            joint.apply_object_joint_rgb_structure_priority_update_cpu(**{**fields, "core_gradients": bad})

    def test_finite_components_overflowing_original_sum(self):
        with self.assertRaises(ValueError):
            self.apply(s=3e38, w=3e38, c=-3e38, support=0.)

    def test_real_five_full_autograd_no_forward_no_update(self):
        raw = []
        with joint.observe_generator_gradients(lambda stage, label, rows: raw.append((label, rows)) if stage == "complete" else None):
            with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
                result, facts = self.compute()
        self.assertEqual(grad.call_count, 5)
        self.assertEqual([name for name, _ in raw], list(joint.COMPONENTS_IN_ORDER))
        self.assertEqual([len(rows) for _, rows in raw], [108] * 5)
        self.assertTrue(all(a is b for a, b in zip(result, raw[0][1])))
        self.assertTrue(facts["actualTotalProvenanceVerified"])
        self.assertEqual(facts["independentFullParameterGradientTensorCounts"], [108] * 5)
        self.assertFalse(facts["optimizerCreated"] or facts["parametersUpdated"])

    def test_real_joint_conflict_nonhead_identity(self):
        raw = []
        with joint.observe_generator_gradients(lambda stage, label, rows: raw.append(rows) if stage == "complete" else None):
            result, facts = self.compute(self.components((-.5, -.5, 1., 1.)))
        self.assertTrue(all(result[i] is raw[0][i] for i in range(108) if i not in self.owned))
        self.assertTrue(all(v["branch"] == "conflict_projected" for v in facts["headDiagnostics"].values()))

    def test_unused_and_zero_support_still_five_vjps(self):
        result, facts = self.compute(self.components((1., .5, .25, 0.), unused=True))
        self.assertEqual(facts["autogradGradCalls"], 5)
        self.assertEqual(facts["unusedGradientIndexes"]["actualTotal"], list(range(1, 108)))
        self.assertTrue(all(bool((g == 0).all()) for g in result[1:]))

    def test_scalar_failures_before_autograd(self):
        for change in (lambda v: v + 1., lambda v: v.detach(), lambda v: v.double(), lambda v: v * float("nan"), lambda v: v.reshape(1)):
            values = self.components()
            values["actual_total"] = change(values["actual_total"])
            with patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
                self.compute(values)
            grad.assert_not_called()

    def test_same_scalar_value_wrong_actual_derivative_rejected(self):
        values = self.components()
        extra = self.parameters[0].square().sum()
        values["actual_total"] = values["actual_total"] + (extra - extra.detach())
        with self.assertRaisesRegex(ValueError, "total gradient identity") as caught:
            self.compute(values)
        self.assertEqual(caught.exception.object_joint_gradient_evidence["gradientSetsAvailable"], 5)

    def test_bad_split_or_synthetic_input_before_autograd(self):
        for sample in (None, {**self.sample, "split": "validation"}, {**self.sample, "split": "challenge"},
                {**self.sample, "image": torch.zeros(3, 2, 2)}, {**self.sample, "conditions": self.sample["conditions"].double()},
                {**self.sample, "conditions": self.sample["conditions"].clone().requires_grad_()},
                {**self.sample, "image": torch.full_like(self.sample["image"], 2.)}):
            with patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
                self.compute(sample=sample)
            grad.assert_not_called()

    def test_frozen_eval_critic_and_trainable_model(self):
        try:
            self.critic.train()
            with self.assertRaisesRegex(ValueError, "frozen eval"):
                self.compute()
            self.critic.eval().requires_grad_(True)
            with self.assertRaisesRegex(ValueError, "frozen eval"):
                self.compute()
        finally:
            self.critic.eval().requires_grad_(False)
        try:
            self.parameters[0].requires_grad_(False)
            with self.assertRaises(ValueError):
                self.compute()
        finally:
            self.parameters[0].requires_grad_(True)
        # Original interface accepts eval-mode generators; no extra mode gate.
        try:
            self.model.eval()
            self.compute()
        finally:
            self.model.train()

    def test_combined_alignment_not_individual_loss_guarantee(self):
        # c=(1,0), support=(-2,1), joint a=(-1,1), b=(2,-2).
        c, support, b = (torch.tensor(v, dtype=torch.float64) for v in ((1., 0.), (-2., 1.), (2., -2.)))
        a = c + support
        g = a + b - torch.dot(a, b) / torch.dot(a, a) * a
        self.assertGreater(float(torch.dot(a, g)), 0.)
        self.assertLess(float(torch.dot(c, g)), 0.)
        # Swap core and support: the support constituent then has the same failure.
        swapped_core, swapped_support = support, c
        self.assertTrue(torch.equal(swapped_core + swapped_support, a))
        self.assertLess(float(torch.dot(swapped_support, g)), 0.)

    def test_joint_alignment_not_adamw_or_finite_step_guarantee(self):
        # Algebra with beta1=.9, beta2=.999, eps=1e-8, decay=.01; no optimizer.
        a, g, prior_m = 1., 1., -10.
        m = .9 * prior_m + .1 * g
        v = .999 * 1. + .001 * g * g
        update = m / (math.sqrt(v) + 1e-8) + .01 * 0.
        self.assertGreater(a * g, 0.)
        self.assertLess(a * update, 0.)
        self.assertGreater((1. - 3. * g) ** 2, 1. ** 2)

    def test_final_forbidden_side_effects_and_resource_bounds(self):
        self.assertLessEqual(torch.get_num_threads(), 2)
        self.assertLessEqual(torch.get_num_interop_threads(), 2)
        self.assertLessEqual(len(PROCESS.cpu_affinity()), 2)
        self.assertFalse(torch.cuda.is_initialized())
        self.assertFalse(any(FORBIDDEN_CALLS.values()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
