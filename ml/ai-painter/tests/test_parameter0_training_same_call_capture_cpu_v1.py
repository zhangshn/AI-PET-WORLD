"""Synthetic fixed tensors and real CPU gate; no model forward or autograd."""
from contextlib import ExitStack
import gc
import hashlib
import json
from pathlib import Path
import random
import struct
import sys
from types import SimpleNamespace
import unittest
import weakref
from unittest.mock import patch

import psutil
process = psutil.Process()
process.cpu_affinity(process.cpu_affinity()[:2])
assert 0 < len(process.cpu_affinity()) <= 2
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
from torch import nn
from ai_painter.complete_world import parameter0_training_same_call_capture_v1 as capture

torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2:
    torch.set_num_interop_threads(2)
COUNTS = dict(fixtureHookForwards=0, fixtureGradientEvents=0, realCpuGateCalls=0,
              modelForwards=0, realModelConstructions=0, autogradCalls=0, cudaCalls=0, optimizerCalls=0)
CURRENT_METADATA_SCOPE = None


def backend_fixture(overrides=None):
    """Read-only fake public properties; legacy getters and all setters are traps."""
    values={"cudnn.enabled":True,"cudnn.benchmark":False,"cudnn.deterministic":True,
        "deterministicAlgorithms":False,"cudnn.conv.fp32_precision":"ieee",
        "cudnn.rnn.fp32_precision":"tf32","cuda.matmul.fp32_precision":"none"}
    values.update(overrides or {})
    reads=[];writes=[];legacy=[]
    def read(key):
        reads.append(key)
        if key not in values:raise AttributeError("missing synthetic backend property: "+key)
        value=values[key]
        if isinstance(value,BaseException):raise value
        return value
    def forbidden(name):
        legacy.append(name);raise AssertionError("legacy backend getter touched: "+name)
    class Node:
        def __init__(self,prefix):object.__setattr__(self,"prefix",prefix)
        def __getattr__(self,name):
            key=self.prefix+"."+name if self.prefix else name
            if name=="allow_tf32":return forbidden(key)
            if key in values:return read(key)
            if any(item.startswith(key+".") for item in values):return Node(key)
            raise AttributeError("missing synthetic backend property: "+key)
        def __setattr__(self,name,value):
            writes.append((self.prefix,name,value));raise AssertionError("backend setter touched")
    fake=SimpleNamespace(backends=Node(""),are_deterministic_algorithms_enabled=lambda:read("deterministicAlgorithms"),
        get_float32_matmul_precision=lambda:forbidden("get_float32_matmul_precision"))
    return SimpleNamespace(torch=fake,values=values,reads=reads,writes=writes,legacy=legacy)


class SyntheticGraph(nn.Module):
    """Manual native-type attributes; no Conv2d initializer or invocation."""
    def __init__(self):
        super().__init__()
        self.layer = object.__new__(nn.Conv2d)
        nn.Module.__init__(self.layer)
        self.layer.weight = nn.Parameter(torch.zeros(capture.TARGET_SHAPE))
        self.layer.bias = nn.Parameter(torch.zeros(48))
        for key,value in dict(in_channels=31, out_channels=48, kernel_size=(3,3),
                stride=(1,1), padding=(1,1), dilation=(1,1), groups=1, padding_mode="zeros").items():
            setattr(self.layer, key, value)
        self.rows = [(capture.TARGET_NAME,self.layer.weight), ("fixture.bias",self.layer.bias)]
        self.rows += [("fixture."+str(i),nn.Parameter(torch.zeros(1))) for i in range(106)]

    def named_parameters(self, *args, **kwargs): return iter(self.rows)
    def parameters(self, *args, **kwargs): return (p for _,p in self.rows)
    def get_submodule(self, name):
        if name != capture.TARGET_MODULE: raise ValueError("wrong fixture module")
        return self.layer


class SmallCapture(capture.Parameter0TrainingSameCallCapture):
    def _spatial(self): return (4,5)
    def _validate_model_identity(self, model):
        if type(model) is not SyntheticGraph: raise ValueError("fixture class required")
    def _validate_graph(self, graph, actual):
        if type(graph) is not list or graph != actual or len(graph) != 108:
            raise ValueError("fixture full108 graph required")


