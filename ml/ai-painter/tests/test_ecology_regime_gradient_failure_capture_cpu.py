"""Synthetic full108 CPU evidence tests; no numerical model execution."""
import copy
import gzip
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

import torch
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as c


class CaptureCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The one-batch runner supplies an exclusive private evidence root.
        cls.base = Path(os.environ["T_Q4_75_TEST_ROOT"])
        cls.project = cls.base / "fixture-project"
        cls.project.mkdir()
        cls.data = cls.base / "fixture-data"
        (cls.data / "hot/runtime").mkdir(parents=True)
        cls.saved_data_root = os.environ.get("AI_PET_WORLD_DATA_ROOT")
        os.environ["AI_PET_WORLD_DATA_ROOT"] = str(cls.data.resolve())
        cls.mapping = c.RuntimeMap.current(cls.project)
        identity = Path(os.environ["T_Q4_75_MODEL_IDENTITY"]).read_bytes()
        if c.digest(identity) != "61a05d8d487fad5b96ec5df285ca6eeede772edb41649535f02adba41c827469":
            raise AssertionError("frozen model identity SHA differs")
        cls.graph = json.loads(identity)["graph"]
        cls.model = torch.nn.Module()
        for row in cls.graph:
            node = cls.model
            names = row["name"].split(".")
            for name in names[:-1]:
                if name not in node._modules:
                    node.add_module(name, torch.nn.Module())
                node = node._modules[name]
            node.register_parameter(names[-1], torch.nn.Parameter(torch.zeros(row["shape"])))
        cls.model.register_buffer("synthetic_identity", torch.tensor([1, 2, 3], dtype=torch.uint8))
        cls.critic = torch.nn.Module()
        cls.critic.register_parameter("synthetic_weight", torch.nn.Parameter(torch.zeros(2, 2)))
        cls.critic.register_buffer("synthetic_buffer", torch.zeros(2))
        cls.names = [r["name"] for r in cls.graph]
        cls.gradients = [[torch.full(r["shape"], float(value)) for r in cls.graph] for value in (11, 1, 2, 3)]
        cls.error = RuntimeError("synthetic total gradient gate failure at parameter 52")
        cls.attach(cls.error, cls.gradients)
        cls.counter = 0
        cls.files = {
            "model.json": {"graph": cls.graph, "fixtureKind": "synthetic-shape-only", "sourceIdentitySha256": c.digest(identity)},
            "source.json": {"sampleId": "synthetic-train-24", "split": "train", "fixtureKind": "metadata-only"},
            "condition.json": {"sampleId": "synthetic-train-24", "spatialChannels": 23, "ecologyDimensions": 7, "seasonDimensions": 4},
        }
        cls.bindings = {}
        for name, value in cls.files.items():
            raw = c.json_bytes(value)
            (cls.project / name).write_bytes(raw)
            cls.bindings[name] = {"path": name, "sha256": c.digest(raw)}
        (cls.project / "program.py").write_bytes(b"# synthetic binding only\n")
        cls.programs = {"synthetic": {"path": "program.py", "sha256": c.digest(b"# synthetic binding only\n")}}
        cls.context = {"runId": "synthetic-full108", "sampleId": "synthetic-train-24", "split": "train",
            "failurePosition": {"epoch": 13, "zeroBasedEpochPosition": 23, "trainIndex": 24, "sampleId": "synthetic-train-24"},
            "optimizerSteps": {"generator": 599, "discriminator": 600},
            "modelBinding": cls.bindings["model.json"], "programBindings": cls.programs,
            "sampleBindings": {"source": cls.bindings["source.json"], "condition": cls.bindings["condition.json"]}}
        cls.receipt = cls.write_capture(cls.error)
        if cls.receipt["status"] != "captured":
            raise AssertionError(cls.receipt)
        cls.manifest, cls.loaded = c.verify_capture(cls.receipt, cls.mapping)
        b = cls.receipt["artifacts"]["tensors"]
        cls.raw = cls.mapping.path(b["path"]).read_bytes()
        cls.raw_sha = b["sha256"]

    @classmethod
    def tearDownClass(cls):
        if cls.saved_data_root is None:
            os.environ.pop("AI_PET_WORLD_DATA_ROOT", None)
        else:
            os.environ["AI_PET_WORLD_DATA_ROOT"] = cls.saved_data_root

    @classmethod
    def attach(cls, error, gradients):
        error.ecology_regime_gradient_evidence = {"parameterNames": cls.names, "parameterTensorCount": 108,
            "rawGradients": gradients, "gradientSetsAvailable": len(gradients), "labels": list(c.LABELS)}

    @classmethod
    def write_capture(cls, error, **overrides):
        cls.counter += 1
        name = "execution-" + str(cls.counter) + ".json"
        output_root = ".runtime/synthetic-run-" + str(cls.counter)
        package = {"schema": "ecology-regime-failure-capture-execution-v1", "runId": cls.context["runId"],
            "outputRoot": output_root, "modelBinding": cls.context["modelBinding"], "programBindings": cls.programs}
        raw = c.json_bytes(package)
        (cls.project / name).write_bytes(raw)
        kwargs = dict(model=cls.model, critic=cls.critic, context=cls.context, mapping=cls.mapping,
            output=output_root + "/gradient-failure", execution_binding={"path": name, "sha256": c.digest(raw)})
        kwargs.update(overrides)
        return c.capture_failure(error, **kwargs)

    def snapshot(self, gradients=None):
        error = RuntimeError("synthetic attachment")
        self.attach(error, self.gradients if gradients is None else gradients)
        return c.collect_snapshot(error, model=self.model, critic=self.critic, graph=self.graph, context=self.context)

    def test_complete108_disk_reload_preserves_independent_total_and_partial_counts(self):
        self.assertEqual(len(self.graph), 108)
        self.assertEqual(sum(r["elements"] for r in self.graph), 2242687)
        self.assertEqual(self.manifest["context"]["optimizerSteps"], {"generator": 599, "discriminator": 600})
        self.assertEqual(self.loaded["gradient.actualTotal.52"][0, 0, 0, 0].item(), 11)
        self.assertEqual(sum(self.loaded["gradient." + label + ".52"][0, 0, 0, 0].item()
                             for label in c.LABELS[1:]), 6)
        self.assertEqual(self.manifest["stateTiming"], "after_exception")
        self.assertFalse(self.manifest["qualificationAllowed"])
        self.assertFalse(self.manifest["replayAllowed"])
        self.assertGreater(self.manifest["decompressedBytes"], 40 * 1024**2)
        self.assertLess(len(self.raw), 1024**2)
        self.assertEqual(self.manifest["networks"]["generator"]["modes"][""], self.model.training)

    def test_none_and_nonfinite_values_are_preserved_without_qualification(self):
        gradients = [list(g) for g in self.gradients]
        gradients[0][0] = None
        gradients[1][1] = gradients[1][1].clone()
        gradients[1][1][0] = float("nan")
        payload, manifest = self.snapshot(gradients)
        c.validate_manifest(manifest)
        raw = c.archive_bytes(payload)
        loaded = c.safe_load_bytes(raw, c.digest(raw), manifest)
        self.assertTrue(manifest["gradients"][0]["parameters"][0]["unused"])
        self.assertNotIn("gradient.actualTotal.0", loaded)
        self.assertTrue(torch.isnan(loaded["gradient.structuredObjective.1"][0]))
        self.assertIn("gradient.structuredObjective.1", manifest["nonfiniteTensorKeys"])
        self.assertFalse(manifest["qualificationAllowed"])

    def test_partial_attachment_and_missing_discriminator_are_incomplete(self):
        error = RuntimeError("synthetic partial autograd attachment")
        self.attach(error, self.gradients[:2])
        payload, manifest = c.collect_snapshot(error, model=self.model, critic=None, graph=self.graph, context=self.context)
        c.validate_manifest(manifest)
        self.assertEqual(manifest["status"], "capture_incomplete")
        self.assertEqual(len(manifest["missing"]), 2)
        self.assertNotIn("gradient.objectCoreRgb.0", payload)
        error = RuntimeError("no attachment")
        _, absent = c.collect_snapshot(error, model=self.model, critic=self.critic, graph=self.graph, context=self.context)
        self.assertEqual(absent["status"], "capture_incomplete")

    def test_107_graph_name_order_shape_dtype_and_parameter_alias_rejected(self):
        named = tuple(self.model.named_parameters(remove_duplicate=False))
        for graph in (self.graph[:-1], list(reversed(self.graph))):
            with self.subTest(case="graph count/order"), self.assertRaises(ValueError):
                c.validate_graph(named, graph)
        for field, value in (("shape", [1]), ("dtype", "torch.float64"), ("name", "unknown")):
            graph = copy.deepcopy(self.graph)
            graph[52][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                c.validate_graph(named, graph)
        aliased = list(named)
        aliased[-1] = (aliased[-1][0], aliased[0][1])
        with self.assertRaises(ValueError):
            c.validate_graph(aliased, self.graph)

    def test_gradient_unknown_label_name_shape_dtype_and_storage_alias_rejected(self):
        for mutate in (lambda a: a.update(labels=["unknown"] * 4),
                       lambda a: a.update(parameterNames=list(reversed(self.names))),
                       lambda a: a.update(parameterTensorCount=107)):
            error = RuntimeError("bad attachment")
            self.attach(error, self.gradients)
            mutate(error.ecology_regime_gradient_evidence)
            with self.assertRaises(ValueError):
                c.collect_snapshot(error, model=self.model, critic=self.critic, graph=self.graph, context=self.context)
        for bad in (torch.zeros(1), self.gradients[0][0].double(), self.gradients[0][0]):
            gradients = [list(g) for g in self.gradients]
            gradients[1][0] = bad
            with self.subTest(kind=str(bad.dtype)), self.assertRaises(ValueError):
                self.snapshot(gradients)

    def test_sha_descriptor_member_and_pickle_payload_rejections(self):
        with self.assertRaises(ValueError):
            c.safe_load_bytes(self.raw + b"x", self.raw_sha, self.manifest)
        for field, value in (("shape", [1]), ("dtype", "torch.float64"), ("bytes", -1), ("sha256", "0" * 64)):
            manifest = copy.deepcopy(self.manifest)
            manifest["tensorDescriptors"]["gradient.actualTotal.52"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                c.safe_load_bytes(self.raw, self.raw_sha, manifest)
        decoded = gzip.decompress(self.raw)
        for filename in ("archive/../escape", "archive/unregistered.txt"):
            stream = io.BytesIO()
            with zipfile.ZipFile(io.BytesIO(decoded)) as source, zipfile.ZipFile(stream, "w") as target:
                for entry in source.infolist():
                    target.writestr(entry.filename, source.read(entry.filename))
                target.writestr(filename, b"bad")
            raw = gzip.compress(stream.getvalue(), compresslevel=1, mtime=0)
            with self.assertRaises(ValueError):
                c.safe_load_bytes(raw, c.digest(raw), self.manifest)
        with self.assertRaises(ValueError):
            c.archive_bytes({"exception": RuntimeError("not tensor")})
        stream = io.BytesIO()
        torch.save({"unexpected": 1}, stream)
        raw = gzip.compress(stream.getvalue(), mtime=0)
        with self.assertRaises(ValueError):
            c.safe_load_bytes(raw, c.digest(raw), self.manifest)

    def test_gzip_concatenation_and_expansion_ceiling(self):
        raw = self.raw + self.raw
        with self.assertRaises(ValueError):
            c.safe_load_bytes(raw, c.digest(raw), self.manifest)
        with patch.object(c, "MAX_CAPTURE", len(self.raw) + 4096):
            with self.assertRaises(ValueError):
                c.safe_load_bytes(self.raw, self.raw_sha, self.manifest)

    def test_manifest_gradient_reference_and_completion_cannot_be_forged(self):
        for mutate in (lambda m: m["gradients"][0]["parameters"][52].update(name="unknown"),
                       lambda m: m["gradients"][0]["parameters"][52].update(unused=True),
                       lambda m: m.update(gradients=m["gradients"][:3]),
                       lambda m: m.update(replayAllowed=True)):
            manifest = copy.deepcopy(self.manifest)
            mutate(manifest)
            with self.assertRaises(ValueError):
                c.validate_manifest(manifest)

    def test_path_mapping_redirection_sha_and_overwrite_rejected(self):
        for path in ("../escape", "/absolute", "C:/absolute", ".runtime/../escape", "a\\b", "a//b"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.mapping.path(path)
        with self.assertRaises(ValueError):
            self.mapping.binding({"path": "source.json", "sha256": "0" * 64})
        redirected = self.base / "redirected-project"
        (redirected / ".runtime").mkdir(parents=True)
        with self.assertRaises(ValueError):
            c.RuntimeMap.current(redirected)
        # A filesystem reparse flag is rejected even when the path appears local.
        info = type("Info", (), {"st_mode": 0, "st_file_attributes": 0x400})()
        with patch.object(Path, "lstat", return_value=info), self.assertRaises(ValueError):
            c._plain(self.project)
        manifest = self.manifest
        again = c.capture_failure(self.error, model=self.model, critic=self.critic, context=self.context,
            mapping=self.mapping, output=self.receipt["artifacts"]["manifest"]["path"].rsplit("/", 1)[0],
            execution_binding=manifest["executionBinding"])
        self.assertEqual(again["status"], "capture_incomplete")
        self.assertIn("no overwrite", again["secondaryCaptureFailure"]["message"])
        self.assertEqual(self.mapping.path(self.receipt["artifacts"]["tensors"]["path"]).read_bytes(), self.raw)

    def test_fixed_configuration_root_identity_mapping_and_file_read_identity(self):
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.base / "other-data")}):
            with self.assertRaises(ValueError):
                self.mapping.path("source.json")
        real_identity = c._directory_identity
        def replaced(path):
            identity = real_identity(path)
            return (identity[0], identity[1] + 1) if path == self.mapping.physical_runtime else identity
        with patch.object(c, "_directory_identity", side_effect=replaced), self.assertRaises(ValueError):
            self.mapping.path("source.json")
        with patch.object(c, "_link_identity", return_value=(1, 2, True, "same-target")), self.assertRaises(ValueError):
            self.mapping.path("source.json")
        real_file_identity = c._file_identity
        calls = 0
        def changed(info, **kwargs):
            nonlocal calls
            calls += 1
            result = real_file_identity(info, **kwargs)
            return (*result[:-1], result[-1] + 1) if calls == 5 else result
        with patch.object(c, "_file_identity", side_effect=changed), self.assertRaises(ValueError):
            self.mapping.binding(self.bindings["source.json"])

    def test_budget_and_secondary_io_keep_primary_error(self):
        receipt = self.write_capture(self.error, remaining_output_bytes=1)
        self.assertEqual(receipt["primaryError"], c.primary_error(self.error))
        self.assertEqual(receipt["status"], "capture_incomplete")
        with patch.object(c, "archive_bytes", side_effect=OSError("synthetic disk refusal")):
            receipt = self.write_capture(self.error)
        self.assertEqual(receipt["primaryError"], c.primary_error(self.error))
        self.assertEqual(receipt["secondaryCaptureFailure"]["type"], "OSError")
        self.assertIn("primary", receipt["artifacts"])
        primary = json.loads(self.mapping.path(receipt["artifacts"]["primary"]["path"]).read_bytes())
        self.assertEqual(primary["primaryError"], c.primary_error(self.error))
        with patch.object(c, "directory_bytes", return_value=c.MAX_EXECUTION):
            receipt = self.write_capture(self.error)
        self.assertEqual(receipt["status"], "capture_incomplete")
        self.assertIn("budget", receipt["secondaryCaptureFailure"]["message"])

    def test_all_private_fixture_evidence_remains_under_eight_mib(self):
        self.assertLess(c.directory_bytes(self.base), 8 * 1024**2 - 65536)


if __name__ == "__main__":
    unittest.main()
