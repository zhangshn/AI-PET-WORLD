"""Synthetic CPU graphs and fake CUDA telemetry; never actual GPU/model capture."""
import sys, time, tempfile, unittest, json, ast, os
from pathlib import Path
from contextlib import contextmanager
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import diagnose_stage4_appearance_regime_failure_state_g_gpu as gpu
import torch
torch.set_num_threads(2)
torch.set_num_interop_threads(2)
tempfile.tempdir=str(ROOT/gpu.PARENT/'numeric-implementation/synthetic-fixtures')
Path(tempfile.tempdir).mkdir(parents=True,exist_ok=True)

class Toy(torch.nn.Module):
    def __init__(self,n):
        super().__init__();self.parameters_list=torch.nn.ParameterList([torch.nn.Parameter(torch.ones(1)) for _ in range(n)])
    def forward(self,value): return sum(p.square().sum() for p in self.parameters())

class Profile:
    def __init__(self,kind='pass'):self.kind=kind
    @contextmanager
    def observe_generator_gradients(self,observer):
        self.observer=observer;yield
    def sample_forward(self,model,sample):
        if self.kind=='rng':torch.rand(1)
        y=model(sample['conditions'])
        if self.kind=='extra':model(sample['conditions'])
        return y
    def _generator_candidate(self,model,critic,sample,order,y):
        if self.kind=='optimizer':torch.optim.SGD(model.parameters(),lr=.1)
        if self.kind=='backward':y.backward()
        if self.kind=='D':torch.autograd.grad(y,tuple(critic.parameters()))
        losses=(y*6,y,y*2,y*3)
        for i,(label,loss) in enumerate(zip(('actualTotal','structuredObjective','wholeFrameFidelity','objectCoreRgb'),losses)):
            self.observer('attempt',label,None)
            if self.kind=='partial' and i==2:raise ValueError('synthetic partial')
            values=torch.autograd.grad(loss,tuple(model.parameters()),retain_graph=i<3,create_graph=False,allow_unused=True)
            self.observer('complete',label,values)
        if self.kind=='gate':raise ValueError('actual total gradient identity differs at parameter 56')

