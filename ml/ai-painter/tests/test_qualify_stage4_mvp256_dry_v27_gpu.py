"""No-GPU negative tests for the V27 qualifier binding boundary."""
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

import qualify_stage4_mvp256_dry_v27_gpu as qualifier  # noqa: E402


class V27GpuGateCpuTests(unittest.TestCase):
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
            with self.assertRaisesRegex(ValueError, "V27 inactive base package"):
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
