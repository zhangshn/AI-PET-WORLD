"""Fixed replay-retention arms; only the registered controller may execute."""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import io
import json
import os
import random
import subprocess
import sys
import time

import painter_single_map_checkpoint_fit_v1 as common
import painter_single149_terrain_ecology_fit_v1 as single
import painter_mixed_train_rehearsal_v1 as mixed
from training_observation_recorder_v1 import ObservationRecorder, descriptor, start_clock, finish_clock, IMAGE_SCOPE

ROOT = common.ROOT
need, binding, read, save = common.need, common.binding, common.read, common.save
SELF = 'ml/ai-painter/scripts/painter_replay_retention_fit_v1.py'
TEST = 'ml/ai-painter/tests/test_replay_retention_fit_v1.py'
POLICIES = {arm: 'data/ai-painter/system-governance/ai-painter-replay-retention-' + arm + '-policy-v1.json'
            for arm in ('mixed', 'short', 'balanced', 'balanced-boundary')}
BALANCED_POLICY_BINDING = dict(path=POLICIES['balanced'],
    sha256='4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db')
BOUNDARY_POLICY_BINDING = dict(path=POLICIES['balanced-boundary'],
    sha256='d82723c8420eead460c4aeb8e28d44a430dee2f82800d6a332c8fc5ffb2cc235')
BOUNDARY_OBJECTIVE = 'stage4_balanced_boundary_rgb_001_v1'
BOUNDARY_DEFINITION = {
    'reference': 'bound_original_1024x768_RGB',
    'prediction': 'native_256x192_float_RGB_repeat_interleave_4_each_axis',
    'expectedRoad': 'bound_terrain_path_ground_first_component_gt_zero',
    'requiredSides': 'for each north/east/south/west projected 6px strip, include whole strip iff original expected road has any true pixel inside that strip',
    'boundaryBandProjectedPixels': 6,
    'aggregation': 'sum(abs(projected_prediction-reference_RGB_float_0_to_1)*mask[None,None]) / max(3*sum(mask),1)',
    'gradient': 'float_prediction_no_quantization_no_reference_downsample',
    'missingInput': 'fail_closed', 'structuralEmpty': 'connected_zero_and_not_applicable',
    'mask': 'expectedRoad AND union_of_included_6px_strips',
    'implementationReference': 'ml/ai-painter/src/ai_painter/complete_world/road_attribution_observation_v1.py:21-33,53-55'}
CAPABILITY, SAMPLE, PARENT = single.CAPABILITY, single.SAMPLE, single.PARENT
SAMPLES = list(mixed.SAMPLES)
SCHEMA = 'replay-retention-fit-package-v1'
STATE_SCHEMA = 'replay-retention-fit-state-v1'
REFERENCE_A = common.OUTPUT + 'single149-terrain-ecology-v2-d373a23d4655c3d13e39'
REFERENCE_A_BINDINGS = {key: dict(path=REFERENCE_A + '/' + name, sha256=sha) for key, name, sha in (
    ('package', 'package.json', '003fc5864a38e718dc696194a4f177581b2c68c2f06c100324878146623118bb'),
    ('terminal', 'terminal.json', 'a3d6794cb9f6ce82d11c223986f3337c9bef7280aa80142005bb17928c4df87e'),
    ('result', 'result.json', 'bb23736d94518841c40bb91206958ed898936ab0e1f3f50cd9bcdbb60046e2ad'))}


def same(a, b):
    return json.dumps(a, sort_keys=True, allow_nan=False) == json.dumps(b, sort_keys=True, allow_nan=False)


def training_for(arm):
    need(arm in POLICIES, 'unknown replay arm')
    if arm == 'balanced-boundary':
        return {**training_for('balanced'), 'trainingObjective': BOUNDARY_OBJECTIVE,
                'boundaryRgbWeight': 0.01, 'boundaryRgbDefinition': dict(BOUNDARY_DEFINITION)}
    if arm == 'balanced':
        return dict(pairs=200, targetPairs=5, replayPairs=195, seed=20260929,
                    supportStructureWeight=0.1, checkpointSelection='final_step_only',
                    observations=[0, 25, 50, 100, 150, 200],
                    sampling='original48_round_robin_four_passes_then_first8')
    return dict(pairs=200 if arm == 'mixed' else 100, targetPairs=100,
                replayPairs=100 if arm == 'mixed' else 0, seed=20260929,
                supportStructureWeight=0.1, checkpointSelection='final_step_only',
                observations=[0, 25, 50, 100, 150, 200] if arm == 'mixed' else [0, 25, 50, 100],
                sampling='alternate149_then_original_other47_round_robin' if arm == 'mixed' else 'single149_only')


def resources_for(arm):
    need(arm in POLICIES, 'unknown replay arm')
    return {**single.RESOURCES, 'maxWallSeconds': 900 if arm == 'short' else 1800}


def make_schedule(train_ids, arm):
    need(type(train_ids) is list and train_ids == SAMPLES and len(set(train_ids)) == 48,
         'exact original ordered48 train IDs required')
    need(arm in POLICIES, 'unknown replay arm')
    if arm == 'short':
        return [SAMPLE] * 100
    if arm in ('balanced', 'balanced-boundary'):
        return train_ids * 4 + train_ids[:8]
    others = [sid for sid in train_ids if sid != SAMPLE]
    need(len(others) == 47, 'one target and47 replay maps required')
    return [sid for index in range(100) for sid in (SAMPLE, others[index % 47])]


