"""Train-mode V26 objective/gradient evidence; no optimizer or GPU entry."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v24_object_head_core_priority_probe as profile  # noqa: E402
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (  # noqa: E402
    build_fresh_object_feature_aggregation_v26_v2_cpu,
)
from ai_painter.complete_world.object_feature_aggregation_v26_v2_probe import (  # noqa: E402
    train_mode_zero_update_probe,
)


class ObjectHeadTrainDropoutV26IntegrationCpuTests(unittest.TestCase):
    def test_bound_train_objective_reaches_all_heads_in_train_mode(self):
        torch.set_num_threads(2)
        self.assertFalse(torch.cuda.is_initialized())
        candidate = json.loads((ROOT / "data/ai-painter/system-governance/"
                                "stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
                               .read_text(encoding="utf8"))
        reader = profile.core.cpu.BoundReader()
        manifest, order, continuous, _, _ = profile.core.cpu.select_rows(reader)
        self.assertEqual(manifest["datasetReleaseIdentity"],
                         reader.json(candidate["frozenBindings"]["datasetManifest"])
                         ["datasetReleaseIdentity"])
        self.assertEqual(manifest["splitCounts"],
                         {"train": 48, "validation": 8,
                          "challenge": 4, "regression": 4})
        source = reader.json(manifest["sourceIndex"])
        train_ids = reader.json(candidate["frozenBindings"]["trainSplit"])["sampleIds"]
        self.assertEqual(len(train_ids), 48)
        row = next(value for value in source["samples"]
                   if value["sampleId"] == train_ids[0])
        self.assertEqual(row["split"], "train")
        sample, identity = profile.core.cpu.load_sample(reader, row, order, continuous)
        self.assertEqual(sample["sampleId"], identity["sampleId"])
        self.assertEqual(sample["conditions"].shape, (23, 192, 256))
        self.assertEqual(sample["image"].shape, (3, 192, 256))
        reader.unchanged()

        torch.manual_seed(20260929)
        model = build_fresh_object_feature_aggregation_v26_v2_cpu(
            condition_channel_order=order)
        _, critic = profile.fresh_networks(order)
        model.train()
        critic.eval().requires_grad_(False)
        before = profile.core.cpu.state_hash(model)
        source_hashes = {key: profile.core.cpu.tensor_hash(sample[key])
                         for key in ("conditions", "image")}

        def forward(_kind, bound):
            self.assertTrue(model.training)
            return model(bound["conditions"][None], bound["objectInstanceTable"])

        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(17)
            first, total, _, gradients, facts = profile.generator_candidate_for_sample(
                model, critic, sample, order, forward, "training")
            torch.manual_seed(19)
            second = forward("training", sample)
        self.assertTrue(torch.equal(first, second))
        self.assertTrue(bool(torch.isfinite(first).all()))
        self.assertTrue(bool(torch.isfinite(total)))
        self.assertEqual(facts["autogradGradCalls"], 4)
        self.assertTrue(all(value > 0 for value in
                            facts["generatorGradientFacts"]["headCandidateL2"].values()))
        self.assertEqual(len(gradients), len(tuple(model.parameters())))
        self.assertTrue(all(gradient is not None and bool(torch.isfinite(gradient).all())
                            for gradient in gradients))
        self.assertEqual(before, profile.core.cpu.state_hash(model))
        self.assertEqual(source_hashes,
                         {key: profile.core.cpu.tensor_hash(sample[key])
                          for key in source_hashes})
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))
        evidence = train_mode_zero_update_probe(
            model, critic, sample, order, profile=profile,
            resource_check=lambda: None)
        self.assertTrue(evidence["passed"])
        self.assertEqual(evidence["contextIsolationRule"], "zero_private_learned_terrain_patches_keep_local_facts_v1")
        self.assertEqual(evidence["optimizerSteps"],
                         {"generator": 0, "discriminator": 0})
        self.assertEqual(evidence["initialStateSha256"],
                         evidence["finalStateSha256"])
        checks = [0]
        def fail_after_gradients():
            checks[0] += 1
            if checks[0] == 2:
                raise RuntimeError("resource guard stopped probe")
        mode_before = tuple(module.training for module in model.modules())
        with self.assertRaisesRegex(RuntimeError, "resource guard stopped probe"):
            train_mode_zero_update_probe(
                model, critic, sample, order, profile=profile,
                resource_check=fail_after_gradients)
        self.assertEqual(before, profile.core.cpu.state_hash(model))
        self.assertEqual(mode_before,
                         tuple(module.training for module in model.modules()))
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
