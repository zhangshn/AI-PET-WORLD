"""Actual policy/qualifier orchestration with synthetic IO, networks and device.

No real model is constructed. The policy validator is not mocked. The original
qualifier functions are compiled from their saved AST without importing its
runner; only surrounding infrastructure and the observation constructor are
replaced. These tests do not establish an authenticated production package.
"""
import ast
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time
import traceback
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import torch


def prohibit_execution(stack):
    guards = []
    for owner, name in ((torch.nn.Module, "__init__"), (torch.nn.Module, "_call_impl"),
                        (torch.autograd, "grad"), (torch.autograd, "backward"),
                        (torch.Tensor, "backward"), (torch.cuda, "_lazy_init"),
                        (torch.cuda, "init"), (torch.optim.Optimizer, "__init__"),
                        (torch.optim.Optimizer, "step"), (subprocess, "Popen")):
        guards.append(stack.enter_context(patch.object(owner, name,
            side_effect=AssertionError("prohibited real execution: " + name))))
    return guards


with ExitStack() as import_scope:
    import_guards = prohibit_execution(import_scope)
    import decode1_entry_weight_quality_auth_v1 as auth
    import qualification_parameter0_capture_v1 as component
    from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as checkpoint
    for guard in import_guards:
        guard.assert_not_called()


CAPABILITY = "stage4_mvp256_dry_decode2_rgb_output_qualification_capture_v1"
MODEL = "stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1"
SAMPLE = "ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2"
QUALIFIER_PATH = ROOT / "ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py"
EXPECTED_CORE = {
    "schemaVersion": "qualification-parameter0-sequence-capture-v1", "capabilityVersion": CAPABILITY,
    "phase": "qualification", "sampleId": SAMPLE, "sampleOrdinal": 17, "split": "train",
    "target": {"index": 0, "name": "core.core.terrain.base_stem.layers.0.weight",
               "shape": [48, 31, 3, 3], "spatial": [192, 256]},
    "sequenceSamples": 48, "sameGeneratorAndDiscriminatorInstances": True,
    "originalOrderAndSeedKept": True, "originalGateAndToleranceKept": True,
    "originalFailureFirst": True, "additionalForwardCalls": 0, "additionalAutogradCalls": 0,
    "additionalOptimizerUpdates": 0, "maximumCaptureAndWorkspaceBytes": 67108864,
    "maximumAggregateSidecarBytes": 2097152, "terminalReserveBytes": 65536,
    "rawTargetGradientSets": 5, "finiteReferenceCoordinates": 1, "nonfiniteSumReferenceCalls": 0,
    "otherSampleCaptureAllowed": False, "qualificationGranted": False,
    "activation": "authenticated_new_package_only", "failureAction": "preserve_primary_and_close_no_retry",
    "completeSequenceAction": "original_same_package_training_only_after_all48_and_state_checks",
}


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


class MemoryReader:
    """Bounded immutable-byte fixture; hashes are recomputed on every read."""
    def __init__(self):
        self.files, self.events = {}, []
        self.primary_read_error = None
        self.unchanged_error = None

    def put(self, path, value):
        raw = value if type(value) is bytes else encode(value)
        self.files[path] = raw
        return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}

    def read(self, binding, maximum=2097152):
        self.events.append(("read", binding["path"]))
        if binding["path"].endswith("/gpu-failure.json") and self.primary_read_error is not None:
            raise self.primary_read_error
        raw = self.files[binding["path"]]
        auth.require(len(raw) <= maximum and hashlib.sha256(raw).hexdigest() == binding["sha256"],
                     "synthetic reader byte/hash mismatch")
        return raw

    def unchanged(self):
        self.events.append(("unchanged", None))
        if self.unchanged_error is not None:
            raise self.unchanged_error


