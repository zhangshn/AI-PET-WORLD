"""Independent CPU workorder negatives; never executes the comparison worker."""
from __future__ import annotations

from copy import deepcopy
import unittest
from unittest.mock import patch

import check_stage4_v26_deterministic_aggregation_cpu as checker

BINDING = {
    "path": ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu/deterministic-aggregation-v2/"
            "v26-assembly-v2-cpu-1a1496dd1e3c721b38de2d59/workorder.json",
    "sha256": "1ad9b4a25b69ea26524916260dc7ffeb0743885f372cbdf8b453e939d6e3a9a7",
}


class CpuSuccessorWorkorderTests(unittest.TestCase):
    def setUp(self):
        self.order = checker.read(BINDING)

    def verify_mutation(self, mutation, message):
        forged = deepcopy(self.order)
        mutation(forged)
        original_read = checker.read
        def fixture_read(binding):
            return forged if binding == BINDING else original_read(binding)
        with patch.object(checker, "read", side_effect=fixture_read):
            with self.assertRaisesRegex(ValueError, message):
                checker.check(BINDING)

    def test_unchanged_real_workorder_checks_only_cpu_inactive_scope(self):
        order, old = checker.check(BINDING)
        self.assertEqual(order["sample"], old["sample"])
        self.assertFalse(order["scope"]["gpuAllowed"])
        self.assertFalse(order["scope"]["trainingAllowed"])

    def test_wrong_workorder_hash_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "bound input changed"):
            checker.check({**BINDING, "sha256": "0" * 64})

    def test_gpu_training_retries_or_changed_model_are_rejected(self):
        for key, value in (("gpuAllowed", True), ("trainingAllowed", True),
                           ("automaticRetries", 1), ("trainRows", 48)):
            self.verify_mutation(lambda order: order["scope"].update({key: value}), "scope differs")
        self.verify_mutation(lambda order: order.update(capabilityVersion="old_v26"), "scope differs")

    def test_missing_successor_or_tampered_old_program_is_rejected(self):
        self.verify_mutation(lambda order: order["programBindings"].pop(checker.PROGRAMS[0]),
                             "roles missing or changed")
        def mutate_old(order):
            key = next(key for key in order["programBindings"] if key not in checker.PROGRAMS)
            order["programBindings"][key]["sha256"] = "0" * 64
        self.verify_mutation(mutate_old, "roles missing or changed")

    def test_validation_sample_or_registry_rebinding_is_rejected(self):
        self.verify_mutation(lambda order: order["sample"].update(split="validation"), "inputs differ")
        self.verify_mutation(lambda order: order["registry"].update(sha256="0" * 64), "inputs differ")

    def test_unrelated_output_namespace_is_rejected(self):
        self.verify_mutation(lambda order: order.update(outputDirectory=".runtime/other"),
                             "namespace differs")


if __name__ == "__main__":
    unittest.main()
