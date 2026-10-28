"""Replay metadata/synthetic control tests; no real samples, model, CUDA or training."""
import ast
from collections import Counter
import copy
from contextlib import ExitStack, nullcontext, contextmanager
import hashlib
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import painter_replay_retention_fit_v1 as fit


def parent_metadata():
    ids = list(fit.SAMPLES)
    package = {"experimentIdentity": fit.single.PARENT_RUN, "modelCapability": fit.CAPABILITY,
        "arm": "terrain-ecology", "selectedSampleIds": ids}
    terminal = {"runId": fit.single.PARENT_RUN, "executionState": "completed", "result": fit.PARENT["result"]}
    result = {"experimentIdentity": fit.single.PARENT_RUN, "status": "experiment_executed_not_visual_qualified",
        "optimizerSteps": {"generator": 448, "discriminator": 448}, "checkpointReloadExact": True,
        "artifacts": [fit.PARENT["checkpoint"], fit.PARENT["prediction"]],
        "sampleVisits": dict.fromkeys(ids, 8)}
    return package, terminal, result


def package_metadata(arm):
    ids = list(fit.SAMPLES)
    schedule = fit.make_schedule(ids, arm)
    run = "replay-retention-" + arm + "-v1-" + "a" * 20
    pkg = {"schemaVersion": fit.SCHEMA, "policy": copy.deepcopy(fit.BOUNDARY_POLICY_BINDING) if arm == "balanced-boundary" else copy.deepcopy(fit.BALANCED_POLICY_BINDING) if arm == "balanced"
            else {"path": fit.POLICIES[arm], "sha256": "c" * 64},
        "arm": arm, "modelCapability": fit.CAPABILITY, "training": fit.training_for(arm),
        "resources": fit.resources_for(arm), "checkpoint": copy.deepcopy(fit.PARENT["checkpoint"]),
        "sourcePlan": {"path": "synthetic-plan.json", "sha256": "a" * 64},
        "sourceTerminal": copy.deepcopy(fit.PARENT["terminal"]),
        "parentExperiment": copy.deepcopy(fit.PARENT), "schedule": schedule,
        "plannedSampleVisits": fit.expected_visits(schedule), "qualificationGranted": False,
        "optimizerInitialization": "fresh_AdamW_no_parent_moments_available",
        "experimentIdentity": run, "outputRoot": fit.common.OUTPUT + run,
        "selectedSampleIds": [fit.SAMPLE] if arm == "short" else list(fit.SAMPLES)}
    if arm == 'balanced-boundary':
        pkg['sampleIdentities'] = [dict(sampleId=sid, split='train',
            image=dict(path=f'data/synthetic/{n}.png', sha256='a'*64),
            conditionPack=dict(path=f'data/synthetic/{n}.json', sha256='b'*64),
            channels=[dict(id='terrain_path_ground', path=f'data/synthetic/{n}-road.png', sha256='c'*64)])
            for n,sid in enumerate(ids)]
        pkg['boundaryInputBindings'] = fit.boundary_input_bindings(pkg['sampleIdentities'])
        pkg['inputs'] = [row[k] for row in pkg['boundaryInputBindings'] for k in ('image','road','conditionPack')]
    return pkg


def policy_metadata(arm):
    return json.loads((ROOT / fit.POLICIES[arm]).read_text(encoding="utf-8"))


def checkpoint_metadata(pkg, bound):
    return {"schema": "replay-retention-fit-state-v1", "packageSha256": bound["sha256"],
        **{key: copy.deepcopy(pkg[key]) for key in ("arm", "modelCapability", "sourcePlan", "parentExperiment", "training")},
        "counts": dict.fromkeys(("generator", "discriminator"), len(pkg["schedule"])),
        "sampleVisits": fit.expected_visits(pkg["schedule"]), "checkpointPromotable": False,
        "model": {}, "critic": {}}


def admission_metadata(ids):
    return [{"sampleId": sid, "proof": {"passed": True, "optimizerCreated": False,
        "modelCapabilityVersion": fit.CAPABILITY, "cudaRngChecked": True,
        "optimizerUpdates": 0, "callCounts": {"generatorForwards": 1, "generatorForwardCompleted": 1,
            "generatorAutograd": 5, "discriminatorAutograd": 1}}} for sid in ids]


class SyntheticValue:
    def __init__(self, value): self.value = value
    def detach(self): return self
    def cpu(self): return self
    def permute(self, *args): return self
    def clamp(self, *args): return self
    def numpy(self): return self
    def round(self): return self
    def astype(self, *args): return self
    def __getitem__(self, key): return self
    def __mul__(self, value): return self


class SyntheticNetwork:
    def __init__(self, harness, name):
        self.harness, self.name, self.version, self.training = harness, name, 0, True
    def parameters(self): return iter((self.name + "-metadata-parameter",))
    def modules(self): return iter((self,))
    def train(self): self.training = True
    def eval(self): self.training = False
    def to(self, device): return self
    def state_dict(self): return {"metadata": SyntheticValue(self.version)}
    def load_state_dict(self, value, *, strict):
        self.harness.strict_loads.append((self.name, strict))
        if strict is not True: raise AssertionError("strict reload required")
        self.version = value["metadata"].value + int(self.harness.bad_reload)


class MemoryPath:
    def __init__(self, harness, logical=""): self.harness, self.logical = harness, logical
    def __truediv__(self, name): return MemoryPath(self.harness, self.logical + ("/" if self.logical else "") + str(name))
    def __str__(self): return "synthetic-memory-root/" + self.logical
    def read_bytes(self): return self.harness.files[self.logical]
    def rglob(self, pattern):
        return [MemoryPath(self.harness, name) for name in self.harness.files if name.startswith(self.logical + "/")]
    def is_file(self): return True
    def stat(self): return SimpleNamespace(st_size=len(self.read_bytes()))


