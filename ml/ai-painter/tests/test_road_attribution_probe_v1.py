"""Pure metadata, in-memory control and tiny CPU fixtures; never real prepare/model."""
import ast
from contextlib import ExitStack
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT=Path(__file__).absolute().parents[3]
sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_road_attribution_probe_v1 as probe


def policy():return json.loads((ROOT/probe.POLICY).read_text(encoding='utf-8'))


def package_fixture():
    p=policy();sample_source=json.loads((ROOT/p['sourceCases']['path']).read_text(encoding='utf-8'))
    v=dict(schemaVersion=probe.SCHEMA,policy=dict(path=probe.POLICY,sha256=probe.POLICY_SHA),
        **{k:copy.deepcopy(p[k]) for k in ('contexts','cases','counts','resources','supportStructureWeight','boundaryMeasurement')},
        samples=sample_source['samples'],sourcePlan={'path':'synthetic-plan.json','sha256':'a'*64},
        inputs=[],programs=[],specification={'path':'synthetic-spec.md','sha256':'a'*64},
        trainingAllowed=False,formalQualificationGranted=False)
    run='road-attribution-v1-'+probe.digest(probe.canonical(v))[:20];v.update(experimentIdentity=run,outputRoot=probe.OUTPUT+run)
    return v


def metadata_fixture(role):
    p=policy();context=p['contexts'][role];pairs=448 if role=='parent077' else 200
    package={'experimentIdentity':'synthetic-'+role,'modelCapability':probe.CAPABILITY,
        'arm':'terrain-ecology' if role=='parent077' else 'balanced','training':{'targetPairs':5,'replayPairs':195},
        'selectedSampleIds':list(range(48)),'sourcePlan':{},'parentExperiment':{}}
    result={'experimentIdentity':package['experimentIdentity'],'status':'experiment_executed_not_visual_qualified',
        'checkpointReloadExact':True,'optimizerSteps':dict(generator=pairs,discriminator=pairs),
        'artifacts':[context['checkpoint']],'sampleVisits':{'selected':pairs}}
    terminal={'executionState':'completed','result':context['result'],'runId':package['experimentIdentity']}
    state={'schema':'mixed-train-rehearsal-state-v1' if role=='parent077' else 'replay-retention-fit-state-v1',
        'packageSha256':context['package']['sha256'],'checkpointPromotable':False,
        'counts':dict(generator=pairs,discriminator=pairs),'sampleVisits':result['sampleVisits'],
        **{k:copy.deepcopy(package[k]) for k in ('arm','modelCapability','sourcePlan','parentExperiment','training')}}
    return context,package,terminal,result,state


