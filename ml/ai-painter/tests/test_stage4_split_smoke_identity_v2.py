"""CPU identity tests; no model, optimizer, decoded images or dispatch."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import stage4_split_isolated_smoke as smoke


class SplitSmokeIdentityV2Tests(unittest.TestCase):
    def test_exact_graph_validates_current_programs_without_changing_parent(self):
        parent = smoke.bound_json(ROOT, smoke.PARENT)
        before = deepcopy(parent)
        graph = smoke.verify_compiler_lineage(ROOT, smoke.COMPILER_LINEAGE, parent)
        self.assertEqual(parent, before)
        self.assertEqual(len(graph["effectiveProgramBindings"]), 19)
        self.assertTrue(all(value is False for value in graph["qualification"].values()))

    def test_caller_rebound_graph_is_refused(self):
        parent = smoke.bound_json(ROOT, smoke.PARENT)
        for binding in ({**smoke.COMPILER_LINEAGE, "sha256": "0" * 64},
                        {**smoke.COMPILER_LINEAGE, "path": "latest.json"}, None):
            with self.subTest(binding=binding), self.assertRaisesRegex(ValueError, "unsupported compiler lineage"):
                smoke.verify_compiler_lineage(ROOT, binding, parent)

    def test_actual_dependency_bytes_are_checked(self):
        parent = smoke.bound_json(ROOT, smoke.PARENT)
        original = smoke.read_bound
        def corrupt(root, binding):
            if binding["path"].endswith("current-world-condition-raster.mjs"):
                raise ValueError("injected raster byte mismatch")
            return original(root, binding)
        with patch.object(smoke, "read_bound", side_effect=corrupt), self.assertRaisesRegex(ValueError, "raster byte mismatch"):
            smoke.verify_compiler_lineage(ROOT, smoke.COMPILER_LINEAGE, parent)

    def test_schema_and_graph_cannot_be_mixed(self):
        for contract in ({"schemaVersion": smoke.SCHEMA_V2},
                         {"schemaVersion": smoke.SCHEMA, "compilerLineage": smoke.COMPILER_LINEAGE},
                         {"schemaVersion": "unknown"}):
            with self.subTest(contract=contract), patch.object(smoke, "bound_json", return_value=contract), \
                    self.assertRaisesRegex(ValueError, "schema"):
                smoke.verify_inactive_contract(ROOT, {})

    def test_legacy_builder_keeps_its_original_compiler_guard(self):
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch: scripts/compile-current-world-visual-conditions.mjs"):
            smoke.build_inactive_contract(ROOT, {}, "train", "validation")


if __name__ == "__main__":
    unittest.main()