class WorkerHarness:
    """Real execute control flow, entirely synthetic dependencies and in-memory bytes."""
    def __init__(self, arm, *, bad_gate=None, fail_pair=None, late_source=False,
            bad_parent=False, bad_continuity=False, bad_reload=False, bad_saved=False):
        self.arm, self.files, self.states, self.events = arm, {}, [], []
        self.bad_gate, self.fail_pair, self.late_source = bad_gate, fail_pair, late_source
        self.bad_reload, self.bad_saved = bad_reload, bad_saved
        self.strict_loads, self.pairs, self.optimizers, self.probe_ids, self.rgb_calls = [], [], [], [], []
        self.primary = RuntimeError("synthetic pair first error")
        self.scopes = []
        self.pkg = package_metadata(arm)
        self.policy = policy_metadata(arm)
        self.model, self.critic = SyntheticNetwork(self, "generator"), SyntheticNetwork(self, "discriminator")
        self.samples = [{"sampleId": sid, "split": "train"} for sid in self.pkg["selectedSampleIds"]]
        self.pkg.update(sampleIdentities=self.pkg.get('sampleIdentities', [{"sampleId": s["sampleId"]} for s in self.samples]),
            parentStateHashes={"generator": "generator:0", "discriminator": "discriminator:0"}, inputs=[],
            a100Reference={"available": False, "artifacts": {}} if arm == "short" else None)
        if bad_parent: self.pkg["parentStateHashes"]["generator"] = "foreign-parent"
        self.files["synthetic-module.py"] = b"synthetic source declaration"
        self.pkg["programs"] = [self.binding("synthetic-module.py")]
        self.files["synthetic-spec.md"] = b"synthetic specification binding"
        self.pkg["specification"] = self.binding("synthetic-spec.md")
        # Registered balanced identity includes its real policy bytes; arbitrary
        # serialization of a self-consistent document must not stand in for it.
        self.store(fit.POLICIES[arm], (ROOT / fit.POLICIES[arm]).read_bytes()
            if arm in ("balanced", "balanced-boundary") else self.policy)
        if arm == 'balanced-boundary':
            self.pkg['inputs'] = [row[k] for row in self.pkg['boundaryInputBindings'] for k in ('image','road','conditionPack')]
            for bound in self.pkg['inputs']: self.files[bound['path']] = b'synthetic input'
        self.pkg["policy"] = self.binding(fit.POLICIES[arm])
        self.bound = self.store(self.pkg["outputRoot"] + "/package.json", self.pkg)
        registry = {"runId": self.pkg["experimentIdentity"], "activeExecution": {"synthetic": True}}
        raw = json.dumps(registry).encode()
        self.files[".runtime/ai-painter/current-execution-registry/current.json"] = raw
        self.store(self.pkg["outputRoot"] + "/controller-lease.json", {"registrySha256": hashlib.sha256(raw).hexdigest(), "workerParentPid": 1})
        self.store(self.pkg["outputRoot"] + "/heartbeat.json", {"heartbeatAtUtc": fit.common.now()})
        self.files[fit.PARENT["prediction"]["path"]] = json.dumps(
            [999 if bad_continuity else 0, fit.SAMPLE]).encode()
        self.profile = SimpleNamespace(zero_update_probe=self.probe, sample_forward=self.forward,
            fresh_networks=self.fresh, perform_pair=object())
        if arm == 'balanced-boundary':
            self.profile.background = SimpleNamespace(boundary_rgb_scope=self.boundary_scope,
                zero_update_probe=self.probe, perform_pair=lambda *a, **k:self.boundary_result(),
                sample_forward=self.forward, fresh_networks=lambda order, **k:self.fresh(order))
        self.torch = SimpleNamespace(manual_seed=lambda seed: None, inference_mode=nullcontext,
            cuda=SimpleNamespace(is_available=lambda: True, set_per_process_memory_fraction=lambda value: None,
                set_device=lambda value: None), optim=SimpleNamespace(AdamW=self.optimizer),
            equal=lambda a, b: a.value == b.value, save=self.save_state, load=self.load_state)
        self.np = SimpleNamespace(random=SimpleNamespace(seed=lambda seed: None),
            asarray=lambda image: image.array, array_equal=lambda a, b: a.value == b.value)
        self.api = (self.torch, self.np, SimpleNamespace(disk_usage=lambda path: SimpleNamespace(free=4 * 1024 ** 3),
            pid_exists=lambda pid: True), None, self.profile, SimpleNamespace(observed_pair=self.pair),
            SimpleNamespace(BoundReader=lambda root: SimpleNamespace(read=lambda b: self.files[b["path"]], unchanged=lambda: None)),
            None, None, None, lambda *args: {"syntheticMetric": True})

    def binding(self, logical):
        for bound in self.pkg.get('inputs', []):
            if bound['path'] == logical: return copy.deepcopy(bound)
        return {"path": logical, "sha256": hashlib.sha256(self.files[logical]).hexdigest()}
    @contextmanager
    def boundary_scope(self, sample):
        self.scopes.append(sample['sampleId'])
        yield
    def boundary_result(self):
        return dict(fiveGradientFacts=dict(trainingObjective=fit.BOUNDARY_OBJECTIVE,
            scalarValues=dict(boundaryPathRgbWeighted=.01), boundaryRgb=dict(weight=.01)))
    def store(self, logical, value):
        if logical in self.files: raise AssertionError("in-memory evidence overwrite")
        self.files[logical] = value if type(value) is bytes else json.dumps(value).encode()
        return self.binding(logical)
    def read(self, bound):
        if self.binding(bound["path"]) != bound: raise AssertionError("synthetic immutable binding changed")
        return json.loads(self.files[bound["path"]])
    def probe(self, model, critic, sample, order, resource, **kwargs):
        self.events.append(("gate", sample["sampleId"]))
        self.probe_ids.append(sample["sampleId"])
        if "support_structure_weight" in kwargs: raise AssertionError("old0.1 override added")
        proof = admission_metadata([sample["sampleId"]])[0]["proof"]
        if self.bad_gate == len(self.probe_ids) - 1: proof["passed"] = False
        if self.arm == 'balanced-boundary': proof.update(self.boundary_result())
        return proof
    def forward(self, model, sample):
        self.rgb_calls.append((model.name, model.version, sample["sampleId"]))
        return SyntheticValue([model.version, sample["sampleId"]])
    def fresh(self, order):
        self.events.append(("fresh_reload", None))
        return SyntheticNetwork(self, "generator"), SyntheticNetwork(self, "discriminator")
    def optimizer(self, parameters, **kwargs):
        self.events.append(("optimizer", None))
        if self.probe_ids != self.pkg["selectedSampleIds"]: raise AssertionError("optimizer before all own gates")
        if kwargs != dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False):
            raise AssertionError("original AdamW settings changed")
        value = SimpleNamespace(state={}, parameters=tuple(parameters))
        self.optimizers.append(value)
        return value
    def pair(self, perform, observed_model, model, critic, sample, order, go, do, counts, ledger, resource, unused, **kwargs):
        self.events.append(("pair", sample["sampleId"]))
        if self.arm == 'balanced-boundary':
            if perform.__self__.background is not self.profile.background or kwargs: raise AssertionError('boundary wrapper differs')
            output = perform(model, critic, sample)
        else:
            if perform is not self.profile.perform_pair or kwargs: raise AssertionError("original pair/loss changed")
            output = {"syntheticExistingResult": True}
        self.pairs.append(sample["sampleId"])
        critic.version += 1; counts["discriminator"] += 1; ledger["discriminator"] += 1
        if self.fail_pair == len(self.pairs): raise self.primary
        model.version += 1; counts["generator"] += 1; ledger["generator"] += 1
        return output
    def save_state(self, state, stream):
        self.states.append(copy.deepcopy(state)); stream.write(str(len(self.states) - 1).encode())
    def load_state(self, stream, *, map_location, weights_only):
        if map_location != "cpu" or weights_only is not True: raise AssertionError("restricted reload changed")
        value = copy.deepcopy(self.states[int(stream.read())])
        if self.bad_saved: value["counts"]["generator"] -= 1
        return value
    def result(self): return json.loads(self.files[self.pkg["outputRoot"] + "/result.json"])
    def run(self):
        harness = self
        class ImageValue:
            def __init__(self, array): self.array = array
            def convert(self, mode): return self
            def save(self, stream, *, format): stream.write(json.dumps(self.array.value).encode())
        pil = ModuleType("PIL")
        pil.Image = SimpleNamespace(fromarray=lambda array: ImageValue(array),
            open=lambda stream: ImageValue(SyntheticValue(json.loads(stream.read()))))
        controller = ModuleType("painter_learning_capacity_experiment")
        controller.verify_controller_process = lambda *args: None
        class Observer:
            def __init__(self, *args): self.errors = []
            def attempt(self, action): return action()
            def progress(self, *args, **kwargs): pass
            def artifact(self, *args, **kwargs): pass
            def committed_metric(self, *args): pass
            def finish(self, *args): return {"path": "synthetic-observation", "sha256": "e" * 64}
        def source(reader, policy, api, resource):
            resource()
            return {}, {"sourcePlan": self.pkg["sourcePlan"]}, self.samples, self.pkg["sampleIdentities"], [], self.model, self.critic
        def closure():
            return self.pkg["programs"] + ([{"path": "undeclared-late-module.py", "sha256": "0" * 64}] if self.late_source else [])
        with ExitStack() as stack:
            for name, value in dict(ROOT=MemoryPath(self), read=self.read, save=self.store, binding=self.binding,
                    imports=lambda: self.api, source=source, ObservationRecorder=Observer, project_sources=closure,
                    reference_a100=lambda reader: {"available": False, "artifacts": {}},
                    state_hash=lambda network: network.name + ":" + str(network.version)).items():
                stack.enter_context(patch.object(fit, name, value))
            stack.enter_context(patch.object(fit.subprocess, "run", return_value=SimpleNamespace(stdout="metadata-uuid,40,4096")))
            stack.enter_context(patch.dict(sys.modules, {"PIL": pil, "painter_learning_capacity_experiment": controller}))
            fit.execute(self.bound)


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.ids = list(fit.SAMPLES)

    def test_B_exact_alternation_round_robin_and_original_order(self):
        original = list(self.ids)
        schedule = fit.make_schedule(self.ids, "mixed")
        others = [sid for sid in self.ids if sid != fit.SAMPLE]
        self.assertEqual(len(schedule), 200)
        self.assertEqual(schedule[::2], [fit.SAMPLE] * 100)
        self.assertEqual(schedule[1::2], [others[i % 47] for i in range(100)])
        self.assertEqual(fit.expected_visits(schedule), dict(Counter(schedule)))
        self.assertEqual(Counter(schedule)[fit.SAMPLE], 100)
        self.assertEqual([Counter(schedule)[sid] for sid in others], [3] * 6 + [2] * 41)
        self.assertEqual(self.ids, original)

    def test_C_exact_target_only_one_hundred_pairs(self):
        schedule = fit.make_schedule(self.ids, "short")
        self.assertEqual(schedule, [fit.SAMPLE] * 100)
        self.assertEqual(fit.expected_visits(schedule), {fit.SAMPLE: 100})

    def test_balanced_four_original_passes_then_first_eight_and_exact_exposures(self):
        original = list(self.ids)
        schedule = fit.make_schedule(self.ids, "balanced")
        self.assertEqual(schedule, original * 4 + original[:8])
        visits = Counter(schedule)
        self.assertEqual(len(schedule), 200)
        self.assertEqual(len(visits), 48)
        self.assertEqual([visits[sid] for sid in original], [5] * 8 + [4] * 40)
        self.assertEqual(visits[fit.SAMPLE], 5)
        self.assertEqual(visits["mvp64-slot164-objects-v5-20261020"], 4)
        self.assertEqual(self.ids, original)

    def test_reordered_input_cannot_replace_frozen_original_train_order(self):
        reversed_ids = list(reversed(self.ids))
        for arm in ("mixed", "short", "balanced"):
            with self.assertRaisesRegex(ValueError, "original ordered48"):
                fit.make_schedule(reversed_ids, arm)

    def test_bad_membership_count_duplicate_missing_target_and_unknown_arm(self):
        invalid = ([], self.ids[:-1], self.ids + ["extra"], [self.ids[0]] * 48,
            ["missing-target-" + str(i) for i in range(48)])
        for ids in invalid:
            for arm in ("mixed", "short", "balanced"):
                with self.subTest(arm=arm, ids=ids[:2]), self.assertRaises(ValueError):
                    fit.make_schedule(ids, arm)
        duplicate = list(self.ids)
        duplicate[4] = duplicate[5]
        for arm in ("mixed", "short", "balanced"):
            with self.assertRaises(ValueError):
                fit.make_schedule(duplicate, arm)
        for arm in ("A", "B", "C", "b", "", None, True, 1):
            with self.subTest(arm=arm), self.assertRaises(ValueError):
                fit.make_schedule(self.ids, arm)


