"""Real lifecycle wiring with inert pairs; forbids real forwards/VJP/optimizers."""
import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/tests")]
import test_decode1_entry_weight_quality_adapters_cpu_v1 as fixtures
from painter_stage4_decode1_entry_weight_lifecycle_v1 import LearningObservations


class IntegrationTests(unittest.TestCase):
    def exercise(self, *, failure=False):
        recorded = []
        observer = LearningObservations(run_id="fixture", write_record=lambda i, v: recorded.append(v) or {"index": i})
        original_loop = fixtures.lifecycle.training_loop

        def run(**kwargs):
            pair = kwargs["pair_runner"]
            def returned_pair(*args, **options):
                pair(*args, **options)
                return {"generatorLoss": .5, "discriminatorLoss": .3, "fiveGradientFacts": {
                    "scalarValues": {"actualTotal": .5, "objectSupportStructure": .05},
                    "generatorGradientFacts": {"allFinite": True, "tensorCount": 108, "nonzeroTensorCount": 100}}}
            kwargs.update(pair_runner=returned_pair, learning_sink=observer.observe)
            return original_loop(**kwargs)

        with patch.object(fixtures.lifecycle, "training_loop", side_effect=run):
            outcome, trace = fixtures.LifecycleTests().exercise(fail_pair=failure)
        return outcome, trace, observer.finish(), recorded

    def test_real_schedule_keeps1152_updates_two_validations_and_one_checkpoint(self):
        outcome, trace, manifest, records = self.exercise()
        self.assertEqual(outcome["optimizerSteps"], {"generator": 1152, "discriminator": 1152})
        self.assertEqual(trace["validations"], [12, 24])
        self.assertEqual(len(trace["checkpoints"]), 1)
        self.assertEqual(len(records), 120)
        self.assertEqual(manifest["status"], "recorded")
        self.assertEqual(manifest["successfulPairCount"], 1152)
        self.assertEqual(manifest["existingGeneratorGradientAllFiniteCounts"], {"true": 1152, "false": 0, "unknown": 0})
        self.assertEqual(manifest["completedEpochs"][0]["values"]["generatorLoss"]["count"], 48)
        self.assertEqual(manifest["completedEpochs"][0]["values"]["generatorLoss"]["mean"], .5)

    def test_partial_D_failure_never_logged_as_a_complete_pair(self):
        outcome, trace, manifest, records = self.exercise(failure=True)
        self.assertEqual(outcome["optimizerSteps"], {"generator": 607, "discriminator": 608})
        self.assertEqual(manifest["successfulPairCount"], 607)
        self.assertEqual(len(manifest["completedEpochs"]), 12)
        self.assertEqual(trace["pairs"], 608)
        self.assertTrue(all(r["optimizerSteps"]["generator"] == r["optimizerSteps"]["discriminator"] for r in records))

    def test_manifest_failure_is_explicit_and_does_not_replay_updates(self):
        observer = LearningObservations(run_id="fixture", write_record=lambda i, v: {})
        context = SimpleNamespace(reader=SimpleNamespace(root=ROOT), plan={"outputRoot": "private/fixture"})
        with patch.object(fixtures.worker, "write", side_effect=OSError("private fixture storage failure")):
            result = fixtures.worker.finish_learning_observations(context, observer)
        self.assertEqual(result["status"], "manifest_write_failed")
        self.assertIsNone(result["manifest"])
        self.assertEqual(result["successfulPairCount"], 0)


if __name__ == "__main__":
    unittest.main()
