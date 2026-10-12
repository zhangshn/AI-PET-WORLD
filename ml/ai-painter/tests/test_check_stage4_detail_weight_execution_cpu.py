"""Synthetic structural counter/closure tests; never decode real pixels."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import check_stage4_detail_weight_execution_cpu as candidate


class FakeReader:
    def __init__(self, root): self.root = root; self.observed = []
    def path(self, path): return self.root / path
    def snapshot(self, path): return self.path(path).read_bytes(), {"path": path, "sha256": "fixture"}
    def read(self, binding): self.observed.append(binding); return b"synthetic"


class OwnCpuEntryTests(unittest.TestCase):
    def test_four_cases_exact_attempt_completion_limits(self):
        counts = candidate.Counters()
        for _ in range(4):
            counts.begin_case()
            for kind, number in (("forward", 1), ("generator", 4), ("discriminator", 1)):
                for _ in range(number): counts.event("attempt", kind, None); counts.event("complete", kind, None)
        self.assertEqual(dict(counts), candidate.COUNTS)
        with self.assertRaises(ValueError): counts.event("attempt", "forward", None)
        self.assertEqual(dict(counts), candidate.COUNTS)

    def test_completion_without_attempt_and_extra_case_call_rejected(self):
        counts = candidate.Counters(); counts.begin_case()
        with self.assertRaises(ValueError): counts.event("complete", "generator", None)
        counts.event("attempt", "forward", None)
        with self.assertRaises(ValueError): counts.event("attempt", "forward", None)
        self.assertEqual(counts["forwardAttempted"], 1)
        self.assertEqual(counts["forwardCompleted"], 0)

    def test_closure_includes_lazy_relative_import_and_package_init(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = {"ml/ai-painter/scripts/entry.py": "def lazy():\n import ai_painter.part\n",
                     "ml/ai-painter/src/ai_painter/__init__.py": "",
                     "ml/ai-painter/src/ai_painter/part.py": "from . import leaf\n",
                     "ml/ai-painter/src/ai_painter/leaf.py": "VALUE = 1\n"}
            for name, data in files.items():
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_text(data)
            self.assertEqual(set(candidate.source_closure(FakeReader(root), ["ml/ai-painter/scripts/entry.py"])), set(files))

    def test_authentication_rehashes_all_sources_and_rejects_stale_freeze(self):
        manifest = {"schema": candidate.SCHEMA, "capabilityVersion": candidate.CAPABILITY,
                    "budget": candidate.BUDGET, "selection": [list(row) for row in candidate.SELECTION],
                    "metadataCounts": {"train": 48, "validation": 8}, "validationRgbRead": False,
                    "qualificationGranted": False, "workorder": {"path": "synthetic", "sha256": "fixture"},
                    "bindings": [{"path": "a.py", "sha256": "fixture-a"}]}
        reader = FakeReader(Path("synthetic"))
        with patch.object(candidate, "prepare_bindings", return_value=manifest): candidate.authenticate(reader, manifest)
        self.assertEqual(reader.observed, manifest["bindings"])
        with patch.object(candidate, "prepare_bindings", return_value={**manifest, "sourceClosure": ["changed"]}):
            with self.assertRaises(ValueError): candidate.authenticate(reader, manifest)

    def test_contract_has_fixed_sources_zero_updates_and_no_gpu_qualification(self):
        self.assertEqual([row[0] for row in candidate.SELECTION], [2, 3, 0, 1])
        self.assertEqual(candidate.BUDGET["optimizerSteps"], 0)
        self.assertEqual(candidate.BUDGET["seconds"], 180)
        self.assertEqual(candidate.CAPABILITY, "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1")


if __name__ == "__main__": unittest.main()