class ParentMetadataTests(unittest.TestCase):
    def test_exact_completed_parent_and_train149_exposure(self):
        fit.validate_parent(*parent_metadata())
        self.assertEqual(fit.single.PARENT_RUN, "mixed-train-terrain-ecology-v1-2b8a12c543a07576de72")
        self.assertEqual(fit.PARENT["checkpoint"]["sha256"],
            "20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef")

    def test_failed_partial_foreign_parent_or_missing_final_artifact_rejected(self):
        cases = (("package", "experimentIdentity", "foreign"), ("package", "arm", "rehearsal"),
            ("package", "modelCapability", "foreign"), ("package", "selectedSampleIds", []),
            ("terminal", "executionState", "failed_closed"), ("terminal", "result", {"path": "foreign", "sha256": "0" * 64}),
            ("result", "checkpointReloadExact", False), ("result", "status", "experiment_failed_closed"),
            ("result", "optimizerSteps", {"generator": 447, "discriminator": 448}),
            ("result", "artifacts", []), ("result", "sampleVisits", {fit.SAMPLE: 9}))
        for component, key, value in cases:
            package, terminal, result = parent_metadata()
            {"package": package, "terminal": terminal, "result": result}[component][key] = value
            with self.subTest(component=component, key=key), self.assertRaises(ValueError):
                fit.validate_parent(package, terminal, result)


