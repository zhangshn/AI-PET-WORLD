"""CPU components only: synthetic graphs and in-memory source-created states."""
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
import psutil
PROCESS = psutil.Process()
OLD_AFFINITY = PROCESS.cpu_affinity()
PROCESS.cpu_affinity(OLD_AFFINITY[:2])
import torch
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2:
    torch.set_num_interop_threads(2)
GUARDS = ExitStack()
_LOAD, _SAVE = torch.load, torch.save


def memory_load(stream, *args, **kwargs):
    assert isinstance(stream, io.BytesIO), "old/file checkpoint loading prohibited"
    assert kwargs.get("weights_only") is True
    return _LOAD(stream, *args, **kwargs)


def memory_save(value, stream, *args, **kwargs):
    assert isinstance(stream, io.BytesIO), "file saving prohibited"
    return _SAVE(value, stream, *args, **kwargs)


GUARDS.enter_context(patch.object(torch, "load", side_effect=memory_load))
GUARDS.enter_context(patch.object(torch, "save", side_effect=memory_save))
for owner, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch.nn.Module, "_call_impl")):
    GUARDS.enter_context(patch.object(owner, name, side_effect=AssertionError("real forward/CUDA/optimizer prohibited")))

import object_support_structure_quality_auth_v1 as auth
import painter_stage4_object_support_structure_quality_worker_v1 as worker
import painter_stage4_object_support_structure_training_profile_v1 as shared_profile
import painter_stage4_joint_object_priority_training_profile_v1 as profile
import painter_stage4_final_rgb_base_weight_training_profile_v1 as old_profile
import painter_stage4_object_support_structure_lifecycle_v1 as lifecycle
import qualify_stage4_object_support_structure_quality_gpu_v1 as qualifier
import review_stage4_object_support_structure_quality_cpu_v1 as review
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_device_v1 as device
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as frozen
from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as codec
from ai_painter.complete_world import final_rgb_base_weight_quality_checkpoint_v1 as old_codec
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world import training_preview_storage_v1 as preview_storage
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER


def tearDownModule():
    GUARDS.close()
    PROCESS.cpu_affinity(OLD_AFFINITY)


