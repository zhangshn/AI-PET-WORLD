from __future__ import annotations

import copy
import unittest

from ai_painter.complete_world.stage4_checkpoint_boundary_gate import (
    BoundaryCheckpointContractError,
    audit_boundary_contacts,
    boundary_gate_contract_status,
    build_boundary_validation_ledger,
    build_checkpoint_candidate,
    decide_checkpoint_replacement,
    isolate_condition_supported_connected_components,
)


WIDTH = 64
HEIGHT = 64
STATE_30 = "3" * 64
STATE_40 = "4" * 64


def formal_identity(index: int) -> dict:
    return {
        "conditionPackPath": f"data/condition-packs/validation-{index}.json",
        "conditionPackSha256": str(index + 1) * 64,
        "conditionMaskPath": f"data/condition-masks/validation-{index}.png",
        "conditionMaskSha256": str(index + 3) * 64,
        "season": "wet_season",
        "normalization": {
            "width": 1024,
            "height": 768,
            "resizeKernel": "nearest",
            "sourceQuantization": "uint8_png_rgb",
        },
        "sourcePreviewSha256": str(index + 5) * 64,
        "normalizedReviewRgbSha256": str(index + 7) * 64,
    }


def west_band_mask(count: int) -> list[int]:
    mask = [0] * (WIDTH * HEIGHT)
    written = 0
    for y in range(10, HEIGHT - 10):
        for x in range(6):
            if written >= count:
                return mask
            mask[y * WIDTH + x] = 1
            written += 1
    if written != count:
        raise AssertionError("fixture count exceeds isolated west band")
    return mask


def candidate(epoch: int, state: str, score: float, actual_count: int) -> dict:
    expected = west_band_mask(182)
    actual = west_band_mask(actual_count)
    audit = audit_boundary_contacts(expected, actual, actual, WIDTH, HEIGHT)
    return build_checkpoint_candidate(
        epoch=epoch,
        optimizer_step=epoch,
        denoiser_state_sha256=state,
        scalar_score=score,
        final_rgb_sha256=str(epoch % 10) * 64,
        boundary_audit=audit,
        preview_sha256=str((epoch + 1) % 10) * 64,
    )


def ledger_candidate(
    epoch: int,
    state: str,
    score: float,
    actual_counts: tuple[int, int],
) -> dict:
    expected = west_band_mask(182)
    entries = []
    for index, actual_count in enumerate(actual_counts):
        actual = west_band_mask(actual_count)
        entries.append(
            {
                "sampleId": f"validation-{index}",
                "seedIndex": index,
                "seed": 20263722 + index,
                **formal_identity(index),
                "boundaryAudit": audit_boundary_contacts(
                    expected, actual, actual, WIDTH, HEIGHT
                ),
            }
        )
    ledger = build_boundary_validation_ledger(entries)
    return build_checkpoint_candidate(
        epoch=epoch,
        optimizer_step=epoch,
        denoiser_state_sha256=state,
        scalar_score=score,
        final_rgb_sha256=str(epoch % 10) * 64,
        boundary_audit=ledger,
        preview_sha256=str((epoch + 1) % 10) * 64,
    )