class PolicyAndPackageTests(unittest.TestCase):
    def test_registered_policies_match_exact_B_C_exposure_and_original_boundaries(self):
        for arm, pairs, replay, seconds in (("mixed", 200, 100, 1800), ("short", 100, 0, 900),
                ("balanced", 200, 195, 1800)):
            policy = policy_metadata(arm)
            fit.validate_policy(policy)
            self.assertEqual(policy["training"]["pairs"], pairs)
            self.assertEqual(policy["training"]["targetPairs"], 5 if arm == "balanced" else 100)
            self.assertEqual(policy["training"]["replayPairs"], replay)
            self.assertEqual(policy["training"]["seed"], 20260929)
            self.assertEqual(policy["training"]["supportStructureWeight"], .1)
            self.assertEqual(policy["resources"]["maxWallSeconds"], seconds)
            self.assertEqual(policy["resources"]["cpuThreads"], 2)
            self.assertEqual(policy["resources"]["automaticRetries"], 0)
            self.assertEqual(policy["initialization"],
                "exact_completed_terrain_ecology_generator_and_critic_fresh_original_AdamW")
            self.assertEqual(policy["preparationMaxWallSeconds"], 300)
            fit.validate_package(package_metadata(arm), policy)

    def test_loss_model_gate_data_or_qualification_changes_are_rejected(self):
        fields = ("modelArchitectureChanged", "lossChanged", "gradientThresholdChanged",
            "sourceImagesOrConditionsChanged", "validationContentAllowed", "checkpointPromotable",
            "runtimePublicationAllowed", "automaticResumeAllowed", "parentExecutionPermissionInherited")
        for arm in ("mixed", "short", "balanced"):
            original = policy_metadata(arm)
            for key in fields:
                policy = copy.deepcopy(original)
                policy[key] = True
                with self.subTest(arm=arm, key=key), self.assertRaises(ValueError):
                    fit.validate_policy(policy)
            for key, value in (("modelCapability", "foreign"), ("sampleId", "validation"),
                    ("arm", "A"), ("parentExperiment", {}), ("initialization", "restore_parent_moments"),
                    ("zeroUpdateAdmission", "inherit_parent_gate"), ("preparationMaxWallSeconds", True),
                    ("preparationMaxWallSeconds", 300.0), ("preparationMaxWallSeconds", 301)):
                with self.subTest(arm=arm, key=key, value=value), self.assertRaises(ValueError):
                    fit.validate_policy({**original, key: value})

    def test_changed_sampling_loss_seed_optimizer_budget_and_retry_rejected(self):
        for arm in ("mixed", "short", "balanced"):
            original = policy_metadata(arm)
            for group, key, value in (("training", "pairs", 201), ("training", "targetPairs", 101),
                    ("training", "replayPairs", 99), ("training", "supportStructureWeight", 1.0),
                    ("training", "seed", 20260930), ("training", "checkpointSelection", "best_validation"),
                    ("training", "sampling", "shuffled"), ("resources", "maxWallSeconds", 1801),
                    ("resources", "cudaMemoryFraction", .71), ("resources", "maximumTemperatureC", 86),
                    ("resources", "minimumFreeVramMiB", 1024), ("resources", "minimumFreeDiskMiB", 1024),
                    ("resources", "maxOutputMiB", 129), ("resources", "cpuThreads", 3),
                    ("resources", "automaticRetries", 1)):
                policy = copy.deepcopy(original)
                policy[group][key] = value
                with self.subTest(arm=arm, group=group, key=key), self.assertRaises(ValueError):
                    fit.validate_policy(policy)

    def test_foreign_package_scope_or_changed_schedule_cannot_activate(self):
        for arm in ("mixed", "short", "balanced"):
            original = package_metadata(arm)
            for key, value in (("schemaVersion", "single-map-checkpoint-fit-package-v1"),
                    ("arm", "A"), ("training", {}), ("resources", {}), ("parentExperiment", {}),
                    ("modelCapability", "foreign"), ("checkpoint", {"path": "foreign", "sha256": "0" * 64}),
                    ("selectedSampleIds", []), ("schedule", original["schedule"][:-1]),
                    ("plannedSampleVisits", {}), ("qualificationGranted", True),
                    ("optimizerInitialization", "parent_moments"), ("outputRoot", "outside")):
                with self.subTest(arm=arm, key=key), self.assertRaises(ValueError):
                    fit.validate_package({**original, key: value}, policy_metadata(arm))

    def test_balanced_exact_registered_policy_not_only_shape_or_format(self):
        bound = fit.binding(fit.POLICIES["balanced"])
        self.assertEqual(bound, fit.BALANCED_POLICY_BINDING)
        fit.validate_policy_binding(bound, "balanced")
        original = package_metadata("balanced")
        for policy in ({**bound, "sha256": "0" * 64}, {**bound, "path": fit.POLICIES["mixed"]},
                {**bound, "extra": True}):
            with self.subTest(policy=policy), self.assertRaisesRegex(ValueError, "registered balanced policy|replay package route"):
                fit.validate_package({**original, "policy": policy}, policy_metadata("balanced"))

    def test_balanced_reordered_or_reallocated_schedule_fails_even_with_matching_visits(self):
        original = package_metadata("balanced")
        schedules = [list(reversed(original["schedule"])),
            fit.SAMPLES * 4 + fit.SAMPLES[-8:], fit.make_schedule(list(fit.SAMPLES), "mixed")]
        for schedule in schedules:
            changed = {**original, "schedule": schedule, "plannedSampleVisits": fit.expected_visits(schedule)}
            with self.subTest(first=schedule[0]), self.assertRaisesRegex(ValueError, "frozen schedule"):
                fit.validate_package(changed, policy_metadata("balanced"))

    def test_balanced_substituted_policy_blocks_prepare_before_any_model_import(self):
        policy = fit.POLICIES["balanced"]
        imported = Mock(side_effect=AssertionError("model import must not be reached"))
        with patch.object(fit, "binding", return_value={"path": policy, "sha256": "0" * 64}), \
                patch.object(fit, "read", return_value=policy_metadata("balanced")), \
                patch.object(fit, "imports", imported), self.assertRaisesRegex(ValueError, "registered balanced policy"):
            fit.prepare(policy)
        imported.assert_not_called()

    def test_balanced_cannot_inherit_single149_observation_reference(self):
        original = package_metadata("balanced")
        with self.assertRaisesRegex(ValueError, "single-map comparison reference"):
            fit.validate_package({**original, "a100Reference": {"available": True}}, policy_metadata("balanced"))


