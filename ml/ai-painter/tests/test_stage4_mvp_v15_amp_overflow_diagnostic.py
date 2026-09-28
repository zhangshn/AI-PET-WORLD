"""Read-only synthetic check of the failed V15 worker's AMP overflow path.

No project image, CUDA device, execution registry, or training checkpoint is used.
"""

import importlib.util
from pathlib import Path
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
WORKER = ROOT / "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_v15_stage0.py"
spec = importlib.util.spec_from_file_location("failed_v15_worker", WORKER)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class AmpOverflowDiagnostic(unittest.TestCase):
    def test_worker_rejects_recoverable_scaled_gradient_before_scaler_update(self):
        network = torch.nn.Linear(1, 1, bias=False)
        network.weight.register_hook(
            lambda gradient: torch.full_like(gradient, float("inf"))
        )
        optimizer = torch.optim.SGD(network.parameters(), lr=0.1)
        scaler = torch.amp.GradScaler("cpu", init_scale=65536)
        old_weight = network.weight.detach().clone()
        old_scale = scaler.get_scale()
        loss = network(torch.ones(1, 1)).sum()

        with self.assertRaisesRegex(ValueError, "non-finite discriminator gradient"):
            worker._step(scaler, optimizer, loss, network, "discriminator")
        self.assertEqual(scaler.get_scale(), old_scale)

        # PyTorch's documented recovery path would skip this update and reduce
        # the scale. V15 raises before reaching either action.
        scaler.step(optimizer)
        scaler.update()
        self.assertLess(scaler.get_scale(), old_scale)
        self.assertTrue(torch.equal(network.weight.detach(), old_weight))


if __name__ == "__main__":
    unittest.main()
