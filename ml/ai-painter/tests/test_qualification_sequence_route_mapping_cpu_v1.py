"""Synthetic route identity checks; no model construction or execution."""
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]

import torch


def tripwires(stack):
    guards = []
    for owner, name in ((torch.nn.Module, "__init__"), (torch.nn.Module, "_call_impl"),
                        (torch.autograd, "grad"), (torch.autograd, "backward"),
                        (torch.Tensor, "backward"), (torch.cuda, "_lazy_init"),
                        (torch.cuda, "init"), (torch.optim.Optimizer, "__init__"),
                        (torch.optim.Optimizer, "step"), (subprocess, "Popen")):
        guards.append(stack.enter_context(patch.object(
            owner, name, side_effect=AssertionError("prohibited execution: " + name))))
    return guards


with ExitStack() as import_guard:
    import_guards = tripwires(import_guard)
    from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as codec
    import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
    import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
    import decode1_entry_weight_quality_review_v1 as review
    import qualify_stage4_decode1_entry_weight_quality_gpu_v1 as qualifier
    for guard in import_guards:
        guard.assert_not_called()


CAPABILITY = "stage4_mvp256_dry_decode2_rgb_output_qualification_capture_v1"
MODEL = "stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1"
PREVIEW = {"path": "data/ai-painter/system-governance/synthetic-capture-preview.json", "sha256": "1" * 64}
POLICY_BINDING = {"path": "data/ai-painter/system-governance/synthetic-capture-execution.json", "sha256": "2" * 64}
SPECIFICATION = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "sha256": "3" * 64}
SOURCE = {"path": "data/ai-painter/system-governance/synthetic-source.json", "sha256": "4" * 64}


def canonical_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                    ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def route_fixture(capability=CAPABILITY):
    policy = {"candidate": capability, "modelCapability": codec.model_capability(capability),
              "objectSupportStructureWeight": 1, "sourceCandidate": SOURCE,
              "trainingPreviewPolicy": PREVIEW}
    return {"capability": capability, "completion": True, "qualification_completion": True,
            "same_call_capture": True, "policy": POLICY_BINDING, "specification": SPECIFICATION,
            "preview_path": PREVIEW["path"], "progress_policy": SOURCE,
            "interface_contract": {"synthetic": True}, "policy_value": policy,
            "policy_canonical_sha256": canonical_digest(policy)}


class MemoryReader:
    """Synthetic immutable JSON/metadata only; no dataset or model files."""
    root = ROOT

    def __init__(self):
        self.files = {}

    def put(self, name, value):
        path = ".runtime/synthetic-mapping-gap/" + name
        raw = value if type(value) is bytes else json.dumps(value, sort_keys=True,
            separators=(",", ":"), allow_nan=False).encode()
        self.files[path] = raw
        return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}

    def read(self, binding, maximum=2097152):
        raw = self.files[binding["path"]]
        worker.require(len(raw) <= maximum and hashlib.sha256(raw).hexdigest() == binding["sha256"],
                       "synthetic immutable bytes changed")
        return raw


def gpu_gate_fixture(capability=CAPABILITY):
    reader = MemoryReader()
    initial = {"generator": "a" * 64, "discriminator": "b" * 64}
    sample_ids = ["synthetic-train-" + str(i) for i in range(48)]
    package = reader.put("package.json", {"synthetic": True})
    plan = {"capabilityVersion": capability, "runId": "synthetic-run", "packageId": "synthetic-package",
        "outputRoot": ".runtime/synthetic-mapping-gap", "programBindings": {},
        "trainSplit": reader.put("train.json", {"sampleIds": sample_ids}),
        "modelBinding": reader.put("model.json", {"initialState": initial}),
        "configuration": {"objectSupportStructureWeight": 1}}
    gate = {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": capability,
        "executionProfile": "synthetic-profile", "runId": plan["runId"], "packageId": plan["packageId"],
        "executionPackage": package, "programBindings": {},
        "actualCounts": {kind + suffix: count for kind, count in (("forward",48),("generator",240),("discriminator",48))
                         for suffix in ("Attempted","Completed")},
        "deviceIdentity": {"ordinal": 0, "uuid": "GPU-12345678-1234-1234-1234-123456789abc"},
        "cases": [{"sampleId": sample, "passed": True, "proof": {
            "callCounts": {"generatorForwards": 1, "generatorForwardCompleted": 1,
                           "generatorAutograd": 5, "discriminatorAutograd": 1},
            "optimizerCreated": False, "optimizerUpdates": 0,
            "fiveGradientFacts": {"objectSupportStructureWeight": 1}}} for sample in sample_ids],
        "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
        "initialState": initial, "finalState": initial, "initialCpuState": initial}
    return reader, plan, package, gate


