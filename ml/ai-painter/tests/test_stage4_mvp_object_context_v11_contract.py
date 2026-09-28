"""V11 remains an inactive CPU candidate even when its bindings are valid."""

from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 as candidate


ROOT = Path(__file__).resolve().parents[3]


class V11ContractTests(unittest.TestCase):
    def test_exact_bound_contract_builds_only_inactive_cpu_candidate(self):
        contract, sha = candidate.load_contract(ROOT)
        renderer = candidate.build_renderer(ROOT)
        self.assertEqual(len(sha), 64)
        self.assertEqual(renderer.architecture_id, contract["architectureId"])
        self.assertFalse(renderer.execution_qualified)
        self.assertFalse(contract["activationGates"]["trainingNow"])
        self.assertFalse(contract["formalStage4QualificationGranted"])
        self.assertEqual(contract["trainingCurriculum"]["exactOptimizerSteps"], 48 * 24)
        self.assertTrue(all(not parameter.requires_grad for identity in renderer.support_radii
                            for parameter in renderer.core.responsibility_heads[identity].parameters()))

    def test_contract_rejects_claimed_training_activation(self):
        original, _ = candidate.load_contract(ROOT)
        changed = deepcopy(original)
        changed["activationGates"]["trainingNow"] = True
        real_read = candidate.read_json

        def substituted(path, label):
            return changed if label == "V11 contract" else real_read(path, label)

        with patch.object(candidate, "read_json", side_effect=substituted):
            with self.assertRaisesRegex(ValueError, "activation boundary"):
                candidate.load_contract(ROOT)


if __name__ == "__main__":
    unittest.main()
