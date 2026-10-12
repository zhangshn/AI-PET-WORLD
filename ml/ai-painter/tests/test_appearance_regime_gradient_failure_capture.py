"""CPU synthetic failure snapshots only; no real model, pixels, CUDA or step."""
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import random
import tempfile
import subprocess
import unittest
from unittest.mock import patch
import numpy as np
import torch
from ai_painter.complete_world import appearance_regime_gradient_failure_capture as capture


class ArtificialModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.values = torch.nn.ParameterList([torch.nn.Parameter(torch.tensor([i * .001, -0., -.125])) for i in range(107)])
        self.register_buffer("scalar", torch.tensor(-0.))
        self.register_buffer("identity", torch.tensor([1, 2, 3], dtype=torch.uint8))
        self.values[4].grad = torch.tensor([.5, -.5, -0.])


def fixture_error(model, *, count=4, mismatch=False, nonfinite=False):
    parameters = tuple(model.parameters())
    structured = sum(p.sum() * .25 for p in parameters)
    whole = sum(p.sum() * .125 for p in parameters)
    core = sum(p.sum() * .125 for p in parameters)
    total = (structured.float() + whole).float() + core
    raw = [torch.autograd.grad(loss, parameters, retain_graph=i < 3, allow_unused=True)
        for i, loss in enumerate((total, structured, whole, core))]
    raw = [list(values) for values in raw[:count]]
    if count == 4:
        for values in raw: values[106] = None
        if mismatch: raw[0][87] = raw[0][87].clone(); raw[0][87][1] += .001
        if nonfinite: raw[3][5] = torch.full_like(raw[3][5], float("nan"))
    error = ValueError("actual total gradient identity differs at parameter 87")
    error.appearance_regime_gradient_evidence = {"rawGradients": raw, "parameterNames": [name for name, _ in model.named_parameters()],
        "parameterTensorCount": 107, "gradientSetsAvailable": count}
    return error


def frozen_state(model, critic):
    def network(net):
        return {"parameters": [(name, value.detach().clone(), value.requires_grad, value._version,
            None if value.grad is None else value.grad.detach().clone(), None if value.grad is None else value.grad._version)
            for name, value in net.named_parameters()],
            "buffers": [(name, value.detach().clone(), value._version) for name, value in net.named_buffers()],
            "modes": [(name, module.training) for name, module in net.named_modules()]}
    return {"model": network(model), "critic": network(critic), "torch": torch.random.get_rng_state().clone(),
        "python": random.getstate(), "numpy": deepcopy(np.random.get_state()),
        "backend": (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
            torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
            torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision),
        "autocast": torch.is_autocast_enabled("cpu"), "gradEnabled": torch.is_grad_enabled()}


