from __future__ import annotations

from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import check_stage4_joint_condition_local_transport_smoke_resources as resources
import materialize_stage4_joint_condition_local_transport_controlled_smoke as materializer


ARCHITECTURE_ID = resources.ARCHITECTURE_ID
LEGACY_ARCHITECTURE_ID = (
    "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
)


def _candidate_config() -> dict:
    return {
        "schemaVersion": (
            "ai-painter-stage4-joint-condition-local-transport-"
            "controlled-smoke-config-v1"
        ),
        "architectureVersion": "joint-condition-local-transport-denoiser-v1",
        "denoiserArchitecture": ARCHITECTURE_ID,
        "jointConditionLocalTransportContract": {
            "capabilityVersion": ARCHITECTURE_ID,
            "architectureId": ARCHITECTURE_ID,
        },
        "training": {
            "stage4JointConditionLocalTransportSmokeContract": {
                "status": "active_local_ai_internal_controlled_smoke",
                "capabilityVersion": ARCHITECTURE_ID,
                "architectureId": ARCHITECTURE_ID,
            }
        },
    }


class JointTransportSmokeMaterializerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.contract = (
            self.root
            / ".runtime"
            / "ai-painter"
            / "stage4-joint-condition-local-transport-smoke-contract-compilations"
            / "compile-run"
            / "controlled-smoke-contract.json"
        )
        self.contract.parent.mkdir(parents=True)
        self.contract.write_text("{}\n", encoding="utf-8")
        self.run_id = "20260830-120000-joint-condition-local-transport-smoke"
        self.output_namespace = (
            ".runtime/ai-painter/"
            "stage4-joint-condition-local-transport-controlled-smokes/"
            f"{self.run_id}"
        )
        self.template_output = (
            self.root
            / ".runtime"
            / "ai-painter"
            / "stage4-joint-condition-local-transport-smoke-work"
            / self.run_id
            / "preflight-config.json"
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _args(self, operation: str, **overrides: object):
        values = {
            "operation": operation,
            "run_id": self.run_id,
            "output_namespace": self.output_namespace,
            "compiled_contract": self.contract,
            "compiled_contract_sha256": "a" * 64,
            "dataset_package_id": None,
            "config": None,
            "output": self.template_output,
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    def test_template_uses_contract_api_and_writes_exclusively(self) -> None:
        config = _candidate_config()
        output = self.template_output
        with patch.object(
            materializer,
            "build_joint_condition_local_transport_controlled_smoke_config_template",
            return_value=config,
        ) as build:
            result = materializer.execute_operation(
                self._args("template", output=output), project_root=self.root
            )
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), config)
        self.assertFalse(result["internalTicketIssued"])
        self.assertFalse(result["optimizerCreated"])
        self.assertFalse(result["trainingStarted"])
        self.assertEqual(
            build.call_args.kwargs["compiled_contract_path"],
            self.contract.relative_to(self.root).as_posix(),
        )

    def test_template_rejects_legacy_candidate_without_writing(self) -> None:
        config = _candidate_config()
        config["denoiserArchitecture"] = LEGACY_ARCHITECTURE_ID
        output = self.template_output
        with patch.object(
            materializer,
            "build_joint_condition_local_transport_controlled_smoke_config_template",
            return_value=config,
        ):
            with self.assertRaisesRegex(ValueError, "architecture identity"):
                materializer.execute_operation(
                    self._args("template", output=output), project_root=self.root
                )
        self.assertFalse(output.exists())

    def test_existing_output_fails_before_ticket_consumption(self) -> None:
        output = self.root / self.output_namespace / "active-config.json"
        output.parent.mkdir(parents=True)
        output.write_text("{}\n", encoding="utf-8")
        issuer = Mock()
        with patch.object(
            materializer,
            "issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket",
            issuer,
        ):
            with self.assertRaises(FileExistsError):
                materializer.execute_operation(
                    self._args(
                        "consume",
                        dataset_package_id="dataset-package",
                        output=output,
                    ),
                    project_root=self.root,
                )
        issuer.assert_not_called()

    def test_consume_rejects_active_config_outside_bound_run_root(self) -> None:
        issuer = Mock()
        with patch.object(
            materializer,
            "issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket",
            issuer,
        ):
            with self.assertRaisesRegex(ValueError, "isolated run root"):
                materializer.execute_operation(
                    self._args(
                        "consume",
                        dataset_package_id="dataset-package",
                        output=self.root / "wrong-active-config.json",
                    ),
                    project_root=self.root,
                )
        issuer.assert_not_called()

    def test_consume_uses_one_ticket_api_and_writes_active_config(self) -> None:
        output = self.root / self.output_namespace / "active-config.json"
        active = _candidate_config()
        ticket = {"ticketId": "local-one-time-ticket", "executionState": "consumed"}
        with patch.object(
            materializer,
            "issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket",
            return_value=(active, ticket),
        ) as issuer:
            result = materializer.execute_operation(
                self._args(
                    "consume",
                    dataset_package_id="dataset-package",
                    output=output,
                ),
                project_root=self.root,
            )
        issuer.assert_called_once()
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), active)
        self.assertEqual(result["ticket"], ticket)
        self.assertFalse(result["optimizerCreated"])
        self.assertFalse(result["trainingStarted"])

    def test_validate_rejects_legacy_identity_before_contract_validator(self) -> None:
        config = _candidate_config()
        config["jointConditionLocalTransportContract"]["capabilityVersion"] = (
            LEGACY_ARCHITECTURE_ID
        )
        path = self.root / "legacy-active-config.json"
        path.write_text(json.dumps(config), encoding="utf-8")
        validator = Mock()
        with patch.object(
            materializer,
            "validate_joint_condition_local_transport_controlled_smoke_config",
            validator,
        ):
            with self.assertRaisesRegex(ValueError, "capability identity"):
                materializer.execute_operation(
                    self._args("validate", config=path), project_root=self.root
                )
        validator.assert_not_called()

    def test_path_escape_is_rejected(self) -> None:
        outside = self.root.parent / "outside-contract.json"
        outside.write_text("{}\n", encoding="utf-8")
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        with self.assertRaises(ValueError):
            materializer.execute_operation(
                self._args("template", compiled_contract=outside),
                project_root=self.root,
            )

    def test_template_rejects_smoke_output_root(self) -> None:
        injected = self.root / self.output_namespace / "preflight-config.json"
        builder = Mock()
        with patch.object(
            materializer,
            "build_joint_condition_local_transport_controlled_smoke_config_template",
            builder,
        ):
            with self.assertRaisesRegex(ValueError, "isolated Smoke work root"):
                materializer.execute_operation(
                    self._args("template", output=injected), project_root=self.root
                )
        builder.assert_not_called()
        self.assertFalse(injected.parent.exists())