class MetadataTests(unittest.TestCase):
    def test_registered_policy_raw_and_content_hash(self):
        self.assertEqual(probe.binding(probe.POLICY)['sha256'],probe.POLICY_SHA);probe.validate_policy(policy())
    def test_policy_cannot_be_changed_even_self_consistently(self):
        p=policy()
        changes=[('resources','maxOutputMiB',8),('resources','maxWallSeconds',601),('counts','allAutogradGradCalls',73),
            ('boundaryMeasurement','bandPixels',24),('boundaryMeasurement','projectionWidth',256)]
        for group,key,value in changes:
            q=copy.deepcopy(p);q[group][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):probe.validate_policy(q)
        for key in ['trainingAllowed','formalQualificationGranted','runtimePublicationAllowed','lossChanged','gradientThresholdChanged']:
            q=copy.deepcopy(p);q[key]=True
            with self.subTest(key=key),self.assertRaises(ValueError):probe.validate_policy(q)
    def test_computed_package_identity_rejects_mutation(self):
        p=policy();pkg=package_fixture();probe.validate_package(pkg,p)
        for key,value in [('cases',[]),('counts',{}),('resources',{}),('contexts',{}),('trainingAllowed',True),
            ('formalQualificationGranted',True),('experimentIdentity','road-attribution-v1-'+'b'*20),('outputRoot','other')]:
            q=copy.deepcopy(pkg);q[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):probe.validate_package(q,p)
        q=copy.deepcopy(pkg);q['samples'][0]['identity']['split']='validation'
        with self.assertRaises(ValueError):probe.validate_package(q,p)
    def test_context_and_both_checkpoint_schemas_are_strict(self):
        for role in ['parent077','D093']:
            context,pkg,terminal,result,state=metadata_fixture(role)
            probe.validate_context(role,context,pkg,terminal,result);probe.validate_checkpoint(state,role,context,pkg,result)
            for field,value in [('schema','wrong'),('packageSha256','0'*64),('counts',{'generator':1,'discriminator':1}),
                ('sampleVisits',{}),('checkpointPromotable',True)]:
                q=copy.deepcopy(state);q[field]=value
                with self.subTest(role=role,field=field),self.assertRaises(ValueError):probe.validate_checkpoint(q,role,context,pkg,result)
            if role=='D093':
                for field in ['arm','modelCapability','sourcePlan','parentExperiment','training']:
                    q=copy.deepcopy(state);q[field]='foreign'
                    with self.subTest(field=field),self.assertRaises(ValueError):probe.validate_checkpoint(q,role,context,pkg,result)
    def test_context_failed_terminal_or_partial_updates_rejected(self):
        for role in ['parent077','D093']:
            context,pkg,terminal,result,state=metadata_fixture(role)
            for carrier,field,value in [('terminal','executionState','failed_closed'),('terminal','runId','foreign'),
                ('result','checkpointReloadExact',False),('result','artifacts',[]),('result','optimizerSteps',{'generator':0,'discriminator':0})]:
                t=copy.deepcopy(terminal);r=copy.deepcopy(result);{'terminal':t,'result':r}[carrier][field]=value
                with self.subTest(role=role,field=field),self.assertRaises(ValueError):probe.validate_context(role,context,pkg,t,r)
    def test_reader_hash_tamper_and_immutable_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary,patch.object(probe,'ROOT',Path(temporary)):
            b=probe.save('fixture.json',{'test':'synthetic'});reader=probe.Reader();self.assertEqual(reader.json(b),{'test':'synthetic'})
            with self.assertRaises(FileExistsError):probe.save('fixture.json',{})
            (Path(temporary)/'fixture.json').write_text('{}',encoding='utf-8')
            with self.assertRaises(ValueError):reader.json(b)
            with self.assertRaises(ValueError):reader.unchanged()
    def test_reader_snapshot_and_root_match_original_loader_protocol(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);(root/'fixture.bin').write_bytes(b'four')
            reader=probe.Reader(root);raw,bound=reader.snapshot('fixture.bin')
            self.assertEqual(reader.root,root);self.assertEqual(raw,b'four')
            self.assertEqual(bound,{'path':'fixture.bin','sha256':hashlib.sha256(b'four').hexdigest()})
            self.assertEqual(reader.observed,{'fixture.bin':bound['sha256']})
            self.assertEqual(reader.read(bound),raw);reader.unchanged()
            (root/'fixture.bin').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'previously observed'):reader.snapshot('fixture.bin')
            self.assertEqual(reader.observed['fixture.bin'],bound['sha256'])
            with self.assertRaises(ValueError):reader.unchanged()
    def test_snapshot_size_paths_and_sha_cannot_be_relaxed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);(root/'fixture.bin').write_bytes(b'four');reader=probe.Reader(root)
            for bad in ['../fixture.bin','/fixture.bin','x\\fixture.bin','F:/fixture.bin','latest/x']:
                with self.subTest(path=bad),self.assertRaises(ValueError):reader.snapshot(bad)
            with patch.object(probe,'MAX_INPUT_BYTES',3),self.assertRaisesRegex(ValueError,'size ceiling'):
                reader.snapshot('fixture.bin')
            self.assertEqual(reader.observed,{})
            for sha in ['x'*64,'A'*64,'0'*63,None]:
                with self.subTest(sha=sha),self.assertRaises(ValueError):reader.read({'path':'fixture.bin','sha256':sha})
    def test_declared_runtime_junction_and_external_escape(self):
        observations=[]
        def link(source,target):
            try:
                source.symlink_to(target,target_is_directory=True);observations.append({'kind':'symlink','created':True})
            except OSError as error:
                observations.append({'kind':'symlink','created':False,'winerror':getattr(error,'winerror',None)})
                if os.name!='nt':raise
                result=subprocess.run(['cmd','/c','mklink','/J',str(source),str(target)],capture_output=True,timeout=10)
                self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
                observations.append({'kind':'junction','created':True})
        with tempfile.TemporaryDirectory() as temporary:
            top=Path(temporary);root=top/'project';hot=top/'hot';outside=top/'outside'
            for p in [root,hot,outside]:p.mkdir()
            (hot/'fixture.bin').write_bytes(b'hot');(outside/'secret.bin').write_bytes(b'outside')
            link(root/'.runtime',hot);link(root/'escape',outside);link(hot/'escape',outside)
            reader=probe.Reader(root);raw,bound=reader.snapshot('.runtime/fixture.bin')
            self.assertEqual(raw,b'hot');reader.unchanged()
            for p in ['escape/secret.bin','.runtime/escape/secret.bin']:
                with self.subTest(path=p),self.assertRaisesRegex(ValueError,'escapes'):reader.snapshot(p)
        evidence=ROOT/'.runtime/ai-painter/controller-repair-reviews/road-attribution-094-20261027/training-implementation/junction-fixtures'
        evidence.mkdir(parents=True,exist_ok=True)
        with (evidence/(str(time.time_ns())+'.json')).open('x',encoding='utf-8') as stream:
            json.dump({'taskId':'ROAD-ATTRIBUTION-094','linkCreation':observations,'declaredRuntimeAccepted':True,'bothExternalEscapesRejected':True},stream)
    def test_path_aliases_cannot_escape_project(self):
        for value in ['../x','/x','x/../y','x//y','F:/x','x\\y','latest/x','x/latest.json','']:
            with self.subTest(path=value),self.assertRaises(ValueError):probe.logical(value)
    def test_complete_counts_distinguish_attempts_and_completed(self):
        expected={'generatorForwards':1,'generatorForwardCompleted':1,'criticForwards':3,'criticForwardCompleted':3,
            'originalGeneratorVjpAttempted':5,'originalGeneratorVjps':5,'diagnosticGeneratorVjpAttempted':3,'diagnosticGeneratorVjps':3,
            'discriminatorVjpAttempted':1,'discriminatorVjps':1,'autogradAttempted':9,'allAutogradGradCalls':9}
        probe.exact_case_counts(expected)
        for key in expected:
            q=dict(expected);q[key]-=1
            with self.subTest(key=key),self.assertRaises(ValueError):probe.exact_case_counts(q)
    def test_probe_cannot_inherit_unknown_model_rng_or_optimizer_status(self):
        value={'passed':True,'modelCapabilityVersion':probe.CAPABILITY,'cudaRngChecked':True,'optimizerCreated':False,
            'optimizerUpdates':0,'callCounts':{'generatorForwards':1,'generatorForwardCompleted':1,'generatorAutograd':5,'discriminatorAutograd':1}}
        probe.validate_probe_proof(value)
        for key,bad in [('passed',False),('modelCapabilityVersion','foreign'),('cudaRngChecked',False),
            ('optimizerCreated',True),('optimizerUpdates',True),('optimizerUpdates',1),('callCounts',{})]:
            with self.subTest(key=key),self.assertRaises(ValueError):probe.validate_probe_proof({**value,key:bad})
    def test_metadata_prepare_has_no_model_runtime_import(self):
        code="import sys;sys.path.insert(0,'ml/ai-painter/scripts');import painter_road_attribution_probe_v1;assert 'torch' not in sys.modules;assert 'painter_replay_retention_review_v1' not in sys.modules"
        result=subprocess.run([sys.executable,'-B','-c',code],cwd=ROOT,capture_output=True,timeout=20)
        self.assertEqual(result.returncode,0,result.stderr.decode())
        tree=ast.parse(Path(probe.__file__).read_text(encoding='utf-8'))
        prepare=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='prepare')
        self.assertFalse(any(isinstance(x,(ast.Import,ast.ImportFrom)) for x in ast.walk(prepare)))
    def test_gpu_worker_does_not_import_cpu_review_or_create_optimizer(self):
        tree=ast.parse(Path(probe.__file__).read_text(encoding='utf-8'))
        names=[a.name for x in ast.walk(tree) if isinstance(x,(ast.Import,ast.ImportFrom)) for a in x.names]
        self.assertNotIn('painter_replay_retention_review_v1',names);self.assertNotIn('painter_replay_retention_review_recovery_v1',names)
        for x in ast.walk(tree):
            if isinstance(x,ast.Call) and isinstance(x.func,ast.Attribute):
                self.assertNotIn(x.func.attr,['AdamW','backward','step','zero_grad'])
    def test_original_secondary_errors_bounded_without_raw_gradient_serialization(self):
        error=RuntimeError('primary sentinel');error.secondary_hook_cleanup_error='hook'*3000
        error.secondary_failure_evidence_error='capture';error.road_secondary_errors=['road']
        error.secondary_probe_errors=['probe'];error.object_support_gradient_evidence={'rawGradients':[object()]}
        result=probe.secondary_error_evidence(error,{'secondaryProbeErrors':['old-probe']})
        self.assertEqual(str(error),'primary sentinel');self.assertLessEqual(len(result['secondary_hook_cleanup_error']),4096)
        self.assertEqual(result['secondary_failure_evidence_error'],'capture');self.assertEqual(result['secondaryProbeErrors'],['old-probe'])
        self.assertNotIn('rawGradients',json.dumps(result));self.assertNotIn('object_support_gradient_evidence',result)
        self.assertEqual(probe.safe_probe_failure({'callCounts':{'generator':1},'rawGradients':[object()]}),{'callCounts':{'generator':1}})


