"""Support-weight1 configuration metadata only; fixtures grant no qualification.

No model is constructed, no tensor objective is evaluated, and no Checkpoint
archive is written. Patched route metadata exercises configuration boundaries;
the optional actual-policy case reads the immutable JSON without accepting it.
"""
from contextlib import ExitStack, contextmanager
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
os.environ["OPENBLAS_NUM_THREADS"] = "2"
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]

import torch
torch.set_num_threads(2)
from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as codec

NEW_CAPABILITY = "stage4_mvp256_dry_decode1_support_structure_weight1_v1"
WEIGHT = "objectSupportStructureWeight"
ASSETS = {"path": "metadata-fixture/candidate.json", "sha256": "a" * 64}
POLICY_V8 = ROOT / "data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v8.json"
CALLS = {name: 0 for name in ("modelConstruction", "moduleForward", "autograd", "optimizer", "cuda", "checkpointArchive")}


def binding(logical, digit):
    return {"path": logical, "sha256": digit * 64}


def route_fixture(capability, policy_value):
    """Unqualified metadata fixture, deliberately distinct from registered policy."""
    new = capability == NEW_CAPABILITY
    selector = "d1-ss1-v1" if new else "decode1-entry-quality-v1"
    return {
        "capability": capability, "completion": True, "qualification_completion": True,
        "policy": binding("metadata-fixture/" + selector + "-policy.json", "b"),
        "specification": binding("metadata-fixture/specification.txt", "c"),
        "preview_path": "metadata-fixture/" + selector + "-preview.json",
        "progress_policy": binding("metadata-fixture/progress.json", "d"),
        "root_prefix": ".runtime/ai-painter/metadata-fixture-" + selector + "/",
        "run_prefix": selector + "-", "package_prefix": selector + "-package-",
        "policy_value": deepcopy(policy_value),
    }


@contextmanager
def metadata_route(capability=NEW_CAPABILITY, policy_value=None):
    value = {WEIGHT: 1} if policy_value is None else policy_value
    route = route_fixture(capability, value)
    with patch.object(codec, "execution_values", return_value=route), \
            patch.object(codec, "source_assets", return_value=deepcopy(ASSETS)):
        yield route, binding(route["preview_path"], "e")


def metadata_arguments(configuration, route):
    run = route["run_prefix"] + "metadata-fixture"
    roles = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
    selection = {"epoch": 24, "worstApplicableObjectCorrelation": 0.1,
        "meanValidationRgbMae": 0.2, "applicableImageCounts": {role: 8 for role in roles},
        "rank": [0.1, -0.2, -24], "qualificationGranted": False, "checkpointPromotionEligible": False}
    return dict(configuration=configuration, run_id=run,
        package_binding=binding(".runtime/ai-painter/autonomous-closed-loop-packages/" + route["package_prefix"] + "metadata-fixture/package.json", "f"),
        dataset_binding=binding("metadata-fixture/dataset.json", "1"), epoch=24,
        selection=selection, counts={"generator": 1152, "discriminator": 1152},
        program_bindings={"fixture": binding("metadata-fixture/source.py", "2")},
        plan_binding=binding(route["root_prefix"] + run + "/quality-plan.json", "3"))


