"""Private CPU coverage tests; no production route, training or GPU admission.

Schedule fakes, synthetic tensors with the real CPU gate, and injected storage
packets are deliberately separate evidence classes. No old Run is replayed.
"""
from contextlib import ExitStack
from copy import deepcopy
import gc
import json
import os
from pathlib import Path
import random
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import weakref

ROOT = Path(__file__).absolute().parents[3]
for folder in ("ml/ai-painter/scripts", "ml/ai-painter/src", "ml/ai-painter/tests"):
    sys.path.insert(0, str(ROOT/folder))
import test_parameter0_training_same_call_integration_cpu_v1 as integration
import test_parameter0_training_same_call_capture_cpu_v1 as tensors
import test_parameter0_training_same_call_storage_cpu_v1 as disk
from ai_painter.complete_world import parameter0_training_same_call_bridge_v1 as bridge
from ai_painter.complete_world import parameter0_training_same_call_storage_v1 as storage
import torch

DETAILS = dict(scheduleFixtureCalls=0, realCpuGateCalls=0, privateStoragePackets=0,
               realModelForwards=0, autogradCalls=0, optimizerCalls=0, gpuCalls=0)


def setUpModule():
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)
    if torch.cuda.is_initialized(): raise RuntimeError("CUDA forbidden")
    for owner, name, count in ((torch.nn.Module, "__call__", "realModelForwards"),
                        (torch.autograd, "grad", "autogradCalls"),
                        (torch.autograd, "backward", "autogradCalls"),
                        (torch.cuda, "_lazy_init", "gpuCalls"),
                        (torch.optim.Optimizer, "__init__", "optimizerCalls")):
        def prohibited(*args, _count=count, **kwargs):
            DETAILS[_count] += 1
            raise AssertionError("real computation forbidden: "+_count)
        guard = patch.object(owner, name, side_effect=prohibited)
        guard.start(); unittest.addModuleCleanup(guard.stop)


def setup_bridge():
    helper = integration.BridgeBindingTests()
    helper.capability = bridge.COVERAGE_CAPABILITY
    fixture = helper.fixture()
    return fixture, helper.construct(fixture)


