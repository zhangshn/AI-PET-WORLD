"""No-GPU negative tests for the V28 qualifier binding boundary."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
for entry in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

import qualify_stage4_appearance_regime_gradient_failure_capture_gpu as qualifier  # noqa: E402


class V28GpuGateCpuTests(unittest.TestCase):
    def test_new_backend_properties_restore_and_broken_diagnostics_keep_primary(self):
        import torch
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        sample = {"conditions": torch.zeros(1), "image": torch.zeros(1),
                  "appearance_regime": torch.tensor([1., 0., 0., 0.]), "objectInstanceTable": []}
        flags = (torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision,
                 torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic)
        original = RuntimeError("synthetic original backend failure")
        class BrokenEvidence(dict):
            def update(self, *args, **kwargs): raise RuntimeError("synthetic diagnostics failed")
            def setdefault(self, *args, **kwargs): raise RuntimeError("synthetic secondary sink failed")
        def probe(model, critic, sample, order, resource, forward=None, *, event=None, failure_evidence=None):
            torch.backends.cuda.matmul.fp32_precision = "tf32" if flags[0] == "ieee" else "ieee"
            torch.backends.cudnn.conv.fp32_precision = "tf32" if flags[1] == "ieee" else "ieee"
            torch.backends.cudnn.benchmark = not flags[2]
            torch.backends.cudnn.deterministic = not flags[3]
            raise original
        with self.assertRaises(RuntimeError) as caught:
            qualifier.observe_probe(model, critic, sample, (), lambda: None,
                qualifier.probe_counters(), probe=probe, failure_evidence=BrokenEvidence())
        self.assertIs(caught.exception, original)
        self.assertEqual(flags, (torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision,
                                torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic))
        self.assertEqual(original.secondary_diagnostic_error, "synthetic diagnostics failed")
        from unittest.mock import patch
        with patch.object(torch, "set_rng_state", side_effect=RuntimeError("synthetic restore failed")):
            with self.assertRaises(RuntimeError) as caught:
                qualifier.observe_probe(model, critic, sample, (), lambda: None,
                    qualifier.probe_counters(), probe=probe, failure_evidence=BrokenEvidence())
        self.assertIs(caught.exception, original)
        self.assertEqual(flags, (torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision,
                                torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic))
        self.assertFalse(torch.cuda.is_initialized())

    def test_actual_profile_signature_mapping_with_explicit_dummy_numeric_boundary(self):
        import torch
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        sample = {"conditions": torch.zeros(1), "image": torch.zeros(1),
                  "appearance_regime": torch.tensor([1., 0., 0., 0.]), "objectInstanceTable": []}
        counters = qualifier.probe_counters()
        def probe(model, critic, sample, order, resource, forward=None, *, event=None, failure_evidence=None):
            for kind, count, length in (("forward", 1, 0), ("discriminator", 1, 2), ("generator", 4, 2)):
                for _ in range(count):
                    event("attempt", kind, None)
                    event("complete", kind, tuple(None for _ in range(length)))
            return {"passed": True, "optimizerCreated": False, "optimizerUpdates": 0,
                    "callCounts": {"generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1}}
        result = qualifier.observe_probe(model, critic, sample, (), lambda: None, counters, probe=probe)
        self.assertEqual(result["autogradGradCalls"], 4)
        self.assertEqual(result["initialStateSha256"], result["finalStateSha256"])
        self.assertTrue(result["sourceTensorsUnchanged"])
        self.assertFalse(torch.cuda.is_initialized())

    def test_each_failed_gradient_prefix_preserves_original_error_and_actual_counts(self):
        import torch
        for prefix in (0, 1, 2, 3):
            model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
            sample = {"conditions": torch.zeros(1), "image": torch.zeros(1),
                      "appearance_regime": torch.tensor([1., 0., 0., 0.]), "objectInstanceTable": []}
            counters, evidence = qualifier.probe_counters(), {}
            original = RuntimeError("synthetic primary prefix " + str(prefix))
            def probe(model, critic, sample, order, resource, forward=None, *, event=None, failure_evidence=None):
                event("attempt", "forward", None); event("complete", "forward", None)
                event("attempt", "discriminator", None); event("complete", "discriminator", (None, None))
                for _ in range(prefix):
                    event("attempt", "generator", None); event("complete", "generator", (None, None))
                event("attempt", "generator", None)
                raise original
            with self.assertRaises(RuntimeError) as caught:
                qualifier.observe_probe(model, critic, sample, (), lambda: None, counters,
                                        probe=probe, failure_evidence=evidence)
            self.assertIs(caught.exception, original)
            self.assertEqual(counters["generatorAttempted"], prefix + 1)
            self.assertEqual(counters["generatorCompleted"], prefix)
            self.assertEqual(evidence["originalError"], str(original))
            self.assertEqual(evidence["actualEventCounts"], counters)

    def test_v24_base_cannot_qualify_v27(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "package.json"
            target.write_text(json.dumps({
                "schemaVersion": qualifier.base.PACKAGE_SCHEMA,
                "status": "issued_single_attempt",
                "capabilityVersion": qualifier.base.CAPABILITY,
                "trainingIntent": "bounded_once", "trainingAllowed": False,
                "resourceBudget": qualifier.base.RESOURCE_CEILING,
            }), encoding="utf8")
            binding = {"path": "package.json",
                       "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "diagnostic base identity differs"):
                qualifier.check_package(binding, root=root, check_registry=False)

    def test_gpu_gate_import_is_inactive(self):
        self.assertEqual(qualifier.MAX_SECONDS, 600)
        self.assertEqual(qualifier.SCHEMA, qualifier.worker.GPU_SCHEMA)

    def test_admission_arguments_cannot_enter_gpu_execute(self):
        from unittest.mock import patch
        import torch
        with patch.object(qualifier, "execute", side_effect=AssertionError("GPU execution")), \
                patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA")):
            with self.assertRaisesRegex(ValueError, "exclusive"):
                qualifier.main(["--admission-preflight", "--execute", "--package", "package.json",
                                "--sha256", "0"*64])
            with self.assertRaisesRegex(ValueError, "bound admission package"):
                qualifier.main(["--admission-preflight"])
        self.assertFalse(torch.cuda.is_initialized())

    def test_cold_cli_does_not_initialize_cuda(self):
        from contextlib import redirect_stdout
        import io
        import torch
        from unittest.mock import patch
        output = io.StringIO()
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA")), redirect_stdout(output):
            self.assertEqual(qualifier.main([]), 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "cpu_preflight_only_gpu_not_initialized")
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
