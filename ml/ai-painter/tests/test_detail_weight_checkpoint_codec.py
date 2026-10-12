"""Synthetic checkpoints stay in memory; no historical state or qualifications."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_appearance_regime_detail_weight_training_profile as profile
from test_painter_stage4_appearance_regime_probe import ORDER
from ai_painter.complete_world import detail_weight_checkpoint_codec as codec


class CheckpointCodecTests(unittest.TestCase):
    def setUp(self):
        self.model, self.critic = profile.fresh_networks(ORDER)
        self.kw = dict(run_id="synthetic-t-q4-45", dataset_identity={"version": "artificial-v1", "fixture": "memory-only"},
                       synthetic=True, training_config=codec.frozen_training_config())
        self.counts = {"generator": 1, "discriminator": 2}
        self.payload = codec.encode_checkpoint(model=self.model, critic=self.critic, counts=self.counts, **self.kw)

    def load(self, payload=None, **kw):
        return codec.decode_checkpoint(self.payload if payload is None else payload, model=self.model, critic=self.critic,
                                       expected_counts=self.counts, **{**self.kw, **kw})

    def snapshot(self):
        return [[v.detach().clone() for v in n.state_dict().values()] for n in (self.model, self.critic)]

    def unchanged(self, before):
        for network, rows in zip((self.model, self.critic), before):
            self.assertTrue(all(torch.equal(a, b) for a, b in zip(network.state_dict().values(), rows)))

    def test_cpu_safe_serialization_and_round_trip(self):
        payload = codec.deserialize_checkpoint(codec.serialize_checkpoint(self.payload))
        with torch.no_grad(): next(self.model.parameters()).add_(.25)
        result = self.load(payload)
        self.assertFalse(result["checkpointQualified"])
        self.assertTrue(result["synthetic"])
        self.assertTrue(all(torch.equal(v, payload["generator"][k]) for k, v in self.model.state_dict().items()))

    def test_all_binding_rejections_precede_writes(self):
        before = self.snapshot()
        for field, value in (("run_id", "other"), ("dataset_identity", {"version": "other"}), ("synthetic", False),
                             ("training_config", {"epochs": 49})):
            with self.assertRaises(ValueError): self.load(**{field: value})
            self.unchanged(before)
        for key, value in (("numericRule", "old"), ("schema", "diagnostic-only"), ("counts", {"generator": True, "discriminator": 2}),
                           ("graph", {}), ("capability", "old")):
            bad = {**self.payload, key: value}
            with self.assertRaises(ValueError): self.load(bad)
            self.unchanged(before)
        with self.assertRaises(ValueError): self.load({**self.payload, "verified": True})

    def test_complete_both_payloads_shape_dtype_finite_identity_preflight(self):
        before = self.snapshot()
        for group in ("generator", "discriminator"):
            first = next(k for k, v in self.payload[group].items() if v.is_floating_point())
            for kind in ("missing", "dtype", "shape", "nonfinite"):
                bad = deepcopy(self.payload)
                if kind == "missing": del bad[group][first]
                elif kind == "dtype": bad[group][first] = bad[group][first].double()
                elif kind == "shape": bad[group][first] = bad[group][first].flatten()[:1]
                else: bad[group][first].flatten()[0] = float("nan")
                with self.assertRaises(ValueError): self.load(bad)
                self.unchanged(before)
        bad = deepcopy(self.payload); bad["generator"]["numeric_identity"][0] ^= 1
        with self.assertRaises(ValueError): self.load(bad)
        self.unchanged(before)

    def test_late_critic_failure_rolls_back_generator_and_preserves_primary(self):
        with torch.no_grad(): next(self.model.parameters()).add_(.25)
        before = self.snapshot()
        def fail(*_a, **_kw):
            with torch.no_grad(): next(self.critic.parameters()).add_(.5)
            raise RuntimeError("late critic loader failure")
        with patch.object(self.critic, "load_state_dict", fail):
            with self.assertRaisesRegex(RuntimeError, "late critic loader failure"): self.load()
        self.unchanged(before)

    def changed_payload(self):
        payload = deepcopy(self.payload)
        # Change two tensors in EACH network so a one-tensor partial loader
        # cannot accidentally satisfy the complete installed-state check.
        for group in ("generator", "discriminator"):
            floating = [k for k, v in payload[group].items() if v.is_floating_point()]
            self.assertGreaterEqual(len(floating), 2)
            for name in floating[:2]: payload[group][name].add_(.25)
        return payload

    def test_noop_loaders_cannot_report_success_and_both_states_roll_back(self):
        for group, network in (("generator", self.model), ("discriminator", self.critic)):
            with self.subTest(network=group):
                payload = self.changed_payload(); before = self.snapshot()
                with patch.object(network, "load_state_dict", return_value=None) as loader:
                    with self.assertRaisesRegex(ValueError, group + " installed tensor differs"):
                        self.load(payload)
                    loader.assert_called_once()
                self.unchanged(before)

    def test_partial_loaders_cannot_report_success_and_both_states_roll_back(self):
        for group, network in (("generator", self.model), ("discriminator", self.critic)):
            with self.subTest(network=group):
                payload = self.changed_payload(); before = self.snapshot()
                def partial(state, **_kw):
                    # Perform a real destination write, return normally, and
                    # deliberately omit the second changed tensor.
                    name = next(k for k, v in state.items() if v.is_floating_point())
                    with torch.no_grad(): network.state_dict()[name].copy_(state[name])
                with patch.object(network, "load_state_dict", side_effect=partial) as loader:
                    with self.assertRaisesRegex(ValueError, group + " installed tensor differs"):
                        self.load(payload)
                    loader.assert_called_once()
                self.unchanged(before)


if __name__ == "__main__": unittest.main()
