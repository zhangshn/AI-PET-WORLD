"""One bounded synthetic lifecycle batch; actual and simulated paths separate."""
from copy import deepcopy
import hashlib
import json
import random
import unittest
from unittest.mock import patch
import torch
import painter_stage4_ecology_regime_training_profile as profile
import painter_stage4_ecology_regime_lifecycle as lifecycle
from ai_painter.complete_world.object_ecology_regime_conditioned import validate_model_identity, ecological_parameter
from ai_painter.complete_world.object_ecology_regime_input_cpu import ECOLOGIES, encode_ecology
from test_object_ecology_regime_prototype_cpu import source_fixture, _bind_fixture
from test_object_appearance_regime_conditioned_cpu import ORDER, scene

ACTUAL_PAIR_COUNTS = {}
SIMULATED = {"pairs": 0, "generatorUpdates": 0, "discriminatorUpdates": 0, "validationEpochs": []}


def bound_fixture(split="train"):
    reader, record = source_fixture(ECOLOGIES[0])
    conditions, table = scene()
    reader.values["conditionPack.json"]["objectInstanceTable"] = table
    _bind_fixture(reader, record)
    identity = {"sampleId": "synthetic-scene", "split": split,
                "conditionPack": deepcopy(record["conditionPack"]), "taskPackage": deepcopy(record["taskPackage"])}
    sample = {"sampleId": identity["sampleId"], "split": split, "conditions": conditions[0],
              "objectInstanceTable": table,
              "image": torch.linspace(0, 1, 256)[None, None, :].expand(3, 192, 256).contiguous()}
    return reader, profile.bind_sample_ecology(reader, sample, identity, record)


