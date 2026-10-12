"""One bounded, zero-update V26 repeat diagnostic; never a GPU admission ticket.

The failed run and current training registry remain byte-identical. A new
immutable diagnostic work order/claim binds the failed package, exact train
ordinal zero, programs and resource ceiling. The parent enforces hard timeout.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from unittest.mock import patch

import torch

ROOT = Path(__file__).resolve().parents[3]
for entry in (ROOT / 'ml/ai-painter/src', ROOT / 'ml/ai-painter/scripts'):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))
import qualify_stage4_mvp256_dry_v26_gpu as q  # noqa: E402
from ai_painter.complete_world.object_head_core_priority_update_v24 import (  # noqa: E402
    generator_full_fp32_backend,
)

PROGRAM = 'ml/ai-painter/scripts/diagnose_stage4_v26_gpu_repeat.py'
TESTS = 'ml/ai-painter/tests/test_diagnose_stage4_v26_gpu_repeat.py'
FAILED_ROOT = ('.runtime/ai-painter/stage4-mvp256-dry-v26-executions/'
               'mvp256-dry-v26-e91f35a98891e4b5c21eafb864656d9b7fe170cb4ad4aac6')
OUTPUT = '.runtime/ai-painter/stage4-mvp256-dry-v26-executions/gpu-repeat-diagnostics'
REGISTRY = '.runtime/ai-painter/current-execution-registry/current.json'
SCOPE = {'attempts': 1, 'automaticRetries': 0, 'maxWallSeconds': 120,
         'cpuThreads': 2, 'maxGpuMemoryFraction': .7, 'maximumTemperatureC': 85,
         'minimumFreeVramMiB': 2048, 'minimumFreeDiskMiB': 2048,
         'maxOutputBytes': 2 * 1024**2, 'maximumForwards': 4,
         'autogradCalls': 0, 'optimizerSteps': 0, 'sampleSplit': 'train',
         'trainOrdinal': 0, 'paths': ['process_default', 'explicit_ieee_fp32']}


def require(value, message):
    if not value:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':'), allow_nan=False).encode('utf8')


def bind(path):
    return {'path': path, 'sha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest()}


def read(item):
    raw = q.core.cpu.project_file(ROOT, item['path']).read_bytes()
    require(hashlib.sha256(raw).hexdigest() == item['sha256'], 'bound input changed: ' + item['path'])
    return json.loads(raw)


def exclusive(path, value):
    target = q.core.cpu.project_file(ROOT, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False).encode('utf8') + b'\n'
    used = sum(item.stat().st_size for item in target.parent.iterdir() if item.is_file())
    require(used + len(raw) <= SCOPE['maxOutputBytes'], 'diagnostic total output exceeds cap')
    with target.open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return bind(path)


def prepare():
    failure_binding = bind(FAILED_ROOT + '/zero-update-gpu-qualification-failure.json')
    failure = read(failure_binding)
    require(failure['status'] == 'current_candidate_zero_update_gpu_qualification_failed_closed'
            and failure['completedCaseCount'] == 0
            and failure['optimizerSteps'] == {'generator': 0, 'discriminator': 0}
            and failure['error'] == 'V26 GPU train-mode output is not deterministic',
            'exact failed repeat gate required')
    package, policy, _ = q.check_package(failure['executionPackage'], check_registry=False)
    registry_binding = bind(REGISTRY)
    registry = read(registry_binding)
    require(registry['activeExecution'] is None and registry['nextMachineAction'] is None
            and registry['latestTrainingTerminal']['runId'] == failure['runId'],
            'current training must be inactive and point at the failed V26 run')
    cpu = read(policy['cpuAcceptance'])
    reader = q.core.cpu.BoundReader(ROOT)
    manifest = reader.json(package['datasetManifest'])
    membership = reader.json(package['trainSplit'])
    index = reader.json(manifest['sourceIndex'])
    first = next(row for row in index['samples'] if row['sampleId'] == membership['sampleIds'][0])
    require(first['split'] == 'train', 'only first bound train input allowed')
    reader.unchanged()
    payload = {'schemaVersion': 'ai-painter-v26-zero-update-repeat-workorder-v1',
               'status': 'diagnostic_only_not_training_or_qualification',
               'scope': SCOPE, 'failedGpuEvidence': failure_binding,
               'failedTerminal': bind(FAILED_ROOT + '/failure.json'),
               'failedExecutionPackage': failure['executionPackage'],
               'originalTrainingClaim': bind('.runtime/ai-painter/stage4-mvp256-dry-v26-executions/single-training-attempt-claim.json'),
               'registry': registry_binding, 'registryRevision': registry['registryRevision'],
               'sample': first, 'datasetManifest': package['datasetManifest'],
               'programBindings': {**cpu['programBindings'],
                                   'diagnostic': bind(PROGRAM), 'diagnosticTests': bind(TESTS)},
               'formalSpecification': cpu['formalSpecification'],
               'trainingAllowed': False, 'qualificationAllowed': False,
               'publicationAllowed': False}
    identity = hashlib.sha256(canonical(payload)).hexdigest()
    payload['diagnosticId'] = 'v26-repeat-' + identity[:32]
    payload['outputRoot'] = OUTPUT + '/' + payload['diagnosticId']
    payload['recordedAtUtc'] = datetime.now(timezone.utc).isoformat()
    return exclusive(payload['outputRoot'] + '/workorder.json', payload)


def check_workorder(binding):
    order = read(binding)
    require(order.get('scope') == SCOPE and order.get('trainingAllowed') is False
            and order.get('qualificationAllowed') is False
            and order.get('publicationAllowed') is False
            and order.get('status') == 'diagnostic_only_not_training_or_qualification',
            'diagnostic scope differs')
    require(order['outputRoot'] == OUTPUT + '/' + order['diagnosticId']
            and binding['path'] == order['outputRoot'] + '/workorder.json',
            'diagnostic output identity differs')
    for value in order['programBindings'].values():
        require(bind(value['path']) == value, 'diagnostic program changed')
    require(bind(order['formalSpecification']['path']) == order['formalSpecification'],
            'bound Markdown specification changed')
    read(order['failedGpuEvidence']); read(order['failedTerminal'])
    read(order['originalTrainingClaim'])
    registry = read(order['registry'])
    require(registry['activeExecution'] is None and registry['nextMachineAction'] is None,
            'concurrent current execution prohibited')
    q.check_package(order['failedExecutionPackage'], check_registry=False)
    return order


@contextmanager
def no_model_side_effects():
    with (patch.object(torch.optim.Optimizer, '__init__', side_effect=RuntimeError('diagnostic optimizer prohibited')),
          patch.object(torch, 'load', side_effect=RuntimeError('diagnostic checkpoint load prohibited')),
          patch.object(torch, 'save', side_effect=RuntimeError('diagnostic checkpoint write prohibited'))):
        yield


def difference(left, right):
    require(left.shape == right.shape and left.dtype == right.dtype, 'comparison metadata differs')
    require(bool(torch.isfinite(left).all()) and bool(torch.isfinite(right).all()), 'nonfinite diagnostic output')
    delta = (left.to(torch.float64) - right.to(torch.float64)).abs()
    changed = left != right
    positions = torch.nonzero(changed)
    first = positions[0].tolist() if len(positions) else None
    result = {'exactEqual': bool(torch.equal(left, right)), 'shape': list(left.shape),
              'dtype': str(left.dtype), 'changedElements': int(changed.sum()),
              'maxAbsoluteDifference': float(delta.max()) if delta.numel() else 0.0,
              'meanAbsoluteDifference': float(delta.mean()) if delta.numel() else 0.0,
              'firstChangedCoordinate': first}
    if first is not None:
        result['firstValues'] = [float(left[tuple(first)]), float(right[tuple(first)])]
    if left.ndim == 4 and left.shape[1] == 3:
        result['changedRgbPixels'] = int(changed.any(dim=1).sum())
    return result


def backend():
    return {'matmulFp32Precision': torch.backends.cuda.matmul.fp32_precision,
            'convolutionFp32Precision': torch.backends.cudnn.conv.fp32_precision,
            'cudnnBenchmark': torch.backends.cudnn.benchmark,
            'cudnnDeterministic': torch.backends.cudnn.deterministic,
            'deterministicAlgorithms': torch.are_deterministic_algorithms_enabled(),
            'autocastCuda': torch.is_autocast_enabled('cuda')}


def rng_state():
    return {'cpu': q.core.cpu.tensor_hash(torch.get_rng_state()),
            'cuda': [q.core.cpu.tensor_hash(value) for value in torch.cuda.get_rng_state_all()]}


def parent_identity_proof(claim, *, observed_parent=None, lookup=None):
    """Authenticate direct parent or the exact Windows venv redirector bridge.

    Windows venv python.exe is a redirector: it may insert one process between
    subprocess.run's caller and the real Python worker. Do not accept arbitrary
    ancestors or omit the expected supervisor's start-identity check.
    """
    expected = claim['processId']
    require(q.base.managed_worker.process_identity(expected) == claim['processStartIdentity'],
            'diagnostic parent exited or PID was reused')
    observed = os.getppid() if observed_parent is None else observed_parent
    if observed == expected:
        return {'kind': 'direct_parent', 'processId': expected,
                'processStartIdentity': claim['processStartIdentity']}
    require(os.name == 'nt', 'unexpected diagnostic parent on non-Windows')
    if lookup is None:
        command = ("$p=Get-CimInstance Win32_Process -Filter 'ProcessId = " + str(observed)
                   + "'; if($null -eq $p){exit 3}; $p | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress")
        output = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
                                capture_output=True, text=True, check=True, timeout=5,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        bridge = json.loads(output.stdout)
    else:
        bridge = lookup(observed)
    require(bridge.get('ProcessId') == observed and bridge.get('ParentProcessId') == expected
            and isinstance(bridge.get('ExecutablePath'), str)
            and os.path.normcase(os.path.realpath(bridge['ExecutablePath']))
            == os.path.normcase(os.path.realpath(sys.executable)),
            'diagnostic parent bridge is not the exact bound Python redirector')
    # Recheck the supervisor after examining the bridge; accepting PID alone
    # would allow a reused process to impersonate the diagnostic controller.
    require(q.base.managed_worker.process_identity(expected) == claim['processStartIdentity'],
            'diagnostic parent changed during bridge verification')
    return {'kind': 'verified_windows_venv_redirector', 'processId': expected,
            'processStartIdentity': claim['processStartIdentity'], 'bridge': bridge}


def forward_snapshot(model, conditions, instances):
    snapshots, handles = {}, []
    def keep(label, value):
        if isinstance(value, torch.Tensor):
            snapshots[label] = value.detach().cpu().clone()
        elif isinstance(value, (tuple, list)):
            for index, child in enumerate(value):
                keep(label + '/' + str(index), child)
        elif isinstance(value, dict):
            for key, child in value.items():
                keep(label + '/' + str(key), child)
    for name, module in model.named_modules():
        if name in ('core.core.terrain', 'core.core.appearance',
                    'core.core.footprint_head', 'core.core.final_rgb_decoder') or name.startswith('object_rgb_heads.') and name.count('.') == 1:
            handles.append(module.register_forward_pre_hook(
                lambda _module, args, key=name: keep('input/' + key, args[0])
                if isinstance(args[0], torch.Tensor) else None))
            handles.append(module.register_forward_hook(
                lambda _module, _args, output, key=name: keep('output/' + key, output)))
    try:
        with torch.no_grad():
            output, evidence = model(conditions[None], instances, return_evidence=True)
        keep('finalRgb', output)
        for key in ('terrainRgb', 'responsibilityFeatures', 'maskedObjectRgbResiduals',
                    'visibleObjectSupportMasks', 'objectResidualSum'):
            keep('evidence/' + key, evidence[key])
        return snapshots
    finally:
        for handle in handles:
            handle.remove()


def run_worker(binding):
    order = check_workorder(binding)
    claim = read(bind(order['outputRoot'] + '/claim.json'))
    require(claim['workorder'] == binding, 'diagnostic parent workorder differs')
    parent_proof = parent_identity_proof(claim)
    exclusive(order['outputRoot'] + '/worker-consumed.json', {
        'workorder': binding, 'processId': os.getpid(),
        'processStartIdentity': q.base.managed_worker.process_identity(os.getpid()),
        'recordedAtUtc': datetime.now(timezone.utc).isoformat()})
    started = time.monotonic()
    torch.set_num_threads(2)
    reader = q.core.cpu.BoundReader(ROOT)
    manifest, channel_order, continuous, _, _ = q.core.cpu.select_rows(reader)
    require(manifest['datasetReleaseIdentity'] == reader.json(order['datasetManifest'])['datasetReleaseIdentity'],
            'dataset changed')
    sample, sample_identity = q.core.cpu.load_sample(reader, order['sample'], channel_order, continuous)
    require(sample['split'] == 'train' and sample['sampleId'] == order['sample']['sampleId'], 'diagnostic train sample differs')
    reader.unchanged()
    require(torch.cuda.is_available(), 'CUDA unavailable')
    torch.cuda.set_device(0)
    free, total = torch.cuda.mem_get_info(0)
    allowance = int(total * .7) - (total - free) - 64 * 1024**2
    require(allowance > 0 and free >= 2048 * 1024**2, 'diagnostic free VRAM below floor')
    torch.cuda.set_per_process_memory_fraction(allowance / total, 0)
    torch.cuda.reset_peak_memory_stats(0)
    def resource():
        require(time.monotonic() - started < SCOPE['maxWallSeconds'], 'diagnostic timeout')
        read(order['registry'])
        require(shutil.disk_usage(ROOT / order['outputRoot']).free >= 2048 * 1024**2, 'diagnostic disk below floor')
        torch.cuda.synchronize(0)
        available, capacity = torch.cuda.mem_get_info(0)
        require(available >= 2048 * 1024**2, 'diagnostic free VRAM below floor')
        q.core.gpu.check_memory(total=int(capacity), reserved=int(torch.cuda.max_memory_reserved(0)),
                                allocated=int(torch.cuda.max_memory_allocated(0)),
                                device_used=int(capacity - available), fraction=.7)
        thermal = subprocess.run(['nvidia-smi', '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'],
                                 capture_output=True, text=True, timeout=5,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        require(thermal.returncode == 0 and thermal.stdout.strip()
                and int(thermal.stdout.strip().splitlines()[0]) <= 85, 'diagnostic temperature unavailable or above ceiling')
    resource()
    torch.manual_seed(q.base.MODEL_SEED)
    with no_model_side_effects():
        model, critic = q.worker.fresh_networks(channel_order)
        initial = {'Model': q.core.cpu.state_hash(model), 'Critic': q.core.cpu.state_hash(critic)}
        model.to('cuda:0').train()
        initial_modes = {name: module.training for name, module in model.named_modules()}
        conditions = sample['conditions'].to('cuda:0')
        source_before = {'conditions': q.core.cpu.tensor_hash(conditions), 'image': q.core.cpu.tensor_hash(sample['image']),
                         'instances': hashlib.sha256(canonical(sample['objectInstanceTable'])).hexdigest()}
        cpu_rng = torch.get_rng_state().clone()
        cuda_rng = torch.cuda.get_rng_state_all()
        original_backend = backend()
        results, first_outputs = {}, {}
        forwards = 0
        try:
            for mode in SCOPE['paths']:
                torch.set_rng_state(cpu_rng); torch.cuda.set_rng_state_all(cuda_rng)
                with generator_full_fp32_backend() if mode == 'explicit_ieee_fp32' else nullcontext():
                    effective = backend()
                    require(not effective['autocastCuda'], 'diagnostic autocast prohibited')
                    before = rng_state()
                    resource(); first = forward_snapshot(model, conditions, sample['objectInstanceTable']); forwards += 1
                    exclusive(order['outputRoot'] + '/forward-' + str(forwards) + '.json', {
                        'actualCompletedForwards': forwards, 'path': mode,
                        'optimizerSteps': 0, 'recordedAtUtc': datetime.now(timezone.utc).isoformat()})
                    middle = rng_state()
                    resource(); second = forward_snapshot(model, conditions, sample['objectInstanceTable']); forwards += 1
                    exclusive(order['outputRoot'] + '/forward-' + str(forwards) + '.json', {
                        'actualCompletedForwards': forwards, 'path': mode,
                        'optimizerSteps': 0, 'recordedAtUtc': datetime.now(timezone.utc).isoformat()})
                    after = rng_state()
                    require(first.keys() == second.keys(), 'intermediate trace changed')
                    comparisons = {key: difference(first[key], second[key]) for key in first}
                    results[mode] = {'backend': effective, 'rngBefore': before, 'rngBetween': middle,
                                     'rngAfter': after, 'rngUnchanged': before == middle == after,
                                     'repeat': comparisons['finalRgb'], 'intermediates': comparisons,
                                     'firstChangedTrace': next((key for key, value in comparisons.items() if not value['exactEqual']), None)}
                    first_outputs[mode] = first['finalRgb']
                    del first, second
                require(backend() == original_backend, 'diagnostic precision flags not restored')
            source_after = {'conditions': q.core.cpu.tensor_hash(conditions), 'image': q.core.cpu.tensor_hash(sample['image']),
                            'instances': hashlib.sha256(canonical(sample['objectInstanceTable'])).hexdigest()}
            final = {'Model': q.core.cpu.state_hash(model), 'Critic': q.core.cpu.state_hash(critic)}
            require(initial == final and source_before == source_after
                    and initial_modes == {name: module.training for name, module in model.named_modules()}
                    and all(value.grad is None for value in model.parameters()), 'diagnostic changed inputs/model state')
            resource(); reader.unchanged(); check_workorder(binding)
            report = {'schemaVersion': 'ai-painter-v26-gpu-repeat-diagnostic-v1',
                      'status': 'completed_diagnostic_only_not_qualification', 'workorder': binding,
                      'parentIdentityProof': parent_proof,
                      'sampleIdentity': sample_identity, 'sampleId': sample['sampleId'],
                      'initialStateSha256': initial, 'finalStateSha256': final,
                      'sourceTensorHashesBefore': source_before, 'sourceTensorHashesAfter': source_after,
                      'paths': results, 'crossPathFirstOutputs': difference(*first_outputs.values()),
                      'actualForwards': forwards, 'autogradCalls': 0, 'optimizerCreated': False,
                      'optimizerSteps': 0, 'checkpointLoaded': False, 'checkpointWritten': False,
                      'validationContentRead': False, 'challengeContentRead': False, 'regressionContentRead': False,
                      'registryUnchanged': True, 'oldTrainingClaimUnchanged': True,
                      'trainingAllowed': False, 'qualificationAllowed': False, 'stage4Percent': 60,
                      'oldFailureBackendReconstructed': False,
                      'environment': {'torch': torch.__version__, 'cuda': torch.version.cuda,
                                      'cudnn': torch.backends.cudnn.version(), 'gpu': torch.cuda.get_device_name(0)},
                      'peakGpuReservedBytes': torch.cuda.max_memory_reserved(0),
                      'elapsedSeconds': time.monotonic() - started,
                      'recordedAtUtc': datetime.now(timezone.utc).isoformat()}
        finally:
            torch.set_rng_state(cpu_rng); torch.cuda.set_rng_state_all(cuda_rng)
        require(rng_state() == {'cpu': q.core.cpu.tensor_hash(cpu_rng), 'cuda': [q.core.cpu.tensor_hash(value) for value in cuda_rng]},
                'diagnostic RNG restore failed')
        report['rngRestored'] = True
        return exclusive(order['outputRoot'] + '/report.json', report)


def execute(binding):
    started = time.monotonic()
    order = check_workorder(binding)
    exclusive(order['outputRoot'] + '/claim.json', {'workorder': binding, 'processId': os.getpid(),
              'processStartIdentity': q.base.managed_worker.process_identity(os.getpid()),
              'recordedAtUtc': datetime.now(timezone.utc).isoformat()})
    try:
        result = subprocess.run([sys.executable, '-B', str(ROOT / PROGRAM), '--worker',
                                 binding['path'], binding['sha256']], cwd=ROOT,
                                capture_output=True, timeout=max(1, SCOPE['maxWallSeconds'] - (time.monotonic() - started)),
                                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'},
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        logs = result.stdout + result.stderr
        require(len(logs) <= 128 * 1024, 'diagnostic logs exceed cap')
        if result.returncode != 0:
            raise RuntimeError('diagnostic child failed: ' + logs.decode('utf8', errors='replace')[-8192:])
        report_binding = bind(order['outputRoot'] + '/report.json')
        report = read(report_binding)
        require(report['status'] == 'completed_diagnostic_only_not_qualification'
                and report['actualForwards'] == 4 and report['optimizerSteps'] == 0,
                'diagnostic terminal differs')
        check_workorder(binding)
        return {'status': report['status'], 'report': report_binding, 'paths': {key: value['repeat'] for key, value in report['paths'].items()}}
    except Exception as error:
        completed = 0
        for ordinal in range(1, SCOPE['maximumForwards'] + 1):
            if (ROOT / order['outputRoot'] / ('forward-' + str(ordinal) + '.json')).exists():
                completed = ordinal
        failure = exclusive(order['outputRoot'] + '/failure.json', {
            'status': 'diagnostic_failed_closed_no_retry', 'workorder': binding,
            'errorType': type(error).__name__, 'error': str(error), 'optimizerSteps': 0,
            'actualCompletedForwards': completed,
            'trainingAllowed': False, 'qualificationAllowed': False,
            'elapsedSeconds': time.monotonic() - started,
            'recordedAtUtc': datetime.now(timezone.utc).isoformat()})
        return {'status': 'diagnostic_failed_closed_no_retry', 'failure': failure}


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--prepare', action='store_true')
    group.add_argument('--execute', nargs=2, metavar=('WORKORDER', 'SHA256'))
    group.add_argument('--worker', nargs=2, metavar=('WORKORDER', 'SHA256'))
    args = parser.parse_args()
    if args.prepare:
        result = prepare()
    else:
        pair = args.execute or args.worker
        item = {'path': pair[0], 'sha256': pair[1]}
        result = execute(item) if args.execute else run_worker(item)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    return 1 if result.get('status') == 'diagnostic_failed_closed_no_retry' else 0


if __name__ == '__main__':
    raise SystemExit(main())
