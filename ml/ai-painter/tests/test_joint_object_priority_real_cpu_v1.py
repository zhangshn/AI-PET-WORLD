"""Bounded synthetic stand-ins only; never decode data or call a real module."""
from contextlib import ExitStack
from copy import deepcopy
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import random
import sys
import time
import types
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import psutil
PROCESS = psutil.Process()
PRIOR_AFFINITY = PROCESS.cpu_affinity()
PROCESS.cpu_affinity(PRIOR_AFFINITY[:2])
import torch
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2:
    torch.set_num_interop_threads(2)
GUARDS = ExitStack()
FORBIDDEN = dict.fromkeys(("load", "save", "cuda", "optimizer", "forward"), 0)


def forbid(label):
    def fail(*args, **kwargs):
        FORBIDDEN[label] += 1
        raise AssertionError("synthetic component operation prohibited: " + label)
    return fail


for owner, key, label in ((torch, "load", "load"), (torch, "save", "save"),
        (torch.cuda, "_lazy_init", "cuda"), (torch.optim.Optimizer, "__init__", "optimizer"),
        (torch.nn.Module, "_call_impl", "forward")):
    GUARDS.enter_context(patch.object(owner, key, side_effect=forbid(label)))

import painter_stage4_joint_object_priority_training_profile_cpu_v1 as profile
import check_joint_object_priority_real_cpu_v1 as checker


def tearDownModule():
    GUARDS.close()
    PROCESS.cpu_affinity(PRIOR_AFFINITY)


def request():
    bound = lambda name: {"path": name, "sha256": "a" * 64}
    run = "joint-object-real-cpu-synthetic-test"
    return {"schemaVersion": "joint-object-priority-real-cpu-request-v1", "runId": run,
        "candidateId": checker.CANDIDATE, "policy": dict(checker.POLICY), "dataPlan": dict(checker.DATA_PLAN),
        "selectedSampleId": checker.SAMPLE_ID, "outputRoot": checker.OUTPUT_PREFIX + run,
        "programBindings": {"worker": bound(checker.SELF), "profile": bound(checker.PROFILE)},
        "registryBefore": bound(checker.REGISTRY), "interpreter": {"path": str(Path(sys.executable).absolute()), "sha256": "b" * 64},
        "deadlineUnixMs": int(time.time() * 1000) + 120000}