def expected_visits(schedule):
    need(type(schedule) is list and bool(schedule) and all(type(s) is str and s for s in schedule),
         'nonempty frozen schedule required')
    return dict(Counter(schedule))


def validate_policy(p):
    arm = p.get('arm')
    need(arm in POLICIES and p.get('schemaVersion') == 'replay-retention-fit-policy-v1', 'replay policy scope')
    need(p.get('sampleId') == SAMPLE and p.get('modelCapability') == CAPABILITY, 'target/model identity')
    need(same(p.get('parentExperiment'), PARENT), 'exact common completed parent')
    need(same(p.get('training'), training_for(arm)) and same(p.get('resources'), resources_for(arm)),
         'fixed replay training/resources')
    need(type(p.get('preparationMaxWallSeconds')) is int and p['preparationMaxWallSeconds'] == 300,
         'fixed CPU preparation ceiling')
    need(p.get('initialization') == 'exact_completed_terrain_ecology_generator_and_critic_fresh_original_AdamW',
         'fresh original optimizer initialization')
    need(p.get('zeroUpdateAdmission') == 'all_selected_train_original_five_gradient_gate_before_any_update',
         'all selected samples require own admission')
    need(p.get('lossChanged') is (arm == 'balanced-boundary'), 'lossChanged')
    for key in ('modelArchitectureChanged', 'gradientThresholdChanged',
                'sourceImagesOrConditionsChanged', 'validationContentAllowed', 'checkpointPromotable',
                'runtimePublicationAllowed', 'automaticResumeAllowed', 'parentExecutionPermissionInherited'):
        need(p.get(key) is False, key)


def validate_policy_binding(bound, arm):
    # A self-consistent caller-supplied policy is not the registered new arm.
    # Actual bytes are separately read/hash-checked by prepare and execute.
    if arm == 'balanced':
        need(same(bound, BALANCED_POLICY_BINDING), 'exact registered balanced policy binding required')
    if arm == 'balanced-boundary':
        need(same(bound, BOUNDARY_POLICY_BINDING), 'exact registered boundary policy binding required')


class BoundaryProfile(single.BoundProfile):
    """Original component identity; one opt-in scope around either original call."""
    def zero_update_probe(self, model, critic, sample, *args, **kwargs):
        with self.background.boundary_rgb_scope(sample):
            result = self.background.zero_update_probe(model, critic, sample, *args, **kwargs)
            validate_boundary_facts(result.get('fiveGradientFacts'))
            return result

    def perform_pair(self, model, critic, sample, *args, **kwargs):
        with self.background.boundary_rgb_scope(sample):
            result = self.background.perform_pair(model, critic, sample, *args, **kwargs)
            validate_boundary_facts(result.get('fiveGradientFacts'))
            return result


def validate_boundary_facts(facts):
    import math
    need(isinstance(facts, dict) and facts.get('trainingObjective') == BOUNDARY_OBJECTIVE,
         'boundary objective was not executed')
    values = facts.get('scalarValues', {})
    value = values.get('boundaryPathRgbWeighted')
    need(len(values) <= 8 and type(value) in (int, float) and math.isfinite(value) and value >= 0,
         'boundary committed scalar required within8 values')
    need(facts.get('boundaryRgb', {}).get('weight') == 0.01, 'boundary executed coefficient')


def boundary_input_bindings(identities):
    need([i['sampleId'] for i in identities] == SAMPLES, 'boundary original ordered48 inputs')
    result = []
    for identity in identities:
        roads = [b for b in identity['channels'] if b['id'] == 'terrain_path_ground']
        need(len(roads) == 1 and identity['split'] == 'train', 'one original train road required')
        result.append(dict(sampleId=identity['sampleId'], image=identity['image'],
                           road={k: roads[0][k] for k in ('path', 'sha256')},
                           conditionPack=identity['conditionPack']))
    return result


def bind_boundary_input(reader, sample, identity, torch, np):
    """Reader authenticates original bytes; no missing/invalid source becomes NA."""
    from PIL import Image
    roads = [b for b in identity['channels'] if b['id'] == 'terrain_path_ground']
    need(len(roads) == 1 and sample['sampleId'] == identity['sampleId']
         and sample['split'] == identity['split'] == 'train', 'bound boundary train identity')
    pack = reader.json(identity['conditionPack'])
    compiled_roads = [b for b in pack['channels'] if b['id'] == 'terrain_path_ground']
    need(len(compiled_roads) == 1 and all(compiled_roads[0][k] == roads[0][k] for k in ('path', 'sha256')),
         'boundary road must match authenticated condition pack')
    arrays = []
    for role, bound in (('reference', identity['image']), ('road', roads[0])):
        raw = reader.read(bound)
        with Image.open(io.BytesIO(raw)) as image:
            need(image.size == (1024, 768) and image.format == 'PNG'
                 and image.mode in (('RGB',) if role == 'reference' else ('L', 'RGB'))
                 and not image.info.get('icc_profile'),
                 'boundary original1024 RGB mode/dimensions/profile')
            image.load()
            arrays.append(np.array(image.convert('RGB'), copy=True))
    reference, road = arrays
    return {**sample, 'boundaryRgbSource': dict(sampleId=sample['sampleId'], image=identity['image'],
        road={k: roads[0][k] for k in ('path', 'sha256')}, conditionPack=identity['conditionPack'],
        reference=torch.from_numpy(reference).permute(2, 0, 1)[None].float()/255,
        expectedRoad=torch.from_numpy(road[..., 0] > 0))}