class FullPlaneCapture(SmallCapture):
    def _spatial(self): return (192,256)


def identity():
    return dict(runId="synthetic-new-run", packageId="synthetic-package",
        sampleId="synthetic-slot154", epoch=1, zeroBasedEpochPosition=14, trainIndex=8,
        optimizerSteps=dict(generator=14,discriminator=15),
        modelBinding=dict(path="synthetic/model.json",sha256="a"*64))


def observer(model, cls=SmallCapture, **options):
    graph=[dict(name=n,shape=list(p.shape),dtype=str(p.dtype),elements=p.numel()) for n,p in model.rows]
    return cls(model,identity=identity(),graph=graph,source_bindings=capture.required_source_bindings(),**options)


def invoke_gate(model, rows):
    gate=capture.gate_module
    parameters=tuple(model.parameters())
    with patch.object(gate,"bind_parameters",return_value=(parameters,{},106,107)), \
         patch.object(gate,"_validate_model_and_parameters",return_value=(parameters,{})):
        COUNTS["realCpuGateCalls"] += 1
        return gate.apply_object_joint_rgb_structure_priority_update_cpu(model=model,parameters=parameters,
            total_gradients=rows[0],structured_gradients=rows[1],whole_frame_gradients=rows[2],
            core_gradients=rows[3],support_gradients=rows[4])


