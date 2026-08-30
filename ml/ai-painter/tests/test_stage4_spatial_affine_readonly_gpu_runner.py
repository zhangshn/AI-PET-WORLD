from __future__ import annotations

import inspect
import json
from pathlib import Path
import shutil
import unittest
from uuid import uuid4

from ai_painter.training.torch_runtime import require_torch
from ai_painter_spatial_affine_decoder_contract import (
    compile_spatial_affine_decoder_cpu_inactive_config,
    issue_and_consume_spatial_affine_internal_ticket,
    load_spatial_affine_formal_objective_contract,
)
import run_stage4_spatial_affine_decoder_readonly_gpu_qualification as runner


ROOT = Path(__file__).resolve().parents[3]


class Stage4SpatialAffineReadonlyGpuRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()
        cls.inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        cls.formal = load_spatial_affine_formal_objective_contract(ROOT)

    def test_gradient_summary_requires_finite_nonzero_gamma_and_beta(self):
        torch = self.torch
        valid = torch.ones(256, 23, 3, 3)
        evidence = runner.summarize_spatial_affine_gradient(
            "up_block1.spatial_affine_norm1.weight",
            valid,
        )
        self.assertTrue(evidence["gammaFiniteNonzero"])
        self.assertTrue(evidence["betaFiniteNonzero"])
        invalid = valid.clone()
        invalid[128:] = 0
        with self.assertRaisesRegex(ValueError, "gradient_invalid"):
            runner.summarize_spatial_affine_gradient(
                "up_block1.spatial_affine_norm1.weight",
                invalid,
            )

    def test_formal_source_index_order_and_sample_194_are_exact(self):
        dataset = ROOT / self.formal["data"]["datasetManifestPath"]
        source_index = ROOT / self.formal["data"]["sourceIndexPath"]
        identity = runner.resolve_formal_sample_identities(
            self.inactive,
            dataset,
            source_index,
        )
        self.assertEqual(identity["splitCounts"], runner.EXPECTED_SPLIT_COUNTS)
        self.assertEqual(
            identity["firstTrainSampleId"],
            "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
        )
        self.assertEqual(
            identity["validationSampleId"],
            runner.VALIDATION_SAMPLE_ID,
        )
        self.assertEqual(identity["trainSample"]["conditions"].shape[0], 23)
        self.assertEqual(
            identity["validationSample"]["sampleId"],
            runner.VALIDATION_SAMPLE_ID,
        )

    def test_active_config_v2_ticket_and_actual_sources_validate_without_cuda(self):
        run_id = f"spatial-affine-runner-{uuid4().hex}"
        output_namespace = (
            ".runtime/ai-painter/stage4-spatial-affine-readonly-gpu-qualifications/"
            f"{run_id}"
        )
        ticket_namespace = (
            ".test-output/stage4-spatial-affine-readonly-gpu-runner-tickets"
        )
        active, ticket = issue_and_consume_spatial_affine_internal_ticket(
            self.inactive,
            phase="readonly_gpu",
            dataset_package_id=self.formal["data"]["datasetPackageId"],
            run_id=run_id,
            output_namespace=output_namespace,
            project_root=ROOT,
            ticket_namespace=ticket_namespace,
        )
        config_directory = (
            ROOT / ".test-output" / "stage4-spatial-affine-readonly-gpu-runner-configs"
        )
        config_directory.mkdir(parents=True, exist_ok=True)
        config_path = config_directory / f"{run_id}.json"
        config_path.write_text(
            json.dumps(active, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        try:
            validated = runner.validate_readonly_gpu_inputs(
                config_path.relative_to(ROOT),
                Path(output_namespace),
            )
            self.assertEqual(
                validated["sampleIdentity"]["firstTrainSampleId"],
                "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
            )
            self.assertEqual(
                validated["sourceBinding"]["autoencoderCheckpointSha256"],
                self.formal["modelBoundary"]["autoencoderCheckpointSha256"],
            )
            self.assertEqual(
                validated["grant"].authorization_identity["ticketId"],
                ticket["ticketId"],
            )
            with self.assertRaisesRegex(ValueError, "execution namespace binding"):
                runner.validate_readonly_gpu_inputs(
                    config_path.relative_to(ROOT),
                    Path(
                        ".runtime/ai-painter/"
                        "stage4-spatial-affine-readonly-gpu-qualifications/"
                        "different-run-identity"
                    ),
                )
        finally:
            config_path.unlink(missing_ok=True)
            try:
                config_directory.rmdir()
            except OSError:
                pass
            ticket_directory = ROOT / Path(ticket["ticketPath"]).parent
            if ticket_directory.is_dir():
                shutil.rmtree(ticket_directory)
            try:
                ticket_directory.parent.rmdir()
            except OSError:
                pass

    def test_runner_has_no_training_or_denoiser_checkpoint_write_primitive(self):
        source = inspect.getsource(runner)
        self.assertNotIn("torch.optim", source)
        self.assertNotIn(".backward(", source)
        self.assertNotIn("torch.save", source)
        self.assertNotIn("load_denoiser_checkpoint", source)
        self.assertNotIn("WRITE_SMOKE_CHECKPOINT", source)
        self.assertIn("torch.autograd.grad", source)
        self.assertIn("trainer.load_autoencoder_checkpoint", source)


if __name__ == "__main__":
    unittest.main()