class MemoryPath:
    def __init__(self,h,path=''):self.h,self.path=h,path
    def __truediv__(self,p):return MemoryPath(self.h,self.path+('/' if self.path else '')+str(p))
    def __str__(self):return 'memory/'+self.path
    def read_bytes(self):return self.h.files[self.path]
    def rglob(self,pattern):return [MemoryPath(self.h,p) for p in self.h.files if p.startswith(self.path+'/')]
    def is_file(self):return True
    def stat(self):return SimpleNamespace(st_size=len(self.read_bytes()))


class ControlHarness:
    def __init__(self,fail_at=None):
        import numpy as np
        import torch
        from PIL import Image
        self.np,self.torch=np,torch;self.fail_at=fail_at;self.files={};self.current=0;self.factories=0
        self.p=policy();self.pkg=package_fixture();self.contexts={}
        for role in ['parent077','D093']:
            context,pkg,terminal,result,state=metadata_fixture(role)
            result.update(parentStateHashes={'generator':'parent077:G','discriminator':'parent077:D'},
                finalStateHashes={'generator':'D093:G','discriminator':'D093:D'})
            self.contexts[role]={'package':pkg,'terminal':terminal,'result':result}
        self.pkg['programs']=[self.store(probe.LIB,b'synthetic library bytes')]
        self.pkg['specification']=self.store('synthetic-spec.md',b'synthetic formal binding')
        body={k:v for k,v in self.pkg.items() if k not in ['experimentIdentity','outputRoot']}
        run='road-attribution-v1-'+probe.digest(probe.canonical(body))[:20];self.pkg.update(experimentIdentity=run,outputRoot=probe.OUTPUT+run)
        self.bound=self.store(self.pkg['outputRoot']+'/package.json',self.pkg)
        self.files[probe.POLICY]=(ROOT/probe.POLICY).read_bytes()
        registry=json.dumps({'runId':run,'activeExecution':{'synthetic':True}}).encode()
        self.files['.runtime/ai-painter/current-execution-registry/current.json']=registry
        self.store(self.pkg['outputRoot']+'/controller-lease.json',{'registrySha256':probe.digest(registry),'workerParentPid':1})
        self.store(self.pkg['outputRoot']+'/heartbeat.json',{'heartbeatAtUtc':probe.now()})
        buf=io.BytesIO();Image.new('RGB',(1024,768),(120,140,150)).save(buf,format='PNG');rgb=buf.getvalue()
        buf=io.BytesIO();Image.new('L',(1024,768),255).save(buf,format='PNG');road=buf.getvalue()
        for s in self.pkg['samples']:
            self.files[s['identity']['image']['path']]=rgb
            channel=next(x for x in s['identity']['channels'] if x['id']=='terrain_path_ground');self.files[channel['path']]=road
    def store(self,p,value):
        if p in self.files:raise AssertionError('in-memory evidence overwrite')
        self.files[p]=value if isinstance(value,bytes) else json.dumps(value).encode()
        return {'path':p,'sha256':probe.digest(self.files[p])}
    def read(self,b):
        for role,c in self.p['contexts'].items():
            if b==c['checkpoint']:return role.encode()
        return self.files[b['path']]
    def run(self):
        from ai_painter.complete_world import road_attribution_observation_v1 as observer
        h=self
        class Network:
            def __init__(self,name):self.name=name;self.role=None
            def load_state_dict(self,value,strict):assert strict;self.role=value['role']
            def to(self,device):return self
            def eval(self):return self
        class Tensor:
            def __init__(self,a):self.a=a
            def permute(self,*dims):return Tensor(self.a.transpose(dims))
            def float(self):return self
            def to(self,*args):return self
            def __getitem__(self,key):return Tensor(self.a[key])
            def __truediv__(self,n):return self
        class Observation:
            def __init__(self,*args):
                h.current+=1;self.counts={'generatorForwards':1,'generatorForwardCompleted':1,'criticForwards':3,'criticForwardCompleted':3,
                    'originalGeneratorVjpAttempted':5,'originalGeneratorVjps':5,'diagnosticGeneratorVjpAttempted':3,'diagnosticGeneratorVjps':3,
                    'discriminatorVjpAttempted':1,'discriminatorVjps':1,'autogradAttempted':9,'allAutogradGradCalls':9}
                self.quantized=h.torch.zeros((1,3,192,256),dtype=h.torch.uint8)
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def event(self,*args):pass
            def summary(self):return {'counts':dict(self.counts),'stateUnchanged':True,'cleanupVerified':True}
        def load(stream,**kwargs):
            assert kwargs=={'map_location':'cpu','weights_only':True}
            role=stream.read().decode();state=metadata_fixture(role)[-1];state.update(model={'role':role},critic={'role':role});return state
        def fresh(order):h.factories+=1;return Network('G'),Network('D')
        def zero(*args,**kwargs):
            if h.current==h.fail_at:raise RuntimeError('synthetic original gate failure')
            return {'passed':True,'modelCapabilityVersion':probe.CAPABILITY,'cudaRngChecked':True,'optimizerCreated':False,'optimizerUpdates':0,
                'callCounts':{'generatorForwards':1,'generatorForwardCompleted':1,'generatorAutograd':5,'discriminatorAutograd':1},'fiveGradientFacts':{'syntheticOnly':True}}
        fake_torch=SimpleNamespace(manual_seed=lambda n:None,from_numpy=Tensor,load=load,
            cuda=SimpleNamespace(is_available=lambda:True,set_per_process_memory_fraction=lambda n:None,
                set_device=lambda n:None,manual_seed=lambda n:None,empty_cache=lambda:None))
        profile=SimpleNamespace(fresh_networks=fresh,background=None,zero_update_probe=zero)
        api=(fake_torch,self.np,SimpleNamespace(disk_usage=lambda p:SimpleNamespace(free=4*1024**3),pid_exists=lambda p:True),
            None,profile,None,None,None,None,None,None)
        fake_replay=SimpleNamespace(imports=lambda:api,state_hash=lambda m:m.role+':'+m.name)
        fake_controller=SimpleNamespace(verify_controller_process=lambda *args:None)
        class Reader:
            def __init__(self):self.observed={}
            def read(self,b):return h.read(b)
            def json(self,b):return json.loads(self.read(b))
            def unchanged(self):pass
        def command(args,**kwargs):
            if args[0]=='nvidia-smi':return SimpleNamespace(stdout='synthetic-device,40,4096')
            assert args[:3]==['node',probe.LIB,'audit-case']
            request=json.loads(h.files[args[3]]);n=request['case']['caseIndex'];prefix=h.pkg['outputRoot']+f'/case-{n:02}'
            projected=h.store(prefix+'-projection.png',b'synthetic projected bytes')
            b=h.store(prefix+'-audit.json',{'case':request['case'],'quantizedProjectionPixelsEqual':True,'projection':projected})
            return SimpleNamespace(stdout=json.dumps(b),stderr='')
        with ExitStack() as stack:
            for name,value in {'ROOT':MemoryPath(h),'Reader':Reader,'save':h.store,
                'binding':lambda p:{'path':p,'sha256':probe.digest(h.files[p])},
                'metadata':lambda *args:(h.contexts,h.pkg['samples'],{}, {'identityPayload':{'channelOrder':[],'continuousChannelIds':[]}},
                    {'samples':[{'sampleId':s['sampleId']} for s in h.pkg['samples']]}),
                'project_sources':lambda p:h.pkg['programs'], 'load_sample':lambda *args:({}, {'season':'wet'})}.items():
                stack.enter_context(patch.object(probe,name,value))
            stack.enter_context(patch.object(observer,'RoadObservation',Observation))
            stack.enter_context(patch.dict(sys.modules,{'painter_replay_retention_fit_v1':fake_replay,'painter_learning_capacity_experiment':fake_controller}))
            stack.enter_context(patch.object(probe.subprocess,'run',command))
            probe.execute(h.bound)
    def result(self):return json.loads(self.files[self.pkg['outputRoot']+'/result.json'])


