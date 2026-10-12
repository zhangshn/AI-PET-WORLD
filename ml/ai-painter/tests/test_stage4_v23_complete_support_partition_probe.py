"""CPU-only gate tests for the V23 bounded-executor profile."""
from contextlib import nullcontext
from copy import deepcopy
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v23_complete_support_partition_probe as successor


class V23ManagedEntryCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.profile = successor.successor_profile()
        cls.core = cls.profile.__enter__()
        try:
            with patch.object(torch, "load", side_effect=AssertionError("preflight checkpoint read")), \
                 patch.object(cls.core.cpu, "load_sample", side_effect=AssertionError("preflight image decode")), \
                 patch.object(torch.cuda, "is_available", side_effect=AssertionError("preflight CUDA")):
                cls.context = cls.core.collect_inputs()
        except BaseException:
            cls.profile.__exit__(*sys.exc_info())
            raise

    @classmethod
    def tearDownClass(cls):
        cls.profile.__exit__(None, None, None)

    def policy(self):
        return {"schemaVersion": successor.POLICY_SCHEMA,
            "status": "active_single_bounded_train_only_exposure_experiment",
            "scope": successor.SCOPE, "inputs": deepcopy(self.context["inputs"]),
            "maxAttempts": 1, "automaticRetries": 0}

    def test_exact_package_identity_plans_and_stable_envelope(self):
        package = self.core.package_from_inputs(self.context["inputs"],
            {"path": successor.POLICY_PATH, "sha256": "a" * 64}, self.context["manifest"])
        self.assertTrue(package["experimentIdentity"].startswith("v23-complete-support-partition-"))
        self.assertEqual(package["experimentType"], successor.EXPERIMENT_TYPE)
        self.assertEqual(package["schemaVersion"], "ai-painter-learning-capacity-experiment-package-v1")
        self.assertEqual(package["evidenceContractVersion"], 1)
        for key in ("modelPlan", "representationPlan", "sourcePlan", "dataPlan"):
            self.assertEqual(package["config"][key], package["inputs"][key])
        self.assertEqual(package["training"]["epochs"], 48)
        self.assertEqual(package["training"]["maxGeneratorOptimizerSteps"], 2304)
        self.assertEqual(package["resources"]["maxWallSeconds"], 1800)
        self.assertEqual(package["resources"]["cpuThreads"], 2)
        self.assertFalse(package["qualification"]["checkpointPromotable"])

    def test_policy_rejects_old_path_and_all_plan_tampering(self):
        policy = self.policy()
        self.core.validate_policy(policy, policy["inputs"])
        cases = (("modelPlan", "architectureId", "old-v21"),
                 ("representationPlan", "ownershipRule", "caller-boolean"),
                 ("sourcePlan", "worldFactsChanged", True),
                 ("dataPlan", "holdoutUsed", True),
                 ("objectivePlan", "coreRgbWeight", .5))
        for plan, field, value in cases:
            bad = deepcopy(policy); bad["inputs"][plan][field] = value
            with self.subTest(plan=plan, field=field), self.assertRaises(ValueError):
                self.core.validate_policy(bad, bad["inputs"])
        for old in (successor.object_core.POLICY_PATH, successor.object_core.fidelity.POLICY_PATH):
            with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
                self.core.prepare(old)

    def test_cpu_report_and_controller_acceptance_reject_wrong_current_identity(self):
        plan = successor.representation_plan()
        evidence = self.context["reader"].json(plan["cpuEvidence"])
        acceptance = self.context["reader"].json(plan["controllerAcceptance"])
        successor.validate_cpu_acceptance(evidence, acceptance, plan)
        mutations = (("evidence", "ownershipRule", "old"),
                     ("evidence", "programBindings", []),
                     ("acceptance", "architectureId", "old-v21"),
                     ("acceptance", "sourceCpuEvidence", {"path": "old", "sha256": "0" * 64}))
        for target, field, value in mutations:
            left, right = deepcopy(evidence), deepcopy(acceptance)
            (left if target == "evidence" else right)[field] = value
            with self.subTest(target=target, field=field), self.assertRaises(ValueError):
                successor.validate_cpu_acceptance(left, right, plan)

    def test_fresh_factory_is_v23_and_profile_restores_on_normal_and_failure(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        self.assertEqual(model.capability_version, successor.CAPABILITY)
        self.assertEqual(model.architecture_id, successor.ARCHITECTURE)
        self.assertEqual(model.support_ownership_rule, successor.OWNERSHIP_RULE)
        self.assertFalse(model.parent_checkpoint_loaded)
        del model, critic
        names = ("fresh_networks", "reload_final_cpu", "zero_update_probe", "collect_inputs")
        before = {name: getattr(self.core, name) for name in names}
        with successor.successor_profile():
            self.assertIs(self.core.fresh_networks, successor.fresh_networks)
        self.assertEqual(before, {name: getattr(self.core, name) for name in names})
        with self.assertRaisesRegex(RuntimeError, "deliberate"):
            with successor.successor_profile():
                raise RuntimeError("deliberate")
        self.assertEqual(before, {name: getattr(self.core, name) for name in names})

    def test_zero_update_cpu_spy_uses_real_v23_ownership_and_no_optimizer(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = self.core.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                             self.context["order"], self.context["continuous"])
        before = [self.core.cpu.state_hash(network) for network in (model, critic)]
        gradient_facts = self.core.gpu.gradient_facts
        with patch.object(torch, "autocast", side_effect=lambda *args, **kwargs: nullcontext()), \
             patch.object(self.core.gpu, "gradient_facts",
                          side_effect=lambda network, device: gradient_facts(network, "cpu")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU queried CUDA")):
            result = self.core.zero_update_probe(model, critic, sample, self.context["order"], lambda: None,
                lambda kind, bound: model(bound["conditions"][None], bound["objectInstanceTable"]))
        self.assertEqual(result["capabilityVersion"], successor.CAPABILITY)
        self.assertEqual(result["architectureId"], successor.ARCHITECTURE)
        self.assertEqual(result["representationId"], successor.OWNERSHIP_RULE)
        self.assertFalse(result["optimizerCreated"])
        facts = result["ownershipFacts"]
        self.assertEqual(facts["supportUnionMismatchPixels"], 0)
        self.assertEqual(facts["ownerOverlapPixels"], 0)
        self.assertEqual(facts["typedSupportUnionPixels"], facts["ownedUnionPixels"])
        self.assertEqual(sum(row["ownedPixels"] for row in facts["roles"].values()), facts["ownedUnionPixels"])
        for row in facts["roles"].values():
            self.assertEqual(row["coreOwnershipMissingPixels"], 0)
            self.assertEqual(row["ownerOutsideCoveragePixels"], 0)
            self.assertRegex(row["ownerMaskSha256"], r"^[a-f0-9]{64}$")
        self.assertEqual(before, [self.core.cpu.state_hash(network) for network in (model, critic)])
        self.assertTrue(all(parameter.grad is None for network in (model, critic) for parameter in network.parameters()))

    def test_checkpoint_requires_v23_identity_and_reloads_fresh_v23(self):
        model, critic = self.core.fresh_networks(self.context["order"])
        expected = {"Model": self.core.cpu.state_hash(model), "Critic": self.core.cpu.state_hash(critic)}
        package = {"path": ".runtime/example/package.json", "sha256": "1" * 64}
        identity = "v23-complete-support-partition-test"
        payload = {"schemaVersion": "ai-painter-learning-capacity-experiment-checkpoint-v1",
            "experimentType": successor.EXPERIMENT_TYPE, "experimentIdentity": identity,
            "executionPackage": package, "epoch": 48,
            "optimizerSteps": {"generator": 2304, "discriminator": 2304},
            "finalStateSha256": expected, "checkpointPromotable": False,
            "automaticResumeAllowed": False, "modelState": model.state_dict(), "criticState": critic.state_dict()}
        stream = io.BytesIO(); torch.save(payload, stream)
        self.assertTrue(self.core.reload_final_cpu(stream.getvalue(), expected, self.context["order"], package, identity))
        for key, value in (("experimentType", "object_core_fidelity_train_only"),
                           ("executionPackage", {"path": "old", "sha256": "0" * 64})):
            bad = deepcopy(payload); bad[key] = value
            stream = io.BytesIO(); torch.save(bad, stream)
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "checkpoint metadata"):
                self.core.reload_final_cpu(stream.getvalue(), expected, self.context["order"], package, identity)

    def test_object_core_objective_and_heartbeat_are_preserved(self):
        self.assertEqual(self.context["inputs"]["objectivePlan"], successor.object_core.objective_plan())
        self.assertEqual(self.context["inputs"]["heartbeatPublicationRule"], successor.object_core.HEARTBEAT_PUBLICATION_RULE)
        self.assertFalse(self.context["inputs"]["objectivePlan"]["qualificationGranted"])


if __name__ == "__main__":
    unittest.main()
