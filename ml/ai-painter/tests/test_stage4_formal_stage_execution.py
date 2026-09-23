"""CPU boundary tests with synthetic 256x192 tensors and a tiny test model.

The V2 contract check and Trainer/evaluator are test doubles. No real dataset,
foundation or GPU is used; these tests do not qualify a production candidate.
"""
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import json
import re
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
for directory in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    sys.path.insert(0, str(directory))

import torch
import stage4_formal_stage_execution as execution
from ai_painter.complete_world.split_release import SplitReleaseDataset, canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash
from ai_painter.complete_world.split_formal_training import load_formal_parent_checkpoint


class Dataset(SplitReleaseDataset):
    def __init__(self, split):
        self.root, self.split, self.image_size = ROOT, split, (256, 192)
        self.binding = {"path": "synthetic/manifest.json", "sha256": "a" * 64}
        self.manifest = {"datasetReleaseIdentity": "synthetic-full-split-not-qualified",
                         "qualification": {"trainingAllowed": True}}
        self._rows = [{"sampleId": f"{split}-{i}", "split": split}
                      for i in range(48 if split == "train" else 8)]
        self.selection_sha256 = digest(canonical_bytes(self._rows))
        self.bad = None

    def __getitem__(self, index):
        item = {**self._rows[index], "datasetReleaseIdentity": self.manifest["datasetReleaseIdentity"],
                "image": torch.zeros(3, 192, 256), "conditions": torch.zeros(23, 192, 256)}
        if index == 0 and self.bad:
            self.bad(item)
        return item