class BoundaryTests(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(any(FORBIDDEN.values()))

    def test_exact_request_and_legitimate_duplicate_roles(self):
        value = request()
        value["programBindings"]["sameWorker"] = deepcopy(value["programBindings"]["worker"])
        self.assertIs(checker.validate_request(value), value)

    def test_bootstrap_delegates_logical_runtime_to_registered_physical_mapping(self):
        value = request()
        raw = checker.json_bytes(value)
        item = {"path": value["outputRoot"] + "/request.json", "sha256": hashlib.sha256(raw).hexdigest()}
        seen = []
        class MappedReader:
            def __init__(self, root):
                seen.append(("root", root))
            def read(self, bound, maximum):
                # Synthetic RuntimeMap stand-in: physical runtime is outside
                # the checkout but registered for this logical namespace.
                physical = "D:/AI-PET-WORLD-DATA/hot/runtime/" + bound["path"].removeprefix(".runtime/")
                seen.append(("mapping", bound["path"], physical, maximum))
                if hashlib.sha256(raw).hexdigest() != bound["sha256"]:
                    raise ValueError("bound SHA differs")
                return raw
            def unchanged(self):
                seen.append(("unchanged",))
        auth = types.ModuleType("ecology_terrain_detail_weight_quality_auth_v1")
        auth.Reader = MappedReader
        with patch.dict(sys.modules, {auth.__name__: auth}), patch.object(Path, "resolve", side_effect=AssertionError("direct containment forbidden")):
            self.assertEqual(checker.bootstrap_request(item), value)
        self.assertEqual(seen[1][1], item["path"])
        self.assertTrue(seen[1][2].startswith("D:/AI-PET-WORLD-DATA/hot/runtime/"))
        self.assertEqual(seen[1][3], checker.MAX_JSON)
        self.assertEqual(seen[-1], ("unchanged",))

    def test_bootstrap_mapping_rejection_has_no_direct_file_fallback(self):
        reader = types.SimpleNamespace(read=lambda *_: (_ for _ in ()).throw(ValueError("unsafe runtime mapping")))
        auth = types.ModuleType("ecology_terrain_detail_weight_quality_auth_v1")
        auth.Reader = lambda root: reader
        with patch.dict(sys.modules, {auth.__name__: auth}), self.assertRaisesRegex(ValueError, "unsafe runtime mapping"):
            checker.bootstrap_request({"path": ".runtime/request.json", "sha256": "a" * 64})

    def test_identity_run_output_policy_plan_sample_registry_negatives(self):
        changes = (("candidateId", "other"), ("runId", "../escape"), ("outputRoot", ".runtime/elsewhere"),
            ("schemaVersion", "old"), ("policy", {**checker.POLICY, "sha256": "a" * 64}),
            ("dataPlan", {**checker.DATA_PLAN, "sha256": "a" * 64}), ("selectedSampleId", "validation"),
            ("registryBefore", {"path": "other.json", "sha256": "a" * 64}))
        for key, bad in changes:
            with self.subTest(key=key), self.assertRaises(ValueError):
                checker.validate_request({**request(), key: bad})

    def test_exact_fields_and_deadline_type(self):
        for value in (None, [], {**request(), "train": True},
                {key: item for key, item in request().items() if key != "deadlineUnixMs"},
                {**request(), "deadlineUnixMs": True}, {**request(), "deadlineUnixMs": -1}):
            with self.assertRaises(ValueError):
                checker.validate_request(value)

    def test_bindings_shape_path_hash_and_source_count(self):
        for bad in (None, {"path": "x"}, {"path": "../x", "sha256": "a" * 64},
                {"path": "F:/x", "sha256": "a" * 64}, {"path": "x\\y", "sha256": "a" * 64},
                {"path": "x", "sha256": "A" * 64}):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                checker.validate_request({**request(), "programBindings": {"bad": bad}})
        for programs in ({}, {str(i): {"path": f"x/{i}.py", "sha256": "a" * 64} for i in range(257)},
                {"worker": {"path": checker.SELF, "sha256": "a" * 64},
                 "alias": {"path": checker.SELF, "sha256": "b" * 64}}):
            with self.assertRaises(ValueError):
                checker.validate_request({**request(), "programBindings": programs})

    def test_relative_interpreter_rejected(self):
        value = request()
        value["interpreter"]["path"] = "python.exe"
        with self.assertRaises(ValueError):
            checker.validate_request(value)

    def test_only_selected_image_paths_are_readable(self):
        checker.guard_image_read("metadata.json", set())
        checker.guard_image_read("selected.png", {"selected.png"})
        for path in ("validation.png", "challenge.JPG", "regression.webp", "other.npy.png"):
            with self.assertRaises(ValueError):
                checker.guard_image_read(path, {"selected.png"})

    def test_json_finite_and_one_mib_bound(self):
        self.assertEqual(json.loads(checker.json_bytes({"passed": True})), {"passed": True})
        for value in ({"bad": float("nan")}, {"big": "x" * checker.MAX_JSON}):
            with self.assertRaises(ValueError):
                checker.json_bytes(value)

    def test_final_rgb_locator_schema_without_old_permission(self):
        ids = [checker.SAMPLE_ID] + [str(i) for i in range(47)]
        closure = {"schema": "object-support-structure-quality-data-closure-v1", "splitSampleIds": {"train": ids,
            "validation": [str(i) for i in range(8)]}, "bindings": [{"path": "metadata.json", "sha256": "a" * 64}]}
        plan = {"capabilityVersion": "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1", "dataClosure": "closure", "trainSplit": "train"}
        reader = types.SimpleNamespace(json=lambda item: closure if item == "closure" else {"sampleIds": ids})
        self.assertIs(checker.prepare_data_locator(reader, plan), closure)
        self.assertEqual(reader.snapshots, {"metadata.json": closure["bindings"][0]})
        with self.assertRaises(ValueError):
            checker.prepare_data_locator(reader, {**plan, "capabilityVersion": "old"})
        closure["schema"] = "ecology-terrain-detail-weight-quality-data-closure-v1"
        with self.assertRaises(ValueError):
            checker.prepare_data_locator(reader, plan)

    def test_locator_duplicate_metadata_rejected(self):
        closure = {"schema": "object-support-structure-quality-data-closure-v1", "splitSampleIds": {
            "train": [checker.SAMPLE_ID] + [str(i) for i in range(47)], "validation": list(range(8))},
            "bindings": [{"path": "x.json", "sha256": "a" * 64}] * 2}
        reader = types.SimpleNamespace(json=lambda item: closure if item == "closure" else {"sampleIds": closure["splitSampleIds"]["train"]})
        with self.assertRaisesRegex(ValueError, "duplicate"):
            checker.prepare_data_locator(reader, {"capabilityVersion": "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1",
                "dataClosure": "closure", "trainSplit": "train"})

    def test_worker_authentication_failure_reports_zero_unexecuted_calls(self):
        with patch.object(checker, "bootstrap_request", side_effect=ValueError("bad request SHA")):
            result = checker.run({"path": "synthetic.json", "sha256": "a" * 64})
        self.assertFalse(result["success"])
        self.assertEqual(result["executionState"], "failed_closed")
        self.assertEqual(result["error"]["message"], "bad request SHA")
        self.assertFalse(any(result["actualCalls"].values()))
        self.assertIsNone(result["stateBefore"])
        self.assertEqual(result["completedGradientLabels"], [])
        checker.json_bytes(result)

    def test_no_all_sample_loader_or_checkpoint_path(self):
        # Syntax inspection reads only the new source files, never any data.
        import ast
        tree = ast.parse(Path(checker.__file__).read_text(encoding="utf-8"))
        attrs = [node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)]
        self.assertNotIn("load_samples", attrs)
        self.assertIn("load_selected", attrs)
        self.assertIn("verify_loaded_sources", attrs)


