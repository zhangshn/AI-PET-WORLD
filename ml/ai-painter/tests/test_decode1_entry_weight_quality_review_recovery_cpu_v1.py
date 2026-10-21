"""CPU metadata/identity tests. No model construction, forward or optimizer."""
import ast
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).absolute().parents[3]
SCRIPTS=ROOT/'ml/ai-painter/scripts'
sys.path.insert(0,str(SCRIPTS));sys.path.insert(0,str(ROOT/'ml/ai-painter/src'))
import decode1_entry_weight_quality_review_v1 as review
import decode1_entry_weight_quality_auth_v1 as auth

RUN='.runtime/ai-painter/registered-training-d1-src-v1-executions/d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8'
EVIDENCE=review.HISTORY_ROOT


class MetadataReader(auth.Reader):
    def read(self,binding,maximum=auth.MAX_CAPTURE):
        if binding=={'path':review.CURRENT_REVIEW_SPECIFICATION['path'],'sha256':'48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909'}:
            binding={'path':'data/ai-painter/system-governance/document-baselines/review-storage-1.25-48d9b177.txt','sha256':binding['sha256']}
        return super().read(binding,maximum)


class ComparisonIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan=json.loads((ROOT/RUN/'quality-plan.json').read_text())
        r=MetadataReader(ROOT)
        baseline=review.read_json(r,review.BASELINE_TERMINAL)
        cls.package=review.read_json(r,baseline['executionPackage'])

    def check_rejected(self,plan,package=None):
        with self.assertRaises((ValueError,KeyError,AssertionError)):
            review.baseline_comparison_identity(MetadataReader(ROOT),plan,package or self.package)

    def test_exact_original_gate_remains(self):
        plan=copy.deepcopy(self.plan)
        for a,b in [('candidateContract','sourceCandidate'),('datasetManifest','datasetManifest'),('validationSplit','validationSplit')]:plan[b]=self.package[a]
        self.assertEqual(review.baseline_comparison_identity(MetadataReader(ROOT),plan,self.package)['mode'],'exact_original_bindings')

    def test_actual_published_parent_same_eight_validation(self):
        result=review.baseline_comparison_identity(MetadataReader(ROOT),self.plan,self.package)
        self.assertEqual(result['mode'],'published_train_correction_direct_parent_same_validation_v1')
        self.assertEqual(len(result['validation']),8)
        self.assertFalse(result['qualificationGranted'])
        self.assertEqual([r['sampleId'] for r in result['validation']],json.loads((ROOT/self.plan['validationSplit']['path']).read_text())['sampleIds'])

    def test_unregistered_route_cannot_use_exception(self):
        plan=copy.deepcopy(self.plan);plan['capabilityVersion']='unregistered';self.check_rejected(plan)

    def test_forged_candidate_sha_rejected(self):
        plan=copy.deepcopy(self.plan);plan['sourceCandidate']['sha256']='0'*64;self.check_rejected(plan)

    def test_foreign_parent_candidate_rejected(self):
        parent=copy.deepcopy(self.package);parent['candidateContract']=self.plan['sourceCandidate'];self.check_rejected(self.plan,parent)

    def test_foreign_parent_dataset_rejected(self):
        parent=copy.deepcopy(self.package);parent['datasetManifest']=self.plan['datasetManifest'];self.check_rejected(self.plan,parent)

    def test_changed_validation_binding_rejected(self):
        plan=copy.deepcopy(self.plan);plan['validationSplit']['sha256']='0'*64;self.check_rejected(plan)

    def test_actual_rgb_bytes_must_be_read(self):
        class Tampered(MetadataReader):
            def read(self,binding,maximum=auth.MAX_CAPTURE):
                raw=super().read(binding,maximum)
                return raw+b'x' if binding['path'].endswith('.png') else raw
        with self.assertRaises(ValueError):review.baseline_comparison_identity(Tampered(ROOT),self.plan,self.package)

    def test_original_numerical_baseline_body_preserved(self):
        original=ROOT/EVIDENCE/'source-baselines/d8b7e409107747d2e62ea78c1b612ad9c0657cbc03be6d20a8399294ccacdc3f.txt'
        old=ast.parse(original.read_text(encoding='utf-8'));new=ast.parse(Path(review.__file__).read_text(encoding='utf-8'))
        def numerical(tree):
            fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='baseline_review')
            start=next(i for i,n in enumerate(fn.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='records' for t in n.targets))
            return [ast.dump(n,include_attributes=False) for n in fn.body[start:-1]]
        self.assertEqual(numerical(old),numerical(new))

    def test_no_new_training_or_forward_in_identity_helpers(self):
        tree=ast.parse(Path(review.__file__).read_text(encoding='utf-8'))
        names={'baseline_comparison_identity','recovery_context'}
        for fn in tree.body:
            if isinstance(fn,ast.FunctionDef) and fn.name in names:
                for n in ast.walk(fn):
                    if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute):
                        self.assertNotIn(n.func.attr,{'sample_forward','fresh_networks','backward','step'})

    def test_candidate_numerical_review_body_preserved(self):
        source=ROOT/EVIDENCE/'source-baselines/d8b7e409107747d2e62ea78c1b612ad9c0657cbc03be6d20a8399294ccacdc3f.txt'
        def numerical(text):
            fn=next(n for n in ast.parse(text).body if isinstance(n,ast.FunctionDef) and n.name=='run')
            body=next(n for n in fn.body if isinstance(n,ast.Try)).body
            start=next(i for i,n in enumerate(body) if isinstance(n,ast.Assign) and any(isinstance(x,ast.Tuple) and any(isinstance(t,ast.Name) and t.id=='loaded' for t in x.elts) for x in n.targets))
            end=next(i for i,n in enumerate(body) if i>start and isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='verify_current')
            return [ast.dump(n,include_attributes=False) for n in body[start:end]]
        self.assertEqual(numerical(source.read_text(encoding='utf-8')),numerical(Path(review.__file__).read_text(encoding='utf-8')))


class NestedHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path=json.loads(os.environ['REVIEW_CPU_HISTORY_BINDING'])['path']
        raw=(ROOT/cls.path).read_bytes()
        cls.binding={'path':cls.path,'sha256':hashlib.sha256(raw).hexdigest()}
        cls.plan=json.loads(raw)
        cls.original=json.loads((ROOT/cls.plan['sourceTrainingPlan']['path']).read_text())
        cls.preservation=json.loads((ROOT/cls.plan['sourcePreservation']['path']).read_text())
        cls.history=auth.verified_review_history(ROOT,cls.binding)

    def test_actual_inner_closure_reproduces_original_without_model(self):
        actual=auth.derive_data_closure(ROOT,self.plan['capabilityVersion'],review_history=self.history)
        expected=review.read_json(auth.Reader(ROOT),self.original['dataClosure'])
        self.assertEqual(actual,expected)

    def test_default_reader_does_not_inherit_exception(self):
        old=auth._REVIEW_NORMALS[1]
        with self.assertRaises(ValueError):auth.Reader(ROOT).read({'path':old[0],'sha256':old[1]})

    def test_wrong_version_sha_is_not_redirected(self):
        with self.assertRaises(ValueError):auth.Reader(ROOT,review_history=self.history).read({'path':auth._REVIEW_NORMALS[1][0],'sha256':'0'*64})

    def test_tampered_snapshot_hash_is_rejected(self):
        with self.assertRaises(ValueError):auth.Reader(ROOT).read({'path':auth._REVIEW_NORMALS[1][2],'sha256':'0'*64})

    def test_arbitrary_mapping_callback_rejected(self):
        with self.assertRaises(ValueError):auth.Reader(ROOT,review_history=lambda b:b)

    def test_unverified_context_object_rejected(self):
        forged=auth._ReviewHistory(str(ROOT),self.path,(('foreign','0'*64,'foreign-snapshot'),),(),())
        with self.assertRaises(ValueError):auth.Reader(ROOT,review_history=forged)

    def test_extra_historical_path_rejected(self):
        p=copy.deepcopy(self.preservation);p['entries'].append(copy.deepcopy(p['entries'][0]))
        with self.assertRaises(ValueError):auth._review_alias_shape(self.plan,self.original,p)

    def test_other_run_rejected(self):
        p=copy.deepcopy(self.plan);p['runId']='foreign'
        with self.assertRaises(ValueError):auth._review_alias_shape(p,self.original,self.preservation)

    def test_cpu_history_cannot_authenticate_execution(self):
        with self.assertRaisesRegex(ValueError,'CPU metadata history'):
            auth.load_execution_package(auth.Reader(ROOT,review_history=self.history),self.plan['sourceExecutionPackage'])

    def test_only_new_uuid_independent_path_can_authenticate(self):
        self.assertTrue(auth.independent_plan_path(review.INDEPENDENT_CASE+'/review-12345678-1234-1234-1234-123456789abc/plan.json'))
        self.assertFalse(auth.independent_plan_path(review.SUCCESSOR_CASE+'/review-v2-12345678-1234-1234-1234-123456789abc/plan.json'))
        self.assertFalse(auth.independent_plan_path(EVIDENCE+'/recovery-v1/plan.json'))
        self.assertFalse(auth.independent_plan_path(review.INDEPENDENT_CASE+'/review-../plan.json'))

    def test_real_prior_execution_ledger_debits_all_attempts(self):
        reader=auth.Reader(ROOT)
        old=json.loads((ROOT/EVIDENCE/'recovery-v1/plan.json').read_bytes())
        prior=review.read_json(reader,old['priorReviewReceipt'])
        ledger=auth.successor_budget(reader,prior)
        self.assertEqual(ledger['priorWallMs'],65572)
        self.assertEqual(ledger['timeoutMs'],54428)
        self.assertEqual(ledger['priorStreamBytes'],41654)
        self.assertEqual(ledger['outputBytes'],16735562)


