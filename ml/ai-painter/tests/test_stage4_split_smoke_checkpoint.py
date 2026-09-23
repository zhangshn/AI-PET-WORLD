"""Real V2 network/Trainer, synthetic 16x16 CPU data; not model qualification."""
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parents[2]
for directory in (TESTS, TESTS.parent / "scripts", TESTS.parent / "src"):
    sys.path.insert(0, str(directory))

import torch
from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.complete_world.split_release import digest
from ai_painter.complete_world.split_training import state_hash
import stage4_split_smoke_checkpoint as checkpoint
import train_ai_assisted_conditional_denoiser as trainer
from test_stage4_split_smoke import SyntheticDataset
from test_stage4_semantic_transport_v2_trainer_support import _config


def setup_model():
    torch.manual_seed(20263722)
    config = _config()
    config["training"].update(batchSize=1, fixedValidationTimesteps=[0, 250, 500, 750])
    return config, build_complete_world_system(config)


def fixed_probe(model):
    model.eval()
    before = state_hash(model.state_dict())
    conditions = SyntheticDataset("validation")[0]["conditions"].unsqueeze(0)
    latent = torch.randn(1, 12, 4, 4, generator=torch.Generator().manual_seed(61))
    with torch.no_grad():
        prediction = model.predict_velocity(latent, torch.tensor([250]), conditions)
        rgb = model.decode_stage4_semantic_responsibility_rgb(prediction, conditions)
    if before != state_hash(model.state_dict()):
        raise ValueError("fixed probe mutated model")
    return {"predictionSha256": state_hash(prediction), "rgbSha256": state_hash(rgb),
            "rgbShape": list(rgb.shape), "conditionSha256": state_hash(conditions)}


def reload_worker(request_path):
    torch.set_num_threads(1)
    request = json.loads(Path(request_path).read_text(encoding="utf-8"))
    config, model = setup_model()
    result = checkpoint.reload_cpu_checkpoint(root=ROOT, checkpoint=request["checkpoint"],
        expected_identity=request["identity"], model=model, config=config)
    return {"pid": os.getpid(), "probe": fixed_probe(model),
            "denoiserStateSha256": result["denoiserStateSha256"],
            "optimizerSteps": result["optimizerSteps"], "trainingAllowed": result["trainingAllowed"]}


class RealCheckpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)
        base = ROOT / ".runtime/ai-painter/split-smoke-checkpoint-cpu-tests"
        base.mkdir(parents=True, exist_ok=True)
        cls.output = Path(tempfile.mkdtemp(prefix="run-", dir=base))
        cls.logical = ".runtime/ai-painter/split-smoke-checkpoint-cpu-tests/" + cls.output.name
        cls.config, cls.model = setup_model()
        cls.kwargs = dict(model=cls.model,
            optimizer=torch.optim.AdamW(cls.model.denoiser.parameters(), lr=0.0001),
            train_dataset=SyntheticDataset("train"), validation_dataset=SyntheticDataset("validation"),
            train_sample_ids=["train-a"], validation_sample_ids=["validation-a"],
            diffusion=trainer.build_diffusion_schedule(cls.config, torch.device("cpu")),
            latent_normalization={"mean": torch.zeros(1, 12, 1, 1), "standardDeviation": torch.ones(1, 12, 1, 1)},
            device=torch.device("cpu"), config=cls.config, epoch_index=0, seed=20263722)
        cls.initial = state_hash(cls.model.denoiser.state_dict())
        cls.result = checkpoint.run_cpu_checkpoint_step(root=ROOT,
            checkpoint_path=cls.logical + "/checkpoint.pt",
            run_id=getattr(cls, "run_id_override", "cpu-real-v2-" + cls.output.name),
            capability_version="cpu-real-v2-component-test", **cls.kwargs)
        cls.probe = fixed_probe(cls.model)
        with (cls.output / "training-receipt.json").open("x", encoding="utf-8") as stream:
            json.dump({**cls.result, "pid": os.getpid(), "probe": cls.probe}, stream, indent=2)

    @classmethod
    def tearDownClass(cls):
        torch.set_num_threads(cls.previous_threads)

    def reload(self, **overrides):
        config, model = setup_model()
        kwargs = dict(root=ROOT, checkpoint=self.result["checkpoint"],
                      expected_identity=self.result["identity"], model=model, config=config)
        return checkpoint.reload_cpu_checkpoint(**{**kwargs, **overrides})

    def test_real_step_and_fresh_process_reproduce_prediction_and_rgb(self):
        self.assertNotEqual(self.initial, self.result["denoiserStateSha256"])
        self.assertEqual(self.result["epochEvidence"]["stepEvidence"]["optimizerSteps"], 1)
        self.assertEqual(self.kwargs["train_dataset"].accessed, ["train-a"])
        self.assertEqual(self.kwargs["validation_dataset"].accessed, ["validation-a"])
        child = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--reload-probe",
            str(self.output / "training-receipt.json")], check=True, capture_output=True, text=True,
            timeout=60, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            env={**os.environ, "CUDA_VISIBLE_DEVICES": ""})
        result = json.loads(child.stdout)
        self.assertNotEqual(result["pid"], os.getpid())
        self.assertEqual(result["probe"], self.probe)
        self.assertEqual(result["denoiserStateSha256"], self.result["denoiserStateSha256"])
        self.assertEqual(result["optimizerSteps"], 0)
        self.assertFalse(result["trainingAllowed"])
        with (self.output / "reload-receipt.json").open("x", encoding="utf-8") as stream:
            json.dump(result, stream, indent=2)

    def test_identity_substitution_is_refused(self):
        for key in ("runId", "capabilityVersion", "datasetReleaseIdentity", "configSha256", "seed", "epoch", "selections"):
            with self.subTest(key=key):
                expected = deepcopy(self.result["identity"])
                expected[key] = "wrong"
                with self.assertRaisesRegex(ValueError, "execution identity"):
                    self.reload(expected_identity=expected)

    def test_wrong_hash_fails_before_deserialization(self):
        with patch.object(torch, "load") as load, self.assertRaisesRegex(ValueError, "byte hash"):
            self.reload(checkpoint={**self.result["checkpoint"], "sha256": "0" * 64})
        load.assert_not_called()

    def test_foundation_mismatch_does_not_load_denoiser(self):
        _, model = setup_model()
        with torch.no_grad():
            next(model.autoencoder.parameters()).add_(1)
        before = state_hash(model.denoiser.state_dict())
        with self.assertRaisesRegex(ValueError, "foundation mismatch"):
            self.reload(model=model)
        self.assertEqual(before, state_hash(model.denoiser.state_dict()))

    def test_config_mismatch_does_not_load_denoiser(self):
        config, model = setup_model()
        before = state_hash(model.denoiser.state_dict())
        config["inferenceSteps"] += 1
        with self.assertRaisesRegex(ValueError, "config mismatch"):
            self.reload(config=config, model=model)
        self.assertEqual(before, state_hash(model.denoiser.state_dict()))

    def test_existing_output_refuses_before_optimizer(self):
        before = state_hash(self.model.state_dict())
        with patch.object(checkpoint, "run_split_smoke_epoch") as train, self.assertRaises(FileExistsError):
            checkpoint.run_cpu_checkpoint_step(root=ROOT, checkpoint_path=self.logical + "/checkpoint.pt",
                run_id="duplicate", capability_version="cpu-real-v2-component-test", **self.kwargs)
        train.assert_not_called()
        self.assertEqual(before, state_hash(self.model.state_dict()))

    def test_non_cpu_request_refuses_before_optimizer(self):
        with patch.object(checkpoint, "run_split_smoke_epoch") as train, self.assertRaisesRegex(ValueError, "CPU execution"):
            checkpoint.run_cpu_checkpoint_step(root=ROOT, checkpoint_path=self.logical + "/no-gpu.pt",
                run_id="gpu-refused", capability_version="cpu-real-v2-component-test",
                **{**self.kwargs, "device": "cuda"})
        train.assert_not_called()
        self.assertFalse((self.output / "no-gpu.pt").exists())

    def test_invalid_namespace_refuses_before_optimizer(self):
        with patch.object(checkpoint, "run_split_smoke_epoch") as train, self.assertRaisesRegex(ValueError, "namespace"):
            checkpoint.run_cpu_checkpoint_step(root=ROOT, checkpoint_path="data/not-a-checkpoint.pt",
                run_id="path-refused", capability_version="cpu-real-v2-component-test", **self.kwargs)
        train.assert_not_called()

    def test_failed_epoch_reservation_is_retained_and_not_replayed(self):
        logical = self.logical + "/failed-epoch.pt"
        arguments = dict(root=ROOT, checkpoint_path=logical, run_id="failed-epoch",
                         capability_version="cpu-real-v2-component-test", **self.kwargs)
        with patch.object(checkpoint, "run_split_smoke_epoch", side_effect=ValueError("injected failure")), \
                self.assertRaisesRegex(ValueError, "injected failure"):
            checkpoint.run_cpu_checkpoint_step(**arguments)
        self.assertTrue((self.output / "failed-epoch.pt").exists())
        with patch.object(checkpoint, "run_split_smoke_epoch") as train, self.assertRaises(FileExistsError):
            checkpoint.run_cpu_checkpoint_step(**arguments)
        train.assert_not_called()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--reload-probe":
        print(json.dumps(reload_worker(sys.argv[2])))
    elif len(sys.argv) > 1 and sys.argv[1] == "--train-checkpoint":
        # Synthetic-only worker for the real JS lifecycle integration regression.
        RealCheckpointTests.run_id_override = sys.argv[2]
        RealCheckpointTests.setUpClass()
        print(json.dumps({"receiptPath": str(RealCheckpointTests.output / "training-receipt.json"),
                          "checkpoint": RealCheckpointTests.result["checkpoint"]}))
        RealCheckpointTests.tearDownClass()
    else:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(RealCheckpointTests)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        if hasattr(RealCheckpointTests, "output"):
            paths = [Path(__file__), Path(checkpoint.__file__),
                     TESTS.parent / "scripts/stage4_split_isolated_smoke.py",
                     Path(trainer.__file__), TESTS / "test_stage4_split_smoke.py",
                     TESTS / "test_stage4_semantic_transport_v2_trainer_support.py",
                     TESTS.parent / "src/ai_painter/complete_world/model.py",
                     TESTS.parent / "src/ai_painter/complete_world/stage4_semantic_transport_v2.py",
                     TESTS.parent / "src/ai_painter/complete_world/split_training.py",
                     TESTS.parent / "scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py"]
            report = {"status": "passed" if result.wasSuccessful() else "failed",
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
                "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
                "sourceBindings": [{"path": p.relative_to(ROOT).as_posix(), "sha256": digest(p.read_bytes())} for p in paths],
                "scope": "real_v2_model_and_trainer_synthetic_16x16_cpu_only",
                "productionAdapterRegistered": False, "gpuStarted": False,
                "realDatasetConsumed": False, "formalQualificationGranted": False}
            with (RealCheckpointTests.output / "report.json").open("x", encoding="utf-8") as stream:
                json.dump(report, stream, indent=2)
            print("Evidence: " + str(RealCheckpointTests.output / "report.json"))
        sys.exit(0 if result.wasSuccessful() else 1)
