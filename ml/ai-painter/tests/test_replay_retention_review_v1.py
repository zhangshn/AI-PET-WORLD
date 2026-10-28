"""CPU fixtures only: no model, checkpoint deserialization, optimizer or CUDA."""
import copy, math, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).absolute().parents[1] / 'scripts'))
from painter_replay_retention_review_v1 import (
    TARGET, validate_members, validate_lease, validate_review_checkpoint_metadata as validate_checkpoint_metadata,
    validate_histories, validate_metric_numbers, tensor_state_hash, encode_json,
    publish_input_manifests, MAX_JSON_BYTES,
    historical_source_bindings, read_historical_source, validate_loaded_source,
    HISTORICAL_SOURCE_BASELINE, read_dynamic_json, read_review_control,
)


def members():
    return [TARGET] + [f'train-{n}' for n in range(47)], [f'dev-{n}' for n in range(8)]


def histories():
    train, valid = members()
    base = [dict(arm='candidate', sampleId=sid, split='train' if n < 48 else 'validation', identity={'sampleId':sid,'conditionSha':'bound'}, metrics={'fullRgbMae':.1}, prediction={'path':sid+'.png','sha256':'a'*64}) for n,sid in enumerate(train+valid)]
    a = [dict(sampleId=r['sampleId'], split=r['split'], identity=copy.deepcopy(r['identity']), beforeMetrics=copy.deepcopy(r['metrics']), beforePrediction=copy.deepcopy(r['prediction'])) for r in base]
    calls = dict(generatorForwards=112,criticForwards=0,optimizerAttempts=0,autogradAttempts=0,cudaAttempts=0)
    return dict(rows=base,actualCalls=calls,stateProofs=[dict(arm='candidate',before=['g','d'],after=['g','d'])]), dict(rows=a,actualCalls={**calls,'generatorForwards':56},stateBefore=['ag','ad'],stateAfter=['ag','ad'])


class MemberAndHistoryTests(unittest.TestCase):
    def test_only_ordered_48train_and_eight_development_validation(self):
        train, dev = members(); validate_members(train, dev)
        for t,v in [(train[:-1],dev),(train,[*dev[:-1],train[0]]),([train[0]]*48,dev),([f'other-{i}' for i in range(48)],dev)]:
            with self.assertRaises(ValueError): validate_members(t,v)

    def test_actual_historical_call_counts_states_and_sample_identity(self):
        train, dev = members(); parent, a = histories()
        self.assertEqual(len(validate_histories(parent,a,train,dev)),56)
        changes = [lambda p,a:p['rows'].reverse(), lambda p,a:a['rows'].pop(), lambda p,a:p['stateProofs'][0]['after'].__setitem__(0,'changed'), lambda p,a:a['stateAfter'].__setitem__(0,'changed'), lambda p,a:a['actualCalls'].__setitem__('optimizerAttempts',1), lambda p,a:a['rows'][0]['identity'].__setitem__('conditionSha','other'), lambda p,a:a['rows'][0]['beforeMetrics'].__setitem__('fullRgbMae',.2), lambda p,a:a['rows'][0]['beforePrediction'].__setitem__('sha256','b'*64)]
        for change in changes:
            p,b=copy.deepcopy((parent,a));change(p,b)
            with self.assertRaises(ValueError):validate_histories(p,b,train,dev)


class LeaseTests(unittest.TestCase):
    def setUp(self):
        self.lease=dict(reviewId='review',controllerPid=10,launcherPid=11,controllerStartIdentity='10:created',registryRevision=42)
        self.registry=dict(runId='review',registryRevision=42,activeExecution=dict(processId=10,processStartIdentity='10:created'))
        self.heartbeat=dict(runId='review',processStartIdentity='10:created',heartbeatAtUtc='2026-10-27T05:00:00+00:00')
        self.now=1793077201  # overridden from the actual ISO timestamp below
        from datetime import datetime
        self.now=datetime.fromisoformat(self.heartbeat['heartbeatAtUtc']).timestamp()+1

    def test_exact_controller_or_venv_redirector(self):
        for parent in (10,11):validate_lease(self.lease,self.registry,self.heartbeat,'review',parent,self.now)
        with self.assertRaises(ValueError):validate_lease(self.lease,self.registry,self.heartbeat,'review',12,self.now)

    def test_pid_reuse_wrong_run_revision_stale_or_future_heartbeat(self):
        for key,value in [('runId','other'),('registryRevision',43),('activeExecution',dict(processId=10,processStartIdentity='10:reused'))]:
            r={**self.registry,key:value}
            with self.assertRaises(ValueError):validate_lease(self.lease,r,self.heartbeat,'review',11,self.now)
        for now in (self.now-2,self.now+120):
            with self.assertRaises(ValueError):validate_lease(self.lease,self.registry,self.heartbeat,'review',11,now)


