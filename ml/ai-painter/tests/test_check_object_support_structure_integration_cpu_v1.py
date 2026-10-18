"""CPU checker input boundaries only; never run its real-model operation."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).absolute().parents[3]
SPEC = importlib.util.spec_from_file_location("support_integration_check_inputs",
    ROOT / "ml/ai-painter/scripts/check_object_support_structure_integration_cpu_v1.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


def request():
    bind = lambda name: {"path": name, "sha256": "a" * 64}
    return {"schemaVersion": "object-support-integration-cpu-request-v1", "candidateId": checker.CANDIDATE,
        "policy": bind(checker.POLICY_PATH), "dataPlan": bind(".runtime/exact-data-plan.json"),
        "programBindings": {"self": bind(checker.SELF)}, "selectedSampleId": "fixed-train",
        "outputRoot": checker.OUTPUT,
        "registryBefore": bind(".runtime/ai-painter/current-execution-registry/current.json"),
        "interpreter": {"path": str((ROOT / "ml/ai-painter/.venv/Scripts/python.exe").absolute()), "sha256": "b"*64}}


class CpuCheckBoundaryTests(unittest.TestCase):
    def test_exact_request_accepted_without_execution(self):
        value = request()
        self.assertIs(checker.validate_request(value), value)

    def test_identity_and_output_cannot_be_redirected(self):
        for key in ("schemaVersion", "candidateId", "outputRoot"):
            value = request(); value[key] = "different"
            with self.subTest(key=key), self.assertRaises(ValueError): checker.validate_request(value)

    def test_extra_missing_and_nonobject_requests_rejected(self):
        for value in (None, [], {**request(), "train": True}, {k:v for k,v in request().items() if k != "policy"}):
            with self.assertRaises(ValueError): checker.validate_request(value)

    def test_binding_sha_and_path_validation(self):
        for key in ("policy", "dataPlan", "registryBefore"):
            for field, bad in (("sha256", "a"*63), ("sha256", "A"*64), ("path", "../escape.json"),
                    ("path", "F:/escape.json"), ("path", "/escape.json"), ("path", "a\\b")):
                value = request(); value[key][field] = bad
                with self.subTest(key=key, field=field, bad=bad), self.assertRaises(ValueError):
                    checker.validate_request(value)

    def test_policy_registry_and_self_are_fixed(self):
        for key in ("policy", "registryBefore"):
            value = request(); value[key]["path"] = "other.json"
            with self.assertRaises(ValueError): checker.validate_request(value)
        value = request(); value["programBindings"]["self"]["path"] = "other.py"
        with self.assertRaises(ValueError): checker.validate_request(value)

    def test_program_count_conflicting_aliases_and_invalid_carriers_rejected(self):
        for entries in ({}, {str(i): {"path": f"x/{i}.py", "sha256": "a"*64} for i in range(257)},
                {"self": request()["programBindings"]["self"], "alias": {"path": checker.SELF, "sha256": "b"*64}},
                {"self": None}):
            value = request(); value["programBindings"] = entries
            with self.assertRaises(ValueError): checker.validate_request(value)

    def test_same_source_and_hash_can_legitimately_have_multiple_roles(self):
        value = request()
        value["programBindings"]["sameSourceDifferentRole"] = deepcopy(value["programBindings"]["self"])
        self.assertIs(checker.validate_request(value), value)

    def test_empty_train_id_or_relative_interpreter_rejected(self):
        value = request(); value["selectedSampleId"] = ""
        with self.assertRaises(ValueError): checker.validate_request(value)
        value = request(); value["interpreter"]["path"] = "python.exe"
        with self.assertRaises(ValueError): checker.validate_request(value)

    def test_only_explicit_image_paths_are_readable(self):
        checker.guard_image_read("metadata.json", set())
        checker.guard_image_read("chosen.png", {"chosen.png"})
        for name in ("validation.png", "x.JPG", "challenge.webp", "regression.tiff"):
            with self.assertRaises(ValueError): checker.guard_image_read(name, {"chosen.png"})

    def test_nonfinite_evidence_serialization_is_rejected(self):
        with self.assertRaises(ValueError): checker.json_bytes({"value": float("nan")})
        self.assertEqual(json.loads(checker.json_bytes({"ok": True})), {"ok": True})

    def test_machine_policy_limits_remain_cpu_only(self):
        policy = json.loads((ROOT / checker.POLICY_PATH).read_text(encoding="utf-8"))
        self.assertEqual(policy["candidateId"], checker.CANDIDATE)
        self.assertEqual(policy["gradientProtocol"]["generatorAutogradCalls"], 5)
        self.assertEqual((policy["gradientProtocol"]["atol"], policy["gradientProtocol"]["rtol"]), (1e-6, 1e-5))
        self.assertEqual(policy["resources"]["cpuThreads"], 2)
        self.assertEqual(policy["resources"]["managedTransportMaxWallSeconds"], 180)
        self.assertEqual(policy["resources"]["attempts"], 1)
        self.assertEqual(policy["resources"]["automaticRetries"], 0)
        for key in ("optimizerConstruction", "weightUpdates", "cudaInitialization", "checkpointOrImageOutput",
                "productionEntryRouting", "currentExecutionRegistryWrite", "gpuQualificationGranted", "trainingGranted"):
            self.assertFalse(policy["boundaries"][key])


if __name__ == "__main__": unittest.main()