class Model(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.denoiser = torch.nn.Linear(1, 1)
        self.autoencoder = torch.nn.Linear(1, 1).requires_grad_(False).eval()


def train_double(model, loader, optimizer, *args, **kwargs):
    assert kwargs["enable_path_replay"] is False
    assert kwargs["enable_epoch_worst_replay"] is False
    for batch in loader:
        optimizer.zero_grad()
        model.denoiser(torch.ones(1, 1)).square().sum().backward()
        optimizer.step()
    return {"syntheticLoss": 1.0}


def evaluate_double(model, loader, *args):
    assert not torch.is_grad_enabled()
    assert not model.denoiser.training
    for _ in loader:
        pass
    return {"compositeConditionQualityScore": 2.0}


def rollout_double(model, dataset, diffusion, normalization, device, seed, config):
    assert not torch.is_grad_enabled()
    assert not model.denoiser.training
    for index in range(len(dataset)):
        dataset[index]
    return {"rolloutRgbQualityScore": 3.0, "rolloutSampleCount": 8,
            "rolloutSeedCountPerSample": 2, "rolloutTrajectoryCount": 16}


class FormalStageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.threads = torch.get_num_threads()
        torch.set_num_threads(1)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.threads)

    def setUp(self):
        self.model = Model()
        self.optimizer = torch.optim.AdamW(self.model.denoiser.parameters(), lr=0.001)
        self.train, self.validation = Dataset("train"), Dataset("validation")
        self.args = dict(model=self.model, optimizer=self.optimizer, train_dataset=self.train,
            validation_dataset=self.validation, stage={"stage": 0, "width": 256, "height": 192, "epochCount": 40},
            diffusion={}, latent_normalization={}, device=torch.device("cpu"),
            config={"training": {"batchSize": 1, "fixedValidationTimesteps": [0],
                    "checkpointRolloutSeedsPerSample": 2, "checkpointRolloutWeight": 1}},
            epoch_index=0, seed=20263722)

    def run_epoch(self, trainer=train_double, evaluator=evaluate_double, rollout=rollout_double, **changes):
        with patch.object(execution, "validate_stage4_semantic_transport_v2_trainer_contract"), \
             patch.object(execution, "validate_formal_rollout_config"), \
             patch.object(execution, "train_epoch", side_effect=trainer), \
             patch.object(execution, "evaluate_velocity_prediction", side_effect=evaluator), \
             patch.object(execution, "evaluate_deterministic_rollout_rgb_quality_v7", side_effect=rollout):
            return execution.run_formal_stage_epoch(**{**self.args, **changes})

    def test_all_48_updates_and_8_validation_reads(self):
        before = state_hash(self.model.denoiser.state_dict())
        result = self.run_epoch()
        self.assertEqual(result["stepEvidence"]["optimizerSteps"], 48)
        self.assertEqual(result["stepEvidence"]["nonTrainOptimizerSteps"], 0)
        self.assertEqual(len(result["validationEvidence"]["sampleIds"]), 8)
        self.assertEqual(len(result["validationEvidence"]["rolloutSampleIds"]), 8)
        self.assertEqual(result["checkpointSelectionScore"], 5.0)
        self.assertNotEqual(before, state_hash(self.model.denoiser.state_dict()))
        e = result["validationEvidence"]
        self.assertEqual(e["modelStateBefore"], e["modelStateAfter"])
        self.assertEqual(e["optimizerStateBefore"], e["optimizerStateAfter"])
        self.assertFalse(result["stagePassed"])
        self.assertFalse(result["capabilityQualificationGranted"])

    def test_review_only_candidate_cannot_reach_optimizer(self):
        self.train.manifest["reviewOnly"] = True
        self.validation.manifest["reviewOnly"] = True
        before = state_hash(self.model.denoiser.state_dict())
        with self.assertRaisesRegex(ValueError, "review-only split candidate"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.denoiser.state_dict()))

    def test_unqualified_candidate_cannot_reach_optimizer(self):
        self.train.manifest["qualification"]["trainingAllowed"] = False
        self.validation.manifest["qualification"]["trainingAllowed"] = False
        before = state_hash(self.model.denoiser.state_dict())
        with self.assertRaisesRegex(ValueError, "not training qualified"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.denoiser.state_dict()))

    def test_smoke_subset_cannot_be_formal_epoch(self):
        self.train._rows = self.train._rows[:1]
        with self.assertRaisesRegex(ValueError, "complete unique membership"):
            self.run_epoch()

    def test_stage_and_epoch_boundaries(self):
        for change in ({"epoch_index": 40}, {"epoch_index": True}, {"seed": -1},
                       {"stage": {**self.args["stage"], "width": 16}},
                       {"stage": {**self.args["stage"], "stage": True}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.run_epoch(**change)

    def test_changed_selection_and_cross_release_refused(self):
        self.train.selection_sha256 = "0" * 64
        with self.assertRaisesRegex(ValueError, "selection hash"):
            self.run_epoch()
        self.train.selection_sha256 = digest(canonical_bytes(self.train.rows))
        self.validation.binding["sha256"] = "b" * 64
        with self.assertRaisesRegex(ValueError, "cross project or release"):
            self.run_epoch()

    def test_wrong_dataset_resolution_refused(self):
        self.train.image_size = (512, 384)
        with self.assertRaisesRegex(ValueError, "resolution"):
            self.run_epoch()

    def test_actual_bad_identity_refused_before_update(self):
        self.train.bad = lambda batch: batch.update(sampleId="validation-0")
        before = state_hash(self.model.state_dict())
        with self.assertRaisesRegex(ValueError, "batch identity"):
            self.run_epoch()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_actual_wrong_dimensions_and_nonfinite_values_refused(self):
        for bad in (lambda b: b.update(image=torch.zeros(3, 16, 16)),
                    lambda b: b["conditions"].fill_(float("nan")),
                    lambda b: b["image"].fill_(2.0)):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.train.bad = bad
                self.run_epoch()

    def test_partial_training_cannot_be_reported_complete(self):
        def partial(model, loader, optimizer, *args, **kwargs):
            for _ in loader:
                optimizer.step()
                break
            return {}
        with self.assertRaisesRegex(ValueError, "coverage incomplete"):
            self.run_epoch(trainer=partial)

    def test_missing_optimizer_steps_refused(self):
        def missing(model, loader, optimizer, *args, **kwargs):
            for _ in loader:
                pass
            return {}
        with self.assertRaisesRegex(ValueError, "optimizer ledger"):
            self.run_epoch(trainer=missing)

    def test_duplicate_optimizer_step_refused(self):
        def duplicate(model, loader, optimizer, *args, **kwargs):
            for _ in loader:
                optimizer.step()
                optimizer.step()
        with self.assertRaisesRegex(ValueError, "unconsumed train batch"):
            self.run_epoch(trainer=duplicate)

    def test_validation_weights_cannot_change(self):
        def mutate(model, loader, *args):
            evaluate_double(model, loader, *args)
            next(model.denoiser.parameters()).add_(1)
            return {}
        with self.assertRaisesRegex(ValueError, "evaluation mutated"):
            self.run_epoch(evaluator=mutate)

    def test_validation_omission_refused(self):
        with self.assertRaisesRegex(ValueError, "validation coverage incomplete"):
            self.run_epoch(evaluator=lambda *args: {})

    def test_suppressed_validation_optimizer_attempt_refused(self):
        def bad(model, loader, *args):
            evaluate_double(model, loader, *args)
            try:
                self.optimizer.step()
            except ValueError:
                pass
            return {}
        with self.assertRaisesRegex(ValueError, "suppressed a forbidden"):
            self.run_epoch(evaluator=bad)

    def test_foundation_cannot_enter_optimizer(self):
        self.optimizer.add_param_group({"params": list(self.model.autoencoder.parameters())})
        with self.assertRaisesRegex(ValueError, "exactly the trainable"):
            self.run_epoch()

    def test_loader_cannot_be_replayed(self):
        loader = execution.CheckedFullSplitLoader(self.validation, self.args["stage"],
            {"sampleIds": [r["sampleId"] for r in self.validation.rows]})
        list(loader)
        with self.assertRaisesRegex(ValueError, "cannot be replayed"):
            list(loader)

    def test_original_exception_propagates_without_retry(self):
        calls = []
        def failed(*args, **kwargs):
            calls.append(1)
            raise RuntimeError("synthetic Trainer failure")
        with self.assertRaisesRegex(RuntimeError, "synthetic Trainer failure"):
            self.run_epoch(trainer=failed)
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(self.optimizer._optimizer_step_pre_hooks), 0)

    def test_rollout_cannot_skip_validation_or_mutate_weights(self):
        def skip(*args):
            return {"rolloutRgbQualityScore": 3.0}
        with self.assertRaisesRegex(ValueError, "rollout validation coverage"):
            self.run_epoch(rollout=skip)
        def mutate(model, *args):
            next(model.denoiser.parameters()).add_(1)
            return rollout_double(model, *args)
        with self.assertRaisesRegex(ValueError, "mutated model"):
            self.run_epoch(rollout=mutate)

    def test_rollout_requires_all_trajectories_and_finite_score(self):
        for field, value in (("rolloutTrajectoryCount", 1), ("rolloutRgbQualityScore", float("nan"))):
            def wrong(*args):
                return {**rollout_double(*args), field: value}
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_epoch(rollout=wrong)

    def test_component_config_uses_bound_rollout_weights_without_grant(self):
        config = execution.build_formal_stage_component_config(ROOT)
        execution.validate_formal_rollout_config(config, ROOT)
        first = next(iter(config["training"]["rolloutCheckpointMetricWeights"]))
        config["training"]["rolloutCheckpointMetricWeights"][first] += 1
        with self.assertRaisesRegex(ValueError, "rollout metric weights"):
            execution.validate_formal_rollout_config(config, ROOT)

    def schedule(self, sink, epoch_runner=None, **changes):
        arguments = {k: v for k, v in self.args.items() if k != "epoch_index"}
        def synthetic_epoch(**values):
            return {"epoch": values["epoch_index"] + 1, "stage": values["stage"],
                    "stepEvidence": {"optimizerSteps": 48, "nonTrainOptimizerSteps": 0}}
        with patch.object(execution, "validate_stage4_semantic_transport_v2_trainer_contract"), \
             patch.object(execution, "validate_formal_rollout_config"), \
             patch.object(execution, "run_formal_stage_epoch", side_effect=epoch_runner or synthetic_epoch) as runner:
            result = execution.run_formal_stage_schedule(on_epoch_completed=sink, **{**arguments, **changes})
        return result, runner

    def test_schedule_stops_at_forty_without_granting_stage_pass(self):
        events = []
        result, runner = self.schedule(events.append)
        self.assertEqual([event["epoch"] for event in events], list(range(1, 41)))
        self.assertEqual(runner.call_count, 40)
        self.assertEqual(result["optimizerSteps"], 1920)
        self.assertEqual(result["completedEpochs"], 40)
        self.assertFalse(result["stagePassed"])
        self.assertFalse(result["capabilityQualificationGranted"])

    def test_schedule_stops_on_epoch_failure_without_retry(self):
        calls, events = [], []
        def fail_third(**values):
            calls.append(values["epoch_index"])
            if values["epoch_index"] == 2:
                raise RuntimeError("third epoch failed")
            return {"epoch": values["epoch_index"] + 1, "stage": values["stage"],
                    "stepEvidence": {"optimizerSteps": 48, "nonTrainOptimizerSteps": 0}}
        with self.assertRaisesRegex(RuntimeError, "third epoch failed"):
            self.schedule(events.append, fail_third)
        self.assertEqual(calls, [0, 1, 2])
        self.assertEqual(len(events), 2)

    def test_schedule_stops_when_evidence_persistence_fails(self):
        events = []
        def failed_sink(event):
            events.append(event)
            raise OSError("evidence storage unavailable")
        with self.assertRaisesRegex(OSError, "evidence storage unavailable"):
            self.schedule(failed_sink)
        self.assertEqual(len(events), 1)

    def test_schedule_sink_cannot_change_weights(self):
        def mutate(_):
            with torch.no_grad():
                next(self.model.denoiser.parameters()).add_(1)
        with self.assertRaisesRegex(ValueError, "sink changed"):
            self.schedule(mutate)

    def test_schedule_requires_sink_and_refuses_caller_resume(self):
        with self.assertRaisesRegex(ValueError, "sink required"):
            self.schedule(None)
        with self.assertRaisesRegex(ValueError, "cannot resume"):
            self.schedule(lambda _: None, epoch_index=1)

    def test_schedule_rejects_wrong_epoch_or_incomplete_updates(self):
        for wrong in ("epoch", "steps"):
            def bad_epoch(**values):
                return {"epoch": 2 if wrong == "epoch" else 1, "stage": values["stage"],
                        "stepEvidence": {"optimizerSteps": 1 if wrong == "steps" else 48,
                                         "nonTrainOptimizerSteps": 0}}
            with self.subTest(wrong=wrong), self.assertRaises(ValueError):
                self.schedule(lambda _: None, bad_epoch)

    def checkpoint_fixture(self, root_override=None, trainer=train_double):
        if root_override is None:
            directory = tempfile.TemporaryDirectory(prefix="painter-formal-checkpoint-")
            self.addCleanup(directory.cleanup)
            root = Path(directory.name).resolve()
        else:
            root = root_override
            root.mkdir(parents=True, exist_ok=False)
        identity = {"batchRunId": "test-batch", "runId": "test-stage", "packageId": "test-package",
            "capabilityVersion": "test-cpu-only",
            "stage": deepcopy(self.args["stage"])}
        logical = ".runtime/ai-painter/stage4-v2-formal-executions/test-batch/stages/test-stage/checkpoint.pt"
        package_bytes = canonical_bytes({"fixtureOnly": True, "trainingAllowed": False,
            "schemaVersion": "ai-painter-stage4-v2-formal-stage-execution-package-v1",
            **{key: identity[key] for key in ("runId", "packageId", "capabilityVersion", "stage")},
            "outputTerminalPath": logical.replace("checkpoint.pt", "phase-terminal.json")})
        (root / "package.json").write_bytes(package_bytes)
        identity["executionPackage"] = {"path": "package.json", "sha256": digest(package_bytes)}
        epoch = self.run_epoch(trainer=trainer)
        kwargs = dict(root=root, checkpoint_path=logical, identity=identity, epoch_evidence=epoch,
            model=self.model, config=self.args["config"], latent_normalization={
                "mean": torch.zeros(1, 12, 1, 1), "standardDeviation": torch.ones(1, 12, 1, 1),
                "version": "per_channel_train_split_v1", "sampleCount": 48,
                "valueCountPerChannel": 48 * 64 * 48})
        return root, identity, kwargs

    def fresh_model(self):
        fresh = Model()
        fresh.autoencoder.load_state_dict(self.model.autoencoder.state_dict())
        return fresh

    def test_checkpoint_roundtrip_stays_pending_review(self):
        root, identity, kwargs = self.checkpoint_fixture()
        saved = execution.write_formal_training_checkpoint(**kwargs)
        fresh = self.fresh_model()
        loaded = execution.reload_formal_training_checkpoint(root=root, checkpoint=saved["checkpoint"],
            expected_identity=identity, model=fresh, config=self.args["config"])
        self.assertEqual(state_hash(fresh.state_dict()), state_hash(self.model.state_dict()))
        self.assertEqual(saved["denoiserStateSha256"], loaded["denoiserStateSha256"])
        self.assertFalse(loaded["stagePassed"])
        self.assertFalse(loaded["capabilityReleased"])
        self.assertEqual(loaded["latentNormalization"]["sampleCount"], 48)
        self.assertEqual(loaded["latentNormalization"]["version"], "per_channel_train_split_v1")
        with self.assertRaises(FileExistsError):
            execution.write_formal_training_checkpoint(**kwargs)

    def test_checkpoint_requires_train_normalization_provenance(self):
        root, identity, kwargs = self.checkpoint_fixture()
        kwargs["latent_normalization"]["sampleCount"] = 8
        with self.assertRaisesRegex(ValueError, "normalization provenance"):
            execution.write_formal_training_checkpoint(**kwargs)

    def v7_arguments(self, root_override=None):
        root, identity, snapshot = self.checkpoint_fixture(root_override)
        self.train.root = self.validation.root = root
        capability = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
        identity["capabilityVersion"] = capability
        package_path = root / identity["executionPackage"]["path"]
        package = json.loads(package_path.read_bytes())
        package["capabilityVersion"] = capability
        package_bytes = canonical_bytes(package)
        package_path.write_bytes(package_bytes)
        identity["executionPackage"]["sha256"] = digest(package_bytes)
        config = deepcopy(self.args["config"])
        config.update(denoiserArchitecture=capability, latentChannels=12)
        config["training"]["bestCheckpointMetric"] = "fixed_grid_plus_deterministic_rollout_rgb_score_v6"
        arguments = {k: v for k, v in self.args.items() if k != "epoch_index"}
        arguments.update(config=config, latent_normalization=snapshot["latent_normalization"], root=root,
            checkpoint_path=snapshot["checkpoint_path"], identity=identity, on_epoch_completed=lambda _: None)
        return arguments

    def run_v7(self, arguments, **changes):
        with patch.object(execution, "validate_stage4_semantic_transport_v2_trainer_contract"), \
             patch.object(execution, "validate_formal_rollout_config"), \
             patch.object(execution, "train_epoch", side_effect=train_double), \
             patch.object(execution, "evaluate_velocity_prediction", side_effect=evaluate_double), \
             patch.object(execution, "evaluate_deterministic_rollout_rgb_quality_v7", side_effect=rollout_double):
            return execution.run_formal_stage_checkpoint(**{**arguments, **changes})

    def test_v7_export_forty_toy_epochs_reload_and_existing_parent_loader(self):
        # Real CPU optimizer updates and serialization; synthetic RGB/model and
        # Trainer/evaluator doubles. The fabricated review below is ONLY a
        # parent-reader fixture inside a temporary directory, never production.
        arguments = self.v7_arguments()
        events = []
        result = self.run_v7(arguments, on_epoch_completed=events.append)
        self.assertEqual(len(events), 40)
        self.assertEqual(sum(e["stepEvidence"]["optimizerSteps"] for e in events), 1920)
        self.assertEqual(result["selectedEpoch"], 1)  # fixed equal scores retain earliest
        self.assertFalse(result["stagePassed"])
        fresh = self.fresh_model()
        with patch.object(fresh.autoencoder, "load_state_dict", side_effect=AssertionError("no AE reload")):
            loaded = execution.reload_formal_stage_v7_checkpoint(root=arguments["root"], result=result,
                model=fresh, config=arguments["config"])
        self.assertFalse(loaded["stagePassed"])
        self.assertEqual(state_hash(fresh.state_dict()), state_hash(self.model.state_dict()))
        identity = arguments["identity"]
        directory = Path(arguments["checkpoint_path"]).parent.as_posix()
        def bound(name, value):
            logical = directory + "/" + name
            data = canonical_bytes(value)
            (arguments["root"] / logical).write_bytes(data)
            return {"path": logical, "sha256": digest(data)}
        manifest = {"architectureId": identity["capabilityVersion"], "packageId": identity["packageId"],
            "runId": identity["runId"], "stage": identity["stage"], "status": "training_completed",
            "checkpoint": result["checkpoint"], "denoiserStateSha256": result["denoiserStateSha256"],
            "nonTrainOptimizerSteps": 0, "loadedParentCheckpoint": None}
        review = {"fixtureOnly": True, "capabilityVersion": identity["capabilityVersion"],
            "packageId": identity["packageId"], "runId": identity["runId"],
            "status": "stage4_v2_machine_review_passed", "checkpoint": result["checkpoint"],
            "failCount": 0, "passCount": 1}
        terminal = {"fixtureOnly": True, "schemaVersion": "ai-painter-stage4-v2-formal-stage-terminal-v1",
            "status": "stage4_v2_formal_stage_passed", "executionState": "completed", "gpuStarted": True,
            "trainingStarted": True, "capabilityVersion": identity["capabilityVersion"],
            "packageId": identity["packageId"], "runId": identity["runId"], "stage": identity["stage"],
            "parent": None, "checkpoint": result["checkpoint"], "trainingManifest": bound("manifest.json", manifest),
            "machineReview": bound("review.json", review)}
        terminal_binding = bound("phase-terminal.json", terminal)
        parent = load_formal_parent_checkpoint(model=self.fresh_model(), root=arguments["root"],
            parent_terminal_binding=terminal_binding, batch_run_id=identity["batchRunId"],
            package_id=identity["packageId"], source_run_id=identity["runId"], stage_index=1,
            max_checkpoint_bytes=1024 * 1024)
        self.assertFalse(parent["capabilityQualificationGranted"])
        self.assertEqual(parent["tensorConsumption"]["loadedDenoiserStateSha256"], result["denoiserStateSha256"])
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.run_v7(arguments)
        with patch.object(torch, "load") as load, self.assertRaisesRegex(ValueError, "byte identity"):
            execution.reload_formal_stage_v7_checkpoint(root=arguments["root"],
                result={**result, "checkpoint": {**result["checkpoint"], "sha256": "0" * 64}},
                model=self.fresh_model(), config=arguments["config"])
        load.assert_not_called()

    def test_v7_export_stops_without_checkpoint_on_persistence_failure(self):
        arguments = self.v7_arguments()
        def fail(_):
            raise OSError("epoch journal failed")
        with self.assertRaisesRegex(OSError, "epoch journal failed"):
            self.run_v7(arguments, on_epoch_completed=fail)
        self.assertFalse((arguments["root"] / arguments["checkpoint_path"]).exists())

    def test_v7_export_rejects_other_architecture_before_training(self):
        arguments = self.v7_arguments()
        arguments["config"]["denoiserArchitecture"] = "old-model"
        with patch.object(execution, "run_formal_stage_schedule") as run, self.assertRaisesRegex(ValueError, "architecture"):
            self.run_v7(arguments)
        run.assert_not_called()

    def test_checkpoint_tamper_refused_before_deserialization(self):
        root, identity, kwargs = self.checkpoint_fixture()
        saved = execution.write_formal_training_checkpoint(**kwargs)
        with patch.object(torch, "load") as load, self.assertRaisesRegex(ValueError, "byte identity"):
            execution.reload_formal_training_checkpoint(root=root,
                checkpoint={**saved["checkpoint"], "sha256": "0" * 64}, expected_identity=identity,
                model=self.fresh_model(), config=self.args["config"])
        load.assert_not_called()

    def test_foreign_execution_namespace_refused(self):
        root, identity, kwargs = self.checkpoint_fixture()
        with self.assertRaisesRegex(ValueError, "namespace"):
            execution.write_formal_training_checkpoint(**{**kwargs,
                "checkpoint_path": kwargs["checkpoint_path"].replace("test-stage/", "other-stage/")})

    def test_changed_execution_package_refused(self):
        root, identity, kwargs = self.checkpoint_fixture()
        (root / "package.json").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "package hash"):
            execution.write_formal_training_checkpoint(**kwargs)

    def test_caller_identity_cannot_relabel_bound_package(self):
        root, identity, kwargs = self.checkpoint_fixture()
        kwargs["identity"]["capabilityVersion"] = "different-candidate"
        with self.assertRaisesRegex(ValueError, "differs from execution package"):
            execution.write_formal_training_checkpoint(**kwargs)

    def test_model_changed_after_evaluation_cannot_be_saved(self):
        root, identity, kwargs = self.checkpoint_fixture()
        with torch.no_grad():
            next(self.model.denoiser.parameters()).add_(1)
        with self.assertRaisesRegex(ValueError, "differs from evaluated"):
            execution.write_formal_training_checkpoint(**kwargs)

    def test_reload_wrong_foundation_or_config_refused(self):
        root, identity, kwargs = self.checkpoint_fixture()
        saved = execution.write_formal_training_checkpoint(**kwargs)
        with self.assertRaisesRegex(ValueError, "foundation mismatch"):
            execution.reload_formal_training_checkpoint(root=root, checkpoint=saved["checkpoint"],
                expected_identity=identity, model=Model(), config=self.args["config"])
        with self.assertRaisesRegex(ValueError, "config mismatch"):
            execution.reload_formal_training_checkpoint(root=root, checkpoint=saved["checkpoint"],
                expected_identity=identity, model=self.fresh_model(), config={"changed": True})


