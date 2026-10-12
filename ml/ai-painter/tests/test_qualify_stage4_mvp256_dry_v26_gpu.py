"""No-GPU negative tests for the V26 qualifier binding boundary."""
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

import qualify_stage4_mvp256_dry_v26_gpu as qualifier  # noqa: E402


class V26GpuGateCpuTests(unittest.TestCase):
    def test_v24_base_cannot_qualify_v26(self):
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
            with self.assertRaisesRegex(ValueError, "V26 inactive base package"):
                qualifier.check_package(binding, root=root, check_registry=False)

    def test_gpu_gate_import_is_inactive(self):
        self.assertEqual(qualifier.MAX_SECONDS, 600)
        self.assertEqual(qualifier.SCHEMA, qualifier.worker.GPU_SCHEMA)


if __name__ == "__main__":
    unittest.main()