def run_call(kind="target", *, model=None, cls=SmallCapture, resource=None,
             mutate=None, observe_fault=None, max_capture_bytes=capture.MAX_CAPTURE_BYTES):
    model=model or SyntheticGraph()
    watcher=observer(model,cls,resource=resource,max_capture_bytes=max_capture_bytes)
    h,w=watcher._spatial()
    x=torch.arange(31*h*w,dtype=torch.float32).reshape(1,31,h,w)/100000
    output=torch.zeros(1,48,h,w,requires_grad=True)
    output_ref=weakref.ref(output)
    rows=[[torch.zeros_like(p,requires_grad=False) for p in model.parameters()] for _ in range(5)]
    for values,scalar in zip(rows,(10.,1.,2.,3.,4.)):
        values[0].fill_(scalar)
    if kind not in ("pass",):
        index=1 if kind=="other_parameter" else 0
        coordinate=(0,) if index else ((0,0,0,0) if kind=="other_coordinate" else capture.COORDINATES[0])
        rows[0][index][coordinate] += .1
    if kind=="overflow":
        for values in rows: values[0].fill_(1e38)
    if kind=="nonfinite": rows[0][0][capture.COORDINATES[0]]=float('nan')
    if kind=="attached_gradient": rows[0][0].requires_grad_(True)
    if kind=="noncontiguous":
        x=x.transpose(-1,-2).contiguous().transpose(-1,-2)
        rows=[[(v.transpose(-1,-2) if i==0 else v) for i,v in enumerate(values)] for values in rows]
    caught=None
    try:
        with watcher:
            if observe_fault is not None: watcher._clone=observe_fault
            watcher._forward(model.layer,(x,),output)
            COUNTS["fixtureHookForwards"] += 1
            for i,label in enumerate(capture.LABELS):
                event_label=capture.LABELS[1] if kind=="labels" and i==0 else label
                watcher("attempt",event_label,None)
                dy=torch.full((1,48,h,w),float(i+1))
                if kind=="noncontiguous": dy=dy.transpose(-1,-2).contiguous().transpose(-1,-2)
                watcher._adjoint(dy)
                if not (kind=="missing" and i==4):
                    watcher("complete",event_label,rows[i]);COUNTS["fixtureGradientEvents"]+=1
                if kind=="swapped_source" and i==0: rows[0][0]=rows[0][0].clone()
            if mutate is not None: mutate(watcher,model,rows)
            if kind=="forged": raise ValueError("actual four-term total gradient identity differs at parameter 0")
            invoke_gate(model,rows)
    except BaseException as error:
        caught=error
    if caught is not None: caught.__traceback__=None
    return watcher,caught,model,output_ref


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.stack=ExitStack();self.calls=[]
        for owner,name in ((torch.autograd,"grad"),(torch.autograd,"backward"),
                (torch.Tensor,"backward"),(nn.Module,"_call_impl"),(nn.Conv2d,"__init__"),
                (torch.cuda,"_lazy_init"),(torch.cuda,"init"),
                (torch.optim.Optimizer,"__init__"),(torch.optim.Optimizer,"step")):
            counter=("autogradCalls" if owner in (torch.autograd,torch.Tensor) else
                "cudaCalls" if owner is torch.cuda else "optimizerCalls" if owner is torch.optim.Optimizer else
                "realModelConstructions" if owner is nn.Conv2d else "modelForwards")
            def fail(*a,_name=name,_counter=counter,**k):
                COUNTS[_counter]+=1
                self.calls.append(_name);raise AssertionError("prohibited "+_name)
            self.stack.enter_context(patch.object(owner,name,side_effect=fail))
    def tearDown(self):
        self.stack.close();self.assertEqual(self.calls,[])
        self.assertFalse(torch.cuda.is_initialized());self.assertFalse(capture._ACTIVE)
        gc.collect()
    def released(self,w,m):
        self.assertIsNone(w.model);self.assertIsNone(w.module)
        self.assertFalse(w._handles);self.assertFalse(w._graph);self.assertFalse(w._sources)
        self.assertFalse(w._gradients);self.assertFalse(m.layer._forward_hooks)
        self.assertIsNone(w._bound_resource);self.assertIsNone(w._resource_failure)
    def encode(self,packet,**kwargs):
        return capture.encode_capture(packet,original_failure_parts=kwargs.get("failure",()),execution_parts=kwargs.get("execution",()))
    def test_original_gate_same_call_seals_fixed_plane_and_values(self):
        w,e,m,ref=run_call();self.assertEqual(str(e),"actual four-term total gradient identity differs at parameter 0")
        self.assertEqual(w.outcome["status"],"sealed_same_call_target_failure",w.outcome)
        encoded=self.encode(w.packet);metadata=encoded["metadata"]
        self.assertEqual(encoded["bytes"][:8],b"P0SC1\0\0\0")
        header=struct.unpack('<I',encoded['bytes'][8:12])[0]
        self.assertEqual(json.loads(encoded['bytes'][12:12+header]),metadata)
        self.assertEqual(metadata['target']['coordinate'],[1,13,0,0])
        self.assertFalse(metadata['productionGeometryVerified'])
        self.assertFalse(metadata['referenceAllowed']);self.assertEqual(metadata['localReferenceCalls'],0)
        self.assertEqual(metadata['originalFailure']['verifiedGradientSets'],5)
        self.assertEqual(metadata['fixedCoordinateClassification'],'fixed_coordinate_violating')
        self.assertEqual(len(metadata['tensors']),12)
        state=metadata['observation']
        self.assertEqual(state['modelStateBeforeSha256'],state['modelStateAfterSha256'])
        self.assertTrue(state['modelStateVerifiedUnchanged']);self.assertTrue(state['moduleModes'])
        self.assertLessEqual(state['captureAndVerificationWorkspaceBoundBytes'],64*1024**2)
        for d in metadata['tensors'].values():
            data=encoded['bytes'][12+header+d['offset']:12+header+d['offset']+d['bytes']]
            self.assertEqual(hashlib.sha256(data).hexdigest(),d['sha256'])
        self.released(w,m);gc.collect();self.assertIsNone(ref())
    def test_fixed_coordinate_not_violating_still_saves_authentic_other_target0_failure(self):
        w,e,m,_=run_call('other_coordinate');self.assertIsNotNone(e)
        info=self.encode(w.packet)['metadata']
        self.assertEqual(info['fixedCoordinateClassification'],'fixed_coordinate_not_violating')
        self.assertFalse(info['referenceAllowed']);self.released(w,m)
    def test_successive_success_calls_release_without_packet(self):
        model=SyntheticGraph()
        for _ in range(3):
            w,e,m,_=run_call('pass',model=model);self.assertIsNone(e)
            self.assertIsNone(w.packet);self.assertEqual(w.outcome['status'],'successful_g_released_without_capture')
            self.released(w,m)
    def test_other_parameter_original_error_has_no_packet(self):
        w,e,m,_=run_call('other_parameter');self.assertIn('parameter 1',str(e))
        self.assertIsNone(w.packet);self.released(w,m)
    def test_forged_same_message_rejected(self):
        w,e,m,_=run_call('forged');self.assertIsNone(w.packet)
        self.assertIn('traceback',w.outcome['reason']);self.released(w,m)
    def test_missing_group_retains_original_gate_error(self):
        w,e,m,_=run_call('missing');self.assertIn('parameter 0',str(e));self.assertIsNone(w.packet);self.released(w,m)
    def test_out_of_order_label_retains_original_gate_error(self):
        w,e,m,_=run_call('labels');self.assertIn('parameter 0',str(e));self.assertIsNone(w.packet);self.released(w,m)
    def test_equal_bytes_replacement_object_rejected(self):
        w,e,m,_=run_call('swapped_source');self.assertIsNone(w.packet);self.assertIn('identity',w.outcome['reason']);self.released(w,m)
    def test_tampered_captured_bytes_rejected(self):
        w,e,m,_=run_call(mutate=lambda o,m,r:o._gradients[capture.LABELS[0]].add_(1))
        self.assertIsNone(w.packet);self.assertIn('bytes changed',w.outcome['reason']);self.released(w,m)
    def test_source_data_mutation_with_no_version_bump_rejected(self):
        w,e,m,_=run_call(mutate=lambda o,m,r:r[0][0].data.add_(1))
        self.assertIsNone(w.packet);self.assertIn('identity',w.outcome['reason']);self.released(w,m)
    def test_non_target_model_data_mutation_rejected(self):
        w,e,m,_=run_call(mutate=lambda o,m,r:m.rows[5][1].data.add_(1))
        self.assertIsNone(w.packet);self.assertIn('state bytes',w.outcome['reason']);self.released(w,m)
    def test_weight_version_mutation_rejected(self):
        def mutate(o,m,r):
            with torch.no_grad(): m.layer.weight.add_(1)
        w,e,m,_=run_call(mutate=mutate);self.assertIsNone(w.packet);self.assertIn('version',w.outcome['reason']);self.released(w,m)
    def test_python_rng_mutation_secondary(self):
        state=random.getstate()
        try:
            w,e,m,_=run_call(mutate=lambda *a:random.random())
            self.assertIsNone(w.packet);self.assertIn('RNG',w.outcome['reason']);self.released(w,m)
        finally: random.setstate(state)
    def test_nonfinite_capture_cannot_replace_original_gate_failure(self):
        w,e,m,_=run_call('nonfinite');self.assertIsNotNone(e);self.assertIsNone(w.packet);self.released(w,m)
    def test_finite_component_sum_overflow_unavailable_not_reference(self):
        w,e,m,_=run_call('overflow');self.assertIn('parameter 0',str(e));self.assertIsNone(w.packet)
        self.assertIn('ordered gate',w.outcome['reason']);self.released(w,m)
    def test_strided_noncontiguous_input_adjoint_and_gradient_allowed(self):
        w,e,m,_=run_call('noncontiguous');self.assertEqual(w.outcome['status'],'sealed_same_call_target_failure',w.outcome)
        self.encode(w.packet);self.released(w,m)
    def test_optional_copy_error_does_not_stop_original_gate(self):
        def fail(*a,**k): raise RuntimeError('optional copy failure')
        w,e,m,_=run_call(observe_fault=fail);self.assertIn('parameter 0',str(e));self.assertIsNone(w.packet)
        self.assertIn('optional copy failure',w.outcome['reason']);self.released(w,m)
    def test_ordinary_observer_error_does_not_stop_success(self):
        def fail(*a,**k): raise RuntimeError('optional')
        w,e,m,_=run_call('pass',observe_fault=fail);self.assertIsNone(e);self.assertIsNone(w.packet);self.released(w,m)
    def test_resource_valueerror_is_propagated_not_swallowed(self):
        failure=ValueError('resource stop');calls=[0]
        def resource():
            calls[0]+=1
            if calls[0]>=2: raise failure
        w,e,m,_=run_call('pass',resource=resource);self.assertIs(e,failure)
        self.assertTrue(capture.is_resource_failure(e));self.released(w,m)
    def test_control_baseexception_is_propagated(self):
        stop=KeyboardInterrupt('stop')
        def fail(*a,**k): raise stop
        w,e,m,_=run_call('pass',observe_fault=fail);self.assertIs(e,stop);self.released(w,m)
    def test_entry_install_failure_degrades_and_releases(self):
        model=SyntheticGraph()
        with patch.object(model.layer,'register_forward_hook',side_effect=RuntimeError('install failed')):
            w,e,m,_=run_call('pass',model=model)
        self.assertIsNone(e);self.assertIsNone(w.packet);self.assertIn('install failed',w.outcome['reason']);self.released(w,m)
    def test_entry_resource_error_propagates(self):
        failure=ValueError('entry resource')
        def resource(): raise failure
        w,e,m,_=run_call('pass',resource=resource);self.assertIs(e,failure);self.released(w,m)
    def test_all_handles_removed_even_when_one_remove_fails(self):
        removals=[]
        class Bad:
            def remove(self): removals.append('bad');raise RuntimeError('remove failed')
        class Good:
            def remove(self): removals.append('good')
        w,e,m,_=run_call(mutate=lambda o,m,r:o._handles.extend([Good(),Bad()]))
        self.assertIn('parameter 0',str(e));self.assertEqual(removals,['bad','good'])
        self.assertIsNone(w.packet);self.released(w,m)
    def test_backend_metadata_records_without_setting(self):
        before=capture._backend();w,e,m,_=run_call();v=self.encode(w.packet)['metadata']['observation']
        self.assertEqual(v['backendAtForward'],before);self.assertEqual(len(v['backendAtGradientCompletions']),5)
        self.assertEqual(capture._backend(),before);self.released(w,m)
    def test_operator_backend_exact_schema_and_differing_values_without_legacy_or_setters(self):
        fields={"schemaVersion","cudnnEnabled","cudnnBenchmark","cudnnDeterministic","deterministicAlgorithms",
            "cudnnConvFp32Precision","cudnnRnnFp32Precision","cudaMatmulFp32Precision"}
        for value in ("none","ieee","tf32","bf16"):
            f=backend_fixture({"cuda.matmul.fp32_precision":value})
            with patch.object(capture,"torch",f.torch):actual=capture._backend()
            self.assertEqual(set(actual),fields)
            self.assertEqual(actual["schemaVersion"],"operator-specific-backend-observation-v1")
            self.assertEqual(actual["cudnnConvFp32Precision"],"ieee")
            self.assertEqual(actual["cudnnRnnFp32Precision"],"tf32")
            self.assertEqual(actual["cudaMatmulFp32Precision"],value)
            self.assertEqual(len(f.reads),7);self.assertEqual(f.writes,[]);self.assertEqual(f.legacy,[])
            self.assertLessEqual(len(json.dumps(actual).encode()),512)
    def test_operator_backend_rejects_invalid_precision_without_default(self):
        for key in ("cudnn.conv.fp32_precision","cudnn.rnn.fp32_precision","cuda.matmul.fp32_precision"):
            for value in (None,True,1,"unknown","IEEE",["ieee"]):
                with self.subTest(key=key,value=value):
                    f=backend_fixture({key:value})
                    with patch.object(capture,"torch",f.torch),self.assertRaisesRegex(ValueError,"backend observation precision invalid"):
                        capture._backend()
                    self.assertEqual(f.legacy,[]);self.assertEqual(f.writes,[])
    def test_operator_backend_rejects_non_boolean_flags(self):
        for key in ("cudnn.enabled","cudnn.benchmark","cudnn.deterministic","deterministicAlgorithms"):
            for value in (None,0,1,"false"):
                with self.subTest(key=key,value=value):
                    f=backend_fixture({key:value})
                    with patch.object(capture,"torch",f.torch),self.assertRaisesRegex(ValueError,"backend observation boolean invalid"):
                        capture._backend()
                    self.assertEqual(f.legacy,[]);self.assertEqual(f.writes,[])
    def test_operator_backend_missing_property_fails_without_legacy_fallback(self):
        for key in ("cudnn.conv.fp32_precision","cudnn.rnn.fp32_precision","cuda.matmul.fp32_precision"):
            f=backend_fixture();del f.values[key]
            with patch.object(capture,"torch",f.torch),self.assertRaisesRegex(AttributeError,"missing synthetic backend property"):
                capture._backend()
            self.assertEqual(f.legacy,[]);self.assertEqual(f.writes,[])
    def test_operator_backend_getter_error_preserves_primary_and_cleanup(self):
        original=capture._backend
        for key in ("cudnn.conv.fp32_precision","cudnn.rnn.fp32_precision","cuda.matmul.fp32_precision"):
            f=backend_fixture({key:RuntimeError("operator getter unavailable: "+key)})
            def read():
                with patch.object(capture,"torch",f.torch):return original()
            with patch.object(capture,"_backend",side_effect=read):w,e,m,_=run_call()
            self.assertEqual(str(e),"actual four-term total gradient identity differs at parameter 0")
            self.assertIsNone(w.packet);self.assertIn("operator getter unavailable",w.outcome["reason"])
            self.assertEqual(w.outcome["originalError"]["message"],str(e))
            self.assertEqual(f.legacy,[]);self.assertEqual(f.writes,[]);self.released(w,m)
    def test_operator_backend_six_snapshots_are_independent_and_bounded(self):
        original=capture._backend;observed=[];f=backend_fixture()
        def read():
            f.values["cudnn.conv.fp32_precision"]="ieee" if len(observed)%2==0 else "tf32"
            with patch.object(capture,"torch",f.torch):value=original()
            observed.append(value);return value
        with patch.object(capture,"_backend",side_effect=read):w,e,m,_=run_call()
        self.assertEqual(len(observed),6)
        encoded=self.encode(w.packet);saved=encoded["metadata"]["observation"]
        self.assertEqual(saved["backendAtForward"],observed[0])
        self.assertEqual([row["label"] for row in saved["backendAtGradientCompletions"]],list(capture.LABELS))
        self.assertEqual([row["settings"] for row in saved["backendAtGradientCompletions"]],observed[1:])
        self.assertEqual(observed[0]["cudnnConvFp32Precision"],"ieee")
        self.assertEqual(observed[1]["cudnnConvFp32Precision"],"tf32")
        self.assertLessEqual(struct.unpack('<I',encoded["bytes"][8:12])[0],capture.METADATA_RESERVE)
        self.assertEqual(f.legacy,[]);self.assertEqual(f.writes,[]);self.released(w,m)
    def test_current_operator_metadata_existing_scope_restores_without_cuda(self):
        global CURRENT_METADATA_SCOPE
        from ai_painter.complete_world.object_head_core_priority_update_v24 import generator_full_fp32_backend
        self.assertIsNone(CURRENT_METADATA_SCOPE)
        self.assertFalse(torch.cuda.is_initialized());before=capture._backend()
        with generator_full_fp32_backend():
            inside=capture._backend()
            self.assertEqual(inside["cudnnConvFp32Precision"],"ieee")
            self.assertEqual(inside["cudaMatmulFp32Precision"],"ieee")
            self.assertEqual(inside["cudnnRnnFp32Precision"],before["cudnnRnnFp32Precision"])
            self.assertFalse(torch.cuda.is_initialized())
        after=capture._backend();self.assertEqual(after,before)
        self.assertFalse(torch.cuda.is_initialized())
        CURRENT_METADATA_SCOPE=dict(torchVersion=torch.__version__,before=before,inside=inside,after=after,
            restored=True,cudaInitialized=False,tensorOperations=0,modelCalls=0,
            scope="one current metadata-only case; existing generator_full_fp32_backend setters only; not026 replay")
    def test_encoding_consumes_private_packet_once(self):
        w,e,m,_=run_call();self.encode(w.packet)
        with self.assertRaisesRegex(ValueError,'private live sealed'):self.encode(w.packet)
        self.released(w,m)
    def test_forged_packet_refused(self):
        with self.assertRaises(TypeError):capture._SealedCapture()
        with self.assertRaises(ValueError):self.encode(object())
    def test_capture_budget_before_copy_unavailable_preserves_gate(self):
        w,e,m,_=run_call(max_capture_bytes=65536);self.assertIn('parameter 0',str(e))
        self.assertIsNone(w.packet);self.assertIn('budget',w.outcome['reason']);self.released(w,m)
    def test_actual_full_plane_payload_and_aggregate_target_reserve(self):
        w,e,m,_=run_call(cls=FullPlaneCapture);result=self.encode(w.packet)
        self.assertEqual(sum(d['bytes'] for d in result['metadata']['tensors'].values()),1501056)
        self.assertLessEqual(result['accounting']['targetBytesIncludingManifestAndTerminalReserve'],2097152)
        self.released(w,m)
    def test_aggregate_failure_and_execution_budget_enforced(self):
        for field,limit in [('failure',capture.AGGREGATE_FAILURE_MAXIMUM),('execution',capture.EXECUTION_MAXIMUM)]:
            w,e,m,_=run_call()
            # Small repeated immutable bytes measured cumulatively, not a large allocation.
            parts=tuple([b'x'*1048576]*(limit//1048576))
            with self.assertRaises(ValueError):self.encode(w.packet,**{field:parts})
            self.assertNotIn(w.packet,capture._PACKETS);self.released(w,m)
    def test_wrong_source_sha_rejected_before_observation(self):
        bad=capture.required_source_bindings();bad[0]['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'source binding'):capture._verified_sources(bad)
    def test_replaced_gate_function_code_rejected(self):
        with patch.object(capture.gate_module,'apply_object_joint_rgb_structure_priority_update_cpu',lambda **k:None):
            with self.assertRaises(ValueError):capture._verified_sources(capture.required_source_bindings())
    def test_wrong_native_target_type_rejected(self):
        model=SyntheticGraph();model.layer.__class__=nn.Module
        with self.assertRaisesRegex(ValueError,'convolution binding'):observer(model)
    def test_wrong_target_geometry_rejected(self):
        model=SyntheticGraph();model.layer.padding=(0,0)
        with self.assertRaisesRegex(ValueError,'geometry'):observer(model)
    def test_missing_native_bias_rejected(self):
        model=SyntheticGraph();model.layer.bias=None
        with self.assertRaisesRegex(ValueError,'methods/bias'):observer(model)
    def test_replaced_native_forward_before_capture_rejected(self):
        model=SyntheticGraph();model.layer.forward=lambda value:value
        with self.assertRaisesRegex(ValueError,'methods/bias'):observer(model)
    def test_replaced_native_forward_during_capture_retains_primary(self):
        w,e,m,_=run_call(mutate=lambda o,m,r:setattr(m.layer,'forward',lambda value:value))
        self.assertIsNone(w.packet);self.assertIn('configuration',w.outcome['reason'])
        self.assertIn('parameter 0',str(e));self.released(w,m)
    def test_attached_gradient_unavailable_without_replacing_primary(self):
        w,e,m,_=run_call('attached_gradient')
        self.assertIsNone(w.packet);self.assertIn('detachment',w.outcome['reason'])
        self.assertIn('parameter 0',str(e));self.released(w,m)
    def test_production_class_rejects_synthetic_identity(self):
        model=SyntheticGraph()
        with self.assertRaisesRegex(ValueError,'current RGB model'):observer(model,capture.Parameter0TrainingSameCallCapture)


if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CaptureTests))
    print(json.dumps(dict(syntheticOnly=False,syntheticTensorOperationsOnly=True,currentMetadataOnlyProbe=True,
        counts=COUNTS,cpuAffinity=process.cpu_affinity(),
        intraThreads=torch.get_num_threads(),interopThreads=torch.get_num_interop_threads(),
        cudaInitialized=torch.cuda.is_initialized(),testsRun=result.testsRun,passed=result.testsRun-len(result.failures)-len(result.errors)-len(result.skipped),
        failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),currentMetadataScope=CURRENT_METADATA_SCOPE)))
    raise SystemExit(not result.wasSuccessful())
