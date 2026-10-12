"""Loop control tests replace all numerical operations with labelled simulations."""
import ast
from pathlib import Path
import random
import unittest

import painter_stage4_ecology_regime_failure_capture as loop


class CaptureLoopCpuTests(unittest.TestCase):
    def setUp(self):
        self.train = [{"sampleId": "synthetic-" + str(i), "split": "train"} for i in range(48)]
        self.order = tuple("synthetic-channel-" + str(i) for i in range(23))
        self.calls, self.captures, self.fresh_calls, self.optimizer_factories = [], [], [], []
        self.model, self.critic = object(), object()
        self.time = 0

    def fresh(self, order):
        self.fresh_calls.append(order)
        return self.model, self.critic

    def optimizers(self, model, critic):
        self.optimizer_factories.append((model, critic))
        return object(), object()

    def pair(self, model, critic, sample, order, go, do, counts, ledger, resource, forward):
        self.calls.append(sample["sampleId"])
        self.assertIs(model, self.model)
        self.assertIs(critic, self.critic)
        self.assertIsNone(forward)
        resource()
        counts["discriminator"] += 1
        ledger["discriminator"] += 1
        resource()
        counts["generator"] += 1
        ledger["generator"] += 1
        resource()

    def capture(self, error, **kwargs):
        self.captures.append((error, kwargs))
        return {"status": "captured", "fixtureKind": "simulated-capture-sink", "qualificationAllowed": False}

    def run_loop(self, pair=None, resource=lambda: None, capture=None, train=None):
        return loop.run_capture_loop(train=self.train if train is None else train, order=self.order,
            resource=resource, capture_sink=self.capture if capture is None else capture,
            context_for_sample=lambda sample, position: {"sampleId": None if sample is None else sample["sampleId"],
                "split": "train", "fixtureKind": "simulated-context"}, clock=lambda: self.time,
            simulation=loop.SimulationSeam(self.fresh, self.optimizers, self.pair if pair is None else pair))

    def test_600_bound_original_shuffle_and_no_trigger(self):
        receipt = self.run_loop()
        self.assertEqual(receipt["optimizerSteps"], {"generator": 600, "discriminator": 600})
        self.assertEqual(len(self.calls), 600)
        expected = []
        for epoch in range(1, 14):
            indices = list(range(48))
            random.Random(20260929 + epoch).shuffle(indices)
            expected.extend(self.train[i]["sampleId"] for i in indices)
        self.assertEqual(self.calls, expected[:600])
        self.assertEqual(receipt["completedEpochs"], 12)
        self.assertEqual(receipt["lastPosition"]["zeroBasedEpochPosition"], 23)
        self.assertEqual(receipt["captureStatus"], "capture_not_triggered")
        self.assertEqual(receipt["mode"], "simulated_cpu_component_test")
        self.assertEqual(len(self.fresh_calls), 1)
        self.assertEqual(len(self.optimizer_factories), 1)
        self.assertEqual(self.captures, [])
        for key in ("checkpointSelectionExecuted", "validationRgbRead", "challengeContentRead", "regressionContentRead",
                    "formalStage4QualificationAllowed", "runtimePublicationAllowed", "productionExecutionAuthenticated"):
            self.assertFalse(receipt[key])
        self.assertEqual(receipt["automaticRetries"], 0)

    def test_first_failure_preserves_599_g_600_d_and_same_exception(self):
        primary = RuntimeError("synthetic G gate failure")
        def pair(*args):
            counts, ledger = args[6:8]
            if counts["generator"] == 599:
                self.calls.append(args[2]["sampleId"])
                counts["discriminator"] += 1
                ledger["discriminator"] += 1
                raise primary
            self.pair(*args)
        with self.assertRaises(RuntimeError) as caught:
            self.run_loop(pair=pair)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 599, "discriminator": 600})
        self.assertEqual(primary.completed_epochs, 12)
        self.assertEqual(primary.failure_position["epoch"], 13)
        self.assertEqual(primary.failure_position["zeroBasedEpochPosition"], 23)
        self.assertEqual(len(self.calls), 600)
        self.assertEqual(len(self.captures), 1)
        self.assertIs(self.captures[0][0], primary)
        self.assertEqual(self.captures[0][1]["context"]["optimizerSteps"], primary.actual_optimizer_counts)
        self.assertEqual(primary.ecology_failure_capture_receipt["status"], "captured")

    def test_secondary_capture_failure_does_not_replace_original(self):
        primary = RuntimeError("synthetic primary")
        def pair(*args):
            args[6]["discriminator"] = 1
            args[7]["discriminator"] = 1
            raise primary
        def sink(*args, **kwargs):
            raise OSError("synthetic capture IO failure")
        with self.assertRaises(RuntimeError) as caught:
            self.run_loop(pair=pair, capture=sink)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        receipt = primary.ecology_failure_capture_receipt
        self.assertEqual(receipt["status"], "capture_incomplete")
        self.assertEqual(receipt["primaryError"]["message"], "synthetic primary")
        self.assertEqual(receipt["secondaryCaptureFailure"]["type"], "OSError")

    def test_exception_rejecting_attributes_is_still_the_primary(self):
        class RefusesAttributes(RuntimeError):
            def __setattr__(self, name, value):
                raise OSError("synthetic attribute refusal")
        primary = RefusesAttributes("synthetic original")
        def pair(*args):
            raise primary
        with self.assertRaises(RefusesAttributes) as caught:
            self.run_loop(pair=pair)
        self.assertIs(caught.exception, primary)
        self.assertEqual(len(self.captures), 1)

    def test_wall_deadline_after_d_preserves_partial_counts_and_stops(self):
        def pair(*args):
            args[6]["discriminator"] += 1
            args[7]["discriminator"] += 1
            self.time = 2700
            args[8]()
            self.fail("deadline must stop before simulated G")
        with self.assertRaises(ValueError) as caught:
            self.run_loop(pair=pair)
        self.assertIn("wall deadline", str(caught.exception))
        self.assertEqual(caught.exception.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual(len(self.captures), 1)

    def test_resource_stop_before_factory_does_no_work_or_retry(self):
        primary = OSError("synthetic resource boundary")
        def resource():
            raise primary
        with self.assertRaises(OSError) as caught:
            self.run_loop(resource=resource)
        self.assertIs(caught.exception, primary)
        self.assertEqual(self.fresh_calls, [])
        self.assertEqual(self.optimizer_factories, [])
        self.assertEqual(self.calls, [])
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 0})
        self.assertIsNone(primary.failure_position)

    def test_wrong_train_count_split_duplicate_and_invalid_ledger_rejected(self):
        for train in (self.train[:-1], [*self.train[:-1], self.train[0]],
                      [{**row, "split": "validation"} for row in self.train]):
            with self.subTest(train=len(train)), self.assertRaises(ValueError):
                self.run_loop(train=train)
        self.assertEqual(self.fresh_calls, [])
        def pair(*args):
            args[6].update(generator=1, discriminator=1)
        with self.assertRaises(ValueError) as caught:
            self.run_loop(pair=pair)
        self.assertIn("ledger", str(caught.exception))
        self.assertEqual(len(self.captures), 1)

    def test_numerical_branch_statically_uses_original_profile_and_fresh_factory(self):
        source = Path(loop.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        assignments = [ast.unparse(n.value) for n in ast.walk(tree) if isinstance(n, ast.Assign)]
        self.assertIn("profile.perform_pair", assignments)
        self.assertIn("profile.fresh_networks(order)", assignments)
        self.assertIn("torch.optim.AdamW(model.parameters(), **args)", " ".join(assignments))
        self.assertIn("foreach=False", source)
        self.assertIn("fused=False", source)
        self.assertIn("torch.cuda.is_initialized()", source)
        self.assertFalse(any(isinstance(n, ast.If) and ast.unparse(n.test).startswith("__name__") for n in ast.walk(tree)))

    def test_initial_and_progress_observers_preserve_counts_and_order(self):
        initialized, progress = [], []
        result = loop.run_capture_loop(train=self.train, order=self.order, resource=lambda: None,
            capture_sink=self.capture, context_for_sample=lambda *args: {}, clock=lambda: 0,
            simulation=loop.SimulationSeam(self.fresh, self.optimizers, self.pair),
            initial_observer=lambda model, critic: initialized.append((model, critic, len(self.optimizer_factories))),
            progress_observer=lambda value: progress.append(value))
        self.assertEqual(initialized, [(self.model, self.critic, 0)])
        self.assertEqual(len(progress), 600)
        self.assertEqual([v["optimizerSteps"]["generator"] for v in progress], list(range(1, 601)))
        self.assertEqual(progress[-1]["position"], result["lastPosition"])
        self.assertEqual(progress[47]["completedEpochs"], 1)


if __name__ == "__main__":
    unittest.main()
