"""CPU assembly tests: real V2 network/Trainer, synthetic AE and 16x16 data.

Synthetic contract verification is mocked in component cases and explicitly
distinguished from the one real-candidate metadata/initializer check.
"""
from copy import deepcopy
from datetime import datetime, timezone
import json
import re
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
for p in (ROOT / 'ml/ai-painter/src', ROOT / 'ml/ai-painter/scripts', Path(__file__).resolve().parent):
    sys.path.insert(0, str(p))
import torch
import stage4_split_smoke_cpu_execution as execution
import stage4_split_smoke_checkpoint as checkpoint
from test_stage4_split_smoke import SyntheticDataset
from ai_painter.complete_world.split_release import canonical_bytes, digest
from ai_painter.complete_world.split_training import state_hash

REAL_COMPONENT = {'path': 'data/ai-painter/system-governance/stage4-split-isolated-smoke-v2-5e5401aeb2a031342607dc404eb6547cfb3097871927964f0b169553a3021a0a.json',
                  'sha256': '618f63949f25a5488cfc1b5496a5d273ba8f296b54d4684a17f622fcc3865470'}


class ExecutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(1)
        cls.config = execution.build_stage4_semantic_transport_v2_cpu_inactive_config(ROOT)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(419)
            model = execution.build_complete_world_system(cls.config).cpu()
        cls.foundation = {k: t.detach().clone() for k, t in model.autoencoder.state_dict().items()}
        cls.foundation_sha = state_hash(cls.foundation)
        cls.binding = {'path': 'synthetic/component.json', 'sha256': 'a' * 64}
        cls.contract = {'capabilityVersion': 'cpu-synthetic-assembly-not-qualified',
                        'derivedCpuConfigSha256': digest(canonical_bytes(cls.config)),
                        'datasetReleaseIdentity': 'synthetic-cpu-only-release',
                        'qualification': {'trainingAllowed': False}, 'schedule': {'seed': 20263722}, 'selections': {}}
        for split in ('train', 'validation'):
            rows = SyntheticDataset(split).rows[:1]
            cls.contract['selections'][split] = {'sampleIds': [split + '-a'], 'rowsSha256': digest(canonical_bytes(rows))}
        base = ROOT / '.runtime/ai-painter/split-smoke-cpu-execution-tests'
        base.mkdir(parents=True, exist_ok=True)
        cls.output = Path(tempfile.mkdtemp(prefix='run-', dir=base))
        cls.logical = '.runtime/ai-painter/split-smoke-cpu-execution-tests/' + cls.output.name

    def initialize(self, **changes):
        args = dict(root=ROOT, component_binding=self.binding, foundation_state=self.foundation,
                    foundation_state_sha256=self.foundation_sha)
        with patch.object(execution, 'verify_inactive_contract', return_value=deepcopy(self.contract)):
            return execution.initialize_cpu_candidate(**{**args, **changes})

    def execute(self, name, **changes):
        args = dict(root=ROOT, component_binding=self.binding, foundation_state=self.foundation,
                    foundation_state_sha256=self.foundation_sha, train_dataset=SyntheticDataset('train'),
                    validation_dataset=SyntheticDataset('validation'),
                    latent_normalization={'mean': torch.zeros(1, 12, 1, 1), 'standardDeviation': torch.ones(1, 12, 1, 1)},
                    run_id='cpu-assembly-' + name, checkpoint_path=self.logical + '/' + name + '.pt')
        with patch.object(execution, 'verify_inactive_contract', return_value=deepcopy(self.contract)):
            return execution.execute_cpu_candidate_step(**{**args, **changes})

    def test_fresh_denoiser_and_frozen_foundation_are_reproducible(self):
        rng = torch.get_rng_state().clone()
        _, _, first, a = self.initialize()
        _, _, second, b = self.initialize()
        self.assertEqual(a, b)
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertFalse(first.autoencoder.training)
        self.assertFalse(any(t.requires_grad for t in first.autoencoder.parameters()))
        self.assertFalse(a['foundationCheckpointAuthenticated'])
        self.assertFalse(a['historicalDenoiserLoaded'])

    def test_actual_candidate_metadata_binding_not_actual_foundation_qualification(self):
        _, _, _, evidence = execution.initialize_cpu_candidate(root=ROOT, component_binding=REAL_COMPONENT,
            foundation_state=self.foundation, foundation_state_sha256=self.foundation_sha)
        self.assertEqual(evidence['component'], REAL_COMPONENT)
        self.assertEqual(evidence['seed'], 20263722)
        self.assertFalse(evidence['foundationCheckpointAuthenticated'])
        self.assertFalse(evidence['trainingAllowed'])

    def test_bad_candidate_binding_refuses_before_factory(self):
        with patch.object(execution, 'build_complete_world_system') as factory, self.assertRaises(ValueError):
            execution.initialize_cpu_candidate(root=ROOT, component_binding={**REAL_COMPONENT, 'sha256': '0' * 64},
                foundation_state=self.foundation, foundation_state_sha256=self.foundation_sha)
        factory.assert_not_called()

    def test_foundation_tamper_refuses_before_factory(self):
        with patch.object(execution, 'build_complete_world_system') as factory, self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.initialize(foundation_state_sha256='0' * 64)
        factory.assert_not_called()

    def test_nonfinite_foundation_refused(self):
        state = {k: v.clone() for k, v in self.foundation.items()}
        next(iter(state.values())).flatten()[0] = float('nan')
        with self.assertRaisesRegex(ValueError, 'invalid CPU foundation'):
            self.initialize(foundation_state=state, foundation_state_sha256=state_hash(state))

    def test_model_and_old_denoiser_injection_not_in_api(self):
        for key in ('model', 'denoiser_state', 'initial_denoiser_checkpoint'):
            with self.subTest(key=key), self.assertRaises(TypeError):
                self.initialize(**{key: object()})

    def test_changed_derived_config_is_rejected(self):
        config = deepcopy(self.config)
        config['inferenceSteps'] += 1
        with patch.object(execution, 'build_stage4_semantic_transport_v2_cpu_inactive_config', return_value=config), \
                self.assertRaisesRegex(ValueError, 'candidate config mismatch'):
            self.initialize()

    def test_real_step_checkpoint_reload_and_repeat_output_refusal(self):
        result = self.execute('successful')
        self.assertEqual(result['training']['epochEvidence']['stepEvidence']['optimizerSteps'], 1)
        self.assertEqual(result['training']['epochEvidence']['stepEvidence']['nonTrainOptimizerSteps'], 0)
        self.assertEqual(result['training']['denoiserStateSha256'], result['reload']['denoiserStateSha256'])
        self.assertNotEqual(result['initialization']['initialDenoiserStateSha256'], result['reload']['denoiserStateSha256'])
        self.assertFalse(result['trainingAllowed'])
        self.assertFalse(result['dataQualified'])
        self.assertFalse(result['productionAdapterRegistered'])
        with (self.output / 'assembly-result.json').open('x', encoding='utf-8') as stream:
            json.dump(result, stream, indent=2)
        with patch.object(checkpoint, 'run_split_smoke_epoch') as epoch, self.assertRaises(FileExistsError):
            self.execute('successful')
        epoch.assert_not_called()

    def test_wrong_split_refuses_before_optimizer(self):
        with patch.object(torch.optim, 'AdamW') as optimizer, self.assertRaises(ValueError):
            self.execute('wrong-split', validation_dataset=SyntheticDataset('train'))
        optimizer.assert_not_called()

    def test_wrong_rows_refuse_before_optimizer(self):
        dataset = SyntheticDataset('train')
        dataset._rows[0]['unexpected'] = True
        with patch.object(torch.optim, 'AdamW') as optimizer, self.assertRaisesRegex(ValueError, 'selection rows mismatch'):
            self.execute('wrong-rows', train_dataset=dataset)
        optimizer.assert_not_called()

    def test_failed_epoch_cannot_be_retried_at_reserved_path(self):
        with patch.object(checkpoint, 'run_split_smoke_epoch', side_effect=ValueError('injected epoch failure')), \
                self.assertRaisesRegex(ValueError, 'injected epoch failure'):
            self.execute('failed')
        self.assertTrue((self.output / 'failed.pt').exists())
        with patch.object(checkpoint, 'run_split_smoke_epoch') as epoch, self.assertRaises(FileExistsError):
            self.execute('failed')
        epoch.assert_not_called()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--assembly-worker':
        # Synthetic-only worker exercised by the existing lifecycle regression.
        name, failure = sys.argv[2:]
        if not re.fullmatch(r'cpu-assembly-[a-z0-9-]{1,80}', name) or failure not in ('none', 'epoch', 'reload'):
            raise ValueError('invalid synthetic assembly worker request')
        ExecutionTests.setUpClass()
        case = ExecutionTests()
        try:
            if failure == 'epoch':
                with patch.object(checkpoint, 'run_split_smoke_epoch', side_effect=ValueError('injected_epoch_failure')):
                    value = case.execute(name)
            elif failure == 'reload':
                with patch.object(execution, 'reload_cpu_checkpoint', side_effect=ValueError('injected_reload_failure')):
                    value = case.execute(name)
            else:
                value = case.execute(name)
            output = {'status': 'passed', 'assembly': value}
        except Exception as error:
            output = {'status': 'failed', 'error': str(error),
                      'checkpointReserved': (ExecutionTests.output / (name + '.pt')).exists()}
        output.update(scope='synthetic_cpu_assembly_only', failureInjection=failure,
                      trainingAllowed=False, realDataTrainingStarted=False, gpuStarted=False)
        with (ExecutionTests.output / 'worker-result.json').open('x', encoding='utf-8') as stream:
            json.dump(output, stream, indent=2)
        print(json.dumps(output))
        sys.exit(0)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ExecutionTests))
    report = {'status': 'passed' if result.wasSuccessful() else 'failed', 'testsRun': result.testsRun,
        'failures': len(result.failures), 'errors': len(result.errors), 'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
        'scope': 'real_v2_trainer_synthetic_foundation_and_16x16_data_plus_real_candidate_metadata_check',
        'componentAdmissionMockedForSyntheticCases': True, 'realFoundationCheckpointLoaded': False,
        'realDatasetOptimizerUpdates': 0, 'productionAdapterRegistered': False, 'trainingAllowed': False,
        'gpuStarted': False, 'evidenceRoot': str(ExecutionTests.output)}
    with (ExecutionTests.output / 'report.json').open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps(report))
    sys.exit(0 if result.wasSuccessful() else 1)