class CheckpointTests(unittest.TestCase):
    def values(self,arm):
        pairs=100 if arm=='short' else 200;train,_=members()
        visits={sid:(100 if sid==TARGET else 3 if n<=6 else 2) for n,sid in enumerate(train)} if arm=='mixed' else {TARGET:100}
        source=dict(schemaVersion='replay-retention-fit-package-v1',arm=arm,modelCapability='bound-model',sourcePlan={'path':'plan','sha256':'a'*64},parentExperiment={'checkpoint':{'path':'parent','sha256':'b'*64}},training={'pairs':pairs},plannedSampleVisits=visits)
        if arm == 'balanced':
            import json
            training=json.loads((Path(__file__).absolute().parents[3]/'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json').read_bytes())['training']
            visits={sid:5 if n<8 else 4 for n,sid in enumerate(train)}
            source.update(policy={'path':'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json','sha256':'4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db'},training=training,selectedSampleIds=train,schedule=train*4+train[:8],plannedSampleVisits=visits)
        binding={'path':'package','sha256':'c'*64}
        state={k:copy.deepcopy(source[k]) for k in ('arm','modelCapability','sourcePlan','parentExperiment','training')}
        state.update(schema='replay-retention-fit-state-v1',packageSha256=binding['sha256'],counts={'generator':pairs,'discriminator':pairs},sampleVisits=visits,checkpointPromotable=False)
        result=dict(optimizerSteps=state['counts'],sampleVisits=visits,checkpointReloadExact=True)
        if arm == 'balanced':result.update(targetUpdates=5,replayUpdates=195)
        return binding,source,state,result

    def test_both_arms_exact_counts_visits_and_metadata(self):
        for arm in ('mixed','short','balanced'):
            binding,source,state,result=self.values(arm);validate_checkpoint_metadata(state,binding,source,result)
            for patch in ({'schema':'old-state'},{'packageSha256':'d'*64},{'counts':{'generator':0,'discriminator':0}},{'arm':'unknown'},{'modelCapability':'other'},{'sourcePlan':{}},{'parentExperiment':{}},{'training':{'pairs':1}},{'sampleVisits':{}},{'checkpointPromotable':True}):
                with self.assertRaises(ValueError):validate_checkpoint_metadata({**state,**patch},binding,source,result)
            with self.assertRaises(ValueError):validate_checkpoint_metadata(state,binding,source,{**result,'checkpointReloadExact':False})


