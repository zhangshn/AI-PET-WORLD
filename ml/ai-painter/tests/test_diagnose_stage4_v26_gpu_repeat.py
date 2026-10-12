"""CPU contracts for the isolated repeat diagnostic; never execute CUDA."""
import unittest
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch
import torch
import diagnose_stage4_v26_gpu_repeat as diagnostic


class RepeatDiagnosticTests(unittest.TestCase):
    def test_exact_and_changed_pixel_comparisons(self):
        left = torch.zeros(1, 3, 2, 2)
        self.assertTrue(diagnostic.difference(left, left.clone())['exactEqual'])
        right = left.clone(); right[0, 1, 0, 1] = 1e-6
        result = diagnostic.difference(left, right)
        self.assertEqual(result['changedElements'], 1)
        self.assertEqual(result['changedRgbPixels'], 1)
        self.assertEqual(result['firstChangedCoordinate'], [0, 1, 0, 1])
        self.assertGreater(result['maxAbsoluteDifference'], 0)

    def test_bad_comparisons_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'nonfinite'):
            diagnostic.difference(torch.tensor([float('nan')]), torch.zeros(1))
        with self.assertRaisesRegex(ValueError, 'metadata'):
            diagnostic.difference(torch.zeros(1), torch.zeros(2))

    def test_optimizer_checkpoint_and_load_are_blocked(self):
        with diagnostic.no_model_side_effects():
            with self.assertRaisesRegex(RuntimeError, 'optimizer prohibited'):
                torch.optim.AdamW([torch.nn.Parameter(torch.ones(1))])
            with self.assertRaisesRegex(RuntimeError, 'load prohibited'):
                torch.load('unused')
            with self.assertRaisesRegex(RuntimeError, 'write prohibited'):
                torch.save({}, 'unused')

    def test_scope_cannot_enable_training_or_expand_budget(self):
        for change in ({'trainingAllowed': True}, {'qualificationAllowed': True},
                       {'scope': {**diagnostic.SCOPE, 'maximumForwards': 5}}):
            order = {'scope': diagnostic.SCOPE, 'trainingAllowed': False,
                     'qualificationAllowed': False, 'publicationAllowed': False,
                     'status': 'diagnostic_only_not_training_or_qualification', **change}
            with patch.object(diagnostic, 'read', return_value=order):
                with self.assertRaisesRegex(ValueError, 'scope differs'):
                    diagnostic.check_workorder({})

    def test_output_scope_is_fixed(self):
        order = {'scope': diagnostic.SCOPE, 'trainingAllowed': False,
                 'qualificationAllowed': False, 'publicationAllowed': False,
                 'status': 'diagnostic_only_not_training_or_qualification',
                 'diagnosticId': 'one', 'outputRoot': 'wrong'}
        with patch.object(diagnostic, 'read', return_value=order):
            with self.assertRaisesRegex(ValueError, 'output identity'):
                diagnostic.check_workorder({'path': 'wrong'})

    def test_import_and_tests_do_not_initialize_cuda(self):
        self.assertFalse(torch.cuda.is_initialized())
        self.assertEqual(diagnostic.SCOPE['optimizerSteps'], 0)
        self.assertEqual(diagnostic.SCOPE['maximumForwards'], 4)

    def test_exclusive_claim_cannot_be_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(diagnostic, 'ROOT', Path(directory)):
                diagnostic.exclusive('test/claim.json', {'one': 1})
                with self.assertRaises(FileExistsError):
                    diagnostic.exclusive('test/claim.json', {'two': 2})

    def test_timeout_records_failure_without_retry(self):
        order = {'outputRoot': 'only-diagnostic'}
        writes = []
        def record(path, value):
            writes.append((path, value))
            return {'path': path, 'sha256': 'test-only'}
        with tempfile.TemporaryDirectory() as directory:
            with (patch.object(diagnostic, 'ROOT', Path(directory)),
                  patch.object(diagnostic, 'check_workorder', return_value=order),
                  patch.object(diagnostic, 'exclusive', side_effect=record),
                  patch.object(diagnostic.q.base.managed_worker, 'process_identity', return_value='test-only'),
                  patch.object(diagnostic.subprocess, 'run', side_effect=subprocess.TimeoutExpired('test', 120)) as runner):
                result = diagnostic.execute({'path': 'test', 'sha256': 'test-only'})
        self.assertEqual(result['status'], 'diagnostic_failed_closed_no_retry')
        self.assertEqual(runner.call_count, 1)
        self.assertEqual(writes[-1][1]['actualCompletedForwards'], 0)
        self.assertFalse(writes[-1][1]['trainingAllowed'])

    def test_bound_markdown_is_hash_checked_not_json_parsed(self):
        identity = {'path': 'formal.md', 'sha256': 'fixture'}
        root = diagnostic.OUTPUT + '/fixture'
        order = {'scope': diagnostic.SCOPE, 'trainingAllowed': False,
                 'qualificationAllowed': False, 'publicationAllowed': False,
                 'status': 'diagnostic_only_not_training_or_qualification',
                 'diagnosticId': 'fixture', 'outputRoot': root,
                 'programBindings': {}, 'formalSpecification': identity,
                 'failedGpuEvidence': {'path': 'failure.json'},
                 'failedTerminal': {'path': 'terminal.json'},
                 'originalTrainingClaim': {'path': 'claim.json'},
                 'registry': {'path': 'registry.json'}, 'failedExecutionPackage': {}}
        def json_read(item):
            if item.get('path') == 'formal.md':
                raise AssertionError('Markdown cannot be parsed as JSON')
            if item.get('path') == root + '/workorder.json':
                return order
            return {'activeExecution': None, 'nextMachineAction': None}
        with (patch.object(diagnostic, 'read', side_effect=json_read),
              patch.object(diagnostic, 'bind', return_value=identity),
              patch.object(diagnostic.q, 'check_package')):
            self.assertIs(diagnostic.check_workorder({'path': root + '/workorder.json'}), order)

    def test_direct_parent_still_requires_start_identity(self):
        claim = {'processId': 11, 'processStartIdentity': '11:exact'}
        with patch.object(diagnostic.q.base.managed_worker, 'process_identity', return_value='11:exact'):
            self.assertEqual(diagnostic.parent_identity_proof(claim, observed_parent=11)['kind'], 'direct_parent')
        with patch.object(diagnostic.q.base.managed_worker, 'process_identity', return_value='11:reused'):
            with self.assertRaisesRegex(ValueError, 'PID was reused'):
                diagnostic.parent_identity_proof(claim, observed_parent=11)

    def test_exact_windows_redirector_bridge_is_accepted(self):
        claim = {'processId': 11, 'processStartIdentity': '11:exact'}
        bridge = {'ProcessId': 22, 'ParentProcessId': 11, 'ExecutablePath': diagnostic.sys.executable}
        with patch.object(diagnostic.q.base.managed_worker, 'process_identity', return_value='11:exact'):
            proof = diagnostic.parent_identity_proof(claim, observed_parent=22, lookup=lambda _pid: bridge)
        self.assertEqual(proof['kind'], 'verified_windows_venv_redirector')

    def test_arbitrary_ancestor_or_executable_bridge_is_rejected(self):
        claim = {'processId': 11, 'processStartIdentity': '11:exact'}
        for bridge in ({'ProcessId': 22, 'ParentProcessId': 33, 'ExecutablePath': diagnostic.sys.executable},
                       {'ProcessId': 22, 'ParentProcessId': 11, 'ExecutablePath': 'not-python.exe'}):
            with patch.object(diagnostic.q.base.managed_worker, 'process_identity', return_value='11:exact'):
                with self.assertRaisesRegex(ValueError, 'exact bound Python redirector'):
                    diagnostic.parent_identity_proof(claim, observed_parent=22, lookup=lambda _pid: bridge)

    def test_parent_reuse_during_bridge_verification_is_rejected(self):
        claim = {'processId': 11, 'processStartIdentity': '11:exact'}
        bridge = {'ProcessId': 22, 'ParentProcessId': 11, 'ExecutablePath': diagnostic.sys.executable}
        with patch.object(diagnostic.q.base.managed_worker, 'process_identity', side_effect=['11:exact', '11:changed']):
            with self.assertRaisesRegex(ValueError, 'changed during bridge'):
                diagnostic.parent_identity_proof(claim, observed_parent=22, lookup=lambda _pid: bridge)


if __name__ == '__main__':
    unittest.main()
