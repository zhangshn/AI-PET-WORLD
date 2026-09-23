"""Synthetic restricted-loader and request-boundary tests; no real weight loads."""
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import probe_foundation_cpu_load as probe
import torch

META = {"schemaVersion": "test", "ownership": "project", "trainingLane": "test",
        "modelId": "test", "architectureVersion": "test", "trainingStage": "autoencoder_warmup_only",
        "denoiserTrained": False}


class ProbeTests(unittest.TestCase):
    def payload(self):
        return {**META, "thirdPartyWeightsLoaded": False, "upstreamModelIds": [],
                "autoencoderState": {"weight": torch.ones(2, 2)}}

    def decode(self, value):
        stream = io.BytesIO()
        torch.save(value, stream)
        data = stream.getvalue()
        return probe.decode_bound_autoencoder(data, probe.digest(data), len(data), META)

    def test_restricted_loader_cpu_only(self):
        with patch.object(torch, "load", wraps=torch.load) as load:
            self.assertEqual(tuple(self.decode(self.payload())["weight"].shape), (2, 2))
        self.assertIs(load.call_args.kwargs["weights_only"], True)
        self.assertEqual(load.call_args.kwargs["map_location"], "cpu")

    def test_hash_failure_before_loader(self):
        with patch.object(torch, "load") as load, self.assertRaisesRegex(ValueError, "bytes mismatch"):
            probe.decode_bound_autoencoder(b"not-pickle", "0" * 64, 10, META)
        load.assert_not_called()

    def test_metadata_cannot_claim_denoiser_or_foreign_weights(self):
        for key, value in [("denoiserTrained", True), ("denoiserTrained", 0),
                           ("modelId", "other"), ("thirdPartyWeightsLoaded", True),
                           ("upstreamModelIds", ["external"]), ("denoiserState", {}),
                           ("autoencoderState", {}), ("autoencoderState", {"x": torch.tensor(float("nan"))})]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                self.decode({**self.payload(), key: value})

    def test_loader_rejection_has_no_unsafe_fallback(self):
        stream = io.BytesIO()
        torch.save(self.payload(), stream)
        data = stream.getvalue()
        with patch.object(torch, "load", side_effect=RuntimeError("restricted rejection")) as load, \
                self.assertRaisesRegex(RuntimeError, "restricted rejection"):
            probe.decode_bound_autoencoder(data, probe.digest(data), len(data), META)
        self.assertEqual(load.call_count, 1)

    def test_policy_substitution_fails_before_source_read(self):
        request = {"schemaVersion": "foundation-cpu-load-probe-request-v1",
                   "runId": "foundation-cpu-probe-" + "a" * 36,
                   "policy": {"path": probe.POLICY_PATH, "sha256": "0" * 64}, "programBindings": []}
        with patch.object(probe, "read_binding") as read, self.assertRaisesRegex(ValueError, "policy binding"):
            probe.verify_request(request)
        read.assert_not_called()

    def test_path_escape_refused_before_io(self):
        for value in ("../asset.pt", "C:/asset.pt", "/asset.pt", "latest.json", "x/../a"):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "relative path"):
                probe.read_binding({"path": value, "sha256": "a" * 64})

    def test_extra_execution_grant_field_is_refused(self):
        with self.assertRaisesRegex(ValueError, "fields invalid"):
            probe.verify_request({"trainingAllowed": True})


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ProbeTests))
    print(json.dumps({"status": "passed" if result.wasSuccessful() else "failed",
                      "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
                      "realCheckpointRead": False, "gpuStarted": False}))
    sys.exit(0 if result.wasSuccessful() else 1)