class BalancedAndHistoryTests(unittest.TestCase):
    def test_boundary_checkpoint_rejects_old_objective_policy_or_training(self):
        from test_replay_retention_fit_v1 import package_metadata, checkpoint_metadata
        import painter_replay_retention_fit_v1 as fit
        source = package_metadata('balanced-boundary')
        binding = dict(path='synthetic-package.json', sha256='a'*64)
        state = checkpoint_metadata(source, binding)
        result = dict(optimizerSteps=state['counts'], sampleVisits=state['sampleVisits'],
                      checkpointReloadExact=True, trainingObjective=fit.BOUNDARY_OBJECTIVE,
                      targetUpdates=5, replayUpdates=195)
        validate_checkpoint_metadata(state, binding, source, result)
        for mutate in (lambda s:s['training'].__setitem__('boundaryRgbWeight', .02),
                       lambda s:s['policy'].__setitem__('sha256', '0'*64),
                       lambda s:s['selectedSampleIds'].reverse(), lambda s:s.__setitem__('arm', 'balanced')):
            changed = copy.deepcopy(source); mutate(changed)
            with self.assertRaises(ValueError): validate_checkpoint_metadata(state, binding, changed, result)
        with self.assertRaises(ValueError):
            validate_checkpoint_metadata(state, binding, source, {**result, 'trainingObjective':'old'})

    def test_balanced_rejects_changed_schedule_visits_policy_and_counts(self):
        binding,source,state,result=CheckpointTests().values('balanced')
        for mutate in (lambda s:s['schedule'].reverse(),lambda s:s['plannedSampleVisits'].__setitem__(TARGET,4),lambda s:s['training'].__setitem__('targetPairs',100),lambda s:s['policy'].__setitem__('sha256','0'*64),lambda s:s['selectedSampleIds'].reverse()):
            changed=copy.deepcopy(source);mutate(changed)
            with self.assertRaises(ValueError):validate_checkpoint_metadata(state,binding,changed,result)

    def test_archive_tampering_rejects_and_never_qualifies_current_source(self):
        import json,hashlib
        baseline=json.loads((Path(__file__).absolute().parents[3]/HISTORICAL_SOURCE_BASELINE['path']).read_bytes())
        mapped=historical_source_bindings(baseline);entry=baseline['entries'][0];reads={}
        original,archive=entry['original'],entry['archive']
        original_bytes=(Path(__file__).absolute().parents[3]/archive['path']).read_bytes()
        class Reader:
            changed=False
            def read(self,b):
                raw=b'tampered' if self.changed else original_bytes
                if hashlib.sha256(raw).hexdigest()!=b['sha256']:raise ValueError('SHA mismatch')
                return raw
        reader=Reader();self.assertEqual(read_historical_source(reader,original,mapped,reads),original_bytes)
        self.assertEqual(reads[(original['path'],original['sha256'])],entry)
        reader.changed=True
        with self.assertRaises(ValueError):read_historical_source(reader,original,mapped,{})
        # A sound old archive cannot satisfy the actual newly loaded source.
        with self.assertRaises(ValueError):validate_loaded_source({'path':original['path'],'sha256':'f'*64},{original['path']:original['sha256']})
        validate_loaded_source(original,{original['path']:original['sha256']})
        for mutate in (lambda b:b['entries'][0]['archive'].__setitem__('sha256','f'*64),lambda b:b['entries'][0]['archive'].__setitem__('path',original['path']),lambda b:b['entries'].append(b['entries'][0])):
            changed=copy.deepcopy(baseline);mutate(changed)
            with self.assertRaises(ValueError):historical_source_bindings(changed)

    def test_original_worker_uses_exact_recovery_helper_and_three_control_reads(self):
        import json
        from unittest.mock import patch
        import painter_replay_retention_review_recovery_v1 as recovery
        self.assertIs(read_dynamic_json,recovery.read_dynamic_json)
        lease=dict(reviewId='review',controllerPid=10,launcherPid=11,controllerStartIdentity='10:created',registryRevision=42)
        registry=dict(runId='review',registryRevision=42,activeExecution=dict(processId=10,processStartIdentity='10:created'))
        heartbeat=dict(runId='review',processStartIdentity='10:created',heartbeatAtUtc='2026-10-27T05:00:00+00:00')
        from datetime import datetime
        now=datetime.fromisoformat(heartbeat['heartbeatAtUtc']).timestamp()+1
        docs={'worker-lease.json':lease,'current.json':registry,'heartbeat.json':heartbeat}
        root=Path('/project');out=root/'.runtime/ai-painter/review';attempts={};audit=dict(reads=0,retries=0,events=[],overflow=False,maximumReadElapsedMs=0)
        class Clock:
            value=0
            def clock(self):return self.value
            def sleep(self,delay):self.value+=delay
        clock=Clock()
        def wrapped(file,**kwargs):
            def read():
                attempts[file.name]=attempts.get(file.name,0)+1
                if file.name=='heartbeat.json' and attempts[file.name]==1:raise PermissionError(13,'shared file')
                return json.dumps(docs[file.name]).encode()
            return recovery.read_dynamic_json(file,**kwargs,read_bytes=read,clock=clock.clock,sleep=clock.sleep)
        with patch('painter_replay_retention_review_v1.read_dynamic_json',wrapped):
            read_review_control(root,out,'review',11,audit,lambda:None,lambda pid:pid==10,lambda:now)
            self.assertEqual(attempts,{'worker-lease.json':1,'current.json':1,'heartbeat.json':2})
            self.assertEqual((audit['reads'],audit['readAttempts'],audit['retries']),(3,4,1))
            self.assertEqual(audit['events'][-1]['outcome'],'succeeded_after_retry')
            self.assertEqual(audit['events'][-1]['path'],'.runtime/ai-painter/review/heartbeat.json')
            docs['heartbeat.json']['runId']='wrong'
            with self.assertRaises(ValueError):read_review_control(root,out,'review',11,audit,lambda:None,lambda pid:True,lambda:now)
            self.assertEqual(audit['retries'],1)
            docs['heartbeat.json']['runId']='review'
            with self.assertRaises(ValueError):read_review_control(root,out,'review',11,audit,lambda:None,lambda pid:True,lambda:now+120)
            with self.assertRaisesRegex(RuntimeError,'deadline'):
                read_review_control(root,out,'review',11,audit,lambda:(_ for _ in ()).throw(RuntimeError('deadline')),lambda pid:True,lambda:now)


