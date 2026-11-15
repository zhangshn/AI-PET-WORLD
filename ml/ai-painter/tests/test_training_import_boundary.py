"""Import-only regressions: no model construction, training, or CUDA calls."""
import pathlib
import subprocess
import sys
import textwrap
import unittest


SOURCE = pathlib.Path(__file__).resolve().parents[1] / "src"


class TrainingImportBoundaryTests(unittest.TestCase):
    def run_isolated(self, body):
        bootstrap = f"import sys\nsys.path.insert(0, {str(SOURCE)!r})\n"
        bootstrap += textwrap.dedent('''
            import importlib.abc
            class NoTorch(importlib.abc.MetaPathFinder):
                def find_spec(self, fullname, path=None, target=None):
                    if fullname == 'torch' or fullname.startswith('torch.'):
                        raise AssertionError('This import-only test must not load PyTorch')
            sys.meta_path.insert(0, NoTorch())
        ''')
        result = subprocess.run(
            [sys.executable, "-I", "-B", "-c", bootstrap + textwrap.dedent(body)],
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_package_import_does_not_load_training_components(self):
        self.run_isolated('''
            import ai_painter.training as training
            for name in ('dataset', 'trainer', 'model', 'checkpoint', 'losses'):
                assert 'ai_painter.training.' + name not in sys.modules, name
            assert 'numpy' not in sys.modules
            assert 'PIL' not in sys.modules
        ''')

    def test_runtime_submodule_is_available_without_dataset_dependencies(self):
        self.run_isolated('''
            class NoDataset(importlib.abc.MetaPathFinder):
                def find_spec(self, fullname, path=None, target=None):
                    if fullname in ('numpy', 'PIL', 'ai_painter.training.dataset',
                                    'ai_painter.training.trainer'):
                        raise ModuleNotFoundError('dataset dependency intentionally unavailable')
            sys.meta_path.insert(0, NoDataset())
            from ai_painter.training.torch_runtime import require_torch
            assert callable(require_torch)
        ''')

    def test_public_runtime_export_does_not_load_dataset_or_trainer(self):
        self.run_isolated('''
            from ai_painter.training import describe_torch_runtime
            from ai_painter.training.torch_runtime import describe_torch_runtime as original
            assert describe_torch_runtime is original
            for name in ('dataset', 'trainer', 'model'):
                assert 'ai_painter.training.' + name not in sys.modules, name
        ''')

    def test_model_factory_import_does_not_load_dataset_or_trainer(self):
        self.run_isolated('''
            from ai_painter.training import build_tiny_unet
            from ai_painter.training.model import build_tiny_unet as original
            assert build_tiny_unet is original
            assert 'ai_painter.training.dataset' not in sys.modules
            assert 'ai_painter.training.trainer' not in sys.modules
        ''')

    def test_all_public_exports_keep_original_objects(self):
        self.run_isolated('''
            import ai_painter.training as training
            import importlib
            expected = {'MASK_NAMES': 'dataset', 'WorldSceneDataset': 'dataset',
                        'build_tiny_unet': 'model', 'describe_torch_runtime': 'torch_runtime',
                        'train': 'trainer'}
            assert training.__all__ == list(expected)
            for name, child in expected.items():
                value = getattr(training, name)
                assert value is getattr(importlib.import_module('ai_painter.training.' + child), name)
                assert getattr(training, name) is value
            assert 'torch' not in sys.modules
        ''')

    def test_star_import_keeps_the_five_public_names(self):
        self.run_isolated('''
            import ai_painter.training as training
            scope = {}
            exec('from ai_painter.training import *', scope)
            assert set(scope) - {'__builtins__'} == set(training.__all__)
            for name in training.__all__:
                assert scope[name] is getattr(training, name)
        ''')

    def test_direct_submodule_imports_and_package_exports_agree(self):
        self.run_isolated('''
            from ai_painter.training import dataset as dataset_module
            from ai_painter.training import trainer as trainer_module
            from ai_painter.training import WorldSceneDataset, train
            assert WorldSceneDataset is dataset_module.WorldSceneDataset
            assert train is trainer_module.train
        ''')

    def test_failed_lazy_import_is_not_cached_and_can_retry(self):
        self.run_isolated('''
            import ai_painter.training as training
            failure = ModuleNotFoundError('deliberate missing trainer')
            class MissingTrainer(importlib.abc.MetaPathFinder):
                def find_spec(self, fullname, path=None, target=None):
                    if fullname == 'ai_painter.training.trainer':
                        raise failure
            blocker = MissingTrainer()
            sys.meta_path.insert(0, blocker)
            try:
                training.train
            except ModuleNotFoundError as caught:
                assert caught is failure
            else:
                raise AssertionError('trainer import should fail')
            assert 'train' not in vars(training)
            sys.meta_path.remove(blocker)
            from ai_painter.training.trainer import train as original
            assert training.train is original
        ''')

    def test_unknown_attribute_does_not_load_components(self):
        self.run_isolated('''
            import ai_painter.training as training
            assert not hasattr(training, 'not_a_public_export')
            try:
                training.not_a_public_export
            except AttributeError as error:
                assert 'ai_painter.training' in str(error)
                assert 'not_a_public_export' in str(error)
            else:
                raise AssertionError('unknown attribute accepted')
            assert 'ai_painter.training.trainer' not in sys.modules
        ''')

    def test_dir_exposes_public_exports_without_loading_them(self):
        self.run_isolated('''
            import ai_painter.training as training
            assert set(training.__all__) <= set(dir(training))
            assert 'ai_painter.training.dataset' not in sys.modules
            assert 'ai_painter.training.trainer' not in sys.modules
        ''')


if __name__ == "__main__":
    unittest.main()
