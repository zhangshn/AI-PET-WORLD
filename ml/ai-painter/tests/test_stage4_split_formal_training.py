"""CPU-only synthetic data: full membership, actual Trainer and negative gates."""
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import torch

TESTS = Path(__file__).resolve().parent
for directory in (TESTS, TESTS.parent / "scripts"):
    sys.path.insert(0, str(directory))

from test_stage4_semantic_transport_v2_trainer_support import _config
from test_stage4_split_smoke import SyntheticDataset
from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.complete_world.split_release import COUNTS, canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash
from ai_painter.complete_world.split_formal_training import (
    run_formal_split_epoch, apply_formal_parent_state, load_formal_parent_checkpoint,
)
from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
import train_ai_assisted_conditional_denoiser as trainer


class FullSyntheticDataset(SyntheticDataset):
    def __init__(self, split):
        super().__init__(split)
        self.manifest["splitCounts"] = dict(COUNTS)
        self.image_size = (16, 16)  # Component fixture, not formal resolution qualification.
        self._rows = [{"sampleId": f"{split}-{i}", "split": split} for i in range(COUNTS[split])]
        self.selection_sha256 = digest(canonical_bytes(self._rows))


class FormalSplitEpochTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.previous_threads)

    def setUp(self):
        torch.manual_seed(20263722)
        self.config = _config()
        self.config["training"].update(
            batchSize=1, seed=20263722, denoiserEpochs=40,
            fixedValidationTimesteps=[0, 250, 500, 750],
            resolutionStages=[{"width": 16, "height": 16} for _ in range(3)],
        )
        self.model = build_complete_world_system(self.config)
        self.optimizer = torch.optim.AdamW(self.model.denoiser.parameters(), lr=0.0001)
        self.train, self.validation = FullSyntheticDataset("train"), FullSyntheticDataset("validation")
        self.kwargs = dict(
            model=self.model, optimizer=self.optimizer, train_dataset=self.train,
            validation_dataset=self.validation,
            diffusion=trainer.build_diffusion_schedule(self.config, torch.device("cpu")),
            latent_normalization={"mean": torch.zeros(1, 12, 1, 1),
                                  "standardDeviation": torch.ones(1, 12, 1, 1)},
            device=torch.device("cpu"), config=self.config, stage_index=0, epoch_index=0,
        )

    def simple_train(self, model, loader, optimizer, *args, **kwargs):
        for batch in loader:
            optimizer.zero_grad()
            next(model.denoiser.parameters()).sum().mul(0.000001).backward()
            optimizer.step()
        return {"syntheticFixtureLoss": 1.0}

    @staticmethod
    def simple_validation(model, loader, *args, **kwargs):
        for batch in loader:
            assert not torch.is_grad_enabled()
        return {"syntheticFixtureMetric": 1.0}

    def fast_run(self, train=None, evaluate=None, **extra):
        with patch.object(trainer, "train_epoch", side_effect=train or self.simple_train), \
             patch.object(trainer, "evaluate_velocity_prediction", side_effect=evaluate or self.simple_validation):
            return run_formal_split_epoch(**{**self.kwargs, **extra})

    def test_actual_trainer_full_48_plus_8_membership_and_frozen_autoencoder(self):
        before, ae_before = state_hash(self.model.state_dict()), state_hash(self.model.autoencoder.state_dict())
        config_before = deepcopy(self.config)
        progress = []
        with patch.object(trainer, "train_epoch", wraps=trainer.train_epoch) as train, \
             patch.object(trainer, "evaluate_velocity_prediction", wraps=trainer.evaluate_velocity_prediction) as evaluate:
            r = run_formal_split_epoch(**self.kwargs, on_batch_progress=progress.append)
        self.assertEqual((train.call_count, evaluate.call_count), (1, 1))
        self.assertEqual(len(progress), 48)
        self.assertEqual(r["stepEvidence"]["optimizerSteps"], 48)
        self.assertEqual(r["stepEvidence"]["nonTrainOptimizerSteps"], 0)
        self.assertEqual(len(self.train.accessed), 48)
        self.assertEqual(set(self.train.accessed), {f"train-{i}" for i in range(48)})
        self.assertEqual(self.validation.accessed, [f"validation-{i}" for i in range(8)])
        self.assertNotEqual(before, state_hash(self.model.state_dict()))
        self.assertEqual(ae_before, state_hash(self.model.autoencoder.state_dict()))
        self.assertEqual(self.config, config_before)
        v = r["validationEvidence"]
        self.assertEqual(v["modelStateBefore"], v["modelStateAfter"])
        self.assertEqual(v["optimizerStateBefore"], v["optimizerStateAfter"])
        for field in ("challengeConsumed", "regressionConsumed", "checkpointSelected",
                      "formalStagePassed", "capabilityQualificationGranted"):
            self.assertFalse(r[field])

    def test_bad_schedule_and_split_fail_before_trainer(self):
        cases = [dict(stage_index=-1), dict(stage_index=3), dict(stage_index=True),
                 dict(epoch_index=40), dict(epoch_index=True), dict(train_dataset=self.validation),
                 dict(validation_dataset=self.train)]
        for change in cases:
            with self.subTest(change=change), patch.object(trainer, "train_epoch") as train, \
                 self.assertRaises(ValueError):
                run_formal_split_epoch(**{**self.kwargs, **change})
            train.assert_not_called()

    def test_capacity_duplicate_digest_and_release_conflicts_fail_before_trainer(self):
        for mutation in ("capacity", "duplicate", "digest", "release", "resolution"):
            with self.subTest(mutation=mutation):
                dataset = FullSyntheticDataset("validation")
                if mutation == "capacity": dataset._rows.pop()
                elif mutation == "duplicate": dataset._rows[1] = deepcopy(dataset._rows[0])
                elif mutation == "digest": dataset.selection_sha256 = "0" * 64
                elif mutation == "release": dataset.manifest["datasetReleaseIdentity"] = "another-release"
                else: dataset.image_size = (256, 192)
                with patch.object(trainer, "train_epoch") as train, self.assertRaises(ValueError):
                    run_formal_split_epoch(**{**self.kwargs, "validation_dataset": dataset})
                train.assert_not_called()

    def test_optimizer_autoencoder_or_partial_denoiser_is_rejected(self):
        for optimizer in (torch.optim.AdamW([next(self.model.denoiser.parameters())]),
                          torch.optim.AdamW(self.model.parameters())):
            with patch.object(trainer, "train_epoch") as train, self.assertRaisesRegex(ValueError, "exactly"):
                run_formal_split_epoch(**{**self.kwargs, "optimizer": optimizer})
            train.assert_not_called()

    def test_missing_or_skipped_train_optimization_is_not_epoch_success(self):
        def no_updates(model, loader, *args, **kwargs):
            for batch in loader:
                pass
            return {"loss": 0.0}
        with self.assertRaisesRegex(ValueError, "every train row exactly once"):
            self.fast_run(train=no_updates)

    def test_extra_or_replayed_train_batches_are_rejected(self):
        def replay(model, loader, optimizer, *args, **kwargs):
            self.simple_train(model, loader, optimizer)
            return self.simple_train(model, loader, optimizer)
        with self.assertRaisesRegex(ValueError, "cannot be replayed"):
            self.fast_run(train=replay)

    def test_actual_train_batch_substitution_is_detected_before_update(self):
        original = FullSyntheticDataset.__getitem__
        def substitute(dataset, index):
            batch = original(dataset, index)
            if dataset is self.train: batch["sampleId"] = "validation-0"
            return batch
        before = state_hash(self.model.state_dict())
        with patch.object(FullSyntheticDataset, "__getitem__", substitute), \
             self.assertRaisesRegex(ValueError, "identity/order mismatch"):
            self.fast_run()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_nonfinite_image_is_rejected_before_update(self):
        original = FullSyntheticDataset.__getitem__
        def invalid(dataset, index):
            batch = original(dataset, index)
            batch["image"][0, 0, 0] = float("nan")
            return batch
        before = state_hash(self.model.state_dict())
        with patch.object(FullSyntheticDataset, "__getitem__", invalid), \
             self.assertRaisesRegex(ValueError, "shape/range"):
            self.fast_run()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_validation_must_read_all_bound_rows(self):
        with self.assertRaisesRegex(ValueError, "every validation row"):
            self.fast_run(evaluate=lambda *args: {"metric": 1.0})

    def test_caught_validation_optimizer_attempt_still_fails(self):
        def invalid(model, loader, *args, **kwargs):
            result = self.simple_validation(model, loader)
            try: self.optimizer.step()
            except ValueError: pass
            return result
        with self.assertRaisesRegex(ValueError, "suppressed a forbidden"):
            self.fast_run(evaluate=invalid)

    def test_validation_model_mutation_fails(self):
        def invalid(model, loader, *args, **kwargs):
            result = self.simple_validation(model, loader)
            next(model.denoiser.parameters()).add_(1)
            return result
        with self.assertRaisesRegex(ValueError, "evaluation mutated"):
            self.fast_run(evaluate=invalid)

    def test_invalid_metrics_never_count_as_success(self):
        def invalid(model, loader, *args, **kwargs):
            self.simple_validation(model, loader)
            return {"metric": float("nan")}
        with self.assertRaisesRegex(ValueError, "nonfinite metrics"):
            self.fast_run(evaluate=invalid)

    def test_dataset_manifest_or_selection_changes_cannot_be_hidden(self):
        def changed(model, loader, optimizer, *args, **kwargs):
            result = self.simple_train(model, loader, optimizer)
            self.train.manifest["laterMutation"] = True
            self.validation.manifest["laterMutation"] = True
            return result
        with self.assertRaisesRegex(ValueError, "inputs changed"):
            self.fast_run(train=changed)

    def test_nonfinite_model_with_finite_reported_metrics_is_rejected(self):
        def changed(model, loader, optimizer, *args, **kwargs):
            result = self.simple_train(model, loader, optimizer)
            with torch.no_grad():
                next(model.denoiser.parameters()).fill_(float("nan"))
            return result
        with self.assertRaisesRegex(ValueError, "nonfinite model state"):
            self.fast_run(train=changed)

    def test_epoch_order_is_reproducible_and_next_epoch_uses_new_permutation(self):
        first = self.fast_run()["stepEvidence"]["steps"]
        repeated = self.fast_run()["stepEvidence"]["steps"]
        second = self.fast_run(epoch_index=1)["stepEvidence"]["steps"]
        self.assertEqual(first, repeated)
        self.assertNotEqual([r["sampleIds"] for r in first], [r["sampleIds"] for r in second])
        self.assertEqual(sorted(r["sampleIds"] for r in first), sorted(r["sampleIds"] for r in second))


class FormalParentTensorTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(100)
        self.model = build_complete_world_system(_config())
        self.parent = {key: value.detach().clone() + 0.125
                       for key, value in self.model.denoiser.state_dict().items()}
        self.args = dict(model=self.model, parent_state=self.parent,
                         expected_state_sha256=state_dict_sha256(self.parent),
                         stage_index=1, parent_stage_index=0)

    def test_actual_parameter_copy_for_both_successor_stages_preserves_ae_and_parameter_ids(self):
        for stage in (1, 2):
            parameter_ids = [id(p) for p in self.model.denoiser.parameters()]
            ae = state_hash(self.model.autoencoder.state_dict())
            with patch.object(torch, "load", side_effect=AssertionError("no checkpoint deserialization")):
                r = apply_formal_parent_state(**{**self.args, "stage_index": stage, "parent_stage_index": stage - 1})
            self.assertEqual(r["loadedDenoiserStateSha256"], r["sourceStateSha256"])
            self.assertEqual(r["sourceStateSha256"], state_dict_sha256(self.model.denoiser.state_dict()))
            self.assertEqual(ae, state_hash(self.model.autoencoder.state_dict()))
            self.assertEqual(parameter_ids, [id(p) for p in self.model.denoiser.parameters()])
            for field in ("checkpointFileRead", "fileLineageVerified", "capabilityQualificationGranted"):
                self.assertFalse(r[field])
        key = next(iter(self.parent))
        self.parent[key].add_(1)
        self.assertFalse(torch.equal(self.parent[key], self.model.denoiser.state_dict()[key]))

    def test_stage_zero_skipped_or_invalid_parent_is_rejected_without_model_mutation(self):
        before = state_hash(self.model.state_dict())
        for fields in (dict(stage_index=0), dict(stage_index=3), dict(stage_index=True),
                       dict(parent_stage_index=True), dict(stage_index=2, parent_stage_index=0),
                       dict(expected_state_sha256="0" * 64)):
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                apply_formal_parent_state(**{**self.args, **fields})
            self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_entire_state_is_checked_before_copying_any_parameters(self):
        before = state_hash(self.model.state_dict())
        for kind in ("missing", "extra", "shape", "dtype", "nonfinite"):
            state = deepcopy(self.parent)
            key = next(reversed(state))
            if kind == "missing": del state[key]
            elif kind == "extra": state["unexpected"] = torch.zeros(1)
            elif kind == "shape": state[key] = torch.zeros(1, 1, 1, 1, 1)
            elif kind == "dtype": state[key] = state[key].to(torch.float64)
            else: state[key].fill_(float("nan"))
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                apply_formal_parent_state(**{**self.args, "parent_state": state})
            self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_noop_loader_cannot_claim_success_from_a_matching_source_digest(self):
        with patch.object(self.model.denoiser, "load_state_dict", return_value=None), \
             self.assertRaisesRegex(ValueError, "not faithfully loaded"):
            apply_formal_parent_state(**self.args)


