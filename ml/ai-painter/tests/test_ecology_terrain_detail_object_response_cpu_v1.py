"""Synthetic CPU tensors only; never construct or execute the real model."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import random
import unittest
from unittest.mock import patch
import torch

FILE = Path(__file__).absolute().parents[1] / "scripts/diagnose_ecology_terrain_detail_object_response_cpu_v1.py"
spec = importlib.util.spec_from_file_location("object_response_readonly", FILE)
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


class ObjectResponseTests(unittest.TestCase):
    def request(self):
        value = {"schemaVersion": "terrain-object-response-readonly-request-v1", "runId": subject.RUN,
            "outputRoot": subject.OUTPUT, "limits": deepcopy(subject.LIMITS), "trainingAllowed": False,
            "qualificationGranted": False, "selectedSampleId": "first-train"}
        value.update({k: {"path": subject.SELF if k == "adapter" else "data/" + k,
            "sha256": "a" * 64} for k in subject.BINDINGS})
        for key, filename in (("qualityPlan", "quality-plan.json"), ("workerTerminal", "worker-terminal.json"),
                ("cpuReview", "dry-review/cpu-review.json"), ("checkpoint", "checkpoint-24.pt")):
            value[key]["path"] = subject.RUN_ROOT + "/" + filename
        value["executionPackage"]["path"] = ".runtime/ai-painter/autonomous-closed-loop-packages/terrain-detail-quality-v2-package-78017caf-1495-4a85-a2ed-e03e3a8e532c/package.json"
        return value

    def fixture(self):
        terrain = torch.full((1, 3, 192, 256), .2)
        masks = {r: torch.zeros((1, 1, 192, 256)) for r in subject.ROLES}
        masks["object_footprints"][..., 10:14, 10:14] = 1
        masks["object_tree"][..., 10:14, 10:14] = 1
        residuals = {r: masks[r].expand(1, 3, 192, 256).clone() * .999 for r in subject.ROLES}
        total = torch.zeros_like(terrain)
        for r in subject.ROLES: total += residuals[r]
        prediction = torch.sigmoid(torch.logit(terrain.clamp(1e-5, 1-1e-5)) + total)
        evidence = {"terrainRgb": terrain, "visibleObjectSupportMasks": masks,
            "maskedObjectRgbResiduals": residuals, "responsibilityConditions": deepcopy(masks)}
        return prediction, torch.full((3, 192, 256), .6), evidence

    def test_exact_request(self):
        self.assertIs(subject.validate_request(self.request())["trainingAllowed"], False)

    def test_request_rejects_expansion_types_and_unknown_fields(self):
        for key in subject.LIMITS:
            r = self.request(); r["limits"][key] = True if type(subject.LIMITS[key]) is int else 1
            with self.subTest(key=key), self.assertRaises(ValueError): subject.validate_request(r)
        r = self.request(); r["unknown"] = True
        with self.assertRaises(ValueError): subject.validate_request(r)

    def test_wrong_run_path_binding_and_permissions(self):
        for key, value in (("runId", "old"), ("outputRoot", "../old"), ("trainingAllowed", True),
                ("qualificationGranted", True), ("selectedSampleId", "")):
            r = self.request(); r[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): subject.validate_request(r)
        for path in ("../other", "F:/other", "a\\b", "/other"):
            r = self.request(); r["checkpoint"]["path"] = path
            with self.assertRaises(ValueError): subject.validate_request(r)

    def test_overlap_sums_two_heads_not_one(self):
        p, t, e = self.fixture()
        r = subject.measure_response(p, t, e)
        two = r["reachableEnvelopeByActiveBranchCount"]["2"]
        self.assertEqual(two["pixels"], 16)
        self.assertEqual(two["targetOutsideClosedRgbEnvelopeCount"], 0)
        self.assertEqual(r["reachableEnvelopeByActiveBranchCount"]["0"]["pixels"], 192 * 256 - 16)
        self.assertFalse(r["rootCauseEstablished"])

    def test_empty_roles_not_zero_success_and_saturation_counts_active_only(self):
        p, t, e = self.fixture(); r = subject.measure_response(p, t, e)
        self.assertEqual(r["roles"]["object_tree"]["tanhResidual"]["activeChannelValues"], 48)
        self.assertEqual(r["roles"]["object_tree"]["tanhResidual"]["saturationRatio"], 1)
        self.assertIsNone(r["roles"]["object_rock"]["core"]["rgbMae"])
        self.assertIsNone(r["roles"]["object_rock"]["tanhResidual"]["saturationRatio"])

    def test_signed_edges_only_use_pairs_inside_mask(self):
        p = torch.zeros((3, 3, 3)); t = p.clone(); t[:, 0, 0] = 1
        mask = torch.zeros((3, 3), dtype=torch.bool); mask[0, 0] = True
        r = subject.region_metrics(p, t, mask)
        self.assertEqual(r["rgbMae"], 1)
        self.assertEqual(r["edgeChannelPairs"], 0)
        self.assertIsNone(r["signedEdgeMae"])

    def test_identity_metric_and_constant_reference_semantics(self):
        p = torch.arange(27, dtype=torch.float32).reshape(3, 3, 3) / 27
        mask = torch.ones((3, 3), dtype=torch.bool)
        r = subject.region_metrics(p, p, mask)
        self.assertEqual(r["rgbMae"], 0); self.assertEqual(r["signedEdgeMae"], 0)
        self.assertAlmostEqual(r["lumaCorrelation"], 1, places=5)
        r = subject.region_metrics(p, torch.ones_like(p), mask)
        self.assertIsNone(r["lumaCorrelation"])
        self.assertEqual(r["correlationStatus"], "constant_reference")

    def test_nonfinite_wrong_shape_and_rgb_range_rejected(self):
        for kind in ("nan", "range", "shape"):
            p, t, e = self.fixture()
            if kind == "nan": p[0, 0, 0, 0] = float("nan")
            elif kind == "range": t[0, 0, 0] = 1.1
            else: p = p[..., :-1]
            with self.subTest(kind=kind), self.assertRaises(ValueError): subject.measure_response(p, t, e)

    def test_forged_masks_residuals_and_composition_rejected(self):
        for kind in ("fractional", "outside", "over_one", "core", "rgb"):
            p, t, e = self.fixture()
            if kind == "fractional": e["visibleObjectSupportMasks"]["object_tree"][..., 10, 10] = .5
            elif kind == "outside": e["maskedObjectRgbResiduals"]["object_tree"][..., 0, 0] = .1
            elif kind == "over_one": e["maskedObjectRgbResiduals"]["object_tree"][..., 10, 10] = 1.01
            elif kind == "core": e["responsibilityConditions"]["object_tree"][..., 0, 0] = 1
            else: p[0, 0, 0, 0] += .01
            with self.subTest(kind=kind), self.assertRaises(ValueError): subject.measure_response(p, t, e)

    def test_measurements_do_not_call_autograd_or_mutate_inputs(self):
        p, t, e = self.fixture(); before = p.clone()
        with patch.object(torch.autograd, "grad", side_effect=AssertionError), patch.object(torch.autograd, "backward", side_effect=AssertionError):
            subject.measure_response(p, t, e)
        self.assertTrue(torch.equal(before, p)); self.assertFalse(torch.cuda.is_initialized())

    def test_rng_change_detected_restored_without_masking_primary(self):
        before = random.getstate()
        with self.assertRaisesRegex(ValueError, "RNG changed"):
            with subject.preserve_rng(torch): random.random()
        self.assertEqual(before, random.getstate())
        error = OSError("primary")
        with self.assertRaises(OSError) as caught:
            with subject.preserve_rng(torch):
                random.random(); raise error
        self.assertIs(caught.exception, error); self.assertEqual(before, random.getstate())

    def test_first_sample_enforced_before_any_decode(self):
        class Reader:
            def json(self, binding): return {"sampleIds": ["train-" + str(i) for i in range(48)]}
        with self.assertRaisesRegex(ValueError, "first fixed"):
            subject.load_selected(Reader(), {"trainSplit": {}}, "train-1", None, None, {"decodedTrainSamples": 0})

    def test_other_rgb_is_rejected_before_read(self):
        subject.guard_image_read("selected.png", {"selected.png"})
        subject.guard_image_read("metadata.json", set())
        for path in ("other-train.png", "validation.PNG", "challenge.jpg", "regression.webp"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "out-of-scope"):
                subject.guard_image_read(path, {"selected.png"})

    def test_cli_and_no_full_loader_or_image_writer(self):
        source = FILE.read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--request", required=True)', source)
        self.assertNotIn("worker.load_samples(", source)
        self.assertNotIn("png_bytes(", source)


if __name__ == "__main__": unittest.main()
