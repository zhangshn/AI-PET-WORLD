"""Request/identity negatives only; this suite never reads checkpoint weights."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'ml/ai-painter/scripts'))
import initialize_authenticated_split_smoke_cpu as worker


class InitializationRequestTests(unittest.TestCase):
    def setUp(self):
        self.request = {'schemaVersion': 'candidate-cpu-initialization-request-v1',
            'runId': 'candidate-cpu-init-11111111-1111-1111-1111-111111111111', 'policy': worker.POLICY,
            'programBindings': [{'path': p, 'sha256': worker.digest((ROOT / p).read_bytes())} for p in worker.PROGRAMS]}

    def test_bound_request_preserves_old_static_contract(self):
        _, _, foundation = worker.verify_request(self.request)
        self.assertFalse(foundation['activation']['checkpointDeserializationAllowedDuringCpuValidation'])

    def test_policy_substitution_refused_before_checkpoint_loader(self):
        request = deepcopy(self.request)
        request['policy']['sha256'] = '0' * 64
        with patch.object(worker, 'decode_bound_autoencoder') as load, self.assertRaisesRegex(ValueError, 'policy substitution'):
            worker.run_initialization(request)
        load.assert_not_called()

    def test_extra_grant_refused(self):
        with self.assertRaisesRegex(ValueError, 'request fields'):
            worker.verify_request({**self.request, 'trainingAllowed': True})

    def test_missing_program_refused(self):
        self.request['programBindings'].pop()
        with self.assertRaisesRegex(ValueError, 'bindings incomplete'):
            worker.verify_request(self.request)

    def test_duplicate_program_refused(self):
        self.request['programBindings'][-1] = self.request['programBindings'][0]
        with self.assertRaisesRegex(ValueError, 'bindings incomplete'):
            worker.verify_request(self.request)

    def test_stale_program_refused(self):
        self.request['programBindings'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            worker.verify_request(self.request)

    def test_wrong_request_schema_refused(self):
        self.request['schemaVersion'] = 'training-request'
        with self.assertRaisesRegex(ValueError, 'schema invalid'):
            worker.verify_request(self.request)

    def test_path_as_run_identity_refused(self):
        self.request['runId'] = '../other'
        with self.assertRaisesRegex(ValueError, 'identity invalid'):
            worker.verify_request(self.request)

    def test_gpu_environment_refused_before_loader(self):
        with patch.dict(worker.os.environ, {'CUDA_VISIBLE_DEVICES': '0'}), \
                patch.object(worker, 'decode_bound_autoencoder') as load, \
                self.assertRaisesRegex(ValueError, 'CPU-only'):
            worker.run_initialization(self.request)
        load.assert_not_called()


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(InitializationRequestTests))
    print(json.dumps({'status': 'passed' if result.wasSuccessful() else 'failed', 'testsRun': result.testsRun,
        'failures': len(result.failures), 'errors': len(result.errors), 'realCheckpointLoaded': False, 'trainingAllowed': False}))
    sys.exit(0 if result.wasSuccessful() else 1)
