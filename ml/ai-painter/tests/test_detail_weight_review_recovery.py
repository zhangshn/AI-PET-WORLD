"""Directory-consumption and immutable recovery boundaries; no model forward."""
import json
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import detail_weight_review_recovery as recovery
import review_stage4_detail_weight_capture_execution_cpu as reviewer
import painter_stage4_detail_weight_capture_execution_worker as worker


class ReviewOutputTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / "output"

    def test_missing_and_precreated_empty_accounting_roots_are_claimable(self):
        for precreate in (False, True):
            folder = self.directory.with_name("precreated" if precreate else "missing")
            if precreate: folder.mkdir()
            recovery.claim_output(folder, {"runId": "synthetic", "optimizerSteps": 0})
            self.assertEqual(json.loads((folder / "review-consumed.json").read_text())["optimizerSteps"], 0)

    def test_second_claim_is_rejected_without_changing_original_bytes(self):
        recovery.claim_output(self.directory, {"runId": "first"})
        before = (self.directory / "review-consumed.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "no replay"):
            recovery.claim_output(self.directory, {"runId": "second"})
        self.assertEqual((self.directory / "review-consumed.json").read_bytes(), before)

    def test_existing_partial_image_is_not_treated_as_empty(self):
        self.directory.mkdir(); (self.directory / "0.png").write_bytes(b"synthetic")
        with self.assertRaisesRegex(ValueError, "no replay"):
            recovery.claim_output(self.directory, {})
        self.assertFalse((self.directory / "review-consumed.json").exists())

    def test_file_and_junction_are_rejected(self):
        self.directory.write_bytes(b"file")
        with self.assertRaisesRegex(ValueError, "regular directory"):
            recovery.claim_output(self.directory, {})
        folder = Path(self.temp.name) / "mock-junction"; folder.mkdir()
        info = folder.lstat()
        with patch.object(Path, "lstat", return_value=type("Info", (), {"st_mode": info.st_mode, "st_file_attributes": 0x400})()):
            with self.assertRaisesRegex(ValueError, "regular directory"):
                recovery.claim_output(folder, {})

    def test_atomic_exclusive_marker_refuses_racing_claim(self):
        self.directory.mkdir()
        with patch.object(Path, "open", side_effect=FileExistsError("concurrent marker")):
            with self.assertRaises(FileExistsError): recovery.claim_output(self.directory, {})

    def test_cuda_rejected_before_output_claim(self):
        class Torch:
            cuda = type("Cuda", (), {"is_initialized": staticmethod(lambda: True)})()
        with patch.object(worker, "runtime", return_value=(Torch, None, None, None)):
            with self.assertRaisesRegex(ValueError, "CPU-only"):
                recovery.recovery_readers({}, {}, root=Path(self.temp.name))


class SourceRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)

    def fixture(self):
        root = Path(self.temp.name)
        def put(name, value):
            target = root / name; target.parent.mkdir(parents=True, exist_ok=True)
            payload = value if type(value) is bytes else json.dumps(value).encode()
            target.write_bytes(payload)
            return {"path":name,"sha256":hashlib.sha256(payload).hexdigest()}
        class Reader:
            def __init__(self, folder): self.root=folder; self.observed={}
            def path(self, logical):
                if any(p in ('', '.', '..') for p in logical.split('/')) or ':' in logical or '\\' in logical: raise ValueError('unsafe path')
                return self.root/logical
            def read(self, binding):
                payload=self.path(binding['path']).read_bytes()
                if hashlib.sha256(payload).hexdigest()!=binding['sha256']: raise ValueError('source SHA differs')
                self.observed[binding['path']]=binding['sha256'];return payload
            def json(self, binding): return json.loads(self.read(binding))
            def unchanged(self):
                for name, digest in list(self.observed.items()): self.read({'path':name,'sha256':digest})
        fake_torch=type('Torch',(),{'cuda':type('Cuda',(),{'is_initialized':staticmethod(lambda:False)})()})
        original={"runId":"synthetic-source","packageId":"synthetic-package","capabilityVersion":worker.CAPABILITY,"outputRoot":".runtime/ai-painter/detail-weight-capture-managed-executions/synthetic-source","programBindings":{}}
        programs={};snapshots=[]
        for role in ('worker','cpuReview','adapter'):
            old=put('scripts/'+role+'.py',('old-'+role).encode())
            saved=put('.runtime/ai-painter/review-directory-recovery-t-q4-66/snapshots/'+old['sha256']+'/'+role+'.py',('old-'+role).encode())
            original['programBindings'][role]=old
            programs[role]=put(old['path'],('current-'+role).encode())
            snapshots.append({'role':role,'originalBinding':old,'snapshotBinding':saved})
        fixed=put('ml/ai-painter/src/immutable_model.py',b'unchanged numerical bytes')
        original['programBindings']['numerical']=fixed;programs['numerical']=fixed
        for role in ('reviewRecovery','reviewRecoveryTests','reviewRecoveryRunner','reviewRecoveryRunnerTests'):
            programs[role]=put('scripts/'+role+'.py',role.encode())
        original_binding=put(original['outputRoot']+'/detail-weight-capture-plan.json',original)
        package=put('.runtime/ai-painter/autonomous-closed-loop-packages/synthetic-package/package.json',{'inputEvidence':[original_binding]})
        cp=put(original['outputRoot']+'/checkpoint-36.pt',b'explicit synthetic weight bytes not loaded')
        terminal=put(original['outputRoot']+'/worker-terminal.json',{**{k:original[k] for k in ('runId','packageId')},'executionPackage':package,'executionState':'completed','completedEpochs':48,'optimizerSteps':{'generator':2304,'discriminator':2304},'checkpointReloadVerified':True,'checkpointPromotable':False,'checkpoints':[{'checkpoint':cp}]})
        failure=put('.runtime/source-review-failure.json',{'schemaVersion':'ai-painter-autonomous-phase-evidence-v1','phase':'review','result':{'failureCode':'adapter_exception'}})
        tests=put('.runtime/tests.json',{'passed':6,'failed':0,'errors':0,'skipped':0,'gpuInitialized':False,'modelForwards':0,'optimizerSteps':0})
        receipt=put('.runtime/receipt.json',{'cleanupConfirmed':True,'proof':{'exitCode':0,'activeProcessesAfterCleanup':0}})
        cpu=put('.runtime/cpu.json',{'schema':'detail-weight-review-repair-cpu-acceptance-v1','status':'passed','programBindings':programs,'testResult':tests,'ownedReceipt':receipt})
        specification=put('docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md','11.12 训练完成后的只读审核恢复'.encode())
        plan={**{k:original[k] for k in ('runId','packageId','capabilityVersion')},'schema':'detail-weight-review-recovery-plan-v1','sourceExecutionPackage':package,'sourceTrainingPlan':original_binding,'sourceWorkerTerminal':terminal,'sourceReviewFailure':failure,'outputRoot':original['outputRoot']+'/review-recovery-v1/dry-review','historicalProgramSnapshots':snapshots,'programBindings':programs,'cpuAcceptance':cpu,'reviewSpecification':specification,'budget':{'maxWallSeconds':120,'maxOutputMiB':16,'cpuThreads':2,'maxModelForwardCalls':16},'automaticRetries':0,'optimizerSteps':0,'gpuAllowed':False,'formalQualificationAllowed':False,'runtimePublicationAllowed':False}
        bound=put(original['outputRoot']+'/review-recovery-v1/plan.json',plan)
        return root,put,Reader,fake_torch,plan,bound,package,original

    def call(self, fixture, plan=None):
        root,put,Reader,torch,body,bound,package,_original=fixture
        if plan is not None: bound=put(bound['path'],plan)
        with patch.object(worker,'runtime',return_value=(torch,None,None,type('Source',(),{'Reader':Reader}))):
            return recovery.recovery_readers(package,bound,root=root)

    def test_historical_reader_uses_old_snapshots_and_live_reader_uses_current_sources(self):
        f=self.fixture(); historical,live,_=self.call(f)
        self.assertEqual(historical.read(f[7]['programBindings']['worker']),b'old-worker')
        self.assertEqual(live.read(f[4]['programBindings']['worker']),b'current-worker')

    def test_changed_numerical_source_is_rejected(self):
        f=self.fixture();p=dict(f[4]);p['programBindings']=dict(p['programBindings'])
        p['programBindings']['numerical']=f[1]('ml/ai-painter/src/immutable_model.py',b'changed')
        with self.assertRaisesRegex(ValueError,'unrelated source changed'):self.call(f,p)

    def test_wrong_identity_budget_flags_and_namespace_are_rejected(self):
        for field,value in [('runId','other'),('optimizerSteps',1),('gpuAllowed',True),('automaticRetries',1),('formalQualificationAllowed',True),('outputRoot','.runtime/other'),('budget',{'maxWallSeconds':121})]:
            f=self.fixture();p=dict(f[4]);p[field]=value
            with self.assertRaises(ValueError):self.call(f,p)

    def test_tampered_missing_or_out_of_scope_snapshots_are_rejected(self):
        for kind in ('missing','scope','tampered'):
            f=self.fixture();p=json.loads(json.dumps(f[4]));row=p['historicalProgramSnapshots'][0]
            if kind=='missing':p['historicalProgramSnapshots'].pop()
            elif kind=='scope':row['snapshotBinding']=f[1]('.runtime/elsewhere/worker.py',b'old-worker')
            else:(f[0]/row['snapshotBinding']['path']).write_bytes(b'tampered')
            with self.assertRaises(ValueError):self.call(f,p)


if __name__ == "__main__": unittest.main()