def same_bytes(a, b):
    return a.dtype == b.dtype and a.shape == b.shape and torch.equal(a.reshape(-1).contiguous().view(torch.uint8), b.reshape(-1).contiguous().view(torch.uint8))


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.temp = tempfile.TemporaryDirectory(); self.directory = Path(self.temp.name).resolve()
        self.output = self.directory / "run" / "failure"
        data = json.dumps({"outputRoot": str(self.directory / "run"), "runId": "synthetic-run"}).encode()
        path = self.directory / "execution-package.json"; path.write_bytes(data)
        self.binding = {"path": str(path), "sha256": hashlib.sha256(data).hexdigest()}
        self.model = ArtificialModel()
        with torch.random.fork_rng(devices=[]):
            self.critic = torch.nn.Sequential(torch.nn.Linear(2, 1), torch.nn.Dropout()).train()
        self.critic[0].eval(); self.critic[0].bias.requires_grad_(False)
        self.critic[0].weight.grad = torch.tensor([[.125, -.125]])
        self.sample = {"sampleId": "synthetic-explicit-event", "split": "train", "appearance_regime": torch.tensor([0., 1., 0., 0.]),
            "image": object(), "conditions": object(), "objectInstanceTable": object()}
        self.counts = {"generator": 578, "discriminator": 579}
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized()); self.temp.cleanup(); torch.set_num_threads(self.threads)

    def assert_unchanged(self, before):
        after = frozen_state(self.model, self.critic)
        for key in ("model", "critic"):
            self.assertEqual(before[key]["modes"], after[key]["modes"])
            for a, b in zip(before[key]["parameters"], after[key]["parameters"]):
                self.assertEqual((a[0], a[2], a[3], a[5]), (b[0], b[2], b[3], b[5]))
                self.assertTrue(same_bytes(a[1], b[1]))
                if a[4] is None: self.assertIsNone(b[4])
                else: self.assertTrue(same_bytes(a[4], b[4]))
            for a, b in zip(before[key]["buffers"], after[key]["buffers"]):
                self.assertEqual((a[0], a[2]), (b[0], b[2])); self.assertTrue(same_bytes(a[1], b[1]))
        self.assertTrue(torch.equal(before["torch"], after["torch"])); self.assertEqual(before["python"], after["python"])
        self.assertEqual(before["numpy"][0], after["numpy"][0]); self.assertTrue(np.array_equal(before["numpy"][1], after["numpy"][1]))
        self.assertEqual(before["numpy"][2:], after["numpy"][2:])
        self.assertEqual(before["backend"], after["backend"])
        self.assertEqual((before["autocast"], before["gradEnabled"]), (after["autocast"], after["gradEnabled"]))

    def run_capture(self, error=None, **changes):
        error = error if error is not None else fixture_error(self.model, mismatch=True)
        before = frozen_state(self.model, self.critic)
        options = dict(error=error, model=self.model, critic=self.critic, sample=self.sample, counts=self.counts,
            epoch=12, train_position=3, output_root=self.output, execution_binding=self.binding,
            source_bindings=[self.binding], remaining_output_bytes=16 * 1024 * 1024)
        options.update(changes)
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA initialization prohibited")), \
             patch.object(torch.cuda, "get_rng_state", side_effect=AssertionError("CPU capture touched CUDA RNG")), \
             patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward prohibited")), \
             patch.object(torch.optim.Optimizer, "step", create=True, side_effect=AssertionError("optimizer step prohibited")):
            receipt = capture.capture_gradient_failure(**options)
        self.assert_unchanged(before); self.assertEqual(self.counts, {"generator": 578, "discriminator": 579})
        return receipt

    def test_complete_original_gate_statistics_exact_state_none_rng_safe_archive(self):
        receipt = self.run_capture()
        self.assertEqual(receipt["status"], "failure_evidence_captured")
        self.assertFalse(receipt["executionQualified"]); self.assertTrue(receipt["gradientEvidenceComplete"])
        manifest, tensors = capture.verify_gradient_failure_capture(receipt)
        self.assertEqual(manifest["location"], {"epoch": 12, "trainPosition": 3, "sampleId": self.sample["sampleId"],
            "split": "train", "origin": "explicit_capture_call", "inferredSample": False})
        self.assertEqual(manifest["counts"], self.counts)
        comparison = manifest["comparison"]
        self.assertEqual((comparison["atol"], comparison["rtol"]), (1e-6, 1e-5))
        self.assertFalse(comparison["passedAllOriginalToleranceMasks"]); self.assertTrue(comparison["allFinite"])
        self.assertEqual(len(comparison["parameters"]), 107)
        self.assertEqual(comparison["outsideToleranceElements"], 1)
        self.assertEqual(comparison["worstParameterIndex"], 87)
        self.assertEqual(comparison["exceptionReportedParameterIndex"], 87)
        bad = comparison["parameters"][87]
        self.assertEqual(bad["name"], "values.87"); self.assertEqual(bad["worstFlatIndex"], 1)
        self.assertGreater(bad["maxAbsoluteDifference"]["value"], bad["worstOriginalComparisonLimit"]["value"])
        self.assertEqual(comparison["parameters"][106]["unused"], [True] * 4)
        self.assertTrue(all(row[106]["key"] is None for row in manifest["gradientSets"]))
        self.assertTrue(all(type(v) is torch.Tensor and v.device.type == "cpu" and not v.requires_grad for v in tensors.values()))
        self.assertTrue(same_bytes(tensors["model.buffer.0"], self.model.scalar))
        self.assertTrue(same_bytes(tensors["model.parameter.4.grad"], self.model.values[4].grad))
        self.assertTrue(torch.equal(tensors["random.torch_cpu"], self.rng))
        self.assertEqual(manifest["randomState"]["cudaDevices"], [])
        self.assertTrue(all("image" not in key and "conditions" not in key for key in tensors))
        self.assertFalse(manifest["sourcePixelsCopied"]); self.assertTrue(manifest["executionBytesRehashed"])
        with patch.object(torch, "load", wraps=torch.load) as safe:
            capture.verify_gradient_failure_capture(receipt)
            self.assertTrue(safe.call_args.kwargs["weights_only"])

    def test_complete_matching_gradient_masks_diagnostic_only(self):
        receipt = self.run_capture(fixture_error(self.model))
        manifest, _ = capture.verify_gradient_failure_capture(receipt)
        self.assertTrue(manifest["comparison"]["passedAllOriginalToleranceMasks"])
        self.assertEqual(manifest["comparison"]["outsideToleranceElements"], 0)
        self.assertFalse(manifest["executionQualified"])

    def test_missing_and_partial_gradient_evidence_never_fabricates_complete_or_pass(self):
        for count in (None, 0, 1, 3):
            output = self.directory / "run" / ("partial-" + str(count))
            error = RuntimeError("explicit earlier failure") if count is None else fixture_error(self.model, count=count)
            receipt = self.run_capture(error, output_root=output)
            self.assertEqual(receipt["status"], "partial_failure_evidence_captured")
            self.assertFalse(receipt["gradientEvidenceComplete"])
            manifest, _ = capture.verify_gradient_failure_capture(receipt)
            self.assertIsNone(manifest["comparison"]["passedAllOriginalToleranceMasks"])
            self.assertIsNone(manifest["comparison"]["outsideToleranceElements"])
            self.assertEqual(len(manifest["gradientSets"]), count or 0)

    def test_wrong_parameter_order_shape_and_nonfinite_are_explicit(self):
        error = fixture_error(self.model); error.appearance_regime_gradient_evidence["parameterNames"][87] = "wrong"
        receipt = self.run_capture(error, output_root=self.directory / "run" / "wrong-name")
        manifest, _ = capture.verify_gradient_failure_capture(receipt)
        self.assertFalse(manifest["gradientEvidenceComplete"])
        self.assertIn("attachment parameter names differ", str(manifest["comparison"]["problems"]))
        error = fixture_error(self.model); error.appearance_regime_gradient_evidence["rawGradients"][1][4] = torch.zeros(2)
        receipt = self.run_capture(error, output_root=self.directory / "run" / "wrong-shape")
        self.assertEqual(receipt["status"], "partial_failure_evidence_captured")
        receipt = self.run_capture(fixture_error(self.model, nonfinite=True), output_root=self.directory / "run" / "nonfinite")
        manifest, _ = capture.verify_gradient_failure_capture(receipt)
        self.assertFalse(manifest["comparison"]["allFinite"]); self.assertFalse(manifest["comparison"]["passedAllOriginalToleranceMasks"])
        self.assertEqual(manifest["comparison"]["parameters"][5]["nonfiniteExpectedElements"], 3)
        self.assertEqual(manifest["comparison"]["worstParameterIndex"], 5)
        json.dumps(manifest, allow_nan=False)

    def test_execution_sha_outside_run_traversal_source_sha_format_rejected(self):
        for changes in ({"execution_binding": {**self.binding, "sha256": "0" * 64}},
            {"output_root": self.directory / "outside-run"},
            {"output_root": str(self.directory / "run") + "/../escape"}):
            receipt = self.run_capture(**changes)
            self.assertEqual(receipt["status"], "capture_failed")
            self.assertEqual(receipt["originalError"]["message"], "actual total gradient identity differs at parameter 87")
            self.assertFalse(receipt["artifacts"])
            self.assertEqual(receipt["counts"], self.counts)
        receipt = self.run_capture(source_bindings=[{**self.binding, "sha256": "wrong"}])
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertTrue((self.output / capture.PRIMARY).exists())
        self.assertFalse((self.output / capture.MANIFEST).exists())

    def test_registered_runtime_junction_allowed_other_redirect_rejected(self):
        capture._no_redirect(capture.ROOT / ".runtime" / "synthetic-uncreated-check")
        target = self.directory / "run"; target.mkdir()
        alias = self.directory / "alias"
        # Directory junctions need no symbolic-link privilege on Windows.
        # Both absolute targets are verified inside this explicit fixture root.
        self.assertTrue(target.resolve().is_relative_to(self.directory))
        self.assertTrue(alias.absolute().is_relative_to(self.directory))
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(alias), str(target)], capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        self.assertTrue(alias.is_junction())
        receipt = self.run_capture(output_root=alias / "failure")
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertIn("alias", receipt["captureError"]["message"])
        self.assertFalse((target / "failure").exists())

    def test_budget_preflight_before_model_copies_and_stream_overflow(self):
        with patch.object(capture, "_cpu", side_effect=AssertionError("copy before preflight")):
            receipt = self.run_capture(remaining_output_bytes=4096)
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertIn("budget", receipt["captureError"]["message"])
        self.assertIn("sizePreflight", receipt); self.assertFalse((self.output / capture.TENSORS).exists())
        self.assertLessEqual(sum(p.stat().st_size for p in self.output.iterdir()), 4096)
        def overflow(_payload, stream): stream.write(b"x" * (2 * 1024 * 1024))
        with patch.object(capture, "METADATA_RESERVE", 0), patch.object(torch, "save", overflow):
            receipt = self.run_capture(output_root=self.directory / "run" / "stream-overflow", remaining_output_bytes=1024 * 1024)
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertIn("partialTensorArtifact", receipt)
        self.assertFalse((self.directory / "run" / "stream-overflow" / capture.MANIFEST).exists())

    def test_serializer_io_interruption_and_corrupt_payload_preserve_primary(self):
        for i, fault in enumerate((OSError("synthetic disk error"), KeyboardInterrupt("synthetic capture interrupt"))):
            with patch.object(torch, "save", side_effect=fault):
                receipt = self.run_capture(output_root=self.directory / "run" / ("io-" + str(i)))
            self.assertEqual(receipt["status"], "capture_interrupted" if i else "capture_failed")
            self.assertEqual(receipt["originalError"]["type"], "builtins.ValueError")
            self.assertEqual(receipt["captureError"]["message"], str(fault))
            self.assertTrue(Path(receipt["artifacts"]["primary"]["path"]).is_file())
        def garbage(_payload, stream): stream.write(b"not a tensor archive")
        with patch.object(torch, "save", garbage):
            receipt = self.run_capture(output_root=self.directory / "run" / "garbage")
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertFalse((self.directory / "run" / "garbage" / capture.MANIFEST).exists())

    def test_exclusive_no_retry_and_primary_write_failure(self):
        first = self.run_capture(); saved = (self.output / capture.MANIFEST).read_bytes()
        again = self.run_capture()
        self.assertEqual(again["status"], "capture_failed"); self.assertIn("consumed", again["captureError"]["message"])
        self.assertEqual((self.output / capture.MANIFEST).read_bytes(), saved)
        with patch.object(capture, "_exclusive", side_effect=OSError("metadata IO denied")):
            receipt = self.run_capture(output_root=self.directory / "run" / "metadata-fault")
        self.assertEqual(receipt["captureError"]["message"], "metadata IO denied")
        self.assertEqual(receipt["secondaryEvidenceError"]["message"], "metadata IO denied")
        self.assertEqual(receipt["originalError"], first["originalError"])

    def test_manifest_and_archive_tamper_and_path_escape_rejected(self):
        receipt = self.run_capture(); manifest_path = Path(receipt["artifacts"]["manifest"]["path"])
        old = manifest_path.read_bytes(); manifest_path.write_bytes(old + b" ")
        with self.assertRaisesRegex(ValueError, "SHA"): capture.verify_gradient_failure_capture(receipt)
        manifest_path.write_bytes(old)
        tensor_path = Path(receipt["artifacts"]["tensors"]["path"]); tensor_path.write_bytes(tensor_path.read_bytes() + b"tamper")
        with self.assertRaisesRegex(ValueError, "SHA"): capture.verify_gradient_failure_capture(receipt)
        manifest = json.loads(old); manifest["artifacts"]["tensors"]["path"] = str(self.directory / "outside.pt")
        changed = capture._json(manifest); manifest_path.write_bytes(changed)
        tampered = deepcopy(receipt); tampered["artifacts"]["manifest"].update(bytes=len(changed), sha256=hashlib.sha256(changed).hexdigest())
        with self.assertRaisesRegex(ValueError, "escapes"): capture.verify_gradient_failure_capture(tampered)

    def test_safe_tensor_descriptor_tamper_rejected_before_manifest_commit(self):
        def altered(payload, stream):
            saved = dict(payload); saved["model.parameter.1"] = saved["model.parameter.1"] + 1
            original_save(saved, stream)
        original_save = torch.save
        with patch.object(torch, "save", altered): receipt = self.run_capture()
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertIn("descriptor", receipt["captureError"]["message"])
        self.assertFalse((self.output / capture.MANIFEST).exists())

    def test_invariant_verification_failure_preserves_primary_and_prevents_manifest(self):
        with patch.object(capture, "_ensure_unchanged", side_effect=RuntimeError("synthetic invariant check failed")):
            receipt = self.run_capture()
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertEqual(receipt["captureError"]["message"], "synthetic invariant check failed")
        self.assertEqual(receipt["originalError"]["message"], "actual total gradient identity differs at parameter 87")
        self.assertFalse((self.output / capture.MANIFEST).exists())

    def test_actual_checkpoint_bytes_limit_untrusted_remaining_budget(self):
        owned = self.directory / "run"; owned.mkdir()
        (owned / "existing-checkpoint.pt").write_bytes(b"x" * 15000)
        with patch.object(capture, "MAX_EXECUTION_BYTES", 16384):
            receipt = self.run_capture(remaining_output_bytes=16384)
        self.assertEqual(receipt["status"], "capture_failed")
        self.assertIn("budget", receipt["captureError"]["message"])
        self.assertEqual(receipt["sizePreflight"]["existingCheckpointBytes"], 15000)
        self.assertEqual(receipt["sizePreflight"]["captureMaximumBytes"], 1384)
        self.assertLessEqual(sum(p.stat().st_size for p in owned.rglob("*") if p.is_file()), 16384)

    def test_atomic_manifest_partial_and_publish_failure_no_complete_name(self):
        exclusive = capture._exclusive
        def partial(root, name, data, budget):
            if name == capture.PENDING:
                with (root / name).open("xb") as stream: stream.write(data[:100])
                raise OSError("synthetic half-written pending")
            return exclusive(root, name, data, budget)
        with patch.object(capture, "_exclusive", partial): receipt = self.run_capture()
        self.assertEqual(receipt["captureError"]["message"], "synthetic half-written pending")
        self.assertTrue((self.output / capture.PENDING).exists()); self.assertFalse((self.output / capture.MANIFEST).exists())
        self.assertEqual(receipt["status"], "capture_failed")
        with patch.object(capture.os, "link", side_effect=OSError("synthetic publish failure")):
            receipt = self.run_capture(output_root=self.directory / "run" / "publish-failure")
        self.assertEqual(receipt["captureError"]["message"], "synthetic publish failure")
        self.assertFalse((self.directory / "run" / "publish-failure" / capture.MANIFEST).exists())

    def test_caller_context_and_cpu_even_initialized_process_untouched(self):
        with torch.autocast("cpu", dtype=torch.bfloat16), torch.no_grad(), patch.object(torch.cuda, "is_initialized", return_value=True):
            receipt = self.run_capture(fixture_error(self.model) if torch.is_grad_enabled() else RuntimeError("no raw attachment"))
            self.assertTrue(torch.is_autocast_enabled("cpu")); self.assertFalse(torch.is_grad_enabled())
        self.assertEqual(receipt["status"], "partial_failure_evidence_captured")


if __name__ == "__main__": unittest.main()