class IndependentAdoptionTests(unittest.TestCase):
    def test_actual_prior_output_and_time_are_recomputed(self):
        b=auth.independent_budget(auth.Reader(ROOT))
        self.assertEqual((b['priorWallMs'],b['timeoutMs'],b['terminalReserveMs']),(119634,180366,15000))
        self.assertEqual((b['priorByteDebit'],b['priorStreamBytes']),(556372,43375))
        self.assertEqual(b['outputBytes']+b['priorByteDebit']+b['controlReserveBytes'],16777216)

    def test_independent_heartbeat_requires_fresh_same_identity_and_original_ttl(self):
        from datetime import datetime,timezone,timedelta
        scope={'runId':'test-run','packageId':'test-package','capabilityVersion':auth._REVIEW_CAPABILITY}
        value={'schemaVersion':'ai-painter-current-active-execution-heartbeat-v1',**scope,'executionState':'reviewing',
            'ttlSeconds':120,'processId':42,'processStartIdentity':'42:creation','heartbeatAtUtc':datetime.now(timezone.utc).isoformat()}
        expected={'processId':42,'processStartIdentity':'42:creation'}
        auth._heartbeat_content(json.dumps(value).encode(),scope,expected,independent=True)
        for changes in [{'ttlSeconds':300},{'processId':43},{'executionState':'executing'},
                        {'heartbeatAtUtc':(datetime.now(timezone.utc)-timedelta(seconds=6)).isoformat()}]:
            with self.assertRaises(ValueError):auth._heartbeat_content(json.dumps({**value,**changes}).encode(),scope,expected,independent=True)


if __name__=='__main__':unittest.main(verbosity=2)
