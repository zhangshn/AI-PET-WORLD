"""CPU tests of the bounded decoder-only experiment, never a GPU grant."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from painter_decoder_reconstruction_experiment import (
    CHECKPOINT_SCHEMA, CONTROLLER, POLICY, SAMPLES, TRAINING, RESOURCES,
    decoder_parameters, historical_inputs, materialize, validate_checkpoint, validate_policy,
)


class DecoderReconstructionTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / POLICY).read_text(encoding="utf-8"))

    def test_exact_policy_is_accepted(self):
        validate_policy(self.policy)
        self.assertEqual(TRAINING["epochs"] * len(SAMPLES), 1000)
        self.assertEqual(TRAINING["observationSteps"], [0, 100, 400, 1000])

    def test_training_scope_and_budget_cannot_expand(self):
        changes = {"epochs": 501, "batchSize": 2, "seed": 1, "learningRate": 0.001,
            "weightDecay": 0, "encoderFrozen": False, "denoiserParticipates": True,
            "updateScope": "autoencoder_all", "lossWeights": {"pixel": 1},
            "checkpointRule": "best", "observationSteps": [1000]}
        for key, value in changes.items():
            policy = deepcopy(self.policy)
            policy["training"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_policy(policy)

    def test_all_resource_overrides_are_refused(self):
        for key, value in RESOURCES.items():
            policy = deepcopy(self.policy)
            policy["resources"][key] = value + 1
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_policy(policy)

    def test_formal_qualification_or_prohibited_action_cannot_be_enabled(self):
        for section in ("qualification", "prohibited"):
            for key in self.policy[section]:
                policy = deepcopy(self.policy)
                policy[section][key] = not policy[section][key]
                with self.subTest(section=section, key=key), self.assertRaises(ValueError):
                    validate_policy(policy)

    def test_other_samples_resolution_and_root_are_refused(self):
        for key, value in (("sampleIds", ["validation-image", SAMPLES[1]]), ("resolution", [512, 384]),
                           ("outputRoot", ".runtime"), ("scope", "formal_training")):
            policy = deepcopy(self.policy)
            policy[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_policy(policy)

    def snapshot_fixture(self, root):
        content = b"historical controller\n"
        sha = hashlib.sha256(content).hexdigest()
        relative = f".runtime/ai-painter/learning-capacity-experiments/source-snapshots/{sha}/run-ai-painter-learning-capacity-experiment.mjs"
        target = root / relative
        target.parent.mkdir(parents=True)
        target.write_bytes(content)
        data = root / "sample.bin"
        data.write_bytes(b"train source")
        receipt = {"path": "sample.bin", "sha256": hashlib.sha256(data.read_bytes()).hexdigest()}
        source = {"inputReceipts": [{"path": CONTROLLER, "sha256": sha}, receipt]}
        snapshot = {"originalPath": CONTROLLER, "path": relative, "sha256": sha}
        return source, snapshot, data

    def test_only_exact_archived_controller_can_replace_current_controller_binding(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, snapshot, _ = self.snapshot_fixture(root)
            receipts = historical_inputs(root, source, snapshot)
            self.assertEqual(receipts[0]["sha256"], source["inputReceipts"][0]["sha256"])
            self.assertEqual(receipts[0]["path"], snapshot["path"])
            for key, value in (("originalPath", "sample.bin"), ("sha256", "0" * 64), ("path", "sample.bin")):
                invalid = dict(snapshot, **{key: value})
                with self.subTest(key=key), self.assertRaises(ValueError):
                    historical_inputs(root, source, invalid)

    def test_controller_snapshot_does_not_hide_data_tampering(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, snapshot, data = self.snapshot_fixture(root)
            data.write_bytes(b"changed train source")
            with self.assertRaises(ValueError):
                historical_inputs(root, source, snapshot)

    def test_controller_snapshot_tampering_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, snapshot, _ = self.snapshot_fixture(root)
            (root / snapshot["path"]).write_bytes(b"changed old controller")
            with self.assertRaises(ValueError):
                historical_inputs(root, source, snapshot)

    def test_decoder_only_parameters_keep_encoder_gradient_and_state_frozen(self):
        import torch
        from ai_painter.complete_world.split_training import state_hash
        ae = torch.nn.Module()
        ae.encoder = torch.nn.Linear(3, 4)
        ae.decoder = torch.nn.Linear(4, 3)
        params = decoder_parameters(ae)
        self.assertEqual({id(p) for p in params}, {id(p) for p in ae.decoder.parameters()})
        before_encoder, before_decoder = state_hash(ae.encoder.state_dict()), state_hash(ae.decoder.state_dict())
        with torch.no_grad():
            latent = ae.encoder(torch.ones(1, 3)).detach()
        optimizer = torch.optim.AdamW(params, lr=TRAINING["learningRate"])
        ae.decoder(latent).square().mean().backward()
        self.assertTrue(all(p.grad is None and not p.requires_grad for p in ae.encoder.parameters()))
        optimizer.step()
        self.assertEqual(before_encoder, state_hash(ae.encoder.state_dict()))
        self.assertNotEqual(before_decoder, state_hash(ae.decoder.state_dict()))
        self.assertFalse(torch.cuda.is_initialized())

    def checkpoint_fixture(self):
        package = {"experimentIdentity": "test-experiment", "foundation": {"sha256": "1" * 64}, "config": {}}
        checkpoint = {"schemaVersion": CHECKPOINT_SCHEMA, "experimentIdentity": "test-experiment",
            "optimizerSteps": 1000, "selectedSampleIds": SAMPLES, "encoderFrozen": True,
            "updateScope": "autoencoder.decoder_only", "checkpointPromotable": False,
            "formalInferenceEligible": False, "usableAsReleasedFoundation": False,
            "foundation": package["foundation"], "config": {}}
        return package, checkpoint

    def test_checkpoint_cannot_claim_release_or_full_model_training(self):
        package, checkpoint = self.checkpoint_fixture()
        validate_checkpoint(checkpoint, package)
        for key, value in (("schemaVersion", "formal"), ("experimentIdentity", "other"), ("optimizerSteps", 1001),
                           ("selectedSampleIds", ["challenge"]), ("encoderFrozen", False),
                           ("updateScope", "all"), ("checkpointPromotable", True), ("formalInferenceEligible", True),
                           ("usableAsReleasedFoundation", True), ("denoiserState", {}), ("optimizerState", {}),
                           ("foundation", {}), ("config", {"changed": True})):
            invalid = deepcopy(checkpoint)
            invalid[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_checkpoint(invalid, package)

    def test_reconstruction_objective_matches_original_config(self):
        import torch
        from train_ai_assisted_complete_world import reconstruction_loss, image_edge_loss, image_laplacian_loss
        target = torch.linspace(0, 1, 3 * 8 * 8).reshape(1, 3, 8, 8)
        actual = target.flip(-1).clone().requires_grad_(True)
        expected = (actual - target).abs().mean() + 0.75 * image_edge_loss(actual, target) + 0.25 * image_laplacian_loss(actual, target)
        loss = reconstruction_loss(actual, target, TRAINING["lossWeights"])
        torch.testing.assert_close(loss, expected, rtol=0, atol=0)
        loss.backward()
        self.assertTrue(bool(torch.isfinite(actual.grad).all()))

    def test_materialization_is_deterministic_and_does_not_create_a_run(self):
        first, second = materialize(ROOT), materialize(ROOT)
        self.assertEqual(first, second)
        self.assertEqual([r["sampleId"] for r in first["selectedRows"]], SAMPLES)
        self.assertTrue(all(r["split"] == "train" for r in first["selectedRows"]))
        self.assertFalse(first["qualification"]["usableAsReleasedFoundation"])
        # Materialization reads exact existing inputs and returns a package only.
        import torch
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
