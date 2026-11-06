"""Direct-interpreter zero-forward process identity and fixed import boundaries."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import types
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / 'scripts/world_environment_loop_bootstrap.py'
spec=importlib.util.spec_from_file_location('bootstrap158',PATH)
bootstrap=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class BootstrapChecks(unittest.TestCase):
    def test_fixed_contract_and_worker_still_bound(self):
        c=bootstrap.read_contract()
        self.assertEqual(c['worker']['sha256'],'0df00784d1a63a40e0cc25099ef5f5839003a3b4c4af4dc34ef8d3ed43855c62')
        bootstrap.read_verified(bootstrap.project_path(c['worker']['path']),c['worker']['sha256'],c['worker']['bytes'])
        bootstrap.read_verified(c['directInterpreter']['path'],c['directInterpreter']['sha256'],c['directInterpreter']['bytes'])

    def test_wrong_sha_and_byte_count_rejected(self):
        c=bootstrap.read_contract();p=bootstrap.project_path(c['worker']['path'])
        with self.assertRaisesRegex(ValueError,'file_sha'):bootstrap.read_verified(p,'0'*64)
        with self.assertRaisesRegex(ValueError,'file_bytes'):bootstrap.read_verified(p,c['worker']['sha256'],1)

    def test_relative_absolute_and_parent_paths_rejected(self):
        for value in ('../a','/a','a//b','a/../b','a\\b','C:/a'):
            with self.assertRaises(ValueError):bootstrap.project_path(value)
        with self.assertRaisesRegex(ValueError,'absolute_path'):bootstrap.safe_absolute('relative/file')

    def test_required_flags_rejected_before_executable_read(self):
        c=bootstrap.read_contract()
        for flags,dont in [(types.SimpleNamespace(isolated=0,utf8_mode=1),True),(types.SimpleNamespace(isolated=1,utf8_mode=0),True),(types.SimpleNamespace(isolated=1,utf8_mode=1),False)]:
            with patch.object(sys,'flags',flags),patch.object(sys,'dont_write_bytecode',dont):
                with self.assertRaisesRegex(ValueError,'isolated_flags'):bootstrap.check_interpreter(c)

    def test_arbitrary_argument_rejected_before_contract_or_worker(self):
        with patch.object(sys,'argv',[str(PATH),'--worker','evil.py']),patch.object(bootstrap,'read_contract') as read,contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(bootstrap.main(),1);read.assert_not_called()

    def test_torch_preloaded_rejected(self):
        c=bootstrap.read_contract()
        with patch.dict(sys.modules,{'torch':types.ModuleType('torch')}):
            with self.assertRaisesRegex(ValueError,'imports_already_loaded'):bootstrap.prepare_imports(c)

    def test_torch_origin_from_other_location_rejected(self):
        c=bootstrap.read_contract();before=list(sys.path)
        try:
            fake=types.SimpleNamespace(origin=str(PATH),submodule_search_locations=[str(PATH.parent)])
            with patch.object(bootstrap.importlib.util,'find_spec',return_value=fake):
                with self.assertRaisesRegex(ValueError,'torch_origin'):bootstrap.prepare_imports(c)
        finally:sys.path[:]=before

    def test_same_pid_direct_identity_check_without_forward(self):
        c=bootstrap.read_contract()
        cp=subprocess.Popen([c['directInterpreter']['path'],*c['args'],str(PATH),'--identity-check'],cwd=bootstrap.ROOT,
                            stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        stdout,stderr=cp.communicate(timeout=15)
        self.assertEqual(cp.returncode,0,stderr.decode('utf-8'))
        result=json.loads(stdout);self.assertEqual(result['pid'],cp.pid)
        self.assertEqual(result['modelForwardRuns'],0);self.assertEqual(result['trainingUpdates'],0)
        self.assertEqual(result['workerSha256'],c['worker']['sha256']);self.assertFalse(result['productionReady'])
        self.assertEqual(Path(result['torchOrigin']).resolve(),(bootstrap.ROOT/c['sitePackages']/'torch/__init__.py').resolve())
        self.assertEqual(Path(result['executable']).resolve(),Path(c['directInterpreter']['path']).resolve())


if __name__=='__main__':
    unittest.main()
