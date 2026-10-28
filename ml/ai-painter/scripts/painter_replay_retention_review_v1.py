"""Frozen 56-image CPU review. No training, GPU, parent forward or promotion."""
from __future__ import annotations
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['MKL_NUM_THREADS'] = '2'
import sys, io, json, math, hashlib, time
from pathlib import Path
from datetime import datetime, timezone
from contextlib import ExitStack
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
SELF = 'ml/ai-painter/scripts/painter_replay_retention_review_v1.py'
TARGET = 'ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
MAX_JSON_BYTES = 1048576
for _p in ('ml/ai-painter/src', 'ml/ai-painter/scripts'):
    sys.path.insert(0, str(ROOT / _p))
from painter_replay_retention_review_recovery_v1 import read_dynamic_json

HISTORICAL_SOURCE_BASELINE = {'path':'.runtime/ai-painter/controller-repair-reviews/balanced-map-followup-093-20261027/historical-source-baseline.json','sha256':'0f3e6109f5f1490c52d318604c6a7141f754f16579414e18740b25401e01547e'}


def historical_source_bindings(value):
    """Only exact historical source identities map to archived bytes."""
    require(value['taskId'] == 'BALANCED-MAP-093', 'historical source baseline identity')
    result = {}
    for entry in value['entries']:
        original, archive = entry['original'], entry['archive']
        logical = original['path']
        require(not any(p in ('', '.', '..') for p in logical.split('/')) and '\\' not in logical and ':' not in logical, 'historical source path')
        require(logical.startswith(('ml/ai-painter/', 'scripts/', 'src/')), 'historical source scope')
        require(archive['path'] == '.runtime/ai-painter/controller-repair-reviews/balanced-map-followup-093-20261027/source-baseline/' + logical and archive['sha256'] == original['sha256'], 'exact historical source archive')
        key = (logical, original['sha256'])
        require(key not in result, 'duplicate historical source identity')
        result[key] = archive
    require(len(result) == 186, 'historical186 source set')
    return result


def read_historical_source(reader, binding, historical, reads):
    archived = historical.get((binding['path'], binding['sha256']))
    if archived is None:
        return reader.read(binding)
    raw = reader.read(archived)
    reads[(binding['path'], binding['sha256'])] = {'original':binding,'archive':archived}
    return raw


def validate_loaded_source(binding, frozen):
    require(frozen.get(binding['path']) == binding['sha256'], 'undeclared review project source: ' + binding['path'])


def read_review_control(root, out, review_id, parent_pid, audit, budget_check, controller_exists, now_unix):
    def dynamic(file):
        return read_dynamic_json(file, logical_path=file.relative_to(root).as_posix(), audit=audit, budget_check=budget_check)
    lease = dynamic(out/'worker-lease.json')
    require(controller_exists(lease['controllerPid']), 'controller exited')
    registry = dynamic(root/'.runtime/ai-painter/current-execution-registry/current.json')
    heartbeat = dynamic(out/'heartbeat.json')
    validate_lease(lease, registry, heartbeat, review_id, parent_pid, now_unix())


def require(value, message):
    if not value:
        raise ValueError(message)


