"""Synthetic CPU lifecycle tests; no real row, CUDA, optimizer or model probe."""
import json
import hashlib
from pathlib import Path
import tempfile
import os
import uuid
import unittest
from unittest.mock import patch
import torch
import painter_stage4_appearance_regime_gradient_failure_capture_worker as worker

ORDER = tuple(json.loads((worker.ROOT / "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json").read_bytes())["tensorContract"]["channelOrder"])

class Dummy(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = torch.nn.Parameter(torch.tensor(0.0))
    def forward(self, *args, **kwargs):
        raise AssertionError("candidate model must receive explicit sample_forward")

def sample(ordinal=0):
    return {"sampleId": "synthetic-validation-" + str(ordinal), "split": "validation",
        "conditions": torch.zeros(23, 192, 256), "image": torch.zeros(3, 192, 256),
        "objectInstanceTable": (), "appearance_regime": torch.tensor([1., 0., 0., 0.])}

def selection():
    return {"epoch": 24, "worstApplicableObjectCorrelation": 0.2,
        "meanValidationRgbMae": 0.3, "rank": [0.2, -0.3, -24],
        "applicableImageCounts": {k: 1 for k in worker.OBJECT_CHANNELS},
        "qualificationGranted": False, "checkpointPromotionEligible": False}

class WorkerTests(unittest.TestCase):
    def test_explicit_readonly_source_whitelist_rehashes_real_asset_without_copy(self):
        evidence = Path(os.environ.get("AI_PAINTER_TEST_EVIDENCE_ROOT", worker.ROOT / Path(worker.CPU_REPORT_PATH).parent.parent / "lifecycle"))
        root = evidence / ("acceptance-reader-test-" + uuid.uuid4().hex[:8]) / "isolated-project"
        root.mkdir(parents=True)
        logical = str(Path(worker.CPU_REPORT_PATH).parent.parent.parent / "gradient-failure-capture-t-q4-37/lifecycle" / ("synthetic-reader-source-"+uuid.uuid4().hex+".bin"))
        source_path = worker.ROOT / logical
        source_path.write_bytes(b"synthetic bytes, no dataset pixels")
        source = {"path": logical.replace("\\","/"), "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest()}
        before = hashlib.sha256(source_path.read_bytes()).hexdigest()
        self.assertEqual(before, source["sha256"])
        target = root / worker.ISOLATED_READONLY_PATH
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({"schemaVersion": "ai-painter-v28-isolated-readonly-inputs-v1",
            "capabilityVersion": worker.CAPABILITY, "sourceRoot": "F:/ai-pet-world",
            "inputs": [{"binding": source, "resolvedPath": source_path.resolve().as_posix()}]}), encoding="utf8")
        reader = worker._bound_reader(root)
        self.assertEqual(hashlib.sha256(reader.read(source)).hexdigest(), before)
        self.assertFalse((root / source["path"]).exists())
        reader.unchanged()
        with self.assertRaisesRegex(ValueError, "whitelist"):
            reader.read({**source, "sha256": "0"*64})
        with self.assertRaises(FileNotFoundError):
            reader.read({"path": "data/unlisted-source.bin", "sha256": "0"*64})
        reader.readonly[source["path"]]["resolvedPath"] = "F:/wrong-source"
        with self.assertRaisesRegex(ValueError, "resolution changed"):
            reader.read(source)
        self.assertEqual(hashlib.sha256(source_path.read_bytes()).hexdigest(), before)
        self.assertFalse(torch.cuda.is_initialized())

    def test_import_and_invalid_gate_never_create_optimizer_or_cuda(self):
        result = worker.frozen.run_with_terminal_boundary(terminal_sink=lambda _: None,
            train_samples=[], validation_samples=[], channel_order=[], training_gate=True,
            resource_check=lambda: None, checkpoint_sink=lambda *_: None, device=torch.device("cpu"))
        self.assertEqual(result["schemaVersion"], worker.IDENTITY["terminalSchema"])
        self.assertEqual(result["optimizerStepsGenerator"], 0)
        self.assertEqual(result["status"], "experiment_failed_closed")
        self.assertFalse(torch.cuda.is_initialized())

    def test_validation_uses_exact_explicit_season_and_restores_mode(self):
        model = Dummy().train()
        row = sample()
        seen = []
        def forward(actual_model, actual_sample, return_evidence=False):
            self.assertIs(actual_model, model)
            self.assertIs(actual_sample["appearance_regime"], row["appearance_regime"])
            self.assertFalse(actual_model.training)
            seen.append(actual_sample["sampleId"])
            return torch.zeros(1, 3, 192, 256)
        # Explicit synthetic numeric boundary; authentication and registry stay real.
        with patch.object(worker.frozen, "sample_forward", forward), patch.object(worker.frozen,
                "original_object_class_spatial_loss",
                return_value=(torch.tensor(0.), {k: 0.2 for k in worker.OBJECT_CHANNELS})):
            observed = worker.validation_observation(model, row, ORDER, epoch=24)
        self.assertEqual(seen, [row["sampleId"]])
        self.assertTrue(model.training)
        self.assertEqual(observed["fullRgbMae"], 0)
        self.assertIsNone(model.weight.grad)

    def test_validation_rejects_missing_season_without_default(self):
        row = sample()
        del row["appearance_regime"]
        with patch.object(worker.frozen, "profile") as provider:
            provider.return_value.sample_forward.side_effect = KeyError("appearance_regime")
            with self.assertRaises(KeyError):
                worker.validation_observation(Dummy(), row, ORDER, epoch=24)

    def test_checkpoint_identity_roundtrip_and_old_rejection(self):
        model, critic = Dummy(), Dummy()
        package = {"path": "fixture/package.json", "sha256": "1"*64}
        contract = {"path": "fixture/policy.json", "sha256": "2"*64}
        payload, states = worker.serialize_checkpoint(model, critic, epoch=24, selection=selection(),
            execution_package=package, candidate_contract=contract,
            identity=worker.IDENTITY)
        actual = worker.reload_checkpoint_exact(payload, expected_epoch=24, expected_selection=selection(),
            execution_package=package, candidate_contract=contract, channel_order=ORDER,
            network_factory=lambda _: (Dummy(), Dummy()), identity=worker.IDENTITY)
        self.assertEqual(actual[2], states)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata"):
            worker.base.reload_checkpoint_exact(payload, expected_epoch=24, expected_selection=selection(),
                execution_package=package, candidate_contract=contract, channel_order=ORDER,
                network_factory=lambda _: (Dummy(), Dummy()))

    def test_real_single_ticket_consumption_preserves_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "fixture/ticket.json"
            target.parent.mkdir()
            target.write_text('{"synthetic":true}\n', encoding="utf8")
            binding = {"path":"fixture/ticket.json","sha256":hashlib.sha256(target.read_bytes()).hexdigest()}
            gate = worker.base._AuthenticatedTrainingGate(
                {"path":"fixture/package.json","sha256":"1"*64},
                {"path":"fixture/policy.json","sha256":"2"*64},
                "fixture-run", "fixture-package", "fixture", binding,
                "fixture/training-ticket-consumed.json", None, {}, ())
            consumed = worker.base.consume_training_ticket(gate, root=root,
                capability=worker.CAPABILITY, claim_schema="ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
            before = (root / consumed.consumption_claim["path"]).read_bytes()
            with self.assertRaisesRegex(ValueError, "already consumed"):
                worker.base.consume_training_ticket(gate, root=root,
                    capability=worker.CAPABILITY, claim_schema="ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
            self.assertEqual((root / consumed.consumption_claim["path"]).read_bytes(), before)

    def test_partial_counts_primary_error_preserved(self):
        def synthetic_failure(**kwargs):
            kwargs["_progress_state"]["optimizerSteps"].update(generator=7, discriminator=6)
            raise RuntimeError("synthetic primary failure")
        with patch.object(worker.frozen, "bounded_training_loop", synthetic_failure):
            result = worker.frozen.run_with_terminal_boundary(terminal_sink=lambda _: None, training_gate=None)
        self.assertEqual(result["optimizerStepsGenerator"], 7)
        self.assertEqual(result["optimizerStepsDiscriminator"], 6)
        self.assertEqual(result["error"], "synthetic primary failure")

    def test_stale_cpu_report_is_not_candidate_qualification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / worker.CPU_REPORT_PATH
            target.parent.mkdir(parents=True)
            target.write_text('{"status":"cpu_contract_checked_not_execution_qualified"}', encoding="utf8")
            binding = {"path":worker.CPU_REPORT_PATH,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "real CPU proof differs"):
                worker.read_model_cpu_proof(worker._bound_reader(root), binding)

if False:
    unittest.main()


class FailureCaptureAdapterTests(unittest.TestCase):
    def test_original_pair_once_and_primary_error_with_partial_counts(self):
        from pathlib import Path
        import tempfile,time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        with tempfile.TemporaryDirectory(dir=str(Path(os.environ.get("AI_PAINTER_TEST_EVIDENCE_ROOT", worker.ROOT)))) as directory:
            state={"actualEpoch":5}; diagnostic={}; counts={"generator":192,"discriminator":192}
            original=ValueError("original gradient mismatch"); events=[]
            def pair(*args):
                events.append("pair");counts["discriminator"]+=1;raise original
            def capture(**kw):
                events.append("capture");self.assertIs(kw["error"],original)
                self.assertEqual(kw["counts"],{"generator":192,"discriminator":193})
                self.assertEqual((kw["epoch"],kw["train_position"]),(5,1))
                return {"status":"synthetic_capture_receipt"}
            runner=adapter.make_failure_capture_pair_runner(progress=state,output_root=Path(directory)/"capture",
                execution_binding={},source_bindings=[],diagnostic=diagnostic,deadline=time.monotonic()+60,capture=capture,pair=pair)
            args=(None,None,{"sampleId":"explicit-event","split":"train"},(),None,None,counts,{},lambda:None,None)
            with self.assertRaises(ValueError) as caught:runner(*args)
            self.assertIs(caught.exception,original);self.assertEqual(events,["pair","capture"])
            self.assertEqual(diagnostic["sampleId"],"explicit-event")
            with self.assertRaises(ValueError):runner(*args)
            self.assertEqual(events,["pair","capture"])

    def test_capture_error_budget_and_deadline_do_not_replace_primary(self):
        from pathlib import Path
        import tempfile,time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        for mode in ("io","deadline","budget"):
            with tempfile.TemporaryDirectory(dir=str(Path(os.environ.get("AI_PAINTER_TEST_EVIDENCE_ROOT", worker.ROOT)))) as directory:
                diagnostic={};original=RuntimeError("primary");called=[]
                def pair(*args):raise original
                def capture(**kw):called.append(True);raise OSError("synthetic capture disk failure")
                runner=adapter.make_failure_capture_pair_runner(progress={"actualEpoch":1},output_root=Path(directory)/"capture",
                    execution_binding={},source_bindings=[],diagnostic=diagnostic,
                    deadline=time.monotonic()+(60 if mode!="deadline" else -1),capture=capture,pair=pair)
                with patch.object(adapter,"remaining_capture_bytes",return_value=0 if mode=="budget" else 64*1024**2):
                    with self.assertRaises(RuntimeError) as caught:runner(None,None,{"sampleId":"s"},(),None,None,{"generator":0,"discriminator":1},{},None,None)
                self.assertIs(caught.exception,original);self.assertIn("captureError",diagnostic)
                self.assertEqual(len(called),1 if mode=="io" else 0)

    def test_normal_pair_returns_original_without_capture_or_state_change(self):
        from pathlib import Path
        import tempfile,time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        with tempfile.TemporaryDirectory(dir=str(Path(os.environ.get("AI_PAINTER_TEST_EVIDENCE_ROOT", worker.ROOT)))) as directory:
            expected=object();args_seen=[]
            def pair(*args):args_seen.append(args);return expected
            runner=adapter.make_failure_capture_pair_runner(progress={"actualEpoch":1},output_root=Path(directory)/"capture",
                execution_binding={},source_bindings=[],diagnostic={},deadline=time.monotonic()+60,
                capture=lambda **kw:self.fail("normal pair capture"),pair=pair)
            args=(None,None,{"sampleId":"s"},(),None,None,{"generator":0,"discriminator":0},{},None,None)
            self.assertIs(runner(*args),expected);self.assertEqual(args_seen,[args])
            self.assertFalse((Path(directory)/"capture").exists())

    def test_captured_boundary_preserves_failed_terminal_and_pre_capture_counts(self):
        import time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        with tempfile.TemporaryDirectory(dir=os.environ["AI_PAINTER_TEST_EVIDENCE_ROOT"]) as directory:
            root=Path(directory);out=root/"run";out.mkdir()
            gate=adapter.base._AuthenticatedTrainingGate({}, {}, "test-run", "test-package", "run", {},
                "run/consumed.json", None, {}, ())
            consumed=adapter.base._ConsumedTrainingGate(gate,{})
            original=RuntimeError("original actual pair failure")
            captures=[];terminals=[]
            def pair(*args):
                args[6]["discriminator"]+=1;raise original
            def capture(**kw):captures.append(kw);return {"status":"synthetic_capture"}
            def loop(**kw):
                progress=kw["_progress_state"];progress.update(actualEpoch=5,completedEpochs=4)
                progress["optimizerSteps"].update(generator=192,discriminator=192)
                kw["pair_runner"](None,None,{"sampleId":"event-id"},(),None,None,progress["optimizerSteps"],{},None,None)
            # Explicit synthetic numerical loop boundary, with a real immutable terminal writer.
            with patch.object(adapter.frozen,"bounded_training_loop",loop):
                value=adapter.run_captured_boundary(terminal_sink=lambda t:(adapter.base._write_exclusive_json(out/"phase-terminal.json",t),terminals.append(t)),
                    output_root=out/"capture",execution_binding={},source_bindings=[],started=time.monotonic(),
                    capture=capture,pair=pair,training_gate=consumed,artifact_root=root)
            self.assertEqual(len(captures),1);self.assertEqual(len(terminals),1)
            self.assertEqual(value["error"],str(original));self.assertEqual(value["completedEpochs"],4)
            self.assertEqual((value["optimizerStepsGenerator"],value["optimizerStepsDiscriminator"]),(192,193))
            before=json.loads((out/"failure-capture-started.json").read_bytes())
            self.assertEqual(before["sampleId"],"event-id");self.assertEqual(before["optimizerStepsGenerator"],192)
            self.assertIn("failureCaptureReceipt",value)
            self.assertFalse(torch.cuda.is_initialized())

    def test_normal_loop_result_reaches_checkpoint_review_pending_unchanged(self):
        import time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        with tempfile.TemporaryDirectory(dir=os.environ["AI_PAINTER_TEST_EVIDENCE_ROOT"]) as directory:
            root=Path(directory);out=root/"run";out.mkdir()
            gate=adapter.base._AuthenticatedTrainingGate({}, {}, "test-run", "test-package", "run", {},"run/consumed.json",None,{},())
            consumed=adapter.base._ConsumedTrainingGate(gate,{})
            original={"status":"training_completed_review_pending","capabilityVersion":adapter.CAPABILITY,
                "optimizerStepsGenerator":2304,"optimizerStepsDiscriminator":2304,
                "checkpoints":[{"epoch":24},{"epoch":36},{"epoch":48}],"selectedEpoch":24,"checkpointReloadVerified":True}
            terminals=[]
            with patch.object(adapter.frozen,"bounded_training_loop",return_value=original.copy()):
                value=adapter.run_captured_boundary(terminal_sink=terminals.append,output_root=out/"capture",
                    execution_binding={},source_bindings=[],started=time.monotonic(),training_gate=consumed,artifact_root=root)
            for key,data in original.items():self.assertEqual(value[key],data)
            self.assertEqual(value["failureCapture"],{"failureCaptureTriggered":False})
            self.assertEqual(len(terminals),1);self.assertFalse((out/"capture").exists())

    def test_real_N_capture_with_synthetic_107_graph_preserves_state_and_safe_receipt(self):
        import time
        import painter_stage4_appearance_regime_gradient_failure_capture_worker as adapter
        from test_appearance_regime_gradient_failure_capture import ArtificialModel,fixture_error,frozen_state,same_bytes
        from ai_painter.complete_world.appearance_regime_gradient_failure_capture import verify_gradient_failure_capture
        task=json.loads((adapter.ROOT/Path(adapter.CPU_REPORT_PATH).parent.parent.parent/
            "gradient-failure-capture-t-q4-37/lifecycle-workorder.json").read_bytes())
        parent=adapter.ROOT/task["outputRoot"]/"synthetic-tests";parent.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            root=Path(directory);model=ArtificialModel();critic=torch.nn.Linear(3,2)
            error=fixture_error(model,mismatch=True);before=frozen_state(model,critic)
            package=root/"package.json";package.write_text(json.dumps({"outputRoot":root.relative_to(adapter.ROOT).as_posix()}),encoding="utf8")
            binding={"path":package.relative_to(adapter.ROOT).as_posix(),"sha256":hashlib.sha256(package.read_bytes()).hexdigest()}
            diagnostic={}
            def pair(*args):raise error
            runner=adapter.make_failure_capture_pair_runner(progress={"actualEpoch":1},output_root=root/"capture",
                execution_binding=binding,source_bindings=[],diagnostic=diagnostic,deadline=time.monotonic()+60,pair=pair)
            with self.assertRaises(ValueError) as caught:runner(model,critic,{"sampleId":"synthetic","split":"train"},(),None,None,{"generator":0,"discriminator":1},{},None,None)
            self.assertIs(caught.exception,error)
            receipt=diagnostic["captureReceipt"];self.assertEqual(receipt["status"],"failure_evidence_captured")
            manifest,tensors=verify_gradient_failure_capture(receipt)
            self.assertFalse(manifest["executionQualified"])
            after=frozen_state(model,critic)
            self.assertTrue(same_bytes(before["torch"],after["torch"]))
            for key in ("model","critic"):
                for a,b in zip(before[key]["parameters"],after[key]["parameters"]):
                    self.assertEqual(a[0],b[0]);self.assertTrue(same_bytes(a[1],b[1]));self.assertEqual(a[2:4],b[2:4])
            self.assertFalse(torch.cuda.is_initialized())
