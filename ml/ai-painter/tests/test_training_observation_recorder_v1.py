import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).absolute().parents[1] / 'scripts'))
from training_observation_recorder_v1 import ObservationRecorder, descriptor


class ObservationRecorderTests(unittest.TestCase):
    def fixture(self, schema='cpu-fixture-route-a'):
        temp = tempfile.TemporaryDirectory(prefix='painter-observation-cpu-')
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        out = '.runtime/ai-painter/cpu-fixture/run'
        (root / out).mkdir(parents=True)
        pkg = dict(schemaVersion=schema, experimentIdentity='run', outputRoot=out,
                   interfaceContract=descriptor([], [1, 1], dict(generator=2, discriminator=2), [],
                                                dict(path='ml/ai-painter/fixture.py', sha256='a' * 64)))
        raw = json.dumps(pkg).encode()
        (root / out / 'package.json').write_bytes(raw)
        bound = dict(path=out + '/package.json', sha256=hashlib.sha256(raw).hexdigest())
        identity = dict(runId='run', packageId='run', capabilityVersion='run', processId=123, processStartIdentity='123:fixture')
        return root, pkg, bound, identity

    def test_two_route_names_keep_real_clocks_counts_and_byte_bindings(self):
        for schema in ('cpu-fixture-route-a', 'cpu-fixture-route-b'):
            with self.subTest(schema=schema):
                root, pkg, bound, identity = self.fixture(schema)
                recorder = ObservationRecorder(root, pkg, bound, identity)
                counts = dict(generator=1, discriminator=2)
                recorder.progress(counts, 'training')
                progress = json.loads((root / pkg['outputRoot'] / 'progress.json').read_bytes())
                self.assertEqual(progress['optimizerSteps'], counts)
                self.assertIsNone(progress['workerTiming']['endedAtUtc'])
                self.assertIsNone(progress['workerTiming']['elapsedSeconds'])
                binding = recorder.finish(counts, 'failed_closed', 'training')
                raw = (root / binding['path']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), binding['sha256'])
                value = json.loads(raw)
                self.assertEqual(value['executionPackage'], bound)
                self.assertEqual(value['optimizerSteps'], counts)
                self.assertEqual(value['workerTiming']['status'], 'failed_closed')
                self.assertGreaterEqual(value['workerTiming']['elapsedSeconds'], 0)
                self.assertFalse(value['qualificationGranted'])
                with self.assertRaises(FileExistsError):
                    recorder.finish(counts, 'completed', 'training')

    def test_sharing_error_retains_last_snapshot_and_is_secondary_to_training(self):
        root, pkg, bound, identity = self.fixture()
        recorder = ObservationRecorder(root, pkg, bound, identity)
        recorder.progress(dict(generator=0, discriminator=0), 'loading')
        p = root / pkg['outputRoot'] / 'progress.json'
        before = p.read_bytes()
        with patch('training_observation_recorder_v1.os.replace', side_effect=PermissionError('fixture')):
            self.assertIsNone(recorder.attempt(lambda: recorder.progress(dict(generator=1, discriminator=1), 'training')))
        self.assertEqual(p.read_bytes(), before)
        self.assertEqual(recorder.errors, ['observation_collection_failed'])
        binding = recorder.finish(dict(generator=1, discriminator=1), 'completed', 'checkpoint')
        self.assertEqual(json.loads((root / binding['path']).read_bytes())['secondaryErrors'], recorder.errors)

    def test_wrong_package_root_and_binding_are_rejected_before_publication(self):
        root, pkg, bound, identity = self.fixture()
        with self.assertRaises(ValueError):
            ObservationRecorder(root, pkg, dict(bound, sha256='b' * 64), identity)
        pkg['outputRoot'] = '.runtime/ai-painter/../run'
        with self.assertRaises(ValueError):
            ObservationRecorder(root, pkg, bound, identity)

    def test_learning_extraction_or_write_failure_cannot_escape_committed_pair_recording(self):
        root, pkg, bound, identity = self.fixture()
        recorder = ObservationRecorder(root, pkg, bound, identity)
        counts = dict(generator=1, discriminator=1)
        def broken(*args):
            raise OSError('fixture collection failure')
        self.assertIsNone(recorder.committed_metric(counts, 'sample', broken, broken, {}))
        self.assertIsNone(recorder.committed_metric(counts, 'sample', lambda result: ({'generatorLoss': 0.2}, None), broken, {}))
        self.assertEqual(counts, dict(generator=1, discriminator=1))
        self.assertEqual(recorder.errors, ['observation_collection_failed'] * 2)

    def test_construction_publishes_zero_step_start_with_registered_process_identity(self):
        root, pkg, bound, identity = self.fixture()
        recorder = ObservationRecorder(root, pkg, bound, identity)
        value = json.loads((root / pkg['outputRoot'] / 'progress.json').read_bytes())
        self.assertEqual(value['optimizerSteps'], dict(generator=0, discriminator=0))
        self.assertEqual(value['phase'], 'loading')
        self.assertFalse(value['trainingStarted'])
        self.assertEqual(value['processId'], identity['processId'])
        self.assertEqual(value['processStartIdentity'], identity['processStartIdentity'])
        self.assertEqual(value['workerTiming']['startedAtUtc'], recorder.start[0])

    def test_initial_publication_failure_is_secondary_and_missing_process_is_rejected(self):
        root, pkg, bound, identity = self.fixture()
        with patch('training_observation_recorder_v1.os.replace', side_effect=PermissionError('fixture')):
            recorder = ObservationRecorder(root, pkg, bound, identity)
        self.assertEqual(recorder.errors, ['observation_collection_failed'])
        recorder.progress(dict(generator=1, discriminator=1), 'training')
        for invalid in (None, 0, True):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                ObservationRecorder(root, pkg, bound, dict(identity, processId=invalid))


if __name__ == '__main__':
    unittest.main()