class CheckpointMetadataTests(unittest.TestCase):
    def test_B_two_hundred_and_C_one_hundred_require_own_metadata(self):
        bound = {"path": "synthetic-package.json", "sha256": "b" * 64}
        for arm, pairs in (("mixed", 200), ("short", 100), ("balanced", 200)):
            pkg = package_metadata(arm)
            state = checkpoint_metadata(pkg, bound)
            self.assertEqual(state["counts"], {"generator": pairs, "discriminator": pairs})
            fit.validate_saved_checkpoint(state, bound, pkg)

    def test_foreign_package_arm_source_parent_model_or_training_rejected(self):
        bound = {"path": "synthetic-package.json", "sha256": "b" * 64}
        for arm in ("mixed", "short", "balanced"):
            pkg = package_metadata(arm)
            state = checkpoint_metadata(pkg, bound)
            for key, value in (("schema", "single-map-checkpoint-fit-state-v1"),
                    ("packageSha256", "0" * 64), ("arm", "short" if arm == "mixed" else "mixed"),
                    ("modelCapability", "foreign"), ("sourcePlan", {"path": "foreign", "sha256": "0" * 64}),
                    ("parentExperiment", {}), ("training", {}), ("checkpointPromotable", True)):
                with self.subTest(arm=arm, key=key), self.assertRaises(ValueError):
                    fit.validate_saved_checkpoint({**state, key: value}, bound, pkg)

    def test_partial_updates_or_wrong_replay_visits_are_not_final_checkpoints(self):
        bound = {"path": "synthetic-package.json", "sha256": "b" * 64}
        for arm in ("mixed", "short", "balanced"):
            pkg = package_metadata(arm)
            state = checkpoint_metadata(pkg, bound)
            pairs = len(pkg["schedule"])
            for counts in ({"generator": pairs - 1, "discriminator": pairs},
                    {"generator": pairs, "discriminator": pairs - 1},
                    {"generator": pairs + 1, "discriminator": pairs + 1}):
                with self.subTest(arm=arm, counts=counts), self.assertRaises(ValueError):
                    fit.validate_saved_checkpoint({**state, "counts": counts}, bound, pkg)
            wrong = dict(state["sampleVisits"])
            wrong[fit.SAMPLE] -= 1
            with self.assertRaises(ValueError):
                fit.validate_saved_checkpoint({**state, "sampleVisits": wrong}, bound, pkg)