def state(network):
    return {key: hashlib.sha256(v.detach().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()
        for key, v in network.state_dict().items()}


def selection():
    import ecology_quality_ranking_v1 as ranking
    rows = [{"sampleId": "synthetic-" + str(i), "split": "validation", "epoch": 24, "fullRgbMae": .2,
        "objectCorrelations": {key: .1 for key in ("object_footprints", "object_tree", "object_rock", "object_vegetation")}}
        for i in range(8)]
    return ranking.rank_validation_epoch(rows, [r["sampleId"] for r in rows], epoch=24, eligible_epochs=(24,))


class JointAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model, cls.critic = profile.fresh_networks(ORDER)
        cls.parameters, cls.groups, cls.season, cls.ecology = device.bind_parameters(cls.model)
        cls.owned = {i for rows in cls.groups.values() for i in rows}
        cls.preview = {"path": codec.PREVIEW_PATH, "sha256": "a" * 64}
        cls.configuration = codec.expected_configuration(cls.preview)

    def test_distinct_execution_rule_model_identities_and_old_routes(self):
        self.assertEqual(profile.CAPABILITY, auth.JOINT_CAPABILITY)
        self.assertEqual(device.UPDATE_RULE_ID, frozen.CANDIDATE_ID)
        self.assertEqual(profile.MODEL_CAPABILITY, identity.CAPABILITY)
        self.assertNotEqual(profile.CAPABILITY, frozen.CANDIDATE_ID)
        self.assertIs(auth.profile_components(auth.JOINT_CAPABILITY), profile)
        self.assertIs(auth.profile_components(auth.FINAL_RGB_CAPABILITY), old_profile)
        self.assertIs(auth.checkpoint_components(auth.JOINT_CAPABILITY), codec)
        self.assertIs(auth.checkpoint_components(auth.FINAL_RGB_CAPABILITY), old_codec)
        self.assertEqual(auth.execution_route().capability, auth.CAPABILITY)
        with self.assertRaises(ValueError):
            auth.execution_route(identity.CAPABILITY)

    def test_exact_seed_graph_state_and_rng_unchanged(self):
        rng = torch.get_rng_state().clone()
        model, critic = profile.fresh_networks(ORDER)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(state(model), state(self.model))
        self.assertEqual(state(critic), state(self.critic))
        self.assertEqual((len(self.parameters), sum(p.numel() for p in self.parameters)), (108, 2242687))
        self.assertEqual((len(self.owned), sum(self.parameters[i].numel() for i in self.owned)), (16, 4876))
        self.assertTrue(all(a is not b and a.untyped_storage()._cdata != b.untyped_storage()._cdata
            for a, b in zip(model.parameters(), self.model.parameters())))

    def test_genuine_same_identity_arithmetic_carrier_is_isolated_and_unqualified(self):
        before = state(self.model)
        carrier = device._cpu_carrier(self.model)
        identity.validate_model_identity(carrier)
        self.assertEqual(carrier.capability_version, self.model.capability_version)
        self.assertFalse(carrier.execution_qualified or carrier.parent_checkpoint_loaded)
        self.assertEqual(state(carrier), before)
        self.assertEqual(state(self.model), before)
        self.assertTrue(all(a is not b for a, b in zip(self.model.parameters(), carrier.parameters())))
        device._verify_carrier(self.model, carrier)

    def test_carrier_cannot_hide_changed_parameter_or_forged_identity(self):
        carrier = device._cpu_carrier(self.model)
        with torch.no_grad():
            next(carrier.parameters()).add_(.125)
        with self.assertRaises(ValueError):
            device._verify_carrier(self.model, carrier)
        carrier = device._cpu_carrier(self.model)
        carrier.capability_version = "old-parent"
        with self.assertRaises(ValueError):
            device._verify_carrier(self.model, carrier)

    def test_five_real_synthetic_vjps_with_frozen_joint_arithmetic(self):
        base = sum(p.square().sum() for p in self.parameters)
        s, w, c, u = (base * v for v in (-.5, -.5, 1., 1.))
        total = (((s.float() + w).float() + c).float() + u)
        critic = self.critic
        flags = [p.requires_grad for p in critic.parameters()]
        modes = [(m, m.training) for m in critic.modules()]
        raw = []
        before = state(self.model), state(critic)
        critic.eval().requires_grad_(False)
        sample = {"split": "train", "image": torch.zeros(3, 192, 256), "conditions": torch.zeros(23, 192, 256)}
        try:
            with device.observe_generator_gradients(lambda stage, label, rows: raw.append(rows) if stage == "complete" else None):
                with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
                    result, facts = device.compute_generator_candidate_gradients(model=self.model, critic=critic, sample=sample,
                        actual_total=total, structured_objective=s, whole_frame_fidelity=w,
                        object_core_rgb=c, object_support_structure=u)
            self.assertEqual(grad.call_count, 5)
            self.assertEqual([len(rows) for rows in raw], [108] * 5)
            self.assertEqual(facts["candidateId"], profile.CAPABILITY)
            self.assertEqual(facts["updateRuleId"], frozen.CANDIDATE_ID)
            self.assertTrue(facts["actualTotalProvenanceVerified"])
            self.assertEqual(set(facts["generatorGradientFacts"]["headCandidateL2"]), set(self.groups))
            self.assertTrue(all(result[i] is raw[0][i] for i in range(108) if i not in self.owned))
            self.assertEqual(before, (state(self.model), state(critic)))
            self.assertTrue(all(p.grad is None for p in self.parameters))
        finally:
            for p, flag in zip(critic.parameters(), flags):
                p.requires_grad_(flag)
            for m, mode in modes:
                m.training = mode

    def test_cpu_failure_has_compatible_five_gradient_capture_attribute(self):
        error = ValueError("synthetic gate")
        error.object_joint_gradient_evidence = {"gradientSetsAvailable": 2, "rawGradients": []}
        with patch.object(device.cpu_bridge, "compute_generator_candidate_gradients", side_effect=error):
            with self.assertRaises(ValueError) as caught:
                device.compute_generator_candidate_gradients(model=self.model, critic=self.critic, sample={}, actual_total=None,
                    structured_objective=None, whole_frame_fidelity=None, object_core_rgb=None, object_support_structure=None)
        self.assertIs(caught.exception, error)
        self.assertIs(error.object_support_gradient_evidence, error.object_joint_gradient_evidence)

    def test_mixed_sign_cpu_reference_and_device_mapping_preserve_actual_identity(self):
        parts = [list(torch.zeros_like(p) for p in self.parameters) for _ in range(4)]
        patterns = ((.25, -.5, .75, -1.), (-2.25, 1.5, -.25, 4.), (1., -2., 3., -1.), (-.5, .25, -1., .5))
        for indexes in self.groups.values():
            offset = 0
            for i in indexes:
                n = self.parameters[i].numel()
                for rows, pattern in zip(parts, patterns):
                    rows[i] = torch.tensor(pattern)[torch.arange(offset, offset + n) % 4].reshape_as(self.parameters[i])
                offset += n
        actual = tuple((((s + w).float() + c).float() + u).float() for s, w, c, u in zip(*parts))
        reference, facts = frozen.apply_object_joint_rgb_structure_priority_update_cpu(model=self.model, parameters=self.parameters,
            total_gradients=actual, structured_gradients=parts[0], whole_frame_gradients=parts[1], core_gradients=parts[2], support_gradients=parts[3])
        mapped = device._map_cpu_candidate(actual, reference, actual, self.groups, facts["headDiagnostics"], torch.device("cpu"))
        for key, indexes in self.groups.items():
            s, w, c, u, total = (torch.cat([rows[i].flatten() for i in indexes]) for rows in (*parts, actual))
            a, b = (c + u).double(), (w + s).double()
            expected = (total.double() - (torch.dot(a, b) / torch.dot(a, a)) * a).float()
            self.assertTrue(torch.equal(torch.cat([mapped[i].flatten() for i in indexes]).view(torch.uint8), expected.view(torch.uint8)))
        self.assertTrue(all(mapped[i] is actual[i] for i in range(108) if i not in self.owned))
        self.assertIs(mapped[self.season], actual[self.season])
        self.assertIs(mapped[self.ecology], actual[self.ecology])

    def test_nonconflict_mapping_preserves_signed_zero_and_rejects_bad_cpu_result(self):
        actual = tuple(torch.full_like(p, -0.) for p in self.parameters)
        diagnostics = {key: {"branch": "non_conflict_preserve_actual_total"} for key in self.groups}
        mapped = device._map_cpu_candidate(actual, actual, actual, self.groups, diagnostics, torch.device("cpu"))
        self.assertTrue(all(a is b for a, b in zip(actual, mapped)))
        bad = list(actual)
        bad[next(iter(self.owned))] = torch.ones_like(bad[next(iter(self.owned))])
        with self.assertRaises(ValueError):
            device._map_cpu_candidate(actual, bad, actual, self.groups, diagnostics, torch.device("cpu"))

    def test_explicit_shared_profile_and_lifecycle_select_new_components(self):
        self.assertIs(shared_profile._component_profile(profile), profile)
        self.assertIs(shared_profile._component_profile(old_profile), old_profile)
        self.assertIs(shared_profile._component_profile(None), shared_profile)
        fake = types.SimpleNamespace(CAPABILITY=profile.CAPABILITY)
        with self.assertRaises(ValueError):
            shared_profile._component_profile(fake)
        self.assertIs(lifecycle.profile_components(profile.CAPABILITY), profile)
        self.assertIs(lifecycle._codec(profile.CAPABILITY), codec)
        self.assertIs(lifecycle._model_validator(profile.CAPABILITY), identity.validate_model_identity)

    def test_configuration_keeps_original_gate_protocol_and_adds_joint_binding(self):
        config = self.configuration
        codec.validate_configuration(config)
        self.assertEqual(config["jointLearningRule"], codec.JOINT_LEARNING_RULE)
        self.assertEqual(config["gradientDefinition"], old_codec.GRADIENT)
        self.assertEqual(config["gpuAdmissionSeconds"], 720)
        self.assertEqual(config["modelCapabilityVersion"], identity.CAPABILITY)
        self.assertEqual(config["trainingPreviewPolicy"], self.preview)
        for mutate in (lambda v: v.pop("jointLearningRule"), lambda v: v["jointLearningRule"].update(sha256="b" * 64),
                lambda v: v.update(capabilityVersion=old_codec.CAPABILITY), lambda v: v.update(gpuAdmissionSeconds=600),
                lambda v: v["executionCeiling"].update(epochs=25)):
            bad = deepcopy(config)
            mutate(bad)
            with self.assertRaises(ValueError):
                codec.validate_configuration(bad)

    def test_exact_execution_policy_bytes_and_canonical_values(self):
        raw = (ROOT / codec.POLICY["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), codec.POLICY["sha256"])
        value = json.loads(raw)
        codec.validate_execution_policy(value, self.configuration)
        for change in (lambda p: p["phaseResources"].update(gpuAdmissionSeconds=600),
                lambda p: p["optimizer"].update(weightDecay=0.), lambda p: p["gpuAdmission"].update(generatorAutogradPerSample=4)):
            bad = deepcopy(value)
            change(bad)
            with self.assertRaises(ValueError):
                codec.validate_execution_policy(bad, self.configuration)

    def test_actual_configuration_binding_checks_are_metadata_only(self):
        value = auth.derive_configuration(auth.Reader(ROOT), capability_version=profile.CAPABILITY)
        codec.validate_configuration(value)
        self.assertEqual(value["executionPolicy"], auth.JOINT_POLICY)
        self.assertEqual(value["formalSpecification"], auth.JOINT_SPECIFICATION)

    def test_registered_source_roles_are_unique(self):
        roles = auth.required_program_roles(profile.CAPABILITY)
        self.assertEqual(len(roles), len(set(roles.values())))
        self.assertEqual(roles["jointDeviceBridge"], "ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_device_v1.py")
        self.assertEqual(roles["jointCheckpoint"], "ml/ai-painter/src/ai_painter/complete_world/joint_object_priority_quality_checkpoint_v1.py")
        self.assertNotIn("frozenProjectManifest", roles)
        self.assertEqual(roles["progressPublication"], auth.PROGRESS_PUBLICATION_PATH)
        self.assertNotIn("progressPublication", auth.required_program_roles(auth.CAPABILITY))
        self.assertNotIn("progressPublication", auth.required_program_roles(auth.FINAL_RGB_CAPABILITY))

    def test_v3_progress_binding_changes_no_numerical_or_resource_fields(self):
        policy = json.loads((ROOT / auth.JOINT_POLICY["path"]).read_bytes())
        previous = policy["previousExecutionPolicy"]
        raw = (ROOT / previous["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), previous["sha256"])
        old = json.loads(raw)
        for key in ("modelBoundary", "scope", "dataUse", "executionCeiling", "phaseResources", "gpuAdmission",
                "optimizer", "checkpointSelection", "lossDefinition", "gradientDefinition", "failureCapture",
                "jointLearningRule"):
            self.assertEqual(policy[key], old[key])
        self.assertEqual(policy["progressPublication"], auth.PROGRESS_PUBLICATION)
        self.assertEqual(self.configuration["progressPublicationPolicy"], auth.PROGRESS_PUBLICATION_POLICY)
        self.assertEqual(self.configuration["executionPolicy"], auth.JOINT_POLICY)
        self.assertEqual(self.configuration["formalSpecification"], auth.JOINT_SPECIFICATION)
        bad = deepcopy(self.configuration); bad["progressPublicationPolicy"] = True
        with self.assertRaises(ValueError): codec.validate_configuration(bad)
        bad = deepcopy(self.configuration)
        bad["executionPolicy"] = dict(previous)
        bad["formalSpecification"] = {key: old["formalSpecification"][key] for key in ("path", "sha256")}
        bad.pop("progressPublicationPolicy")
        with self.assertRaises(ValueError): codec.validate_configuration(bad)

    def source_bindings(self, count, capability=auth.JOINT_CAPABILITY):
        programs = {role: {"path": path, "sha256": "a" * 64}
            for role, path in auth.required_program_roles(capability).items()}
        programs["executionPolicy"] = dict(auth.execution_route(capability).execution_policy)
        programs["executionAuth"]["sha256"] = hashlib.sha256(Path(auth.__file__).read_bytes()).hexdigest()
        while len(programs) < count:
            index = len(programs)
            programs["synthetic" + str(index)] = {"path": "synthetic/" + str(index) + ".py", "sha256": "b" * 64}
        return programs

    def test_source_count_260_only_joint_and_261_fails_before_reads(self):
        reader = types.SimpleNamespace(read=lambda binding, maximum: b"source")
        for count in (256, 259, 260):
            programs = self.source_bindings(count)
            self.assertEqual(len(auth.verify_programs(reader, programs, capability_version=profile.CAPABILITY)), count)
        reader.read = unittest.mock.Mock(side_effect=AssertionError("oversized closure must fail before reads"))
        with self.assertRaisesRegex(ValueError, "source count"):
            auth.verify_programs(reader, self.source_bindings(261), capability_version=profile.CAPABILITY)
        reader.read.assert_not_called()
        for capability in (auth.CAPABILITY, auth.FINAL_RGB_CAPABILITY):
            self.assertEqual(auth.program_file_limit(capability), 256)
            auth.validate_program_count(dict.fromkeys(range(256)), capability)
            with self.assertRaises(ValueError):
                auth.validate_program_count(dict.fromkeys(range(257)), capability)
        reader.read = lambda binding, maximum: b"source"
        with self.assertRaises(ValueError):
            auth.verify_programs(reader, self.source_bindings(257, auth.FINAL_RGB_CAPABILITY), capability_version=auth.FINAL_RGB_CAPABILITY)

    def test_source_byte_limits_are_still_one_mib_and_sixteen_mib(self):
        maxima = []
        def read(binding, maximum):
            maxima.append(maximum)
            return b"x" * 1048576
        with self.assertRaisesRegex(ValueError, "byte ceiling"):
            auth.verify_programs(types.SimpleNamespace(read=read), self.source_bindings(260), capability_version=profile.CAPABILITY)
        self.assertTrue(maxima)
        self.assertEqual(set(maxima), {1048576})
        self.assertEqual(len(maxima), 17)

    def test_loaded_sources_260_and_261_and_old_257_are_checked(self):
        programs = self.source_bindings(260)
        module = types.ModuleType("synthetic_bound_module")
        module.__file__ = str(ROOT / programs["jointDeviceBridge"]["path"])
        reader = types.SimpleNamespace(root=ROOT, read=unittest.mock.Mock(return_value=b"source"))
        with patch.object(worker.sys, "modules", {"synthetic_bound_module": module}), \
                patch.object(worker, "verify_torch_dynamic_namespace", return_value=None):
            result = worker.verify_loaded_sources(reader, {"capabilityVersion": profile.CAPABILITY, "programBindings": programs})
            self.assertEqual(result["projectSources"], [programs["jointDeviceBridge"]["path"]])
            with self.assertRaises(ValueError):
                worker.verify_loaded_sources(reader, {"capabilityVersion": profile.CAPABILITY, "programBindings": self.source_bindings(261)})
            with self.assertRaises(ValueError):
                worker.verify_loaded_sources(reader, {"capabilityVersion": auth.FINAL_RGB_CAPABILITY,
                    "programBindings": self.source_bindings(257, auth.FINAL_RGB_CAPABILITY)})

    def test_worker_admission_budget_is_explicit_for_both_new_and_old_candidates(self):
        for capability, seconds in ((profile.CAPABILITY, 720), (auth.FINAL_RGB_CAPABILITY, 720), (auth.CAPABILITY, 600)):
            guard = worker.ResourceGuard({}, {"capabilityVersion": capability, "configuration": {"gpuAdmissionSeconds": seconds}}, gpu_gate=True)
            self.assertEqual(guard.seconds, seconds)

    def checkpoint_args(self):
        bound = lambda name: {"path": name, "sha256": "b" * 64}
        return dict(configuration=self.configuration, run_id="synthetic-joint-run", package_binding=bound(".runtime/synthetic/package.json"),
            dataset_binding=bound("data/synthetic/manifest.json"), epoch=24, selection=selection(), counts={"generator": 1152, "discriminator": 1152},
            program_bindings={"synthetic": bound("ml/ai-painter/scripts/synthetic.py")}, plan_binding=bound(".runtime/synthetic/quality-plan.json"))

    def test_new_checkpoint_strict_roundtrip_binds_joint_rule_and_keeps_storage(self):
        kwargs = self.checkpoint_args()
        raw = codec.encode(self.model, self.critic, **kwargs)
        payload = torch.load(io.BytesIO(raw), weights_only=True)
        self.assertEqual(payload["schema"], codec.SCHEMA)
        self.assertEqual(payload["jointLearningRule"], codec.JOINT_LEARNING_RULE)
        model, critic = profile.fresh_networks(ORDER)
        before = [(id(p), p.untyped_storage()._cdata) for net in (model, critic) for p in net.parameters()]
        codec.reload(raw, model=model, critic=critic, **kwargs)
        self.assertEqual(before, [(id(p), p.untyped_storage()._cdata) for net in (model, critic) for p in net.parameters()])
        self.assertEqual(state(model), state(self.model))

    def test_checkpoint_source_limit_accepts_260_and_rejects_261_without_changing_old_codec(self):
        kwargs = self.checkpoint_args()
        kwargs["program_bindings"] = self.source_bindings(260)
        payload = codec._metadata(**kwargs)
        self.assertEqual(len(payload["programBindings"]), 260)
        kwargs["program_bindings"] = self.source_bindings(261)
        with self.assertRaisesRegex(ValueError, "source role ceiling"):
            codec._metadata(**kwargs)
        old = {**kwargs, "configuration": old_codec.expected_configuration({"path": old_codec.PREVIEW_PATH, "sha256": "a" * 64})}
        old["program_bindings"] = self.source_bindings(257, auth.FINAL_RGB_CAPABILITY)
        with self.assertRaisesRegex(ValueError, "source role ceiling"):
            old_codec._metadata(**old)

    def test_checkpoint_rejects_old_identity_rule_and_partial_state(self):
        kwargs = self.checkpoint_args()
        payload = torch.load(io.BytesIO(codec.encode(self.model, self.critic, **kwargs)), weights_only=True)
        for mutate in (lambda p: p.update(schema=old_codec.SCHEMA), lambda p: p.update(capabilityVersion=old_codec.CAPABILITY),
                lambda p: p["jointLearningRule"].update(sha256="c" * 64), lambda p: p["generator"].pop(next(iter(p["generator"]))),
                lambda p: p.update(runId="other")):
            bad = deepcopy(payload)
            mutate(bad)
            stream = io.BytesIO()
            torch.save(bad, stream)
            with self.assertRaises(ValueError):
                codec.reload(stream.getvalue(), model=self.model, critic=self.critic, **kwargs)

    def test_only_epoch24_selected_and_no_qualification_inherited(self):
        kwargs = self.checkpoint_args()
        codec.validate_selection(self.configuration, kwargs["run_id"], 24, kwargs["selection"], kwargs["counts"])
        with self.assertRaises(ValueError):
            codec.validate_selection(self.configuration, kwargs["run_id"], 12, kwargs["selection"], {"generator": 576, "discriminator": 576})
        self.assertFalse(profile.EXECUTION_QUALIFIED or codec.EXECUTION_QUALIFIED or device.EXECUTION_QUALIFIED)

    def test_preview_v4_constants_only_extend_existing_routes(self):
        self.assertEqual(preview_storage.POLICY_V5_PATH, codec.PREVIEW_PATH)
        self.assertEqual(preview_storage.JOINT_CAPABILITY, profile.CAPABILITY)
        self.assertEqual(preview_storage.JOINT_RUN_PREFIX, auth.execution_route(profile.CAPABILITY).root_prefix)
        self.assertEqual(preview_storage.FINAL_RGB_CAPABILITY, old_profile.CAPABILITY)

    def test_original_loss_components_passed_without_reweighting(self):
        sentinels = [torch.tensor(float(i)) for i in range(5)]
        total, structured, whole, core, support = sentinels
        parts = {"v21UnchangedTotal": structured, "wholeFrameFidelity": whole,
            "objectCoreRgbWeighted": core, "objectSupportStructureWeighted": support}
        sample = {"split": "train", "objectInstanceTable": []}
        with patch.object(profile, "train_object_support_structure_candidate_objective", return_value=(total, parts)) as loss, \
                patch.object(profile, "compute_generator_candidate_gradients", return_value=((), {})) as update:
            profile._generator_candidate(self.model, self.critic, sample, ORDER, total)
        loss.assert_called_once()
        for key, value in zip(("actual_total", "structured_objective", "whole_frame_fidelity", "object_core_rgb", "object_support_structure"), sentinels):
            self.assertIs(update.call_args.kwargs[key], value)

    def test_gpu_gate_requires_own_identity_and_exact_48_240_48_counts(self):
        ids = ["synthetic-" + str(i) for i in range(48)]
        bound = {"path": ".runtime/synthetic/gpu-gate.json", "sha256": "a" * 64}
        package = {"path": ".runtime/synthetic/package.json", "sha256": "b" * 64}
        plan = {"capabilityVersion": profile.CAPABILITY, "outputRoot": ".runtime/synthetic", "runId": "synthetic-run",
            "packageId": "synthetic-package", "programBindings": {}, "trainSplit": {"path": "train.json", "sha256": "c" * 64},
            "modelBinding": {"path": "model.json", "sha256": "d" * 64}}
        gate = {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": profile.CAPABILITY,
            "executionProfile": auth.execution_route(profile.CAPABILITY).profile, "runId": plan["runId"], "packageId": plan["packageId"],
            "executionPackage": package, "programBindings": {},
            "actualCounts": {kind + suffix: n for kind, n in (("forward", 48), ("generator", 240), ("discriminator", 48)) for suffix in ("Attempted", "Completed")},
            "deviceIdentity": {"ordinal": 0, "uuid": "GPU-11111111-1111-1111-1111-111111111111"},
            "cases": [{"sampleId": sid, "passed": True, "proof": {"callCounts": {"generatorForwards": 1, "generatorForwardCompleted": 1,
                "generatorAutograd": 5, "discriminatorAutograd": 1}, "optimizerCreated": False, "optimizerUpdates": 0}} for sid in ids],
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False, "initialState": {}, "finalState": {}, "initialCpuState": {}}
        reader = types.SimpleNamespace(read=lambda b, maximum=0: json.dumps(gate if b == bound else {"sampleIds": ids} if b == plan["trainSplit"] else {"initialState": {}}).encode())
        worker.verify_gpu_gate(reader, plan, package, bound)
        gate["capabilityVersion"] = auth.FINAL_RGB_CAPABILITY
        with self.assertRaises(ValueError):
            worker.verify_gpu_gate(reader, plan, package, bound)
        gate["capabilityVersion"] = profile.CAPABILITY
        gate["actualCounts"]["generatorCompleted"] = 239
        with self.assertRaises(ValueError):
            worker.verify_gpu_gate(reader, plan, package, bound)

    def test_qualifier_observation_dispatches_joint_without_numerical_calls(self):
        context = types.SimpleNamespace(plan={"capabilityVersion": profile.CAPABILITY})
        sentinel = object()
        with patch.object(qualifier, "QualificationObservation", return_value=sentinel) as observed:
            self.assertIs(qualifier.observation_for_context(context, object(), 1., 2.), sentinel)
            observed.assert_called_once()
        context.plan["capabilityVersion"] = auth.CAPABILITY
        with patch.object(qualifier, "QualificationObservation") as observed:
            self.assertIsNone(qualifier.observation_for_context(context, object(), 1., None))
            observed.assert_not_called()

    def test_review_accepts_new_completed_terminal_and_rejects_old(self):
        kwargs = self.checkpoint_args()
        record = {"epoch": 24, "selection": kwargs["selection"], "counts": kwargs["counts"],
            "checkpoint": {"path": ".runtime/synthetic/checkpoint24.pt", "sha256": "c" * 64}}
        terminal = {"schema": review.TERMINAL_SCHEMA, "status": "training_completed_review_pending", "executionState": "completed",
            "executionProfile": auth.execution_route(profile.CAPABILITY).profile, "capabilityVersion": profile.CAPABILITY,
            "completedEpochs": 24, "optimizerSteps": kwargs["counts"], "optimizerStepsGenerator": 1152, "optimizerStepsDiscriminator": 1152,
            "checkpointReloadVerified": True, "challengeContentRead": False, "regressionContentRead": False,
            "checkpointPromotable": False, "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
            "executionPackage": kwargs["package_binding"], "packageId": "synthetic-package", "runId": kwargs["run_id"],
            "checkpoints": [record], "selectedCheckpointRecord": record}
        self.assertEqual(review.selected_record(terminal, configuration=self.configuration), record)
        terminal["capabilityVersion"] = auth.FINAL_RGB_CAPABILITY
        with self.assertRaises(ValueError):
            review.selected_record(terminal, configuration=self.configuration)


def admission_suite():
    """Own same-package CPU preparation permits arithmetic, never autograd."""
    names = unittest.defaultTestLoader.getTestCaseNames(JointAdapterTests)
    return unittest.TestSuite(JointAdapterTests(name) for name in names
        if name != "test_five_real_synthetic_vjps_with_frozen_joint_arithmetic")


if __name__ == "__main__":
    unittest.main(verbosity=2)
