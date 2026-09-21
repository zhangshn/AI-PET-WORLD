from copy import deepcopy
import unittest

from verify_learning_capacity_diagnostic_shadow import REPLAY_FIELDS, verify_replay


def fixture():
    replay = {"rows": [{"targetEncodedForGeneration": False} for _ in range(6)],
        "reconstructionControls": [{}, {}], "geometry": [{}, {}], "modelStatesUnchanged": True,
        "modelStateSha256BeforeAndAfter": "a" * 64, "newRollouts": 0, "targetReconstructionCount": 2,
        "limitations": ["not qualification"]}
    source = {**deepcopy(replay), "schemaVersion": "ai-painter-layer-diagnosis-result-v1", "executionState": "completed",
        "gpuStarted": False, "trainingStarted": False, "formalQualificationAllowed": False, "optimizerSteps": 0}
    return source, replay


class DiagnosticShadowTests(unittest.TestCase):
    def test_exact_replay(self):
        self.assertEqual(verify_replay(*fixture()), list(REPLAY_FIELDS))

    def test_every_bound_replay_field_is_checked(self):
        for key in REPLAY_FIELDS:
            with self.subTest(key=key):
                source, replay = fixture()
                replay[key] = None
                with self.assertRaises(Exception):
                    verify_replay(source, replay)

    def test_missing_fields_are_not_null_success(self):
        source, replay = fixture()
        del source["geometry"]
        del replay["geometry"]
        with self.assertRaises(Exception):
            verify_replay(source, replay)

    def test_source_scope_flags_required_false(self):
        for key in ("gpuStarted", "trainingStarted", "formalQualificationAllowed"):
            for value in (True, None):
                with self.subTest(key=key, value=value):
                    source, replay = fixture()
                    source[key] = value
                    with self.assertRaises(Exception):
                        verify_replay(source, replay)

    def test_failed_or_unknown_source_is_not_replayed(self):
        for key, value in (("schemaVersion", "unknown"), ("executionState", "failed_closed"), ("optimizerSteps", 1)):
            source, replay = fixture()
            source[key] = value
            with self.assertRaises(Exception):
                verify_replay(source, replay)

    def test_equal_but_invalid_scope_still_fails(self):
        for key, value in (("modelStatesUnchanged", False), ("newRollouts", 1), ("rows", []), ("reconstructionControls", [])):
            source, replay = fixture()
            source[key] = replay[key] = value
            with self.assertRaises(Exception):
                verify_replay(source, replay)

    def test_target_cannot_enter_generation_even_when_reports_agree(self):
        source, replay = fixture()
        source["rows"][0]["targetEncodedForGeneration"] = True
        replay["rows"][0]["targetEncodedForGeneration"] = True
        with self.assertRaises(Exception):
            verify_replay(source, replay)


if __name__ == "__main__":
    unittest.main()