class AdmissionAndCommitTests(unittest.TestCase):
    def test_all_selected_forty_eight_B_and_one_C_have_their_own_gate(self):
        for arm in ("mixed", "short", "balanced"):
            ids = package_metadata(arm)["selectedSampleIds"]
            fit.verify_admission(admission_metadata(ids), ids)

    def test_gate_cannot_use_missing_duplicate_reordered_or_foreign_rows(self):
        ids = package_metadata("mixed")["selectedSampleIds"]
        for kind in ("missing", "duplicate", "reordered", "foreign"):
            proofs = admission_metadata(ids)
            if kind == "missing": proofs.pop()
            elif kind == "duplicate": proofs[-1] = copy.deepcopy(proofs[0])
            elif kind == "reordered": proofs.reverse()
            else: proofs[0]["sampleId"] = "foreign"
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                fit.verify_admission(proofs, ids)

    def test_any_failed_partial_or_updated_gate_blocks_training(self):
        ids = package_metadata("mixed")["selectedSampleIds"]
        for index in (0, 23, 47):
            for key, value in (("passed", False), ("optimizerCreated", True), ("optimizerUpdates", 1),
                    ("modelCapabilityVersion", "foreign"), ("cudaRngChecked", False),
                    ("callCounts", {"generatorForwards": 1, "generatorForwardCompleted": 1,
                        "generatorAutograd": 4, "discriminatorAutograd": 1})):
                proofs = admission_metadata(ids)
                proofs[index]["proof"][key] = value
                with self.subTest(index=index, key=key), self.assertRaises(ValueError):
                    fit.verify_admission(proofs, ids)

    def test_commit_checks_actual_count_and_ledger_without_fabricating_updates(self):
        sid = fit.SAMPLE
        counts = {"generator": 7, "discriminator": 7}
        ledger = {"sampleId": sid, "generator": 1, "discriminator": 1}
        before = (dict(counts), dict(ledger))
        fit.commit_pair(counts, ledger, 7, sid)
        self.assertEqual((counts, ledger), before)
        for bad_counts, bad_ledger in (({"generator": 6, "discriminator": 7}, ledger),
                ({"generator": 7, "discriminator": 6}, ledger),
                (counts, {**ledger, "sampleId": "foreign"}),
                (counts, {**ledger, "generator": 0}), (counts, {**ledger, "discriminator": 0})):
            snapshot = (dict(bad_counts), dict(bad_ledger))
            with self.assertRaises(ValueError):
                fit.commit_pair(bad_counts, bad_ledger, 7, sid)
            self.assertEqual((bad_counts, bad_ledger), snapshot)