def validate_parent(pkg, terminal, result):
    single.validate_parent(pkg, terminal, result)


def verify_admission(proofs, selected_ids):
    need(type(proofs) is list and [r.get('sampleId') for r in proofs] == selected_ids,
         'complete ordered own selected-sample admission required')
    for row in proofs:
        proof = row.get('proof', {})
        need(proof.get('passed') is True and proof.get('optimizerCreated') is False
             and type(proof.get('optimizerUpdates')) is int and proof['optimizerUpdates'] == 0,
             'zero-update original gate required')
        need(same(proof.get('callCounts'), dict(generatorForwards=1, generatorForwardCompleted=1,
                                               generatorAutograd=5, discriminatorAutograd=1)),
             'original five-gradient call counts')
        need(proof.get('modelCapabilityVersion') == CAPABILITY and proof.get('cudaRngChecked') is True,
             'own CUDA model and restored RNG gate required')
    return dict(selectedSampleCount=len(selected_ids), completedSampleCount=len(proofs), passed=True)


def commit_pair(counts, ledger, step, sid):
    need(same(counts, dict(generator=step, discriminator=step)), 'actual committed pair counts differ')
    need(same(ledger, dict(sampleId=sid, generator=1, discriminator=1)), 'actual pair ledger differs')


def validate_saved_checkpoint(value, bound, pkg):
    need(value.get('schema') == STATE_SCHEMA and value.get('packageSha256') == bound['sha256'],
         'replay checkpoint identity')
    for key in ('arm', 'modelCapability', 'sourcePlan', 'parentExperiment', 'training'):
        need(same(value.get(key), pkg[key]), 'replay checkpoint metadata differs: ' + key)
    pairs = pkg['training']['pairs']
    need(same(value.get('counts'), dict(generator=pairs, discriminator=pairs)), 'replay checkpoint counts')
    need(same(value.get('sampleVisits'), expected_visits(pkg['schedule'])), 'replay checkpoint sample visits')
    need(value.get('checkpointPromotable') is False, 'diagnostic checkpoint cannot be promoted')


def imports():
    api = single.imports()
    # These are the genuine deferred numerical imports reached by the original
    # five-gradient probe, not model execution or substitute implementations.
    import painter_stage4_support_terrain_gradient_training_profile_v1
    from ai_painter.complete_world import object_support_terrain_gradient_device_v1
    from ai_painter.complete_world import terrain_ecology_joint_priority_device_v1
    return api


def state_hash(network):
    digest = hashlib.sha256()
    for name, tensor in network.state_dict().items():
        tensor = tensor.detach().cpu().contiguous()
        digest.update(json.dumps([name, str(tensor.dtype), list(tensor.shape)]).encode())
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def reference_a100(reader):
    """Only saved A observations; never initialize from A or require equal results."""
    ap = reader.json(REFERENCE_A_BINDINGS['package'])
    at = reader.json(REFERENCE_A_BINDINGS['terminal'])
    ar = reader.json(REFERENCE_A_BINDINGS['result'])
    need(ap['parentExperiment'] == PARENT and ap['modelCapability'] == CAPABILITY
         and ap['training'] == single.TRAINING and ap['selectedSampleId'] == SAMPLE,
         'A common initialization and original single149 schedule')
    need(at['executionState'] == 'completed' and at['result'] == REFERENCE_A_BINDINGS['result']
         and ar['checkpointReloadExact'] is True and ar['optimizerSteps'] == dict(generator=200, discriminator=200),
         'completed original A evidence')
    artifacts = {b['path']: b for b in ar['artifacts']}
    expected = ['prediction-100.png', 'observation-100.json'] + [f'learning/step-{i:03}.json' for i in range(1, 101)]
    available = {}
    for name in expected:
        b = artifacts.get(REFERENCE_A + '/' + name)
        if b is not None:
            reader.read(b)
            available[name] = b
    return dict(experiment=REFERENCE_A_BINDINGS, artifacts=available,
                allExpectedAvailable=len(available) == len(expected),
                use='saved_GPU_observations_only_not_weights_or_an_equality_gate')


def source(reader, p, api, resource=lambda: None):
    torch, np, psutil, auth, profile, worker, cpu, derive, codec, values, metrics = api
    plan, selected, sample149, identity149, order, model, critic = single.source(reader, p, api)
    parent_pkg = reader.json(PARENT['package'])
    need(parent_pkg['sourcePlan'] == selected['sourcePlan'], 'same parent source plan')
    train_ids = reader.json(plan['trainSplit'])['sampleIds']
    make_schedule(train_ids, p['arm'])
    selected_ids = [SAMPLE] if p['arm'] == 'short' else train_ids
    manifest = reader.json(plan['datasetManifest'])
    rows = {row['sampleId']: row for row in reader.json(manifest['sourceIndex'])['samples']}
    continuous = manifest['identityPayload']['continuousChannelIds']
    samples, identities = [], []
    for sid in selected_ids:
        resource()
        row = rows[sid]
        need(row['split'] == 'train', 'only frozen train samples may update')
        if sid == SAMPLE:
            sample, identity = sample149, identity149
        else:
            if 'sourceCorrection' in row:
                intake = reader.json(row['sourceCorrection'])
                parent = reader.json(intake['parentDataset'])
                old = next(r for r in reader.json(parent['sourceIndex'])['samples'] if r['sampleId'] == row['parentSampleId'])
                need(old['split'] == 'train', 'corrected parent train isolation')
                _, identity = cpu.load_sample(reader, old, order, continuous)
                identity.update(sampleId=sid, image=row['image'])
                sample, identity = auth.load_corrected_sample(reader, row, order, continuous, identity, cpu)
            else:
                sample, identity = cpu.load_sample(reader, row, order, continuous)
            regime, _, _ = derive(reader, identity)
            sample = profile.bind_sample_ecology(reader, sample, identity, regime)
        if p['arm'] == 'balanced-boundary':
            sample = bind_boundary_input(reader, sample, identity, torch, np)
        samples.append(sample)
        identities.append(identity)
    need(len(tuple(model.parameters())) == 109 and sum(t.numel() for t in model.parameters()) == 2243023,
         'exact109 terrain ecology model required')
    return plan, selected, samples, identities, order, model, critic