class Stage4CheckpointBoundaryGateTests(unittest.TestCase):
    def test_missing_contract_is_not_applicable_and_never_numeric_zero(self):
        result = boundary_gate_contract_status(None)
        self.assertFalse(result["applicable"])
        self.assertIsNone(result["metricValue"])
        self.assertEqual(
            result["status"],
            "not_applicable_checkpoint_boundary_contract_missing",
        )

    def test_contract_rejects_loss_or_metric_weight_injection(self):
        valid = {
            "contractVersion": "stage4-final-rgb-boundary-checkpoint-non-regression-v1",
            "enabled": True,
            "role": "checkpoint_eligibility_gate_only",
            "trainingLossContribution": False,
            "bestCheckpointMetricWeight": False,
        }
        self.assertTrue(boundary_gate_contract_status(valid)["applicable"])
        for key in ("trainingLossContribution", "bestCheckpointMetricWeight"):
            for injected in (0.0, 0.01):
                invalid = dict(valid)
                invalid[key] = injected
                with self.assertRaises(BoundaryCheckpointContractError):
                    boundary_gate_contract_status(invalid)

    def test_epoch_30_152_of_182_passes_v3_boundary_tuple(self):
        audit = candidate(30, STATE_30, 5.0, 152)["boundaryAudit"]
        self.assertEqual(audit["bandPixels"], 6)
        self.assertEqual(audit["requiredSides"], ["west"])
        self.assertEqual(audit["expectedCounts"]["west"], 182)
        self.assertEqual(audit["minimumRequiredCounts"]["west"], 18)
        self.assertEqual(audit["actualCounts"]["west"], 152)
        self.assertEqual(audit["missingRequiredSides"], [])
        self.assertTrue(audit["passed"])

    def test_epoch_40_16_of_182_cannot_replace_epoch_30(self):
        incumbent = candidate(30, STATE_30, 5.0, 152)
        new = candidate(40, STATE_40, 4.0, 16)
        self.assertEqual(new["boundaryAudit"]["missingRequiredSides"], ["west"])
        decision = decide_checkpoint_replacement(new, incumbent)
        self.assertFalse(decision.eligible)
        self.assertTrue(decision.scalar_improved)
        self.assertFalse(decision.required_contact_non_regressed)
        self.assertEqual(
            decision.reason, "required_boundary_actual_contact_regressed"
        )

    def test_scalar_improvement_and_boundary_non_regression_are_both_required(self):
        incumbent = candidate(30, STATE_30, 5.0, 152)
        improved = candidate(31, STATE_40, 4.9, 153)
        self.assertTrue(decide_checkpoint_replacement(improved, incumbent).eligible)
        worse_score = candidate(31, STATE_40, 5.1, 153)
        self.assertFalse(decide_checkpoint_replacement(worse_score, incumbent).eligible)

    def test_pre_post_optimizer_identity_mismatch_is_rejected(self):
        value = candidate(40, STATE_40, 4.0, 182)
        mismatched = copy.deepcopy(value)
        mismatched["evidenceBindings"]["scalarScore"]["stateSha256"] = STATE_30
        with self.assertRaisesRegex(
            BoundaryCheckpointContractError,
            "checkpoint_candidate_pre_post_identity_mismatch",
        ):
            decide_checkpoint_replacement(mismatched, None)

    def test_official_condition_boundary_identity_cannot_change(self):
        incumbent = candidate(30, STATE_30, 5.0, 152)
        new = candidate(40, STATE_40, 4.0, 160)
        changed = copy.deepcopy(new)
        changed["boundaryAudit"]["expectedCounts"]["west"] = 181
        # Rebuilding the hash proves this is a semantic identity attack, not merely
        # a corrupted JSON blob.
        rebuilt = build_checkpoint_candidate(
            epoch=40,
            optimizer_step=40,
            denoiser_state_sha256=STATE_40,
            scalar_score=4.0,
            final_rgb_sha256="0" * 64,
            boundary_audit=changed["boundaryAudit"],
            preview_sha256="1" * 64,
        )
        with self.assertRaisesRegex(
            BoundaryCheckpointContractError,
            "checkpoint_candidate_official_condition_identity_changed",
        ):
            decide_checkpoint_replacement(rebuilt, incumbent)

    def test_unexpected_side_uses_large_raw_connected_component(self):
        width = 128
        height = 96
        expected = [0] * (width * height)
        supported = [0] * (width * height)
        raw = [0] * (width * height)
        for y in range(20, 50):
            for x in range(6):
                expected[y * width + x] = 1
                supported[y * width + x] = 1
                raw[y * width + x] = 1
        # 6 x 96 = 576 pixels: this crosses the frozen 500-pixel connected
        # component floor and has at least six east-band contact pixels.
        for y in range(height):
            for x in range(width - 6, width):
                raw[y * width + x] = 1
        audit = audit_boundary_contacts(expected, supported, raw, width, height)
        self.assertIn("east", audit["rawActualContactSides"])
        self.assertIn("east", audit["unexpectedContactSides"])
        self.assertFalse(audit["passed"])

    def test_supported_component_isolation_rejects_remote_raw_signal(self):
        width = 128
        height = 96
        expected = [0] * (width * height)
        raw = [0] * (width * height)
        for y in range(30, 40):
            for x in range(3):
                expected[y * width + x] = 1
                raw[y * width + x] = 1
        for y in range(30, 40):
            for x in range(width - 3, width):
                raw[y * width + x] = 1
        supported = isolate_condition_supported_connected_components(
            raw, expected, width, height
        )
        self.assertEqual(sum(supported), 30)
        self.assertEqual(
            sum(supported[y * width + x] for y in range(height) for x in range(width - 3, width)),
            0,
        )

    def test_validation_ledger_requires_every_trajectory_to_not_regress(self):
        incumbent = ledger_candidate(30, STATE_30, 5.0, (152, 140))
        improved = ledger_candidate(40, STATE_40, 4.0, (153, 141))
        self.assertTrue(
            decide_checkpoint_replacement(improved, incumbent).eligible
        )
        one_trajectory_regressed = ledger_candidate(
            40, STATE_40, 4.0, (153, 16)
        )
        decision = decide_checkpoint_replacement(
            one_trajectory_regressed, incumbent
        )
        self.assertFalse(decision.eligible)
        self.assertFalse(decision.required_contact_non_regressed)

    def test_validation_ledger_rejects_duplicate_or_changed_identity(self):
        expected = west_band_mask(182)
        actual = west_band_mask(152)
        duplicate = {
            "sampleId": "validation-0",
            "seedIndex": 0,
            "seed": 20263722,
            **formal_identity(0),
            "boundaryAudit": audit_boundary_contacts(
                expected, actual, actual, WIDTH, HEIGHT
            ),
        }
        with self.assertRaisesRegex(
            BoundaryCheckpointContractError,
            "checkpoint_boundary_ledger_identity_duplicate",
        ):
            build_boundary_validation_ledger([duplicate, duplicate])

        incumbent = ledger_candidate(30, STATE_30, 5.0, (152, 140))
        changed = copy.deepcopy(
            ledger_candidate(40, STATE_40, 4.0, (153, 141))
        )
        changed_entries = copy.deepcopy(changed["boundaryAudit"]["entries"])
        changed_entries[0]["conditionMaskSha256"] = "9" * 64
        changed_ledger = build_boundary_validation_ledger(changed_entries)
        changed_candidate = build_checkpoint_candidate(
            epoch=40,
            optimizer_step=40,
            denoiser_state_sha256=STATE_40,
            scalar_score=4.0,
            final_rgb_sha256="0" * 64,
            boundary_audit=changed_ledger,
            preview_sha256="1" * 64,
        )
        with self.assertRaisesRegex(
            BoundaryCheckpointContractError,
            "checkpoint_candidate_official_condition_identity_changed",
        ):
            decide_checkpoint_replacement(changed_candidate, incumbent)

    def test_validation_ledger_rejects_non_formal_normalization_identity(self):
        expected = west_band_mask(182)
        actual = west_band_mask(152)
        entry = {
            "sampleId": "validation-0",
            "seedIndex": 0,
            "seed": 20263722,
            **formal_identity(0),
            "boundaryAudit": audit_boundary_contacts(
                expected, actual, actual, WIDTH, HEIGHT
            ),
        }
        entry["normalization"]["resizeKernel"] = "bilinear"
        with self.assertRaisesRegex(
            BoundaryCheckpointContractError,
            "checkpoint_boundary_ledger_normalization_identity_invalid",
        ):
            build_boundary_validation_ledger([entry])


if __name__ == "__main__":
    unittest.main()