class SyntheticWorkerFlowTests(unittest.TestCase):
    def test_real_B_C_control_flow_all_admission_then_fresh_original_AdamW_final_reload(self):
        for arm, pairs in (("mixed", 200), ("short", 100), ("balanced", 200)):
            harness = WorkerHarness(arm)
            harness.run()
            result = harness.result()
            self.assertEqual(harness.probe_ids, harness.pkg["selectedSampleIds"])
            self.assertEqual(harness.pairs, harness.pkg["schedule"])
            self.assertEqual(len(harness.optimizers), 2)
            self.assertTrue(all(not optimizer.state for optimizer in harness.optimizers))
            self.assertEqual(harness.strict_loads, [("generator", True), ("discriminator", True)])
            event_names = [event[0] for event in harness.events]
            self.assertGreater(event_names.index("optimizer"), max(i for i, name in enumerate(event_names) if name == "gate"))
            self.assertGreater(event_names.index("pair"), event_names.index("optimizer"))
            self.assertEqual(result["optimizerSteps"], {"generator": pairs, "discriminator": pairs})
            self.assertEqual(result["sampleVisits"], harness.pkg["plannedSampleVisits"])
            self.assertEqual(result["targetUpdates"], 5 if arm == "balanced" else 100)
            self.assertEqual(result["replayUpdates"], 195 if arm == "balanced" else 100 if arm == "mixed" else 0)
            self.assertTrue(result["checkpointReloadExact"])
            self.assertTrue(result["sameParentStartVerified"])
            self.assertEqual(result["parentStateHashes"], result["initialStateHashes"])
            self.assertFalse(result["formalQualificationGranted"])
            # Every selected sample gets original/fresh final RGB comparison.
            final_calls = [row for row in harness.rgb_calls if row[1] == pairs]
            observations_at_final = 1
            self.assertEqual(len(final_calls), 2 * len(harness.samples) + observations_at_final)
            continuity = json.loads(harness.files[harness.pkg["outputRoot"] + "/parent-output-continuity.json"])
            self.assertTrue(continuity["quantizedRgbPixelsExactlyEqual"])
            self.assertFalse(continuity["optimizerMomentsRestored"])

    def test_failed_last_gate_blocks_every_optimizer_and_update(self):
        for arm in ("mixed", "balanced"):
            harness = WorkerHarness(arm, bad_gate=47)
            with self.subTest(arm=arm), self.assertRaisesRegex(ValueError, "zero-update original gate"):
                harness.run()
            self.assertEqual(len(harness.probe_ids), 48)
            self.assertEqual(harness.optimizers, [])
            self.assertEqual(harness.pairs, [])
            self.assertEqual(harness.result()["optimizerSteps"], {"generator": 0, "discriminator": 0})
            self.assertFalse(harness.result()["trainingStarted"])
            self.assertEqual(len([name for name in harness.files if "/zero-update-gpu-probe-" in name]), 48)

    def test_late_undeclared_loaded_source_blocks_optimization(self):
        harness = WorkerHarness("mixed", late_source=True)
        with self.assertRaisesRegex(ValueError, "undeclared loaded source before optimization"):
            harness.run()
        self.assertEqual(len(harness.probe_ids), 48)
        self.assertEqual(harness.optimizers, [])
        self.assertEqual(harness.pairs, [])
        self.assertEqual(harness.result()["optimizerSteps"], {"generator": 0, "discriminator": 0})

    def test_parent_state_or_initial_target_pixels_mismatch_blocks_optimization(self):
        for options, message in (({"bad_parent": True}, "parent G/D start state differs"),
                ({"bad_continuity": True}, "initial GPU prediction differs")):
            harness = WorkerHarness("short", **options)
            with self.subTest(options=options), self.assertRaisesRegex(ValueError, message):
                harness.run()
            self.assertEqual(harness.optimizers, [])
            self.assertEqual(harness.pairs, [])
            self.assertEqual(harness.result()["optimizerSteps"], {"generator": 0, "discriminator": 0})

    def test_D_committed_then_G_failure_retains_original_error_and_partial_counts(self):
        harness = WorkerHarness("mixed", fail_pair=3)
        with self.assertRaises(RuntimeError) as caught:
            harness.run()
        self.assertIs(caught.exception, harness.primary)
        result = harness.result()
        self.assertEqual(result["status"], "experiment_failed_closed")
        self.assertEqual(result["phase"], "training")
        self.assertEqual(result["optimizerSteps"], {"generator": 2, "discriminator": 3})
        self.assertEqual(sum(result["sampleVisits"].values()), 2)
        self.assertEqual(result["targetUpdates"], 1)
        self.assertEqual(result["replayUpdates"], 1)
        self.assertTrue(result["trainingStarted"])
        self.assertTrue(result["sameParentStartVerified"])
        self.assertFalse(result["checkpointReloadExact"])
        self.assertIn("first error", result["error"])
        self.assertFalse(any(name.endswith("checkpoint-final.pt") for name in harness.files))

    def test_balanced_partial_pair_records_only_completed_schedule_prefix(self):
        harness = WorkerHarness("balanced", fail_pair=5)
        with self.assertRaises(RuntimeError) as caught:
            harness.run()
        self.assertIs(caught.exception, harness.primary)
        result = harness.result()
        self.assertEqual(result["optimizerSteps"], {"generator": 4, "discriminator": 5})
        self.assertEqual(result["sampleVisits"], dict.fromkeys(fit.SAMPLES, 0) |
            dict(Counter(fit.SAMPLES[:4])))
        self.assertEqual(result["targetUpdates"], 1)
        self.assertEqual(result["replayUpdates"], 3)
        self.assertEqual(result["zeroUpdateAdmission"]["completedSampleCount"], 48)
        self.assertFalse(result["checkpointReloadExact"])
        self.assertFalse(any(name.endswith("checkpoint-final.pt") for name in harness.files))

    def test_bad_saved_metadata_or_strict_state_rejects_after_actual_committed_counts(self):
        for options, message in (({"bad_saved": True}, "replay checkpoint counts"),
                ({"bad_reload": True}, "strict complete state reload differs")):
            harness = WorkerHarness("short", **options)
            with self.subTest(options=options), self.assertRaisesRegex(ValueError, message):
                harness.run()
            result = harness.result()
            self.assertEqual(result["optimizerSteps"], {"generator": 100, "discriminator": 100})
            self.assertEqual(result["sampleVisits"][fit.SAMPLE], 100)
            self.assertFalse(result["checkpointReloadExact"])
            self.assertFalse(result["formalQualificationGranted"])