class Tests(unittest.TestCase):
    def run_graph(self,kind='pass'):
        model,critic=Toy(107),Toy(14)
        sample={'split':'train','image':torch.zeros(3,2,2),'conditions':torch.zeros(23,2,2),
            'appearance_regime':torch.tensor([0.,0.,0.,1.]),'objectInstanceTable':[]}
        return gpu.run_device_graph(model=model,critic=critic,sample=sample,order=list(range(23)),profile=Profile(kind),
            deadline=time.monotonic()+20,allowed_files={str(Path(__file__).resolve())},device=torch.device('cpu'),resource=lambda:None),model,critic
    def test_real_micrograph_four_full_sets_and_state_restored(self):
        r,m,d=self.run_graph();self.assertEqual(r['callCounts']['generatorForwards'],1)
        self.assertEqual(r['callCounts']['generatorAutogradCompleted'],4)
        self.assertEqual([len(a) for a in r['rawGradients']],[107]*4)
        self.assertTrue(r['stateInputRngUnchanged']);self.assertTrue(all(p.requires_grad for p in d.parameters()))
        s=gpu.mask_statistics(r['rawGradients'],tuple(m.parameters()),torch.device('cpu'))
        self.assertTrue(s['passedAllOriginalToleranceMasks'])
    def test_gate_and_device_mask_difference_are_findings(self):
        self.assertTrue(gpu.reconcile_gate('original_cpu_reference_gate_passed',{'passedAllOriginalToleranceMasks':True},
            {'passedAllOriginalToleranceMasks':False})['deviceMaskDiffers'])
        with self.assertRaises(ValueError):gpu.reconcile_gate('original_cpu_reference_gate_passed',{'passedAllOriginalToleranceMasks':False},{'passedAllOriginalToleranceMasks':False})
        r,_,_=self.run_graph('gate');self.assertEqual(r['outcome'],'original_cpu_reference_gate_failed')
    def test_forbidden_optimizer_D_backward_extra_and_rng(self):
        for kind in ('optimizer','D','backward','extra','rng'):
            with self.subTest(kind=kind), self.assertRaises((ValueError,RuntimeError)):self.run_graph(kind)
    def test_partial_grad_counts_preserved(self):
        with self.assertRaisesRegex(ValueError,'partial') as e:self.run_graph('partial')
        self.assertEqual(e.exception.control_call_counts['generatorAutogradCompleted'],2)
        self.assertEqual(len(e.exception.control_raw_summaries),2)
    def test_resource_rejections(self):
        valid={'index':0,'name':'NVIDIA GeForce RTX 5050','uuid':gpu.GPU_UUID,'fraction':.7,'freeMiB':2048,'temperatureC':85,'diskFreeMiB':2048}
        gpu.validate_resources(valid)
        for key,value in (('index',1),('uuid','unknown'),('fraction',.71),('freeMiB',2047),('temperatureC',86),('diskFreeMiB',2047),('fraction',float('nan'))):
            with self.subTest(key=key),self.assertRaises(ValueError):gpu.validate_resources({**valid,key:value})
        with self.assertRaises(ValueError):gpu.validate_resources({**valid,'unknown':1})
    def test_mask_budget_nonfinite_and_positions(self):
        p=torch.zeros(3); raw=[(p.clone(),) for _ in range(4)];raw[0][0][1]=1
        s=gpu.mask_statistics(raw,(p,),torch.device('cpu'));self.assertEqual(s['allBadIndices'][0]['flatIndices'],[1])
        raw[0][0][1]=float('nan')
        with self.assertRaises(ValueError):gpu.mask_statistics(raw,(p,),torch.device('cpu'))
        p=torch.ones(8193);raw=[(p,), (torch.zeros_like(p),),(torch.zeros_like(p),),(torch.zeros_like(p),)]
        with self.assertRaises(ValueError):gpu.mask_statistics(raw,(p,),torch.device('cpu'))
    def test_explicit_bindings_and_old_spec_alias_fail_closed(self):
        with self.assertRaisesRegex(ValueError,'bindings'):gpu.preflight(ROOT,time.monotonic()+1,[])
        reader=gpu.CpuReportReader(ROOT,time.monotonic()+1)
        with self.assertRaisesRegex(ValueError,'alias'):reader.bound({'path':gpu.SPEC,'sha256':gpu.SPEC_SHA},json_data=False)
    def test_late_failure_receipt_and_tamper_rejected(self):
        result,_,_=self.run_graph()
        with self.assertRaises(ValueError) as e:
            with gpu.core.completed_g_evidence(result):raise ValueError('late synthetic identity error')
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp);gpu.save_worker_error(out,'a'*64,[],e.exception)
            receipt=gpu.stopped_worker_error(out,'a'*64,[])
            self.assertEqual(receipt['callCounts']['generatorAutogradCompleted'],4)
            (out/'gpu-completed-g-receipt.json').write_text('tampered')
            with self.assertRaises(ValueError):gpu.stopped_worker_error(out,'a'*64,[])
    def test_cached_failure_and_incomplete_claim_no_retry(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);reader=gpu.safe.Reader(root,time.monotonic()+5)
            with patch.object(gpu,'preflight',return_value=(reader,{'originalError':{}},{},{},[])), \
                 patch.object(gpu,'run_owned_gpu_process',return_value={'cleanupConfirmed':True,'timedOut':False,'exitCode':1}) as owned:
                a=gpu.diagnose(bindings=[],root=root);b=gpu.diagnose(bindings=[],root=root)
                self.assertEqual(a,b);self.assertEqual(owned.call_count,1)
                (Path(a['path']).parent/'gpu-commit.json').unlink()
                with self.assertRaises(ValueError):gpu.diagnose(bindings=[],root=root)
                self.assertEqual(owned.call_count,1)
    def test_owned_adapter_cpu_child_timeout_cleanup_and_environment(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)
            command="import os,time;assert os.environ['CUDA_VISIBLE_DEVICES']=='0';assert os.environ['OMP_NUM_THREADS']=='2';time.sleep(10)"
            receipt=gpu.run_owned_gpu_process([sys.executable,'-B','-c',command],cwd=ROOT,deadline=time.monotonic()+.5,evidence_root=out)
            self.assertTrue(receipt['timedOut']);self.assertTrue(receipt['cleanupConfirmed']);self.assertEqual(receipt['activeProcessesAfterCleanup'],0)
    def test_no_cpu_device_monkeypatch_or_old_bindings_call(self):
        tree=ast.parse(inspect_source())
        self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name)
            and n.func.value.id=='core' and n.func.attr=='bindings' for n in ast.walk(tree)))
        self.assertFalse(torch.cuda.is_initialized())
    def test_cuda_restore_failure_after_real_micrograph_keeps_completed_receipt(self):
        result,_,_=self.run_graph()
        rng=torch.tensor([1,2,3],dtype=torch.uint8)
        with patch.object(torch.cuda,'get_rng_state',return_value=rng), \
             patch.object(torch.cuda,'set_rng_state',side_effect=RuntimeError('synthetic CUDA restore failure')), \
             patch.object(gpu,'run_device_graph',return_value=result), self.assertRaisesRegex(RuntimeError,'cleanup') as caught:
            gpu.run_gpu_graph(device=torch.device('cuda:0'),resource=lambda:None)
        self.assertEqual(caught.exception.control_call_counts['generatorAutogradCompleted'],4)
        self.assertEqual(len(caught.exception.control_raw_summaries),4)
        self.assertFalse(caught.exception.control_completed_g_result['cudaStateEvidence']['rngAndBackendRestored'])
    def test_cpu_state_json_roundtrip_and_tamper_rejections(self):
        model,critic=Toy(107),Toy(14);critic.eval().requires_grad_(False)
        sample={'image':torch.zeros(3,2,2),'conditions':torch.zeros(23,2,2),'appearance_regime':torch.tensor([0.,0.,0.,1.]),'objectInstanceTable':[]}
        before={'model':gpu.state_snapshot(model),'critic':gpu.state_snapshot(critic),
            'input':{k:gpu.tensor_sha(sample[k]) for k in ('image','conditions','appearance_regime')},
            'table':gpu.safe.digest(gpu.safe.encoded(sample['objectInstanceTable']))}
        cpu=json.loads(json.dumps({'result':{'before':before}}))
        gpu.same_cpu_state(model,critic,sample,cpu)
        for key in ('mode','hash'):
            changed=json.loads(json.dumps(cpu))
            if key=='mode':changed['result']['before']['model']['modes'][0][1]=False
            else:changed['result']['before']['model']['parameters'][0][3]='a'*64
            with self.assertRaises(ValueError):gpu.same_cpu_state(model,critic,sample,changed)

def inspect_source():return Path(gpu.__file__).read_text()
if __name__=='__main__':unittest.main()