def encode_json(value):
    raw = (json.dumps(value, allow_nan=False, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    require(len(raw) <= MAX_JSON_BYTES, 'review JSON exceeds1MiB')
    return raw


def publish_input_manifests(bindings, review_id, execution_package, publish):
    require(len(bindings) <= 8192, 'bounded input binding count')
    require(len({b['path'] for b in bindings}) == len(bindings), 'duplicate input binding')
    result = []
    for offset in range(0, len(bindings), 256):
        value = {'schemaVersion':'ai-painter-replay-retention-input-bindings-v1','reviewId':review_id,'executionPackage':execution_package,'offset':offset,'bindings':bindings[offset:offset+256]}
        encode_json(value)
        result.append(publish(f'input-bindings-{offset//256:02}.json', value))
    return result


def validate_members(train, validation, target=TARGET):
    require(len(train) == len(set(train)) == 48, 'exact 48 unique train members')
    require(len(validation) == len(set(validation)) == 8, 'exact eight unique devval members')
    require(not set(train) & set(validation) and target in train, 'split isolation and target')


def validate_lease(lease, registry, heartbeat, review_id, parent_pid, now_unix):
    require(lease['reviewId'] == registry['runId'] == heartbeat['runId'] == review_id, 'review lease identity')
    require(parent_pid in (lease['controllerPid'], lease['launcherPid']), 'direct parent or exact venv redirector')
    active = registry['activeExecution']
    require(active['processId'] == lease['controllerPid'] and active['processStartIdentity'] == lease['controllerStartIdentity'], 'controller creation identity')
    require(registry['registryRevision'] == lease['registryRevision'], 'registry revision')
    require(heartbeat['processStartIdentity'] == lease['controllerStartIdentity'], 'heartbeat process identity')
    timestamp = datetime.fromisoformat(heartbeat['heartbeatAtUtc'].replace('Z', '+00:00')).timestamp()
    require(0 <= now_unix - timestamp < 120, 'heartbeat stale or future')


def validate_checkpoint_metadata(value, package_binding, source, result):
    require(source['schemaVersion'] == 'replay-retention-fit-package-v1', 'training package schema')
    require(source['arm'] in ('mixed', 'short'), 'declared arm')
    pairs = 200 if source['arm'] == 'mixed' else 100
    require(source['training']['pairs'] == pairs, 'fixed pair budget')
    require(value['schema'] == 'replay-retention-fit-state-v1', 'checkpoint schema')
    require(value['packageSha256'] == package_binding['sha256'], 'checkpoint package SHA')
    require(value['counts'] == result['optimizerSteps'] == {'generator': pairs, 'discriminator': pairs}, 'complete G/D counts')
    for field in ('arm', 'modelCapability', 'sourcePlan', 'parentExperiment', 'training'):
        require(value[field] == source[field], 'checkpoint metadata ' + field)
    require(value['sampleVisits'] == result['sampleVisits'] == source['plannedSampleVisits'], 'exact planned visits')
    require(sum(value['sampleVisits'].values()) == pairs, 'visit sum')
    require(value['checkpointPromotable'] is False and result['checkpointReloadExact'] is True, 'strict nonpromotable checkpoint')


def validate_review_checkpoint_metadata(value, package_binding, source, result):
    if source['arm'] == 'balanced-boundary':
        from painter_replay_retention_fit_v1 import (training_for, validate_policy_binding,
            validate_saved_checkpoint, validate_package, BOUNDARY_OBJECTIVE, SAMPLES)
        validate_policy_binding(source['policy'], source['arm'])
        require(source['training'] == training_for('balanced-boundary'), 'boundary exact training')
        require(source['selectedSampleIds'] == SAMPLES and source['schedule'] == SAMPLES*4+SAMPLES[:8],
                'boundary original48 schedule')
        require(result.get('trainingObjective') == BOUNDARY_OBJECTIVE, 'boundary result objective')
        require(result['targetUpdates'] == 5 and result['replayUpdates'] == 195, 'boundary actual exposure')
        require(result['optimizerSteps'] == dict(generator=200, discriminator=200)
                and result['sampleVisits'] == source['plannedSampleVisits']
                and result['checkpointReloadExact'] is True, 'boundary completed exact checkpoint')
        validate_saved_checkpoint(value, package_binding, source)
        return
    if source['arm'] != 'balanced':
        return validate_checkpoint_metadata(value, package_binding, source, result)
    require(source['schemaVersion'] == 'replay-retention-fit-package-v1', 'training package schema')
    require(source['arm'] in ('mixed', 'short', 'balanced'), 'declared arm')
    pairs = 100 if source['arm'] == 'short' else 200
    require(source['training']['pairs'] == pairs, 'fixed pair budget')
    if source['arm'] == 'balanced':
        require(source['policy'] == {'path':'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json','sha256':'4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db'}, 'balanced registered policy')
        require(source['training'] == {'pairs':200,'targetPairs':5,'replayPairs':195,'seed':20260929,'supportStructureWeight':0.1,'checkpointSelection':'final_step_only','observations':[0,25,50,100,150,200],'sampling':'original48_round_robin_four_passes_then_first8'}, 'balanced exact training')
        train = source['selectedSampleIds']
        require(len(train) == len(set(train)) == 48 and TARGET in train, 'balanced48 train')
        require(source['schedule'] == train * 4 + train[:8], 'balanced exact200 schedule')
        require(source['training']['targetPairs'] == result['targetUpdates'] == 5 and source['training']['replayPairs'] == result['replayUpdates'] == 195, 'balanced target/replay counts')
        require(source['training']['sampling'] == 'original48_round_robin_four_passes_then_first8', 'balanced sampling')
        require(source['plannedSampleVisits'] == {sid:source['schedule'].count(sid) for sid in train}, 'balanced exact visits')
        require(source['plannedSampleVisits'][TARGET] == 5, 'target149 exposure')
    require(value['schema'] == 'replay-retention-fit-state-v1', 'checkpoint schema')
    require(value['packageSha256'] == package_binding['sha256'], 'checkpoint package SHA')
    require(value['counts'] == result['optimizerSteps'] == {'generator': pairs, 'discriminator': pairs}, 'complete G/D counts')
    for field in ('arm', 'modelCapability', 'sourcePlan', 'parentExperiment', 'training'):
        require(value[field] == source[field], 'checkpoint metadata ' + field)
    require(value['sampleVisits'] == result['sampleVisits'] == source['plannedSampleVisits'], 'exact planned visits')
    require(sum(value['sampleVisits'].values()) == pairs, 'visit sum')
    require(value['checkpointPromotable'] is False and result['checkpointReloadExact'] is True, 'strict nonpromotable checkpoint')


def validate_histories(parent, single, train, validation):
    validate_members(train, validation)
    expected = train + validation
    rows = [r for r in parent['rows'] if r['arm'] == 'candidate']
    require([r['sampleId'] for r in rows] == expected, 'parent row order or missing member')
    require([r['sampleId'] for r in single['rows']] == expected, 'A row order or missing member')
    require(parent['actualCalls'] == {'generatorForwards':112,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0}, 'parent call evidence')
    require(single['actualCalls'] == {'generatorForwards':56,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0}, 'A call evidence')
    require(single['stateBefore'] == single['stateAfter'] and len(single['stateBefore']) == 2, 'A changed or missing state')
    proof = next(p for p in parent['stateProofs'] if p['arm'] == 'candidate')
    require(proof['before'] == proof['after'] and len(proof['before']) == 2, 'parent state changed')
    for n, (before, after) in enumerate(zip(rows, single['rows'])):
        split = 'train' if n < 48 else 'validation'
        require(before['identity'] == after['identity'] and before['split'] == after['split'] == split, 'history sample identity')
        require(before['metrics'] == after['beforeMetrics'], 'A parent metrics changed')
        require(before['prediction'] == after['beforePrediction'], 'A parent prediction binding')
    return rows


def validate_metric_numbers(value):
    # None has meaning only alongside an explicit NA reason; never sanitize NaN.
    require(type(value['fullRgbMae']) in (int, float) and math.isfinite(value['fullRgbMae']), 'nonfinite full metric')
    for regions in value['regions'].values():
        for region in regions.values():
            require(type(region['pixels']) is int and region['pixels'] >= 0, 'region pixel count')
            for field in ('rgbMae', 'correlation'):
                x = region[field]
                require((x is None and region['naReason'] is not None) or (type(x) in (int, float) and math.isfinite(x)), 'nonfinite or unexplained missing region metric')


def tensor_state_hash(model, metadata=False):
    """Keep legacy079/086 hashes separate from091 dtype/shape-aware hashes."""
    h = hashlib.sha256()
    for key, tensor in model.state_dict().items():
        tensor = tensor.detach().cpu().contiguous()
        h.update(json.dumps([key, str(tensor.dtype), list(tensor.shape)]).encode() if metadata else key.encode())
        h.update(tensor.numpy().tobytes())
    return h.hexdigest()


def execute(package_path, package_sha):
    import torch, numpy as np, psutil
    from PIL import Image
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    import decode1_entry_weight_quality_auth_v1 as auth
    import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
    from painter_stage4_appearance_regime_probe import derive_regime_record
    from current_checkpoint_fit_metrics_v1 import sample_metrics
    torch.set_num_threads(2); torch.set_num_interop_threads(2)
    psutil.Process().cpu_affinity(psutil.Process().cpu_affinity()[:2])
    reader = cpu.BoundReader(ROOT)
    package_binding = {'path':package_path,'sha256':package_sha}
    pkg = reader.json(package_binding)
    require(pkg['schemaVersion'] == 'ai-painter-replay-retention-review-package-v1', 'review package')
    out = ROOT / pkg['outputRoot']; started = time.monotonic(); started_at = datetime.now(timezone.utc).isoformat()
    calls = {'generatorForwards':0,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0}
    read_audit = {'reads':0,'readAttempts':0,'retries':0,'events':[],'overflow':False,'maximumReadElapsedMs':0}
    require(pkg['historicalSourceBaseline'] == HISTORICAL_SOURCE_BASELINE, 'frozen historical baseline binding')
    historical = historical_source_bindings(reader.json(pkg['historicalSourceBaseline']))
    historical_reads = {}
    def history_read(binding):
        return read_historical_source(reader, binding, historical, historical_reads)
    policy = reader.json(pkg['policy'])
    require(policy['gpuAllowed'] is False and policy['trainingAllowed'] is False and policy['optimizerUpdates'] == 0, 'CPU readonly policy')
    resources = policy['resources']
    require(resources['cpuThreads'] == 2 and resources['generatorForwards'] == 56 and resources['automaticRetries'] == 0, 'CPU scope')
    require(resources['maxWallSeconds'] == 900 and resources['workerMaxWallSeconds'] == 600 and resources['maxOutputMiB'] == 128, 'frozen resource limits')
    def put(name, value):
        raw = value if isinstance(value, bytes) else encode_json(value)
        used = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
        require(used + len(raw) + resources['terminalReserveBytes'] < resources['maxOutputMiB'] * 1024**2, 'review output limit')
        with (out/name).open('xb') as handle: handle.write(raw)
        return {'path':(out/name).relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(raw).hexdigest()}
    def deny(key):
        def call(*args, **kwargs):
            calls[key] += 1
            raise RuntimeError('forbidden ' + key)
        return call
    def guard():
        require(time.monotonic() - started < resources['workerMaxWallSeconds'], 'worker deadline')
        require(time.time() * 1000 < pkg['deadlineUnixMs'], 'total review deadline')
        require(not torch.cuda.is_initialized(), 'CUDA initialized')
        require(psutil.disk_usage(str(out)).free > resources['minimumFreeDiskMiB'] * 1024**2, 'free disk')
        def within_deadlines():
            require(time.monotonic() - started < resources['workerMaxWallSeconds'], 'worker deadline')
            require(time.time() * 1000 < pkg['deadlineUnixMs'], 'total review deadline')
        read_review_control(ROOT, out, pkg['reviewId'], os.getppid(), read_audit, within_deadlines, psutil.pid_exists, time.time)
    def pixels(binding):
        return np.asarray(Image.open(io.BytesIO(reader.read(binding))).convert('RGB'))
    def actual_sources(source):
        frozen = {b['path']:b['sha256'] for b in source['programs'] + pkg['programs']}
        found = []
        for module in tuple(sys.modules.values()):
            filename = getattr(module, '__file__', None)
            if not filename: continue
            file = Path(filename).absolute()
            if file.is_relative_to(ROOT/'ml/ai-painter') and not file.is_relative_to(ROOT/'ml/ai-painter/.venv'):
                logical = file.relative_to(ROOT).as_posix()
                b = {'path':logical,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
                validate_loaded_source(b, frozen)
                reader.read(b); found.append(b)
        return sorted(found, key=lambda b:b['path'])
    try:
        guard()
        for binding in pkg['programs']: reader.read(binding)
        with ExitStack() as stack:
            for owner, name, key in ((torch.autograd,'grad','autogradAttempts'),(torch.autograd,'backward','autogradAttempts'),(torch.Tensor,'backward','autogradAttempts'),(torch.optim.Optimizer,'__init__','optimizerAttempts'),(torch.cuda,'_lazy_init','cudaAttempts')):
                stack.enter_context(patch.object(owner, name, deny(key)))
            terminal = reader.json(pkg['sourceTerminal']); source = reader.json(pkg['sourcePackage']); result = reader.json(terminal['result'])
            if source['arm'] in ('balanced', 'balanced-boundary'):
                balanced_policy = reader.json(source['policy'])
                require(balanced_policy['arm'] == source['arm'] and balanced_policy['training'] == source['training'], 'balanced policy contents')
                if source['arm'] == 'balanced-boundary':
                    from painter_replay_retention_fit_v1 import validate_package
                    validate_package(source, balanced_policy)
            for binding in source['programs']:
                guard(); reader.read(binding)
            require(terminal['executionState'] == 'completed' and terminal['runId'] == source['experimentIdentity'] == result['experimentIdentity'], 'completed source run')
            require(pkg['sourceCheckpoint'] in result['artifacts'], 'exact source checkpoint artifact')
            parent = reader.json(policy['parentEvaluation']); single = reader.json(policy['single149Evaluation'])
            for history in (parent, single):
                for binding in history['inputs'] + history['actualProjectSources']:
                    guard(); history_read(binding)
            plan = reader.json(source['sourcePlan']); manifest = reader.json(plan['datasetManifest']); index = reader.json(manifest['sourceIndex'])
            train = reader.json(plan['trainSplit'])['sampleIds']; validation = reader.json(plan['validationSplit'])['sampleIds']
            parent_rows = validate_histories(parent, single, train, validation)
            require(train == pkg['trainSampleIds'] and validation == pkg['validationSampleIds'], 'review frozen member order')
            if source['arm'] in ('balanced', 'balanced-boundary'):
                require(source['selectedSampleIds'] == train, 'balanced original train order')
            parent_proof = next(p for p in parent['stateProofs'] if p['arm'] == 'candidate')
            require(parent_proof['checkpoint'] == policy['parentExperiment']['checkpoint'], 'parent evaluation checkpoint')
            require(single['checkpoint'] == policy['single149Experiment']['checkpoint'], 'A evaluation checkpoint')
            require(result['parentStateHashes'] == result['initialStateHashes'] == source['parentStateHashes'], 'same parent initial named state hashes')
            # Recheck the saved CPU pixels against both historical ten-image reviews.
            reproduction = []
            for label, history, rows in [('parent', parent, parent_rows), ('A', single, single['rows'])]:
                request = reader.json(history['request'])
                prior_terminal = reader.json(reader.json(request['candidateReviewCompletion'])['reviewTerminal'] if label == 'parent' else request['review'])
                prior_report = reader.json(prior_terminal['report']); inference = reader.json(prior_report['inference'])
                require(inference['stateBefore'] == inference['stateAfter'] and len(inference['observations']) == 10, 'prior review state/count')
                for observation in inference['observations']:
                    row = next(r for r in rows if r['sampleId'] == observation['sampleId'])
                    require(row['identity'] == observation['identity'], 'prior review identity')
                    require(np.array_equal(pixels(row['prediction'] if label == 'parent' else row['afterPrediction']), pixels(observation['prediction'])), 'saved prior CPU pixels changed')
                    reproduction.append({'arm':label,'sampleId':row['sampleId']})
            order = manifest['identityPayload']['channelOrder']; continuous = manifest['identityPayload']['continuousChannelIds']
            model, critic = profile.fresh_networks(order, model_capability=policy['modelCapability'])
            require(source['modelCapability'] == policy['modelCapability'], 'model capability')
            parent_state = torch.load(io.BytesIO(reader.read(policy['parentExperiment']['checkpoint'])), map_location='cpu', weights_only=True)
            require(parent_state['schema'] == 'mixed-train-rehearsal-state-v1' and parent_state['packageSha256'] == policy['parentExperiment']['package']['sha256'] and parent_state['counts'] == {'generator':448,'discriminator':448} and parent_state['checkpointPromotable'] is False, 'parent checkpoint identity')
            model.load_state_dict(parent_state['model'], strict=True); critic.load_state_dict(parent_state['critic'], strict=True)
            parent_legacy = [tensor_state_hash(m) for m in (model, critic)]
            parent_named = dict(generator=tensor_state_hash(model, True), discriminator=tensor_state_hash(critic, True))
            require(parent_legacy == parent_proof['before'], 'actual parent tensors do not match legacy079 hashes')
            require(parent_named == result['parentStateHashes'], 'actual parent tensors do not match091 named hashes')
            del parent_state
            value = torch.load(io.BytesIO(reader.read(pkg['sourceCheckpoint'])), map_location='cpu', weights_only=True)
            validate_review_checkpoint_metadata(value, pkg['sourcePackage'], source, result)
            model.load_state_dict(value['model'], strict=True); critic.load_state_dict(value['critic'], strict=True); model.eval(); critic.eval()
            before = [tensor_state_hash(m) for m in (model, critic)]
            named_before = dict(generator=tensor_state_hash(model, True), discriminator=tensor_state_hash(critic, True))
            require(named_before == result['finalStateHashes'], 'final training named state hashes')
            actual_sources(source)
            def counted(*args):
                calls['generatorForwards'] += 1
                require(calls['generatorForwards'] <= 56, 'forward ceiling')
            model.register_forward_pre_hook(counted); critic.register_forward_pre_hook(deny('criticForwards'))
            observation_bindings = []; cross_device = None
            for n, (sid, prior) in enumerate(zip(train + validation, parent_rows)):
                guard(); row = next(r for r in index['samples'] if r['sampleId'] == sid)
                expected_split = 'train' if n < 48 else 'validation'
                require(row['split'] == expected_split, 'only train/development-validation')
                if 'sourceCorrection' in row:
                    correction = reader.json(row['sourceCorrection']); parent_dataset = reader.json(correction['parentDataset'])
                    old_row = next(r for r in reader.json(parent_dataset['sourceIndex'])['samples'] if r['sampleId'] == row['parentSampleId'])
                    require(old_row['split'] == row['split'] == 'train', 'correction split')
                    _, identity = cpu.load_sample(reader, old_row, order, continuous); identity.update(sampleId=sid, image=row['image'])
                    sample, identity = auth.load_corrected_sample(reader, row, order, continuous, identity, cpu)
                else: sample, identity = cpu.load_sample(reader, row, order, continuous)
                require(identity == prior['identity'], 'full condition/reference/world identity differs')
                regime, _, _ = derive_regime_record(reader, identity); sample = profile.bind_sample_ecology(reader, sample, identity, regime)
                image_started = datetime.now(timezone.utc).isoformat(); image_clock = time.monotonic()
                with torch.inference_mode(): prediction = profile.sample_forward(model, sample).detach().cpu()
                require(prediction.shape == (1,3,192,256) and bool(torch.isfinite(prediction).all()), 'prediction shape/finite')
                rgb = (prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')
                buffer = io.BytesIO(); Image.fromarray(rgb).save(buffer, format='PNG'); image = put(f'prediction-{n:02}.png', buffer.getvalue())
                image_ended = datetime.now(timezone.utc).isoformat(); image_elapsed = time.monotonic()-image_clock
                if sid == TARGET:
                    final_path = source['outputRoot'] + f"/prediction-149-{source['training']['pairs']:03}.png"
                    matches = [b for b in result['artifacts'] if b['path'] == final_path]; require(len(matches) == 1, 'final149 artifact')
                    gpu_pixels = pixels(matches[0]); require(gpu_pixels.shape == rgb.shape, 'final149 GPU reference shape')
                    difference = np.abs(rgb.astype('int16') - gpu_pixels.astype('int16'))
                    cross_device = {'sampleId':sid,'cpuDevice':'cpu','referenceDevice':'cuda','reference':matches[0],'pixelEqual':bool(np.array_equal(rgb,gpu_pixels)),'maximumAbsoluteByteDifference':int(difference.max()),'meanAbsoluteByteDifference':float(difference.mean()),'differentValueCount':int(np.count_nonzero(difference)),'valueCount':int(difference.size),'scope':'cross_device_observation_not_same_device_reload_gate'}
                metrics = sample_metrics(prediction, sample, order); validate_metric_numbers(metrics)
                reference_size = Image.open(io.BytesIO(reader.read(identity['image']))).size
                observation = {'schemaVersion':'ai-painter-replay-retention-observation-v1','reviewId':pkg['reviewId'],'executionPackage':package_binding,'sampleId':sid,'split':expected_split,'identity':identity,'slot':prior['slot'],'ecologyIndex':prior['ecologyIndex'],'monsoonSeason':row['monsoonSeason'],'prediction':image,'nativePredictionDimensions':{'width':256,'height':192},'referenceNativeDimensions':{'width':reference_size[0],'height':reference_size[1]},'metrics':metrics,'imageTiming':{'scope':'CPU_forward_transfer_PNG_publication','startedAtUtc':image_started,'endedAtUtc':image_ended,'elapsedSeconds':image_elapsed}}
                ob = put(f'observation-{n:02}.json', observation)
                observation_bindings.append({'sampleId':sid,'split':expected_split,'binding':ob})
            after = [tensor_state_hash(m) for m in (model, critic)]
            named_after = dict(generator=tensor_state_hash(model, True), discriminator=tensor_state_hash(critic, True))
            require(before == after and named_before == named_after and cross_device is not None, 'changed state or missing cross-device comparison')
            require(calls == {'generatorForwards':56,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0}, 'actual call scope')
            require(all(p.grad is None for m in (model,critic) for p in m.parameters()), 'unexpected gradient')
            sources = actual_sources(source); reader.unchanged(); guard()
            inputs = [{'path':p,'sha256':h} for p,h in reader.observed.items()]
            manifests = publish_input_manifests(inputs, pkg['reviewId'], package_binding, put)
            evidence = put('inference.json', {'schemaVersion':'ai-painter-replay-retention-review-inference-v1','reviewId':pkg['reviewId'],'executionPackage':package_binding,'sourceCheckpoint':pkg['sourceCheckpoint'],'observationsStorage':'sha256_per_sample_json_v1','observationBindings':observation_bindings,'inputsStorage':'sha256_binding_chunks_v1','inputCount':len(inputs),'inputManifestBindings':manifests,'actualCalls':calls,'stateBefore':before,'stateAfter':after,'trainingNamedStateBefore':named_before,'trainingNamedStateAfter':named_after,'parentStateVerification':{'legacy079':parent_legacy,'named091':parent_named,'generatorForwards':0},'actualProjectSources':sources,'historicalPixelReproductions':reproduction,'final149CrossDeviceComparison':cross_device,'startedAtUtc':started_at,'endedAtUtc':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-started,'timingScope':'worker_after_imports_and_package_read_through_observation_and_input_chunks_before_inference_manifest_write','gpuInitialized':False,'optimizerUpdates':0,'dynamicReadAudit':read_audit,'historicalSourceReads':list(historical_reads.values()),'formalQualificationGranted':False})
            print(json.dumps(evidence))
    except BaseException as error:
        put('inference-failure.json', {'status':'failed_closed','reviewId':pkg['reviewId'],'error':repr(error),'actualCalls':calls,'elapsedSeconds':time.monotonic()-started,'dynamicReadAudit':read_audit,'historicalSourceReads':list(historical_reads.values()),'formalQualificationGranted':False})
        raise


if __name__ == '__main__':
    require(len(sys.argv) == 3, 'exact package path/SHA required')
    execute(sys.argv[1], sys.argv[2])
