from __future__ import annotations

from copy import deepcopy
import ast
import inspect
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_ROOT = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE_ROOT = ROOT / "ml" / "ai-painter" / "src"
for import_root in (SCRIPTS_ROOT, SOURCE_ROOT):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

from ai_painter.complete_world import build_complete_world_system  # noqa: E402
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    FORMAL_CONDITION_CHANNEL_ORDER,
    RESPONSIBILITY_IDENTITIES,
    state_dict_sha256,
)
import run_stage4_semantic_transport_v2_readonly_gpu_qualification as runner  # noqa: E402
import train_ai_assisted_conditional_denoiser as trainer  # noqa: E402


class Stage4SemanticTransportV2ReadonlyGpuQualificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runner._load_project_modules()
        cls.model_config = runner.build_qualification_model_config()

    def setUp(self):
        runtime_tests = ROOT / ".runtime" / "ai-painter" / "python-test-runs"
        runtime_tests.mkdir(parents=True, exist_ok=True)
        self.case_root = Path(
            tempfile.mkdtemp(prefix="stage4-v2-readonly-", dir=runtime_tests)
        )

    def tearDown(self):
        if self.case_root.is_dir():
            shutil.rmtree(self.case_root)

    def _write_json(self, path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _binding(self, relative_path: Path) -> dict[str, str]:
        return runner.binding(ROOT / relative_path)

    def _program_graph_binding(self, program_lineage: dict) -> dict[str, str]:
        files = []
        entrypoints = []
        for role, program_binding in sorted(program_lineage.items()):
            absolute = ROOT / program_binding["path"]
            files.append(
                {
                    "role": role,
                    "path": program_binding["path"],
                    "sha256": program_binding["sha256"],
                    "byteSize": absolute.stat().st_size,
                    "language": "python",
                    "importedBy": [],
                }
            )
            entrypoints.append(
                {
                    "role": role,
                    "path": program_binding["path"],
                    "language": "python",
                }
            )
        core = {
            "schemaVersion": runner.PROGRAM_GRAPH_SCHEMA,
            "status": "immutable_program_graph_verified",
            "graphId": runner.PROGRAM_GRAPH_ID,
            "entrypoints": entrypoints,
            "dynamicSuccessors": [],
            "nonLiteralDynamicDispatches": [],
            "files": files,
            "imports": [],
            "externalModules": [],
            "fileCount": len(files),
            "importEdgeCount": 0,
            "ownerAuthorizationRequired": False,
        }
        graph = {**core, "graphContentSha256": runner._canonical_sha256(core)}
        graph_path = self.case_root / "program-graph-manifest.json"
        self._write_json(graph_path, graph)
        return runner.binding(graph_path)

    def _active_case(self) -> tuple[Path, Path, dict]:
        run_id = f"stage4-v2-readonly-{uuid4().hex}"
        package_id = f"stage4-v2-readonly-package-{uuid4().hex}"
        ticket_id = f"stage4-v2-readonly-ticket-{uuid4().hex}"
        ticket_path = self.case_root / "ticket.json"
        consumption_path = self.case_root / "ticket-consumption.json"
        self._write_json(
            ticket_path,
            {
                "schemaVersion": "test-stage4-v2-internal-ticket-v1",
                "status": "issued",
                "ticketId": ticket_id,
                "packageId": package_id,
                "runId": run_id,
            },
        )
        self._write_json(
            consumption_path,
            {
                "schemaVersion": "test-stage4-v2-ticket-consumption-v1",
                "status": "consumed_once",
                "ticketId": ticket_id,
                "packageId": package_id,
                "runId": run_id,
            },
        )
        foundation = json.loads(
            (ROOT / runner.FOUNDATION_CONTRACT_PATH).read_text(encoding="utf-8")
        )
        output_dir = self.case_root / "output" / run_id
        program_lineage = {
            "pythonRunner": self._binding(runner.RUNNER_PATH),
            "modelFactory": self._binding(runner.MODEL_FACTORY_PATH),
            "successorModule": self._binding(runner.SUCCESSOR_MODULE_PATH),
            "trainer": self._binding(runner.TRAINER_PATH),
            "trainerSupport": self._binding(runner.TRAINER_SUPPORT_PROGRAM_PATH),
        }
        active = {
            "schemaVersion": runner.ACTIVE_CONFIG_SCHEMA,
            "status": "readonly_gpu_qualification_active",
            "packageId": package_id,
            "runId": run_id,
            "outputDirectory": runner.project_path(output_dir),
            "ticket": {
                "status": "consumed_once",
                "ticketId": ticket_id,
                "ticketPath": runner.project_path(ticket_path),
                "ticketSha256": runner.file_sha256(ticket_path),
                "consumptionPath": runner.project_path(consumption_path),
                "consumptionSha256": runner.file_sha256(consumption_path),
            },
            "bindings": {
                "parentContract": self._binding(runner.PARENT_CONTRACT_PATH),
                "datasetRelease": self._binding(runner.DATASET_RELEASE_PATH),
                "trainerSupport": self._binding(runner.TRAINER_SUPPORT_PATH),
                "foundationAutoencoder": self._binding(
                    runner.FOUNDATION_CONTRACT_PATH
                ),
            },
            "programLineage": program_lineage,
            "programGraphManifest": self._program_graph_binding(program_lineage),
            "fixedInputs": {
                "seed": runner.SEED,
                "resolution": {"width": 256, "height": 192},
                "batchSize": 1,
                "diffusionTimestep": runner.DIFFUSION_TIMESTEP,
                "firstTrainSampleId": runner.FIRST_TRAIN_SAMPLE_ID,
                "fixedValidationSampleId": runner.VALIDATION_SAMPLE_ID,
                "conditionChannels": 23,
                "latentChannels": 12,
            },
            "autoencoderBinding": {
                "path": foundation["checkpoint"]["path"],
                "sha256": foundation["checkpoint"]["sha256"],
            },
            "safety": {
                "gpuForwardAllowed": True,
                "autogradGradAllowed": True,
                "autoencoderCheckpointReadAllowed": True,
                "optimizerAllowed": False,
                "backwardAllowed": False,
                "denoiserCheckpointReadAllowed": False,
                "checkpointWriteAllowed": False,
                "weightMutationAllowed": False,
                "trainingAllowed": False,
                "smokeAllowed": False,
                "stage0Allowed": False,
            },
        }
        config_path = self.case_root / "active-config.json"
        self._write_json(config_path, active)
        return config_path, output_dir, active

    def test_active_config_accepts_only_consumed_readonly_child_boundary(self):
        config_path, output_dir, active = self._active_case()
        audit = runner.validate_active_config_value(
            active,
            config_path=config_path,
            config_sha256=runner.file_sha256(config_path),
            output_dir=output_dir,
        )
        self.assertEqual(audit["runId"], active["runId"])
        self.assertEqual(audit["ticket"]["status"], "consumed_once")
        self.assertFalse(audit["safety"]["optimizerAllowed"])
        self.assertFalse(audit["safety"]["backwardAllowed"])
        self.assertEqual(
            audit["programGraphManifest"]["graphId"], runner.PROGRAM_GRAPH_ID
        )

    def test_project_imports_are_deferred_behind_program_graph_validation(self):
        source = (ROOT / runner.RUNNER_PATH).read_text(encoding="utf-8")
        module = ast.parse(source)
        top_level_modules = set()
        for statement in module.body:
            if isinstance(statement, ast.Import):
                top_level_modules.update(alias.name for alias in statement.names)
            elif isinstance(statement, ast.ImportFrom) and statement.module:
                top_level_modules.add(statement.module)
        self.assertFalse(
            any(name.startswith("ai_painter") for name in top_level_modules)
        )
        self.assertNotIn(
            "train_ai_assisted_conditional_denoiser", top_level_modules
        )
        validation_source = inspect.getsource(runner.validate_readonly_gpu_inputs)
        self.assertLess(
            validation_source.index("validate_active_config_value("),
            validation_source.index("_load_project_modules()"),
        )
        run_source = inspect.getsource(runner.run_readonly_gpu_qualification)
        self.assertLess(
            run_source.index("validate_program_graph_manifest_binding("),
            run_source.index("require_formal_cuda()"),
        )

    def test_program_graph_file_substitution_is_rejected_from_real_bytes(self):
        config_path, output_dir, active = self._active_case()
        graph_path = ROOT / active["programGraphManifest"]["path"]
        graph = json.loads(graph_path.read_text(encoding="utf-8"))
        graph["files"][0]["sha256"] = "0" * 64
        core = {
            key: value
            for key, value in graph.items()
            if key != "graphContentSha256"
        }
        graph["graphContentSha256"] = runner._canonical_sha256(core)
        self._write_json(graph_path, graph)
        active["programGraphManifest"] = runner.binding(graph_path)
        self._write_json(config_path, active)
        with self.assertRaisesRegex(ValueError, "program_graph_file_sha256_changed"):
            runner.validate_active_config_value(
                active,
                config_path=config_path,
                config_sha256=runner.file_sha256(config_path),
                output_dir=output_dir,
            )

    def test_active_config_rejects_replay_mutation_and_training_gates(self):
        mutations = []
        config_path, output_dir, active = self._active_case()

        wrong_seed = deepcopy(active)
        wrong_seed["fixedInputs"]["seed"] += 1
        mutations.append(wrong_seed)

        optimizer_open = deepcopy(active)
        optimizer_open["safety"]["optimizerAllowed"] = True
        mutations.append(optimizer_open)

        backward_open = deepcopy(active)
        backward_open["safety"]["backwardAllowed"] = True
        mutations.append(backward_open)

        denoiser_checkpoint_open = deepcopy(active)
        denoiser_checkpoint_open["safety"]["denoiserCheckpointReadAllowed"] = True
        mutations.append(denoiser_checkpoint_open)

        stale_runner = deepcopy(active)
        stale_runner["programLineage"]["pythonRunner"]["sha256"] = "0" * 64
        mutations.append(stale_runner)

        obsolete_runner_role = deepcopy(active)
        obsolete_runner_role["programLineage"]["runner"] = (
            obsolete_runner_role["programLineage"].pop("pythonRunner")
        )
        mutations.append(obsolete_runner_role)

        missing_program_graph = deepcopy(active)
        missing_program_graph.pop("programGraphManifest")
        mutations.append(missing_program_graph)

        stale_program_graph = deepcopy(active)
        stale_program_graph["programGraphManifest"]["sha256"] = "0" * 64
        mutations.append(stale_program_graph)

        unconsumed = deepcopy(active)
        unconsumed["ticket"]["status"] = "issued"
        mutations.append(unconsumed)

        for index, mutated in enumerate(mutations):
            mutated_path = self.case_root / f"mutated-{index}.json"
            self._write_json(mutated_path, mutated)
            with self.subTest(index=index), self.assertRaises(ValueError):
                runner.validate_active_config_value(
                    mutated,
                    config_path=mutated_path,
                    config_sha256=runner.file_sha256(mutated_path),
                    output_dir=output_dir,
                )

        output_dir.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "output_reuse_forbidden"):
            runner.validate_active_config_value(
                active,
                config_path=config_path,
                config_sha256=runner.file_sha256(config_path),
                output_dir=output_dir,
            )

    def test_real_release_resolves_sample146_and_full_coverage_sample194(self):
        config_path, output_dir, active = self._active_case()
        audit = runner.validate_active_config_value(
            active,
            config_path=config_path,
            config_sha256=runner.file_sha256(config_path),
            output_dir=output_dir,
        )
        governance = runner._validate_governance_chain(audit, project_root=ROOT)
        resolved = runner.resolve_formal_inputs(
            self.model_config,
            governance,
        )
        self.assertEqual(resolved["splitCounts"], runner.EXPECTED_SPLIT_COUNTS)
        self.assertEqual(
            resolved["trainSample"]["sampleId"],
            runner.FIRST_TRAIN_SAMPLE_ID,
        )
        self.assertEqual(
            resolved["validationSample"]["sampleId"],
            runner.VALIDATION_SAMPLE_ID,
        )
        self.assertFalse(resolved["trainOccupancy"]["terrain_water"])
        self.assertFalse(resolved["trainOccupancy"]["terrain_shoreline"])
        self.assertTrue(all(resolved["validationOccupancy"].values()))
        self.assertEqual(len(resolved["trainAssets"]["channels"]), 23)
        self.assertEqual(len(resolved["validationAssets"]["channels"]), 23)

    def test_resolution_matrix_never_infers_large_profiles_from_smoke(self):
        matrix = runner.build_resolution_profile_matrix(
            measured_profile_id="smoke",
            measured={
                "gpuPeakMemoryBytes": 1024,
                "cpuMemoryPeakBytes": 2048,
                "batchSize": 1,
                "durationSeconds": 1.25,
                "throughput": 1.6,
                "oom": False,
                "outputValid": True,
                "sourceFactCoverage": True,
                "imageDimensions": {"width": 256, "height": 192},
            },
        )
        self.assertEqual(
            [item["profileId"] for item in matrix],
            ["smoke", "qualification", "target"],
        )
        self.assertEqual(matrix[0]["measurementStatus"], "measured")
        for item in matrix[1:]:
            self.assertEqual(item["measurementStatus"], "not_measured")
            self.assertEqual(item["blockedReason"], "gpu_measurement_not_run")
            self.assertTrue(item["requiredBeforeFormalStage0"])

    def test_resolution_matrix_rejects_incomplete_real_measurement(self):
        with self.assertRaisesRegex(ValueError, "measurement_missing_cpuMemoryPeakBytes"):
            runner.build_resolution_profile_matrix(
                measured_profile_id="smoke",
                measured={
                    "gpuPeakMemoryBytes": 1024,
                    "batchSize": 1,
                    "durationSeconds": 1.25,
                    "throughput": 1.6,
                    "oom": False,
                    "outputValid": True,
                    "sourceFactCoverage": True,
                    "imageDimensions": {"width": 256, "height": 192},
                },
            )

    def test_cpu_inventory_is_exact_and_private_namespaces_are_disjoint(self):
        torch.manual_seed(runner.SEED)
        model = build_complete_world_system(self.model_config)
        inventory = runner.validate_parameter_inventory(model)
        self.assertEqual(inventory["parameterTensorCount"], 210)
        self.assertEqual(inventory["parameterScalarCount"], 4_743_755)
        self.assertEqual(inventory["sharedParameterTensorCount"], 98)
        self.assertEqual(inventory["autoencoderParameterTensorCount"], 64)
        self.assertEqual(inventory["autoencoderParameterScalarCount"], 2_527_887)
        self.assertTrue(inventory["optimizerParameterIdentityExact"])
        self.assertTrue(inventory["autoencoderExcluded"])
        for identity in RESPONSIBILITY_IDENTITIES:
            self.assertEqual(
                inventory["responsibilityNamespaces"][identity],
                {
                    "responsibilityPathTensorCount": 12,
                    "rgbHeadTensorCount": 4,
                },
            )

    def test_gradient_contract_is_applicability_aware_but_sample194_is_strict(self):
        torch.manual_seed(runner.SEED)
        model = build_complete_world_system(self.model_config)
        inventory = runner.validate_parameter_inventory(model)
        named = inventory["namedParameters"]
        absent = {"terrain_water", "terrain_shoreline"}
        occupancy = {identity: identity not in absent for identity in RESPONSIBILITY_IDENTITIES}
        gradients = []
        for name, parameter in named:
            identity = runner._private_parameter_identity(name)
            gradients.append(None if identity in absent else torch.ones_like(parameter))
        summary = runner.summarize_parameter_gradients(
            named,
            gradients,
            occupancy=occupancy,
            require_all=False,
        )
        self.assertTrue(summary["allRequiredParametersFiniteNonzero"])
        self.assertEqual(len(summary["permittedAbsentOrZeroParameterNames"]), 32)
        with self.assertRaisesRegex(ValueError, "required_parameter_unreachable"):
            runner.summarize_parameter_gradients(
                named,
                gradients,
                occupancy={identity: True for identity in RESPONSIBILITY_IDENTITIES},
                require_all=True,
            )

    def test_tiny_formal_v6_graph_reaches_all_210_parameters_without_state_change(self):
        torch.manual_seed(runner.SEED)
        model = build_complete_world_system(self.model_config)
        model.train()
        inventory = runner.validate_parameter_inventory(model)
        before_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
        before_denoiser = state_dict_sha256(model.denoiser.state_dict())
        clean_latent = torch.randn(1, 12, 4, 4)
        noise = torch.randn_like(clean_latent)
        conditions = torch.rand(1, 23, 16, 16, requires_grad=True)
        conditions.data[:, :15] = 0
        for identity in RESPONSIBILITY_IDENTITIES:
            conditions.data[:, FORMAL_CONDITION_CHANNEL_ORDER.index(identity)] = 1
        target_rgb = torch.sigmoid(torch.randn(1, 3, 16, 16))
        diffusion = trainer.build_diffusion_schedule(
            self.model_config,
            torch.device("cpu"),
        )
        timestep = torch.tensor([37], dtype=torch.long)
        noisy_latent = trainer.add_noise(
            clean_latent,
            noise,
            timestep,
            diffusion["alphasCumulative"],
        ).requires_grad_(True)
        target_velocity = trainer.velocity_target(
            clean_latent,
            noise,
            timestep,
            diffusion["alphasCumulative"],
        )
        normalization = {
            "mean": torch.zeros(1, 12, 1, 1),
            "standardDeviation": torch.ones(1, 12, 1, 1),
        }
        metrics = trainer.predict_and_measure(
            model,
            noisy_latent,
            target_velocity,
            clean_latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            self.model_config,
            target_rgb,
            normalization,
        )
        named = inventory["namedParameters"]
        gradients = torch.autograd.grad(
            metrics["compositeLossTensor"],
            tuple(parameter for _, parameter in named) + (noisy_latent, conditions),
            allow_unused=True,
            materialize_grads=False,
        )
        summary = runner.summarize_parameter_gradients(
            named,
            gradients[:210],
            occupancy={identity: True for identity in RESPONSIBILITY_IDENTITIES},
            require_all=True,
        )
        self.assertEqual(summary["nonzeroParameterTensorCount"], 210)
        self.assertTrue(
            runner.summarize_tensor_gradient(
                gradients[-2],
                expected_shape=(1, 12, 4, 4),
                label="test_latent",
                require_each_channel=True,
            )["allChannelsNonzero"]
        )
        self.assertTrue(
            runner.summarize_tensor_gradient(
                gradients[-1],
                expected_shape=(1, 23, 16, 16),
                label="test_conditions",
                require_each_channel=True,
            )["allChannelsNonzero"]
        )
        state = runner.validate_state_integrity(
            autoencoder_hashes={
                "before": before_autoencoder,
                "after": state_dict_sha256(model.autoencoder.state_dict()),
            },
            denoiser_hashes={
                "before": before_denoiser,
                "after": state_dict_sha256(model.denoiser.state_dict()),
            },
            model=model,
        )
        self.assertTrue(state["autoencoderUnchanged"])
        self.assertTrue(state["denoiserUnchanged"])
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))

    def test_formal_execution_requires_cuda_and_exclusive_output(self):
        with patch.object(runner.torch.cuda, "is_available", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "cuda_required"):
                runner.require_formal_cuda()

        output = self.case_root / "immutable.json"
        runner._write_json_exclusive(output, {"status": "first"})
        with self.assertRaises(FileExistsError):
            runner._write_json_exclusive(output, {"status": "overwrite"})

    def test_runner_source_has_no_training_or_checkpoint_mutation_primitive(self):
        source = inspect.getsource(runner)
        self.assertNotIn("torch.optim", source)
        self.assertNotIn(".backward(", source)
        self.assertNotIn("load_denoiser_checkpoint(", source)
        self.assertNotIn("torch.save(", source)
        self.assertIn("torch.autograd.grad(", source)
        self.assertIn("trainer.compute_latent_normalization(", source)
        self.assertIn("trainer.predict_and_measure(", source)


if __name__ == "__main__":
    unittest.main()