class SupportWeight1ConfigurationMetadataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = ExitStack()
        def forbidden(name):
            def fail(*args, **kwargs):
                CALLS[name] += 1
                raise AssertionError("metadata-only suite prohibited " + name)
            return fail
        for target, name, category in (
            (torch.nn.Module, "__init__", "modelConstruction"),
            (torch.nn.Module, "_call_impl", "moduleForward"),
            (torch.autograd, "grad", "autograd"), (torch.autograd, "backward", "autograd"),
            (torch.optim.Optimizer, "__init__", "optimizer"), (torch.optim.Optimizer, "step", "optimizer"),
            (torch.cuda, "_lazy_init", "cuda"), (torch.cuda, "init", "cuda"),
            (torch, "save", "checkpointArchive"), (torch, "load", "checkpointArchive"),
        ):
            cls.guards.enter_context(patch.object(target, name, forbidden(category)))

    @classmethod
    def tearDownClass(cls):
        cls.guards.close()
        if any(CALLS.values()) or torch.cuda.is_initialized():
            raise AssertionError("metadata-only boundary violated: " + repr(CALLS))

    def test_new_capability_derives_exact_integer_one(self):
        self.assertEqual(codec.SUPPORT_WEIGHT1_CAPABILITY, NEW_CAPABILITY)
        with metadata_route() as (route, preview):
            result = codec.expected_configuration(preview, NEW_CAPABILITY)
            self.assertIs(type(result[WEIGHT]), int)
            self.assertEqual(result[WEIGHT], 1)
            self.assertEqual(result["capabilityVersion"], NEW_CAPABILITY)
            self.assertEqual(result["executionPolicy"], route["policy"])
            self.assertIsNone(result["executionCeiling"]["maxWallSeconds"])
            self.assertEqual(result["executionCeiling"]["epochs"], 24)
            codec.validate_configuration(result)

    def test_new_policy_missing_weight_is_rejected(self):
        with metadata_route(policy_value={}) as (_route, preview):
            with self.assertRaisesRegex(ValueError, "registered support weight1 policy required"):
                codec.expected_configuration(preview, NEW_CAPABILITY)

    def test_boolean_policy_weights_are_rejected(self):
        for value in (True, False):
            with self.subTest(value=value), metadata_route(policy_value={WEIGHT: value}) as (_route, preview):
                with self.assertRaisesRegex(ValueError, "registered support weight1 policy required"):
                    codec.expected_configuration(preview, NEW_CAPABILITY)

    def test_float_one_policy_weight_is_rejected(self):
        with metadata_route(policy_value={WEIGHT: 1.0}) as (_route, preview):
            with self.assertRaisesRegex(ValueError, "registered support weight1 policy required"):
                codec.expected_configuration(preview, NEW_CAPABILITY)

    def test_other_policy_weights_are_rejected(self):
        for value in (0, 2, -1, 0.1, "1", None, [], {}):
            with self.subTest(value=value), metadata_route(policy_value={WEIGHT: value}) as (_route, preview):
                with self.assertRaisesRegex(ValueError, "registered support weight1 policy required"):
                    codec.expected_configuration(preview, NEW_CAPABILITY)

    def test_legacy_configuration_keeps_original_shape(self):
        with metadata_route(codec.CAPABILITY, {}) as (_route, preview):
            result = codec.expected_configuration(preview, codec.CAPABILITY)
            self.assertNotIn(WEIGHT, result)
            codec.validate_configuration(result)

    def test_legacy_policy_cannot_activate_new_weight(self):
        for value in (1, 1.0, True, 0.1, None):
            with self.subTest(value=value), metadata_route(codec.CAPABILITY, {WEIGHT: value}) as (_route, preview):
                with self.assertRaisesRegex(ValueError, "legacy policy cannot activate support weight1"):
                    codec.expected_configuration(preview, codec.CAPABILITY)

    def test_new_configuration_weight_mutation_or_omission_is_rejected(self):
        with metadata_route() as (_route, preview):
            original = codec.expected_configuration(preview, NEW_CAPABILITY)
            for value in (0.1, 0, 2, True, 1.0, None, "1"):
                changed = deepcopy(original); changed[WEIGHT] = value
                with self.subTest(value=value), self.assertRaisesRegex(ValueError, "configuration identity differs"):
                    codec.validate_configuration(changed)
            changed = deepcopy(original); del changed[WEIGHT]
            with self.assertRaisesRegex(ValueError, "configuration identity differs"):
                codec.validate_configuration(changed)

    def test_legacy_configuration_cannot_carry_new_field(self):
        with metadata_route(codec.CAPABILITY, {}) as (_route, preview):
            result = codec.expected_configuration(preview, codec.CAPABILITY)
            result[WEIGHT] = 1
            with self.assertRaisesRegex(ValueError, "configuration identity differs"):
                codec.validate_configuration(result)

    def test_configuration_digest_binds_weight_value_and_json_type(self):
        with metadata_route() as (_route, preview):
            result = codec.expected_configuration(preview, NEW_CAPABILITY)
            expected = hashlib.sha256(json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode()).hexdigest()
            self.assertEqual(codec.configuration_digest(result), expected)
            for value in (0.1, 1.0, True):
                changed = deepcopy(result); changed[WEIGHT] = value
                self.assertNotEqual(codec.configuration_digest(changed), expected)

    def test_checkpoint_metadata_binds_weight_and_rejects_legacy_weight(self):
        with metadata_route() as (route, preview):
            configuration = codec.expected_configuration(preview, NEW_CAPABILITY)
            args = metadata_arguments(configuration, route)
            metadata = codec._metadata(**args)
            self.assertEqual(metadata["configuration"][WEIGHT], 1)
            self.assertEqual(metadata["configurationSha256"], codec.configuration_digest(configuration))
            self.assertEqual(metadata["capabilityVersion"], NEW_CAPABILITY)
            self.assertFalse(metadata["checkpointQualified"])
            self.assertFalse(metadata["automaticResumeAllowed"])
            configuration[WEIGHT] = 0.1
            self.assertEqual(metadata["configuration"][WEIGHT], 1)
            with self.assertRaisesRegex(ValueError, "configuration identity differs"):
                codec._metadata(**args)

    def test_current_policy_json_metadata_only_without_execution_acceptance(self):
        # This is not an actual registry/package/CPU/GPU acceptance assertion.
        if not POLICY_V8.is_file():
            self.assertFalse(POLICY_V8.exists())
            return
        raw = POLICY_V8.read_bytes(); value = json.loads(raw)
        self.assertEqual(value["candidate"], NEW_CAPABILITY)
        self.assertIs(type(value[WEIGHT]), int)
        self.assertEqual(value[WEIGHT], 1)
        self.assertFalse(value["qualification"]["gpuQualified"])
        self.assertFalse(value["qualification"]["trainingQualified"])
        with metadata_route(policy_value=value) as (_route, preview):
            self.assertEqual(codec.expected_configuration(preview, NEW_CAPABILITY)[WEIGHT], 1)
        legacy = json.loads((POLICY_V8.parent / "ai-painter-decode1-entry-weight-quality-execution-policy-v7.json").read_bytes())
        self.assertNotIn(WEIGHT, legacy)
        with metadata_route(codec.CAPABILITY, legacy) as (_route, preview):
            self.assertNotIn(WEIGHT, codec.expected_configuration(preview, codec.CAPABILITY))


if __name__ == "__main__":
    unittest.main(verbosity=2)
