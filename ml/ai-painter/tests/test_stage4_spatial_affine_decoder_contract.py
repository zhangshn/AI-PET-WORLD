from __future__ import annotations

from pathlib import Path
import sys
import unittest


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ai_painter_spatial_affine_decoder_contract import (
    FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS,
    FROZEN_DENOISER_LOSS_WEIGHTS,
    FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS,
    compile_spatial_affine_decoder_cpu_inactive_config,
)
from ai_painter_authorization_policy import resolve_stage_execution_grant
from check_stage4_spatial_affine_decoder_cpu import (
    ROOT,
    audit_spatial_affine_config,
    build_and_audit_all_modes,
    run_negative_cases,
    _materialize_with_real_ticket,
)


class Stage4SpatialAffineDecoderContractTests(unittest.TestCase):
    def test_inactive_cpu_preflight_needs_no_owner_or_internal_execution_ticket(self):
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        self.assertNotIn(
            "localAiCapabilityTicket", inactive["training"]
        )
        self.assertNotIn(
            "ownerTrainingAuthorization", inactive["training"]
        )
        grant = resolve_stage_execution_grant(
            inactive, project_root=ROOT
        )
        identity = grant.authorization_identity
        self.assertEqual(
            identity["executionState"], "cpu_supported_inactive"
        )
        self.assertTrue(identity["preflightOnly"])
        self.assertEqual(
            identity["authority"], "local_ai_pet_world_program"
        )

    def test_all_four_modes_have_exact_structure_and_execution_boundaries(self):
        audits = build_and_audit_all_modes()
        self.assertEqual(set(audits), {"inactive", "readonly_gpu", "full_data_screen", "stage0"})
        self.assertEqual(audits["inactive"]["epochCount"], 24)
        self.assertEqual(audits["readonly_gpu"]["epochCount"], 24)
        self.assertEqual(audits["full_data_screen"]["epochCount"], 24)
        self.assertEqual(audits["stage0"]["epochCount"], 40)
        for audit in audits.values():
            self.assertEqual(audit["parameterCount"], 159744)
            self.assertEqual(audit["parameterTensorCount"], 8)
            self.assertFalse(audit["ownerAuthorizationRequired"])
            self.assertTrue(audit["checkpointBoundaryGateIsMetricOnly"])
            self.assertFalse(audit["historicalRuntimeArtifactIsExecutionSource"])
        self.assertIsNone(audits["inactive"]["internalTicket"])
        for phase in ("readonly_gpu", "full_data_screen", "stage0"):
            ticket = audits[phase]["internalTicket"]
            self.assertTrue(ticket["oneTimeConsumption"])
            self.assertEqual(len(ticket["boundConfigSha256"]), 64)
            self.assertTrue(ticket["datasetPackageId"])
            self.assertEqual(
                Path(ticket["outputNamespace"]).name,
                ticket["runId"],
            )
            self.assertNotIn("select_bound_sample", ticket["executionActions"])

    def test_checkpoint_boundary_gate_never_changes_existing_loss_or_metric_weights(self):
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        self.assertEqual(
            inactive["training"]["denoiserLossWeights"],
            FROZEN_DENOISER_LOSS_WEIGHTS,
        )
        self.assertEqual(
            inactive["training"]["bestCheckpointMetricWeights"],
            FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS,
        )
        self.assertEqual(
            inactive["training"]["rolloutCheckpointMetricWeights"],
            FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS,
        )
        gate = inactive["training"]["finalRgbBoundaryCheckpointNonRegressionGate"]
        self.assertTrue(gate["metricOnly"])
        self.assertFalse(gate["trainingLossContribution"])
        self.assertFalse(gate["bestCheckpointMetricWeightAdded"])

    def test_negative_matrix_rejects_all_forbidden_mutations(self):
        results = run_negative_cases()
        self.assertGreaterEqual(len(results), 18)
        self.assertTrue(all(result["passed"] for result in results), results)
        self.assertIn(
            "internal_ticket_replay_rejected",
            {result["name"] for result in results},
        )

    def test_unknown_phase_and_cross_phase_status_are_rejected(self):
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        with self.assertRaisesRegex(ValueError, "spatial_affine_phase_unknown"):
            audit_spatial_affine_config(
                inactive, phase="future_phase", project_root=ROOT
            )

        screen = _materialize_with_real_ticket(inactive, "full_data_screen")
        screen["training"]["trainingAuthorizationStatus"] = inactive["training"][
            "trainingAuthorizationStatus"
        ]
        with self.assertRaises(ValueError):
            audit_spatial_affine_config(
                screen, phase="full_data_screen", project_root=ROOT
            )


if __name__ == "__main__":
    unittest.main()
