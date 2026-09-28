"""CPU counterfactuals for the inactive learned object branch."""

import json
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from copy import deepcopy

import torch

from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    build_native_rgb_instance_object_prototype,
    train_original_instance_objective,
    validation_instance_object_score,
)
from ai_painter.complete_world.object_instance_supervision_cpu import load_bound_object_sample
from ai_painter.complete_world.object_instance_supervision_cpu import (
    PATCH_SIZE, _crop, iter_object_views,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                         .read_text(encoding="utf-8"))["tensorContract"]["channelOrder"])


def scene(x=40, y=40, label=7, *, present=True, kind="tree"):
    conditions = torch.zeros((1, 23, 192, 256))
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("coordinate_x")] = torch.arange(256)[None, None, None, :] / 256
    conditions[:, ORDER.index("coordinate_y")] = torch.arange(192)[None, None, :, None] / 192
    if not present:
        return conditions, []
    role = {"tree": "object_tree", "rock": "object_rock",
            "shrub": "object_vegetation", "grass_detail": "object_vegetation"}[kind]
    conditions[:, ORDER.index(role), y:y + 4, x:x + 4] = 1
    conditions[:, ORDER.index("object_instance"), y:y + 4, x:x + 4] = label / 255
    table = [{"value": label, "kind": kind, "footprint": {
        "x": x * 4, "y": y * 4, "width": 16, "height": 16,
    }}]
    return conditions, table


class InstanceObjectRendererCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        torch.manual_seed(19)
        cls.model = build_native_rgb_instance_object_prototype(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16,
        ).eval()

    def test_full_rgb_is_neural_and_bounded_to_one_subject(self):
        conditions, table = scene()
        with torch.no_grad():
            rgb, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(tuple(rgb.shape), (1, 3, 192, 256))
        self.assertEqual(evidence["objectCount"], 1)
        self.assertTrue(bool(((rgb >= 0) & (rgb <= 1)).all()))
        self.assertGreater(float(evidence["objectLogitResidual"].abs().max()), 0)
        self.assertEqual(float(evidence["objectLogitResidual"][..., 0, 0].abs().max()), 0)

    def test_arbitrary_instance_renumbering_does_not_change_rgb(self):
        a, ta = scene(label=7)
        b, tb = scene(label=31)
        with torch.no_grad():
            first, second = self.model(a, ta), self.model(b, tb)
        self.assertTrue(torch.allclose(first, second, atol=1e-7, rtol=0))

    def test_move_and_delete_are_local_and_restore_base(self):
        a, ta = scene(x=40, y=40)
        b, tb = scene(x=120, y=100)
        empty, no_objects = scene(present=False)
        with torch.no_grad():
            first = self.model(a, ta)
            moved = self.model(b, tb)
            deleted, evidence = self.model(empty, no_objects, return_evidence=True)
        self.assertGreater(float((first - moved)[..., 35:65, 35:65].abs().max()), 1e-5)
        self.assertGreater(float((first - moved)[..., 95:125, 115:145].abs().max()), 1e-5)
        self.assertTrue(torch.allclose(first[..., :10, :10], moved[..., :10, :10], atol=1e-7))
        self.assertEqual(evidence["objectCount"], 0)
        self.assertTrue(torch.allclose(deleted, evidence["baseRgb"], atol=1e-7))

    def test_bound_vegetation_kind_changes_render_without_changing_23_channels(self):
        shrub, shrub_table = scene(kind="shrub")
        grass, grass_table = scene(kind="grass_detail")
        self.assertTrue(torch.equal(shrub, grass))
        with torch.no_grad():
            first = self.model(shrub, shrub_table)
            second = self.model(grass, grass_table)
        self.assertGreater(float((first - second).abs().max()), 1e-7)
        self.assertTrue(torch.allclose(first[..., :10, :10], second[..., :10, :10], atol=1e-7))

    def test_batched_object_head_matches_individual_object_predictions(self):
        conditions, table = scene()
        conditions[:, ORDER.index("object_rock"), 105:109, 120:124] = 1
        conditions[:, ORDER.index("object_instance"), 105:109, 120:124] = 13 / 255
        table.append({"value": 13, "kind": "rock", "footprint": {
            "x": 480, "y": 420, "width": 16, "height": 16,
        }})
        views = list(iter_object_views(conditions[0], table, ORDER))
        with torch.no_grad():
            _, core = self.model.core(conditions, return_evidence=True)
            base_logits = core["finalLogits"] - sum(
                core["responsibilityLogitContributions"][role]
                for role in ("object_tree", "object_rock", "object_vegetation")
            )
            base_rgb = torch.sigmoid(base_logits[0])
            backgrounds = torch.stack([
                _crop(base_rgb, view.top, view.left, PATCH_SIZE)[0] for view in views
            ])
            batched = self.model.object_head(views, backgrounds)
            separate = torch.cat([
                self.model.object_head([view], background[None])
                for view, background in zip(views, backgrounds, strict=True)
            ])
            complete, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(evidence["objectCount"], 2)
        self.assertEqual(tuple(complete.shape), (1, 3, 192, 256))
        self.assertTrue(torch.allclose(batched, separate, atol=1e-6, rtol=1e-6))

    def test_sparse_assembly_matches_full_frame_reference_at_border_and_overlap(self):
        conditions, table = scene(x=0, y=0)
        conditions[:, ORDER.index("object_rock"), 0:4, 5:9] = 1
        conditions[:, ORDER.index("object_instance"), 0:4, 5:9] = 13 / 255
        table.append({"value": 13, "kind": "rock", "footprint": {
            "x": 20, "y": 0, "width": 16, "height": 16,
        }})
        views = list(iter_object_views(conditions[0], table, ORDER))
        with torch.no_grad():
            _, core = self.model.core(conditions, return_evidence=True)
            base_logits = core["finalLogits"] - sum(
                core["responsibilityLogitContributions"][role]
                for role in ("object_tree", "object_rock", "object_vegetation")
            )
            base_rgb = torch.sigmoid(base_logits[0])
            backgrounds = torch.stack([
                _crop(base_rgb, view.top, view.left, PATCH_SIZE)[0] for view in views
            ])
            residuals = self.model.object_head(views, backgrounds)
            expected_sum = torch.zeros_like(base_logits)
            expected_count = torch.zeros_like(base_logits[:, :1])
            for view, residual in zip(views, residuals, strict=True):
                y0, y1 = max(0, view.top), min(192, view.top + PATCH_SIZE)
                x0, x1 = max(0, view.left), min(256, view.left + PATCH_SIZE)
                dy, dx = y0 - view.top, x0 - view.left
                expected_sum[:, :, y0:y1, x0:x1] += residual[
                    None, :, dy:dy + y1-y0, dx:dx + x1-x0]
                expected_count[:, :, y0:y1, x0:x1] += view.support_mask[
                    None, :, dy:dy + y1-y0, dx:dx + x1-x0]
            expected = torch.sigmoid(base_logits + expected_sum / expected_count.clamp_min(1))
            actual, evidence = self.model(conditions, table, return_evidence=True)
        self.assertTrue(torch.allclose(actual, expected, atol=1e-7, rtol=0))
        self.assertTrue(torch.equal(evidence["objectSupportCount"], expected_count))
        self.assertGreater(float(expected_count.max()), 1)

    def test_sparse_assembly_accepts_mixed_precision_logits_and_float32_masks(self):
        conditions, table = scene(x=0, y=0)
        for logit_dtype, residual_dtype in ((torch.float16, torch.float32),
                                            (torch.float32, torch.float16)):
            with self.subTest(logit_dtype=logit_dtype, residual_dtype=residual_dtype):
                logits = torch.zeros((1, 3, 192, 256), dtype=logit_dtype)
                contributions = {role: torch.zeros_like(logits) for role in
                                 ("object_tree", "object_rock", "object_vegetation")}
                core_result = (torch.sigmoid(logits), {
                    "finalLogits": logits, "responsibilityLogitContributions": contributions,
                })
                with torch.no_grad(), patch.object(self.model.core, "forward", return_value=core_result), \
                        patch.object(self.model.object_head, "forward",
                                     side_effect=lambda views, backgrounds: torch.full(
                                         (len(views), 3, PATCH_SIZE, PATCH_SIZE), 0.1,
                                         dtype=residual_dtype)):
                    output, evidence = self.model(conditions, table, return_evidence=True)
                self.assertEqual(output.dtype, logit_dtype)
                self.assertEqual(evidence["objectSupportCount"].dtype, logit_dtype)
                self.assertTrue(bool(torch.isfinite(output).all()))

    def test_object_head_receives_gradient_without_reference_at_inference(self):
        conditions, table = scene()
        self.model.zero_grad(set_to_none=True)
        output = self.model(conditions, table)
        output[..., 35:65, 35:65].mean().backward()
        gradients = [parameter.grad for parameter in self.model.object_head.parameters()]
        self.assertTrue(all(value is not None and bool(torch.isfinite(value).all())
                            for value in gradients))
        self.assertGreater(sum(float(value.abs().sum()) for value in gradients), 0)

    def test_mismatched_table_fails_closed(self):
        conditions, table = scene()
        table[0]["value"] = 8
        with self.assertRaisesRegex(ValueError, "labels differ"):
            self.model(conditions, table)

    def test_train_original_objective_is_differentiable_and_split_isolated(self):
        conditions, table = scene()
        sample = {"sampleId": "train-only", "split": "train",
                  "conditions": conditions[0],
                  "image": torch.zeros((3, 192, 256))}
        output = torch.full((1, 3, 192, 256), 0.3, requires_grad=True)
        score, parts = train_original_instance_objective(output, sample, table, ORDER)
        self.assertEqual(parts["instanceCount"], 1)
        self.assertGreater(float(parts["instanceSupportRgbMae"].detach()), 0)
        score.backward()
        self.assertGreater(float(output.grad[..., 35:65, 35:65].abs().sum()), 0)
        sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train split"):
            train_original_instance_objective(output.detach(), sample, table, ORDER)

    def test_validation_score_is_readonly_and_cannot_score_train_or_challenge(self):
        conditions, table = scene()
        sample = {"sampleId": "validation-only", "split": "validation",
                  "conditions": conditions[0], "image": torch.zeros((3, 192, 256))}
        predicted = torch.full((1, 3, 192, 256), 0.3, requires_grad=True)
        score, parts = validation_instance_object_score(predicted, sample, table, ORDER)
        self.assertFalse(score.requires_grad)
        self.assertEqual(parts["instanceCount"], 1)
        self.assertIsNone(predicted.grad)
        for split in ("train", "challenge", "regression"):
            sample["split"] = split
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "validation split"):
                validation_instance_object_score(predicted, sample, table, ORDER)

    def test_real_bound_train_sample_reaches_object_head_gradient(self):
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-local-texture-v12-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(root, contract["datasetManifest"], "train", (256, 192))
        sample = load_bound_object_sample(dataset, 0)
        self.model.zero_grad(set_to_none=True)
        batch_sizes = []
        hook = self.model.object_head.layers.register_forward_hook(
            lambda _module, inputs, _output: batch_sizes.append(inputs[0].shape[0]))
        try:
            predicted = self.model(sample["conditions"][None], sample["objectInstanceTable"])
        finally:
            hook.remove()
        score, parts = train_original_instance_objective(
            predicted, sample, sample["objectInstanceTable"], ORDER)
        score.backward()
        gradients = [parameter.grad for parameter in self.model.object_head.parameters()]
        self.assertEqual(parts["instanceCount"], len(sample["objectInstanceTable"]))
        self.assertEqual(batch_sizes, [len(sample["objectInstanceTable"])])
        self.assertTrue(all(value is not None and bool(torch.isfinite(value).all())
                            for value in gradients))
        self.assertGreater(sum(float(value.detach().abs().sum()) for value in gradients), 0)

    def test_candidate_cpu_gate_rejects_missing_program_and_fake_authority(self):
        script = ROOT / "ml/ai-painter/scripts/check_stage4_mvp_instance_object_v13_cpu.py"
        spec = importlib.util.spec_from_file_location("v13_cpu_check_negative_tests", script)
        checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(checker)
        real_bound_json = checker.bound_json
        original = real_bound_json(checker.ROOT, checker.binding(checker.CONTRACT_PATH))
        for change, expected in (
            (lambda value: value["programBindings"].pop("renderer"), "program set"),
            (lambda value: value["activationGates"].update({"gpuNow": True}), "execution gate"),
            (lambda value: value["reviewBinding"].update({"formalReviewDispatchable": True}),
             "formal review authority"),
        ):
            altered = deepcopy(original)
            change(altered)
            with self.subTest(expected=expected):
                with patch.object(checker, "bound_json", side_effect=lambda root, binding: (
                    altered if binding["path"] == checker.CONTRACT_PATH
                    else real_bound_json(root, binding)
                )):
                    with self.assertRaises(ValueError):
                        checker.verify_contract()


if __name__ == "__main__":
    unittest.main()
