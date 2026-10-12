"""Explicit device0 surrogate; no training, CPU replay, or automatic retry."""
from __future__ import annotations
import argparse, ctypes, hashlib, inspect, json, math, os, random, re, shutil, subprocess, sys, time, uuid
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest.mock import patch
import diagnose_stage4_appearance_regime_failure_state_g_cpu as core
safe = core.safe
require = safe.require
LIMITS = dict(safe.LIMITS)
output_bytes = safe.output_bytes
deadline_check = safe.deadline_check
ROOT = Path(os.path.abspath(__file__)).parents[3]
ENTRY = 'ml/ai-painter/scripts/diagnose_stage4_appearance_regime_failure_state_g_gpu.py'
TEST = 'ml/ai-painter/tests/test_diagnose_stage4_appearance_regime_failure_state_g_gpu.py'
PARENT = safe.OUTPUT_PARENT + '/next-t-q4-41'
SCHEMA = 'appearance-regime-failure-state-g-gpu-surrogate-v1'
SPEC = core.SPEC
SPEC_SHA = 'aef5bb230292a06f1503af5a4a40b443b67a722677e0cf6724ae578becc0f922'
OLD_SPEC = {'path': PARENT+'/formal-baseline/spec-1.47.bin', 'sha256': core.SPEC_SHA, 'bytes': 198118}
HISTORY = {'path': core.NEW_PARENT+'/history-proof.json', 'sha256': '115ae2ef2a70627d3d3ff7cb4571e8433748f2f3f7d7a8f19b8492e1428fc5de'}
CPU_ROOT = core.NEW_PARENT+'/control-8a078dac5bcfb5f4b5306755db3c1d3f7636fb6e0f82923d7e72461e0c21976b'
CPU_TERMINAL = {'path': CPU_ROOT+'/control-terminal.json', 'sha256': '8418cfd0b721d7e53acb071b0afa87c1d5b37c75e76dd339996545fbecbdfc36'}
CPU_ID = '0344668baf426c6eb5a667636d6453499f8907abe7d34ac54439c42ea4f0f131'
GPU_UUID = 'GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd'
FROZEN = {core.ENTRY:'1603ee77766626f502445f739f1c8a8975516f82f37e8cf49aab6795435418dc',
    core.TEST:'a819d8f8d3318a4fa4c5e4df1a343d372caf449fbd344b0d704f6f5efa4688ad',
    core.HELPER:'61260d64d0b518e747c6924edccc79c575d90f2bca5b30f10a75fc6c20a8de3d',
    safe.CAPTURE:safe.CAPTURE_SHA, SPEC:SPEC_SHA}
BOUNDARY = {'diagnosticOnly':True,'trainingAllowed':False,'checkpointPromotion':False,
    'qualificationGranted':False,'runtimePublication':False,'automaticRetries':0,'rootCause':'unknown'}
module_guard, state_snapshot, tensor_sha = core.module_guard, core.state_snapshot, core.tensor_sha

def programs(reader):
    result = []
    for path in (ENTRY, TEST, *FROZEN):
        sha = safe.file_hash(safe.logical_path(reader.root, path), reader.deadline)
        if path in FROZEN: require(sha == FROZEN[path], 'frozen source/spec changed: '+path)
        binding = {'path':path,'sha256':sha}
        reader.bound(binding, json_data=False); result.append(binding)
    return result

class CpuReportReader(safe.Reader):
    def bound(self, binding, *, json_data=True, maximum=None):
        if type(binding) is dict and binding.get('path') == SPEC:
            require(not json_data and binding == {'path':SPEC,'sha256':core.SPEC_SHA}, 'old SPEC alias conflict')
            return super().bound(OLD_SPEC, json_data=False, maximum=maximum)
        return super().bound(binding, json_data=json_data, maximum=maximum)

def cpu_record(reader, name):
    path = CPU_ROOT+'/'+name
    return reader.bound({'path':path,'sha256':safe.file_hash(safe.logical_path(reader.root,path),reader.deadline)})

def cpu_evidence(reader):
    cpu = reader.bound(CPU_TERMINAL)
    worker, commit, claim, inputs, owned = [cpu_record(reader,n) for n in (
        'worker-result.json','control-commit.json','control-claim.json','control-inputs.json','owned-process.json')]
    require(cpu['status']=='cpu_surrogate_complete_diagnostic_only' and cpu['identity']==CPU_ID
        and cpu['terminalBinding']==core.SOURCE_FAILURE and cpu['historyBinding']==HISTORY
        and cpu['boundary']==core.BOUNDARY and cpu['historyMode']==core.HISTORY_MODE, 'CPU source conflict')
    require(commit['identity']==CPU_ID and commit['terminal']['sha256']==CPU_TERMINAL['sha256']
        and Path(commit['terminal']['path']).resolve()==safe.logical_path(reader.root,CPU_TERMINAL['path']).resolve(), 'CPU commit conflict')
    require(worker=={k:v for k,v in cpu.items() if k not in ('ownedProcess','requestIdentity')}
        and owned==cpu['ownedProcess'] and owned['assignedBeforeResume'] is True and owned['killOnJobClose'] is True
        and owned['cleanupConfirmed'] is True and owned['activeProcessesAfterCleanup']==0
        and owned['exitCode']==0 and owned['timedOut'] is False and owned['pid']>0
        and owned['processCreationFileTime']>0 and 0<owned['elapsedSeconds']<=120
        and owned['jobName'].startswith('Local\\ai-painter-snapshot-'), 'CPU worker/owned proof conflict')
    require(claim['requestIdentity']==cpu['requestIdentity']==CPU_ROOT.rsplit('control-',1)[1]
        and claim['programBindings']==cpu['programBindings'] and claim['terminalBinding']==inputs['terminalBinding']==core.SOURCE_FAILURE
        and claim['historyBinding']==inputs['historyBinding']==HISTORY and inputs['identity']==CPU_ID, 'CPU claim conflict')
    require(cpu['inputIdentityBeforeAfter']=={'before':CPU_ID,'after':CPU_ID}
        and cpu['result']['before']==cpu['result']['after'] and cpu['result']['stateInputRngUnchanged'] is True
        and cpu['comparison']['passedAllOriginalToleranceMasks'] is True and cpu['comparison']['allFinite'] is True
        and cpu['comparison']['canonicalParameterCount']==107
        and cpu['actualTrainingCountsUnchanged']=={'generator':419,'discriminator':420}, 'CPU numerical/state proof conflict')
    require(cpu['result']['callCounts']=={'generatorForwards':1,'generatorAutogradAttempts':4,'generatorAutogradCompleted':4,
        'discriminatorAutograd':0,'optimizerObjects':0,'optimizerSteps':0,'cudaCalls':0}, 'CPU call counts conflict')
    rows=cpu['inputBindings']; require(len(rows)==193 and len({r['path'] for r in rows})==193, 'CPU input closure differs')
    original={r['path']:r['sha256'] for r in rows}
    for row in rows: reader.bound(row,json_data=False,maximum=LIMITS['captureBytes'])
    require(len(cpu['rawGradientSummaries'])==4 and all(len(r)==107 for r in cpu['rawGradientSummaries']), 'CPU summaries incomplete')
    fake=type('Observed',(),{'observed':original})()
    require(core.control_identity(fake,cpu['programBindings'],core.SOURCE_FAILURE,HISTORY)==CPU_ID,'CPU identity recomputation differs')
    payload={'terminal':core.SOURCE_FAILURE,'programs':cpu['programBindings'],'algorithm':core.SCHEMA,'limits':core.LIMITS,
        'history':{'mode':core.HISTORY_MODE,'binding':HISTORY,'inputs':original}}
    require(safe.digest(safe.encoded(payload))==cpu['requestIdentity'],'CPU request recomputation differs')
    reader.unchanged(); return cpu