def sample_at(fixture, g):
    indices = list(range(48)); random.Random(20260929+g//48+1).shuffle(indices)
    return fixture[1][indices[g%48]], indices[g%48]


class ObserverFixture:
    def __init__(self, *args, **kwargs):
        self.identity = deepcopy(kwargs["identity"])
        self._closed = False
        self.packet = None
        self.outcome = dict(status="not_entered")
        self.model = self.module = self.resource = self._bound_resource = object()
        self._resource_failure = None
        self._handles = self._graph = self._buffers = self._sources = [object()]
        self._adjoints = self._gradients = self._descriptors = {"retained":object()}
        self._input = self._input_ref = self._output_ref = object()
        DETAILS["scheduleFixtureCalls"] += 1

    def finish(self):
        self._closed = True
        self.outcome = dict(status="successful_g_released_without_capture")
        self.model = self.module = self.resource = self._bound_resource = None
        self._handles = self._graph = self._buffers = self._sources = ()
        self._adjoints = self._gradients = self._descriptors = {}
        self._input = self._input_ref = self._output_ref = None


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.stack.enter_context(patch.object(bridge.profile.original,"validate_sample_ecology"))
        self.stack.enter_context(patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",ObserverFixture))

    def tearDown(self):
        self.stack.close()
        self.assertFalse(torch.cuda.is_initialized())

    def test_all1152_calls_derive_identity_and_release_one_context(self):
        f, runner = setup_bridge(); previous = None
        state = random.getstate()
        for g in range(1152):
            sample, index = sample_at(f,g)
            watcher = runner.same_call_context(f[2],sample,dict(generator=g,discriminator=g+1),lambda:None)
            self.assertEqual(watcher.identity,dict(runId=f[0].plan["runId"],packageId=f[0].plan["packageId"],
                sampleId=sample["sampleId"],epoch=g//48+1,zeroBasedEpochPosition=g%48,trainIndex=index,
                optimizerSteps=dict(generator=g,discriminator=g+1),modelBinding=f[0].plan["modelBinding"]))
            if previous is not None: self.assertIsNone(previous())
            previous = weakref.ref(watcher)
            watcher.finish(); del watcher
        self.assertEqual(runner.observed_calls,1152)
        self.assertEqual(random.getstate(),state)
        with self.assertRaises(ValueError): runner.same_call_context(f[2],sample,dict(generator=1152,discriminator=1153),lambda:None)
        self.assertTrue(runner._coverage_poisoned)

    def test_repeat_gap_bad_counts_and_wrong_model_poison_before_new_observer(self):
        cases=[dict(generator=1,discriminator=2),dict(generator=-1,discriminator=0),
               dict(generator=False,discriminator=1),dict(generator=0,discriminator=0),
               dict(generator=0,discriminator=1,extra=True)]
        for counts in cases:
            with self.subTest(counts=counts):
                f,r=setup_bridge(); sample,_=sample_at(f,0)
                with self.assertRaises(ValueError):r.same_call_context(f[2],sample,counts,lambda:None)
                self.assertTrue(r._coverage_poisoned)
                with self.assertRaisesRegex(ValueError,"closed"):
                    r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
        f,r=setup_bridge();sample,_=sample_at(f,0)
        with self.assertRaisesRegex(ValueError,"generator object"):
            r.same_call_context(object(),sample,dict(generator=0,discriminator=1),lambda:None)
        self.assertTrue(r._coverage_poisoned)

    def test_duplicate_successful_call_cannot_reinstall(self):
        f,r=setup_bridge();sample,_=sample_at(f,0)
        r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None).finish()
        with self.assertRaisesRegex(ValueError,"gap or repeated"):
            r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)

    def test_wrong_sample_and_foreign_reader_rejected(self):
        for foreign in (False,True):
            f,r=setup_bridge();sample,index=sample_at(f,0)
            if foreign: sample["_ecology_regime_binding"].reader=object()
            else: sample=f[1][(index+1)%48]
            with self.assertRaises(ValueError):r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
            self.assertTrue(r._coverage_poisoned)

    def test_unreleased_previous_context_and_each_retained_resource_reject(self):
        for attribute,value in [("_closed",False),("packet",object()),("model",object()),
                ("_handles",[object()]),("_gradients",{"x":object()}),("_input",object()),
                ("_output_ref",object()),("_bound_resource",object()),
                ("outcome",dict(status="same_call_capture_unavailable"))]:
            with self.subTest(attribute=attribute):
                f,r=setup_bridge();sample,_=sample_at(f,0)
                previous=r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
                previous.finish();setattr(previous,attribute,value)
                sample,_=sample_at(f,1)
                with self.assertRaisesRegex(ValueError,"completely released"):
                    r.same_call_context(f[2],sample,dict(generator=1,discriminator=2),lambda:None)
                self.assertEqual(r.observed_calls,1)

    def test_constructor_or_resource_exception_consumes_and_cannot_retry(self):
        class Stop(BaseException): pass
        for error in (ValueError("constructor"),Stop("resource stop")):
            f,r=setup_bridge();sample,_=sample_at(f,0)
            with patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",side_effect=error) as factory:
                with self.assertRaises(type(error)) as got:r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
                self.assertIs(got.exception,error)
                with self.assertRaisesRegex(ValueError,"closed"):r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
                self.assertEqual(factory.call_count,1)
            self.assertEqual(r.observed_calls,1)

    def test_pair_failure_preserves_original_and_blocks_next_pair_before_D(self):
        f,r=setup_bridge();error=ValueError("original G failure")
        args=(f[2],None,None,None,None,None,dict(generator=0,discriminator=0))
        with patch.object(bridge.profile,"perform_pair",side_effect=error) as pair:
            with self.assertRaises(ValueError) as got:r.pair_runner(*args)
            self.assertIs(got.exception,error)
            with self.assertRaisesRegex(ValueError,"closed"):r.pair_runner(*args)
            self.assertEqual(pair.call_count,1)

    def test_unreleased_observation_rejects_before_any_next_D_update(self):
        f,r=setup_bridge();sample,_=sample_at(f,0)
        r.same_call_context(f[2],sample,dict(generator=0,discriminator=1),lambda:None)
        args=(f[2],None,None,None,None,None,dict(generator=1,discriminator=1))
        with patch.object(bridge.profile,"perform_pair") as pair:
            with self.assertRaisesRegex(ValueError,"completely released"):r.pair_runner(*args)
            pair.assert_not_called()

    def test_reentrant_pair_rejected_before_original_pair_and_lock_released(self):
        f,r=setup_bridge();args=(f[2],None,None,None,None,None,dict(generator=0,discriminator=0))
        def nested(*a,**k):
            with self.assertRaisesRegex(ValueError,"concurrent coverage pair"):r.pair_runner(*args)
            return "synthetic-no-update"
        with patch.object(bridge.profile,"perform_pair",side_effect=nested) as pair:
            self.assertEqual(r.pair_runner(*args),"synthetic-no-update")
            self.assertEqual(pair.call_count,1)
        self.assertTrue(r._coverage_pair_lock.acquire(blocking=False));r._coverage_pair_lock.release()

    def test_adopted_production_route_has_own_identity_and_rejects_unknown(self):
        route=bridge.auth.execution_route(bridge.COVERAGE_CAPABILITY)
        self.assertEqual(route.capability,bridge.COVERAGE_CAPABILITY)
        with self.assertRaises(ValueError):bridge.auth.execution_route(bridge.COVERAGE_CAPABILITY+"_unknown")
        registry=json.loads((ROOT/"data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json").read_text())
        self.assertEqual([row["candidateSelection"] for row in registry["trainingInterfaces"]].count("d2o-p0t6-v1"),1)


