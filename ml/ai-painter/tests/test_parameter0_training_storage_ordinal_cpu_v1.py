"""CPU metadata regression for031 ordinal failure; no old tensor/Run replay."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).absolute().parents[3]
sys.path[:0]=[str(ROOT/'ml/ai-painter/src'),str(ROOT/'ml/ai-painter/tests')]
import torch
from ai_painter.complete_world import parameter0_training_same_call_storage_v1 as storage
import test_parameter0_training_failure_call_coverage_cpu_v1 as coverage

RUN='.runtime/ai-painter/registered-training-d2o-p0t6-v1-executions/d2o-p0t6-v1-cc1c34df-bc8e-496a-aa4b-4e4eefb968e4'
READS=[]
def read(binding):
    raw=(ROOT/binding['path']).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=binding['sha256']:raise AssertionError('metadata binding differs')
    READS.append(binding)
    return json.loads(raw)

def setUpModule():
    import psutil
    process=psutil.Process();process.cpu_affinity(process.cpu_affinity()[:2])
    torch.set_num_threads(2)
    if torch.get_num_interop_threads()!=2:torch.set_num_interop_threads(2)
    for obj,name in ((torch.nn.Module,'__call__'),(torch.autograd,'grad'),(torch.cuda,'_lazy_init'),
                     (torch.optim.Optimizer,'__init__'),(torch,'load')):
        guard=patch.object(obj,name,side_effect=AssertionError('metadata test computation/deserialization forbidden'))
        guard.start();unittest.addModuleCleanup(guard.stop)

class ActualMetadataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate the terminal through the saved independent audit binding.
        audit=read(dict(path='.runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/actual-terminal-review.json',
            sha256='6efdc938298b900a58fe7c34e2b4edf97680a8a87b00089a2b3810347dd808b7'))
        terminal_binding=next(b for b in audit['evidenceBindings'] if b['path']==RUN+'/worker-terminal.json')
        terminal=read(terminal_binding)
        manifest=read(terminal['captureReceipt']['originalCapture']['artifacts']['manifest'])
        package=read(terminal['executionPackage'])
        plan=read(next(b for b in package['inputEvidence'] if b['path']==RUN+'/quality-plan.json'))
        dataset=read(plan['datasetManifest']);index=read(dataset['sourceIndex'])
        cls.context=manifest['context'];cls.records=index['samples'];cls.sample_id=cls.context['sampleId']
        cls.source=next(row for row in cls.records if row['sampleId']==cls.sample_id)
        cls.terminal=terminal

    def validate(self,identity=None,records=None):
        storage._coverage_sample_identity(self.context['sampleIdentity'] if identity is None else identity,
            self.records if records is None else records,self.sample_id)

    def test_actual031_zero_vs_twelve_preserves_all_common_bindings(self):
        self.assertEqual(self.context['sampleIdentity']['ordinal'],0)
        self.assertEqual(self.source['ordinal'],12)
        self.assertEqual(self.context['failurePosition']['trainIndex'],11)
        self.assertEqual(self.context['failurePosition']['zeroBasedEpochPosition'],24)
        self.assertEqual(self.terminal['captureReceipt']['secondaryStorageFailures'][0]['message'],'actual sample ordinal differs')
        self.validate()
        self.assertFalse((ROOT/RUN/'parameter0-same-call').exists())

    def test_missing_or_wrong_loader_ordinals_fail(self):
        for value in (None,False,True,-1,1,12,0.0,'0'):
            identity=deepcopy(self.context['sampleIdentity']);identity['ordinal']=value
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'loader-local ordinal'):self.validate(identity)
        identity=deepcopy(self.context['sampleIdentity']);del identity['ordinal']
        with self.assertRaisesRegex(ValueError,'loader-local ordinal'):self.validate(identity)

    def test_missing_or_wrong_source_ordinals_fail(self):
        for value in (None,False,True,0,11,13,12.0,'12'):
            rows=deepcopy(self.records);next(r for r in rows if r['sampleId']==self.sample_id)['ordinal']=value
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'source-index ordinal'):self.validate(records=rows)
        rows=deepcopy(self.records);del next(r for r in rows if r['sampleId']==self.sample_id)['ordinal']
        with self.assertRaisesRegex(ValueError,'source-index ordinal'):self.validate(records=rows)

    def test_source_order_cannot_be_changed_without_matching_global_position(self):
        rows=deepcopy(self.records);rows[10],rows[11]=rows[11],rows[10]
        with self.assertRaisesRegex(ValueError,'source-index ordinal'):self.validate(records=rows)

    def test_same_ordinal_never_authorizes_wrong_sample_or_bindings(self):
        for field,value in [('sampleId','other'),('split','validation'),('image',self.source['conditionPack']),('conditionPack',self.source['image'])]:
            identity=deepcopy(self.context['sampleIdentity']);identity[field]=value
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,'sample identity'):self.validate(identity)

    def test_source_uniqueness_and_bounded_shape(self):
        for rows in ([],[None],self.records+[deepcopy(self.source)],[deepcopy(self.source)]*257):
            with self.assertRaises(ValueError):self.validate(records=rows)

    def test_missing_or_nonobject_identity_fails(self):
        for value in (None,[],False):
            with self.assertRaises(ValueError):storage._coverage_sample_identity(value,self.records,self.sample_id)

class IntegratedCoverageIdentityTests(coverage.StorageCoverageTests):
    # Reuse only the metadata fixture, not inherited tensor writer tests.
    def test_bad_count_epoch_position_index_sample_and_boolean_rejected(self):
        super().test_bad_count_epoch_position_index_sample_and_boolean_rejected()

    def test_full_identity_rejects_missing_and_wrong_loader_ordinal(self):
        self.at(24);f=self.f
        for value in (None,1,12,False):
            context=deepcopy(f.context);context['sampleIdentity']['ordinal']=value
            with self.assertRaisesRegex(ValueError,'loader-local ordinal'):
                storage._identity(f.mapping,f.ticket_binding,f.plan_binding,context,f.output)
        context=deepcopy(f.context);del context['sampleIdentity']
        with self.assertRaisesRegex(ValueError,'sample identity'):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,context,f.output)

if __name__=='__main__':
    suite=unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(ActualMetadataTests))
    for name in ('test_bad_count_epoch_position_index_sample_and_boolean_rejected',
                 'test_full_identity_rejects_missing_and_wrong_loader_ordinal',
                 'test_first_boundary_and_final_schedule_identities'):
        suite.addTest(IntegratedCoverageIdentityTests(name))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps(dict(testsRun=result.testsRun,passed=result.wasSuccessful(),actual031MetadataOnly=True,
        historicalTensorLoads=0,realModelForwards=0,autogradCalls=0,optimizerUpdates=0,cudaInitialized=torch.cuda.is_initialized(),metadataBindings=READS)))
    raise SystemExit(0 if result.wasSuccessful() and not torch.cuda.is_initialized() else 1)
