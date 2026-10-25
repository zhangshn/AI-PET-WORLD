"""Publication metadata compatibility; no model, GPU, execution or fixture grants."""
from types import SimpleNamespace
import unittest
import decode1_entry_weight_quality_auth_v1 as auth


DATASET = {"path": "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7/manifest.json",
    "sha256": "499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23"}
ORIGINAL = {"path": "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
    "sha256": "48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909"}
BASELINE = {"path": "data/ai-painter/system-governance/document-baselines/"
    "review-storage-1.25-48d9b177.txt", "sha256": ORIGINAL["sha256"]}


class PublicationDocumentTests(unittest.TestCase):
    def call(self, binding=ORIGINAL, dataset=DATASET, **history):
        calls = []
        reader = SimpleNamespace(_review_history=None, _fit_history=None,
            read=lambda b: calls.append(b) or b)
        for key, value in history.items():
            setattr(reader, key, value)
        auth.read_published_source_input(reader, binding, dataset)
        return calls

    def test_exact_published_document_uses_exact_frozen_bytes(self):
        self.assertEqual(self.call(), [BASELINE])

    def test_existing_byte_count_carrier_keeps_its_binding_identity(self):
        self.assertEqual(self.call(binding={**ORIGINAL, "bytes": 67784}), [BASELINE])

    def test_other_dataset_cannot_use_the_mapping(self):
        self.assertEqual(self.call(dataset={**DATASET, "sha256": "0" * 64}), [ORIGINAL])

    def test_unknown_document_revision_cannot_use_the_mapping(self):
        value = {**ORIGINAL, "sha256": "0" * 64}
        self.assertEqual(self.call(binding=value), [value])

    def test_source_programs_and_other_paths_keep_normal_reader(self):
        value = {"path": "scripts/lib/ai-painter-source-correction-publication-v1.mjs", "sha256": "a" * 64}
        self.assertEqual(self.call(binding=value), [value])

    def test_existing_readonly_histories_are_not_mixed(self):
        self.assertEqual(self.call(_review_history=object()), [ORIGINAL])
        self.assertEqual(self.call(_fit_history=object()), [ORIGINAL])

    def test_missing_or_tampered_baseline_error_is_not_swallowed(self):
        def reject(binding):
            self.assertEqual(binding, BASELINE)
            raise ValueError("binding SHA differs")
        reader = SimpleNamespace(_review_history=None, _fit_history=None, read=reject)
        with self.assertRaisesRegex(ValueError, "binding SHA differs"):
            auth.read_published_source_input(reader, ORIGINAL, DATASET)


if __name__ == "__main__":
    unittest.main()