class EcologyLifecycleTests(unittest.TestCase):
    def test_identity_and_source_content_guards(self):
        model, critic = profile.fresh_networks(ORDER)
        validate_model_identity(model)
        parameters, groups, season, ecology = profile.bind_parameters(model)
        self.assertEqual(len(parameters), 108)
        self.assertEqual(sum(p.numel() for p in parameters), 2242687)
        self.assertNotEqual(season, ecology)
        self.assertNotIn(ecology, [i for rows in groups.values() for i in rows])
        reader, sample = bound_fixture()
        profile.validate_sample_ecology(sample)
        for key, value in (("ecology_regime", encode_ecology(ECOLOGIES[1])),
                           ("_ecology_regime_binding", None), ("sampleId", "wrong"),
                           ("image", sample["image"] + .01), ("objectInstanceTable", [])):
            with self.assertRaises(ValueError): profile.validate_sample_ecology({**sample, key: value})
        bad = {**sample, "split": "validation"}
        with self.assertRaises(ValueError):
            profile.perform_pair(model, critic, bad, ORDER, None, None,
                {"generator": 0, "discriminator": 0}, {"sampleId": bad["sampleId"]}, lambda: None, None)
        reader.values["conditionPack.json"]["categoricalConditions"]["ecologyPlan"]["landscapeType"] = ECOLOGIES[1]
        with self.assertRaises(ValueError): profile.validate_sample_ecology(sample)

    def test_actual_pair_partial_failure_probe_and_restoration(self):
        _reader, sample = bound_fixture()
        model, critic = profile.fresh_networks(ORDER)
        args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
        go = torch.optim.AdamW(model.parameters(), **args)
        do = torch.optim.AdamW(critic.parameters(), **args)
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], **counts}
        critic.eval().requires_grad_(False)
        entry = profile.v24._critic_mode_snapshot(critic)
        before_ecology = ecological_parameter(model).detach().clone()
        phases = []; forward = profile.sample_forward
        def observed(*args, **kwargs):
            phases.append((critic.training, all(p.requires_grad for p in critic.parameters()), torch.is_grad_enabled()))
            return forward(*args, **kwargs)
        with patch.object(profile, "sample_forward", observed):
            facts = profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger, lambda: None, None)
        self.assertEqual(phases, [(True, True, False), (False, False, True)])
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual(facts["fourHeadUpdate"]["independentFullParameterGradientTensorCounts"], [108] * 4)
        self.assertFalse(torch.equal(before_ecology, ecological_parameter(model)))
        self.assertEqual(profile.v24._critic_mode_snapshot(critic), entry)
        with patch.object(go, "step", side_effect=RuntimeError("injected G step failure")):
            with self.assertRaisesRegex(RuntimeError, "injected G step failure"):
                profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger, lambda: None, None)
        self.assertEqual(counts, {"generator": 1, "discriminator": 2})
        self.assertEqual({key: ledger[key] for key in counts}, counts)
        self.assertEqual(profile.v24._critic_mode_snapshot(critic), entry)
        go.zero_grad(set_to_none=True); do.zero_grad(set_to_none=True)
        rng = torch.random.get_rng_state().clone(); backend = profile._backend_snapshot()
        proof = profile.zero_update_probe(model, critic, sample, ORDER, lambda: None)
        self.assertEqual(proof["callCounts"], {"generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1})
        self.assertGreater(proof["ecologySliceL2"][0], 0)
        self.assertEqual(proof["ecologySliceL2"][1:], [0.] * 6)
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertEqual(backend, profile._backend_snapshot())
        with self.assertRaisesRegex(RuntimeError, "resource exhausted"):
            profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger,
                                 lambda: (_ for _ in ()).throw(RuntimeError("resource exhausted")), None)
        self.assertEqual(counts, {"generator": 1, "discriminator": 2})
        ACTUAL_PAIR_COUNTS.update(counts)

    def _simulated(self, fail=False, wrong_reload=False):
        from test_ecology_regime_managed_checkpoint import configuration, selection
        model, critic = profile.fresh_networks(ORDER)
        config = configuration()
        package = {"path": ".runtime/synthetic/package.json", "sha256": "a" * 64}
        plan = {"capabilityVersion": profile.CAPABILITY, "configuration": config,
                "runId": "synthetic-run", "packageId": "synthetic-package",
                "datasetManifest": {"path": "data/synthetic/manifest.json", "sha256": "b" * 64}}
        train = [{"sampleId": "train-" + str(i), "split": "train"} for i in range(48)]
        validation = [{"sampleId": "validation-" + str(i), "split": "validation"} for i in range(8)]
        blobs = {}; visits = []; factories = []
        def pair(model, critic, sample, order, go, do, counts, ledger, resource, forward):
            visits.append(sample["sampleId"]); resource()
            counts["discriminator"] += 1; ledger["discriminator"] += 1
            SIMULATED["discriminatorUpdates"] += 1
            if fail: raise RuntimeError("simulated after D before G")
            counts["generator"] += 1; ledger["generator"] += 1
            SIMULATED["generatorUpdates"] += 1; SIMULATED["pairs"] += 1
        def validate(model, samples, order, *, epoch):
            SIMULATED["validationEpochs"].append(epoch)
            value = selection(epoch)
            score = {24: .1, 36: .3, 48: .2}[epoch]
            value["worstApplicableObjectCorrelation"] = score
            value["rank"] = [score, -.2, -epoch]
            return value, [{"sampleId": s["sampleId"], "split": "validation"} for s in samples]
        def encode(model, critic, **kwargs):
            return json.dumps({"synthetic": True, "epoch": kwargs["epoch"]}, sort_keys=True).encode()
        def sink(epoch, raw):
            if epoch is None: return blobs[raw["path"]]
            key = ".runtime/synthetic/epoch-" + str(epoch) + ".pt"
            blobs[key] = raw
            return {"path": key, "sha256": hashlib.sha256(raw).hexdigest()}
        def factory(order):
            fresh = profile.fresh_networks(order)
            factories.append(fresh[0].capability_version)
            return fresh
        def reload(raw, **kwargs):
            self.assertEqual(json.loads(raw)["epoch"], 36)
            validate_model_identity(kwargs["model"])
            self.assertEqual(kwargs["counts"], {"generator": 1728, "discriminator": 1728})
            if wrong_reload: raise ValueError("simulated reload rejected")
        kwargs = dict(model=model, critic=critic, train=train, validation=validation, order=ORDER,
            configuration=config, package_binding=package, plan=plan, resource=lambda: None,
            checkpoint_sink=sink, progress_sink=lambda *a, **kw: None, pair_runner=pair,
            validation_runner=validate, checkpoint_encoder=encode, checkpoint_reloader=reload,
            network_factory=factory)
        return kwargs, visits, factories

    def test_simulated_fixed_schedule_selection_and_own_reload_factory(self):
        kwargs, visits, factories = self._simulated()
        outcome = lifecycle.training_loop(**kwargs)
        self.assertEqual(outcome["optimizerSteps"], {"generator": 2304, "discriminator": 2304})
        self.assertEqual(outcome["selectedCheckpointRecord"]["epoch"], 36)
        self.assertEqual([r["epoch"] for r in outcome["checkpoints"]], [24, 36, 48])
        self.assertEqual(factories, [profile.CAPABILITY])
        expected = []
        for epoch in range(1, 49):
            ids = list(range(48)); random.Random(20260929 + epoch).shuffle(ids)
            expected.extend("train-" + str(i) for i in ids)
        self.assertEqual(visits, expected)
        self.assertFalse(outcome["productionExecutionAuthenticated"])
        self.assertFalse(outcome["formalStage4QualificationAllowed"])

    def test_simulated_partial_failure_preserves_counts_and_reload_failure_records(self):
        kwargs, visits, factories = self._simulated(fail=True)
        with self.assertRaisesRegex(RuntimeError, "after D before G") as caught:
            lifecycle.training_loop(**kwargs)
        self.assertEqual(caught.exception.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual(caught.exception.completed_epochs, 0)
        self.assertEqual(caught.exception.partial_checkpoint_records, [])
        self.assertEqual(factories, [])
        kwargs, _visits, factories = self._simulated(wrong_reload=True)
        with self.assertRaisesRegex(ValueError, "reload rejected") as caught:
            lifecycle.training_loop(**kwargs)
        self.assertEqual(caught.exception.actual_optimizer_counts, {"generator": 2304, "discriminator": 2304})
        self.assertEqual(caught.exception.completed_epochs, 48)
        self.assertEqual(len(caught.exception.partial_checkpoint_records), 3)


if __name__ == "__main__": unittest.main()