class OriginalRuntimeBoundaryTests(unittest.TestCase):
    def test_three_known_late_numerical_sources_are_declared_before_import(self):
        expected = {
            "ml/ai-painter/scripts/painter_replay_retention_review_recovery_v1.py",
            "ml/ai-painter/scripts/painter_stage4_support_terrain_gradient_training_profile_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/object_support_terrain_gradient_device_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/terrain_ecology_joint_priority_device_v1.py"}
        before = set(sys.modules)
        sources = fit.project_sources()
        paths = [binding["path"] for binding in sources]
        self.assertTrue(expected <= set(paths))
        self.assertEqual(len(paths), len(set(paths)))
        self.assertLessEqual(len(paths), 256)
        self.assertNotIn("docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md", paths)
        tree = ast.parse(Path(fit.__file__).read_text(encoding="utf-8"))
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "imports")
        imports = {alias.name for node in ast.walk(function) if isinstance(node, (ast.Import, ast.ImportFrom)) for alias in node.names}
        self.assertTrue({"painter_stage4_support_terrain_gradient_training_profile_v1",
            "object_support_terrain_gradient_device_v1", "terrain_ecology_joint_priority_device_v1"} <= imports)
        self.assertEqual(set(sys.modules), before)

    def test_original_profile_factory_and_training_pair_are_delegated_without_new_loss(self):
        background = Mock()
        background.fresh_networks.return_value = ("synthetic-generator", "synthetic-critic")
        profile = fit.single.BoundProfile(background)
        self.assertEqual(profile.fresh_networks(["synthetic-order"]), ("synthetic-generator", "synthetic-critic"))
        background.fresh_networks.assert_called_once_with(["synthetic-order"], model_capability=fit.CAPABILITY)
        self.assertIs(profile.perform_pair, background.perform_pair)
        self.assertIs(profile.zero_update_probe, background.zero_update_probe)
        self.assertEqual(fit.CAPABILITY, "stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1")

    def test_original_109_parameter_identity_guard_executes_and_rejects_other_graphs(self):
        tree = ast.parse(Path(fit.__file__).read_text(encoding="utf-8"))
        source = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "source")
        guard = next(node for node in source.body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
            and any(isinstance(arg, ast.Constant) and arg.value == "exact109 terrain ecology model required" for arg in node.value.args))
        code = compile(ast.Module(body=[guard], type_ignores=[]), str(fit.__file__), "exec")
        for tensors, elements, passes in ((109, 2243023, True), (108, 2243023, False), (109, 2243022, False)):
            sizes = [1] * (tensors - 1) + [elements - tensors + 1]
            model = SimpleNamespace(parameters=lambda: iter([SimpleNamespace(numel=lambda n=n: n) for n in sizes]))
            if passes:
                exec(code, {"need": fit.need, "model": model})
            else:
                with self.assertRaisesRegex(ValueError, "exact109"):
                    exec(code, {"need": fit.need, "model": model})


class BalancedBoundaryTests(unittest.TestCase):
    def test_registered_policy_exact_training_and_loss_single_difference(self):
        policy = policy_metadata('balanced-boundary')
        fit.validate_policy(policy)
        self.assertEqual(fit.binding(fit.POLICIES['balanced-boundary']), fit.BOUNDARY_POLICY_BINDING)
        self.assertEqual(policy['training'], fit.training_for('balanced-boundary'))
        for mutate in (lambda p:p.__setitem__('lossChanged', False),
                       lambda p:p['training'].__setitem__('boundaryRgbWeight', .02),
                       lambda p:p['training']['boundaryRgbDefinition'].__setitem__('boundaryBandProjectedPixels', 5),
                       lambda p:p['training'].__setitem__('trainingObjective', 'balanced'),
                       lambda p:p.__setitem__('gradientThresholdChanged', True)):
            changed = copy.deepcopy(policy); mutate(changed)
            with self.assertRaises(ValueError): fit.validate_policy(changed)

    def test_input_binding_table_requires_all48_original_members_and_frozen_sources(self):
        pkg = package_metadata('balanced-boundary'); policy = policy_metadata('balanced-boundary')
        fit.validate_package(pkg, policy)
        for mutate in (lambda p:p['sampleIdentities'].pop(), lambda p:p['sampleIdentities'].reverse(),
                       lambda p:p['boundaryInputBindings'][0]['road'].__setitem__('sha256', '0'*64),
                       lambda p:p['inputs'].pop(), lambda p:p['policy'].__setitem__('sha256', '0'*64)):
            changed = copy.deepcopy(pkg); mutate(changed)
            with self.assertRaises(ValueError): fit.validate_package(changed, policy)

    def test_real_control_flow_scopes_all48_admission_and_exact200_committed_pairs(self):
        harness = WorkerHarness('balanced-boundary'); harness.run()
        result = harness.result()
        self.assertEqual(harness.scopes, fit.SAMPLES + fit.make_schedule(fit.SAMPLES, 'balanced-boundary'))
        self.assertEqual(result['trainingObjective'], fit.BOUNDARY_OBJECTIVE)
        self.assertEqual(result['targetUpdates'], 5); self.assertEqual(result['replayUpdates'], 195)
        self.assertEqual(result['sampleVisits']['mvp64-slot164-objects-v5-20261020'], 4)
        self.assertEqual(result['zeroUpdateAdmission']['completedSampleCount'], 48)
        self.assertTrue(result['checkpointReloadExact'])
        saved = harness.states[-1]
        fit.validate_saved_checkpoint(saved, harness.bound, harness.pkg)
        saved['training']['boundaryRgbWeight'] = .02
        with self.assertRaises(ValueError): fit.validate_saved_checkpoint(saved, harness.bound, harness.pkg)

    def test_failed_last_own_gate_still_blocks_all_optimizers_and_updates(self):
        harness = WorkerHarness('balanced-boundary', bad_gate=47)
        with self.assertRaises(ValueError): harness.run()
        self.assertEqual(len(harness.probe_ids), 48)
        self.assertEqual(harness.optimizers, []); self.assertEqual(harness.pairs, [])
        self.assertFalse(harness.result()['trainingStarted'])


if __name__ == "__main__":
    unittest.main()