def policy_fixture():
    reader = MemoryReader()
    sources = [reader.put(path, ("# synthetic component " + str(i)).encode())
               for i, path in enumerate(auth.QUALIFICATION_CAPTURE_SOURCES)]
    evidence = {"status": "cpu_component_passed_not_admitted", "taskId": "QUALIFICATION-SEQUENCE-CAPTURE-019-CPU",
                "qualificationGranted": False, "sourceBindings": deepcopy(sources),
                "tests": {"passed": True, "testsRun": 1, "cudaInitialized": False,
                          "modelCalls": 0, "autogradCalls": 0, "optimizerUpdates": 0}}
    evidence_binding = reader.put(".runtime/synthetic/capture-cpu.json", evidence)
    policy = {"candidate": CAPABILITY, "qualificationFailureCapture": {
        **deepcopy(EXPECTED_CORE), "componentSources": sources, "cpuEvidence": evidence_binding}}
    binding = reader.put("data/ai-painter/system-governance/synthetic-sequence-policy.json", policy)
    return reader, policy, binding, evidence


def load_qualifier(worker):
    tree = ast.parse(QUALIFIER_PATH.read_text(encoding="utf-8"), filename=str(QUALIFIER_PATH))
    wanted = {"Calls", "invoke_original_probe", "capture_for_sample", "_heartbeat_error_metadata", "run"}
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in wanted]
    assert {node.name for node in nodes} == wanted
    namespace = {"worker": worker, "ROOT": ROOT, "time": time, "math": math, "json": json,
                 "observation_for_context": lambda *args: None}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(QUALIFIER_PATH), "exec"), namespace)
    return SimpleNamespace(**{name: namespace[name] for name in wanted}), namespace