def preflight(root, deadline, bindings):
    require(bindings==[core.SOURCE_FAILURE,HISTORY,CPU_TERMINAL], 'explicit source bindings differ')
    reader=core.HistoryReader(root,deadline,bindings[0],bindings[1])
    context=safe.preflight(reader,bindings[0]); data=core.input_preflight(reader,context)
    proof=CpuReportReader(root,deadline); cpu=cpu_evidence(proof)
    current=programs(reader)
    for path,sha in proof.observed.items():
        require(path not in reader.observed or reader.observed[path]==sha,'CPU/GPU input collision')
        reader.observed[path]=sha
    reader.unchanged(); return reader,context,data,cpu,current

def identity(reader, current):
    return safe.digest(safe.encoded({'algorithm':SCHEMA,'inputs':reader.observed,'programs':current,
        'failure':core.SOURCE_FAILURE,'history':HISTORY,'cpu':CPU_TERMINAL,'device':0,'uuid':GPU_UUID,'limits':LIMITS}))

def validate_resources(v):
    require(type(v) is dict and set(v)=={'index','name','uuid','fraction','freeMiB','temperatureC','diskFreeMiB'}, 'unknown resource fields')
    require(type(v['index']) is int and v['index']==0 and v['uuid']==GPU_UUID
        and 'RTX5050' in v['name'].replace(' ',''), 'device0 identity differs')
    require(all(type(v[k]) in (int,float) and math.isfinite(v[k]) for k in ('fraction','freeMiB','temperatureC','diskFreeMiB')), 'unknown resources')
    require(0<v['fraction']<=.7 and v['freeMiB']>=2048 and 0<=v['temperatureC']<=85
        and v['diskFreeMiB']>=2048, 'resource boundary exceeded')
    return v

def output_disk_free(root):
    path=safe.logical_path(root,PARENT).resolve()
    while not path.exists(): path=path.parent
    return shutil.disk_usage(path).free/1048576

def resource_precheck(root, deadline):
    safe.deadline_check(deadline)
    r=subprocess.run(['nvidia-smi','--query-gpu=index,name,uuid,memory.free,temperature.gpu','--format=csv,noheader,nounits'],
        check=True,capture_output=True,text=True,timeout=min(5,max(.01,deadline-time.monotonic())))
    rows=[s.split(',') for s in r.stdout.strip().splitlines()]
    rows=[s for s in rows if len(s)==5 and s[0].strip()=='0']; require(len(rows)==1,'unknown device0 row')
    row=[s.strip() for s in rows[0]]
    return validate_resources({'index':0,'name':row[1],'uuid':row[2],'fraction':.7,
        'freeMiB':float(row[3]),'temperatureC':float(row[4]),'diskFreeMiB':output_disk_free(root)})

def resources(torch, root, deadline):
    value=resource_precheck(root,deadline); prop=torch.cuda.get_device_properties(0)
    require(str(prop.uuid).lower().removeprefix('gpu-')==GPU_UUID.lower().removeprefix('gpu-')
        and torch.cuda.get_device_name(0)==value['name'], 'CUDA/NVML device mismatch')
    free,_=torch.cuda.mem_get_info(0)
    value.update(fraction=torch.cuda.get_per_process_memory_fraction(0),freeMiB=min(value['freeMiB'],free/1048576))
    return validate_resources(value)

def content_state(state):
    return {'parameters':[list(p[:4])+list(p[5:]) for p in state['parameters']],
        'buffers':[list(b[:4]) for b in state['buffers']], 'modes':[list(row) for row in state['modes']]}

def same_cpu_state(model, critic, sample, cpu):
    before=cpu['result']['before']
    require({k:tensor_sha(sample[k]) for k in ('image','conditions','appearance_regime')}==before['input']
        and safe.digest(safe.encoded(sample['objectInstanceTable']))==before['table'], 'CPU decoded input/table differs')
    for name, network in (('model',model),('critic',critic)):
        require(content_state(state_snapshot(network))==content_state(before[name]), 'CPU installed state differs: '+name)