class ControlFlowTests(unittest.TestCase):
    def test_real_execute_eight_case_order_and_actual_total_72_with_synthetic_adapters(self):
        h=ControlHarness();h.run();r=h.result()
        self.assertEqual(r['status'],'road_attribution_completed_not_qualified');self.assertEqual(h.factories,2)
        self.assertEqual([x['case'] for x in r['cases']],h.p['cases'])
        self.assertEqual(r['counts'],{k:v*8 for k,v in probe.PER_CASE.items()})
        self.assertEqual(r['optimizerSteps'],{'generator':0,'discriminator':0});self.assertFalse(r['trainingStarted'])
        self.assertEqual(len([x for x in h.files if x.endswith('-native.png')]),8)
    def test_original_failure_stops_and_preserves_real_completed_prefix(self):
        h=ControlHarness(fail_at=3)
        with self.assertRaisesRegex(RuntimeError,'synthetic original gate failure'):h.run()
        r=h.result();self.assertEqual(r['status'],'road_attribution_failed_closed')
        self.assertEqual(len(r['cases']),2);self.assertEqual(r['activeCase']['caseIndex'],3)
        self.assertIn('failure',r['error']);self.assertFalse(r['trainingStarted'])
        self.assertEqual(h.current,3)


if __name__=='__main__':unittest.main()
