"""Private small CPU fixtures; no real failure archive, full renderer or GPU."""
from copy import deepcopy
import json
import random
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
import torch

from ai_painter.complete_world import parameter60_causal_restore_v1 as restore


def network():
    return torch.nn.Sequential(torch.nn.Linear(2, 2), torch.nn.BatchNorm1d(2))


def fixture():
    source = network()
    source[0].eval()
    source[1].train()
    rows, tensors, descriptors = [], {}, {}
    for kind, named in (("parameter", source.named_parameters()), ("buffer", source.named_buffers())):
        for index, (name, value) in enumerate(named):
            key = f"generator.{kind}.{index}"
            tensor = torch.full_like(value, index + 3).detach()
            tensors[key] = tensor
            descriptors[key] = {"shape": list(tensor.shape), "dtype": str(tensor.dtype),
                "bytes": tensor.numel() * tensor.element_size(), "sha256": restore.capture.tensor_sha(tensor),
                "allFinite": True, "sourceVersion": 1016}
            rows.append({"kind": kind, "name": name, "key": key})
    return {"state": rows, "modes": {name: module.training for name, module in source.named_modules()}}, tensors, descriptors


def policy():
    return {"schemaVersion": restore.SCHEMA, "status": restore.STATUS,
        "sourceEvidence": [{"path": restore.SOURCE_ROOT + name, "sha256": sha}
                           for name, sha in restore.SOURCE_HASHES.items()],
        "sourceTensorArchive": {"path": restore.SOURCE_ROOT + "gradient-failure/tensors.pt",
            "sha256": restore.ARCHIVE_SHA, "bytes": 42252025},
        "scope": {"failureSampleId": restore.SAMPLE_ID, "sampleSplit": "train", "sampleCount": 1,
            "resolution": [256, 192], "sourceStateTiming": "after_exception", "sourceReplayAllowedRemainsFalse": True},
        "target": {"parameterIndex": 60, "parameterName": restore.TARGET_NAME,
            "modulePath": restore.TARGET_NAME.rsplit(".", 1)[0], "weightShape": [48, 48, 3, 3],
            "elements": 20736, "dtype": "torch.float32"},
        "sourceStateUse": {"purpose": "failure_evidence_cpu_diagnostic_only",
            "trainingInitializationAllowed": False, "historicalReplayAllowed": False,
            "archivedGradientsInstalled": False, "archivedRngRestored": False, "requiresGradHistoricalClaim": False},
        "resources": {"maxWallSeconds": 120, "threads": 2, "maxOutputBytes": 8388608,
            "cudaCalls": 0, "fullModelForwards": 0, "fullModelAutogradCalls": 0,
            "optimizerConstruction": 0, "optimizerUpdates": 0},
        "qualification": {"modelQualificationGranted": False, "gpuQualificationGranted": False},
        "formalSpecification": {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
            "version": "AI-PAINTER-SPEC-1.62", "sha256": "a" * 64}}


class RestoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def setUp(self):
        self.guards = []
        for owner, name in ((torch.cuda, "_lazy_init"), (torch.autograd, "grad"),
                            (torch.nn.Module, "__call__"), (torch.optim.Optimizer, "__init__")):
            guard = patch.object(owner, name, side_effect=AssertionError("forbidden model/GPU/optimizer execution"))
            guard.start()
            self.guards.append(guard)
            self.addCleanup(guard.stop)

    def test_exact_bytes_mixed_modes_new_versions_and_flags_no_old_grad(self):
        meta, tensors, descriptors = fixture()
        # JSON sorted mode keys differ from traversal order; identities still match.
        meta = json.loads(json.dumps(meta, sort_keys=True))
        destination = network()
        destination[0].weight.requires_grad_(False)
        meta["state"][0]["gradientKey"] = "historical-gradient"
        tensors["historical-gradient"] = torch.ones_like(destination[0].weight)
        before = {name: value._version for name, value in (*destination.named_parameters(), *destination.named_buffers())}
        result = restore._restore_network(destination, meta, tensors, descriptors)
        self.assertEqual(result["modes"], meta["modes"])
        self.assertFalse(result["newInstanceRequiresGrad"]["0.weight"])
        self.assertFalse(result["requiresGradHistoricalClaim"])
        self.assertFalse(result["archivedGradientsInstalled"])
        self.assertTrue(all(value.grad is None for value in destination.parameters()))
        for row in meta["state"]:
            name = row["name"]
            self.assertEqual(result["restoredByteHashes"][name], descriptors[row["key"]]["sha256"])
            self.assertEqual(result["newInstanceVersions"][name], before[name] + 1)
            self.assertNotEqual(result["newInstanceVersions"][name], 1016)

    def test_state_rejections_happen_before_copy(self):
        def mutate_case(name, change):
            meta, tensors, descriptors = fixture()
            destination = network()
            before = {k: restore.capture.tensor_sha(v.detach()) for k, v in destination.state_dict().items()}
            change(meta, tensors, descriptors)
            with self.subTest(name=name), self.assertRaises((ValueError, KeyError)):
                restore._restore_network(destination, meta, tensors, descriptors)
            self.assertEqual(before, {k: restore.capture.tensor_sha(v.detach()) for k, v in destination.state_dict().items()})
        for name, change in (
            ("missing state", lambda m, t, d: m["state"].pop()),
            ("extra state", lambda m, t, d: m["state"].append(deepcopy(m["state"][0]))),
            ("wrong name", lambda m, t, d: m["state"][0].update(name="wrong")),
            ("wrong kind", lambda m, t, d: m["state"][0].update(kind="buffer")),
            ("wrong order", lambda m, t, d: m["state"].reverse()),
            ("missing mode", lambda m, t, d: m["modes"].pop("0")),
            ("extra mode", lambda m, t, d: m["modes"].update(extra=False)),
            ("invalid mode", lambda m, t, d: m["modes"].update({"0": 1})),
            ("SHA mismatch", lambda m, t, d: d[m["state"][0]["key"]].update(sha256="0" * 64)),
            ("nonfinite metadata", lambda m, t, d: d[m["state"][0]["key"]].update(allFinite=False)),
            ("missing version", lambda m, t, d: d[m["state"][0]["key"]].pop("sourceVersion")),
            ("nonfinite bytes", lambda m, t, d: t[m["state"][0]["key"]].fill_(float("nan"))),
            ("dtype", lambda m, t, d: t.update({m["state"][0]["key"]: t[m["state"][0]["key"]].double()})),
            ("shape", lambda m, t, d: t.update({m["state"][0]["key"]: torch.zeros(1)})),
        ):
            mutate_case(name, change)

    def test_alias_and_existing_gradient_rejected(self):
        meta, tensors, descriptors = fixture()
        for name in ("alias", "gradient"):
            destination = network()
            if name == "alias":
                destination[1].weight = destination[0].bias
            else:
                destination[0].weight.grad = torch.zeros_like(destination[0].weight)
            with self.subTest(name=name), self.assertRaises(ValueError):
                restore._state_plan(destination, meta, tensors, descriptors)

    def test_safe_decoder_used_for_small_archive_without_unsafe_load(self):
        _, tensors, descriptors = fixture()
        metadata = {"archiveEncoding": "gzip-torch-flat-cpu-v1", "tensorDescriptors": descriptors,
                    "decompressedBytes": sum(v.numel() * v.element_size() for v in tensors.values())}
        raw = restore.capture.archive_bytes(tensors)
        native_load = torch.load
        def checked_load(*args, **kwargs):
            self.assertEqual(kwargs, {"weights_only": True, "map_location": "cpu"})
            return native_load(*args, **kwargs)
        with patch.object(torch, "load", side_effect=checked_load) as observed:
            loaded = restore.capture.safe_load_bytes(raw, restore.capture.digest(raw), metadata)
            self.assertEqual(set(loaded), set(tensors))
            self.assertEqual(observed.call_count, 1)
        with patch.object(torch, "load", side_effect=AssertionError("must reject before load")):
            with self.assertRaises(ValueError):
                restore.capture.safe_load_bytes(raw, "0" * 64, metadata)

    def test_current_rng_restored_after_success_and_failure(self):
        for fail in (False, True):
            before = (random.getstate(), np.random.get_state(), torch.random.get_rng_state().clone())
            try:
                with restore._preserve_current_rng():
                    random.random(); np.random.random(); torch.rand(1)
                    if fail:
                        raise ValueError("fixture failure")
            except ValueError:
                self.assertTrue(fail)
            self.assertEqual(random.getstate(), before[0])
            self.assertEqual(np.random.get_state()[0], before[1][0])
            self.assertTrue(np.array_equal(np.random.get_state()[1], before[1][1]))
            self.assertEqual(np.random.get_state()[2:], before[1][2:])
            self.assertTrue(torch.equal(torch.random.get_rng_state(), before[2]))

    def test_public_policy_does_not_accept_fixture_sample_shape_or_source(self):
        restore._validate_policy(policy())
        for field, key, value in (
            (None, "schemaVersion", "fixture-policy"), (None, "status", "gpu_ready"),
            ("scope", "failureSampleId", "fixture-train"), ("scope", "sampleSplit", "validation"),
            ("scope", "sampleCount", 2), ("target", "parameterIndex", 52),
            ("target", "weightShape", [2, 2]), ("sourceStateUse", "requiresGradHistoricalClaim", True),
            ("sourceStateUse", "historicalReplayAllowed", True), ("resources", "maxWallSeconds", 240),
            ("qualification", "modelQualificationGranted", True),
            ("formalSpecification", "version", "AI-PAINTER-SPEC-1.60"),
        ):
            value_policy = policy()
            (value_policy if field is None else value_policy[field])[key] = value
            with self.subTest(field=field, key=key), self.assertRaises(ValueError):
                restore.prepare_exact_failure_state("unused-fixture-root", value_policy)
        value_policy = policy()
        value_policy["sourceEvidence"][0]["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            restore.prepare_exact_failure_state("unused-fixture-root", value_policy)

    def test_thread_resource_failure_before_any_source_read(self):
        with patch.object(torch, "get_num_threads", return_value=3), patch.object(
                restore.capture.RuntimeMap, "current", side_effect=AssertionError("must not read sources")):
            with self.assertRaises(ValueError):
                restore.prepare_exact_failure_state("unused-fixture-root", policy())

    def test_nonexecuted_historical_entries_and_site_packages_are_not_factory_sources(self):
        for path in ("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
                     "scripts/run-old-entry.mjs", "ml/ai-painter/.venv/Lib/site-packages/torch/__init__.py",
                     "ml/ai-painter/tests/test_old.py", ".runtime/old/cpu.py"):
            self.assertFalse(restore._is_original_python_source(path))
        for path in ("ml/ai-painter/src/ai_painter/model.py", "ml/ai-painter/scripts/profile.py"):
            self.assertTrue(restore._is_original_python_source(path))

    def test_original_profile_factory_import_uses_private_bound_source_only(self):
        with tempfile.TemporaryDirectory(prefix="parameter60-restore-profile-") as root:
            project = Path(root).resolve()
            folder = project / "ml/ai-painter/scripts"
            folder.mkdir(parents=True)
            file = folder / "painter_stage4_ecology_decode1_weight_training_profile_v1.py"
            file.write_text("import torch\ndef fresh_networks(order):\n    return torch.nn.Linear(2, 2), torch.nn.Linear(2, 1)\n", encoding="utf8")
            import sys
            name = file.stem
            previous = sys.modules.pop(name, None)
            try:
                with restore._preserve_current_rng():
                    model, critic = restore._fresh_networks(project, ["fixture-channel"],
                        {str(file): restore.capture.digest(file.read_bytes())})
                self.assertTrue(all(v.device.type == "cpu" for n in (model, critic) for v in n.parameters()))
                with self.assertRaises(ValueError):
                    restore._fresh_networks(project, [], {str(file): "0" * 64})
            finally:
                sys.modules.pop(name, None)
                if previous is not None:
                    sys.modules[name] = previous


if __name__ == "__main__":
    unittest.main()