@contextmanager
def gpu_graph_guards(torch, call, grad):
    with ExitStack() as stack:
        for owner,name,value in ((torch.nn.Module,'__call__',call),(torch.autograd,'grad',grad),
            (torch.Tensor,'backward',core.forbidden_guard('Tensor.backward')),
            (torch.autograd,'backward',core.forbidden_guard('autograd.backward')),
            (torch.optim.Optimizer,'__init__',core.forbidden_guard('Optimizer.__init__'))):
            stack.enter_context(patch.object(owner,name,value))
        yield

def mask_statistics(raw, parameters, device):
    import torch
    require(len(raw)==4 and all(len(r)==len(parameters) for r in raw), 'incomplete gradient statistics')
    rows=[]; positions=[]; total=0; worst=None; fault=None
    for i,p in enumerate(parameters):
        a,s,w,c=[torch.zeros_like(p) if r[i] is None else r[i] for r in raw]
        require(all(v.device==device and v.dtype==torch.float32 and bool(torch.isfinite(v).all()) for v in (a,s,w,c)), 'invalid mask operands')
        expected=(s.float()+w.float()).float()+c.float(); delta=(a-expected).abs(); limit=1e-6+1e-5*expected.abs()
        bad=~torch.isclose(a,expected,atol=1e-6,rtol=1e-5); indexes=torch.nonzero(bad.reshape(-1),as_tuple=False).reshape(-1)
        total+=indexes.numel(); require(total<=8192,'bad index budget exceeded')
        j=int((delta-limit).reshape(-1).argmax())
        row={'parameterIndex':i,'flatIndex':j,'actual':float(a.reshape(-1)[j]),'expected':float(expected.reshape(-1)[j]),
            'absoluteDifference':float(delta.reshape(-1)[j]),'limit':float(limit.reshape(-1)[j]),
            'excess':float((delta-limit).reshape(-1)[j]),'outsideToleranceElements':int(indexes.numel())}
        rows.append(row); positions.append({'parameterIndex':i,'flatIndices':indexes.tolist()})
        if worst is None or row['excess']>worst['excess']: worst=row
        if i==56 and p.numel()>19765:
            j=19765; fault={'parameterIndex':56,'flatIndex':j,'coordinate':[32,20,0,1],'actual':float(a.reshape(-1)[j]),
                'expected':float(expected.reshape(-1)[j]),'absoluteDifference':float(delta.reshape(-1)[j]),
                'limit':float(limit.reshape(-1)[j]),'outsideTolerance':bool(bad.reshape(-1)[j])}
    return {'arithmeticDevice':str(device),'passedAllOriginalToleranceMasks':total==0,'outsideToleranceElements':total,
        'atol':1e-6,'rtol':1e-5,'formula':'(structured.float()+whole.float()).float()+core.float()',
        'parameters':rows,'allBadIndices':positions,'worst':worst,'originalFaultCoordinateCurrent':fault}

def reconcile_gate(outcome, cpu_statistics, device_statistics):
    require(cpu_statistics['passedAllOriginalToleranceMasks']==(outcome=='original_cpu_reference_gate_passed'),
        'original gate/CPU reference statistics conflict')
    return {'originalGateArithmetic':'CPU reference of GPU autograd gradients',
        'deviceMaskDiffers':cpu_statistics['passedAllOriginalToleranceMasks']!=device_statistics['passedAllOriginalToleranceMasks']}

def cli_args(bindings):
    pairs=(('--terminal','--sha256'),('--history-binding','--history-sha256'),('--cpu-terminal','--cpu-sha256'))
    return [v for b,n in zip(bindings,pairs) for v in (n[0],b['path'],n[1],b['sha256'])]