class FormalInitializationTests(unittest.TestCase):
    def setUp(self):
        self.train, self.validation = Dataset("train"), Dataset("validation")
        self.config = {"training": {"seed": 20260721, "batchSize": 1}}
        self.foundation = Model().autoencoder.state_dict()
        self.binding = {"schemaVersion": "ai-painter-formal-stage0-initialization-input-v1",
            "stage": {"stage": 0, "width": 256, "height": 192, "epochCount": 40},
            "datasetManifest": self.train.binding, "configSha256": digest(canonical_bytes(self.config)),
            "seed": 20260721, "foundationStateSha256": state_hash(self.foundation)}

    def initialize(self, binding=None, foundation=None):
        class FrozenModel(Model):
            def train(self, mode=True):
                super().train(mode)
                self.autoencoder.eval()
                return self

        def check(model, **kwargs):
            self.assertFalse(model.autoencoder.training)
            self.assertTrue(all(not p.requires_grad for p in model.autoencoder.parameters()))
            return {"stateSha256": state_hash(model.autoencoder.state_dict())}

        with patch.object(execution, "build_formal_stage_component_config", return_value=deepcopy(self.config)), \
             patch.object(execution, "build_complete_world_system", side_effect=lambda config: FrozenModel()), \
             patch.object(execution, "validate_stage4_semantic_transport_v2_trainer_contract"), \
             patch.object(execution, "validate_formal_rollout_config"), \
             patch.object(execution, "validate_stage4_semantic_transport_v2_autoencoder_boundary", side_effect=check), \
             patch.object(Dataset, "__getitem__", side_effect=AssertionError("must not decode images")), \
             patch.object(torch, "load", side_effect=AssertionError("must not load checkpoint")), \
             patch.object(torch, "save", side_effect=AssertionError("must not write checkpoint")), \
             patch.object(torch.optim, "AdamW", side_effect=AssertionError("must not create optimizer")):
            return execution.initialize_formal_stage0_cpu(root=ROOT,
                initialization=self.binding if binding is None else binding,
                train_dataset=self.train, validation_dataset=self.validation,
                foundation_state=self.foundation if foundation is None else foundation)

    def test_full_split_binding_reproducible_without_rng_or_training_side_effects(self):
        before = torch.random.get_rng_state().clone()
        _, first, evidence = self.initialize()
        _, second, repeated = self.initialize()
        self.assertTrue(torch.equal(before, torch.random.get_rng_state()))
        self.assertEqual(evidence, repeated)
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertEqual(len(evidence["selections"]["train"]["sampleIds"]), 48)
        self.assertEqual(len(evidence["selections"]["validation"]["sampleIds"]), 8)
        for field in ("historicalDenoiserLoaded", "optimizerCreated", "datasetTensorsDecoded",
                      "foundationCheckpointAuthenticated", "trainingAllowed", "gpuStarted"):
            self.assertIs(evidence[field], False)

    def test_smoke_schedule_cannot_be_relabelled_as_formal(self):
        binding = deepcopy(self.binding)
        binding["stage"]["epochCount"] = 30
        with self.assertRaisesRegex(ValueError, "full schedule"):
            self.initialize(binding)
        self.train._rows = self.train._rows[:1]
        self.train.selection_sha256 = digest(canonical_bytes(self.train.rows))
        with self.assertRaisesRegex(ValueError, "complete unique membership"):
            self.initialize()

    def test_explicit_seed_with_objective_only_config(self):
        self.config["training"].pop("seed")
        self.binding["configSha256"] = digest(canonical_bytes(self.config))
        _, _, evidence = self.initialize()
        self.assertEqual(evidence["input"]["seed"], 20260721)
        with self.assertRaisesRegex(ValueError, "seed invalid"):
            self.initialize({**self.binding, "seed": -1})

    def test_parent_or_smoke_binding_fields_are_rejected(self):
        for key in ("parentCheckpoint", "smokeCheckpoint", "component"):
            with self.subTest(key=key):
                binding = {**self.binding, key: {"path": "old.pt", "sha256": "a" * 64}}
                with self.assertRaisesRegex(ValueError, "fields invalid"):
                    self.initialize(binding)

    def test_config_seed_and_dataset_substitution_are_rejected(self):
        for key, value, message in (("seed", 20263722, "seed mismatch"),
                                    ("configSha256", "b" * 64, "config mismatch"),
                                    ("datasetManifest", {"path": "wrong.json", "sha256": "c" * 64}, "dataset binding mismatch")):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, message):
                self.initialize({**self.binding, key: value})

    def test_foundation_hash_or_nonfinite_values_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "state mismatch"):
            self.initialize({**self.binding, "foundationStateSha256": "d" * 64})
        state = {k: v.clone() for k, v in self.foundation.items()}
        next(iter(state.values())).fill_(float("nan"))
        with self.assertRaisesRegex(ValueError, "CPU foundation state"):
            self.initialize(foundation=state)

    def test_cross_project_dataset_is_rejected(self):
        self.validation.root = ROOT / "unrelated"
        with self.assertRaisesRegex(ValueError, "Dataset root mismatch"):
            self.initialize()


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--formal-worker":
        name, failure = sys.argv[2:]
        if not re.fullmatch(r"formal-cpu-[a-f0-9-]{36}", name) or failure not in ("none", "epoch", "reload", "v7"):
            raise ValueError("invalid synthetic worker request")
        FormalStageTests.setUpClass()
        case = FormalStageTests()
        case.setUp()
        workspace = ROOT / ".runtime/ai-painter/formal-stage-cpu-tests" / name
        if failure == "v7":
            arguments = case.v7_arguments(workspace)
            result = case.run_v7(arguments)
            loaded = execution.reload_formal_stage_v7_checkpoint(root=workspace, result=result,
                model=case.fresh_model(), config=arguments["config"])
            loaded.pop("latentNormalization")
            output = {"status": "passed", "stepEvidence": {"optimizerSteps": result["schedule"]["optimizerSteps"],
                "nonTrainOptimizerSteps": result["schedule"]["nonTrainOptimizerSteps"]},
                "checkpoint": {"path": ".runtime/ai-painter/formal-stage-cpu-tests/" + name + "/" + result["checkpoint"]["path"],
                               "sha256": result["checkpoint"]["sha256"]},
                "writtenStateSha256": result["denoiserStateSha256"], "reload": loaded,
                "schedule": result["schedule"], "selectedEpoch": result["selectedEpoch"],
                "scope": "synthetic_cpu_full_split_with_test_double_trainer", "checkpointFormat": "v7",
                "trainingAllowed": False, "stagePassed": False, "realDataTrainingStarted": False, "gpuStarted": False}
            (workspace / "worker-result.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
            print(json.dumps(output))
            sys.exit(0)
        def failed_trainer(*args, **kwargs):
            raise RuntimeError("injected_formal_epoch_failure")
        try:
            root, identity, kwargs = case.checkpoint_fixture(workspace,
                trainer=failed_trainer if failure == "epoch" else train_double)
            saved = execution.write_formal_training_checkpoint(**kwargs)
            fresh = case.fresh_model()
            if failure == "reload":
                saved["checkpoint"]["sha256"] = "0" * 64
            reloaded = execution.reload_formal_training_checkpoint(root=root, checkpoint=saved["checkpoint"],
                expected_identity=identity, model=fresh, config=case.args["config"])
            reloaded.pop("latentNormalization")
            output = {"status": "passed", "stepEvidence": kwargs["epoch_evidence"]["stepEvidence"],
                "checkpoint": {"path": ".runtime/ai-painter/formal-stage-cpu-tests/" + name + "/" + saved["checkpoint"]["path"],
                               "sha256": saved["checkpoint"]["sha256"]},
                "writtenStateSha256": saved["denoiserStateSha256"], "reload": reloaded}
        except Exception as error:
            output = {"status": "failed", "error": str(error)}
        output.update(scope="synthetic_cpu_full_split_with_test_double_trainer",
            trainingAllowed=False, stagePassed=False, realDataTrainingStarted=False, gpuStarted=False)
        (workspace / "worker-result.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
        print(json.dumps(output))
        sys.exit(0)
    unittest.main(verbosity=2)