class ActualCpuGateTests(unittest.TestCase):
    def test_real_observer_resource_stop_releases_and_blocks_next_pair(self):
        class ResourceStop(BaseException): pass
        stop=ResourceStop("synthetic resource boundary")
        f,r=setup_bridge();model=tensors.SyntheticGraph();r.model=model
        r.graph=[dict(name=n,shape=list(p.shape),dtype=str(p.dtype),elements=p.numel()) for n,p in model.rows]
        sample,_=sample_at(f,0)
        def resource():raise stop
        with patch.object(bridge.profile.original,"validate_sample_ecology"), \
             patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",side_effect=tensors.SmallCapture):
            watcher=r.same_call_context(model,sample,dict(generator=0,discriminator=1),resource)
        with patch.object(tensors,"observer",return_value=watcher):
            _,error,_,_=tensors.run_call("pass",model=model)
        self.assertIs(error,stop);self.assertTrue(watcher._closed)
        self.assertIsNone(watcher.model);self.assertFalse(watcher._handles);self.assertFalse(watcher._sources)
        self.assertFalse(model.layer._forward_hooks)
        with patch.object(bridge.profile,"perform_pair") as pair,self.assertRaises(ValueError):
            r.pair_runner(model,None,None,None,None,None,dict(generator=1,discriminator=1))
        pair.assert_not_called();self.assertTrue(r._coverage_poisoned)

    def test_25_sequential_synthetic_calls_real_gate_then_sealed_later_failure(self):
        f,r=setup_bridge();model=tensors.SyntheticGraph();r.model=model
        r.graph=[dict(name=n,shape=list(p.shape),dtype=str(p.dtype),elements=p.numel()) for n,p in model.rows]
        original_constructor=tensors.SmallCapture
        previous=None
        for g in range(25):
            sample,index=sample_at(f,g)
            with patch.object(bridge.profile.original,"validate_sample_ecology"), \
                 patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",side_effect=lambda *a,**k:original_constructor(*a,**k)):
                watcher=r.same_call_context(model,sample,dict(generator=g,discriminator=g+1),lambda:None)
            # Feed existing synthetic hook fixture through the real component and CPU gate.
            with patch.object(tensors,"observer",return_value=watcher):
                w,error,_,output_ref=tensors.run_call("target" if g==24 else "pass",model=model)
            DETAILS["realCpuGateCalls"]+=1
            self.assertTrue(w._closed);self.assertIsNone(w.model);self.assertFalse(w._handles)
            self.assertFalse(w._sources);self.assertFalse(w._adjoints);self.assertFalse(w._gradients)
            self.assertFalse(model.layer._forward_hooks)
            if g<24:
                self.assertIsNone(error);self.assertIsNone(w.packet)
                self.assertEqual(w.outcome,{"status":"successful_g_released_without_capture"})
            else:
                self.assertEqual(str(error),"actual four-term total gradient identity differs at parameter 0")
                self.assertEqual(w.outcome["status"],"sealed_same_call_target_failure")
                encoded=bridge.capture.encode_capture(w.packet,original_failure_parts=(),execution_parts=())
                identity=encoded["metadata"]["identity"]
                self.assertEqual(identity["optimizerSteps"],dict(generator=24,discriminator=25))
                self.assertEqual(identity["zeroBasedEpochPosition"],24);self.assertEqual(identity["trainIndex"],11)
                self.assertFalse(encoded["metadata"]["referenceAllowed"])
                self.assertLessEqual(len(encoded["bytes"]),storage.SIDECAR_MAXIMUM)
            gc.collect()  # unittest.mock can retain its return value in a cycle.
            if previous is not None:self.assertIsNone(previous())
            previous=weakref.ref(watcher)
            del w,watcher,error
        sample,_=sample_at(f,25)
        with patch.object(bridge.profile.original,"validate_sample_ecology"),self.assertRaisesRegex(ValueError,"completely released"):
            r.same_call_context(model,sample,dict(generator=25,discriminator=26),lambda:None)
        self.assertFalse(torch.cuda.is_initialized());self.assertFalse(bridge.capture._ACTIVE)