class JointTransportSmokeResourcePreflightTests(unittest.TestCase):
    @staticmethod
    def _cuda_snapshot(free_bytes: int = 5 * 1024**3) -> dict:
        return {
            "pythonTorchCudaAvailable": True,
            "torchVersion": "test-only",
            "cudaRuntimeVersion": "test-only",
            "deviceIndex": 0,
            "deviceName": "NVIDIA GeForce RTX 5050",
            "deviceCapability": [12, 0],
            "freeGpuMemoryBytes": free_bytes,
            "totalGpuMemoryBytes": 8 * 1024**3,
            "deviceTotalMemoryBytes": 8 * 1024**3,
            "torchAllocatedBytes": 0,
            "torchReservedBytes": 0,
        }

    def test_cuda_resource_passes_without_training_or_optimizer(self) -> None:
        report = resources.cuda_resource_report(
            snapshot_loader=lambda: self._cuda_snapshot()
        )
        self.assertEqual(report["status"], "passed")
        self.assertFalse(report["modelConstructed"])
        self.assertFalse(report["optimizerCreated"])
        self.assertFalse(report["gpuWorkloadStarted"])
        self.assertFalse(report["trainingStarted"])
        self.assertEqual(report["limits"]["minimumFreeGpuMemoryMiB"], 4096)

    def test_cuda_resource_rejects_low_free_memory(self) -> None:
        with self.assertRaises(resources.ResourcePreflightError) as caught:
            resources.cuda_resource_report(
                snapshot_loader=lambda: self._cuda_snapshot(4096 * 1024**2 - 1)
            )
        self.assertIn(
            "free_gpu_memory_below_4096_mib", caught.exception.report["blockers"]
        )

    def test_cuda_query_failure_is_fail_closed(self) -> None:
        def fail() -> dict:
            raise RuntimeError("CUDA deliberately unavailable in CPU test")

        with self.assertRaises(resources.ResourcePreflightError) as caught:
            resources.cuda_resource_report(snapshot_loader=fail)
        self.assertIn(
            "python_torch_cuda_unavailable", caught.exception.report["blockers"]
        )
        self.assertFalse(caught.exception.report["gpuWorkloadStarted"])

    def test_old_candidate_is_rejected_before_cuda_query(self) -> None:
        loader = Mock()
        with self.assertRaisesRegex(ValueError, "exited spatial-affine"):
            resources.cuda_resource_report(
                candidate_identity=LEGACY_ARCHITECTURE_ID,
                snapshot_loader=loader,
            )
        loader.assert_not_called()

    def test_disk_checks_project_and_runtime_physical_capacity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".runtime").mkdir()
            calls: list[Path] = []

            def usage(path: Path):
                calls.append(path)
                return SimpleNamespace(total=10, used=1, free=3 * 1024**3)

            report = resources.disk_capacity_report(
                project_root=root, disk_usage_loader=usage
            )
        self.assertEqual(report["status"], "passed")
        self.assertEqual(len(calls), 2)
        self.assertFalse(report["trainingStarted"])

    def test_low_runtime_disk_is_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runtime = root / ".runtime"
            runtime.mkdir()

            def usage(path: Path):
                free = 1024 if path == runtime.resolve() else 3 * 1024**3
                return SimpleNamespace(total=10, used=1, free=free)

            with self.assertRaises(resources.ResourcePreflightError) as caught:
                resources.disk_capacity_report(
                    project_root=root, disk_usage_loader=usage
                )
        self.assertIn(
            "runtime_free_disk_below_2_gib", caught.exception.report["blockers"]
        )

    def test_resource_failure_main_contract_is_json_and_nonzero(self) -> None:
        failure = resources.ResourcePreflightError(
            {"schemaVersion": "test", "status": "failed", "blockers": ["low"]}
        )
        stream = StringIO()
        with patch.object(resources, "execute_command", side_effect=failure):
            with redirect_stdout(stream):
                exit_code = resources.main(["disk-capacity"])
        self.assertEqual(exit_code, 2)
        self.assertEqual(json.loads(stream.getvalue())["status"], "failed")


if __name__ == "__main__":
    unittest.main()
