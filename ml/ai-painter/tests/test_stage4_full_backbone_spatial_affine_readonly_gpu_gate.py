from __future__ import annotations

from collections import namedtuple
import inspect
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_ROOT = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE_ROOT = ROOT / "ml" / "ai-painter" / "src"
for path in (SCRIPTS_ROOT, SOURCE_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate as gate


RUN_ID = (
    "full-backbone-spatial-affine-readonly-gpu-"
    "20260829-093000000-deadbeef"
)


class Stage4FullBackboneSpatialAffineReadonlyGpuGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        scripts = self.root / "ml" / "ai-painter" / "scripts"
        scripts.mkdir(parents=True)
        (scripts / Path(gate.__file__).name).write_text(
            "# immutable mock launcher\n", encoding="utf-8"
        )
        (scripts / gate.GPU_RUNNER.name).write_text(
            "# immutable mock GPU runner\n", encoding="utf-8"
        )
        (self.root / ".runtime" / "ai-painter").mkdir(parents=True)
        self.ticket_calls = 0

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def _cpu_gate(_root: Path) -> dict:
        return {
            "schemaVersion": "mock-cpu-report-v1",
            "status": "passed",
            "positivePassed": 7,
            "positiveTotal": 7,
            "negativePassed": 23,
            "negativeTotal": 23,
            "executionBoundary": {"gpuStarted": False},
        }

    @staticmethod
    def _cuda_gate(_root: Path) -> dict:
        return {
            "schemaVersion": "mock-python-cuda-preflight-v1",
            "status": "passed",
            "gpuWorkloadStarted": False,
        }

    @staticmethod
    def _resource_gate(_root: Path) -> dict:
        return {
            "schemaVersion": "mock-resource-preflight-v1",
            "status": "passed",
            "gpuWorkloadStarted": False,
        }

    def _ticket_issuer(
        self,
        *,
        dataset_package_id: str,
        run_id: str,
        output_namespace: str,
        project_root: Path,
    ) -> tuple[dict, dict]:
        self.ticket_calls += 1
        ticket_dir = (
            project_root
            / ".runtime"
            / "ai-painter"
            / "stage4-full-backbone-spatial-affine-readonly-gpu-tickets"
            / run_id
        )
        ticket_dir.mkdir(parents=True, exist_ok=False)
        ticket_path = ticket_dir / "ticket.json"
        ticket_path.write_text(
            json.dumps({"ticketId": f"ticket-{run_id}"}) + "\n",
            encoding="utf-8",
        )
        consumption_path = ticket_dir / "consumption.json"
        consumption_path.write_text(
            json.dumps({"state": "consumed"}) + "\n",
            encoding="utf-8",
        )
        ticket = {
            "ticketId": f"ticket-{run_id}",
            "ticketPath": gate.project_path(ticket_path, project_root),
            "ticketSha256": gate.sha256_file(ticket_path),
            "consumptionPath": gate.project_path(
                consumption_path, project_root
            ),
            "consumptionSha256": gate.sha256_file(consumption_path),
            "executionState": "consumed",
            "executionActions": [
                "inspect_autoencoder_identity",
                "inspect_checkpoint_identity",
                "load_autoencoder",
            ],
        }
        active = {
            "ownerAuthorizationRequired": False,
            "ownerResponseRequired": False,
            "executionIdentity": {
                "runId": run_id,
                "outputNamespace": output_namespace,
            },
            "training": {"localAiCapabilityTicket": ticket},
        }
        return active, ticket

    @staticmethod
    def _config_validator(
        config: dict,
        *,
        project_root: Path,
        require_execution_ticket: bool,
    ) -> dict:
        if not require_execution_ticket:
            raise AssertionError("test must validate a consumed ticket")
        return {"status": "valid"}

    @staticmethod
    def _program_binding_builder(
        project_root: Path,
    ) -> dict[str, dict[str, str]]:
        path = project_root / "ml" / "ai-painter" / "scripts" / gate.GPU_RUNNER.name
        return {"mockGpuRunnerProgram": gate.binding(path, project_root)}

    @classmethod
    def _frozen_binding_builder(
        cls, active_config: dict, *, project_root: Path
    ) -> dict[str, dict[str, str]]:
        path = project_root / ".runtime" / "formal-frozen-input.json"
        path.write_text(json.dumps({"identity": "frozen"}) + "\n", encoding="utf-8")
        return {
            **cls._program_binding_builder(project_root),
            "formalFrozenInput": gate.binding(path, project_root),
        }

    @staticmethod
    def _successful_gpu_invoker(
        *,
        project_root: Path,
        config_path: Path,
        config_sha256: str,
        execution_claim_path: Path,
        execution_claim_sha256: str,
        output_relative: Path,
    ) -> subprocess.CompletedProcess[str]:
        if gate.sha256_file(config_path) != config_sha256:
            raise AssertionError("active config hash was not frozen")
        if gate.sha256_file(execution_claim_path) != execution_claim_sha256:
            raise AssertionError("execution claim hash was not frozen")
        claim = json.loads(execution_claim_path.read_text(encoding="utf-8"))
        claim_binding = gate.binding(execution_claim_path, project_root)
        consumption_path = project_root / claim["claimConsumptionPath"]
        gate.write_json_exclusive(
            consumption_path,
            {
                "schemaVersion": (
                    "stage4-full-backbone-spatial-affine-readonly-gpu-"
                    "execution-claim-consumption-v1"
                ),
                "status": "consumed_once",
                "runId": claim["runId"],
                "executionClaim": claim_binding,
            },
        )
        active = json.loads(config_path.read_text(encoding="utf-8"))
        ticket = active["training"]["localAiCapabilityTicket"]
        output = project_root / output_relative
        output.mkdir(parents=True, exist_ok=False)
        state_path = output / "model-state-hashes.json"
        state_path.write_text(
            json.dumps(
                {
                    "schemaVersion": (
                        "stage4-full-backbone-spatial-affine-readonly-gpu-"
                        "state-hashes-v1"
                    ),
                    "denoiserBefore": "1" * 64,
                    "denoiserAfter": "1" * 64,
                    "denoiserUnchanged": True,
                    "autoencoderBefore": "2" * 64,
                    "autoencoderAfter": "2" * 64,
                    "autoencoderUnchanged": True,
                    "allParameterGradFieldsRemainNone": True,
                }
            )
            + "\n",
            encoding="utf-8",
        )
        gradients = [
            {
                "finite": True,
                "nonzero": True,
                "gammaFiniteNonzero": True,
                "betaFiniteNonzero": True,
            }
            for _ in range(24)
        ]
        gradient_path = output / "gradient-evidence.json"
        gradient_path.write_text(
            json.dumps(
                {
                    "schemaVersion": (
                        "stage4-full-backbone-spatial-affine-readonly-gpu-"
                        "gradient-evidence-v1"
                    ),
                    "status": "passed",
                    "samples": [
                        {
                            "role": role,
                            "sampleId": sample_id,
                            "affineParameterTensorCount": 24,
                            "affineParameterCount": 745472,
                            "affineParameterObjectIdentityCount": 24,
                            "allParameterGradFieldsRemainNone": True,
                            "conditionGradient": {
                                "all23ChannelsFiniteNonzero": True,
                                "perChannelMaximumAbsoluteGradient": [1.0] * 23,
                            },
                            "affineParameterGradients": gradients,
                        }
                        for role, sample_id in (
                            (
                                "first_formal_train_record",
                                "ai-cold-start-v7-v7-capacity-slot-146-"
                                "forested-low-mountain-v3",
                            ),
                            (
                                "fixed_validation_sample_194",
                                "ai-cold-start-v7-v7-capacity-slot-194-"
                                "wet-season-drainage-hollow-v6",
                            ),
                        )
                    ],
                }
            )
            + "\n",
            encoding="utf-8",
        )
        telemetry_path = output / "cuda-telemetry.json"
        telemetry_path.write_text(
            json.dumps(
                {
                    "schemaVersion": (
                        "stage4-full-backbone-spatial-affine-readonly-gpu-"
                        "cuda-telemetry-v1"
                    ),
                    "status": "completed",
                    "deviceName": "mock GPU",
                    "peakGpuMemoryBytes": 1,
                    "durationSeconds": 0.1,
                }
            )
            + "\n",
            encoding="utf-8",
        )
        claim_consumption_binding = gate.binding(consumption_path, project_root)
        report_path = output / "gpu-diagnostic-report.json"
        report_path.write_text(
            json.dumps(
                {
                    "schemaVersion": (
                        "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1"
                    ),
                    "status": "passed",
                    "runId": claim["runId"],
                    "architectureId": gate.ARCHITECTURE_ID,
                    "capabilityVersion": gate.CAPABILITY_VERSION,
                    "executionClaim": claim_binding,
                    "executionClaimConsumption": claim_consumption_binding,
                    "config": gate.binding(config_path, project_root),
                    "internalCapabilityTicket": ticket,
                    "modelStateHashes": gate.binding(state_path, project_root),
                    "gradientEvidence": gate.binding(gradient_path, project_root),
                    "cudaTelemetry": gate.binding(telemetry_path, project_root),
                    "safety": {
                        "denoiserCheckpointRead": False,
                        "historicalCheckpointRead": False,
                        "failedCheckpointRead": False,
                        "optimizerCreated": False,
                        "backwardExecuted": False,
                        "weightsModified": False,
                        "checkpointWritten": False,
                        "smokeStarted": False,
                        "trainingStarted": False,
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )
        ticket_subset = {
            key: ticket[key]
            for key in (
                "ticketId",
                "ticketPath",
                "ticketSha256",
                "consumptionPath",
                "consumptionSha256",
            )
        }
        terminal = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1"
            ),
            "executionState": "completed",
            "status": (
                "stage4_full_backbone_spatial_affine_"
                "readonly_gpu_qualification_passed"
            ),
            "runId": claim["runId"],
            "executionClaim": claim_binding,
            "executionClaimConsumption": claim_consumption_binding,
            "activeConfig": gate.binding(config_path, project_root),
            "internalCapabilityTicket": ticket_subset,
            "gpuDiagnosticReport": {
                "path": gate.project_path(report_path, project_root),
                "sha256": gate.sha256_file(report_path),
            },
            "gradientEvidence": gate.binding(gradient_path, project_root),
            "modelStateHashes": gate.binding(state_path, project_root),
            "cudaTelemetry": gate.binding(telemetry_path, project_root),
            "ownerAuthorizationRequired": False,
        }
        (output / "phase-terminal.json").write_text(
            json.dumps(terminal) + "\n", encoding="utf-8"
        )
        return subprocess.CompletedProcess([], 0, "mock runner passed\n", "")

    def _execute(self, gpu_invoker=None):
        if gpu_invoker is None:
            gpu_invoker = self._successful_gpu_invoker
        with patch.object(
            gate,
            "load_spatial_affine_formal_objective_contract",
            return_value={"data": {"datasetPackageId": "formal-64"}},
        ):
            return gate.execute_readonly_gpu_gate(
                RUN_ID,
                project_root=self.root,
                cpu_gate=self._cpu_gate,
                cuda_preflight=self._cuda_gate,
                resource_gate=self._resource_gate,
                ticket_issuer=self._ticket_issuer,
                config_validator=self._config_validator,
                frozen_binding_builder=self._frozen_binding_builder,
                program_binding_builder=self._program_binding_builder,
                gpu_invoker=gpu_invoker,
            )

    def test_success_freezes_claim_ticket_config_and_both_terminals(self):
        result = self._execute()
        self.assertEqual(result["executionState"], "completed")
        self.assertFalse(result["ownerAuthorizationRequired"])
        self.assertEqual(self.ticket_calls, 1)
        attempt = self.root / gate.ATTEMPT_ROOT_RELATIVE / RUN_ID
        for name in (
            "execution-claim.json",
            "cpu-gate-report.json",
            "python-cuda-preflight.json",
            "resource-preflight.json",
            "active-config.json",
            "execution-started.json",
            "phase-terminal.json",
        ):
            self.assertTrue((attempt / name).is_file(), name)
        execution_claim = json.loads(
            (attempt / "execution-claim.json").read_text(encoding="utf-8")
        )
        self.assertIsInstance(execution_claim["launcherProcessId"], int)
        self.assertGreater(execution_claim["launcherProcessId"], 0)
        started = json.loads(
            (attempt / "execution-started.json").read_text(encoding="utf-8")
        )
        self.assertEqual(started["status"], "runner_claimed_not_replayable")
        self.assertIn("ticket", started["bindings"])
        self.assertIn("consumption", started["bindings"])
        self.assertIn("activeConfig", started["bindings"])
        output = self.root / gate.OUTPUT_ROOT_RELATIVE / RUN_ID
        self.assertTrue((output / "phase-terminal.json").is_file())

    def test_runner_failure_closes_attempt_and_partial_output(self):
        def fail_after_output(
            *,
            project_root,
            config_path,
            config_sha256,
            execution_claim_path,
            execution_claim_sha256,
            output_relative,
        ):
            (project_root / output_relative).mkdir(parents=True, exist_ok=False)
            raise RuntimeError("mock_cuda_launch_failed")

        with self.assertRaises(gate.GateExecutionError) as captured:
            self._execute(fail_after_output)
        result = captured.exception.result
        self.assertEqual(result["executionState"], "failed_closed")
        self.assertEqual(result["failedStep"], "readonly_gpu_runner")
        attempt = self.root / gate.ATTEMPT_ROOT_RELATIVE / RUN_ID
        output = self.root / gate.OUTPUT_ROOT_RELATIVE / RUN_ID
        self.assertTrue((attempt / "failure-report.json").is_file())
        self.assertTrue((attempt / "phase-terminal.json").is_file())
        self.assertTrue((output / "phase-terminal.json").is_file())
        with self.assertRaises(gate.GateExecutionError) as replay:
            self._execute()
        self.assertEqual(
            replay.exception.result["executionState"],
            "rejected_duplicate_run_id",
        )
        self.assertEqual(self.ticket_calls, 1)

    def test_preflight_failure_closes_without_consuming_ticket(self):
        def blocked(_root: Path) -> dict:
            raise RuntimeError("gpu_compute_process_present")

        with patch.object(
            gate,
            "load_spatial_affine_formal_objective_contract",
            return_value={"data": {"datasetPackageId": "formal-64"}},
        ):
            with self.assertRaises(gate.GateExecutionError) as captured:
                gate.execute_readonly_gpu_gate(
                    RUN_ID,
                    project_root=self.root,
                    cpu_gate=self._cpu_gate,
                    cuda_preflight=self._cuda_gate,
                    resource_gate=blocked,
                    ticket_issuer=self._ticket_issuer,
                    config_validator=self._config_validator,
                    frozen_binding_builder=self._frozen_binding_builder,
                    program_binding_builder=self._program_binding_builder,
                    gpu_invoker=self._successful_gpu_invoker,
                )
        self.assertEqual(captured.exception.result["failedStep"], "resource_preflight")
        self.assertEqual(self.ticket_calls, 0)
        attempt = self.root / gate.ATTEMPT_ROOT_RELATIVE / RUN_ID
        self.assertTrue((attempt / "phase-terminal.json").is_file())
        self.assertFalse((self.root / gate.OUTPUT_ROOT_RELATIVE / RUN_ID).exists())

    def test_program_toctou_change_is_rejected_before_ticket_consumption(self):
        def mutating_cpu(root: Path) -> dict:
            report = self._cpu_gate(root)
            runner_path = (
                root / "ml" / "ai-painter" / "scripts" / gate.GPU_RUNNER.name
            )
            runner_path.write_text("# changed during CPU gate\n", encoding="utf-8")
            return report

        with patch.object(
            gate,
            "load_spatial_affine_formal_objective_contract",
            return_value={"data": {"datasetPackageId": "formal-64"}},
        ):
            with self.assertRaises(gate.GateExecutionError) as captured:
                gate.execute_readonly_gpu_gate(
                    RUN_ID,
                    project_root=self.root,
                    cpu_gate=mutating_cpu,
                    cuda_preflight=self._cuda_gate,
                    resource_gate=self._resource_gate,
                    ticket_issuer=self._ticket_issuer,
                    config_validator=self._config_validator,
                    frozen_binding_builder=self._frozen_binding_builder,
                    program_binding_builder=self._program_binding_builder,
                    gpu_invoker=self._successful_gpu_invoker,
                )
        self.assertEqual(
            captured.exception.result["failedStep"], "post_cpu_program_recheck"
        )
        self.assertEqual(self.ticket_calls, 0)

    def test_incomplete_runner_safety_cannot_be_registered_as_success(self):
        def incomplete_safety(**kwargs):
            completed = self._successful_gpu_invoker(**kwargs)
            output = kwargs["project_root"] / kwargs["output_relative"]
            report_path = output / "gpu-diagnostic-report.json"
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["safety"].pop("failedCheckpointRead")
            report_path.write_text(json.dumps(report) + "\n", encoding="utf-8")
            terminal_path = output / "phase-terminal.json"
            terminal = json.loads(terminal_path.read_text(encoding="utf-8"))
            terminal["gpuDiagnosticReport"] = gate.binding(
                report_path, kwargs["project_root"]
            )
            terminal_path.write_text(
                json.dumps(terminal) + "\n", encoding="utf-8"
            )
            return completed

        with self.assertRaises(gate.GateExecutionError) as captured:
            self._execute(incomplete_safety)
        self.assertEqual(captured.exception.result["failedStep"], "readonly_gpu_runner")
        self.assertIn("report_identity_invalid", captured.exception.result["error"])

    def test_resource_preflight_enforces_idle_gpu_process_memory_and_disk(self):
        Disk = namedtuple("Disk", "total used free")

        def passed_process(command, **_kwargs):
            if any(item.startswith("--query-gpu=") for item in command):
                return subprocess.CompletedProcess(
                    command, 0, "NVIDIA GeForce RTX 5050, 0, 1242, 6670, 8151\n", ""
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        passed = gate.resource_preflight(
            self.root,
            process_runner=passed_process,
            disk_usage=lambda _path: Disk(100, 1, 80 * 1024**3),
        )
        self.assertEqual(passed["status"], "passed")

        def active_process(command, **_kwargs):
            if any(item.startswith("--query-gpu=") for item in command):
                return subprocess.CompletedProcess(
                    command, 0, "NVIDIA GeForce RTX 5050, 99, 7000, 1151, 8151\n", ""
                )
            return subprocess.CompletedProcess(
                command, 0, "1234, python.exe, 6000\n", ""
            )

        with self.assertRaisesRegex(
            RuntimeError, "gpu_utilization_above_idle_limit"
        ):
            gate.resource_preflight(
                self.root,
                process_runner=active_process,
                disk_usage=lambda _path: Disk(100, 1, 1),
            )

    def test_wddm_c_plus_g_na_desktop_processes_are_not_compute_conflicts(self):
        Disk = namedtuple("Disk", "total used free")
        compute_text = "\n".join(
            (
                "101, C:\\Program Files\\Google\\Chrome\\chrome.exe, [N/A]",
                "102, [Insufficient Permissions], [N/A]",
                "103, [Insufficient Permissions], [N/A]",
                "104, C:\\Program Files\\WindowsApps\\OpenAI\\ChatGPT.exe, [N/A]",
            )
        )
        pmon_text = "\n".join(
            (
                "# gpu pid type sm mem enc dec command",
                "0 101 C+G 0 0 - - chrome.exe",
                "0 102 C+G 0 0 - - dwm.exe",
                "0 103 C+G 0 0 - - TabTip.exe",
                "0 104 C+G 2 0 - - ChatGPT.exe",
            )
        )
        wmi_text = json.dumps(
            [
                {
                    "ProcessId": 102,
                    "Name": "dwm.exe",
                    "ExecutablePath": "C:\\Windows\\System32\\dwm.exe",
                    "CommandLine": "dwm.exe",
                },
                {
                    "ProcessId": 103,
                    "Name": "TabTip.exe",
                    "ExecutablePath": (
                        "C:\\Program Files\\Common Files\\Microsoft Shared\\"
                        "ink\\TabTip.exe"
                    ),
                    "CommandLine": "TabTip.exe",
                },
            ]
        )

        def process(command, **_kwargs):
            if any(item.startswith("--query-gpu=") for item in command):
                stdout = "NVIDIA GeForce RTX 5050, 3, 1213, 6699, 8151\n"
            elif any(item.startswith("--query-compute-apps=") for item in command):
                stdout = compute_text
            elif command[0] == "nvidia-smi" and command[1] == "pmon":
                stdout = pmon_text
            elif command[0] == "powershell":
                stdout = wmi_text
            else:
                raise AssertionError(command)
            return subprocess.CompletedProcess(command, 0, stdout, "")

        report = gate.resource_preflight(
            self.root,
            process_runner=process,
            disk_usage=lambda _path: Disk(100, 1, 80 * 1024**3),
        )
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["gpu"]["safeWddmGraphicsProcessCount"], 4)
        self.assertEqual(report["gpu"]["conflictingComputeProcessCount"], 0)
        self.assertEqual(report["gpu"]["wmiReconciliation"]["resolvedPids"], [102, 103])

    def test_python_torch_and_quantified_gpu_memory_are_rejected(self):
        Disk = namedtuple("Disk", "total used free")
        cases = (
            (
                "python_c_plus_g",
                "201, C:\\Python312\\python.exe, [N/A]\n",
                "0 201 C+G 1 0 - - python.exe\n",
                "training_or_compute_process_identity",
            ),
            (
                "torch_compute_only",
                "202, C:\\env\\Scripts\\torchrun.exe, [N/A]\n",
                "0 202 C 1 0 - - torchrun.exe\n",
                "compute_only_gpu_context",
            ),
            (
                "quantified_foreign_memory",
                "203, C:\\Tools\\render.exe, 512\n",
                "0 203 C+G 0 0 - - render.exe\n",
                "quantified_foreign_gpu_memory",
            ),
        )
        for label, compute_text, pmon_text, expected in cases:
            with self.subTest(label=label):
                def process(command, **_kwargs):
                    if any(item.startswith("--query-gpu=") for item in command):
                        stdout = "NVIDIA GeForce RTX 5050, 3, 1213, 6699, 8151\n"
                    elif any(
                        item.startswith("--query-compute-apps=") for item in command
                    ):
                        stdout = compute_text
                    elif command[0] == "nvidia-smi" and command[1] == "pmon":
                        stdout = pmon_text
                    else:
                        raise AssertionError(command)
                    return subprocess.CompletedProcess(command, 0, stdout, "")

                with self.assertRaises(gate.GatePreflightError) as captured:
                    gate.resource_preflight(
                        self.root,
                        process_runner=process,
                        disk_usage=lambda _path: Disk(100, 1, 80 * 1024**3),
                    )
                self.assertIn(expected, captured.exception.report["blockers"])

    def test_unresolved_insufficient_permission_process_fails_closed(self):
        Disk = namedtuple("Disk", "total used free")

        def process(command, **_kwargs):
            if any(item.startswith("--query-gpu=") for item in command):
                stdout = "NVIDIA GeForce RTX 5050, 3, 1213, 6699, 8151\n"
            elif any(item.startswith("--query-compute-apps=") for item in command):
                stdout = "301, [Insufficient Permissions], [N/A]\n"
            elif command[0] == "nvidia-smi" and command[1] == "pmon":
                stdout = "0 301 C+G 0 0 - - unknown.exe\n"
            elif command[0] == "powershell":
                stdout = "[]"
            else:
                raise AssertionError(command)
            return subprocess.CompletedProcess(command, 0, stdout, "")

        with self.assertRaises(gate.GatePreflightError) as captured:
            gate.resource_preflight(
                self.root,
                process_runner=process,
                disk_usage=lambda _path: Disk(100, 1, 80 * 1024**3),
            )
        self.assertIn(
            "unresolved_gpu_process_identity",
            captured.exception.report["blockers"],
        )

    def test_wmi_resolution_error_is_terminating_and_fails_closed(self):
        Disk = namedtuple("Disk", "total used free")
        observed_powershell: list[str] = []

        def process(command, **_kwargs):
            if any(item.startswith("--query-gpu=") for item in command):
                return subprocess.CompletedProcess(
                    command, 0, "NVIDIA GeForce RTX 5050, 3, 1213, 6699, 8151\n", ""
                )
            if any(item.startswith("--query-compute-apps=") for item in command):
                return subprocess.CompletedProcess(
                    command, 0, "401, [Insufficient Permissions], [N/A]\n", ""
                )
            if command[0] == "nvidia-smi" and command[1] == "pmon":
                return subprocess.CompletedProcess(
                    command, 0, "0 401 C+G 0 0 - - unknown.exe\n", ""
                )
            if command[0] == "powershell":
                observed_powershell.append(command[-1])
                return subprocess.CompletedProcess(
                    command, 1, "", "Get-CimInstance access failed"
                )
            raise AssertionError(command)

        with self.assertRaises(gate.GatePreflightError) as captured:
            gate.resource_preflight(
                self.root,
                process_runner=process,
                disk_usage=lambda _path: Disk(100, 1, 80 * 1024**3),
            )
        self.assertIn(
            "wmi_gpu_process_resolution_failed",
            captured.exception.report["blockers"],
        )
        self.assertEqual(len(observed_powershell), 1)
        self.assertIn("$ErrorActionPreference='Stop'", observed_powershell[0])
        self.assertIn("Get-CimInstance Win32_Process -ErrorAction Stop", observed_powershell[0])
        self.assertIn("ConvertTo-Json -InputObject $rows", observed_powershell[0])

    def test_launcher_has_no_training_or_checkpoint_write_primitive(self):
        source = inspect.getsource(gate)
        self.assertNotIn("torch.optim", source)
        self.assertNotIn(".backward(", source)
        self.assertNotIn("torch.save", source)
        self.assertNotIn("load_denoiser_checkpoint", source)
        self.assertNotIn("run_stage4_spatial_affine_readonly_gpu", source)
        self.assertIn(
            "issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket",
            source,
        )
        self.assertIn("ownerAuthorizationRequired", source)


if __name__ == "__main__":
    unittest.main()
