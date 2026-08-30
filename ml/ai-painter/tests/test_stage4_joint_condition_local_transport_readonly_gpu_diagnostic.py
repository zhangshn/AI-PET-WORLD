from __future__ import annotations

import inspect
import json
from pathlib import Path
import shutil
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_ROOT = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE_ROOT = ROOT / "ml" / "ai-painter" / "src"
for source_path in (SCRIPTS_ROOT, SOURCE_ROOT):
    if str(source_path) not in sys.path:
        sys.path.insert(0, str(source_path))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
import run_stage4_joint_condition_local_transport_readonly_gpu_diagnostic as runner


class Stage4JointConditionLocalTransportReadonlyGpuDiagnosticTests(
    unittest.TestCase
):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()

    def _new_active_case(self):
        run_id = f"joint-local-transport-readonly-{uuid4().hex}"
        output_namespace = runner.OUTPUT_NAMESPACE / run_id
        attempt = ROOT / "ml" / "ai-painter" / "tests" / (
            f".joint-local-transport-active-{uuid4().hex}"
        )
        attempt.mkdir(exist_ok=False)
        config_path = attempt / "active-config.json"
        active = {
            "schemaVersion": (
                "stage4-joint-condition-local-transport-readonly-gpu-"
                "active-config-v1"
            ),
            "status": "readonly_gpu_qualification_active",
            "architectureId": runner.ARCHITECTURE_ID,
            "denoiserArchitecture": runner.ARCHITECTURE_ID,
            "capabilityVersion": runner.ARCHITECTURE_ID,
            "executionIdentity": {
                "runId": run_id,
                "outputNamespace": output_namespace.as_posix(),
            },
        }
        config_path.write_text(
            json.dumps(active, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return {
            "runId": run_id,
            "outputNamespace": output_namespace,
            "attempt": attempt,
            "configPath": config_path,
            "active": active,
        }

    def _cleanup_case(self, case):
        output = ROOT / case["outputNamespace"]
        if output.is_dir():
            shutil.rmtree(output)
        if case["attempt"].is_dir():
            shutil.rmtree(case["attempt"])

    def test_active_config_sha_architecture_and_output_identity_are_exact(self):
        case = self._new_active_case()
        try:
            validated = runner.validate_active_config_binding(
                case["configPath"].relative_to(ROOT),
                runner.sha256_file(case["configPath"]),
                case["outputNamespace"],
            )
            self.assertEqual(validated["runId"], case["runId"])
            self.assertEqual(
                validated["activeConfigBinding"],
                runner._binding(case["configPath"]),
            )
            self.assertFalse(validated["outputDir"].exists())

            with self.assertRaisesRegex(ValueError, "config_sha256_mismatch"):
                runner.validate_active_config_binding(
                    case["configPath"].relative_to(ROOT),
                    "0" * 64,
                    case["outputNamespace"],
                )
            changed = dict(case["active"])
            changed["architectureId"] = (
                "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
            )
            case["configPath"].write_text(
                json.dumps(changed, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "config_identity_invalid"):
                runner.validate_active_config_binding(
                    case["configPath"].relative_to(ROOT),
                    runner.sha256_file(case["configPath"]),
                    case["outputNamespace"],
                )
            case["configPath"].write_text(
                json.dumps(case["active"], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "output_namespace_invalid"):
                runner.validate_active_config_binding(
                    case["configPath"].relative_to(ROOT),
                    runner.sha256_file(case["configPath"]),
                    runner.OUTPUT_NAMESPACE / "different-run-00000000",
                )
        finally:
            self._cleanup_case(case)

    def test_model_has_exact_24_unshared_transport_tensors(self):
        self.torch.manual_seed(runner.SEED)
        model = build_complete_world_system(
            runner.build_qualification_model_config()
        ).eval()
        identity = runner.validate_transport_parameter_identity(model.denoiser)
        self.assertEqual(identity["parameterTensorCount"], 24)
        self.assertEqual(identity["parameterObjectIdentityCount"], 24)
        self.assertEqual(identity["parameterCount"], 22_464)
        self.assertEqual(
            identity["parameterShapes"],
            {
                name: list(shape)
                for name, shape in (
                    runner.EXPECTED_TRANSPORT_PARAMETER_SHAPES.items()
                )
            },
        )
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))

    def test_gradient_summaries_require_all_channels_and_each_tensor(self):
        torch = self.torch
        condition_gradient = torch.ones(runner.CONDITION_SHAPE)
        summary = runner.summarize_condition_gradient(condition_gradient)
        self.assertTrue(summary["all23ChannelsFiniteNonzero"])
        self.assertEqual(len(summary["perChannelMaximumAbsoluteGradient"]), 23)
        missing_channel = condition_gradient.clone()
        missing_channel[:, 11] = 0
        with self.assertRaisesRegex(ValueError, "condition_gradient_invalid"):
            runner.summarize_condition_gradient(missing_channel)

        parameter_name = "block0.local_transport_norm1.weight"
        valid = torch.ones(
            runner.EXPECTED_TRANSPORT_PARAMETER_SHAPES[parameter_name]
        )
        parameter_summary = runner.summarize_transport_parameter_gradient(
            parameter_name,
            valid,
        )
        self.assertTrue(parameter_summary["finite"])
        self.assertTrue(parameter_summary["nonzero"])
        with self.assertRaisesRegex(ValueError, "gradient_invalid"):
            runner.summarize_transport_parameter_gradient(
                parameter_name,
                torch.zeros_like(valid),
            )
        with self.assertRaisesRegex(ValueError, "unknown_parameter"):
            runner.summarize_transport_parameter_gradient(
                "block0.unregistered.weight",
                valid,
            )

    def test_formal_sources_and_two_sample_identities_are_exact(self):
        model_config = runner.build_qualification_model_config()
        inputs = runner.resolve_formal_inputs(model_config)
        self.assertEqual(inputs["splitCounts"], runner.EXPECTED_SPLIT_COUNTS)
        self.assertEqual(
            inputs["firstTrainSampleId"],
            runner.FIRST_TRAIN_SAMPLE_ID,
        )
        self.assertEqual(
            inputs["validationSampleId"],
            runner.VALIDATION_SAMPLE_ID,
        )
        self.assertEqual(
            tuple(inputs["trainSample"]["conditions"].shape),
            (23, 192, 256),
        )
        self.assertEqual(
            tuple(inputs["validationSample"]["conditions"].shape),
            (23, 192, 256),
        )
        self.assertEqual(
            runner.sha256_file(inputs["autoencoderCheckpoint"]),
            runner.AUTOENCODER_SHA256,
        )

    def test_native_1024_resource_boundary_is_readonly_and_not_overclaimed(self):
        boundary = runner.derive_native_rgb_resource_boundary()
        self.assertEqual(boundary["nativeRgbShape"], [1, 3, 768, 1024])
        self.assertEqual(boundary["nativeLatentShape"], [1, 12, 192, 256])
        self.assertEqual(boundary["frozenAutoencoderSpatialRelation"], 4)
        self.assertEqual(
            boundary["float32StaticTensorBytes"]["condition23Channels"],
            23 * 1024 * 768 * 4,
        )
        self.assertFalse(boundary["nativeDecodeExecuted"])
        self.assertFalse(boundary["nativeTrainingExecuted"])
        self.assertFalse(boundary["nativePeakGpuMemoryMeasured"])
        self.assertFalse(boundary["nativeRuntimeFeasibilityClaimed"])

    def test_cuda_unavailable_fails_before_output_creation(self):
        case = self._new_active_case()
        output = ROOT / case["outputNamespace"]
        try:
            inputs = {
                "outputDir": output,
            }
            with patch.object(runner.torch.cuda, "is_available", return_value=False):
                with self.assertRaisesRegex(RuntimeError, "cuda_unavailable"):
                    runner.run_readonly_gpu_diagnostic(inputs)
            self.assertFalse(output.exists())
        finally:
            self._cleanup_case(case)

    def test_runner_has_no_training_checkpoint_or_mutation_primitive(self):
        source = inspect.getsource(runner)
        self.assertNotIn("torch.optim", source)
        self.assertNotIn(".backward(", source)
        self.assertNotIn("torch.save", source)
        self.assertNotIn("load_denoiser_checkpoint", source)
        self.assertNotIn("initial-denoiser-checkpoint", source)
        self.assertNotIn("train_ai_assisted_conditional_denoiser.main", source)
        self.assertIn("torch.autograd.grad", source)
        self.assertIn("trainer.load_autoencoder_checkpoint", source)
        self.assertIn("torch.cuda.max_memory_allocated", source)
        self.assertIn("state_dict_sha256", source)


if __name__ == "__main__":
    unittest.main()