class StorageCoverageTests(unittest.TestCase):
    def setUp(self):
        base=(ROOT/".runtime/ai-painter/controller-repair-reviews/storage-ordinal-repair-032-20261025/synthetic-fixtures").resolve()
        base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix="coverage-",dir=base)
        self.f=disk.Fixture(Path(self.temp.name),storage.COVERAGE_CAPABILITY)

    def tearDown(self):
        self.f.env.stop(); self.temp.cleanup()
        self.assertFalse(torch.cuda.is_initialized())

    def at(self,g):
        f=self.f;epoch,ordinal=g//48+1,g%48
        indices=list(range(48));random.Random(20260929+epoch).shuffle(indices);index=indices[ordinal]
        ids=json.loads(f.mapping.binding(f.split))["sampleIds"];sample=ids[index]
        f.record["sampleId"]=sample
        # The source index uses one-based global positions; the single-sample
        # loader identity uses local ordinal0. Keep both in the storage fixture.
        f.record["ordinal"]=index+1
        records=[dict(f.record,sampleId=sample_id,ordinal=i+1) for i,sample_id in enumerate(ids)]
        f.index=f.put("source-index.json",dict(samples=records))
        f.dataset=f.put("dataset.json",dict(sourceIndex=f.index));f.plan["datasetManifest"]=f.dataset
        f.plan_binding=f.put(f.output_root+"/quality-plan.json",f.plan)
        f.package["inputEvidence"]=[f.plan_binding];f.package_binding=f.put("package.json",f.package)
        f.ticket["executionPackage"]=f.package_binding;f.ticket_binding=f.put(f.output_root+"/capture-execution.json",f.ticket)
        f.context.update(sampleId=sample,sampleIdentity=dict(deepcopy(f.record),ordinal=0),executionPackage=f.package_binding,
            failurePosition=dict(epoch=epoch,zeroBasedEpochPosition=ordinal,trainIndex=index,sampleId=sample),
            optimizerSteps=dict(generator=g,discriminator=g+1))

    def packet(self,mutation=None):
        f=self.f
        def change(metadata):
            metadata["identity"].update(**f.context["failurePosition"],optimizerSteps=deepcopy(f.context["optimizerSteps"]))
            if mutation:mutation(metadata)
        DETAILS["privateStoragePackets"]+=1
        return f.packet(change)

    def test_first_boundary_and_final_schedule_identities(self):
        for g in (0,14,24,47,48,49,1104,1151):
            self.at(g);f=self.f
            plan,_=storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output)
            self.assertEqual(plan,f.plan)

    def test_bad_count_epoch_position_index_sample_and_boolean_rejected(self):
        mutations=[lambda c:c["optimizerSteps"].update(generator=True),
            lambda c:c["optimizerSteps"].update(discriminator=24),
            lambda c:c["optimizerSteps"].update(generator=1152,discriminator=1153),
            lambda c:c["failurePosition"].update(epoch=2),
            lambda c:c["failurePosition"].update(zeroBasedEpochPosition=14),
            lambda c:c["failurePosition"].update(trainIndex=-1),
            lambda c:c["failurePosition"].update(epoch=True),
            lambda c:c.update(sampleId="foreign-sample")]
        for mutation in mutations:
            self.at(24);context=deepcopy(self.f.context);mutation(context)
            with self.assertRaises(ValueError):storage._identity(self.f.mapping,self.f.ticket_binding,self.f.plan_binding,context,self.f.output)

    def test_later_failure_storage_actual_writer_readback_and_aggregate(self):
        self.at(24);f=self.f;result=f.save(self.packet())
        self.assertEqual(result["status"],"captured",result)
        self.assertEqual(result["sameCallCapture"]["status"],"captured",result)
        body=dict(runId=f.plan["runId"],optimizerSteps=f.context["optimizerSteps"],failurePosition=f.context["failurePosition"],originalError=disk.capture.primary_error(f.error))
        storage.verify_same_call_failure(result,f.mapping,plan=f.plan,body=body)
        self.assertLessEqual(result["storageAccounting"]["targetBytesIncludingTerminalReserve"],2097152)
        self.assertFalse(result["rootCauseProven"])

    def test_final_call_storage(self):
        self.at(1151);f=self.f;result=f.save(self.packet())
        self.assertEqual(result["sameCallCapture"]["status"],"captured",result)
        storage.verify_same_call_failure(result,f.mapping,plan=f.plan,body=dict(runId=f.plan["runId"],
            optimizerSteps=f.context["optimizerSteps"],failurePosition=f.context["failurePosition"],originalError=disk.capture.primary_error(f.error)))

    def test_cross_call_packet_preserves_original_error_but_rejects_sidecar(self):
        self.at(24);f=self.f
        packet=self.packet(lambda m:m["identity"].update(optimizerSteps=dict(generator=14,discriminator=15),zeroBasedEpochPosition=14,trainIndex=8))
        result=f.save(packet)
        self.assertEqual(result["originalCapture"]["status"],"captured",result)
        self.assertNotEqual(result["sameCallCapture"]["status"],"captured",result)
        self.assertEqual(result["primaryError"],disk.capture.primary_error(f.error))


if __name__ == "__main__":
    suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    forbidden=sum(DETAILS[k] for k in ("realModelForwards","autogradCalls","optimizerCalls","gpuCalls"))
    print(json.dumps(dict(testsRun=result.testsRun,passed=result.wasSuccessful(),details=DETAILS,
        syntheticGateCounters=tensors.COUNTS,storageCounters=disk.SYNTHETIC_DETAILS,cudaInitialized=torch.cuda.is_initialized())))
    sys.exit(0 if result.wasSuccessful() and forbidden == 0 and not torch.cuda.is_initialized() else 1)
