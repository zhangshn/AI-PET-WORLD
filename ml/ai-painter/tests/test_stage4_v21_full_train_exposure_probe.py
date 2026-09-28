"""CPU behavioral counterexamples for bounded fresh 48-train exposure."""
from __future__ import annotations

from contextlib import contextmanager, nullcontext
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import random
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v21_full_train_exposure_probe as probe
import numpy as np
import torch


class ExposureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        original_json = probe.cpu.BoundReader.json
        prohibited = {probe.fit.SOURCE_INPUTS[key]["path"] for key in
                      ("workerTerminal", "trainingTerminal", "endpointMetadata")}
        def json_without_historical_metrics(reader, binding):
            if binding["path"] in prohibited:
                raise AssertionError("historical nontrain metrics decoded")
            return original_json(reader, binding)
        with patch.object(torch, "load", side_effect=AssertionError("preflight checkpoint load")), \
             patch.object(probe.cpu, "load_sample", side_effect=AssertionError("preflight pixel decode")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("preflight CUDA query")), \
             patch.object(probe.cpu.BoundReader, "json", json_without_historical_metrics):
            cls.context = probe.collect_inputs()

    def policy(self):
        return {"schemaVersion": probe.POLICY_SCHEMA, "status": "active_single_bounded_train_only_exposure_experiment",
            "scope": probe.SCOPE, "inputs": deepcopy(self.context["inputs"]), "maxAttempts": 1, "automaticRetries": 0}

    def synthetic_records(self, correlation=.5, mae=.1):
        return [{"sampleId": row["sampleId"], "split": "train", "trainOrdinal": row["trainOrdinal"],
            "metrics": {"rgbMae": mae, "objects": {role: {"centeredLumaCorrelation": correlation} for role in probe.fit.ROLES}}}
            for row in self.context["inputs"]["selectedRows"]]

    def completed_fixture(self):
        package = probe.package_from_inputs(self.context["inputs"], {"path": probe.POLICY_PATH, "sha256": "a" * 64}, self.context["manifest"])
        observations = [{**row, **point, "measurements": row["metrics"]} for point in probe.OBSERVATION_PLAN for row in self.synthetic_records()]
        images = [{**plan, "path": f"fixture/image-{i}.png", "sha256": "b" * 64, "sourceLabel": plan["purpose"]}
                  for i, plan in enumerate(package["imagePlan"])]
        ledger = probe.exposure_ledger(package["selectedRows"])
        for row in ledger:
            row.update(generator=48, discriminator=48)
        facts = probe.reproduction_facts(observations[48:96], self.context["reference"]["samples"])
        payloads = {package["outputRoot"] + "/epoch-24-reproduction.json": json.dumps(facts).encode(),
            package["outputRoot"] + "/observation-epoch-24.json": json.dumps({"epoch": 24,
                "optimizerStep": 1152, "trainOnly": observations[48:96]}).encode()}
        result = {"schemaVersion": probe.RESULT_SCHEMA, "evidenceContractVersion": 1, "experimentType": probe.EXPERIMENT_TYPE,
            "experimentIdentity": package["experimentIdentity"], "completedEpochs": 48, "sourceBytesUnchanged": True,
            "checkpointReloadExact": True, "epoch24ReproductionPassed": facts["passed"],
            "epoch24ReproductionEvidenceValid": facts["evidenceValid"], "epoch24Reproduction": facts,
            "reproductionRule": probe.REPRODUCTION_RULE, "optimizerSteps": {"generator": 2304, "discriminator": 2304},
            "stage4QualificationGranted": False, "checkpointPromotable": False, "validationContentRead": False,
            "challengeContentRead": False, "regressionContentRead": False, "historicalCheckpointLoaded": False,
            "trainOnlyObservations": observations, "perSampleExposure": ledger, "imageArtifacts": images,
            "artifacts": [{k: x[k] for k in ("path", "sha256")} for x in images]
                + [{"path": path, "sha256": probe.cpu.sha(data)} for path, data in payloads.items()]}
        return result, package, payloads

    @contextmanager
    def fixture_bytes(self, payloads):
        # Keep production JSON parsing, SHA checks and unchanged-byte checks;
        # only substitute output files with in-memory bytes. Reference is real.
        original = probe.cpu.project_file
        class BytesFile:
            def __init__(self, data):
                self.data = data
            def read_bytes(self):
                return self.data
        def project_file(root, path):
            return BytesFile(payloads[path]) if path in payloads else original(root, path)
        with patch.object(probe.cpu, "project_file", project_file):
            yield

    def test_exact_dataset_current_train_and_all48_gpu_cases(self):
        inputs = self.context["inputs"]
        self.assertEqual(len(inputs["selectedRows"]), 48)
        self.assertEqual(inputs["trainSelectionSha256"], "be5407abd343e3041048ffa1974e97337f099e95bbab696f136f41b12e902bb7")
        self.assertEqual(inputs["training"]["maxGeneratorOptimizerSteps"], 2304)
        self.assertEqual(inputs["training"]["maxDiscriminatorOptimizerSteps"], 2304)
        self.assertEqual(inputs["training"]["initializationSeed"], 20260929)
        self.assertEqual(inputs["training"]["optimizer"], probe.v21.OPTIMIZER_PLAN)
        self.assertEqual([x["trainOrdinal"] for x in inputs["gpuProbeCases"]], list(range(48)))
        for row, case in zip(inputs["selectedRows"], inputs["gpuProbeCases"]):
            self.assertEqual(case["sampleId"], row["sampleId"])
            self.assertEqual(case["conditionPack"], row["conditionPack"])
            self.assertEqual(case["image"], row["image"])
            self.assertGreater(case["objectInstanceCount"], 0)
        self.assertEqual(inputs["selectedRows"][47]["historicalSourceSplit"], "validation")
        self.assertEqual(inputs["selectedRows"][47]["split"], "train")
        self.assertEqual(inputs["registryBeforeStart"]["activeExecution"], None)

    def test_no_nontrain_assets_or_split_files_read(self):
        reader = self.context["reader"]
        manifest = reader.json(probe.cpu.MANIFEST)
        source = reader.json(manifest["sourceIndex"])
        for row in source["samples"]:
            if row["split"] != "train":
                for key in ("image", "conditionPack", "sourceRecord", "contribution", "regionSource"):
                    self.assertNotIn(row[key]["path"], reader.observed)
        for split in ("validation", "challenge", "regression"):
            self.assertNotIn(manifest["splits"][split]["path"], reader.observed)

    def test_policy_draft_tampering_retries_and_self_consistent_budget_rejected(self):
        policy = self.policy()
        probe.validate_policy(policy, self.context["inputs"])
        for key, value in (("status", "draft_not_executable"), ("automaticRetries", 1), ("maxAttempts", 2)):
            bad = deepcopy(policy); bad[key] = value
            with self.assertRaisesRegex(ValueError, "independent exposure policy"):
                probe.validate_policy(bad, self.context["inputs"])
        bad = deepcopy(policy); bad["inputs"]["resources"]["maxWallSeconds"] = 1801
        with self.assertRaisesRegex(ValueError, "training boundary"):
            probe.validate_policy(bad, bad["inputs"])
        with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
            probe.prepare(probe.capacity.POLICY_PATH)

    def test_same_stable_envelope_and_deterministic_package_identity(self):
        package = probe.package_from_inputs(self.context["inputs"], {"path": probe.POLICY_PATH, "sha256": "a" * 64}, self.context["manifest"])
        self.assertEqual(package["schemaVersion"], "ai-painter-learning-capacity-experiment-package-v1")
        self.assertEqual(package["experimentType"], "all_train_exposure_only")
        self.assertEqual(package["evidenceContractVersion"], 1)
        self.assertIsNone(package["foundation"])
        self.assertFalse(package["foundationLimitations"]["autoencoderInGraph"])
        self.assertEqual(package["observationPlan"], [{"epoch": 0, "optimizerStep": 0}, {"epoch": 24, "optimizerStep": 1152}, {"epoch": 48, "optimizerStep": 2304}])
        self.assertEqual(len(package["imagePlan"]), 4)
        self.assertEqual(package, probe.package_from_inputs(self.context["inputs"], package["policy"], self.context["manifest"]))
        other = probe.package_from_inputs(self.context["inputs"], {**package["policy"], "sha256": "b" * 64}, self.context["manifest"])
        self.assertNotEqual(package["experimentIdentity"], other["experimentIdentity"])

    def test_all_epochs_visit_each_train_once_with_original_shuffle(self):
        for epoch in range(1, 49):
            expected = list(range(48)); random.Random(20260929 + epoch).shuffle(expected)
            self.assertEqual(probe.epoch_order(epoch), expected)
            self.assertEqual(sorted(probe.epoch_order(epoch)), list(range(48)))
        for epoch in (0, 49, True):
            with self.assertRaisesRegex(ValueError, "bounded exposure"):
                probe.epoch_order(epoch)

    def test_real_fresh_model_and_critic_match_acceptance_without_checkpoint(self):
        with patch.object(torch, "load", side_effect=AssertionError("fresh loaded checkpoint")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU initialization queried CUDA")):
            model, critic = probe.fresh_networks(self.context["order"], self.context["acceptance"])
        self.assertEqual(probe.cpu.state_hash(model), self.context["acceptance"]["initialModelStateSha256"])
        self.assertEqual(probe.cpu.state_hash(critic), self.context["acceptance"]["initialCriticStateSha256"])

    def test_observation_restores_rng_exact_mixed_modes_and_gradients(self):
        network = torch.nn.Sequential(torch.nn.Linear(2, 2), torch.nn.Dropout(.5))
        network.train(); network[0].eval()
        network[0].weight.grad = torch.ones_like(network[0].weight)
        modes = [x.training for x in network.modules()]
        cpu_rng = torch.get_rng_state().clone(); python_rng = random.getstate(); numpy_rng = np.random.get_state()
        before = probe.cpu.state_hash(network)
        with probe.observation_guard(network):
            self.assertFalse(any(x.training for x in network.modules()))
            torch.rand(10); random.random(); np.random.rand(10)
            network(torch.ones(1, 2))
        self.assertTrue(torch.equal(cpu_rng, torch.get_rng_state()))
        self.assertEqual(random.getstate(), python_rng)
        self.assertTrue(np.array_equal(np.random.get_state()[1], numpy_rng[1]))
        self.assertEqual([x.training for x in network.modules()], modes)
        self.assertEqual(probe.cpu.state_hash(network), before)
        self.assertTrue(torch.equal(network[0].weight.grad, torch.ones_like(network[0].weight)))

    def test_observation_restores_cuda_rng_without_hardware_query(self):
        initial = [torch.tensor([3, 7], dtype=torch.uint8)]
        with patch.object(torch.cuda, "is_initialized", return_value=True), \
             patch.object(torch.cuda, "get_rng_state_all", return_value=initial), \
             patch.object(torch.cuda, "set_rng_state_all") as restore:
            with probe.preserve_rng_and_modes():
                torch.rand(1)
            restore.assert_called_once_with(initial)

    def test_observation_failure_restores_modes_and_rng_and_blocks_updates(self):
        network = torch.nn.Linear(1, 1).train()
        rng = torch.get_rng_state().clone()
        with self.assertRaisesRegex(RuntimeError, "fixture failure"):
            with probe.observation_guard(network):
                torch.rand(5)
                raise RuntimeError("fixture failure")
        self.assertTrue(network.training)
        self.assertTrue(torch.equal(torch.get_rng_state(), rng))
        with probe.observation_guard(network):
            for operation in (lambda: torch.optim.AdamW(network.parameters()), lambda: torch.save({}, io.BytesIO()),
                              lambda: torch.load(io.BytesIO()), lambda: torch.ones(1, requires_grad=True).backward()):
                with self.assertRaises(RuntimeError):
                    operation()
        with self.assertRaisesRegex(ValueError, "mutated model state"):
            with probe.observation_guard(network):
                network.weight.add_(1)

    def test_epoch24_reproduction_boundaries_missing_and_foreign_rows(self):
        reference = self.synthetic_records()
        self.assertTrue(probe.reproduction_facts(self.synthetic_records(.51, .102), reference)["passed"])
        self.assertFalse(probe.reproduction_facts(self.synthetic_records(.531, .1), reference)["passed"])
        self.assertFalse(probe.reproduction_facts(self.synthetic_records(.5, .106), reference)["passed"])
        missing = self.synthetic_records(); missing[0]["metrics"]["objects"]["object_tree"]["centeredLumaCorrelation"] = None
        self.assertFalse(probe.reproduction_facts(missing, reference)["passed"])
        foreign = self.synthetic_records(); foreign[0]["sampleId"] = "foreign"
        with self.assertRaisesRegex(ValueError, "row identity"):
            probe.reproduction_facts(foreign, reference)
        invalid = self.synthetic_records(); invalid[0]["metrics"]["objects"]["object_tree"]["centeredLumaCorrelation"] = float("nan")
        with self.assertRaisesRegex(ValueError, "correlation"):
            probe.reproduction_facts(invalid, reference)

    def test_exposure_ledger_not_replaceable_by_total_count(self):
        ledger = probe.exposure_ledger(self.context["inputs"]["selectedRows"])
        for row in ledger:
            row.update(generator=24, discriminator=24)
        probe.validate_exposures(ledger, {"generator": 1152, "discriminator": 1152}, 24)
        ledger[0]["generator"] -= 1; ledger[1]["generator"] += 1
        with self.assertRaisesRegex(ValueError, "per-row exposure"):
            probe.validate_exposures(ledger, {"generator": 1152, "discriminator": 1152}, 24)

    def test_progress_starts_on_actual_update_negative_loss_is_null(self):
        self.assertIsNone(probe.make_training_progress(1, 0, {"generator": 0, "discriminator": 0}, None, 1))
        first = probe.make_training_progress(1, 1, {"generator": 0, "discriminator": 1}, None, 1)
        self.assertEqual(first["optimizationStep"], 0)
        self.assertIsNone(first["loss"])
        negative = probe.make_training_progress(2, 3, {"generator": 50, "discriminator": 51}, -.1, 10)
        self.assertIsNone(negative["loss"])
        self.assertEqual(negative["optimizationStep"], 50)
        self.assertEqual(negative["throughputSamplesPerSecond"], 5)
        self.assertIsNone(negative["checkpointIdentity"])
        self.assertIsNone(probe.make_training_progress(1, 1, {"generator": 1, "discriminator": 1}, float("nan"), float("inf"))["loss"])
        with self.assertRaisesRegex(ValueError, "progress bounds"):
            probe.make_training_progress(49, 1, {"generator": 2305, "discriminator": 2304}, .1, 1)

    def test_adverse_changes_are_reported_with_actual_direction(self):
        before, after = self.synthetic_records(.5, .1), self.synthetic_records(.45, .12)
        for record in before:
            record["metrics"]["instanceSupportErrors"] = [{"role": "object_tree", "supportRgbMae": .1}]
        for record in after:
            record["metrics"]["instanceSupportErrors"] = [{"role": "object_tree", "supportRgbMae": .15}]
        change = probe.observation_changes(before, after)
        self.assertAlmostEqual(change["meanRgbMaeChange"], .02)
        self.assertAlmostEqual(change["medianCorrelationChangeByRole"]["object_tree"], -.05)
        self.assertAlmostEqual(change["instanceSupportRgbMaeChangeByRoleEqualInstanceWeight"]["object_tree"]["afterMinusBefore"], .05)
        self.assertIsNone(change["instanceSupportRgbMaeChangeByRoleEqualInstanceWeight"]["object_rock"]["afterMinusBefore"])

    def test_post_step_failure_preserves_actual_critic_step_and_row_exposure(self):
        from ai_painter.complete_world import native_rgb_structured_object_objective_cpu_v17 as objective
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        g_opt, d_opt = torch.optim.AdamW(model.parameters()), torch.optim.AdamW(critic.parameters())
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": "train-fixture", "generator": 0, "discriminator": 0}
        sample = {"sampleId": "train-fixture", "split": "train", "image": torch.ones(1),
                  "conditions": torch.ones(1), "objectInstanceTable": []}
        before = probe.cpu.state_hash(critic)
        resource_calls = 0
        def resource():
            nonlocal resource_calls
            resource_calls += 1
            if resource_calls == 2:
                raise RuntimeError("post-step resource failure")
        with patch.object(probe.gpu, "detached_discriminator_objective", side_effect=lambda c, *args: (c(torch.ones(1, 1)).sum(), {})), \
             patch.object(objective, "train_structured_object_objective", side_effect=lambda c, predicted, *args: (predicted.sum(), {})):
            with self.assertRaisesRegex(RuntimeError, "post-step resource failure"):
                probe.perform_pair(model, critic, sample, [], g_opt, d_opt, counts, ledger, resource,
                    lambda kind, bound: model(torch.ones(1, 1)))
        self.assertEqual(counts, {"generator": 0, "discriminator": 1})
        self.assertEqual(ledger["discriminator"], 1)
        self.assertEqual(ledger["generator"], 0)
        self.assertNotEqual(before, probe.cpu.state_hash(critic))

    def test_cpu_equivalent_zero_update_gate_restores_fresh_states_rng_modes(self):
        model, critic = probe.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = probe.cpu.load_sample(self.context["reader"], self.context["rows"][0], self.context["order"], self.context["continuous"])
        rng = torch.get_rng_state().clone()
        initial = [probe.cpu.state_hash(x) for x in (model, critic)]
        facts = probe.gpu.gradient_facts
        calls = []
        def forward(kind, bound):
            calls.append(kind)
            return model(bound["conditions"][None], bound["objectInstanceTable"])
        with patch.object(torch, "autocast", side_effect=lambda *a, **kw: nullcontext()), \
             patch.object(probe.gpu, "gradient_facts", side_effect=lambda network, device: facts(network, "cpu")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU gate queried CUDA")):
            report = probe.zero_update_probe(model, critic, sample, self.context["order"], lambda: None, forward)
        self.assertTrue(report["passed"])
        self.assertEqual(calls, ["probe", "probe"])
        self.assertEqual(initial, [probe.cpu.state_hash(x) for x in (model, critic)])
        self.assertTrue(torch.equal(torch.get_rng_state(), rng))
        self.assertTrue(model.training and critic.training)
        self.assertTrue(all(p.grad is None and p.requires_grad for x in (model, critic) for p in x.parameters()))

    def test_final_cpu_reload_weights_only_no_fallback_and_identity(self):
        model, critic = probe.fresh_networks(self.context["order"])
        expected = {"Model": probe.cpu.state_hash(model), "Critic": probe.cpu.state_hash(critic)}
        binding = {"path": "fixture/package.json", "sha256": "a" * 64}
        saved = {"experimentIdentity": "fixture", "executionPackage": binding, "epoch": 48,
            "optimizerSteps": {"generator": 2304, "discriminator": 2304}, "finalStateSha256": expected,
            "checkpointPromotable": False, "automaticResumeAllowed": False,
            "modelState": model.state_dict(), "criticState": critic.state_dict()}
        stream = io.BytesIO(); torch.save(saved, stream)
        self.assertTrue(probe.reload_final_cpu(stream.getvalue(), expected, self.context["order"], binding, "fixture"))
        with patch.object(torch, "load", side_effect=RuntimeError("safe reload unavailable")) as load:
            with self.assertRaisesRegex(RuntimeError, "safe reload unavailable"):
                probe.reload_final_cpu(b"bad", expected, self.context["order"], binding, "fixture")
        self.assertEqual(load.call_count, 1)
        self.assertTrue(load.call_args.kwargs["weights_only"])
        self.assertEqual(load.call_args.kwargs["map_location"], "cpu")
        saved["epoch"] = 24; stream = io.BytesIO(); torch.save(saved, stream)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata"):
            probe.reload_final_cpu(stream.getvalue(), expected, self.context["order"], binding, "fixture")

    def test_decoded_identity_records_real_cpu_tensors_without_mutating_inputs(self):
        sample, identity = probe.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                                 self.context["order"], self.context["continuous"])
        before = deepcopy(identity)
        with patch.object(torch.cuda, "is_available", side_effect=AssertionError("identity queried CUDA")):
            bound = probe.decoded_sample_identity(sample, identity, 0)
        self.assertEqual(identity, before)
        self.assertEqual(bound["trainOrdinal"], 0)
        self.assertEqual(bound["tensorHashes"], {name: probe.cpu.tensor_hash(sample[name])
                                               for name in ("image", "conditions")})
        changed = {**sample, "image": sample["image"].clone()}
        changed["image"][0, 0, 0] += .01
        altered = probe.decoded_sample_identity(changed, identity, 0)
        self.assertNotEqual(altered["tensorHashes"]["image"], bound["tensorHashes"]["image"])
        self.assertEqual(altered["tensorHashes"]["conditions"], bound["tensorHashes"]["conditions"])

    def test_failure_preserves_only_committed_observations_without_endpoint_invention(self):
        observations = []
        root = "fixture/output"
        for point in probe.OBSERVATION_PLAN:
            rows = [{**row, **point} for row in self.synthetic_records()]
            observations.append({**point, "trainOnly": rows, "summary": {"fixture": point["epoch"]}})
        artifacts = [{"path": f"{root}/observation-epoch-{epoch:02d}.json", "sha256": "a" * 64}
                     for epoch in (0, 24)]
        before = deepcopy(observations)
        payload = probe.observation_evidence(observations, [], root, artifacts)
        self.assertEqual(len(payload["trainOnlyObservations"]), 96)
        self.assertEqual(len(payload["rows"]), 96)
        self.assertEqual([x["epoch"] for x in payload["observationSummaries"]], [0, 24])
        self.assertEqual({x["optimizerStep"] for x in payload["rows"]}, {0, 1152})
        self.assertEqual(payload["imageArtifacts"], [])
        self.assertEqual(observations, before)
        self.assertNotIn("checkpoint", payload)
        self.assertNotIn("stage4QualificationGranted", payload)
        self.assertEqual(probe.observation_evidence(observations, [], root, [])['rows'], [])

    def test_failure_does_not_project_uncommitted_or_wrong_hash_images(self):
        root = "fixture/output"
        images = [{"path": f"{root}/image-{i}.png", "sha256": "a" * 64} for i in range(3)]
        artifacts = [images[0], {**images[1], "sha256": "b" * 64}]
        payload = probe.observation_evidence([], images, root, artifacts)
        self.assertEqual(payload["imageArtifacts"], [images[0]])
        self.assertEqual(payload["trainOnlyObservations"], [])

    def test_flat_observation_image_completion_contract_rejects_counterfeits(self):
        result, package, payloads = self.completed_fixture()
        with self.fixture_bytes(payloads):
            probe.validate_result_contract(result, package)
            bad = deepcopy(result); bad["trainOnlyObservations"][48]["optimizerStep"] = 1153
            with self.assertRaisesRegex(ValueError, "144 observation identity"):
                probe.validate_result_contract(bad, package)
            bad = deepcopy(result); bad["imageArtifacts"][1]["purpose"] = "prediction"
            with self.assertRaisesRegex(ValueError, "image identity"):
                probe.validate_result_contract(bad, package)
            bad = deepcopy(result); bad["checkpointPromotable"] = True
            with self.assertRaisesRegex(ValueError, "boundary differs"):
                probe.validate_result_contract(bad, package)

    def test_v1_policy_and_path_explicitly_rejected(self):
        bad = self.policy(); bad["schemaVersion"] = "stage4-mvp-v21-full-train-exposure-policy-v1"
        with self.assertRaisesRegex(ValueError, "independent exposure policy"):
            probe.validate_policy(bad, self.context["inputs"])
        with patch.object(probe, "collect_inputs", side_effect=AssertionError("v1 must reject before collection")):
            with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
                probe.prepare(probe.POLICY_PATH.replace("-v3.json", "-v1.json"))

    def test_outside_tolerance_is_valid_false_and_can_complete_research(self):
        facts = probe.reproduction_facts(self.synthetic_records(.531, .106), self.synthetic_records())
        self.assertIs(facts["passed"], False)
        self.assertIs(facts["evidenceValid"], True)
        self.assertGreater(facts["medianCorrelationAbsoluteDifferences"]["object_rock"], .03)
        self.assertGreater(facts["meanRgbMaeRelativeDifference"], .05)
        result, package, payloads = self.completed_fixture()
        self.assertIs(result["epoch24ReproductionPassed"], False)
        self.assertTrue(any(value > .03 for value in result["epoch24Reproduction"]["medianCorrelationAbsoluteDifferences"].values()))
        with self.fixture_bytes(payloads):
            probe.validate_result_contract(result, package)

    def test_missing_truthy_or_fabricated_diagnostic_cannot_complete(self):
        result, package, payloads = self.completed_fixture()
        mutations = [("epoch24ReproductionEvidenceValid", 1), ("epoch24ReproductionPassed", 1),
            ("epoch24ReproductionPassed", True), ("epoch24Reproduction", None)]
        with self.fixture_bytes(payloads):
            for key, value in mutations:
                bad = deepcopy(result); bad[key] = value
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    probe.validate_result_contract(bad, package)
            for key in ("epoch24ReproductionEvidenceValid", "epoch24ReproductionPassed", "epoch24Reproduction"):
                bad = deepcopy(result); del bad[key]
                with self.subTest(missing=key), self.assertRaises(ValueError):
                    probe.validate_result_contract(bad, package)
            for key, value in (("evidenceValid", 1), ("passed", 0), ("actual", {}), ("reference", {}), ("rule", {})):
                bad = deepcopy(result); bad["epoch24Reproduction"][key] = value
                with self.subTest(fact=key), self.assertRaises(ValueError):
                    probe.validate_result_contract(bad, package)
            bad = deepcopy(result); bad["artifacts"] = bad["artifacts"][:-2]
            with self.assertRaisesRegex(ValueError, "diagnostic evidence missing"):
                probe.validate_result_contract(bad, package)
            bad = deepcopy(result); bad["artifacts"][-2]["sha256"] = "a" * 64
            with self.assertRaisesRegex(ValueError, "SHA mismatch"):
                probe.validate_result_contract(bad, package)

    def test_unavailable_or_nonfinite_diagnostic_evidence_still_fails_closed(self):
        result, package, payloads = self.completed_fixture()
        rows = result["trainOnlyObservations"][48:96]
        rows[0]["metrics"]["objects"]["object_tree"]["centeredLumaCorrelation"] = None
        facts = probe.reproduction_facts(rows, self.context["reference"]["samples"])
        self.assertIs(facts["evidenceValid"], False)
        self.assertIs(facts["passed"], False)
        # Even forged valid flags and matching saved bytes cannot replace metrics.
        facts["evidenceValid"] = True
        result["epoch24Reproduction"] = facts
        for suffix, value in (("epoch-24-reproduction.json", facts), ("observation-epoch-24.json",
                {"epoch": 24, "optimizerStep": 1152, "trainOnly": rows})):
            path = package["outputRoot"] + "/" + suffix
            payloads[path] = json.dumps(value).encode()
            next(x for x in result["artifacts"] if x["path"] == path)["sha256"] = probe.cpu.sha(payloads[path])
        with self.fixture_bytes(payloads), self.assertRaisesRegex(ValueError, "diagnostic evidence invalid"):
            probe.validate_result_contract(result, package)
        rows[0]["metrics"]["objects"]["object_tree"]["centeredLumaCorrelation"] = float("nan")
        with self.assertRaisesRegex(ValueError, "correlation"):
            probe.reproduction_facts(rows, self.context["reference"]["samples"])

    def test_v2_keeps_all_resource_data_and_training_bounds(self):
        self.assertEqual(probe.RESOURCES, {"maxWallSeconds": 1800, "maxGpuMemoryFraction": .7,
            "maximumTemperatureC": 85, "minimumFreeVramMiB": 2048, "minimumFreeDiskMiB": 2048,
            "maxOutputMiB": 128, "cpuThreads": 2, "automaticRetries": 0})
        self.assertEqual(probe.REPRODUCTION_RULE, {"epoch": 24,
            "maximumAbsoluteMedianCorrelationDifferenceEachRole": .03, "maximumRelativeMeanRgbMaeDifference": .05,
            "all48CorrelationsRequiredEachRole": True, "failureAction": "diagnostic_only_no_early_stop",
            "invalidEvidenceAction": "fail_closed", "formalAuditThreshold": False})
        self.assertEqual(probe.TRAINING["epochs"], 48)
        self.assertEqual(probe.TRAINING["maxTrainingAttempts"], 1)
        self.assertIs(probe.TRAINING["freshInitializationOnly"], True)
        self.assertIs(probe.TRAINING["historicalCheckpointLoaded"], False)
        self.assertEqual(self.context["inputs"]["modelPlan"], probe.v21.MODEL_PLAN)
        self.assertEqual([x["split"] for x in self.context["inputs"]["selectedRows"]], ["train"] * 48)

    @staticmethod
    def windows_error(code=5):
        error = PermissionError("fixture Windows replacement conflict")
        error.winerror = code
        return error

    def test_progress_transient_windows_errors_publish_same_staged_bytes_atomically(self):
        original_replace = probe.os.replace
        payload = {"phase": "training", "optimizerSteps": {"generator": 1, "discriminator": 1}, "label": "进度"}
        for code in (5, 32, 33):
            with self.subTest(winerror=code), TemporaryDirectory() as directory:
                path = Path(directory) / "progress.json"
                previous = b'{"previous":true}\n'; path.write_bytes(previous)
                staged_paths, staged_bytes = [], []
                def replace(source, target):
                    staged_paths.append(source); staged_bytes.append(source.read_bytes())
                    self.assertEqual(target, path)
                    self.assertEqual(path.read_bytes(), previous)
                    if len(staged_paths) < 3:
                        raise self.windows_error(code)
                    original_replace(source, target)
                with patch.object(probe.os, "name", "nt"), patch.object(probe.os, "replace", side_effect=replace), \
                     patch.object(probe.time, "sleep") as delay, \
                     patch.object(probe.os, "fsync", wraps=probe.os.fsync) as sync, \
                     patch.object(probe.json, "dumps", wraps=probe.json.dumps) as serialize:
                    probe.atomic_progress_json(path, payload)
                self.assertEqual(len(staged_paths), 3)
                self.assertEqual(len(set(staged_paths)), 1)
                self.assertEqual(staged_bytes, [staged_bytes[0]] * 3)
                self.assertEqual(json.loads(path.read_bytes()), payload)
                self.assertEqual(path.read_bytes(), staged_bytes[0])
                self.assertEqual([call.args for call in delay.call_args_list], [(.05,), (.05,)])
                sync.assert_called_once(); serialize.assert_called_once()
                self.assertEqual(list(Path(directory).glob("progress.json.staged-*")), [])

    def test_progress_persistent_windows_failure_is_bounded_and_retains_old_and_staged_bytes(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "progress.json"
            previous = b'{"previous":true}\n'; path.write_bytes(previous)
            prior_staged = path.with_name("progress.json.staged-prior")
            prior_staged.write_bytes(b"earlier failure evidence")
            payload = {"optimizerSteps": {"generator": 1761, "discriminator": 1761}}
            error = self.windows_error()
            with patch.object(probe.os, "name", "nt"), patch.object(probe.os, "replace", side_effect=error) as replace, \
                 patch.object(probe.time, "sleep") as delay:
                with self.assertRaises(PermissionError) as raised:
                    probe.atomic_progress_json(path, payload)
            self.assertIs(raised.exception, error)
            self.assertEqual(replace.call_count, 6)
            self.assertEqual([call.args for call in delay.call_args_list], [(.05,)] * 5)
            staged = [call.args[0] for call in replace.call_args_list]
            self.assertEqual(len(set(staged)), 1)
            self.assertEqual(json.loads(staged[0].read_bytes()), payload)
            self.assertEqual(path.read_bytes(), previous)
            self.assertEqual(set(Path(directory).glob("progress.json.staged-*")), {prior_staged, staged[0]})
            self.assertEqual(prior_staged.read_bytes(), b"earlier failure evidence")

    def test_progress_other_errors_and_non_windows_fail_immediately(self):
        other = RuntimeError("not an OS error"); other.winerror = 5
        cases = [("posix", self.windows_error(5)), ("nt", self.windows_error(2)),
                 ("nt", OSError(13, "no confirmed winerror")), ("nt", self.windows_error("5")), ("nt", other)]
        for platform, error in cases:
            with self.subTest(platform=platform, error=repr(error)), TemporaryDirectory() as directory:
                path = Path(directory) / "progress.json"
                path.write_bytes(b"old")
                with patch.object(probe.os, "name", platform), patch.object(probe.os, "replace", side_effect=error) as replace, \
                     patch.object(probe.time, "sleep") as delay:
                    with self.assertRaises(type(error)) as raised:
                        probe.atomic_progress_json(path, {"new": True})
                self.assertIs(raised.exception, error)
                replace.assert_called_once(); delay.assert_not_called()
                self.assertEqual(path.read_bytes(), b"old")
                self.assertEqual(json.loads(replace.call_args.args[0].read_bytes()), {"new": True})

    @unittest.skipUnless(os.name == "nt", "requires actual Windows file sharing")
    def test_progress_real_windows_reader_without_delete_sharing_releases_then_succeeds(self):
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        create = kernel.CreateFileW
        create.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
                           wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        create.restype = wintypes.HANDLE
        close = kernel.CloseHandle
        close.argtypes = [wintypes.HANDLE]; close.restype = wintypes.BOOL
        original_replace = probe.os.replace
        with TemporaryDirectory() as directory:
            path = Path(directory) / "progress.json"
            previous = b'{"old":true}\n'; path.write_bytes(previous)
            # FILE_SHARE_READ|FILE_SHARE_WRITE, deliberately no FILE_SHARE_DELETE.
            handle = create(str(path), 0x80000000, 1 | 2, None, 3, 0x80, None)
            self.assertNotEqual(handle, ctypes.c_void_p(-1).value, ctypes.get_last_error())
            failures, staged = [], []
            def replace(source, target):
                staged.append(source)
                try:
                    original_replace(source, target)
                except OSError as error:
                    failures.append(error.winerror)
                    raise
            def release(delay):
                nonlocal handle
                self.assertEqual(delay, .05)
                self.assertEqual(path.read_bytes(), previous)
                self.assertEqual(json.loads(staged[0].read_bytes()), {"new": True})
                self.assertTrue(close(handle), ctypes.get_last_error())
                handle = None
            try:
                with patch.object(probe.os, "replace", side_effect=replace), patch.object(probe.time, "sleep", side_effect=release) as delay:
                    probe.atomic_progress_json(path, {"new": True})
                self.assertEqual(len(failures), 1)
                self.assertIn(failures[0], (5, 32, 33))
                self.assertEqual(len(staged), 2)
                self.assertEqual(staged[0], staged[1])
                delay.assert_called_once_with(.05)
                self.assertEqual(json.loads(path.read_bytes()), {"new": True})
            finally:
                if handle is not None:
                    close(handle)

    def test_progress_publication_never_repeats_optimizer_steps(self):
        from ai_painter.complete_world import native_rgb_structured_object_objective_cpu_v17 as objective
        original_replace = probe.os.replace
        for persistent in (False, True):
            with self.subTest(persistent=persistent), TemporaryDirectory() as directory:
                path = Path(directory) / "progress.json"; path.write_bytes(b"old")
                model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
                g_opt, d_opt = torch.optim.AdamW(model.parameters()), torch.optim.AdamW(critic.parameters())
                counts = {"generator": 0, "discriminator": 0}
                ledger = {"sampleId": "train-fixture", "generator": 0, "discriminator": 0}
                sample = {"sampleId": "train-fixture", "split": "train", "image": torch.ones(1),
                          "conditions": torch.ones(1), "objectInstanceTable": []}
                attempts = []
                def replace(source, target):
                    attempts.append(source)
                    if persistent or len(attempts) == 1:
                        raise self.windows_error()
                    original_replace(source, target)
                def progress(name, loss):
                    probe.atomic_progress_json(path, {"optimizerSteps": counts.copy(), "perSampleExposure": ledger.copy()})
                with patch.object(probe.os, "replace", side_effect=replace), patch.object(probe.time, "sleep"), \
                     patch.object(d_opt, "step", wraps=d_opt.step) as d_step, patch.object(g_opt, "step", wraps=g_opt.step) as g_step, \
                     patch.object(probe.gpu, "detached_discriminator_objective", side_effect=lambda c, *args: (c(torch.ones(1, 1)).sum(), {})), \
                     patch.object(objective, "train_structured_object_objective", side_effect=lambda c, predicted, *args: (predicted.sum(), {})):
                    if persistent:
                        with self.assertRaises(PermissionError):
                            probe.perform_pair(model, critic, sample, [], g_opt, d_opt, counts, ledger, lambda: None,
                                lambda kind, bound: model(torch.ones(1, 1)), progress)
                    else:
                        probe.perform_pair(model, critic, sample, [], g_opt, d_opt, counts, ledger, lambda: None,
                            lambda kind, bound: model(torch.ones(1, 1)), progress)
                    self.assertEqual(d_step.call_count, 1)
                    self.assertEqual(g_step.call_count, 0 if persistent else 1)
                self.assertEqual(counts, {"generator": 0 if persistent else 1, "discriminator": 1})
                self.assertEqual({key: ledger[key] for key in counts}, counts)
                self.assertEqual(len(attempts), 6 if persistent else 3)
                stored = attempts[-1].read_bytes() if persistent else path.read_bytes()
                self.assertEqual(json.loads(stored)["optimizerSteps"], counts)

    def test_v2_policy_path_and_progress_rule_tampering_rejected(self):
        self.assertEqual(probe.PROGRESS_PUBLICATION_RULE, {"schemaVersion": "bounded_windows_progress_publication_v1",
            "maxReplaceAttempts": 6, "retryDelaySeconds": .05, "retryableWindowsErrors": [5, 32, 33],
            "sameStagedBytesOnly": True, "persistentFailureAction": "fail_closed"})
        self.assertEqual(self.context["inputs"]["progressPublicationRule"], probe.PROGRESS_PUBLICATION_RULE)
        probe.validate_policy(self.policy(), self.context["inputs"])
        bad = self.policy(); bad["schemaVersion"] = "stage4-mvp-v21-full-train-exposure-policy-v2"
        with self.assertRaisesRegex(ValueError, "independent exposure policy"):
            probe.validate_policy(bad, self.context["inputs"])
        with patch.object(probe, "collect_inputs", side_effect=AssertionError("consumed policy must reject before collection")):
            with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
                probe.prepare(probe.POLICY_PATH.replace("-v3.json", "-v2.json"))
        for key, value in (("schemaVersion", "other"), ("maxReplaceAttempts", 7), ("maxReplaceAttempts", 6.0),
                ("retryDelaySeconds", .1), ("retryableWindowsErrors", [5, 32, 33, 2]),
                ("sameStagedBytesOnly", False), ("sameStagedBytesOnly", 1), ("persistentFailureAction", "continue")):
            bad = self.policy(); bad["inputs"]["progressPublicationRule"][key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, "training boundary"):
                probe.validate_policy(bad, bad["inputs"])
        bad = self.policy(); del bad["inputs"]["progressPublicationRule"]
        with self.assertRaisesRegex(ValueError, "training boundary"):
            probe.validate_policy(bad, bad["inputs"])


if __name__ == "__main__":
    unittest.main()
