"""Synthetic CPU checks; no training, production Run, weights, or image writes."""

from dataclasses import replace
import builtins
import hashlib
import json
import os
from pathlib import Path
import random
import struct
import unittest
from unittest.mock import patch
import zlib

import numpy as np
import torch

from ai_painter.complete_world.training_preview_observer_v1 import (
    Binding, BudgetSnapshot, CAPTURE_METADATA_RESERVED_BYTES, CAPTURE_RESERVED_BYTES,
    MAX_METADATA_BYTES, MAX_PNG_BYTES, PREVIEW_BYTES, PreviewIdentity, PreviewRejected,
    TERMINAL_RESERVED_BYTES, TOTAL_BYTES, TrainingPreviewObserver,
)


def identity(epoch=1, ordinal=0, **changes):
    binding = Binding("data/synthetic/input.json", "a" * 64)
    values = dict(run_id="synthetic-run", package_id="synthetic-package",
        capability_version="synthetic-capability", model_capability_version="synthetic-model",
        epoch=epoch, train_ordinal=ordinal, train_index=3, sample_id="synthetic-sample",
        generator_updates=(epoch - 1) * 48 + ordinal,
        discriminator_updates=(epoch - 1) * 48 + ordinal + 1, forward_sequence=epoch * 100,
        execution_package=Binding(".runtime/ai-painter/autonomous-closed-loop-packages/"
                                  "synthetic-package/package.json", "b" * 64),
        plan=binding, model=binding, dataset_manifest=binding, source_rgb=binding,
        condition_pack=binding, world_facts=binding,
        configuration_sha256="c" * 64, program_bindings_sha256="d" * 64)
    values.update(changes)
    return PreviewIdentity(**values)


def frame():
    return torch.linspace(0, 1, 3 * 192 * 256, dtype=torch.float32).reshape(1, 3, 192, 256)


def decode_png(png):
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    offset, payload, kinds = 8, b"", []
    while offset < len(png):
        size = struct.unpack(">I", png[offset:offset + 4])[0]
        kind = png[offset + 4:offset + 8]
        data = png[offset + 8:offset + 8 + size]
        crc = struct.unpack(">I", png[offset + 8 + size:offset + 12 + size])[0]
        assert crc == zlib.crc32(kind + data) & 0xffffffff
        if kind == b"IHDR":
            assert struct.unpack(">IIBBBBB", data) == (256, 192, 8, 2, 0, 0, 0)
        if kind == b"IDAT":
            payload += data
        kinds.append(kind)
        offset += size + 12
    assert kinds == [b"IHDR", b"IDAT", b"IEND"]
    raw = zlib.decompress(payload)
    assert len(raw) == 192 * 769
    assert all(raw[row * 769] == 0 for row in range(192))
    return b"".join(raw[row * 769 + 1:(row + 1) * 769] for row in range(192))


class TrainingPreviewObserverCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def setUp(self):
        self.observer = TrainingPreviewObserver(enable_component_only=True)
        self.budget = BudgetSnapshot(0)

    def test_disabled_does_not_inspect_inputs(self):
        observer = TrainingPreviewObserver()
        self.assertFalse(observer.should_capture(object()))
        self.assertIsNone(observer.observe(object(), object(), object()))
        self.assertIsNone(observer.mark_failure(epoch=object(), train_ordinal=object(), budget=object()))
        self.assertEqual(observer.emitted_bytes, 0)

    def test_png_is_real_rgb_and_explicitly_unaudited(self):
        value = frame()
        artifact = self.observer.observe(value, identity(), self.budget)
        self.assertEqual(decode_png(artifact.png),
                         (value[0] * 255).round().to(torch.uint8).permute(1, 2, 0)
                         .contiguous().numpy().tobytes())
        record = json.loads(artifact.metadata)
        self.assertEqual(record["capture"]["generator_updates"], 0)
        self.assertEqual(record["capture"]["discriminator_updates"], 1)
        self.assertEqual(record["review_status"], "not_reviewed_diagnostic_only")
        self.assertEqual(record["policy_status"], "proposal_unapproved_component_only")
        for key in ("checkpoint_selection_eligible", "qualification_evidence",
                    "runtime_publication_eligible", "formal_output", "production_integrated"):
            self.assertIs(record[key], False)
        self.assertEqual(record["png_sha256"], hashlib.sha256(artifact.png).hexdigest())
        self.assertEqual(artifact.png_path, "training-previews/epoch-0001.png")
        self.assertEqual(artifact.metadata_path, "training-previews/epoch-0001.json")
        self.assertLessEqual(len(artifact.png), MAX_PNG_BYTES)
        self.assertLessEqual(len(artifact.metadata), MAX_METADATA_BYTES)
        self.assertEqual(self.observer.emitted_bytes, artifact.byte_count)

    def test_observation_has_no_training_io_rng_or_tensor_side_effects(self):
        value = frame()
        raw, version, address = value.clone(), value._version, value.data_ptr()
        torch_rng, python_rng, numpy_rng = torch.get_rng_state().clone(), random.getstate(), np.random.get_state()
        grad_enabled = torch.is_grad_enabled()
        blocked = AssertionError("observer attempted training, CUDA initialization, or file I/O")
        with patch.object(builtins, "open", side_effect=blocked), \
             patch.object(os, "open", side_effect=blocked), \
             patch.object(Path, "open", side_effect=blocked), \
             patch.object(torch.nn.Module, "_call_impl", side_effect=blocked), \
             patch.object(torch.autograd, "grad", side_effect=blocked), \
             patch.object(torch.autograd, "backward", side_effect=blocked), \
             patch.object(torch.optim.Optimizer, "step", side_effect=blocked), \
             patch.object(torch.cuda, "_lazy_init", side_effect=blocked):
            self.observer.observe(value, identity(), self.budget)
        self.assertTrue(torch.equal(value, raw))
        self.assertEqual((value._version, value.data_ptr()), (version, address))
        self.assertIsNone(value.grad)
        self.assertTrue(torch.equal(torch_rng, torch.get_rng_state()))
        self.assertEqual(python_rng, random.getstate())
        after = np.random.get_state()
        self.assertEqual(numpy_rng[0], after[0])
        np.testing.assert_array_equal(numpy_rng[1], after[1])
        self.assertEqual(numpy_rng[2:], after[2:])
        self.assertEqual(grad_enabled, torch.is_grad_enabled())

    def test_encoding_deterministic(self):
        first = self.observer.observe(frame(), identity(), self.budget)
        second = TrainingPreviewObserver(enable_component_only=True).observe(frame(), identity(), self.budget)
        self.assertEqual(first, second)

    def test_nondue_duplicate_and_epoch_regression(self):
        self.assertIsNone(self.observer.observe(object(), identity(1, 1), object()))
        self.observer.observe(frame(), identity(), self.budget)
        self.assertIsNone(self.observer.observe(object(), identity(), object()))
        self.observer.observe(frame(), identity(3), self.budget)
        with self.assertRaisesRegex(PreviewRejected, "regression"):
            self.observer.should_capture(identity(2))

    def test_wrong_tensor_rejected_before_state_commit(self):
        nan, high, low = frame(), frame(), frame()
        nan[0, 0, 0, 0], high[0, 0, 0, 0], low[0, 0, 0, 0] = float("nan"), 1.01, -0.01
        invalid = [object(), frame().requires_grad_(), frame().double(), frame()[:, :, :, :255],
                   frame().transpose(2, 3), torch.empty((1, 3, 192, 256), device="meta"), nan, high, low]
        for value in invalid:
            with self.subTest(type=type(value)), self.assertRaises(PreviewRejected):
                self.observer.observe(value, identity(), self.budget)
            self.assertEqual(self.observer.emitted_bytes, 0)
            self.assertTrue(self.observer.should_capture(identity()))

    def test_identity_and_bindings_fail_closed(self):
        for changes in (dict(split="validation"), dict(phase="post_update"), dict(epoch=True),
                        dict(train_index=48), dict(generator_updates=1), dict(discriminator_updates=0),
                        dict(forward_sequence=0), dict(run_id="../other"),
                        dict(configuration_sha256="not-a-digest"),
                        dict(source_rgb=Binding("../source.png", "a" * 64)),
                        dict(source_rgb=Binding("C:/source.png", "a" * 64)),
                        dict(execution_package=Binding("data/package.json", "b" * 64))):
            with self.subTest(changes=changes), self.assertRaises(PreviewRejected):
                self.observer.observe(object(), identity(**changes), self.budget)
        self.assertEqual(self.observer.emitted_bytes, 0)

    def test_cannot_switch_run_or_source_program_in_observer(self):
        self.observer.observe(frame(), identity(), self.budget)
        for change in (dict(run_id="other-run"), dict(model=Binding("data/other", "e" * 64)),
                       dict(program_bindings_sha256="e" * 64)):
            with self.subTest(change=change), self.assertRaisesRegex(PreviewRejected, "run binding"):
                self.observer.should_capture(identity(2, **change))

    def test_failure_is_only_reference_to_prior_image(self):
        captured = self.observer.observe(frame(), identity(2), self.budget)
        artifact = self.observer.mark_failure(epoch=3, train_ordinal=17, budget=self.budget)
        record = json.loads(artifact.metadata)
        self.assertIsNone(artifact.png)
        self.assertIsNone(artifact.png_path)
        self.assertEqual(record["capture"]["epoch"], 2)
        self.assertEqual(record["failure_position"], dict(epoch=3, train_ordinal=17))
        self.assertEqual(record["png_path"], captured.png_path)
        self.assertIs(record["image_is_failure_forward"], False)
        self.assertIs(record["regenerated"], False)
        with self.assertRaises(PreviewRejected):
            self.observer.mark_failure(epoch=3, train_ordinal=18, budget=self.budget)
        with self.assertRaises(PreviewRejected):
            self.observer.observe(frame(), identity(4), self.budget)

    def test_no_prior_image_means_no_failure_artifact(self):
        self.assertIsNone(self.observer.mark_failure(epoch=1, train_ordinal=0, budget=self.budget))
        self.assertEqual(self.observer.emitted_bytes, 0)
        with self.assertRaises(PreviewRejected):
            self.observer.should_capture(identity())

    def test_failure_cannot_precede_capture(self):
        self.observer.observe(frame(), identity(2), self.budget)
        with self.assertRaises(PreviewRejected):
            self.observer.mark_failure(epoch=1, train_ordinal=47, budget=self.budget)
        self.assertIsNotNone(self.observer.mark_failure(epoch=2, train_ordinal=0, budget=self.budget))

    def test_full_proposed_schedule_has_at_most_24_pngs_25_records(self):
        total = 0
        for epoch in range(1, 25):
            artifact = self.observer.observe(frame(), identity(epoch), self.budget)
            total += artifact.byte_count
        total += self.observer.mark_failure(epoch=24, train_ordinal=47, budget=self.budget).byte_count
        self.assertEqual(total, self.observer.emitted_bytes)
        self.assertLessEqual(total, PREVIEW_BYTES)
        self.assertLessEqual(24 * MAX_PNG_BYTES + 25 * MAX_METADATA_BYTES, PREVIEW_BYTES)

    def test_budget_exact_boundary_preserves_existing_reserves(self):
        artifact = self.observer.observe(frame(), identity(), self.budget)
        available = (TOTAL_BYTES - CAPTURE_RESERVED_BYTES - CAPTURE_METADATA_RESERVED_BYTES
                     - TERMINAL_RESERVED_BYTES)
        accepted = TrainingPreviewObserver(enable_component_only=True)
        accepted.observe(frame(), identity(), BudgetSnapshot(available - artifact.byte_count))
        denied = TrainingPreviewObserver(enable_component_only=True)
        with self.assertRaisesRegex(PreviewRejected, "reserves"):
            denied.observe(frame(), identity(), BudgetSnapshot(available - artifact.byte_count + 1))
        self.assertEqual(denied.emitted_bytes, 0)
        self.assertTrue(denied.should_capture(identity()))

    def test_meter_does_not_double_count_written_artifacts(self):
        artifact = self.observer.observe(frame(), identity(), self.budget)
        size = artifact.byte_count
        self.observer.observe(frame(), identity(2), BudgetSnapshot(size, size))
        with self.assertRaisesRegex(PreviewRejected, "regression"):
            self.observer.observe(frame(), identity(3), BudgetSnapshot(0, 0))
        self.assertTrue(self.observer.should_capture(identity(3)))

    def test_invalid_meters_cannot_grant_space(self):
        for meter in (BudgetSnapshot(-1), BudgetSnapshot(TOTAL_BYTES + 1),
                      BudgetSnapshot(0, 1), BudgetSnapshot(True), object()):
            with self.subTest(meter=meter), self.assertRaises(PreviewRejected):
                self.observer.observe(frame(), identity(), meter)
        self.assertEqual(self.observer.emitted_bytes, 0)


if __name__ == "__main__":
    unittest.main()
