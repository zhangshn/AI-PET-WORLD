"""Pure standard-library observation recorder; never imports or updates a model.

Writes only this package's declared observation files. Callers keep the original
training result/error independent from observation collection errors.
"""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

VERSION = 'training-observation-recorder-v1'
SCOPE = 'worker_data_model_loading_updates_checkpoint_validation_before_result_publication'
IMAGE_SCOPE = 'prediction_forward_cpu_transfer_png_encoding_and_publication'


def utc():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def descriptor(samples, resolution, ceiling, artifact_plan, producer):
    return dict(schemaVersion='ai-painter-training-interface-contract-v2', purpose='observation_only',
                producerVersion=VERSION, recordFile='training-observation.json', progressFile='progress.json',
                samples=samples, resolution=resolution, optimizerStepCeiling=ceiling,
                artifactPlan=artifact_plan, producer=producer)


def start_clock():
    return utc(), time.monotonic()


def finish_clock(start, scope, status='completed'):
    return dict(scope=scope, status=status, startedAtUtc=start[0], endedAtUtc=utc(),
                elapsedSeconds=time.monotonic() - start[1])


class ObservationRecorder:
    def __init__(self, root, package, bound, identity):
        self.root, self.package, self.bound = Path(root), package, bound
        self.output = package['outputRoot']
        if not self.output.startswith('.runtime/ai-painter/') or any(p in ('', '.', '..') for p in self.output.split('/')) or '\\' in self.output:
            raise ValueError('training_observation_output_boundary')
        if bound['path'] != self.output + '/package.json' or hashlib.sha256((self.root / bound['path']).read_bytes()).hexdigest() != bound['sha256']:
            raise ValueError('training_observation_package_binding_conflict')
        self.contract = package['interfaceContract']
        if self.contract['schemaVersion'] != 'ai-painter-training-interface-contract-v2':
            raise ValueError('training_observation_contract_unsupported')
        if self.contract['recordFile'] != 'training-observation.json' or self.contract['progressFile'] != 'progress.json':
            raise ValueError('training_observation_path_invalid')
        self.run = package.get('runId', package.get('experimentIdentity'))
        if self.output.split('/')[-1] != self.run or identity['runId'] != self.run:
            raise ValueError('training_observation_run_conflict')
        if type(identity.get('processId')) is not int or identity['processId'] <= 0 or not isinstance(identity.get('processStartIdentity'), str) or not identity['processStartIdentity']:
            raise ValueError('training_observation_process_identity_invalid')
        self.identity = {k: identity[k] for k in ('runId', 'packageId', 'capabilityVersion', 'processId', 'processStartIdentity')}
        self.start = start_clock()
        self.artifacts, self.errors, self.events = [], [], []
        # Publish before loading/zero-update work even when a new route forgets
        # its first explicit progress call. Collection IO remains secondary.
        self.attempt(lambda: self.progress(dict(generator=0, discriminator=0), 'loading'))

    def _write(self, name, value, replace=False):
        target = self.root / self.output / name
        raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
        limit = 65536 if name == 'progress.json' or name == 'program-events.json' else 512 * 1024
        if len(raw) > limit:
            raise ValueError('training_observation_byte_limit')
        if replace:
            # One writer, same directory. A failed replacement retains the last
            # published snapshot. No sleeps or changes to training budgets.
            staged = target.with_suffix('.json.pending')
            with staged.open('wb') as f:
                f.write(raw); f.flush(); os.fsync(f.fileno())
            os.replace(staged, target)
        else:
            with target.open('xb') as f:
                f.write(raw); f.flush(); os.fsync(f.fileno())
        return dict(path=target.relative_to(self.root).as_posix(), sha256=hashlib.sha256(raw).hexdigest())

    def attempt(self, action):
        try:
            return action()
        except Exception:
            if len(self.errors) < 8:
                self.errors.append('observation_collection_failed')
            return None

    def artifact(self, role, binding, step, **metadata):
        if len(self.artifacts) >= 2304 or not binding['path'].startswith(self.output + '/'):
            raise ValueError('training_observation_artifact_boundary')
        if any(a['binding']['path'] == binding['path'] for a in self.artifacts):
            raise ValueError('training_observation_artifact_duplicate')
        self.artifacts.append(dict(role=role, binding=binding, optimizerStep=step, **metadata))

    def committed_metric(self, counts, sample_id, extract, write, result):
        def collect():
            values, missing = extract(result)
            step = counts['generator']
            scope = 'original_pre_update_objectives_for_successfully_committed_pair'
            binding = write(f'learning/step-{step:03}.json', dict(recordedAtUtc=utc(), step=step,
                            sampleId=sample_id, optimizerSteps=dict(counts), values=values,
                            missingReason=missing, measurementScope=scope))
            self.artifact('metrics', binding, step, sampleId=sample_id, split='train', measurementScope=scope)
        return self.attempt(collect)

    def progress(self, counts, phase, *, gpu_started=False):
        for k in ('generator', 'discriminator'):
            if not isinstance(counts[k], int) or not 0 <= counts[k] <= self.contract['optimizerStepCeiling'][k]:
                raise ValueError('training_observation_counts_conflict')
        value = dict(schemaVersion='ai-painter-training-observation-progress-v1', **self.identity,
                     experimentIdentity=self.run, executionPackage=self.bound, updatedAtUtc=utc(),
                     executionState='executing', phase=phase, optimizerSteps=dict(counts),
                     gpuStarted=gpu_started, trainingStarted=any(counts.values()),
                     workerTiming=dict(scope=SCOPE, status='started', startedAtUtc=self.start[0], endedAtUtc=None, elapsedSeconds=None),
                     artifacts=[a for a in self.artifacts if a['role'] in ('prediction', 'diagnostic_composite', 'checkpoint')])
        self._write('progress.json', value, replace=True)

    def finish(self, counts, state, phase):
        # Safe event projection contains fixed codes/counters only, never raw
        # stderr, environment, credentials, paths from exceptions or model data.
        events = dict(schemaVersion='ai-painter-observation-program-events-v1', runId=self.run,
                      events=[dict(code='worker_' + state, phase=phase, optimizerSteps=dict(counts), recordedAtUtc=utc())])
        event_binding = self._write('program-events.json', events)
        self.artifact('program_events', event_binding, counts['generator'])
        value = dict(schemaVersion='ai-painter-training-observation-v1', runId=self.run,
                     executionPackage=self.bound, producerVersion=VERSION, recordedAtUtc=utc(),
                     executionState=state, optimizerSteps=dict(counts), qualificationGranted=False,
                     workerTiming=finish_clock(self.start, SCOPE, state), artifacts=self.artifacts,
                     secondaryErrors=self.errors)
        return self._write('training-observation.json', value)