class ProbeWiringTests(unittest.TestCase):
    def setUp(self):
        self.model, self.critic = torch.nn.Module(), torch.nn.Module()
        self.model.register_parameter("p", torch.nn.Parameter(torch.tensor([1., 2.])))
        self.critic.register_parameter("p", torch.nn.Parameter(torch.ones(2)))
        self.model.condition_channel_order = ("synthetic",)
        self.sample = {"split": "train", "objectInstanceTable": []}
        self.scope = ExitStack()
        self.addCleanup(self.scope.close)
        self.scope.enter_context(patch.object(profile, "_source", return_value=self.sample))
        self.scope.enter_context(patch.object(profile, "sample_forward", side_effect=self.forward))
        self.scope.enter_context(patch.object(profile, "generator_objective_and_gradients", side_effect=self.objectives))
        self.fail_at = None
        self.seen = []

    def tearDown(self):
        self.assertFalse(any(FORBIDDEN.values()))

    def forward(self, model, sample, return_evidence=False):
        # Controlled stand-in invokes the new probe's hooks, not Module.__call__.
        for hook in tuple(model._forward_pre_hooks.values()):
            hook(model, ())
        return model.p.square().sum(), {"objectCount": 0}

    def objectives(self, model, critic, sample, order, prediction):
        self.assertFalse(critic.training)
        self.assertTrue(all(not p.requires_grad for p in critic.parameters()))
        s, w, c, u = (prediction * f for f in (.5, .5, 1., 1.))
        total = (((s.float() + w).float() + c).float() + u)
        observer = profile.joint._OBSERVER.get()
        raw = []
        for index, (label, loss) in enumerate(zip(profile.COMPONENTS_IN_ORDER, (total, s, w, c, u))):
            observer("attempt", label, None)
            if index == self.fail_at:
                raise ValueError("primary synthetic gradient fault")
            rows = torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=index < 4)
            raw.append(rows)
            observer("complete", label, rows)
        return total, {"total": total}, raw[0], {"candidateId": profile.UPDATE_RULE_ID,
            "actualTotalProvenanceVerified": True, "autogradGradCalls": len(raw)}

    def probe(self, **kwargs):
        return profile.zero_update_probe(self.model, self.critic, self.sample, ("synthetic",), lambda: None, **kwargs)

    def test_single_synthetic_forward_five_vjps_and_state_modes_rng_unchanged(self):
        before = profile._network_snapshot(self.model), profile._network_snapshot(self.critic), profile.rng_fingerprint()
        with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
            result = self.probe(event=lambda stage, label, rows: self.seen.append((stage, label, rows)))
        self.assertEqual(grad.call_count, 5)
        self.assertEqual(result["candidateId"], checker.CANDIDATE)
        self.assertEqual(result["updateRuleId"], profile.joint.CANDIDATE_ID)
        self.assertEqual(result["completedGradientLabels"], list(profile.COMPONENTS_IN_ORDER))
        self.assertEqual(result["callCounts"]["generatorForwards"], 1)
        self.assertEqual(result["callCounts"]["generatorAutograd"], 5)
        self.assertTrue(all(rows is None for _, _, rows in self.seen))
        self.assertEqual(before, (profile._network_snapshot(self.model), profile._network_snapshot(self.critic), profile.rng_fingerprint()))
        self.assertTrue(self.model.training and self.critic.training and self.critic.p.requires_grad)
        self.assertFalse(self.model._forward_pre_hooks)
        checker.json_bytes(result)

    def test_gradient_failure_retains_primary_partial_counts_and_no_tensors(self):
        self.fail_at = 2
        evidence = {}
        with self.assertRaisesRegex(ValueError, "primary synthetic gradient fault"):
            self.probe(failure_evidence=evidence)
        self.assertEqual(evidence["callCounts"]["generatorAutogradAttempts"], 3)
        self.assertEqual(evidence["callCounts"]["generatorAutograd"], 2)
        self.assertEqual(evidence["completedGradientLabels"], list(profile.COMPONENTS_IN_ORDER[:2]))
        self.assertTrue(all(value["allFinite"] for value in evidence["gradientSummaries"]))
        checker.json_bytes(evidence)
        self.assertTrue(self.model.training and self.critic.training and self.critic.p.requires_grad)
        self.assertFalse(self.model._forward_pre_hooks)

    def test_forward_failure_never_reports_completed_forward_or_gradients(self):
        with patch.object(profile, "sample_forward", side_effect=ValueError("forward fault")):
            evidence = {}
            with self.assertRaisesRegex(ValueError, "forward fault"):
                self.probe(failure_evidence=evidence)
        self.assertEqual(evidence["callCounts"]["generatorForwardCompleted"], 0)
        self.assertEqual(evidence["callCounts"]["generatorAutogradAttempts"], 0)

    def test_resource_failure_before_forward_is_recorded(self):
        evidence = {}
        with self.assertRaisesRegex(ValueError, "deadline"):
            profile.zero_update_probe(self.model, self.critic, self.sample, ("synthetic",),
                lambda: (_ for _ in ()).throw(ValueError("deadline")), failure_evidence=evidence)
        self.assertEqual(evidence["callCounts"]["generatorForwards"], 0)
        self.assertTrue(self.model.training and self.critic.training)

    def test_preserve_state_detects_mutation_and_keeps_first_error(self):
        original = self.model.p.detach().clone()
        primary = ValueError("first fault")
        try:
            with self.assertRaises(ValueError) as caught:
                with profile._preserve_probe_state(self.model, self.critic):
                    with torch.no_grad():
                        self.model.p.add_(1.)
                    raise primary
            self.assertIs(caught.exception, primary)
            self.assertTrue(primary.secondary_probe_errors)
            self.assertFalse(torch.equal(self.model.p, original))
        finally:
            with torch.no_grad():
                self.model.p.copy_(original)

    def test_rng_mutation_restored_and_primary_preserved(self):
        before = profile.rng_fingerprint()
        primary = ValueError("first RNG fault")
        with self.assertRaises(ValueError) as caught:
            with profile._preserve_probe_state(self.model, self.critic):
                random.random()
                torch.rand(1)
                raise primary
        self.assertIs(caught.exception, primary)
        self.assertEqual(before, profile.rng_fingerprint())
        self.assertTrue(primary.secondary_probe_errors)

    def test_gradient_summary_finite_and_nonfinite_without_raw_values(self):
        facts = profile.gradient_summary("synthetic", (torch.tensor([float("inf")]), None, torch.ones(1)))
        self.assertFalse(facts["allFinite"])
        self.assertEqual(facts["nonfiniteTensorIndexes"], [0])
        self.assertEqual(facts["unusedTensorCount"], 1)
        checker.json_bytes(facts)

    def test_identity_constants_and_original_compute_function(self):
        self.assertEqual(profile.MODEL_CAPABILITY, profile.identity.CAPABILITY)
        self.assertIs(profile.compute_generator_candidate_gradients, profile.joint.compute_generator_candidate_gradients)
        self.assertIs(profile.observe_generator_gradients, profile.joint.observe_generator_gradients)
        self.assertFalse(profile.EXECUTION_QUALIFIED)


