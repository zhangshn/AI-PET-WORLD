"""Read-only authenticated foundation -> candidate initialization connection.

No optimizer, training, forward pass or new model checkpoint is permitted here.
Hash authentication means identity of project-bound bytes, not external trust,
historical data qualification or runtime capability publication.
"""
import json
import os
from pathlib import Path
import re

from probe_foundation_cpu_load import read_binding, decode_bound_autoencoder, digest

ROOT = Path(__file__).resolve().parents[3]
POLICY = {'path': 'data/ai-painter/system-governance/ai-painter-candidate-cpu-initialization-policy-v1.json',
          'sha256': 'cf1caa18974ea128f7fc2660c51ca270ff9902aaedae86e09a1c1423cedbdf6f'}
PROGRAMS = (
    'ml/ai-painter/scripts/initialize_authenticated_split_smoke_cpu.py',
    'ml/ai-painter/tests/test_authenticated_split_smoke_cpu_initialization.py',
    'ml/ai-painter/scripts/probe_foundation_cpu_load.py',
    'ml/ai-painter/scripts/stage4_split_smoke_cpu_execution.py',
    'ml/ai-painter/scripts/stage4_split_smoke_checkpoint.py',
    'ml/ai-painter/scripts/stage4_split_isolated_smoke.py',
    'ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py',
    'ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py',
    'ml/ai-painter/src/ai_painter/__init__.py',
    'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
    'ml/ai-painter/src/ai_painter/complete_world/model.py',
    'ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py',
    'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
    'ml/ai-painter/src/ai_painter/complete_world/split_release.py',
    'ml/ai-painter/src/ai_painter/complete_world/split_training.py',
    'ml/ai-painter/src/ai_painter/training/__init__.py',
    'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
    'scripts/check-ai-painter-candidate-cpu-initialization.mjs',
    'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
    'scripts/lib/ai-painter-owned-worker-v1.mjs',
    'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
    'scripts/windows/ai-painter-owned-worker-owner.cs',
)


def require(value, message):
    if not value:
        raise ValueError(message)


def verify_request(request):
    require(isinstance(request, dict) and set(request) == {'schemaVersion', 'runId', 'policy', 'programBindings'}, 'request fields invalid')
    require(request['schemaVersion'] == 'candidate-cpu-initialization-request-v1', 'request schema invalid')
    require(isinstance(request['runId'], str) and re.fullmatch(r'candidate-cpu-init-[a-f0-9-]{36}', request['runId']), 'run identity invalid')
    require(request['policy'] == POLICY, 'policy substitution refused')
    bindings = request['programBindings']
    require(isinstance(bindings, list) and len(bindings) == len(PROGRAMS)
            and all(isinstance(b, dict) and set(b) == {'path', 'sha256'} for b in bindings)
            and {b['path'] for b in bindings} == set(PROGRAMS), 'program bindings incomplete')
    policy = json.loads(read_binding(POLICY))
    for binding in bindings:
        read_binding(binding)
    load_policy = json.loads(read_binding(policy['foundationLoadPolicy']))
    foundation = json.loads(read_binding(load_policy['foundationContract']))
    require(foundation['activation']['checkpointDeserializationAllowedDuringCpuValidation'] is False, 'old static contract changed')
    component = json.loads(read_binding(policy['componentContract']))
    parent = json.loads(read_binding(component['parentCapability']))
    expected = load_policy['foundationContract']
    require({k: parent['foundationAssetBinding'][k] for k in ('path', 'sha256')} == expected, 'candidate foundation substitution')
    manifest = json.loads(read_binding(foundation['sourceManifest']))
    require(manifest['checkpointPath'] == foundation['checkpoint']['path']
            and manifest['checkpointSha256'] == foundation['checkpoint']['sha256'], 'foundation manifest mismatch')
    return policy, load_policy, foundation


def run_initialization(request):
    policy, load_policy, foundation = verify_request(request)
    require(os.environ.get('CUDA_VISIBLE_DEVICES') == '', 'CPU-only environment required')
    import torch
    from stage4_split_smoke_cpu_execution import initialize_cpu_candidate
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    torch.set_num_threads(policy['resources']['threads'])
    cp = foundation['checkpoint']
    data = read_binding(cp, policy['resources']['maxCheckpointBytes'])
    state = decode_bound_autoencoder(data, cp['sha256'], cp['bytes'], foundation['sourceManifest'])
    state_identity = state_hash(state)
    args = dict(root=ROOT, component_binding=policy['componentContract'],
                foundation_state=state, foundation_state_sha256=state_identity)
    _, _, first, first_evidence = initialize_cpu_candidate(**args)
    first_state = state_hash(first.state_dict())
    require(first_evidence['foundationBoundaryEvidence']['stateSha256'] == state_dict_sha256(state), 'loaded tensor identity conflict')
    del first
    _, _, second, second_evidence = initialize_cpu_candidate(**args)
    require(first_evidence == second_evidence and state_hash(second.state_dict()) == first_state,
            'fresh candidate initialization not reproducible')
    require(all(t.grad is None for t in second.parameters()), 'initialization produced parameter gradients')
    require(state_hash(state) == state_identity, 'foundation source state changed')
    verify_request(request)
    require(digest(read_binding(cp)) == cp['sha256'], 'foundation changed during initialization')
    return {'schemaVersion': 'candidate-cpu-authenticated-initialization-result-v1', 'runId': request['runId'],
        'status': 'candidate_cpu_initialized_not_training_qualified', 'pid': os.getpid(), 'device': 'cpu',
        'policy': POLICY, 'component': policy['componentContract'], 'foundationContract': load_policy['foundationContract'],
        'loadedCheckpoint': {k: cp[k] for k in ('path', 'sha256')}, 'sourceManifest': foundation['sourceManifest'],
        'initialization': first_evidence, 'loadedFoundationByteIdentityVerified': True,
        'freshDenoiserReproduced': True, 'initializedModelStateSha256': first_state,
        'foundationStateSha256': state_identity, 'foundationStateIdentityAlgorithm': 'split_training.state_hash',
        'foundationRuntimeStateSha256': state_dict_sha256(state),
        'foundationRuntimeStateIdentityAlgorithm': 'sha256_sorted_tensor_bytes_v1',
        'optimizerCreated': False, 'optimizerSteps': 0, 'forwardOrBackwardExecuted': False,
        'datasetRawBindingBytesRead': True, 'datasetTensorsDecoded': False,
        'historicalDenoiserLoaded': False, 'checkpointWritten': False, 'gpuStarted': False,
        'trainingFreezeProven': False, 'dataQualified': False, 'trainingAllowed': False, 'capabilityReleased': False}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--request', required=True)
    parser.add_argument('--request-sha256', required=True)
    args = parser.parse_args()
    require(args.request.startswith('.runtime/ai-painter/candidate-cpu-initializations/'), 'request namespace invalid')
    request = json.loads(read_binding({'path': args.request, 'sha256': args.request_sha256}))
    print(json.dumps(run_initialization(request)))
