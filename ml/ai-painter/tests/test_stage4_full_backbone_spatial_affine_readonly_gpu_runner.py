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
for path in (SCRIPTS_ROOT, SOURCE_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_full_backbone_spatial_affine_contract import (
    ARCHITECTURE_ID,
    CAPABILITY_VERSION,
    compile_full_backbone_spatial_affine_cpu_inactive_config,
    issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket,
)
from ai_painter_spatial_affine_decoder_contract import (
    load_spatial_affine_formal_objective_contract,
)
import run_stage4_full_backbone_spatial_affine_readonly_gpu_qualification as runner


class Stage4FullBackboneSpatialAffineReadonlyGpuRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()
        cls.inactive = compile_full_backbone_spatial_affine_cpu_inactive_config()
        cls.formal = load_spatial_affine_formal_objective_contract(ROOT)
        cls.run_id = f"full-backbone-readonly-{uuid4().hex}"
        cls.output_namespace = runner.OUTPUT_NAMESPACE / cls.run_id
        cls.active, cls.ticket = (
            issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket(
                dataset_package_id=cls.formal["data"]["datasetPackageId"],
                run_id=cls.run_id,
                output_namespace=cls.output_namespace.as_posix(),
                project_root=ROOT,
            )
        )
        cls.model_config = runner.build_qualification_model_config(cls.active)

    @classmethod
    def tearDownClass(cls):
        ticket_directory = ROOT / Path(cls.ticket["ticketPath"]).parent
        if ticket_directory.is_dir():
            shutil.rmtree(ticket_directory)
        try:
            ticket_directory.parent.rmdir()
        except OSError:
            pass

    def _new_claimed_case(self):
        run_id = f"full-backbone-readonly-{uuid4().hex}"
        output_namespace = runner.OUTPUT_NAMESPACE / run_id
        active, ticket = (
            issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket(
                dataset_package_id=self.formal["data"]["datasetPackageId"],
                run_id=run_id,
                output_namespace=output_namespace.as_posix(),
                project_root=ROOT,
            )
        )
        attempt = ROOT / runner.ATTEMPT_NAMESPACE / run_id
        attempt.mkdir(parents=True, exist_ok=False)
        config_path = attempt / "active-config.json"
        config_path.write_text(
            json.dumps(active, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        ticket_binding = {
            "path": ticket["ticketPath"],
            "sha256": ticket["ticketSha256"],
        }
        ticket_consumption_binding = {
            "path": ticket["consumptionPath"],
            "sha256": ticket["consumptionSha256"],
        }
        runner_binding = runner._binding(Path(runner.__file__).resolve())
        frozen_probe = attempt / "frozen-probe.json"
        frozen_probe.write_text('{"identity":"frozen"}\n', encoding="utf-8")
        claim = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-"
                "execution-started-v1"
            ),
            "status": "runner_claimed_not_replayable",
            "runId": run_id,
            "outputNamespace": output_namespace.as_posix(),
            "ticketId": ticket["ticketId"],
            "bindings": {
                "activeConfig": runner._binding(config_path),
                "ticket": ticket_binding,
                "consumption": ticket_consumption_binding,
            },
            "frozenInputs": {
                "gpuRunnerProgram": runner_binding,
                "frozenProbe": runner._binding(frozen_probe),
            },
            "gpuRunner": runner_binding,
            "claimConsumptionPath": runner._project_path(
                attempt / "execution-claim-consumption.json"
            ),
            "ownerAuthorizationRequired": False,
            "automaticRetryAllowed": False,
        }
        claim_path = attempt / "execution-started.json"
        claim_path.write_text(
            json.dumps(claim, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return {
            "runId": run_id,
            "outputNamespace": output_namespace,
            "active": active,
            "ticket": ticket,
            "attempt": attempt,
            "configPath": config_path,
            "claimPath": claim_path,
            "frozenProbe": frozen_probe,
        }

    def _cleanup_case(self, case):
        output = ROOT / case["outputNamespace"]
        if output.is_dir():
            shutil.rmtree(output)
        if case["attempt"].is_dir():
            shutil.rmtree(case["attempt"])
        ticket_directory = ROOT / Path(case["ticket"]["ticketPath"]).parent
        if ticket_directory.is_dir():
            shutil.rmtree(ticket_directory)

    def test_formal_model_and_two_sample_identities_are_exact(self):
        self.assertEqual(
            self.model_config["denoiserArchitecture"],
            ARCHITECTURE_ID,
        )
        self.assertEqual(self.active["capabilityVersion"], CAPABILITY_VERSION)
        self.assertEqual(
            self.active["status"],
            "readonly_gpu_qualification_active",
        )
        self.assertEqual(
            self.active["training"]["localAiCapabilityTicket"]["executionState"],
            "consumed",
        )
        self.assertEqual(self.model_config["conditionChannels"], 23)
        self.assertEqual(self.model_config["latentChannels"], 12)
        self.assertEqual(
            self.model_config["conditionResizeContract"],
            "discrete_nearest_continuous_bilinear_v1",
        )
        dataset = ROOT / self.formal["data"]["datasetManifestPath"]
        source_index = ROOT / self.formal["data"]["sourceIndexPath"]
        identity = runner.resolve_formal_sample_identities(
            self.model_config,
            dataset,
            source_index,
        )
        self.assertEqual(identity["selectionContract"], runner.SELECTION_CONTRACT)
        self.assertEqual(identity["splitCounts"], runner.EXPECTED_SPLIT_COUNTS)
        self.assertEqual(
            identity["firstTrainSampleId"],
            runner.FIRST_TRAIN_SAMPLE_ID,
        )
        self.assertEqual(
            identity["validationSampleId"],
            runner.VALIDATION_SAMPLE_ID,
        )
        self.assertEqual(
            tuple(identity["trainSample"]["conditions"].shape),
            (23, 192, 256),
        )
        self.assertEqual(
            tuple(identity["validationSample"]["conditions"].shape),
            (23, 192, 256),
        )

    def test_cpu_model_has_exact_24_unshared_affine_tensors(self):
        self.torch.manual_seed(runner.SEED)
        model = build_complete_world_system(self.model_config).eval()
        identity = runner.validate_affine_parameter_identity(model.denoiser)
        self.assertEqual(identity["parameterTensorCount"], 24)
        self.assertEqual(identity["parameterObjectIdentityCount"], 24)
        self.assertEqual(identity["parameterCount"], 745_472)
        self.assertEqual(
            identity["parameterShapes"],
            {
                name: list(shape)
                for name, shape in runner.EXPECTED_AFFINE_PARAMETER_SHAPES.items()
            },
        )
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))

    def test_gradient_summaries_require_every_condition_channel_and_tensor(self):
        torch = self.torch
        condition_gradient = torch.ones(runner.CONDITION_SHAPE)
        summary = runner.summarize_condition_gradient(condition_gradient)
        self.assertTrue(summary["all23ChannelsFiniteNonzero"])
        self.assertEqual(len(summary["perChannelMaximumAbsoluteGradient"]), 23)
        missing_channel = condition_gradient.clone()
        missing_channel[:, 7] = 0
        with self.assertRaisesRegex(ValueError, "condition_gradient_invalid"):
            runner.summarize_condition_gradient(missing_channel)

        parameter_name = "block0.spatial_affine_norm1.weight"
        valid_parameter_gradient = torch.ones(
            runner.EXPECTED_AFFINE_PARAMETER_SHAPES[parameter_name]
        )
        parameter_summary = runner.summarize_affine_parameter_gradient(
            parameter_name,
            valid_parameter_gradient,
        )
        self.assertTrue(parameter_summary["finite"])
        self.assertTrue(parameter_summary["nonzero"])
        self.assertTrue(parameter_summary["gammaFiniteNonzero"])
        self.assertTrue(parameter_summary["betaFiniteNonzero"])
        with self.assertRaisesRegex(ValueError, "gradient_invalid"):
            runner.summarize_affine_parameter_gradient(
                parameter_name,
                torch.zeros_like(valid_parameter_gradient),
            )
        half = valid_parameter_gradient.shape[0] // 2
        gamma_disconnected = valid_parameter_gradient.clone()
        gamma_disconnected[:half] = 0
        with self.assertRaisesRegex(ValueError, "gamma_gradient_invalid"):
            runner.summarize_affine_parameter_gradient(
                parameter_name,
                gamma_disconnected,
            )
        beta_disconnected = valid_parameter_gradient.clone()
        beta_disconnected[half:] = 0
        with self.assertRaisesRegex(ValueError, "beta_gradient_invalid"):
            runner.summarize_affine_parameter_gradient(
                parameter_name,
                beta_disconnected,
            )

    def test_exact_config_sources_and_dedicated_output_namespace_validate_cpu_only(self):
        case = self._new_claimed_case()
        config_path = case["configPath"]
        inactive_path = case["attempt"] / "inactive.json"
        claim_path = case["claimPath"]
        try:
            validated = runner.validate_readonly_gpu_inputs(
                Path(runner._project_path(config_path)),
                runner.sha256_file(config_path),
                Path(runner._project_path(claim_path)),
                runner.sha256_file(claim_path),
                case["outputNamespace"],
            )
            self.assertEqual(
                validated["sampleIdentity"]["firstTrainSampleId"],
                runner.FIRST_TRAIN_SAMPLE_ID,
            )
            self.assertEqual(
                runner.sha256_file(validated["autoencoderCheckpoint"]),
                runner.AUTOENCODER_SHA256,
            )
            self.assertFalse(validated["outputDir"].exists())
            self.assertTrue(validated["grant"].permits("load_autoencoder"))
            self.assertFalse(validated["grant"].permits("create_optimizer"))
            self.assertTrue(
                validated["executionClaim"]["claimConsumptionPath"].is_file()
            )
            with self.assertRaises(FileExistsError):
                runner.validate_readonly_gpu_inputs(
                    Path(runner._project_path(config_path)),
                    runner.sha256_file(config_path),
                    Path(runner._project_path(claim_path)),
                    runner.sha256_file(claim_path),
                    case["outputNamespace"],
                )
            with self.assertRaisesRegex(ValueError, "config_sha256_mismatch"):
                runner.validate_readonly_gpu_inputs(
                    Path(runner._project_path(config_path)),
                    "0" * 64,
                    Path(runner._project_path(claim_path)),
                    runner.sha256_file(claim_path),
                    case["outputNamespace"],
                )
            with self.assertRaisesRegex(ValueError, "output_namespace_invalid"):
                runner.validate_readonly_gpu_inputs(
                    Path(runner._project_path(config_path)),
                    runner.sha256_file(config_path),
                    Path(runner._project_path(claim_path)),
                    runner.sha256_file(claim_path),
                    Path(
                        ".runtime/ai-painter/"
                        "stage4-spatial-affine-readonly-gpu-qualifications/"
                        f"{case['runId']}"
                    ),
                )
            inactive_path.write_text(
                json.dumps(self.inactive, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "minimum_execution_identity_invalid"):
                runner.validate_readonly_gpu_inputs(
                    inactive_path.relative_to(ROOT),
                    runner.sha256_file(inactive_path),
                    Path(runner._project_path(claim_path)),
                    runner.sha256_file(claim_path),
                    case["outputNamespace"],
                )
        finally:
            self._cleanup_case(case)

    def test_cuda_unavailable_fails_before_output_creation(self):
        case = self._new_claimed_case()
        output = ROOT / case["outputNamespace"]
        try:
            inputs = runner.validate_readonly_gpu_inputs(
                Path(runner._project_path(case["configPath"])),
                runner.sha256_file(case["configPath"]),
                Path(runner._project_path(case["claimPath"])),
                runner.sha256_file(case["claimPath"]),
                case["outputNamespace"],
            )
            with patch.object(runner.torch.cuda, "is_available", return_value=False):
                with self.assertRaisesRegex(RuntimeError, "cuda_unavailable"):
                    runner.run_readonly_gpu_qualification(inputs)
            self.assertFalse(output.exists())
        finally:
            self._cleanup_case(case)

    def test_frozen_input_failure_still_consumes_claim_and_blocks_replay(self):
        case = self._new_claimed_case()
        original = case["frozenProbe"].read_bytes()
        case["frozenProbe"].unlink()
        try:
            with self.assertRaisesRegex(ValueError, "bound_path_missing"):
                runner.validate_readonly_gpu_inputs(
                    Path(runner._project_path(case["configPath"])),
                    runner.sha256_file(case["configPath"]),
                    Path(runner._project_path(case["claimPath"])),
                    runner.sha256_file(case["claimPath"]),
                    case["outputNamespace"],
                )
            consumption = case["attempt"] / "execution-claim-consumption.json"
            self.assertTrue(consumption.is_file())
            case["frozenProbe"].write_bytes(original)
            with self.assertRaises(FileExistsError):
                runner.validate_readonly_gpu_inputs(
                    Path(runner._project_path(case["configPath"])),
                    runner.sha256_file(case["configPath"]),
                    Path(runner._project_path(case["claimPath"])),
                    runner.sha256_file(case["claimPath"]),
                    case["outputNamespace"],
                )
        finally:
            self._cleanup_case(case)

    def test_runner_is_independent_and_has_no_training_or_checkpoint_primitive(self):
        source = inspect.getsource(runner)
        self.assertNotIn("run_stage4_spatial_affine_decoder_readonly_gpu", source)
        self.assertIn(
            "validate_full_backbone_spatial_affine_readonly_gpu_config",
            source,
        )
        self.assertIn("resolve_stage_execution_grant", source)
        self.assertIn("localAiCapabilityTicket", source)
        self.assertNotIn("torch.optim", source)
        self.assertNotIn(".backward(", source)
        self.assertNotIn("torch.save", source)
        self.assertNotIn("load_denoiser_checkpoint", source)
        self.assertNotIn("initial-denoiser-checkpoint", source)
        self.assertIn("torch.autograd.grad", source)
        self.assertIn("trainer.load_autoencoder_checkpoint", source)
        self.assertIn("torch.cuda.max_memory_allocated", source)


if __name__ == "__main__":
    unittest.main()
