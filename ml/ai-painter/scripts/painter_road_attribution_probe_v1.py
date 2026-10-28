"""094 metadata-only prepare and managed eight-case zero-update diagnostic."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
for _path in ('ml/ai-painter/scripts', 'ml/ai-painter/src'):
    sys.path.insert(0, str(ROOT / _path))
from ai_painter.complete_world.split_release import project_file
POLICY = 'data/ai-painter/system-governance/ai-painter-road-attribution-probe-policy-v1.json'
POLICY_SHA = '2c1d57de45e47f18ba99e0236ff3a05d343d5f646eddb258d6ee357fd5ae634d'
POLICY_CONTENT_SHA = '63e2c48fbe8dcc2723279a04ac05b33d00a2aa9e7d8e0e6cc81fa130e17ca08d'
SELF = 'ml/ai-painter/scripts/painter_road_attribution_probe_v1.py'
OBSERVER = 'ml/ai-painter/src/ai_painter/complete_world/road_attribution_observation_v1.py'
LIB = 'scripts/lib/ai-painter-road-attribution-probe-v1.mjs'
OWN = (SELF, OBSERVER, LIB, 'ml/ai-painter/tests/test_road_attribution_probe_v1.py',
       'ml/ai-painter/tests/test_road_attribution_observation_v1.py', 'scripts/tests/test-ai-painter-road-attribution-probe.mjs')
OUTPUT = '.runtime/ai-painter/learning-capacity-experiments/'
SCHEMA = 'road-attribution-zero-update-package-v1'
CAPABILITY = 'stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
PER_CASE = dict(generatorForwards=1, criticForwards=3, originalGeneratorVjps=5, diagnosticGeneratorVjps=3,
                discriminatorVjps=1, allAutogradGradCalls=9)
MAX_INPUT_BYTES = 64*1024**2


def require(value, message):
    if not value:
        raise ValueError(message)


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def logical(value):
    require(type(value) is str and value and len(value)<=4096 and '\\' not in value and ':' not in value
            and all(ord(c)>=32 and ord(c)!=127 for c in value)
            and all(part and part not in ('.', '..', 'latest', 'latest.json') for part in value.split('/')),
            'bounded project logical path required')
    return value


def binding(path):
    return dict(path=logical(path), sha256=digest((ROOT / path).read_bytes()))


class Reader:
    def __init__(self, root=None):
        self.root = ROOT if root is None else Path(root)
        self.observed = {}

    def _raw(self, path):
        logical(path)
        target=project_file(self.root,path)
        require(target.is_file(), 'input not a file')
        require(target.stat().st_size<=MAX_INPUT_BYTES, 'input size ceiling')
        raw=target.read_bytes();require(len(raw)<=MAX_INPUT_BYTES, 'input size ceiling')
        return raw

    def _observe(self, path, sha):
        require(path not in self.observed or self.observed[path]==sha, 'previously observed input changed: '+path)
        self.observed[path]=sha

    def read(self, bound):
        require(type(bound) is dict and type(bound.get('sha256')) is str
                and len(bound['sha256'])==64 and all(c in '0123456789abcdef' for c in bound['sha256']), 'input binding')
        path = logical(bound['path'])
        raw = self._raw(path)
        require(digest(raw) == bound['sha256'], 'input SHA/size differs: '+path)
        self._observe(path,bound['sha256'])
        return raw

    def snapshot(self, path):
        raw=self._raw(logical(path));bound=dict(path=path,sha256=digest(raw))
        self._observe(path,bound['sha256'])
        return raw,bound

    def json(self, bound):
        value = json.loads(self.read(bound))
        require(type(value) is dict, 'bound JSON object required')
        return value

    def unchanged(self):
        for path,sha in list(self.observed.items()):
            self.read(dict(path=path,sha256=sha))


def save(path, value):
    raw = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False).encode()
    target = ROOT / logical(path); target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    return binding(path)


def validate_policy(policy):
    require(digest(canonical(policy)) == POLICY_CONTENT_SHA, 'exact registered094 policy content required')


def validate_context(role, context, package, terminal, result):
    require(terminal['executionState'] == 'completed' and terminal['result'] == context['result'], 'completed context terminal')
    require(terminal['runId'] == package['experimentIdentity'] == result['experimentIdentity'], 'context run identity')
    require(package['modelCapability'] == CAPABILITY and result['checkpointReloadExact'] is True
            and context['checkpoint'] in result['artifacts'], 'context checkpoint provenance')
    pairs = 448 if role == 'parent077' else 200
    require(result['status'] == 'experiment_executed_not_visual_qualified'
            and result['optimizerSteps'] == dict(generator=pairs, discriminator=pairs), 'context actual updates')
    if role == 'parent077':
        require(package['arm'] == 'terrain-ecology', 'parent ecology architecture')
    else:
        require(package['arm'] == 'balanced' and package['training']['targetPairs'] == 5
                and package['training']['replayPairs'] == 195 and len(package['selectedSampleIds']) == 48,
                'D balanced provenance')


def validate_checkpoint(value, role, context, package, result):
    require(value['packageSha256'] == context['package']['sha256'] and value['checkpointPromotable'] is False,
            'strict checkpoint package identity')
    pairs = 448 if role == 'parent077' else 200
    require(value['counts'] == dict(generator=pairs, discriminator=pairs), 'checkpoint complete counts')
    require(value['sampleVisits'] == result['sampleVisits'], 'checkpoint actual sample visits')
    if role == 'parent077':
        require(value['schema'] == 'mixed-train-rehearsal-state-v1', 'parent checkpoint schema')
    else:
        require(value['schema'] == 'replay-retention-fit-state-v1', 'D checkpoint schema')
        for key in ('arm', 'modelCapability', 'sourcePlan', 'parentExperiment', 'training'):
            require(value[key] == package[key], 'D checkpoint metadata: '+key)


def _bindings_in(value):
    if isinstance(value, dict):
        if isinstance(value.get('path'), str) and isinstance(value.get('sha256'), str):
            yield dict(path=value['path'], sha256=value['sha256'])
        else:
            for child in value.values():
                yield from _bindings_in(child)
    elif isinstance(value, list):
        for child in value:
            yield from _bindings_in(child)


def metadata(reader, policy):
    contexts = {}
    for role, context in policy['contexts'].items():
        package, terminal, result = (reader.json(context[k]) for k in ('package', 'terminal', 'result'))
        validate_context(role, context, package, terminal, result)
        contexts[role] = dict(package=package, terminal=terminal, result=result)
    source = reader.json(policy['sourceCases']); samples = source['samples']
    require([x['slot'] for x in samples] == [146,147,164,192] and source['cases'] == policy['cases'], 'fixed8 cases')
    dpackage = contexts['D093']['package']
    for sample in samples:
        identity = sample['identity']
        require(identity['split'] == 'train' and identity['sampleId'] == sample['sampleId'], 'four train sources only')
        require(identity == next(x for x in dpackage['sampleIdentities'] if x['sampleId'] == sample['sampleId']), 'D original sample identity')
        for bound in _bindings_in(identity):
            reader.read(bound)
    history = reader.json(policy['historicalSourceBaseline'])
    lookup = {}
    for entry in history['entries']:
        require(entry['original']['sha256'] == entry['archive']['sha256'], 'archive original SHA mismatch')
        require('FULL_DICTIONARY_PRINT.md' not in entry['original']['path'], 'full dictionary excluded')
        reader.read(entry['archive']); lookup[(entry['original']['path'], entry['original']['sha256'])] = entry['archive']
    require(all((b['path'], b['sha256']) in lookup for b in dpackage['programs']), 'complete D182 source archive required')
    plan = reader.json(dpackage['sourcePlan']); manifest = reader.json(plan['datasetManifest'])
    index = reader.json(manifest['sourceIndex'])
    for sample in samples:
        row = next(x for x in index['samples'] if x['sampleId'] == sample['sampleId'])
        require(row['split'] == 'train', 'source index train isolation')
    return contexts, samples, plan, manifest, index


def project_sources(dpackage):
    paths = {b['path'] for b in dpackage['programs']} | set(OWN)
    paths.add('scripts/run-ai-painter-learning-capacity-experiment.mjs')
    for module in tuple(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if filename:
            path = Path(filename).absolute()
            if path.is_relative_to(ROOT/'ml/ai-painter') and not path.is_relative_to(ROOT/'ml/ai-painter/.venv'):
                paths.add(path.relative_to(ROOT).as_posix())
    require(len(paths) <= 256 and all((ROOT/p).stat().st_size <= 1048576 for p in paths), 'program source ceiling')
    return [binding(path) for path in sorted(paths)]


def validate_package(package, policy):
    validate_policy(policy)
    require(package['schemaVersion'] == SCHEMA and package['policy'] == dict(path=POLICY,sha256=POLICY_SHA), 'registered package route')
    for key in ('contexts','cases','counts','resources','supportStructureWeight','boundaryMeasurement'):
        require(package[key] == policy[key], 'frozen diagnostic scope: '+key)
    require(package['trainingAllowed'] is False and package['formalQualificationGranted'] is False, 'diagnostic qualification boundary')
    identity = {k:v for k,v in package.items() if k not in ('experimentIdentity','outputRoot')}
    expected = 'road-attribution-v1-'+digest(canonical(identity))[:20]
    require(package['experimentIdentity'] == expected and package['outputRoot'] == OUTPUT+expected, 'computed package identity')


def prepare(path):
    started = time.monotonic()
    require(path == POLICY and binding(path) == dict(path=POLICY,sha256=POLICY_SHA), 'exact registered policy bytes')
    reader = Reader(); policy = reader.json(dict(path=POLICY,sha256=POLICY_SHA)); validate_policy(policy)
    contexts, samples, plan, manifest, index = metadata(reader,policy)
    package = dict(schemaVersion=SCHEMA, policy=dict(path=POLICY,sha256=POLICY_SHA),
        **{key:policy[key] for key in ('contexts','cases','counts','resources','supportStructureWeight','boundaryMeasurement')},
        samples=samples, sourcePlan=contexts['D093']['package']['sourcePlan'],
        inputs=[dict(path=p,sha256=s) for p,s in sorted(reader.observed.items())],
        programs=project_sources(contexts['D093']['package']),
        specification=binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),
        trainingAllowed=False, formalQualificationGranted=False)
    run = 'road-attribution-v1-'+digest(canonical(package))[:20]
    package.update(experimentIdentity=run,outputRoot=OUTPUT+run)
    validate_package(package,policy); reader.unchanged()
    require(time.monotonic()-started < 300 and 'torch' not in sys.modules, 'metadata-only prepare boundary')
    target = package['outputRoot']+'/package.json'
    if (ROOT/target).exists():
        require(reader.json(binding(target)) == package,'immutable package differs'); return binding(target)
    return save(target,package)


def load_sample(reader, row, expected, order, continuous, api):
    torch,np,psutil,auth,profile,worker,cpu,derive,*_ = api
    if 'sourceCorrection' in row:
        correction = reader.json(row['sourceCorrection']); parent = reader.json(correction['parentDataset'])
        old = next(x for x in reader.json(parent['sourceIndex'])['samples'] if x['sampleId'] == row['parentSampleId'])
        require(old['split'] == 'train', 'corrected parent train')
        _, identity = cpu.load_sample(reader,old,order,continuous); identity.update(sampleId=row['sampleId'],image=row['image'])
        sample, identity = auth.load_corrected_sample(reader,row,order,continuous,identity,cpu)
    else:
        sample, identity = cpu.load_sample(reader,row,order,continuous)
    require(identity == expected, 'actual loaded sample identity differs')
    regime, _, facts = derive(reader,identity)
    return profile.bind_sample_ecology(reader,sample,identity,regime), facts


def exact_case_counts(counts):
    for key, value in PER_CASE.items():
        require(counts[key] == value, 'actual per-case call budget: '+key)
    for attempted, completed in (('generatorForwards','generatorForwardCompleted'),('criticForwards','criticForwardCompleted'),
        ('originalGeneratorVjpAttempted','originalGeneratorVjps'),('diagnosticGeneratorVjpAttempted','diagnosticGeneratorVjps'),
        ('discriminatorVjpAttempted','discriminatorVjps'),('autogradAttempted','allAutogradGradCalls')):
        require(counts[attempted] == counts[completed], 'incomplete attempted call')


def validate_probe_proof(proof):
    require(proof.get('passed') is True and proof.get('modelCapabilityVersion')==CAPABILITY
            and proof.get('cudaRngChecked') is True,'own original CUDA/model admission')
    require(proof.get('optimizerCreated') is False and type(proof.get('optimizerUpdates')) is int
            and proof['optimizerUpdates']==0,'own zero-optimizer admission')
    require(proof.get('callCounts')==dict(generatorForwards=1,generatorForwardCompleted=1,generatorAutograd=5,discriminatorAutograd=1),
            'original probe counts')


def secondary_error_evidence(error, failure):
    result={}
    for name in ('road_secondary_errors','secondary_hook_cleanup_error','secondary_failure_evidence_error','secondary_probe_errors'):
        value=getattr(error,name,None)
        if value is not None:
            result[name]=([str(x)[:2048] for x in value[:8]] if isinstance(value,(list,tuple)) else str(value)[:4096])
    if isinstance(failure,dict) and failure.get('secondaryProbeErrors') is not None:
        value=failure['secondaryProbeErrors']
        result['secondaryProbeErrors']=([str(x)[:2048] for x in value[:8]] if isinstance(value,(list,tuple)) else str(value)[:4096])
    return result


def safe_probe_failure(failure):
    if not isinstance(failure,dict):return {}
    allowed=('originalError','callCounts','completedGradientLabels','gradientSetsAvailable','rawGradientSummaries','secondaryProbeErrors')
    result={key:failure[key] for key in allowed if key in failure}
    if 'secondaryProbeErrors' in result:
        value=result['secondaryProbeErrors']
        result['secondaryProbeErrors']=([str(x)[:2048] for x in value[:8]] if isinstance(value,(list,tuple)) else str(value)[:4096])
    return result


def execute(bound):
    started = time.monotonic(); reader = Reader(); package = reader.json(bound)
    policy = reader.json(package['policy']); validate_package(package,policy)
    out = package['outputRoot']; require(bound['path'] == out+'/package.json','exact package path')
    for b in package['inputs']+package['programs']+[package['specification']]: reader.read(b)
    # No CPU review/recovery import: those workers change CUDA_VISIBLE_DEVICES.
    import painter_replay_retention_fit_v1 as replay
    api = replay.imports(); torch,np,psutil,auth,profile,worker,cpu,derive,*_ = api
    from ai_painter.complete_world.road_attribution_observation_v1 import RoadObservation
    from painter_learning_capacity_experiment import verify_controller_process
    from PIL import Image
    lease = reader.json(binding(out+'/controller-lease.json'))
    registry_path = '.runtime/ai-painter/current-execution-registry/current.json'
    registry_raw = (ROOT/registry_path).read_bytes()
    require(digest(registry_raw) == lease['registrySha256'],'registry lease binding')
    verify_controller_process(lease,json.loads(registry_raw),os.getppid())
    artifacts, cases, gpu = [], [], False
    phase, active, observation = 'loading', None, None
    last_poll, device_id = 0, None
    def put(name,value,failure=False):
        raw = value if isinstance(value,bytes) else json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False).encode()
        used = sum(p.stat().st_size for p in (ROOT/out).rglob('*') if p.is_file())
        require(used+len(raw)+(0 if failure else 65536) <=128*1024**2,'diagnostic output and terminal reserve')
        b=save(out+'/'+name,raw);artifacts.append(b);return b
    def guard():
        nonlocal last_poll,device_id
        require(time.monotonic()-started<600,'shared600s diagnostic deadline')
        require(psutil.disk_usage(str(ROOT/out)).free>=2048*1024**2 and psutil.pid_exists(lease['workerParentPid']),'resource/controller missing')
        live=json.loads((ROOT/registry_path).read_bytes())
        require(live['runId']==package['experimentIdentity'] and live['activeExecution'] is not None,'active run differs')
        heartbeat=json.loads((ROOT/out/'heartbeat.json').read_bytes())
        age=time.time()-datetime.fromisoformat(heartbeat['heartbeatAtUtc'].replace('Z','+00:00')).timestamp()
        require(0<=age<120,'heartbeat stale/future')
        if time.monotonic()-last_poll>3:
            fields=subprocess.run(['nvidia-smi','--query-gpu=uuid,temperature.gpu,memory.free','--format=csv,noheader,nounits','-i','0'],
                capture_output=True,text=True,check=True,timeout=10).stdout.strip().split(',')
            require(len(fields)==3 and float(fields[1])<85 and float(fields[2])>=2048,'GPU resource boundary')
            require(device_id is None or device_id==fields[0].strip(),'GPU identity changed')
            device_id=fields[0].strip();last_poll=time.monotonic()
    try:
        contexts,sources,plan,manifest,index=metadata(reader,policy)
        require(sources==package['samples'],'prepared sample sources changed')
        current=project_sources(contexts['D093']['package'])
        require(all(b in package['programs'] for b in current),'undeclared actual imported source')
        order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds']
        torch.manual_seed(policy['seed']);np.random.seed(policy['seed']);random.seed(policy['seed'])
        require(torch.cuda.is_available(),'CUDA unavailable');guard()
        torch.cuda.set_per_process_memory_fraction(.7);torch.cuda.set_device(0);torch.cuda.manual_seed(policy['seed']);gpu=True
        samples={}
        for source in sources:
            guard();sid=source['sampleId'];row=next(x for x in index['samples'] if x['sampleId']==sid)
            samples[sid]=load_sample(reader,row,source['identity'],order,continuous,api)
        for role in ('parent077','D093'):
            guard();phase='load_checkpoint';context=policy['contexts'][role];info=contexts[role]
            model,critic=profile.fresh_networks(order)
            require(all(b in package['programs'] for b in project_sources(contexts['D093']['package'])),
                    'undeclared source after original factory')
            value=torch.load(io.BytesIO(reader.read(context['checkpoint'])),map_location='cpu',weights_only=True)
            validate_checkpoint(value,role,context,info['package'],info['result'])
            model.load_state_dict(value['model'],strict=True);critic.load_state_dict(value['critic'],strict=True);del value
            before=dict(generator=replay.state_hash(model),discriminator=replay.state_hash(critic))
            require(before==(contexts['D093']['result']['parentStateHashes'] if role=='parent077' else info['result']['finalStateHashes']), 'actual checkpoint named hashes')
            model.to('cuda:0');critic.to('cuda:0');model.eval();critic.eval()
            require(before==dict(generator=replay.state_hash(model),discriminator=replay.state_hash(critic)),'CPU/GPU state differs')
            for case in [x for x in policy['cases'] if x['checkpointRole']==role]:
                guard();phase='zero_update_case';active=case;observation=None;case_started=time.monotonic()
                source=next(x for x in sources if x['sampleId']==case['sampleId']);identity=source['identity']
                sample,facts=samples[case['sampleId']]
                reference=np.array(Image.open(io.BytesIO(reader.read(identity['image']))).convert('RGB'),copy=True)
                road=next(x for x in identity['channels'] if x['id']=='terrain_path_ground')
                raster=np.array(Image.open(io.BytesIO(reader.read(road))).convert('RGB'),copy=True)
                expected=(raster[...,0] if raster.ndim==3 else raster)>0
                reference_raw_sha=digest(reference.tobytes());expected_mask_sha=digest(expected.astype('uint8').tobytes())
                reference=torch.from_numpy(reference).permute(2,0,1)[None].float().to('cuda:0')/255
                expected=torch.from_numpy(expected).to('cuda:0')
                observation=RoadObservation(model,critic,profile.background,reference,expected,guard)
                failure={}
                with observation:
                    proof=profile.zero_update_probe(model,critic,sample,order,guard,event=observation.event,failure_evidence=failure)
                summary=observation.summary();exact_case_counts(summary['counts'])
                require(all(b in package['programs'] for b in project_sources(contexts['D093']['package'])),
                        'undeclared source after original probe')
                validate_probe_proof(proof)
                require(proof['passed'] is True and summary['stateUnchanged'] and summary['cleanupVerified'],'original gate/state checks')
                require(proof['callCounts']==dict(generatorForwards=1,generatorForwardCompleted=1,generatorAutograd=5,discriminatorAutograd=1),'original probe counts')
                number=case['caseIndex'];pixels=observation.quantized[0].permute(1,2,0).numpy()
                def png(array):
                    stream=io.BytesIO();Image.fromarray(array).save(stream,format='PNG');return stream.getvalue()
                image=put(f'case-{number:02}-native.png',png(pixels))
                repeated=put(f'case-{number:02}-repeat.png',png(pixels.repeat(4,0).repeat(4,1)))
                request=put(f'case-{number:02}-audit-request.json',dict(package=bound,case=case,image=image,repeated=repeated,
                    identity=identity,monsoonSeason=facts['season'],referenceRawSha256=reference_raw_sha,
                    expectedRoadMaskSha256=expected_mask_sha,library=next(b for b in package['programs'] if b['path']==LIB)))
                guard();phase='same_forward_audit';remaining=max(1,600-(time.monotonic()-started))
                audit=subprocess.run(['node',LIB,'audit-case',request['path'],request['sha256']],capture_output=True,check=True,
                    timeout=remaining,cwd=ROOT,text=True)
                require(len(audit.stdout.encode())+len(audit.stderr.encode())<=1024**2,'audit subprocess stream bound')
                audit_binding=json.loads(audit.stdout);audit_value=reader.json(audit_binding)
                require(audit_value['case']==case and audit_value['quantizedProjectionPixelsEqual'] is True,'same-forward audit identity')
                for b in [audit_value['projection'],audit_binding]:
                    require(b['path'].startswith(out+'/'),'audit artifact root');artifacts.append(b)
                record=put(f'case-{number:02}.json',dict(case=case,checkpoint=context['checkpoint'],identity=identity,
                    originalGatePassed=True,originalCallCounts=proof['callCounts'],originalFiveGradientFacts=proof['fiveGradientFacts'],
                    observation=summary,image=image,projection=audit_value['projection'],audit=audit_binding,
                    elapsedSeconds=time.monotonic()-case_started,trainingStarted=False,formalQualificationGranted=False))
                cases.append(dict(case=case,record=record,counts=summary['counts'],stateUnchanged=True,cleanupVerified=True,
                    originalGatePassed=True,audit=audit_binding,quantizedProjectionPixelsEqual=True))
                guard();del observation,reference,expected;observation=None
            del model,critic;torch.cuda.empty_cache()
        reader.unchanged();require(all(binding(b['path'])==b for b in package['programs']),'current source changed')
        put('runtime-inputs.json',dict(bindings=[dict(path=p,sha256=s) for p,s in sorted(reader.observed.items())]))
        require(len(cases)==8,'complete case count');guard()
        put('result.json',dict(schemaVersion='road-attribution-zero-update-result-v1',status='road_attribution_completed_not_qualified',
            experimentIdentity=package['experimentIdentity'],recordedAtUtc=now(),gpuStarted=True,trainingStarted=False,cases=cases,
            counts={key:sum(row['counts'][key] for row in cases) for key in PER_CASE},optimizerSteps=dict(generator=0,discriminator=0),
            optimizerCreations=0,backwardCalls=0,formalQualificationGranted=False,runtimePublicationAllowed=False,
            historicalReplayClaimed=False,artifacts=list(artifacts),elapsedSeconds=time.monotonic()-started))
    except BaseException as error:
        active_summary=observation.summary() if observation else None
        if active_summary is not None:
            active_summary={k:v for k,v in active_summary.items() if k!='gradientComparisons'}
        try:
            put('result.json',dict(schemaVersion='road-attribution-zero-update-result-v1',status='road_attribution_failed_closed',
            experimentIdentity=package['experimentIdentity'],recordedAtUtc=now(),phase=phase,activeCase=active,
            error=str(error)[:4096],errorType=type(error).__name__,secondaryErrors=secondary_error_evidence(error,locals().get('failure',{})),
            probeFailure=safe_probe_failure(locals().get('failure',{})),
            gpuStarted=gpu,trainingStarted=False,cases=cases,activeCaseObservation=active_summary,
            optimizerSteps=dict(generator=0,discriminator=0),optimizerCreations=0,backwardCalls=0,
            formalQualificationGranted=False,runtimePublicationAllowed=False,historicalReplayClaimed=False,
            artifacts=list(artifacts),elapsedSeconds=time.monotonic()-started),failure=True)
        except BaseException as publication:
            print('road_diagnostic_result_publication_failed: '+type(publication).__name__,file=sys.stderr,flush=True)
        raise


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=('prepare','run'))
    parser.add_argument('--policy',default=POLICY);parser.add_argument('--package');parser.add_argument('--sha256')
    args=parser.parse_args()
    if args.mode=='prepare': print(json.dumps(prepare(args.policy)))
    else: execute(dict(path=args.package,sha256=args.sha256))