def run_device_graph(*, model, critic, sample, order, profile, deadline, allowed_files, device, resource):
    """Shared original G graph with actual grad-call instrumentation; no steps."""
    import numpy as np
    import torch
    module_guard(model, allowed_files)
    module_guard(critic, allowed_files)
    require(sample.get("split") == "train", "only train sample permitted")
    parameters = tuple(model.parameters())
    require(len(parameters) == 107 and len(tuple(critic.parameters())) == 14
            and all(p.requires_grad and p.device == device and p.grad is None for p in parameters),
            "clean complete CPU generator required")
    require(all(p.device == device and p.grad is None for p in critic.parameters()), "clean CPU critic required")
    counts = {"generatorForwards": 0, "generatorAutogradAttempts": 0, "generatorAutogradCompleted": 0,
              "discriminatorAutograd": 0, "optimizerObjects": 0, "optimizerSteps": 0, "cudaOptimizationCalls": 0}
    entry = state_snapshot(critic)
    rng = torch.random.get_rng_state().clone()
    python_rng, numpy_rng = random.getstate(), np.random.get_state()
    backend = (torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
               torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    primary = None
    raw, labels, cleanup = [], ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb"), []
    original_grad, original_call = torch.autograd.grad, torch.nn.Module.__call__
    precision_observations=[]
    def call(module, *args, **kwargs):
        if module is model:
            counts["generatorForwards"] += 1
            require(counts["generatorForwards"] == 1, "extra generator forward prohibited")
        safe.deadline_check(deadline)
        return original_call(module, *args, **kwargs)
    def grad(loss, inputs, *args, **kwargs):
        actual_inputs = tuple(inputs)
        require(not args and len(actual_inputs) == len(parameters) and
                all(a is b for a, b in zip(actual_inputs, parameters)), "D/unknown autograd input prohibited")
        i = counts["generatorAutogradAttempts"]
        require(i < 4 and kwargs == {"retain_graph": i < 3, "create_graph": False, "allow_unused": True},
                "original four-gradient call contract differs")
        counts["generatorAutogradAttempts"] += 1
        if device.type == 'cuda':
            precision={'autocastEnabled':torch.is_autocast_enabled('cuda'),
                'matmulFp32':torch.backends.cuda.matmul.fp32_precision,'cudnnConvFp32':torch.backends.cudnn.conv.fp32_precision}
            require(precision=={'autocastEnabled':False,'matmulFp32':'ieee','cudnnConvFp32':'ieee'},'original IEEE FP32 scope differs')
            precision_observations.append(precision)
        resource()
        safe.deadline_check(deadline)
        values = original_grad(loss, inputs, **kwargs)
        require(len(values) == 107, "partial raw gradient set")
        counts["generatorAutogradCompleted"] += 1
        return values
    def observer(stage, label, values):
        require(label == labels[len(raw)] if len(raw) < 4 else False, "gradient observation order differs")
        if stage == "complete":
            require(len(values) == 107 and counts["generatorAutogradCompleted"] == len(raw) + 1,
                    "observer completion without real grad call")
            raw.append(values)
        else:
            require(stage == "attempt", "unknown gradient observation event")
    try:
        critic.eval().requires_grad_(False)
        require(all(not m.training for m in critic.modules()) and
                all(not p.requires_grad for p in critic.parameters()), "critic G phase not frozen eval")
        before = {"model": state_snapshot(model), "critic": state_snapshot(critic),
                  "input": {k: tensor_sha(sample[k]) for k in ("image", "conditions", "appearance_regime")},
                  "table": safe.digest(safe.encoded(sample["objectInstanceTable"]))}
        with gpu_graph_guards(torch, call, grad):
            with profile.observe_generator_gradients(observer):
                prediction = profile.sample_forward(model, sample)
                try:
                    profile._generator_candidate(model, critic, sample, order, prediction)
                    outcome = "original_cpu_reference_gate_passed"
                except ValueError as error:
                    if re.fullmatch(r"actual total gradient identity differs at parameter \d+", str(error)) and len(raw) == 4:
                        outcome = "original_cpu_reference_gate_failed"
                        original_gate_error = str(error)
                    else:
                        raise
        require(counts["generatorForwards"] == 1 and counts["generatorAutogradCompleted"] == 4 and len(raw) == 4,
                "one forward/four complete actual gradients required")
        require(all(v is None or (v.device == device and v.dtype == torch.float32 and
                                  bool(torch.isfinite(v).all())) for rows in raw for v in rows),
                "raw gradients nonfinite or non-CPU")
        after = {"model": state_snapshot(model), "critic": state_snapshot(critic),
                 "input": {k: tensor_sha(sample[k]) for k in ("image", "conditions", "appearance_regime")},
                 "table": safe.digest(safe.encoded(sample["objectInstanceTable"]))}
        require(before == after, "G changed state/input/modes/gradients")
        require(torch.equal(rng, torch.random.get_rng_state()) and python_rng == random.getstate()
                and numpy_rng[0] == np.random.get_state()[0] and
                np.array_equal(numpy_rng[1], np.random.get_state()[1]) and
                numpy_rng[2:] == np.random.get_state()[2:], "G changed RNG")
        require(backend == (torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
                            torch.are_deterministic_algorithms_enabled(),
                            torch.is_deterministic_algorithms_warn_only_enabled()), "G changed CPU backend")
        safe.deadline_check(deadline)
        return {"outcome": outcome, "originalGateError": locals().get("original_gate_error"),
                "callCounts": counts, "rawGradients": raw, "before": before, "after": after,
                "stateInputRngUnchanged": True, "executionPrecisionDuringAutograd": precision_observations}
    except BaseException as error:
        primary = error
        error.control_call_counts = counts
        error.control_original_gate_error = locals().get("original_gate_error")
        try:
            error.control_raw_summaries = [
                [{"unused": v is None, "finite": v is None or bool(torch.isfinite(v).all()),
                  "shape": None if v is None else list(v.shape),
                  "sha256": None if v is None else tensor_sha(v)} for v in rows] for rows in raw]
            if "before" in locals():
                error.control_state_unchanged_on_failure = (
                    before["model"] == state_snapshot(model) and before["critic"] == state_snapshot(critic)
                    and before["input"] == {k: tensor_sha(sample[k]) for k in
                                           ("image", "conditions", "appearance_regime")}
                    and before["table"] == safe.digest(safe.encoded(sample["objectInstanceTable"])))
        except BaseException as secondary:
            error.control_summary_error = str(secondary)[:512]
        raise
    finally:
        operations = [
            lambda: torch.random.set_rng_state(rng),
            lambda: random.setstate(python_rng), lambda: np.random.set_state(numpy_rng),
            lambda: setattr(torch.backends.mkldnn, "enabled", backend[0]),
            lambda: setattr(torch.backends.mkldnn, "deterministic", backend[1]),
            lambda: torch.use_deterministic_algorithms(backend[2], warn_only=backend[3])]
        modules, params = dict(critic.named_modules()), dict(critic.named_parameters())
        operations += [lambda n=n, f=f: setattr(modules[n], "training", f) for n, f in entry["modes"]]
        operations += [lambda n=p[0], f=p[5]: params[n].requires_grad_(f) for p in entry["parameters"]]
        for operation in operations:
            try:
                operation()
            except BaseException as secondary:
                cleanup.append(str(secondary)[:512])
        if cleanup:
            if primary is not None:
                primary.control_cleanup_errors = cleanup
            else:
                raise RuntimeError("G cleanup failed: " + repr(cleanup))


def run_gpu_graph(**kwargs):
    import torch
    device=kwargs['device'];require(device==torch.device('cuda:0'),'real graph requires cuda0')
    cuda_rng=torch.cuda.get_rng_state(device).clone()
    backend=(torch.backends.cuda.matmul.fp32_precision,torch.backends.cudnn.conv.fp32_precision,
        torch.backends.cudnn.enabled,torch.backends.cudnn.benchmark,torch.backends.cudnn.deterministic)
    primary=None
    result=None
    try:
        kwargs['resource']()
        result=run_device_graph(**kwargs)
        with core.completed_g_evidence(result):
            kwargs['resource']()
            require(torch.equal(cuda_rng,torch.cuda.get_rng_state(device)),'G changed CUDA RNG')
            require(backend==(torch.backends.cuda.matmul.fp32_precision,torch.backends.cudnn.conv.fp32_precision,
                torch.backends.cudnn.enabled,torch.backends.cudnn.benchmark,torch.backends.cudnn.deterministic),'G changed CUDA backend')
            result['cudaStateEvidence']={'rngBefore':tensor_sha(cuda_rng),'rngAfter':tensor_sha(torch.cuda.get_rng_state(device)),
                'backendBefore':list(backend),'backendAfter':list(backend),'rngAndBackendRestored':False}
        return result
    except BaseException as error:primary=error;raise
    finally:
        cleanup=[]
        for fn in (lambda:torch.cuda.set_rng_state(cuda_rng,device),
            lambda:setattr(torch.backends.cuda.matmul,'fp32_precision',backend[0]),
            lambda:setattr(torch.backends.cudnn.conv,'fp32_precision',backend[1]),
            lambda:setattr(torch.backends.cudnn,'enabled',backend[2]),
            lambda:setattr(torch.backends.cudnn,'benchmark',backend[3]),
            lambda:setattr(torch.backends.cudnn,'deterministic',backend[4])):
            try:fn()
            except BaseException as error:cleanup.append(str(error)[:256])
        if not cleanup:
            try:
                require(torch.equal(cuda_rng,torch.cuda.get_rng_state(device)) and backend==(
                    torch.backends.cuda.matmul.fp32_precision,torch.backends.cudnn.conv.fp32_precision,
                    torch.backends.cudnn.enabled,torch.backends.cudnn.benchmark,torch.backends.cudnn.deterministic),
                    'CUDA restored-state readback differs')
                if result is not None:result['cudaStateEvidence']['rngAndBackendRestored']=True
            except BaseException as error:cleanup.append(str(error)[:256])
        if cleanup:
            if primary is not None:primary.control_cleanup_errors=getattr(primary,'control_cleanup_errors',[])+cleanup
            elif result is not None:
                with core.completed_g_evidence(result):
                    raise RuntimeError('CUDA cleanup failed: '+repr(cleanup))
            else:raise RuntimeError('CUDA cleanup failed before completed G: '+repr(cleanup))

def worker(root, bindings, output, request, deadline):
    safe.verify_owned_worker();safe.deadline_check(deadline)
    reader,context,data,cpu,current=preflight(root,deadline,bindings)
    require(identity(reader,current)==request,'worker preflight identity differs')
    claim=json.loads((output/'gpu-claim.json').read_bytes())
    require(claim['requestIdentity']==request and claim['bindings']==bindings and claim['deadline']==deadline
        and output.name=='control-'+request,'worker claim differs')
    nvml_precheck=resource_precheck(root,deadline)
    capture=safe.load_capture(root);torch=capture.torch;torch.set_num_threads(2);torch.set_num_interop_threads(2)
    torch.cuda.set_per_process_memory_fraction(.7,0)
    resource=lambda:resources(torch,root,deadline);initial_resource=resource()
    artifact=context['receipt']['artifacts']['tensors']
    with safe.locked_capture_archive(Path(artifact['path'])):
        archive=safe.inspect_tensor_archive(Path(artifact['path']),context['manifest']['tensorDescriptors'],expected_sha=artifact['sha256'])
        raw=Path(artifact['path']).read_bytes()
        require(len(raw)==artifact['bytes'] and safe.digest(raw)==artifact['sha256'],'archive changed')
        tensors=capture._verify_tensors(raw,context['manifest']['tensorDescriptors'])
    for path in (root/'ml/ai-painter/src',root/'ml/ai-painter/scripts'):sys.path.insert(0,str(path))
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as decoder
    import painter_stage4_appearance_regime_checkpoint_worker as attached
    import painter_stage4_appearance_regime_probe as profile
    adapter=core.InputReader(reader,data['known'])
    sample,decoded=decoder.load_sample(adapter,data['row'],data['order'],data['continuous'])
    sample=attached.attach_regime(adapter,data['row'],sample);model,critic=profile.fresh_networks(data['order'])
    core.install_state(model,context['manifest']['networks']['model'],tensors)
    core.install_state(critic,context['manifest']['networks']['critic'],tensors)
    entry=state_snapshot(critic);critic.eval().requires_grad_(False);same_cpu_state(model,critic,sample,cpu)
    require(identity(reader,current)==request,'decoder expanded preflight identity')
    mods=dict(critic.named_modules());pars=dict(critic.named_parameters())
    for n,f in entry['modes']:mods[n].training=f
    for p in entry['parameters']:pars[p[0]].requires_grad_(p[5])
    device=torch.device('cuda:0');model.to(device);critic.to(device);bound=profile._bound_device(model,sample)
    allowed={str(safe.logical_path(root,p).resolve()) for p in data['sources'] if p.endswith('.py')}
    result=run_gpu_graph(model=model,critic=critic,sample=bound,order=data['order'],profile=profile,
        deadline=deadline,allowed_files=allowed,device=device,resource=resource)
    with core.completed_g_evidence(result):
        raw=result.pop('rawGradients');gpu_stats=mask_statistics(raw,tuple(model.parameters()),device)
        cpu_raw=[tuple(None if v is None else v.detach().cpu() for v in rows) for rows in raw]
        cpu_params=tuple(p.detach().cpu() for p in model.parameters())
        cpu_stats=mask_statistics(cpu_raw,cpu_params,torch.device('cpu'))
        semantics=reconcile_gate(result['outcome'],cpu_stats,gpu_stats)
        summary=[[{'unused':v is None,'shape':None if v is None else list(v.shape),'sha256':None if v is None else tensor_sha(v)} for v in rows] for rows in raw]
        saved=[[{'unused':x['unused'],'sha256':None if x['key'] is None else tensor_sha(tensors[x['key']])} for x in rows] for rows in context['manifest']['gradientSets']]
        cpu_summary=cpu['rawGradientSummaries']
        comparison=[[{'sameSavedBytes':a['sha256']==b['sha256'],'sameCpuControlSummaryBytes':a['sha256']==c['sha256']}
            for a,b,c in zip(g,s,t)] for g,s,t in zip(summary,saved,cpu_summary)]
        torch.cuda.synchronize(0);final_resource=resource();reader.unchanged();safe.deadline_check(deadline)
        require(identity(reader,current)==request,'history/input final identity differs')
        import numpy as np
        import PIL
        driver=subprocess.run(['nvidia-smi','--id=0','--query-gpu=driver_version','--format=csv,noheader,nounits'],
            check=True,capture_output=True,text=True,timeout=min(5,max(.01,deadline-time.monotonic()))).stdout.strip()
        require(driver and '\n' not in driver,'unknown device0 driver')
        report={'schemaVersion':SCHEMA,'status':'gpu_surrogate_complete_diagnostic_only','requestIdentity':request,'identity':request,
            'bindings':bindings,'programBindings':current,'inputBindings':[{'path':p,'sha256':s} for p,s in sorted(reader.observed.items())],
            'inputIdentityBeforeAfter':{'before':request,'after':request},'result':result,'gpuDiagnosticMask':gpu_stats,
            'cpuReferenceMaskOfGpuGradients':cpu_stats,'gateSemantics':semantics,'rawGradientSummaries':summary,
            'savedGradientSummaries':saved,'summaryByteComparisons':comparison,'originalCudaFailure':context['originalError'],
            'originalFaultValues':{'parameterIndex':56,'flatIndex':19765,'actual':.024561723694205284,'expected':.0245604757219553,
            'absoluteDifference':1.2479722499847412e-6,'limit':1.2456047215891886e-6},
            'cpuControl':{'binding':CPU_TERMINAL,'identity':CPU_ID,'passedAllOriginalToleranceMasks':True},
            'currentRuntimeVersions':{'torch':torch.__version__,'numpy':np.__version__,'Pillow':PIL.__version__,
                'cudaRuntime':torch.version.cuda,'driver':driver,'deviceName':initial_resource['name'],'deviceUuid':GPU_UUID},
            'generatorPrecisionContract':'original profile generator_fp32_scope: IEEE FP32, autocast disabled',
            'actualTrainingCountsUnchanged':context['counts'],'decodedIdentity':decoded,'archivePreflight':archive,'snapshotDeserializations':1,
            'resources':{'beforeCudaInitialization':nvml_precheck,'before':initial_resource,'after':final_resource},'device':str(device),'boundary':BOUNDARY,'limits':LIMITS,
            'surrogateGaps':['new GPU graph, not historical CUDA byte replay','historical decoded tensors, library binaries, pre-G RNG not captured',
                'CPU control has summaries only; no reconstructed CPU gradient vectors or recomputation','single sample cannot identify operator or root cause']}
        return safe.write_exclusive(output,'gpu-worker-result.json',report)

def save_worker_error(output,request,bindings,error):
    failure={'requestIdentity':request,'identity':request,'bindings':bindings,'errorType':type(error).__name__,'error':str(error)[:4096],
        'callCounts':getattr(error,'control_call_counts',None),'stateUnchangedOnFailure':getattr(error,'control_state_unchanged_on_failure',None),
        'originalGateError':getattr(error,'control_original_gate_error',None),'cleanupErrors':getattr(error,'control_cleanup_errors',None),'boundary':BOUNDARY}
    for attribute,name,key in (('control_raw_summaries','gpu-partial-summaries.json','rawSummaryBinding'),
        ('control_completed_g_result','gpu-completed-g-receipt.json','completedGReceiptBinding')):
        value=getattr(error,attribute,None)
        if value is not None:
            try:failure[key]=safe.write_exclusive(output,name,value)
            except BaseException as secondary:failure[key+'Error']=str(secondary)[:512]
    return safe.write_exclusive(output,'gpu-worker-error.json',failure,failure=True)

def stopped_worker_error(output,request,bindings):
    file=output/'gpu-worker-error.json'
    if not file.exists():return {'callCounts':None,'reason':'worker receipt absent'}
    require(not file.is_symlink() and file.stat().st_size<=LIMITS['failureReserveBytes']//4,'worker error boundary')
    raw=file.read_bytes();result=json.loads(raw)
    require(result['requestIdentity']==request and result['bindings']==bindings and result['boundary']==BOUNDARY,'worker error identity differs')
    for key,name in (('rawSummaryBinding','gpu-partial-summaries.json'),('completedGReceiptBinding','gpu-completed-g-receipt.json')):
        if key in result:
            b=result[key];target=output/name
            require(set(b)=={'path','sha256'} and Path(b['path']).resolve()==target.resolve()
                and not target.is_symlink() and target.stat().st_size<=LIMITS['jsonBytes'],'worker receipt path differs')
            require(safe.digest(target.read_bytes())==b['sha256'],'worker receipt SHA differs')
    result['workerErrorBinding']={'path':str(file),'sha256':safe.digest(raw)}
    return result

def diagnose(*,bindings,root=ROOT,preflight_only=False):
    root=Path(os.path.abspath(root));deadline=time.monotonic()+120
    reader,context,data,cpu,current=preflight(root,deadline,bindings);request=identity(reader,current)
    if preflight_only:return {'status':'gpu_readonly_preflight_complete_no_attempt','requestIdentity':request,
        'inputCount':len(reader.observed),'programBindings':current,'rootCause':'unknown','cudaInitialized':False}
    output=safe.logical_path(root,PARENT+'/control-'+request)
    if output.exists():
        require(safe.output_bytes(output)<=LIMITS['outputBytes'],'cached budget exceeded')
        files=[output/n for n in ('gpu-claim.json','gpu-terminal.json','gpu-commit.json')]
        require(all(f.is_file() and not f.is_symlink() and f.stat().st_size<=LIMITS['jsonBytes'] for f in files),'incomplete consumed request; no retry')
        claim,final,commit=[json.loads(f.read_bytes()) for f in files]
        require(claim['requestIdentity']==final['requestIdentity']==commit['identity']==request and claim['bindings']==bindings
            and claim['programBindings']==current and claim['boundary']==BOUNDARY and final['bindings']==bindings
            and final['boundary']==BOUNDARY and final['status'] in ('gpu_surrogate_complete_diagnostic_only','gpu_surrogate_failed_closed')
            and Path(commit['terminal']['path']).resolve()==files[1].resolve() and commit['terminal']['sha256']==safe.digest(files[1].read_bytes()),'cached identity conflict')
        reader.unchanged();return commit['terminal']
    output.mkdir(parents=True,exist_ok=False)
    safe.write_exclusive(output,'gpu-claim.json',{'requestIdentity':request,'bindings':bindings,'programBindings':current,'deadline':deadline,'boundary':BOUNDARY})
    process=None
    try:
        argv=[sys.executable,'-B',str(safe.logical_path(root,ENTRY)),*cli_args(bindings),'--worker','--output',str(output.relative_to(root)).replace('\\','/'),
            '--identity',request,'--deadline',str(deadline)]
        process=run_owned_gpu_process(argv,cwd=root,deadline=deadline,evidence_root=output)
        safe.write_exclusive(output,'gpu-owned-process.json',process)
        require(process['cleanupConfirmed'] and not process['timedOut'] and process['exitCode']==0,'owned GPU worker failed or timed out')
        file=output/'gpu-worker-result.json';require(file.stat().st_size<=LIMITS['jsonBytes'],'GPU report budget exceeded')
        result=json.loads(file.read_bytes());require(result['requestIdentity']==request and result['programBindings']==current and result['bindings']==bindings
            and result['status']=='gpu_surrogate_complete_diagnostic_only'
            and result['boundary']==BOUNDARY and result['inputIdentityBeforeAfter']=={'before':request,'after':request},'GPU report identity differs')
        reader.unchanged();safe.deadline_check(deadline);result['ownedProcess']=process
    except BaseException as error:
        process=process or getattr(error,'owned_process_receipt',None)
        result={'schemaVersion':SCHEMA,'status':'gpu_surrogate_failed_closed','requestIdentity':request,'identity':request,'bindings':bindings,
            'errorType':type(error).__name__,'error':str(error)[:4096],'ownedProcess':process,'originalCudaFailure':context['originalError'],'boundary':BOUNDARY}
        if process is not None and process.get('cleanupConfirmed'):
            try:result['ownedWorkerFailure']=stopped_worker_error(output,request,bindings)
            except BaseException as secondary:result['ownedWorkerFailure']={'callCounts':None,'metadataError':str(secondary)[:1024]}
        else:result['ownedWorkerFailure']={'callCounts':None,'reason':'owned cleanup unknown or no process'}
    terminal={'path':str(output/'gpu-terminal.json'),'sha256':safe.digest(safe.encoded(result))}
    safe.write_exclusive(output,'gpu-commit.json',{'identity':request,'terminal':terminal},failure=True)
    return safe.write_exclusive(output,'gpu-terminal.json',result,failure=result['status']=='gpu_surrogate_failed_closed')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('terminal','sha256','history-binding','history-sha256','cpu-terminal','cpu-sha256'):p.add_argument('--'+name,required=True)
    p.add_argument('--preflight-only',action='store_true');p.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
    p.add_argument('--output',help=argparse.SUPPRESS);p.add_argument('--identity',help=argparse.SUPPRESS);p.add_argument('--deadline',type=float,help=argparse.SUPPRESS)
    a=p.parse_args();bindings=[{'path':a.terminal,'sha256':a.sha256},{'path':a.history_binding,'sha256':a.history_sha256},{'path':a.cpu_terminal,'sha256':a.cpu_sha256}]
    if a.worker:
        require(not a.preflight_only and a.identity and re.fullmatch('[a-f0-9]{64}',a.identity) and a.output==PARENT+'/control-'+a.identity
            and math.isfinite(a.deadline) and time.monotonic()<a.deadline<=time.monotonic()+120,'invalid GPU worker claim')
        output=safe.logical_path(ROOT,a.output)
        try:worker(ROOT,bindings,output,a.identity,a.deadline)
        except BaseException as error:
            try:save_worker_error(output,a.identity,bindings,error)
            except BaseException as secondary:error.control_publication_error=str(secondary)
            raise
    else:print(json.dumps(diagnose(bindings=bindings,preflight_only=a.preflight_only)))
def run_owned_gpu_process(argv, *, cwd, deadline, evidence_root):
    """Only kill a private Job handle, or our never-resumed process handle.

    Never take over a named Job, recover a PID, or launch through a shell.
    """
    require(os.name == "nt", "Windows owned process boundary required")
    import _winapi
    from ctypes import wintypes as wt

    class Basic(ctypes.Structure):
        _fields_ = [("user", ctypes.c_longlong), ("job", ctypes.c_longlong), ("flags", wt.DWORD),
                    ("minimum", ctypes.c_size_t), ("maximum", ctypes.c_size_t), ("count", wt.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority", wt.DWORD), ("scheduling", wt.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(key, ctypes.c_ulonglong) for key in ("a", "b", "c", "d", "e", "f")]
    class Extended(ctypes.Structure):
        _fields_ = [("basic", Basic), ("io", IO), ("pm", ctypes.c_size_t), ("jm", ctypes.c_size_t),
                    ("ppm", ctypes.c_size_t), ("pjm", ctypes.c_size_t)]
    class Accounting(ctypes.Structure):
        _fields_ = [(key, ctypes.c_longlong) for key in ("a", "b", "c", "d")] + [(key, wt.DWORD) for key in ("faults", "total", "active", "terminated")]
    dll = ctypes.WinDLL("kernel32", use_last_error=True)
    for name, args, result in (
        ("CreateJobObjectW", [wt.LPVOID, wt.LPCWSTR], wt.HANDLE),
        ("SetInformationJobObject", [wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD], wt.BOOL),
        ("AssignProcessToJobObject", [wt.HANDLE, wt.HANDLE], wt.BOOL),
        ("QueryInformationJobObject", [wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD, wt.LPVOID], wt.BOOL),
        ("TerminateJobObject", [wt.HANDLE, wt.UINT], wt.BOOL),
        ("GetProcessTimes", [wt.HANDLE] + [ctypes.POINTER(wt.FILETIME)] * 4, wt.BOOL),
        ("ResumeThread", [wt.HANDLE], wt.DWORD),
        ("CloseHandle", [wt.HANDLE], wt.BOOL)):
        function = getattr(dll, name)
        function.argtypes, function.restype = args, result
    def checked(value, label):
        if not value:
            raise OSError(ctypes.get_last_error(), label)
    def accounting():
        value = Accounting()
        checked(dll.QueryInformationJobObject(job, 1, ctypes.byref(value), ctypes.sizeof(value), None), "query owned Job")
        return value
    job_name = "Local\\ai-painter-snapshot-" + uuid.uuid4().hex
    job = dll.CreateJobObjectW(None, job_name)
    checked(job, "create private Job")
    if ctypes.get_last_error() == 183:
        dll.CloseHandle(job)
        raise ValueError("refuse existing Job ownership")
    process = thread = None
    assigned = False
    started = time.monotonic()
    cleanup_budget = min(2, max(.025, (deadline - started) / 3))
    termination_deadline = deadline - cleanup_budget
    receipt = {"argv": argv, "jobName": job_name, "assignedBeforeResume": False, "killOnJobClose": False,
               "timedOut": False, "cleanupConfirmed": False}
    try:
        deadline_check(deadline)
        limits = Extended()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        checked(dll.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)), "Job kill-on-close")
        receipt["killOnJobClose"] = True
        environment = {**os.environ, "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2",
                       "OPENBLAS_NUM_THREADS": "2", "CUDA_VISIBLE_DEVICES": "0", "CUDA_DEVICE_ORDER": "PCI_BUS_ID", "PYTHONDONTWRITEBYTECODE": "1",
                       "AI_PAINTER_SNAPSHOT_JOB": job_name}
        # No inherited handles, no unbounded child output transport. Child writes
        # only budgeted files; console stdout/stderr are discarded by this mode.
        startup = subprocess.STARTUPINFO()
        startup.dwFlags = subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = subprocess.SW_HIDE
        process, thread, pid, _ = _winapi.CreateProcess(argv[0], subprocess.list2cmdline(argv), None, None,
                                                      False, 0x08000004, environment,
                                                      str(cwd) if len(str(cwd)) < 250 else str(Path(argv[0]).parent), startup)
        receipt["pid"] = pid
        times = [wt.FILETIME() for _ in range(4)]
        checked(dll.GetProcessTimes(int(process), *(ctypes.byref(value) for value in times)), "owned process creation identity")
        receipt["processCreationFileTime"] = (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime
        checked(dll.AssignProcessToJobObject(job, int(process)), "assign Job before resume")
        assigned = True
        receipt["assignedBeforeResume"] = True
        require(dll.ResumeThread(int(thread)) != 0xffffffff, "resume owned process failed")
        while True:
            remaining = termination_deadline - time.monotonic()
            if remaining <= 0:
                receipt["timedOut"] = True
                break
            if _winapi.WaitForSingleObject(process, max(1, min(25, int(remaining * 1000)))) == _winapi.WAIT_OBJECT_0:
                break
            require(output_bytes(evidence_root) <= LIMITS["outputBytes"] - LIMITS["failureReserveBytes"], "child output budget exhausted")
        stats = accounting()
        receipt["totalProcesses"] = stats.total
        if stats.active:
            checked(dll.TerminateJobObject(job, 124 if receipt["timedOut"] else 1), "terminate owned Job")
        cleanup_until = min(deadline, time.monotonic() + cleanup_budget)
        while accounting().active and time.monotonic() < cleanup_until:
            time.sleep(.01)
        receipt["activeProcessesAfterCleanup"] = accounting().active
        receipt["cleanupConfirmed"] = receipt["activeProcessesAfterCleanup"] == 0
        require(receipt["cleanupConfirmed"], "owned Job cleanup unconfirmed")
        receipt["exitCode"] = _winapi.GetExitCodeProcess(process)
        receipt["elapsedSeconds"] = time.monotonic() - started
        return receipt
    except BaseException as error:
        # Preserve the primary error, and attempt confirmation using ONLY the
        # private owned Job. Finally closing its handle also enforces kill-on-close.
        if assigned:
            try:
                stats = accounting()
                receipt["totalProcesses"] = stats.total
                if stats.active:
                    checked(dll.TerminateJobObject(job, 1), "cleanup failed owned Job")
                cleanup_until = min(deadline, time.monotonic() + cleanup_budget)
                while accounting().active and time.monotonic() < cleanup_until:
                    time.sleep(.01)
                receipt["activeProcessesAfterCleanup"] = accounting().active
                receipt["cleanupConfirmed"] = receipt["activeProcessesAfterCleanup"] == 0
            except BaseException as cleanup_error:
                receipt["cleanupError"] = str(cleanup_error)[:4096]
        receipt["elapsedSeconds"] = time.monotonic() - started
        error.owned_process_receipt = receipt
        raise
    finally:
        if process is not None and not assigned:
            _winapi.TerminateProcess(process, 1)  # owned, still-suspended handle
        dll.CloseHandle(job)  # kills only this private Job, including descendants
        if thread is not None:
            _winapi.CloseHandle(thread)
        if process is not None:
            _winapi.CloseHandle(process)


if __name__=='__main__':
    try:main()
    except BaseException as error:
        if '--worker' not in sys.argv:print(json.dumps({'status':'gpu_surrogate_failed_closed','error':str(error)[:4096]}),file=sys.stderr)
        sys.exit(1)