class Fixture:
    def __init__(self):
        self.reader, self.policy, self.policy_binding, self.evidence = policy_fixture()
        self.route = SimpleNamespace(capability=CAPABILITY, model_capability=MODEL,
                                     execution_policy=self.policy_binding, profile="synthetic_profile")
        self.train = [{"sampleId": "synthetic-" + str(i), "split": "train"} for i in range(48)]
        self.train[17]["sampleId"] = SAMPLE
        self.initial = {"generator": "a" * 64, "discriminator": "b" * 64}
        model_binding = self.reader.put(".runtime/synthetic/model-identity.json", {"initialState": self.initial})
        self.plan = {"capabilityVersion": CAPABILITY, "configuration": {
            "modelCapabilityVersion": MODEL, "gpuAdmissionSeconds": None, "gpuAdmissionWallMode": "completion",
            "objectSupportStructureWeight": 1}, "modelBinding": model_binding,
            "programBindings": {"capture" + str(i): dict(bound) for i, bound in enumerate(
                self.policy["qualificationFailureCapture"]["componentSources"])},
            "runId": "synthetic-run", "packageId": "synthetic-package", "outputRoot": ".runtime/synthetic/run"}
        self.package_binding = {"path": ".runtime/synthetic/package.json", "sha256": "d" * 64}
        self.context = auth.Context(self.reader, self.package_binding, {}, self.plan)
        self.model = SimpleNamespace(capability_version=MODEL, to=lambda device: None, parameters=lambda: ())
        self.critic = SimpleNamespace(to=lambda device: None, parameters=lambda: ())
        self.captures, self.probes, self.persisted, self.ownership = [], [], [], []
        self.primary = ValueError("synthetic original probe failure")
        self.fail_index = 17
        self.sidecar_error = self.primary_write_error = None
        self.final_sidecar_incomplete = None
        fixture = self

        class FakeCapture:
            def __init__(self, model, resource, *, sample, ordinal):
                self.used, self.primary = False, None
                fixture.captures.append((self, model, resource, sample, ordinal))

            def call(self, probe, *args, **kwargs):
                self.used = True
                try:
                    return probe(*args, **kwargs)
                except BaseException as error:
                    self.primary = error
                    raise

            def persist_failure(self, error, **kwargs):
                fixture.reader.events.append(("persist", None))
                fixture.persisted.append((error, kwargs))
                if fixture.sidecar_error is not None:
                    raise fixture.sidecar_error
                if fixture.final_sidecar_incomplete is not None:
                    return deepcopy(fixture.final_sidecar_incomplete)
                kwargs["write"]("qualification-target0-result.json", {"synthetic": True})
                return {"status": "target_evidence_complete", "secondaryErrors": []}

        self.capture_type = FakeCapture

        class Resource:
            device_identity = {"synthetic": True}

            def __init__(self, *args, **kwargs):
                pass

            def __call__(self):
                fixture.reader.events.append(("resource", None))

        self.resource = Resource()

        def write(root, path, value, *, terminal=False):
            self.reader.events.append(("write", path))
            if path.endswith("/gpu-failure.json") and self.primary_write_error is not None:
                raise self.primary_write_error
            auth.require(path not in self.reader.files, "synthetic exclusive write conflict")
            return self.reader.put(path, value)

        def probe(model, critic, sample, order, resource, *, event, failure_evidence, support_structure_weight):
            index = len(self.probes)
            self.probes.append(sample["sampleId"])
            self.ownership.append((model, critic, support_structure_weight))
            for kind, count in (("forward", 1), ("discriminator", 1), ("generator", 5)):
                for _ in range(count):
                    event("attempt", kind, None)
                    event("complete", kind, None)
            if index == self.fail_index:
                raise self.primary
            return {"passed": True}

        cuda = SimpleNamespace(is_available=lambda: True, is_bf16_supported=lambda: True,
                               set_per_process_memory_fraction=lambda fraction: None,
                               set_device=lambda device: None)
        fake_profile = SimpleNamespace(fresh_networks=lambda *args, **kwargs: (self.model, self.critic),
            zero_update_probe=probe, execution_support_structure_weight=lambda configuration: 1.0)
        shared = SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(
            state_hash=lambda network: self.initial["generator" if network is self.model else "discriminator"]))))
        self.worker = SimpleNamespace(auth=auth, checkpoint=checkpoint, require=auth.require,
            authenticate_live=lambda *args, **kwargs: self.context,
            runtime_for_plan=lambda plan: (SimpleNamespace(cuda=cuda), fake_profile, shared),
            configure_cpu=lambda: None, write=write, load_samples=lambda *args: (self.train, ["synthetic-order"]),
            ResourceGuard=Resource, GPU_SCHEMA="synthetic-gpu-gate")
        self.qualifier, self.namespace = load_qualifier(self.worker)

    def patches(self, stack):
        stack.enter_context(patch.object(auth, "execution_route", return_value=self.route))
        stack.enter_context(patch.object(auth, "model_arguments", return_value={"model_capability": MODEL}))
        stack.enter_context(patch.object(auth, "Reader", return_value=self.reader))
        stack.enter_context(patch.object(checkpoint, "execution_values", return_value={"qualification_completion": True}))
        stack.enter_context(patch.object(component, "Parameter0ProbeCapture", self.capture_type))

    def prefix_calls(self):
        calls = self.qualifier.Calls()
        calls.counts = {kind + suffix: 17 * (5 if kind == "generator" else 1)
                        for kind in calls.LIMITS for suffix in ("Attempted", "Completed")}
        return calls

    def activate(self, *, index=17, completed=17, calls=None):
        return self.qualifier.capture_for_sample(self.context, self.model, self.resource,
            self.train, index, calls if calls is not None else self.prefix_calls(), completed)

    def run(self):
        return self.qualifier.run(self.package_binding, root=ROOT)


class QualificationSequenceActivationTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.scope = ExitStack()
        self.addCleanup(self.scope.close)
        for guard in prohibit_execution(self.scope):
            self.addCleanup(guard.assert_not_called)

    def fixture(self):
        fixture = Fixture()
        fixture.patches(self.scope)
        return fixture

    def test_core_contract_exactly_matches_fixed_requested_scope(self):
        self.assertEqual(auth.QUALIFICATION_CAPTURE_CORE, EXPECTED_CORE)

    def test_actual_policy_validator_reads_all_four_bound_sources_and_cpu_evidence(self):
        reader, policy, _, _ = policy_fixture()
        self.assertIs(auth.verify_qualification_capture_policy(reader, policy), policy["qualificationFailureCapture"])
        self.assertEqual([path for event, path in reader.events if event == "read"],
                         list(auth.QUALIFICATION_CAPTURE_SOURCES) + [policy["qualificationFailureCapture"]["cpuEvidence"]["path"]])

    def test_legacy_policy_has_no_capture_and_cannot_accept_capture_contract(self):
        reader, policy, _, _ = policy_fixture()
        self.assertIsNone(auth.verify_qualification_capture_policy(reader, {"candidate": checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY}))
        self.assertEqual(reader.events, [])
        policy["candidate"] = checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY
        with self.assertRaises(ValueError):
            auth.verify_qualification_capture_policy(reader, policy)

    def test_core_extra_missing_and_tampered_fields_are_rejected(self):
        for field, value in (("unexpected", True), ("sampleOrdinal", 18), ("sequenceSamples", 1),
                             ("additionalAutogradCalls", 1), ("originalFailureFirst", False),
                             ("target", {"index": 40}), ("maximumAggregateSidecarBytes", 2097153)):
            reader, policy, _, _ = policy_fixture()
            policy["qualificationFailureCapture"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                auth.verify_qualification_capture_policy(reader, policy)
        reader, policy, _, _ = policy_fixture()
        del policy["qualificationFailureCapture"]["originalGateAndToleranceKept"]
        with self.assertRaises(ValueError):
            auth.verify_qualification_capture_policy(reader, policy)

    def test_source_count_order_duplicate_and_binding_metadata_are_rejected(self):
        for mode in ("missing", "extra", "duplicate", "order", "binding-extra"):
            reader, policy, _, _ = policy_fixture()
            sources = policy["qualificationFailureCapture"]["componentSources"]
            if mode == "missing": sources.pop()
            elif mode == "extra": sources.append(dict(sources[0]))
            elif mode == "duplicate": sources[1] = dict(sources[0])
            elif mode == "order": sources.reverse()
            else: sources[0]["callerVerified"] = True
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                auth.verify_qualification_capture_policy(reader, policy)

    def test_source_and_cpu_evidence_bytes_must_match_their_bound_hashes(self):
        for position in range(5):
            reader, policy, _, _ = policy_fixture()
            contract = policy["qualificationFailureCapture"]
            binding = (contract["componentSources"] + [contract["cpuEvidence"]])[position]
            reader.files[binding["path"]] += b"tampered"
            with self.subTest(position=position), self.assertRaises(ValueError):
                auth.verify_qualification_capture_policy(reader, policy)

    def test_cpu_evidence_content_and_source_relationship_are_verified_after_hash(self):
        mutations = [lambda e: e.update(status="passed"), lambda e: e.update(taskId="different-task"),
            lambda e: e.update(qualificationGranted=True), lambda e: e["sourceBindings"].reverse(),
            lambda e: e["tests"].update(passed=False), lambda e: e["tests"].update(testsRun=True),
            lambda e: e["tests"].update(testsRun=0), lambda e: e["tests"].update(cudaInitialized=True),
            lambda e: e["tests"].update(modelCalls=True), lambda e: e["tests"].update(autogradCalls=1),
            lambda e: e["tests"].update(optimizerUpdates=1)]
        for index, mutate in enumerate(mutations):
            reader, policy, _, evidence = policy_fixture()
            mutate(evidence)
            contract = policy["qualificationFailureCapture"]
            contract["cpuEvidence"] = reader.put(contract["cpuEvidence"]["path"], evidence)
            with self.subTest(index=index), self.assertRaises(ValueError):
                auth.verify_qualification_capture_policy(reader, policy)

    def test_required_roles_include_new_four_without_legacy_training_capture_roles(self):
        route = {"completion": True, "same_call_capture": True,
                 "policy": {"path": "data/ai-painter/system-governance/synthetic-policy.json"}}
        with patch.object(checkpoint, "execution_values", return_value=route):
            new = auth.required_program_roles(CAPABILITY)
            old = auth.required_program_roles(checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY)
        self.assertEqual(tuple(new[name] for name in ("qualificationCapture", "qualificationGateAuth",
                         "qualificationObserver", "qualificationReference")), auth.QUALIFICATION_CAPTURE_SOURCES)
        self.assertFalse(any(name.startswith("sameCall") for name in new))
        self.assertTrue(all(name in old for name in ("sameCallCapture", "sameCallStorage", "sameCallBridge", "sameCallProfile")))

    def test_authority_inputs_bind_capture_sources_and_cpu_evidence(self):
        _, policy, binding, _ = policy_fixture()
        old = {name: binding for name in ("acceptance", "terminal", "policy", "originalNormativeBytes", "request")}
        policy.update(priorProgressPublicationCpuEvidence=binding, previousExecutionPolicy=binding,
            modelBoundary={"jointCpuRule": binding, "frozenCpuSources": []},
            priorCpuEvidence=old, jointRuleCpuEvidence=old,
            qualificationOnlyPredecessor={"policy": binding, "normativeBytes": binding},
            resourceFailureRecord={"componentEvidence": binding}, numericRepairCpuEvidence=binding)
        route = {"specification": binding, "policy": binding, "progress_policy": binding, "completion": True}
        with patch.object(checkpoint, "execution_values", return_value=route), patch.object(auth, "candidate_binding", return_value=binding):
            inputs = auth.authority_inputs(policy)
        contract = policy["qualificationFailureCapture"]
        self.assertEqual(inputs[-5:], contract["componentSources"] + [contract["cpuEvidence"]])

    def test_capture_activates_only_exact_sample_after_original_seventeen_successes(self):
        fixture = self.fixture()
        result = fixture.activate()
        self.assertIs(type(result), fixture.capture_type)
        self.assertEqual(len(fixture.captures), 1)
        _, model, resource, sample, ordinal = fixture.captures[0]
        self.assertIs(model, fixture.model)
        self.assertIs(resource, fixture.resource)
        self.assertIs(sample, fixture.train[17])
        self.assertEqual(ordinal, 17)
        self.assertIn(("unchanged", None), fixture.reader.events)

    def test_legacy_route_and_other_new_route_samples_do_not_construct_capture(self):
        fixture = self.fixture()
        fixture.plan["capabilityVersion"] = checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY
        self.assertIsNone(fixture.activate())
        fixture.plan["capabilityVersion"] = CAPABILITY
        for index in (0, 16, 18, 47):
            self.assertIsNone(fixture.activate(index=index))
        self.assertEqual(fixture.captures, [])
        self.assertEqual(fixture.reader.events, [])

    def test_wrong_context_sequence_sample_and_prefix_counts_fail_closed(self):
        fixture = self.fixture()
        with self.assertRaises(ValueError):
            fixture.qualifier.capture_for_sample(SimpleNamespace(plan=fixture.plan), fixture.model,
                fixture.resource, fixture.train, 17, fixture.prefix_calls(), 17)
        for index in (True, -1, 48):
            with self.subTest(index=index), self.assertRaises(ValueError): fixture.activate(index=index)
        fixture.train.pop()
        with self.assertRaises(ValueError): fixture.activate()
        fixture.train.append({"sampleId": "synthetic-47", "split": "train"})
        for field, value in (("sampleId", "different"), ("split", "validation")):
            previous = fixture.train[17][field]
            fixture.train[17][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): fixture.activate()
            fixture.train[17][field] = previous
        with self.assertRaises(ValueError): fixture.activate(completed=16)
        for key in fixture.prefix_calls().counts:
            counts = fixture.prefix_calls()
            counts.counts[key] -= 1
            with self.subTest(key=key), self.assertRaises(ValueError): fixture.activate(calls=counts)
        self.assertEqual(fixture.captures, [])

    def test_wrong_model_configuration_missing_duplicate_sources_and_drift_are_refused(self):
        fixture = self.fixture()
        fixture.model.capability_version = "wrong-model"
        with self.assertRaises(ValueError): fixture.activate()
        fixture.model.capability_version = MODEL
        fixture.plan["configuration"]["modelCapabilityVersion"] = "wrong-model"
        with self.assertRaises(ValueError): fixture.activate()
        fixture.plan["configuration"]["modelCapabilityVersion"] = MODEL
        removed = fixture.plan["programBindings"].pop("capture0")
        with self.assertRaises(ValueError): fixture.activate()
        fixture.plan["programBindings"]["capture0"] = removed
        fixture.plan["programBindings"]["duplicate"] = dict(removed)
        with self.assertRaises(ValueError): fixture.activate()
        del fixture.plan["programBindings"]["duplicate"]
        fixture.reader.unchanged_error = ValueError("synthetic drift")
        with self.assertRaisesRegex(ValueError, "synthetic drift"): fixture.activate()
        self.assertEqual(fixture.captures, [])

    def test_actual_run_saves_and_reads_primary_before_same_call_sidecars(self):
        fixture = self.fixture()
        with self.assertRaises(ValueError) as caught: fixture.run()
        self.assertIs(caught.exception, fixture.primary)
        self.assertEqual(fixture.probes, [sample["sampleId"] for sample in fixture.train[:18]])
        self.assertTrue(all(model is fixture.model and critic is fixture.critic and weight == 1.0
                            for model, critic, weight in fixture.ownership))
        relevant = [entry for entry in fixture.reader.events if entry[0] == "persist"
                    or (entry[1] or "").endswith(("/gpu-failure.json", "/qualification-target0-result.json"))]
        self.assertEqual([kind for kind, _ in relevant], ["write", "read", "persist", "write"])
        error, saved = fixture.persisted[0]
        self.assertIs(error, fixture.primary)
        self.assertEqual(saved["actual_counts"], {kind + suffix: 18 * (5 if kind == "generator" else 1)
                         for kind in fixture.qualifier.Calls.LIMITS for suffix in ("Attempted", "Completed")})
        self.assertEqual(saved["attempted_sample"]["sampleId"], SAMPLE)
        self.assertEqual(set(saved["programs"]), set(auth.QUALIFICATION_CAPTURE_SOURCES))

    def test_primary_read_failure_does_not_replace_original_or_write_sidecars(self):
        fixture = self.fixture()
        fixture.reader.primary_read_error = OSError("synthetic readback failure")
        with self.assertRaises(ValueError) as caught: fixture.run()
        self.assertIs(caught.exception, fixture.primary)
        self.assertIn("synthetic readback failure", fixture.primary.secondary_evidence_error)
        self.assertTrue(any("qualification_evidence_secondary:" in note and "synthetic readback failure" in note
                            for note in fixture.primary.__notes__))
        self.assertEqual(fixture.persisted, [])
        self.assertIn(fixture.plan["outputRoot"] + "/gpu-failure.json", fixture.reader.files)

    def test_primary_write_and_sidecar_failures_do_not_replace_original(self):
        for failure in ("primary", "sidecar"):
            with ExitStack() as scope:
                fixture = Fixture()
                fixture.patches(scope)
                if failure == "primary": fixture.primary_write_error = OSError("synthetic primary write failure")
                else: fixture.sidecar_error = OSError("synthetic sidecar failure")
                with self.subTest(failure=failure), self.assertRaises(ValueError) as caught: fixture.run()
                self.assertIs(caught.exception, fixture.primary)
                self.assertIn("synthetic", fixture.primary.secondary_evidence_error)
                if failure == "primary": self.assertEqual(fixture.persisted, [])

    def test_final_sidecar_incomplete_survives_in_original_exception_notes_and_traceback(self):
        fixture = self.fixture()
        original_message = str(fixture.primary)
        fixture.final_sidecar_incomplete = {"status": "incomplete", "incompleteAt": None,
            "failureClassification": "original_gate_failure", "manifest": None,
            "secondaryErrors": [{"type": "OSError", "message": "synthetic final sidecar write failure"}]}
        caught = None
        try:
            fixture.run()
        except ValueError as error:
            caught = error
            rendered = "".join(traceback.format_exception(type(error), error, error.__traceback__))
        self.assertIs(caught, fixture.primary)
        self.assertEqual(str(caught), original_message)
        self.assertEqual(caught.qualification_capture_error, fixture.final_sidecar_incomplete)
        self.assertTrue(any("qualification_capture_secondary:" in note and
            "synthetic final sidecar write failure" in note for note in caught.__notes__))
        self.assertTrue(all(len(note) <= len("qualification_capture_secondary: ") + 8192
                            for note in caught.__notes__))
        self.assertIn("synthetic final sidecar write failure", rendered)
        self.assertEqual(len(fixture.persisted), 1)
        self.assertIn(fixture.plan["outputRoot"] + "/gpu-failure.json", fixture.reader.files)
        self.assertNotIn(fixture.plan["outputRoot"] + "/qualification-target0-result.json", fixture.reader.files)

    def test_incomplete_capture_note_is_bounded_without_changing_original_message(self):
        fixture = self.fixture()
        original_message = str(fixture.primary)
        fixture.final_sidecar_incomplete = {"status": "incomplete", "secondaryErrors": [
            {"type": "OSError", "message": "synthetic final sidecar failure: " + "x" * 20000}]}
        with self.assertRaises(ValueError) as caught:
            fixture.run()
        self.assertIs(caught.exception, fixture.primary)
        self.assertEqual(str(caught.exception), original_message)
        self.assertEqual(len(caught.exception.__notes__), 1)
        note = caught.exception.__notes__[0]
        self.assertEqual(len(note), len("qualification_capture_secondary: ") + 8192)
        self.assertIn("synthetic final sidecar failure", note)

    def test_other_sample_failure_does_not_capture_or_reuse_passed_target_capture(self):
        for failed_index in (3, 18):
            with ExitStack() as scope:
                fixture = Fixture()
                fixture.patches(scope)
                fixture.fail_index = failed_index
                with self.subTest(index=failed_index), self.assertRaises(ValueError) as caught: fixture.run()
                self.assertIs(caught.exception, fixture.primary)
                self.assertEqual(fixture.persisted, [])
                self.assertEqual(len(fixture.captures), 1 if failed_index > 17 else 0)

    def test_full_synthetic_sequence_keeps_order_instances_counts_and_one_target_capture(self):
        fixture = self.fixture()
        fixture.fail_index = None
        binding = fixture.run()
        gate = auth.read_json(fixture.reader, binding)
        self.assertEqual(fixture.probes, [sample["sampleId"] for sample in fixture.train])
        self.assertEqual(len(fixture.captures), 1)
        self.assertEqual(fixture.persisted, [])
        self.assertEqual(gate["actualCounts"], {kind + suffix: limit for kind, limit in fixture.qualifier.Calls.LIMITS.items()
                         for suffix in ("Attempted", "Completed")})
        self.assertEqual(gate["optimizerSteps"], 0)
        self.assertEqual(gate["initialState"], gate["finalState"])
        self.assertTrue(all(model is fixture.model and critic is fixture.critic for model, critic, _ in fixture.ownership))


if __name__ == "__main__":
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    print(json.dumps({"cpuThreads": torch.get_num_threads(), "cpuInteropThreads": torch.get_num_interop_threads(),
                      "cudaInitialized": torch.cuda.is_initialized(), "scope": "synthetic_io_and_probe_only"}), flush=True)
    unittest.main(verbosity=2)
