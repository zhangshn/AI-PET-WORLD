from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import run_stage4_semantic_transport_v2_controlled_smoke as adapter


def _write_json(path: Path, value: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TrainerMaterializationRecoveryTests(unittest.TestCase):
    def _fixture(self, root: Path):
        signed_ticket = root / "parent-ticket.json"
        signed_consumption = root / "parent-consumption.json"
        ticket_sha = _write_json(signed_ticket, {"ticketId": "parent-ticket"})
        consumption_sha = _write_json(
            signed_consumption, {"ticketId": "parent-ticket", "state": "consumed"},
        )
        active_config = root / ".runtime" / "active" / "active-config.json"
        program_lineage = {}
        graph_files = []
        graph_entrypoints = []
        for role, relative in (
            ("pythonAdapter", adapter.PYTHON_ADAPTER_PATH),
            ("pythonTrainingAdapter", adapter.PYTHON_TRAINING_ADAPTER_PATH),
        ):
            absolute = root / relative
            absolute.parent.mkdir(parents=True, exist_ok=True)
            absolute.write_text(f"fixture:{relative.as_posix()}\n", encoding="utf-8")
            binding = {
                "path": relative.as_posix(),
                "sha256": adapter.sha256_file(absolute),
            }
            program_lineage[role] = binding
            graph_files.append({
                "role": role,
                "path": binding["path"],
                "sha256": binding["sha256"],
                "byteSize": absolute.stat().st_size,
                "language": "python",
                "importedBy": [],
            })
            graph_entrypoints.append({
                "role": role,
                "path": binding["path"],
                "language": "python",
            })
        graph_core = {
            "schemaVersion": adapter.PROGRAM_GRAPH_SCHEMA,
            "status": "immutable_program_graph_verified",
            "graphId": adapter.PROGRAM_GRAPH_ID,
            "entrypoints": graph_entrypoints,
            "dynamicSuccessors": [],
            "nonLiteralDynamicDispatches": [],
            "files": graph_files,
            "imports": [],
            "externalModules": [],
            "fileCount": len(graph_files),
            "importEdgeCount": 0,
            "ownerAuthorizationRequired": False,
        }
        graph = {
            **graph_core,
            "graphContentSha256": hashlib.sha256(
                adapter.canonical_json(graph_core).encode("utf-8")
            ).hexdigest(),
        }
        graph_path = root / ".runtime" / "package" / "program-graph-manifest.json"
        graph_sha = _write_json(graph_path, graph)
        package_payload = {
            "programGraphManifest": {
                "path": graph_path.relative_to(root).as_posix(),
                "sha256": graph_sha,
            },
            "programLineage": program_lineage,
        }
        package_payload_path = root / ".runtime" / "package" / "package-payload.json"
        package_payload_sha = _write_json(package_payload_path, package_payload)
        args = SimpleNamespace(
            project_root=root,
            signed_ticket=signed_ticket,
            signed_ticket_sha256=ticket_sha,
            signed_consumption=signed_consumption,
            signed_consumption_sha256=consumption_sha,
            base_config=root / "unused-base.json",
            dataset_package_id="dataset-release-v1",
            package_id="stage4-v2-smoke-package-test",
            run_id="stage4-v2-smoke-run-test",
            output_namespace=".runtime/ai-painter/test-smoke-output",
            derived_ticket_id="stage4-v2-derived-ticket-test",
            derived_config_contract_sha256="a" * 64,
            autoencoder_checkpoint_path="data/autoencoder.pt",
            autoencoder_checkpoint_sha256="b" * 64,
            dataset_release_path="data/release.json",
            dataset_release_sha256="c" * 64,
            active_config=active_config,
            package_payload=package_payload_path,
            package_payload_sha256=package_payload_sha,
        )
        binding = {
            "boundConfigSha256": "d" * 64,
            "datasetPackageId": args.dataset_package_id,
            "runId": args.run_id,
            "outputNamespace": args.output_namespace,
        }
        config = {
            "training": {
                "stage4V2ControlledSmokeExecution": {
                    "signedParentTicketConsumption": {
                        "path": args.signed_consumption.relative_to(root).as_posix(),
                        "sha256": consumption_sha,
                    },
                },
            },
        }
        built = {
            "config": config,
            "ticket": {
                "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
                "ticketId": args.derived_ticket_id,
            },
            "binding": binding,
            "actions": ["create_optimizer", "execute_backward"],
        }
        return args, built

    def test_every_materialization_crash_point_recovers_without_new_ticket(self):
        hook_names = (
            "afterPreparePersisted",
            "afterTicketPersisted",
            "afterConsumptionPersisted",
            "afterConfigPersisted",
            "beforeCommitPersisted",
        )
        for hook_name in hook_names:
            with self.subTest(hook=hook_name), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                args, built = self._fixture(root)

                def crash():
                    raise RuntimeError(f"injected crash: {hook_name}")

                with patch.object(adapter, "build_active_config", return_value=built), \
                     patch.object(adapter, "validate_active_config", return_value=built["config"]):
                    with self.assertRaisesRegex(RuntimeError, "injected crash"):
                        adapter.materialize(args, {hook_name: crash})
                    recovered = adapter.materialize(args)
                    replay = adapter.materialize(args)

                self.assertEqual(recovered, replay)
                self.assertEqual(recovered["status"],
                                 "stage4_v2_controlled_smoke_active_config_materialized")
                self.assertTrue((args.active_config.parent /
                                 "trainer-materialization-commit.json").is_file())

    def test_prepared_child_ticket_substitution_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            args, built = self._fixture(root)
            with patch.object(adapter, "build_active_config", return_value=built), \
                 patch.object(adapter, "validate_active_config", return_value=built["config"]):
                with self.assertRaises(RuntimeError):
                    adapter.materialize(args, {
                        "afterTicketPersisted": lambda: (_ for _ in ()).throw(
                            RuntimeError("injected crash")
                        ),
                    })
                ticket_path = args.active_config.parent / "trainer-capability-ticket.json"
                ticket_path.write_text('{"ticketId":"substituted"}\n', encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "immutable derived Trainer evidence conflicts"):
                    adapter.materialize(args)

    def test_program_graph_substitution_is_rejected_before_child_materialization(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            args, _ = self._fixture(root)
            target = root / adapter.PYTHON_TRAINING_ADAPTER_PATH
            target.write_text(target.read_text(encoding="utf-8") + "# replaced\n",
                              encoding="utf-8")
            with patch.object(adapter, "build_active_config") as build:
                with self.assertRaisesRegex(ValueError, "program graph file SHA-256 changed"):
                    adapter.materialize(args)
            build.assert_not_called()
            self.assertFalse(args.active_config.exists())


if __name__ == "__main__":
    unittest.main()