def project_sources():
    # Preserve the complete two established source sets, including their late
    # gradient sources; then include every project module actually imported.
    paths = {b['path'] for b in mixed.project_sources()} | {b['path'] for b in single.project_sources()}
    for parent_package in (PARENT['package'], binding(REFERENCE_A + '/package.json')):
        paths.update(b['path'] for b in read(parent_package)['programs'])
    paths.update((SELF, TEST, 'scripts/lib/ai-painter-replay-retention-fit-v1.mjs',
                  'ml/ai-painter/tests/test_rock_background_boundary_v1.py',
                  'ml/ai-painter/src/ai_painter/complete_world/road_attribution_observation_v1.py',
                  'scripts/tests/test-ai-painter-replay-retention-fit.mjs',
                  'scripts/lib/ai-painter-replay-retention-sequence-v1.mjs',
                  'scripts/tests/test-ai-painter-replay-retention-sequence.mjs',
                  'ml/ai-painter/scripts/painter_replay_retention_review_v1.py',
                  'ml/ai-painter/scripts/painter_replay_retention_review_recovery_v1.py',
                  'ml/ai-painter/tests/test_replay_retention_review_v1.py',
                  'scripts/lib/ai-painter-replay-retention-review-v1.mjs',
                  'scripts/tests/test-ai-painter-replay-retention-review.mjs'))
    # The registered parent process also imports these selected execution,
    # audit, telemetry and delivery dependencies. Old packages predate them.
    paths.update(('scripts/lib/ai-assisted-condition-alignment.mjs',
                  'scripts/lib/ai-assisted-style-fingerprint.mjs',
                  'scripts/lib/ai-painter-active-training-telemetry-v1.mjs',
                  'scripts/lib/ai-painter-mvp-detail-sufficiency-v1.mjs',
                  'scripts/lib/ai-painter-post-review-delivery-v1.mjs',
                  'scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs',
                  'scripts/lib/ai-painter-support-weight1-causal-probe-v1.mjs',
                  'scripts/lib/ai-painter-two-map-post-review-v1.mjs',
                  'src/server/local-backup/contracts.mjs',
                  'src/server/local-backup/single-map-work-evidence.mjs',
                  'src/server/local-backup/store.mjs',
                  'src/server/local-backup/training-work-observation.mjs',
                  'src/server/local-backup/training-work-report.mjs',
                  'src/server/local-backup/two-map-post-review-work-evidence.mjs',
                  'src/server/local-backup/work-ledger.mjs',
                  'src/server/local-backup/work-producers.mjs',
                  'src/server/local-backup/work-registry-consumer.mjs',
                  'src/server/local-backup/replay-retention-work-evidence.mjs',
                  'scripts/tests/local-backup-replay-retention-recording.test.mjs'))
    need(len(paths) <= 256, 'source ceiling')
    need(all((ROOT / p).stat().st_size <= 1048576 for p in paths), 'single source ceiling')
    need(sum((ROOT / p).stat().st_size for p in paths) <= 16 * 1024 ** 2, 'source total byte ceiling')
    return [binding(p) for p in sorted(paths)]


def validate_package(pkg, p):
    validate_policy(p)
    arm = p['arm']
    need(pkg.get('schemaVersion') == SCHEMA and pkg['policy']['path'] == POLICIES[arm], 'replay package route')
    validate_policy_binding(pkg['policy'], arm)
    for key in ('arm', 'training', 'resources', 'parentExperiment', 'modelCapability'):
        need(same(pkg.get(key), p[key]), 'frozen replay scope differs: ' + key)
    need(pkg.get('checkpoint') == PARENT['checkpoint'], 'exact common parent checkpoint')
    need(pkg.get('selectedSampleIds') == ([SAMPLE] if arm == 'short' else SAMPLES), 'selected replay members')
    if arm in ('balanced', 'balanced-boundary'):
        need(pkg.get('a100Reference') is None, 'balanced cannot inherit single-map comparison reference')
    if arm == 'balanced-boundary':
        expected = boundary_input_bindings(pkg['sampleIdentities'])
        need(same(pkg.get('boundaryInputBindings'), expected), 'exact original48 boundary binding table')
        frozen = {(b['path'], b['sha256']) for b in pkg['inputs']}
        need(all((row[k]['path'], row[k]['sha256']) in frozen for row in expected
                 for k in ('image', 'road', 'conditionPack')), 'boundary inputs must be frozen')
    schedule = make_schedule(SAMPLES, arm)
    need(pkg.get('schedule') == schedule and same(pkg.get('plannedSampleVisits'), expected_visits(schedule)),
         'frozen schedule differs')
    need(pkg.get('qualificationGranted') is False
         and pkg.get('optimizerInitialization') == 'fresh_AdamW_no_parent_moments_available', 'execution qualification boundary')
    need(pkg['outputRoot'] == common.OUTPUT + pkg['experimentIdentity']
         and pkg['experimentIdentity'].startswith('replay-retention-' + arm + '-v1-'), 'replay output boundary')