class ObjectiveBindingTests(unittest.TestCase):
    def test_original_loss_parts_are_passed_without_reweighting(self):
        model, critic = torch.nn.Module(), torch.nn.Module()
        model.register_parameter("p", torch.nn.Parameter(torch.ones(1)))
        critic.register_parameter("p", torch.nn.Parameter(torch.ones(1), requires_grad=False))
        critic.eval()
        base = model.p.square().sum()
        s, w, c, u = (base * v for v in (.5, .5, 1., .1))
        total = (((s.float() + w).float() + c).float() + u)
        parts = {"v21UnchangedTotal": s, "wholeFrameFidelity": w, "objectCoreRgbWeighted": c, "objectSupportStructureWeighted": u}
        with patch.object(profile, "_source"), patch.object(profile, "train_object_support_structure_candidate_objective", return_value=(total, parts)) as loss, \
                patch.object(profile, "compute_generator_candidate_gradients", return_value=((torch.ones(1),), {})) as update:
            profile.generator_objective_and_gradients(model, critic, {"objectInstanceTable": []}, (), base)
        loss.assert_called_once()
        for name, expected in (("actual_total", total), ("structured_objective", s), ("whole_frame_fidelity", w),
                ("object_core_rgb", c), ("object_support_structure", u)):
            self.assertIs(update.call_args.kwargs[name], expected)


if __name__ == "__main__":
    unittest.main(verbosity=2)