class MetricTests(unittest.TestCase):
    def test_legacy_and_metadata_aware_hashes_are_distinct_and_match_worker_algorithm(self):
        import hashlib, json, struct
        class Tensor:
            dtype='torch.float32'
            shape=(1,2)
            def detach(self):return self
            def cpu(self):return self
            def contiguous(self):return self
            def numpy(self):return self
            def tobytes(self):return struct.pack('<ff',.25,.5)
        class Model:
            def state_dict(self):return {'parameter':Tensor()}
        model=Model();raw=Tensor().tobytes()
        legacy=hashlib.sha256(b'parameter'+raw).hexdigest()
        named=hashlib.sha256(json.dumps(['parameter','torch.float32',[1,2]]).encode()+raw).hexdigest()
        self.assertEqual(tensor_state_hash(model),legacy)
        self.assertEqual(tensor_state_hash(model,True),named)
        self.assertNotEqual(legacy,named)

    def test_empty_and_constant_regions_have_explicit_na(self):
        for reason in ('empty_region','constant_reference_region','fewer_than_two_pixels'):
            validate_metric_numbers({'fullRgbMae':.1,'regions':{'core':{'tree':{'pixels':0 if reason=='empty_region' else 1,'rgbMae':None if reason=='empty_region' else .2,'correlation':None,'naReason':reason}}}})

    def test_nan_inf_and_unexplained_null_are_never_replaced_with_pass(self):
        for value in (math.nan,math.inf,None,True):
            with self.assertRaises(ValueError):validate_metric_numbers({'fullRgbMae':value,'regions':{}})
        for field in ('rgbMae','correlation'):
            region={'pixels':5,'rgbMae':.2,'correlation':.1,'naReason':None}
            for value in (math.nan,math.inf,None,True):
                with self.assertRaises(ValueError):validate_metric_numbers({'fullRgbMae':.1,'regions':{'core':{'tree':{**region,field:value}}}})


class ShardTests(unittest.TestCase):
    def test_actual_utf8_json_byte_limit_rejects_before_publication(self):
        import json
        raw=encode_json({'text':'汉字'});self.assertEqual(json.loads(raw),{'text':'汉字'})
        self.assertLess(len(raw),MAX_JSON_BYTES)
        for value in ({'text':'a'*MAX_JSON_BYTES},{'text':'汉'*(MAX_JSON_BYTES//2)},{'value':math.nan}):
            with self.assertRaises(ValueError):encode_json(value)

    def test_fixed_256_input_chunks_and_all_offsets_have_full_coverage(self):
        bindings=[{'path':f'input-{n}.json','sha256':'a'*64} for n in range(513)]
        saved=[]
        def publish(name,value):
            encode_json(value);saved.append((name,value));return {'path':name,'sha256':'b'*64}
        refs=publish_input_manifests(bindings,'review',{'path':'package','sha256':'c'*64},publish)
        self.assertEqual(len(refs),3)
        self.assertEqual([v['offset'] for _,v in saved],[0,256,512])
        self.assertEqual([len(v['bindings']) for _,v in saved],[256,256,1])
        self.assertEqual([b for _,v in saved for b in v['bindings']],bindings)
        with self.assertRaises(ValueError):publish_input_manifests(bindings+[bindings[0]],'review',{},publish)


if __name__=='__main__':unittest.main()