def prepare(policy):
    need(policy in POLICIES.values(), 'exact replay policy path required')
    started = time.monotonic()
    policy_binding = binding(policy)
    p = read(policy_binding)
    validate_policy(p)
    need(policy == POLICIES[p['arm']], 'policy arm/path differs')
    validate_policy_binding(policy_binding, p['arm'])
    def resource():
        need(time.monotonic() - started < 300, 'CPU preparation deadline')
    api = imports()
    torch, np, psutil, auth, profile, worker, cpu, derive, codec, values, metrics = api
    reader = cpu.BoundReader(ROOT)
    plan, selected, samples, identities, order, model, critic = source(reader, p, api, resource)
    torch.manual_seed(20260929); np.random.seed(20260929); random.seed(20260929)
    initial = dict(generator=state_hash(model), discriminator=state_hash(critic))
    model.eval(); critic.eval()
    sample = samples[[s['sampleId'] for s in samples].index(SAMPLE)]
    with torch.inference_mode():
        prediction = profile.sample_forward(model, sample)
    from PIL import Image
    pixels = (prediction[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype('uint8')
    need(np.array_equal(pixels, np.asarray(Image.open(io.BytesIO(reader.read(selected['cpuPrediction']))).convert('RGB'))),
         'same-parent prior CPU149 prediction differs')
    need(initial == dict(generator=state_hash(model), discriminator=state_hash(critic)), 'CPU preparation changed parent state')
    need(not torch.cuda.is_initialized(), 'CPU prepare initialized CUDA')
    schedule = make_schedule(SAMPLES, p['arm'])
    artifacts = [dict(role='metrics', sampleId=sid, split='train', optimizerStep=step,
                      measurementScope='original_pre_update_objectives_for_successfully_committed_pair')
                 for step, sid in enumerate(schedule, 1)]
    for step in p['training']['observations']:
        for role in ('prediction', 'metrics'):
            artifacts.append(dict(role=role, sampleId=SAMPLE, split='train', optimizerStep=step,
                                  measurementScope='fixed_sample_evaluation'))
    artifacts.append(dict(role='checkpoint', optimizerStep=p['training']['pairs']))
    reader.unchanged(); resource()
    a100 = reference_a100(reader) if p['arm'] == 'short' else None
    pkg = dict(schemaVersion=SCHEMA, arm=p['arm'], policy=policy_binding, resources=p['resources'], training=p['training'],
               modelCapability=CAPABILITY, parentExperiment=PARENT, sourcePlan=selected['sourcePlan'],
               sourceTerminal=PARENT['terminal'], checkpoint=PARENT['checkpoint'],
               selectedSampleIds=[s['sampleId'] for s in samples], sampleIdentities=identities,
               schedule=schedule, plannedSampleVisits=expected_visits(schedule), parentStateHashes=initial, a100Reference=a100,
               inputs=[dict(path=k, sha256=v) for k, v in sorted(reader.observed.items())], programs=project_sources(),
               specification=binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),
               optimizerInitialization='fresh_AdamW_no_parent_moments_available', qualificationGranted=False,
               interfaceContract=descriptor([{k: i[k] for k in ('sampleId', 'split', 'image', 'conditionPack') if k in i}
                                             for i in identities], [256, 192],
                                            dict(generator=len(schedule), discriminator=len(schedule)), artifacts,
                                            binding('ml/ai-painter/scripts/training_observation_recorder_v1.py')))
    if p['arm'] == 'balanced-boundary':
        pkg['boundaryInputBindings'] = boundary_input_bindings(identities)
    run = 'replay-retention-' + p['arm'] + '-v1-' + common.digest(json.dumps(pkg, sort_keys=True).encode())[:20]
    pkg.update(experimentIdentity=run, outputRoot=common.OUTPUT + run)
    validate_package(pkg, p); reader.unchanged(); resource()
    target = pkg['outputRoot'] + '/package.json'
    if (ROOT / target).exists():
        need(read(binding(target)) == pkg, 'package changed')
        return binding(target)
    result = save(target, pkg)
    save(pkg['outputRoot'] + '/cpu-source-check.json', dict(status='passed', recordedAtUtc=common.now(),
         modelParameterElements=2243023, selectedSampleIds=pkg['selectedSampleIds'], parentStateHashes=initial,
         ownCpuReviewPixelsExactlyEqual=True, optimizerUpdates=0, cudaInitialized=False,
         note='CPU source, exact parent reload and149 CPU pixels only; own all-selected GPU gate still required'))
    return result


def execute(bound):
    started = time.monotonic()
    pkg = read(bound)
    p = read(pkg['policy'])
    validate_package(pkg, p)
    out = pkg['outputRoot']
    need(bound['path'] == out + '/package.json', 'exact replay package path')
    for b in pkg['inputs'] + pkg['programs'] + [pkg['policy'], pkg['specification']]:
        need(binding(b['path']) == b, 'frozen input/source changed: ' + b['path'])
    api = imports()
    torch, np, psutil, auth, profile, worker, cpu, derive, codec, values, metrics = api
    if p['arm'] == 'balanced-boundary':
        profile = BoundaryProfile(profile.background)
    from painter_learning_capacity_experiment import verify_controller_process
    lease = read(binding(out + '/controller-lease.json'))
    registry_path = ROOT / '.runtime/ai-painter/current-execution-registry/current.json'
    registry_raw = registry_path.read_bytes()
    need(common.digest(registry_raw) == lease['registrySha256'], 'registry lease changed')
    verify_controller_process(lease, json.loads(registry_raw), os.getppid())
    save(out + '/worker-started.json', dict(recordedAtUtc=common.now(), pid=os.getpid(), package=bound))
    observer = ObservationRecorder(ROOT, pkg, bound, json.loads(registry_raw)['activeExecution'])
    counts = dict(generator=0, discriminator=0)
    visits = dict.fromkeys(pkg['selectedSampleIds'], 0)
    artifacts, proofs = [], []
    phase, active_sample, gpu = 'loading', None, False
    model = critic = None
    last_poll, device_id = 0, None
    parent_hashes = initial_hashes = final_hashes = None
    same_parent_start = False
    admission = dict(selectedSampleCount=len(visits), completedSampleCount=0, passed=False)

    def disk_bytes():
        return sum(f.stat().st_size for f in (ROOT / out).rglob('*') if f.is_file())

    def put(name, value, *, failure=False):
        raw = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2).encode()
        # Retain the original capture, metadata and terminal space inside128MiB.
        reserve = 65536 if failure else 65 * 1024 ** 2 + 65536
        need(disk_bytes() + len(raw) <= 128 * 1024 ** 2 - reserve, 'replay output and failure reserve')
        b = save(out + '/' + name, raw)
        artifacts.append(b)
        return b

    def guard():
        nonlocal last_poll, device_id
        need(time.monotonic() - started < p['resources']['maxWallSeconds'], 'replay wall budget exhausted')
        need(disk_bytes() < 63 * 1024 ** 2 - 65536, 'replay output reserve')
        need(psutil.disk_usage(str(ROOT / out)).free > 2048 * 1024 ** 2, 'disk floor')
        need(psutil.pid_exists(lease['workerParentPid']), 'controller disappeared')
        current = json.loads(registry_path.read_bytes())
        need(current['runId'] == pkg['experimentIdentity'] and current['activeExecution'] is not None,
             'execution no longer active')
        heartbeat = json.loads((ROOT / out / 'heartbeat.json').read_bytes())
        need(time.time() - datetime.fromisoformat(heartbeat['heartbeatAtUtc'].replace('Z', '+00:00')).timestamp() < 120,
             'heartbeat stale')
        if time.monotonic() - last_poll > 3:
            data = subprocess.run(['nvidia-smi', '--query-gpu=uuid,temperature.gpu,memory.free',
                                   '--format=csv,noheader,nounits', '-i', '0'],
                                  capture_output=True, text=True, check=True, timeout=10).stdout.strip().split(',')
            need(len(data) == 3 and float(data[1]) < 85 and float(data[2]) >= 2048, 'GPU resource boundary')
            if device_id is None:
                device_id = data[0].strip()
            need(device_id == data[0].strip(), 'GPU changed')
            last_poll = time.monotonic()

    def observe(step, sample):
        guard()
        modes = [(m, m.training) for m in model.modules()]
        clock = start_clock()
        try:
            model.eval()
            with torch.inference_mode():
                prediction = profile.sample_forward(model, sample).detach().cpu()
        finally:
            for module, mode in modes:
                module.training = mode
        from PIL import Image
        buf = io.BytesIO()
        pixels = (prediction[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype('uint8')
        Image.fromarray(pixels).save(buf, format='PNG')
        image = put(f'prediction-149-{step:03}.png', buf.getvalue())
        observer.attempt(lambda: observer.artifact('prediction', image, step, sampleId=SAMPLE, split='train',
                         resolution=[256, 192], measurementScope='fixed_sample_evaluation',
                         imageTiming=finish_clock(clock, IMAGE_SCOPE)))
        score = metrics(prediction, sample, order)
        record = put(f'observation-149-{step:03}.json', dict(step=step, optimizerSteps=dict(counts),
                     sampleId=SAMPLE, prediction=image, metrics=score, predictionDevice='cuda:0', recordedAtUtc=common.now()))
        observer.attempt(lambda: observer.artifact('metrics', record, step, sampleId=SAMPLE, split='train',
                                                  measurementScope='fixed_sample_evaluation'))
        return prediction, image, score

    try:
        reader = cpu.BoundReader(ROOT)
        plan, selected, samples, identities, order, model, critic = source(reader, p, api, guard)
        need(identities == pkg['sampleIdentities'], 'sample identities changed')
        need(pkg['sourcePlan'] == selected['sourcePlan'] and pkg['sourceTerminal'] == PARENT['terminal'],
             'same parent source plan and terminal required')
        if p['arm'] == 'short':
            need(pkg['a100Reference'] == reference_a100(reader), 'saved A comparison evidence changed')
        by_id = {s['sampleId']: s for s in samples}
        parent_hashes = dict(generator=state_hash(model), discriminator=state_hash(critic))
        need(parent_hashes == pkg['parentStateHashes'], 'parent G/D start state differs')
        torch.manual_seed(20260929); np.random.seed(20260929); random.seed(20260929)
        need(torch.cuda.is_available(), 'CUDA unavailable')
        guard(); torch.cuda.set_per_process_memory_fraction(.7); torch.cuda.set_device(0)
        model.to('cuda:0'); critic.to('cuda:0'); gpu = True
        initial_hashes = dict(generator=state_hash(model), discriminator=state_hash(critic))
        need(initial_hashes == parent_hashes, 'CPU to GPU parent state differs')
        initial_modes = dict(generator=model.training, discriminator=critic.training)
        phase = 'zero_update_gpu'
        observer.attempt(lambda: observer.progress(counts, phase, gpu_started=True))
        for sample in samples:
            active_sample = sample['sampleId']; probe_failure = {}
            # Omit overrides exactly as the completed single149 A route did.
            proof = profile.zero_update_probe(model, critic, sample, order, guard, failure_evidence=probe_failure)
            proofs.append(dict(sampleId=active_sample, proof=proof))
            admission['completedSampleCount'] = len(proofs)
            put(f'zero-update-gpu-probe-{len(proofs):03}.json', proofs[-1])
        admission = verify_admission(proofs, pkg['selectedSampleIds'])
        need(dict(generator=state_hash(model), discriminator=state_hash(critic)) == initial_hashes,
             'admission changed parent G/D state')
        need(initial_modes == dict(generator=model.training, discriminator=critic.training), 'admission changed model modes')
        put('zero-update-gpu-probes.json', dict(admission=admission, cases=proofs,
            initialStateHashes=initial_hashes, finalStateHashes=initial_hashes, initialModes=initial_modes,
            optimizerCreated=False, optimizerUpdates=0))
        baseline, baseline_binding, _ = observe(0, by_id[SAMPLE])
        from PIL import Image
        old = np.asarray(Image.open(io.BytesIO(reader.read(PARENT['prediction']))).convert('RGB'))
        new = (baseline[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255).round().astype('uint8')
        need(np.array_equal(old, new), 'same-parent149 initial GPU prediction differs')
        same_parent_start = True
        put('parent-output-continuity.json', dict(parentCheckpoint=PARENT['checkpoint'], parentPrediction=PARENT['prediction'],
            newBaselinePrediction=baseline_binding, quantizedRgbPixelsExactlyEqual=True, parentStateHashes=parent_hashes,
            initialStateHashes=initial_hashes, optimizerMomentsRestored=False, initialModes=initial_modes))
        need({b['path'] for b in project_sources()} <= {b['path'] for b in pkg['programs']},
             'undeclared loaded source before optimization')
        need(all(binding(b['path']) == b for b in pkg['programs']), 'source changed before optimization')
        args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
        go = torch.optim.AdamW(model.parameters(), **args)
        do = torch.optim.AdamW(critic.parameters(), **args)
        need(len(go.state) == len(do.state) == 0, 'parent optimizer moments cannot initialize this arm')
        phase = 'training'; model.train(); critic.train()
        for step, sid in enumerate(pkg['schedule'], 1):
            guard(); active_sample = sid; sample = by_id[sid]
            ledger = dict(sampleId=sid, generator=0, discriminator=0)
            result = worker.observed_pair(profile.perform_pair, model, model, critic, sample, order,
                                          go, do, counts, ledger, guard, None)
            commit_pair(counts, ledger, step, sid)
            visits[sid] += 1
            observer.committed_metric(counts, sid, values, put, result)
            observer.attempt(lambda: observer.progress(counts, phase, gpu_started=True))
            if step in p['training']['observations']:
                observe(step, by_id[SAMPLE])
        need(same(visits, pkg['plannedSampleVisits']), 'actual replay visits differ')
        if p['arm'] == 'short':
            reference = pkg['a100Reference']['artifacts']
            differences, unavailable = [], []
            for step in range(1, 101):
                name = f'learning/step-{step:03}.json'
                if name not in reference:
                    unavailable.append(step)
                    continue
                original = reader.json(reference[name])
                current = read(binding(out + '/' + name)) if (ROOT / out / name).exists() else None
                if current is None or not same(original.get('values'), current.get('values')):
                    differences.append(step)
            image_equal = None
            if 'prediction-100.png' in reference:
                old_image = np.asarray(Image.open(io.BytesIO(reader.read(reference['prediction-100.png']))).convert('RGB'))
                new_image = np.asarray(Image.open(ROOT / out / 'prediction-149-100.png').convert('RGB'))
                image_equal = bool(np.array_equal(old_image, new_image))
            put('reference-a100-comparison.json', dict(reference=pkg['a100Reference'],
                quantizedGpuRgbPixelsExactlyEqual=image_equal, scalarDifferenceSteps=differences,
                unavailableOriginalScalarSteps=unavailable, pairedSteps=100, numericalGateChanged=False,
                interpretation='same_parent_fresh_optimizer_100step_reproduction_observation_only_differences_do_not_change_gates'))
        phase = 'checkpoint'; guard()
        state = dict(schema=STATE_SCHEMA, packageSha256=bound['sha256'], counts=dict(counts), sampleVisits=visits,
                     checkpointPromotable=False, model={k: v.detach().cpu() for k, v in model.state_dict().items()},
                     critic={k: v.detach().cpu() for k, v in critic.state_dict().items()})
        for key in ('arm', 'modelCapability', 'sourcePlan', 'parentExperiment', 'training'):
            state[key] = pkg[key]
        buf = io.BytesIO(); torch.save(state, buf)
        ck = put('checkpoint-final.pt', buf.getvalue())
        loaded = torch.load(io.BytesIO(reader.read(ck)), map_location='cpu', weights_only=True)
        validate_saved_checkpoint(loaded, bound, pkg)
        fresh, fresh_critic = profile.fresh_networks(order)
        fresh.load_state_dict(loaded['model'], strict=True); fresh_critic.load_state_dict(loaded['critic'], strict=True)
        for original, reloaded in ((model, fresh), (critic, fresh_critic)):
            need(all(torch.equal(v.detach().cpu(), reloaded.state_dict()[k]) for k, v in original.state_dict().items()),
                 'strict complete state reload differs')
        final_hashes = dict(generator=state_hash(fresh), discriminator=state_hash(fresh_critic))
        fresh.to('cuda:0'); fresh.eval(); model.eval()
        with torch.inference_mode():
            for sample in samples:
                guard()
                need(torch.equal(profile.sample_forward(model, sample), profile.sample_forward(fresh, sample)),
                     'strict reload original GPU RGB differs')
        reader.unchanged()
        need(all(binding(b['path']) == b for b in pkg['programs']), 'source changed after training')
        guard()
        observer.attempt(lambda: observer.artifact('checkpoint', ck, counts['generator'], promotable=False))
        observation = observer.attempt(lambda: observer.finish(counts, 'completed', phase))
        put('result.json', dict(status='experiment_executed_not_visual_qualified', experimentIdentity=pkg['experimentIdentity'],
            **(dict(trainingObjective=BOUNDARY_OBJECTIVE) if p['arm'] == 'balanced-boundary' else {}),
            recordedAtUtc=common.now(), gpuStarted=True, trainingStarted=True, arm=p['arm'], modelCapability=CAPABILITY,
            optimizerSteps=dict(counts), plannedSampleVisits=pkg['plannedSampleVisits'], sampleVisits=dict(visits),
            targetUpdates=visits[SAMPLE], replayUpdates=sum(visits.values()) - visits[SAMPLE],
            sampleVisitScope='fully_committed_generator_discriminator_pairs', zeroUpdateAdmission=admission,
            parentStateHashes=parent_hashes, initialStateHashes=initial_hashes, finalStateHashes=final_hashes,
            sameParentStartVerified=same_parent_start, backgroundObjectiveFunctionUnchanged=True, checkpointReloadExact=True,
            artifacts=list(artifacts), elapsedSeconds=time.monotonic() - started, formalQualificationGranted=False,
            trainingObservation=observation, observationSecondaryErrors=observer.errors))
    except BaseException as error:
        evidence = getattr(error, 'object_support_gradient_evidence', {})
        try:
            gradients = evidence.get('rawGradients', [])
            if gradients and model is not None:
                buf = io.BytesIO()
                torch.save(dict(gradients=[[None if x is None else x.detach().cpu() for x in row] for row in gradients],
                                labels=evidence.get('componentsInOrder'), sampleId=active_sample, counts=dict(counts),
                                model={k: v.detach().cpu() for k, v in model.state_dict().items()},
                                critic={k: v.detach().cpu() for k, v in critic.state_dict().items()}), buf)
                need(len(buf.getvalue()) <= 64 * 1024 ** 2, 'failure capture ceiling')
                put('gradient-failure-tensors.pt', buf.getvalue(), failure=True)
        except BaseException as secondary:
            observer.attempt(lambda: put('capture-error.json', dict(errorType=type(secondary).__name__), failure=True))
        observation = observer.attempt(lambda: observer.finish(counts, 'failed_closed', phase))
        try:
            put('result.json', dict(status='experiment_failed_closed', experimentIdentity=pkg['experimentIdentity'],
                **(dict(trainingObjective=BOUNDARY_OBJECTIVE) if p['arm'] == 'balanced-boundary' else {}),
                recordedAtUtc=common.now(), phase=phase, sampleId=active_sample, error=str(error), errorType=type(error).__name__,
                gpuStarted=gpu, trainingStarted=any(counts.values()), optimizerSteps=dict(counts),
                plannedSampleVisits=pkg['plannedSampleVisits'], sampleVisits=dict(visits), arm=p['arm'], modelCapability=CAPABILITY,
                targetUpdates=visits[SAMPLE], replayUpdates=sum(visits.values()) - visits[SAMPLE],
                zeroUpdateAdmission=admission, parentStateHashes=parent_hashes, initialStateHashes=initial_hashes,
                finalStateHashes=final_hashes, checkpointReloadExact=False, sameParentStartVerified=same_parent_start,
                artifacts=list(artifacts), elapsedSeconds=time.monotonic() - started, formalQualificationGranted=False,
                probeFailure=locals().get('probe_failure', {}), trainingObservation=observation,
                observationSecondaryErrors=observer.errors), failure=True)
        except Exception:
            print('training_result_publication_failed_original_error_preserved', file=sys.stderr, flush=True)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'run'])
    parser.add_argument('--policy', choices=tuple(POLICIES.values()))
    parser.add_argument('--package'); parser.add_argument('--sha256')
    args = parser.parse_args()
    if args.mode == 'prepare':
        print(json.dumps(prepare(args.policy)))
    else:
        execute(dict(path=args.package, sha256=args.sha256))