class FormalParentFileTests(unittest.TestCase):
    """Synthetic weight files and terminal fixtures only; never project .pt files.

    Fixture success/GPU metadata is an input to negative/positive parser tests,
    NOT a real stage success and not evidence that any GPU was started.
    """
    @classmethod
    def setUpClass(cls):
        cls.previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.previous_threads)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="stage4-parent-file-test-")
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.cleanup)
        torch.manual_seed(209)
        self.model = build_complete_world_system(_config())
        self.capability = _config()["denoiserArchitecture"]
        self.directory = ".runtime/ai-painter/stage4-v2-formal-executions/test-batch/stages/test-source"
        self.stage = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
        self.payload = {
            "schemaVersion": "project-owned-ai-assisted-cold-start-checkpoint-v7",
            "modelConfig": {"denoiserArchitecture": self.capability, "latentChannels": 12},
            "trainingStage": "conditional_denoiser_training", "denoiserTrained": True,
            "resolutionStage": {"width": 256, "height": 192},
            "singleSampleOverfitSmoke": {"enabled": False},
            "autoencoderState": deepcopy(self.model.autoencoder.state_dict()),
            "denoiserState": {k: v.detach().clone() + 0.125 for k, v in self.model.denoiser.state_dict().items()},
            "latentNormalization": {"version": "per_channel_train_split_v1",
                                    "mean": [0.125] * 12, "standardDeviation": [0.75] * 12},
        }
        self.save_payload()
        self.args = dict(model=self.model, root=self.root, parent_terminal_binding=self.bind_terminal(),
                         batch_run_id="test-batch", package_id="test-package", source_run_id="test-source",
                         stage_index=1, max_checkpoint_bytes=64 * 1024 * 1024)

    def cleanup(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith("stage4-parent-file-test-"))
        self.temp.cleanup()

    def write(self, logical, value):
        file = self.root / logical
        self.assertTrue(file.resolve().is_relative_to(self.root))
        file.parent.mkdir(parents=True, exist_ok=True)
        data = value if isinstance(value, bytes) else json.dumps(value).encode("utf-8")
        file.write_bytes(data)
        return {"path": logical, "sha256": digest(data)}

    def save_payload(self):
        stream = io.BytesIO()
        torch.save(self.payload, stream)
        self.checkpoint = self.write(self.directory + "/checkpoint.pt", stream.getvalue())
        self.manifest = {"architectureId": self.capability, "packageId": "test-package", "runId": "test-source",
                         "stage": self.stage, "status": "training_completed", "checkpoint": self.checkpoint,
                         "denoiserStateSha256": state_dict_sha256(self.payload["denoiserState"]),
                         "nonTrainOptimizerSteps": 0, "loadedParentCheckpoint": None}
        self.review = {"capabilityVersion": self.capability, "packageId": "test-package", "runId": "test-source",
                       "status": "stage4_v2_machine_review_passed", "checkpoint": self.checkpoint,
                       "failCount": 0, "passCount": 7}
        self.terminal = {"schemaVersion": "ai-painter-stage4-v2-formal-stage-terminal-v1",
                         "status": "stage4_v2_formal_stage_passed", "executionState": "completed",
                         "capabilityVersion": self.capability, "packageId": "test-package", "runId": "test-source",
                         "stage": self.stage, "parent": None, "checkpoint": self.checkpoint,
                         "gpuStarted": True, "trainingStarted": True}

    def bind_terminal(self):
        self.terminal["trainingManifest"] = self.write(self.directory + "/manifest.json", self.manifest)
        self.terminal["machineReview"] = self.write(self.directory + "/review.json", self.review)
        return self.write(self.directory + "/phase-terminal.json", self.terminal)

    def run_loader(self, **kwargs):
        return load_formal_parent_checkpoint(**{**self.args, **kwargs})

    def test_real_serialized_bytes_are_loaded_into_parameters_on_cpu_with_no_ae_load(self):
        before_ae = state_hash(self.model.autoencoder.state_dict())
        ids = [id(p) for p in self.model.denoiser.parameters()]
        with patch.object(torch, "load", wraps=torch.load) as load, \
             patch.object(self.model.autoencoder, "load_state_dict", side_effect=AssertionError("AE cannot be loaded")):
            result = self.run_loader()
        load.assert_called_once()
        self.assertIsInstance(load.call_args.args[0], io.BytesIO)
        self.assertEqual(load.call_args.kwargs, {"map_location": "cpu", "weights_only": True})
        self.assertEqual(result["tensorConsumption"]["loadedDenoiserStateSha256"], self.manifest["denoiserStateSha256"])
        self.assertEqual(state_dict_sha256(self.model.denoiser.state_dict()), self.manifest["denoiserStateSha256"])
        self.assertEqual(before_ae, state_hash(self.model.autoencoder.state_dict()))
        self.assertEqual(ids, [id(p) for p in self.model.denoiser.parameters()])
        self.assertEqual(result["latentNormalization"], self.payload["latentNormalization"])
        for field in ("acceptedChainQualifiedByThisComponent", "capabilityQualificationGranted", "formalStagePassed",
                      "optimizerCreated", "gpuStarted"):
            self.assertFalse(result[field])
        self.assertEqual(len(result["inputReceipts"]), 4)

    def test_stage_two_uses_stage_one_resolution_not_stage_zero(self):
        self.stage = {"stage": 1, "width": 512, "height": 384, "epochCount": 40}
        self.payload["resolutionStage"] = {"width": 512, "height": 384}
        self.save_payload()
        self.set_stage_one_predecessor()
        r = self.run_loader(stage_index=2, parent_terminal_binding=self.bind_terminal())
        self.assertEqual(r["parentStageIndex"], 1)
        self.assertEqual(r["stageIndex"], 2)

    def set_stage_one_predecessor(self):
        # Synthetic metadata only. This component does not qualify/re-read the
        # full accepted chain; that is the independently tested batch executor.
        previous = ".runtime/ai-painter/stage4-v2-formal-executions/test-batch/stages/test-stage-zero"
        self.terminal["parent"] = {"terminal": {"path": previous + "/phase-terminal.json", "sha256": "1" * 64},
                                   "checkpoint": {"path": previous + "/checkpoint.pt", "sha256": "2" * 64}}
        self.manifest["loadedParentCheckpoint"] = deepcopy(self.terminal["parent"]["checkpoint"])

    def test_predecessor_evidence_must_be_present_and_internally_consistent(self):
        before = state_hash(self.model.state_dict())
        for source in (0, 1):
            self.stage = {"stage": source, "width": 256 * 2**source, "height": 192 * 2**source, "epochCount": 40}
            self.payload["resolutionStage"] = {"width": self.stage["width"], "height": self.stage["height"]}
            self.save_payload()
            if source == 1:
                self.set_stage_one_predecessor()
            original = deepcopy((self.terminal, self.manifest))
            changes = [lambda: self.terminal.pop("parent"), lambda: self.manifest.pop("loadedParentCheckpoint"),
                       lambda: self.manifest.update(loadedParentCheckpoint={"path": "wrong.pt", "sha256": "0" * 64}),
                       lambda: self.terminal["stage"].update(stage=bool(source))]
            if source == 0:
                changes.append(lambda: self.terminal.update(parent={}))
            else:
                changes.extend([lambda: self.terminal.update(parent=None),
                                lambda: self.terminal["parent"]["terminal"].update(sha256="bad")])
            for index, mutate in enumerate(changes):
                self.terminal, self.manifest = deepcopy(original)
                mutate()
                with self.subTest(source=source, case=index), patch.object(torch, "load") as load, self.assertRaises(ValueError):
                    self.run_loader(stage_index=source + 1, parent_terminal_binding=self.bind_terminal())
                load.assert_not_called()
                self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_unqualified_wrong_stage_identity_and_budget_fail_before_deserialization(self):
        before = state_hash(self.model.state_dict())
        for change in (dict(stage_index=0), dict(stage_index=True), dict(stage_index=3),
                       dict(stage_index=2), dict(batch_run_id="other"), dict(source_run_id="other"),
                       dict(package_id="other"), dict(batch_run_id="../outside"),
                       dict(max_checkpoint_bytes=True), dict(max_checkpoint_bytes=0),
                       dict(max_checkpoint_bytes=1), dict(max_checkpoint_bytes=1024**3)):
            with self.subTest(change=change), patch.object(torch, "load") as load, self.assertRaises((ValueError, FileNotFoundError)):
                self.run_loader(**change)
            load.assert_not_called()
            self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_document_role_cross_run_selection_and_hash_conflicts_fail_before_load(self):
        original = deepcopy((self.terminal, self.manifest, self.review))
        mutations = [
            ("terminal", "status", "failed_closed"), ("terminal", "executionState", "failed_closed"),
            ("terminal", "gpuStarted", False), ("terminal", "trainingStarted", False),
            ("terminal", "schemaVersion", "old-failure"), ("terminal", "capabilityVersion", "old-model"),
            ("manifest", "architectureId", "old-model"), ("manifest", "runId", "another-run"),
            ("manifest", "status", "failed"), ("manifest", "nonTrainOptimizerSteps", 1),
            ("manifest", "nonTrainOptimizerSteps", False), ("manifest", "denoiserStateSha256", None),
            ("manifest", "checkpoint", {"path": "different.pt", "sha256": "0" * 64}),
            ("review", "status", "failed"), ("review", "packageId", "another-package"),
            ("review", "failCount", 1), ("review", "passCount", 0), ("review", "passCount", True),
        ]
        before = state_hash(self.model.state_dict())
        for name, key, value in mutations:
            self.terminal, self.manifest, self.review = deepcopy(original)
            getattr(self, name)[key] = value
            binding = self.bind_terminal()
            with self.subTest(name=name, key=key), patch.object(torch, "load") as load, self.assertRaises(ValueError):
                self.run_loader(parent_terminal_binding=binding)
            load.assert_not_called()
            self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_all_bound_files_are_rehashed_not_just_checkpoint_name(self):
        for binding in (self.args["parent_terminal_binding"], self.terminal["trainingManifest"],
                        self.terminal["machineReview"], self.checkpoint):
            file = self.root / binding["path"]
            original = file.read_bytes()
            try:
                file.write_bytes(original + b" ")
                with self.subTest(path=binding["path"]), patch.object(torch, "load") as load, self.assertRaisesRegex(ValueError, "SHA"):
                    self.run_loader()
                load.assert_not_called()
            finally:
                file.write_bytes(original)

    def test_file_replacement_during_decode_is_detected_before_parameter_copy(self):
        original_load = torch.load
        before = state_hash(self.model.state_dict())
        def replacing(*args, **kwargs):
            result = original_load(*args, **kwargs)
            file = self.root / self.checkpoint["path"]
            file.write_bytes(file.read_bytes() + b"changed")
            return result
        with patch.object(torch, "load", side_effect=replacing), self.assertRaisesRegex(ValueError, "SHA"):
            self.run_loader()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_unsafe_pickle_is_not_retried_with_unrestricted_loader(self):
        self.payload["unsupportedGlobal"] = Path("synthetic-unused-path")
        self.save_payload()
        with patch.object(torch, "load", wraps=torch.load) as load, self.assertRaises(Exception):
            self.run_loader(parent_terminal_binding=self.bind_terminal())
        load.assert_called_once()
        self.assertTrue(load.call_args.kwargs["weights_only"])

    def test_caller_binding_mutation_cannot_change_the_consumption_receipt(self):
        original_load = torch.load
        expected = deepcopy(self.args["parent_terminal_binding"])
        def mutating(*args, **kwargs):
            result = original_load(*args, **kwargs)
            self.args["parent_terminal_binding"].update(path="wrong.json", sha256="0" * 64)
            return result
        with patch.object(torch, "load", side_effect=mutating):
            result = self.run_loader()
        self.assertEqual(result["parentTerminal"], expected)
        self.assertIn(expected, result["inputReceipts"])
        self.assertNotIn(self.args["parent_terminal_binding"], result["inputReceipts"])

    def test_post_copy_file_replacement_fails_without_a_success_receipt(self):
        original_copy = self.model.denoiser.load_state_dict
        before = state_hash(self.model.denoiser.state_dict())
        def replacing(*args, **kwargs):
            result = original_copy(*args, **kwargs)
            file = self.root / self.checkpoint["path"]
            file.write_bytes(file.read_bytes() + b"changed-after-copy")
            return result
        with patch.object(self.model.denoiser, "load_state_dict", side_effect=replacing), self.assertRaisesRegex(ValueError, "SHA"):
            self.run_loader()
        # Deliberately NOT an atomic rollback promise: callers must discard
        # this destination, not catch the failure and keep training with it.
        self.assertNotEqual(before, state_hash(self.model.denoiser.state_dict()))
        self.assertEqual(state_dict_sha256(self.model.denoiser.state_dict()), self.manifest["denoiserStateSha256"])

    def test_smoke_wrong_architecture_and_invalid_normalization_do_not_mutate_destination(self):
        original = deepcopy(self.payload)
        before = state_hash(self.model.state_dict())
        changes = [lambda p: p.update(trainingStage="conditional_denoiser_single_sample_overfit_smoke"),
                   lambda p: p.update(denoiserTrained=False),
                   lambda p: p["modelConfig"].update(denoiserArchitecture="old-failed-model"),
                   lambda p: p["singleSampleOverfitSmoke"].update(enabled=True),
                   lambda p: p.update(singleSampleOverfitSmoke=None),
                   lambda p: p["singleSampleOverfitSmoke"].update(enabled=0),
                   lambda p: p["resolutionStage"].update(width=1024),
                   lambda p: p["latentNormalization"].update(mean=[0.0]),
                   lambda p: p["latentNormalization"]["standardDeviation"].__setitem__(0, 0),
                   lambda p: p["latentNormalization"]["standardDeviation"].__setitem__(0, 1e-100),
                   lambda p: p["latentNormalization"]["mean"].__setitem__(0, 1e100),
                   lambda p: p["latentNormalization"]["mean"].__setitem__(0, float("nan"))]
        for index, mutate in enumerate(changes):
            self.payload = deepcopy(original)
            mutate(self.payload)
            self.save_payload()
            with self.subTest(case=index), self.assertRaises(ValueError):
                self.run_loader(parent_terminal_binding=self.bind_terminal())
            self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_different_foundation_and_bad_denoiser_state_do_not_mutate_destination(self):
        original = deepcopy(self.payload)
        before = state_hash(self.model.state_dict())
        for field in ("autoencoderState", "denoiserState"):
            self.payload = deepcopy(original)
            key = next(iter(self.payload[field]))
            self.payload[field][key] = torch.zeros(1)
            self.save_payload()
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_loader(parent_terminal_binding=self.bind_terminal())
            self.assertEqual(before, state_hash(self.model.state_dict()))
        self.payload = deepcopy(original)
        self.save_payload()
        self.manifest["denoiserStateSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "state digest"):
            self.run_loader(parent_terminal_binding=self.bind_terminal())
        self.assertEqual(before, state_hash(self.model.state_dict()))


if __name__ == "__main__":
    unittest.main()