class ComparisonFixture:
    """Complete synthetic published-parent identity graph; no actual samples."""
    def __init__(self, capability=CAPABILITY):
        self.reader = reader = MemoryReader()
        ids = ["synthetic-validation-" + str(i) for i in range(8)]
        image = reader.put("image.bin", b"synthetic image bytes, never decoded")
        condition = reader.put("condition.json", {"channels": [], "objectInstanceTable": []})
        facts = reader.put("facts.json", {"synthetic": True})
        task = reader.put("task.json", {"sourceBindings": {
            "naturalizedWorldFactsPath": facts["path"], "naturalizedWorldFactsSha256": facts["sha256"]}})
        rows = [{"sampleId": sid, "split": "validation", "image": image, "conditionPack": condition} for sid in ids]
        rows += [{"sampleId": "synthetic-train-" + str(i), "split": "train"} for i in range(56)]
        old_index = reader.put("old-index.json", {"samples": rows})
        new_index = reader.put("new-index.json", {"samples": rows})
        old_split = reader.put("old-validation.json", {"sampleIds": ids})
        new_split = reader.put("new-validation.json", {"sampleIds": ids})
        old_manifest = reader.put("old-manifest.json", {"sourceIndex": old_index})
        old_candidate = reader.put("old-candidate.json", {"frozenBindings": {"datasetManifest": old_manifest}})
        manifest = reader.put("new-manifest.json", {"schemaVersion": "ai-painter-stage4-source-correction-release-v1",
            "sourceIndex": new_index, "identityPayload": {"parentDatasetRelease": old_manifest, "channelOrder": []}})
        diagnostic_rows = [{"sampleId": sid, "identity": {"image": image, "conditionPack": condition,
            "channels": [], "taskPackage": task, "factHash": facts["sha256"]}} for sid in ids]
        parent_diagnostic = reader.put("old-diagnostic.json", {"rows": diagnostic_rows})
        diagnostic = reader.put("new-diagnostic.json", {"datasetManifest": manifest, "rows": diagnostic_rows,
            "derivation": {"parentDiagnostic": parent_diagnostic}})
        candidate = reader.put("new-candidate.json", {"parentCandidate": old_candidate, "frozenBindings": {
            "datasetManifest": manifest, "validationSplit": new_split, "trainingDiagnostic": diagnostic}})
        self.policy = {"sourceCandidate": candidate, "modelCapability": MODEL, "objectSupportStructureWeight": 1}
        policy_binding = reader.put("policy.json", self.policy)
        self.specification = reader.put("specification.txt", b"15.5.1\n15.6\n")
        self.review_specification = reader.put("review-specification.txt", b"11.12\n")
        self.route = SimpleNamespace(execution_policy=policy_binding, model_capability=MODEL,
                                     specification=self.specification)
        self.plan = {"capabilityVersion": capability, "sourceCandidate": candidate, "datasetManifest": manifest,
            "validationSplit": new_split, "executionPolicy": policy_binding, "formalSpecification": self.specification,
            "configuration": {"objectSupportStructureWeight": 1}}
        self.package = {"candidateContract": old_candidate, "datasetManifest": old_manifest, "validationSplit": old_split}

    def refresh_policy(self):
        bound = self.reader.put("policy.json", self.policy)
        self.route.execution_policy = self.plan["executionPolicy"] = bound

    def check(self):
        with patch.object(review.auth, "Reader", return_value=self.reader), \
             patch.object(review.auth, "execution_route", return_value=self.route), \
             patch.object(review, "CURRENT_REVIEW_SPECIFICATION", self.review_specification), \
             patch.object(review.auth, "reproduce_diagnostic", side_effect=lambda reader, binding: reader.json(binding)):
            return review.baseline_comparison_identity(self.reader, self.plan, self.package)


class QualificationSequenceRouteMappingTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.scope = ExitStack()
        self.addCleanup(self.scope.close)
        self.guards = tripwires(self.scope)
        for guard in self.guards:
            self.addCleanup(guard.assert_not_called)

    def configuration_scope(self, route):
        self.scope.enter_context(patch.object(codec, "registered_training_interfaces", return_value=[route]))
        self.scope.enter_context(patch.object(codec.template, "expected_configuration",
            side_effect=lambda: {"executionCeiling": {"epochs": 24, "generatorOptimizerSteps": 1152,
                                                     "discriminatorOptimizerSteps": 1152, "maxWallSeconds": 8400},
                                 "seed": 20260929}))
        return codec.expected_configuration(PREVIEW, route["capability"])

    def test_exact_new_identity_maps_existing_rgb_components_without_construction(self):
        self.assertEqual(codec.QUALIFICATION_CAPTURE_CAPABILITY, CAPABILITY)
        self.assertEqual(profile.QUALIFICATION_CAPTURE_CAPABILITY, CAPABILITY)
        self.assertEqual(codec.model_capability(CAPABILITY), MODEL)
        self.assertEqual(codec.components(CAPABILITY), codec.components(codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY))
        self.assertEqual(codec.components(CAPABILITY)[3:],
                         (codec.identity.RGB_OUTPUT_ARCHITECTURE, codec.identity.RGB_OUTPUT_RULE))

    def test_previous_numeric_identity_mappings_are_unchanged(self):
        for capability, model, architecture, rule in (
            (codec.CAPABILITY, codec.MODEL_CAPABILITY, codec.identity.ARCHITECTURE, codec.identity.NUMERIC_RULE),
            (codec.SUPPORT_WEIGHT1_CAPABILITY, codec.MODEL_CAPABILITY, codec.identity.ARCHITECTURE, codec.identity.NUMERIC_RULE),
            (codec.DECODE2_SUPPORT_WEIGHT1_CAPABILITY, codec.identity.DECODE2_CAPABILITY,
             codec.identity.DECODE2_ARCHITECTURE, codec.identity.DECODE2_RULE),
            (codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, MODEL,
             codec.identity.RGB_OUTPUT_ARCHITECTURE, codec.identity.RGB_OUTPUT_RULE)):
            with self.subTest(capability=capability):
                self.assertEqual(codec.model_capability(capability), model)
                self.assertEqual(codec.components(capability)[3:], (architecture, rule))

    def test_execution_values_requires_exact_registered_identity(self):
        route = route_fixture()
        with patch.object(codec, "registered_training_interfaces", return_value=[route]):
            self.assertIs(codec.execution_values(CAPABILITY), route)
            for unknown in (CAPABILITY + "_other", "unknown_execution", True, None):
                with self.subTest(unknown=unknown), self.assertRaises(ValueError):
                    codec.execution_values(unknown)
        with patch.object(codec, "registered_training_interfaces", return_value=[]), self.assertRaises(ValueError):
            codec.execution_values(CAPABILITY)
        with patch.object(codec, "registered_training_interfaces", return_value=[route, route]), self.assertRaises(ValueError):
            codec.execution_values(CAPABILITY)

    def test_new_configuration_keeps_existing_model_weight_schedule_and_completion(self):
        configuration = self.configuration_scope(route_fixture())
        self.assertEqual(configuration["capabilityVersion"], CAPABILITY)
        self.assertEqual(configuration["modelCapabilityVersion"], MODEL)
        self.assertIs(type(configuration["objectSupportStructureWeight"]), int)
        self.assertEqual(configuration["objectSupportStructureWeight"], 1)
        self.assertEqual(configuration["executionCeiling"], {"epochs": 24, "generatorOptimizerSteps": 1152,
            "discriminatorOptimizerSteps": 1152, "maxWallSeconds": None, "trainingWallMode": "completion"})
        self.assertIsNone(configuration["gpuAdmissionSeconds"])
        self.assertEqual(configuration["gpuAdmissionWallMode"], "completion")
        self.assertEqual(configuration["executionPolicy"], POLICY_BINDING)
        self.assertEqual(configuration["seed"], 20260929)

    def test_new_route_rejects_noninteger_or_missing_policy_weight(self):
        route = route_fixture()
        self.configuration_scope(route)
        for value in (False, True, 1.0, 0.1, "1", 0, 2, None):
            with self.subTest(value=value):
                route["policy_value"]["objectSupportStructureWeight"] = value
                with self.assertRaises(ValueError):
                    codec.expected_configuration(PREVIEW, CAPABILITY)
        route["policy_value"].pop("objectSupportStructureWeight")
        with self.assertRaises(ValueError):
            codec.expected_configuration(PREVIEW, CAPABILITY)

    def test_policy_validation_uses_own_canonical_policy_and_configuration(self):
        route = route_fixture()
        configuration = self.configuration_scope(route)
        codec.validate_execution_policy(deepcopy(route["policy_value"]), configuration)
        for key, value in (("candidate", codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY),
                           ("modelCapability", codec.MODEL_CAPABILITY),
                           ("objectSupportStructureWeight", 0.1)):
            tampered = deepcopy(route["policy_value"])
            tampered[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                codec.validate_execution_policy(tampered, configuration)

    def test_configuration_rejects_wrong_model_weight_and_preview_binding(self):
        configuration = self.configuration_scope(route_fixture())
        for key, value in (("modelCapabilityVersion", codec.MODEL_CAPABILITY),
                           ("objectSupportStructureWeight", 0.1),
                           ("capabilityVersion", "unknown_execution")):
            tampered = deepcopy(configuration)
            tampered[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                codec.validate_configuration(tampered)
        with self.assertRaises(ValueError):
            codec.expected_configuration({**PREVIEW, "path": "data/other-preview.json"}, CAPABILITY)

    def test_new_and_previous_weight1_profiles_remain_strict(self):
        for capability in (CAPABILITY, profile.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,
                           profile.DECODE2_SUPPORT_WEIGHT1_CAPABILITY, profile.SUPPORT_WEIGHT1_CAPABILITY):
            with self.subTest(capability=capability):
                self.assertEqual(profile.execution_support_structure_weight(
                    {"capabilityVersion": capability, "objectSupportStructureWeight": 1}), 1.0)
                for value in (True, 1.0, .1, None):
                    with self.assertRaises(ValueError):
                        profile.execution_support_structure_weight(
                            {"capabilityVersion": capability, "objectSupportStructureWeight": value})
        self.assertEqual(profile.execution_support_structure_weight({"capabilityVersion": profile.CAPABILITY}), .1)
        for capability in ("unknown_execution", CAPABILITY + "_other", True):
            with self.assertRaises(ValueError):
                profile.execution_support_structure_weight({"capabilityVersion": capability,
                                                           "objectSupportStructureWeight": 1})

    def callbacks(self, capability, *, weight=1):
        configuration = {"capabilityVersion": capability, "objectSupportStructureWeight": weight}
        context = SimpleNamespace(plan={"capabilityVersion": capability, "configuration": configuration})
        fake_profile = SimpleNamespace(CAPABILITY=profile.CAPABILITY,
            execution_support_structure_weight=profile.execution_support_structure_weight,
            perform_pair=object())
        model, sink, sample_context, observed = object(), object(), object(), object()
        preview = SimpleNamespace(observe=object())
        with patch.object(worker, "observed_pair", return_value=observed) as pair, \
             patch.object(worker.checkpoint, "execution_values", side_effect=AssertionError("legacy training bridge entered")):
            callbacks = worker.training_loop_callbacks(context, [], model, profile=fake_profile,
                plan_binding={}, execution_binding={}, preview=preview,
                capture_sink=sink, context_for_sample=sample_context)
            self.assertIs(callbacks["capture_sink"], sink)
            self.assertIs(callbacks["context_for_sample"], sample_context)
            sample = object()
            self.assertIs(callbacks["pair_runner"](sample), observed)
            pair.assert_called_once_with(fake_profile.perform_pair, model, sample,
                support_structure_weight=1.0, prediction_observer=preview.observe,
                observation_profile=fake_profile)

    def test_real_training_dispatch_passes_new_route_weight_without_legacy_capture_bridge(self):
        self.callbacks(CAPABILITY)

    def test_previous_weight1_training_dispatch_is_unchanged(self):
        for capability in (profile.SUPPORT_WEIGHT1_CAPABILITY, profile.DECODE2_SUPPORT_WEIGHT1_CAPABILITY,
                           profile.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY):
            with self.subTest(capability=capability):
                self.callbacks(capability)

    def test_real_new_training_dispatch_refuses_missing_or_invalid_weight(self):
        for value in (True, 1.0, .1, None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.callbacks(CAPABILITY, weight=value)

    def test_legacy_training_dispatch_does_not_add_weight_override(self):
        fake_profile = SimpleNamespace(CAPABILITY=profile.CAPABILITY, perform_pair=object())
        model = object()
        context = SimpleNamespace(plan={"capabilityVersion": profile.CAPABILITY})
        with patch.object(worker, "observed_pair", return_value=None) as pair:
            callbacks = worker.training_loop_callbacks(context, [], model, profile=fake_profile,
                plan_binding={}, execution_binding={}, preview=None,
                capture_sink=None, context_for_sample=None)
            callbacks["pair_runner"]()
            pair.assert_called_once_with(fake_profile.perform_pair, model, observation_profile=fake_profile)

    def verify_gate(self, reader, plan, package, gate):
        binding = reader.put("gpu-gate.json", gate)
        with patch.object(worker.auth, "execution_route", return_value=SimpleNamespace(profile="synthetic-profile")):
            return worker.verify_gpu_gate(reader, plan, package, binding)

    def test_real_gpu_gate_accepts_correct_48_weight1_proofs_for_new_and_previous_route(self):
        for capability in (CAPABILITY, codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, *codec.TRAINING_CAPTURE_CAPABILITIES):
            with self.subTest(capability=capability):
                reader, plan, package, gate = gpu_gate_fixture(capability)
                self.assertEqual(self.verify_gate(reader, plan, package, gate), gate)

    def test_real_gpu_gate_rejects_one_wrong_missing_or_noninteger_sample_weight(self):
        for capability in (CAPABILITY, codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, *codec.TRAINING_CAPTURE_CAPABILITIES):
            for position in (0, 17, 47):
                for value in (4, None, True, 1.0):
                    reader, plan, package, gate = gpu_gate_fixture(capability)
                    facts = gate["cases"][position]["proof"]["fiveGradientFacts"]
                    if value is None:
                        facts.pop("objectSupportStructureWeight")
                    else:
                        facts["objectSupportStructureWeight"] = value
                    with self.subTest(capability=capability, position=position, value=value), \
                         self.assertRaisesRegex(ValueError, "support weight1 for all48"):
                        self.verify_gate(reader, plan, package, gate)

    def test_real_gpu_gate_preserves_plan_weight_package_and_full_sequence_checks(self):
        for mode in ("plan-weight", "plan-missing", "package", "program", "missing-case", "case-order"):
            reader, plan, package, gate = gpu_gate_fixture()
            if mode == "plan-weight": plan["configuration"]["objectSupportStructureWeight"] = 4
            elif mode == "plan-missing": plan["configuration"].pop("objectSupportStructureWeight")
            elif mode == "package": gate["executionPackage"] = {"path": ".runtime/different.json", "sha256": "a" * 64}
            elif mode == "program": gate["programBindings"] = {"unexpected": SOURCE}
            elif mode == "missing-case": gate["cases"].pop()
            else: gate["cases"].reverse()
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                self.verify_gate(reader, plan, package, gate)

    def test_real_comparison_accepts_new_and_previous_corrected_parent_identity(self):
        for capability in (CAPABILITY, codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, *codec.TRAINING_CAPTURE_CAPABILITIES):
            fixture = ComparisonFixture(capability)
            with self.subTest(capability=capability):
                result = fixture.check()
                self.assertEqual(result["mode"], "published_train_correction_direct_parent_same_validation_v1")
                self.assertFalse(result["qualificationGranted"])
                self.assertEqual(len(result["validation"]), 8)
                self.assertEqual(result["candidate"], fixture.plan["sourceCandidate"])

    def test_real_comparison_new_route_preserves_exact_weight_model_and_formal_bindings(self):
        for mode in ("policy-weight", "policy-weight-missing", "plan-weight", "plan-weight-missing",
                     "model", "source", "formal-binding", "formal-clause", "unknown-capability"):
            fixture = ComparisonFixture()
            if mode == "policy-weight": fixture.policy["objectSupportStructureWeight"] = 4
            elif mode == "policy-weight-missing": fixture.policy.pop("objectSupportStructureWeight")
            elif mode == "plan-weight": fixture.plan["configuration"]["objectSupportStructureWeight"] = 4
            elif mode == "plan-weight-missing": fixture.plan["configuration"].pop("objectSupportStructureWeight")
            elif mode == "model": fixture.policy["modelCapability"] = codec.MODEL_CAPABILITY
            elif mode == "source": fixture.policy["sourceCandidate"] = fixture.package["candidateContract"]
            elif mode == "formal-binding": fixture.plan["formalSpecification"] = fixture.review_specification
            elif mode == "formal-clause":
                fixture.route.specification = fixture.reader.put("wrong-specification.txt", b"15.5.1\n")
                fixture.plan["formalSpecification"] = fixture.route.specification
            else: fixture.plan["capabilityVersion"] = CAPABILITY + "_caller_suffix"
            fixture.refresh_policy()
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                fixture.check()

    def test_real_comparison_preserves_direct_parent_and_original_exact_binding_rules(self):
        fixture = ComparisonFixture()
        original = deepcopy(fixture.package)
        fixture.package["datasetManifest"] = fixture.plan["datasetManifest"]
        with self.assertRaisesRegex(ValueError, "baseline dataset is not the direct parent"):
            fixture.check()
        fixture.package = original
        fixture.package["candidateContract"] = fixture.plan["sourceCandidate"]
        with self.assertRaisesRegex(ValueError, "baseline candidate is not the direct parent"):
            fixture.check()
        fixture.package = {"candidateContract": fixture.plan["sourceCandidate"],
            "datasetManifest": fixture.plan["datasetManifest"], "validationSplit": fixture.plan["validationSplit"]}
        self.assertEqual(fixture.check(), {"mode": "exact_original_bindings", "qualificationGranted": False})


    def test_training_capture_model_and_configuration_are_exact_rgb_weight1_without_construction(self):
        capability=codec.TRAINING_CAPTURE_CAPABILITY
        self.assertEqual(codec.model_capability(capability),MODEL)
        self.assertEqual(codec.components(capability),codec.components(codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY))
        configuration=self.configuration_scope(route_fixture(capability))
        self.assertEqual(configuration["objectSupportStructureWeight"],1)
        self.assertEqual(configuration["modelCapabilityVersion"],MODEL)
        self.assertEqual(configuration["executionCeiling"]["epochs"],24)
        self.assertIsNone(configuration["gpuAdmissionSeconds"])

    def test_actual_qualification_options_pass_exact_new_weight1_to_original_probe_and_keep_old_dispatch(self):
        capability=codec.TRAINING_CAPTURE_CAPABILITY
        plan={"capabilityVersion":capability,"configuration":{
            "capabilityVersion":capability,"objectSupportStructureWeight":1}}
        with patch.object(profile,"execution_support_structure_weight",side_effect=AssertionError("new route must not use legacy allowlist")):
            options=qualifier.qualification_probe_options(profile,plan)
            self.assertEqual(options,{"support_structure_weight":1.0})
            probe=unittest.mock.Mock(return_value="original-probe-result")
            self.assertEqual(qualifier.invoke_original_probe(probe,"bound-model",capture=None,**options),"original-probe-result")
            probe.assert_called_once_with("bound-model",support_structure_weight=1.0)
            for value in (True,1.0,.1,None):
                plan["configuration"]["objectSupportStructureWeight"]=value
                with self.subTest(value=value),self.assertRaises(ValueError):qualifier.qualification_probe_options(profile,plan)
            plan["configuration"]={"capabilityVersion":codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,"objectSupportStructureWeight":1}
            with self.assertRaises(ValueError):qualifier.qualification_probe_options(profile,plan)
        for old in (codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,codec.QUALIFICATION_CAPTURE_CAPABILITY,
                    codec.DECODE2_SUPPORT_WEIGHT1_CAPABILITY,codec.SUPPORT_WEIGHT1_CAPABILITY):
            original={"capabilityVersion":old,"objectSupportStructureWeight":1}
            with patch.object(profile,"execution_support_structure_weight",wraps=profile.execution_support_structure_weight) as weight:
                self.assertEqual(qualifier.qualification_probe_options(profile,{"capabilityVersion":old,"configuration":original}),{"support_structure_weight":1.0})
                weight.assert_called_once_with(original)
        self.assertEqual(qualifier.qualification_probe_options(profile,{"capabilityVersion":codec.CAPABILITY}),{})

    def test_training_capture_policy_authenticates_raw_sources_and_synthetic_cpu_scope(self):
        auth=worker.auth;reader=MemoryReader()
        sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        evidence_path=".runtime/ai-painter/controller-repair-reviews/parameter0-training-same-call-023-20261024/cpu-component-acceptance.json"
        evidence={"status":"cpu_component_passed_not_admitted","taskId":"TRAINING-SAME-CALL-CAPTURE-023-CPU",
            "qualificationGranted":False,"sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,
                "cudaInitialized":False,"realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,
                "syntheticOperations":"Tiny synthetic fixtures; no real model."}}
        raw=json.dumps(evidence).encode();reader.files[evidence_path]=raw
        capture={**deepcopy(auth.TRAINING_CAPTURE_CORE),"componentSources":sources,
            "cpuEvidence":{"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}}
        policy={"candidate":codec.TRAINING_CAPTURE_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for key,value in (("epoch",2),("localReferenceCalls",1),("maximumObservedGCalls",2),("qualificationGranted",True),("extra",True)):
            changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
        for key in ("sameCallCapture","qualificationFailureCapture"):
            with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,{**policy,key:{}})
        with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,{**policy,"candidate":CAPABILITY})
        reader.files[sources[0]["path"]]+=b"changed"
        with self.assertRaisesRegex(ValueError,"immutable bytes changed"):auth.verify_training_capture_policy(reader,policy)

    def test_v2_training_capture_policy_binds_its_own_core_sources_and_cpu_scope(self):
        auth=worker.auth;reader=MemoryReader()
        sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        evidence_path=".runtime/ai-painter/controller-repair-reviews/registry-publication-repair-024-20261024/cpu-component-acceptance.json"
        evidence={"status":"cpu_component_passed_not_admitted","taskId":"TRAINING-SAME-CALL-CAPTURE-024-CPU",
            "qualificationGranted":False,"sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,
                "cudaInitialized":False,"realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,
                "syntheticOperations":"Tiny synthetic fixtures; no real model."}}
        raw=json.dumps(evidence).encode();reader.files[evidence_path]=raw
        capture={**deepcopy(auth.TRAINING_CAPTURE_V2_CORE),"componentSources":sources,
            "cpuEvidence":{"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}}
        policy={"candidate":codec.TRAINING_CAPTURE_V2_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for key,value in (("epoch",2),("localReferenceCalls",1),("maximumObservedGCalls",2),("qualificationGranted",True),("extra",True)):
            changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
        for key in ("sameCallCapture","qualificationFailureCapture"):
            with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,{**policy,key:{}})
        with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,{**policy,"candidate":CAPABILITY})
        old_core=deepcopy(policy);old_core["trainingFailureCapture"]["capabilityVersion"]=codec.TRAINING_CAPTURE_CAPABILITY
        with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,old_core)
        wrong_support=deepcopy(policy);wrong_support["trainingFailureCapture"]["cpuEvidence"]["path"]=".runtime/ai-painter/controller-repair-reviews/parameter0-training-same-call-023-20261024/cpu-component-acceptance.json"
        with self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,wrong_support)
        reader.files[sources[0]["path"]]+=b"changed"
        with self.assertRaisesRegex(ValueError,"immutable bytes changed"):auth.verify_training_capture_policy(reader,policy)

    def test_v3_core_and_cpu_scope_reject_both_previous_identities(self):
        auth=worker.auth;reader=MemoryReader();sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic v3 immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        core,evidence_path,task_id=auth.training_capture_identity(codec.TRAINING_CAPTURE_V3_CAPABILITY)
        self.assertEqual(evidence_path,".runtime/ai-painter/controller-repair-reviews/canonical-initialization-repair-025-20261024/cpu-component-acceptance.json")
        self.assertEqual(task_id,"TRAINING-SAME-CALL-CAPTURE-025-CPU")
        self.assertEqual({**core,"capabilityVersion":codec.TRAINING_CAPTURE_CAPABILITY},auth.TRAINING_CAPTURE_CORE)
        evidence={"status":"cpu_component_passed_not_admitted","taskId":task_id,"qualificationGranted":False,
            "sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,"cudaInitialized":False,
                "realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,"syntheticOperations":"Synthetic v3 metadata only."}}
        def bind_evidence(proof):
            raw=json.dumps(proof).encode();reader.files[evidence_path]=raw
            return {"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}
        capture={**deepcopy(core),"componentSources":sources,"cpuEvidence":bind_evidence(evidence)}
        policy={"candidate":codec.TRAINING_CAPTURE_V3_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for old in (codec.TRAINING_CAPTURE_CAPABILITY,codec.TRAINING_CAPTURE_V2_CAPABILITY):
            old_core,old_path,old_task=auth.training_capture_identity(old)
            self.assertEqual(codec.components(old),codec.components(codec.TRAINING_CAPTURE_V3_CAPABILITY))
            for key,value in (("capabilityVersion",old),("cpuEvidence",{"path":old_path,"sha256":"a"*64})):
                changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
                with self.subTest(old=old,key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            changed=deepcopy(policy)
            changed["trainingFailureCapture"]["cpuEvidence"]=bind_evidence({**evidence,"taskId":old_task})
            with self.subTest(old=old,key="task"),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            bind_evidence(evidence)
        with self.assertRaises(ValueError):auth.training_capture_identity("unknown_training_capture")

    def test_v4_core_and_cpu_scope_reject_all_previous_identities(self):
        auth=worker.auth;reader=MemoryReader();sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic v4 immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        core,evidence_path,task_id=auth.training_capture_identity(codec.TRAINING_CAPTURE_V4_CAPABILITY)
        self.assertEqual(evidence_path,".runtime/ai-painter/controller-repair-reviews/canonical-fixture-isolation-repair-026-20261024/cpu-component-acceptance.json")
        self.assertEqual(task_id,"TRAINING-SAME-CALL-CAPTURE-026-CPU")
        self.assertEqual({**core,"capabilityVersion":codec.TRAINING_CAPTURE_CAPABILITY},auth.TRAINING_CAPTURE_CORE)
        evidence={"status":"cpu_component_passed_not_admitted","taskId":task_id,"qualificationGranted":False,
            "sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,"cudaInitialized":False,
                "realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,"syntheticOperations":"Synthetic v4 metadata only."}}
        def bind_evidence(proof):
            raw=json.dumps(proof).encode();reader.files[evidence_path]=raw
            return {"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}
        capture={**deepcopy(core),"componentSources":sources,"cpuEvidence":bind_evidence(evidence)}
        policy={"candidate":codec.TRAINING_CAPTURE_V4_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for old in (codec.TRAINING_CAPTURE_CAPABILITY,codec.TRAINING_CAPTURE_V2_CAPABILITY,codec.TRAINING_CAPTURE_V3_CAPABILITY):
            old_core,old_path,old_task=auth.training_capture_identity(old)
            self.assertEqual(codec.components(old),codec.components(codec.TRAINING_CAPTURE_V4_CAPABILITY))
            for key,value in (("capabilityVersion",old),("cpuEvidence",{"path":old_path,"sha256":"a"*64})):
                changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
                with self.subTest(old=old,key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            changed=deepcopy(policy)
            changed["trainingFailureCapture"]["cpuEvidence"]=bind_evidence({**evidence,"taskId":old_task})
            with self.subTest(old=old,key="task"),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            bind_evidence(evidence)
        with self.assertRaises(ValueError):auth.training_capture_identity("unknown_training_capture")

    def test_v5_core_and_cpu_scope_reject_all_previous_identities(self):
        auth=worker.auth;reader=MemoryReader();sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic v5 immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        core,evidence_path,task_id=auth.training_capture_identity(codec.TRAINING_CAPTURE_V5_CAPABILITY)
        self.assertEqual(evidence_path,".runtime/ai-painter/controller-repair-reviews/backend-observation-compatibility-repair-027-20261024/cpu-component-acceptance.json")
        self.assertEqual(task_id,"TRAINING-SAME-CALL-CAPTURE-027-CPU")
        self.assertEqual({**core,"capabilityVersion":codec.TRAINING_CAPTURE_CAPABILITY},auth.TRAINING_CAPTURE_CORE)
        evidence={"status":"cpu_component_passed_not_admitted","taskId":task_id,"qualificationGranted":False,
            "sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,"cudaInitialized":False,
                "realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,"syntheticOperations":"Synthetic v5 metadata only."}}
        def bind_evidence(proof):
            raw=json.dumps(proof).encode();reader.files[evidence_path]=raw
            return {"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}
        capture={**deepcopy(core),"componentSources":sources,"cpuEvidence":bind_evidence(evidence)}
        policy={"candidate":codec.TRAINING_CAPTURE_V5_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for old in (codec.TRAINING_CAPTURE_CAPABILITY,codec.TRAINING_CAPTURE_V2_CAPABILITY,codec.TRAINING_CAPTURE_V3_CAPABILITY,codec.TRAINING_CAPTURE_V4_CAPABILITY):
            old_core,old_path,old_task=auth.training_capture_identity(old)
            self.assertEqual(codec.components(old),codec.components(codec.TRAINING_CAPTURE_V5_CAPABILITY))
            for key,value in (("capabilityVersion",old),("cpuEvidence",{"path":old_path,"sha256":"a"*64})):
                changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
                with self.subTest(old=old,key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            changed=deepcopy(policy)
            changed["trainingFailureCapture"]["cpuEvidence"]=bind_evidence({**evidence,"taskId":old_task})
            with self.subTest(old=old,key="task"),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            bind_evidence(evidence)
        with self.assertRaises(ValueError):auth.training_capture_identity("unknown_training_capture")

    def test_v6_core_and_cpu_scope_reject_all_previous_identities(self):
        auth=worker.auth;reader=MemoryReader();sources=[]
        for i,logical in enumerate(auth.TRAINING_CAPTURE_SOURCES):
            raw=("synthetic v6 immutable source "+str(i)).encode();reader.files[logical]=raw
            sources.append({"path":logical,"sha256":hashlib.sha256(raw).hexdigest()})
        core,evidence_path,task_id=auth.training_capture_identity(codec.TRAINING_CAPTURE_V6_CAPABILITY)
        self.assertEqual(evidence_path,".runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/cpu-component-acceptance.json")
        self.assertEqual(task_id,"TRAINING-SAME-CALL-CAPTURE-031-CPU")
        self.assertEqual(core["maximumObservedGCalls"],1152)
        self.assertEqual(core["maximumLiveObservationContexts"],1)
        self.assertTrue(core["previousSuccessReleasedBeforeNextD"])
        self.assertNotIn("optimizerSteps",core)
        self.assertEqual(core["target"],auth.TRAINING_CAPTURE_CORE["target"])
        evidence={"status":"cpu_component_passed_not_admitted","taskId":task_id,"qualificationGranted":False,
            "sourceBindings":deepcopy(sources),"tests":{"passed":True,"testsRun":1,"cudaInitialized":False,
                "realModelCalls":0,"realAutogradCalls":0,"realOptimizerUpdates":0,"syntheticOperations":"Synthetic v6 metadata only."}}
        def bind_evidence(proof):
            raw=json.dumps(proof).encode();reader.files[evidence_path]=raw
            return {"path":evidence_path,"sha256":hashlib.sha256(raw).hexdigest()}
        capture={**deepcopy(core),"componentSources":sources,"cpuEvidence":bind_evidence(evidence)}
        policy={"candidate":codec.TRAINING_CAPTURE_V6_CAPABILITY,"trainingFailureCapture":capture}
        self.assertIs(auth.verify_training_capture_policy(reader,policy),capture)
        for old in (codec.TRAINING_CAPTURE_CAPABILITY,codec.TRAINING_CAPTURE_V2_CAPABILITY,codec.TRAINING_CAPTURE_V3_CAPABILITY,codec.TRAINING_CAPTURE_V4_CAPABILITY,codec.TRAINING_CAPTURE_V5_CAPABILITY):
            old_core,old_path,old_task=auth.training_capture_identity(old)
            self.assertEqual(codec.components(old),codec.components(codec.TRAINING_CAPTURE_V6_CAPABILITY))
            for key,value in (("capabilityVersion",old),("cpuEvidence",{"path":old_path,"sha256":"a"*64})):
                changed=deepcopy(policy);changed["trainingFailureCapture"][key]=value
                with self.subTest(old=old,key=key),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            changed=deepcopy(policy)
            changed["trainingFailureCapture"]["cpuEvidence"]=bind_evidence({**evidence,"taskId":old_task})
            with self.subTest(old=old,key="task"),self.assertRaises(ValueError):auth.verify_training_capture_policy(reader,changed)
            bind_evidence(evidence)
        with self.assertRaises(ValueError):auth.training_capture_identity("unknown_training_capture")

    def test_v2_map_probe_and_live_policy_selection_keep_original_arithmetic(self):
        capability=codec.TRAINING_CAPTURE_V2_CAPABILITY
        self.assertEqual(codec.model_capability(capability),MODEL)
        self.assertEqual(codec.components(capability),codec.components(codec.TRAINING_CAPTURE_CAPABILITY))
        configuration=self.configuration_scope(route_fixture(capability))
        self.assertEqual(configuration["objectSupportStructureWeight"],1)
        self.assertEqual(configuration["executionCeiling"]["epochs"],24)
        plan={"capabilityVersion":capability,"configuration":{"capabilityVersion":capability,"objectSupportStructureWeight":1}}
        with patch.object(profile,"execution_support_structure_weight",side_effect=AssertionError("legacy allowlist")):
            self.assertEqual(qualifier.qualification_probe_options(profile,plan),{"support_structure_weight":1.0})
            plan["configuration"]["capabilityVersion"]=codec.TRAINING_CAPTURE_CAPABILITY
            with self.assertRaises(ValueError):qualifier.qualification_probe_options(profile,plan)
        with patch.object(codec,"registered_training_interfaces",return_value=[route_fixture(capability)]):
            self.assertEqual(codec.execution_values(capability)["capability"],capability)
            with self.assertRaises(ValueError):codec.execution_values(capability+"_unknown")


    def test_canonical_contracts_reject_cross_version_and_legacy_activation(self):
        auth=worker.auth
        for capability in auth.CANONICAL_CAPABILITIES:
            core=auth.canonical_verification_identity(capability)
            self.assertEqual({**core,"activation":auth.CANONICAL_VERIFICATION["activation"]},auth.CANONICAL_VERIFICATION)
            with patch.object(codec,"validate_execution_policy",return_value="validated checkpoint"):
                self.assertEqual(auth.validate_execution_policy({"candidate":capability,"canonicalVerification":deepcopy(core)},{}),"validated checkpoint")
                for other_capability in auth.CANONICAL_CAPABILITIES:
                    if other_capability==capability:continue
                    with self.subTest(capability=capability,other=other_capability),self.assertRaisesRegex(ValueError,"canonical verification policy differs"):
                        auth.validate_execution_policy({"candidate":capability,"canonicalVerification":auth.canonical_verification_identity(other_capability)},{})
        for capability in (codec.TRAINING_CAPTURE_CAPABILITY,codec.TRAINING_CAPTURE_V2_CAPABILITY,"unknown"):
            with self.assertRaisesRegex(ValueError,"unknown canonical"):
                auth.canonical_verification_identity(capability)
            with patch.object(codec,"validate_execution_policy",return_value="validated checkpoint"):
                with self.assertRaisesRegex(ValueError,"legacy canonical"):
                    auth.validate_execution_policy({"candidate":capability,"canonicalVerification":auth.CANONICAL_VERIFICATION_V4},{})


if __name__ == "__main__":
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    print(json.dumps({"cpuThreads": torch.get_num_threads(),
                      "cpuInteropThreads": torch.get_num_interop_threads(),
                      "cudaInitialized": torch.cuda.is_initialized()}), flush=True)
    unittest.main(verbosity=2)
