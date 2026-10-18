"""Synthetic CPU lifecycle and in-memory state tests; no data, GPU or training."""
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path
import random
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
os.environ["CUDA_VISIBLE_DEVICES"] = ""
import torch
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as checkpoint
from ai_painter.complete_world import ecology_terrain_detail_weight_checkpoint_v1 as old_checkpoint
from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import TerrainDetailWeightPrecisionEcologyRenderer
import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as original_profile
import painter_stage4_object_support_structure_lifecycle_v1 as lifecycle

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())
bind = lambda name: {"path": name, "sha256": "a"*64}


def validation_rows(samples, epoch):
    return [{"sampleId": sample["sampleId"], "split": "validation", "epoch": epoch,
        "fullRgbMae": .2, "objectCorrelations": {role: .1 for role in lifecycle.shared.OBJECT_CHANNELS}} for sample in samples]


class LifecycleCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
        cls.model, cls.critic = original_profile.fresh_networks(ORDER)
        cls.configuration = checkpoint.expected_configuration()
        cls.train = [{"sampleId": f"synthetic-train-{i}", "split": "train"} for i in range(48)]
        cls.validation = [{"sampleId": f"synthetic-validation-{i}", "split": "validation"} for i in range(8)]
        rows = validation_rows(cls.validation, 24)
        cls.selection = lifecycle.ranking.rank_validation_epoch(rows, [s["sampleId"] for s in cls.validation], epoch=24, eligible_epochs=(24,))
        cls.kwargs = {"configuration": cls.configuration, "run_id": "synthetic-support-run",
            "package_binding": bind(".runtime/synthetic-support/package.json"), "dataset_binding": bind("data/synthetic-manifest.json"),
            "epoch": 24, "selection": cls.selection, "counts": {"generator": 1152, "discriminator": 1152},
            "program_bindings": {"codec": bind("ml/ai-painter/src/ai_painter/complete_world/object_support_structure_checkpoint_v1.py")},
            "plan_binding": bind(".runtime/synthetic-support/quality-plan.json")}
        cls.raw = checkpoint.encode(cls.model, cls.critic, **cls.kwargs)

    def setUp(self):
        self.guards = ExitStack(); self.addCleanup(self.guards.close)
        for obj, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"),
                (TerrainDetailWeightPrecisionEcologyRenderer, "forward")):
            self.guards.enter_context(patch.object(obj, name, side_effect=AssertionError("GPU/real optimizer/model forward prohibited")))

    def roundtrip(self, raw=None, **overrides):
        model, critic = original_profile.fresh_networks(ORDER)
        return model, critic, checkpoint.reload(self.raw if raw is None else raw,
            model=model, critic=critic, **{**self.kwargs, **overrides})

    def payload(self):
        return torch.load(io.BytesIO(self.raw), weights_only=True, map_location="cpu")

    def repack(self, payload):
        output = io.BytesIO(); torch.save(payload, output); return output.getvalue()

    def run_loop(self, **overrides):
        plan = {"capabilityVersion": checkpoint.CAPABILITY, "configuration": deepcopy(self.configuration),
            "runId": self.kwargs["run_id"], "packageId": "synthetic-support-package", "modelBinding": bind("data/synthetic-model.json"),
            "datasetManifest": self.kwargs["dataset_binding"], "programBindings": self.kwargs["program_bindings"]}
        events, writes, optimizer_settings = [], {}, []
        def optimizer(parameters, **settings):
            optimizer_settings.append(settings); return object()
        def pair(model, critic, sample, order, go, do, counts, ledger, resource, forward, *, update_limit):
            self.assertEqual(sample["split"], "train"); self.assertEqual(update_limit, 1152)
            events.append(("pair", sample["sampleId"]))
            for key in ("generator", "discriminator"): counts[key] += 1; ledger[key] += 1
        def validation(model, samples, order, *, epoch):
            events.append(("validation", epoch)); rows = validation_rows(samples, epoch)
            return lifecycle.ranking.rank_validation_epoch(rows, [s["sampleId"] for s in samples], epoch=epoch, eligible_epochs=(12,24)), rows
        def sink(epoch, value):
            if epoch is None: return writes[value["path"]]
            self.assertEqual(epoch, 24); name = ".runtime/synthetic-support/checkpoint-24.pt"; writes[name] = value
            return {"path": name, "sha256": hashlib.sha256(value).hexdigest()}
        def encoded(*args, **kwargs):
            checkpoint.validate_selection(kwargs["configuration"], kwargs["run_id"], kwargs["epoch"], kwargs["selection"], kwargs["counts"])
            events.append(("encode", kwargs["epoch"])); return b"synthetic-only-checkpoint"
        def reloaded(*args, **kwargs):
            self.assertEqual(args[0], b"synthetic-only-checkpoint"); events.append(("reload", kwargs["epoch"]))
        options = dict(model=self.model, critic=self.critic, train=self.train, validation=self.validation, order=ORDER,
            configuration=self.configuration, package_binding=self.kwargs["package_binding"], plan=plan,
            plan_binding=self.kwargs["plan_binding"], resource=lambda: None, checkpoint_sink=sink,
            progress_sink=lambda *a, **kw: None, pair_runner=pair, validation_runner=validation,
            checkpoint_encoder=encoded, checkpoint_reloader=reloaded,
            network_factory=lambda order: (self.model, self.critic), optimizer_factory=optimizer,
            observation_sink=lambda epoch, item: bind(".runtime/synthetic-support/observation12.json"))
        options.update(overrides)
        return lifecycle.training_loop(**options), events, optimizer_settings

    def test_configuration_is_new_identity_and_old_24_budget_preserved(self):
        checkpoint.validate_configuration(self.configuration)
        self.assertNotEqual(self.configuration["capabilityVersion"], old_checkpoint.CAPABILITY)
        self.assertEqual(self.configuration["executionCeiling"], checkpoint._source_configuration()["executionCeiling"])
        self.assertEqual(self.configuration["lossDefinition"], checkpoint.LOSS)
        self.assertEqual(self.configuration["gradientDefinition"], checkpoint.GRADIENT)
        self.assertFalse(checkpoint.EXECUTION_QUALIFIED)
        self.assertFalse(lifecycle.EXECUTION_QUALIFIED)

    def test_changed_budget_loss_schema_and_old_configuration_rejected(self):
        for config in (checkpoint._source_configuration(), {**self.configuration, "schema": "old"},
                {**self.configuration, "lossDefinition": bind("other-loss.json")},
                {**self.configuration, "executionCeiling": {**self.configuration["executionCeiling"], "epochs": 25}}):
            with self.assertRaises(ValueError): checkpoint.validate_configuration(config)

    def test_roundtrip_preserves_complete_state_and_no_qualification(self):
        model, critic, result = self.roundtrip()
        for actual, expected in ((model, self.model), (critic, self.critic)):
            self.assertTrue(all(torch.equal(v, expected.state_dict()[n]) for n,v in actual.state_dict().items()))
        self.assertFalse(result["checkpointQualified"]); self.assertFalse(result["automaticResumeAllowed"])

    def test_checkpoint_cross_run_program_data_and_loss_rejected(self):
        for change in (dict(run_id="other-run"), dict(dataset_binding=bind("data/other.json")),
                dict(program_bindings={"codec": bind("other.py")})):
            with self.assertRaises(ValueError): self.roundtrip(**change)
        payload = self.payload(); payload["configuration"]["lossDefinition"] = bind("other-loss.json")
        with self.assertRaises(ValueError): self.roundtrip(self.repack(payload))

    def test_checkpoint_old_identity_cannot_be_renamed_into_new_candidate(self):
        for field, value in (("schema", old_checkpoint.SCHEMA), ("capabilityVersion", old_checkpoint.CAPABILITY)):
            payload = self.payload(); payload[field] = value
            with self.assertRaises(ValueError): self.roundtrip(self.repack(payload))

    def test_checkpoint_nan_missing_state_and_graph_rejected(self):
        for change in ("nan", "missing", "graph"):
            payload = self.payload()
            if change == "nan":
                next(value for value in payload["generator"].values() if value.is_floating_point()).flatten()[0] = float("nan")
            elif change == "missing": payload["generator"].pop(next(iter(payload["generator"])))
            else: payload["graph"]["generator"][0]["shape"] = [1]
            with self.subTest(change=change), self.assertRaises(ValueError): self.roundtrip(self.repack(payload))

    def test_partial_load_failure_rolls_back_both_states(self):
        model, critic = original_profile.fresh_networks(ORDER)
        with torch.no_grad():
            next(model.parameters()).add_(.03)
            next(critic.parameters()).sub_(.02)
        before = [lifecycle.shared.v24.core.cpu.state_hash(net) for net in (model, critic)]
        failure = RuntimeError("synthetic critic load failure")
        def fail(*args): raise failure
        handle = critic.register_load_state_dict_post_hook(fail)
        try:
            with self.assertRaises(RuntimeError) as caught: checkpoint.reload(self.raw, model=model, critic=critic, **self.kwargs)
            self.assertIs(caught.exception, failure)
        finally: handle.remove()
        self.assertEqual(before, [lifecycle.shared.v24.core.cpu.state_hash(net) for net in (model, critic)])

    def test_source_role_alias_same_hash_valid_conflict_rejected(self):
        aliases = {**self.kwargs["program_bindings"], "sameSourceOtherRole": deepcopy(next(iter(self.kwargs["program_bindings"].values())))}
        raw = checkpoint.encode(self.model, self.critic, **{**self.kwargs, "program_bindings": aliases})
        self.roundtrip(raw, program_bindings=aliases)
        aliases["sameSourceOtherRole"]["sha256"] = "b"*64
        with self.assertRaises(ValueError): checkpoint.encode(self.model, self.critic, **{**self.kwargs, "program_bindings": aliases})

    def test_midpoint_is_not_checkpoint_eligible(self):
        with self.assertRaises(ValueError): checkpoint.validate_selection(self.configuration, self.kwargs["run_id"], 12, self.selection,
            {"generator": 576, "discriminator": 576})

    def test_simulated_full_schedule_final_reload_and_no_stage_claim(self):
        rng = random.getstate()
        result, events, settings = self.run_loop()
        self.assertEqual(result["optimizerSteps"], {"generator":1152,"discriminator":1152})
        self.assertEqual(sum(item[0] == "pair" for item in events), 1152)
        self.assertEqual([item for item in events if item[0] != "pair"],
            [("validation",12),("validation",24),("encode",24),("reload",24)])
        self.assertEqual(result["epochObservations"][0]["optimizerSteps"], {"generator":576,"discriminator":576})
        self.assertFalse(result["epochObservations"][0]["checkpointSelectionEligible"])
        self.assertFalse(result["formalStage4QualificationAllowed"]); self.assertFalse(result["productionExecutionAuthenticated"])
        self.assertEqual(settings, [dict(lr=.0001,betas=(.9,.999),eps=1e-8,weight_decay=.01,foreach=False,fused=False)]*2)
        self.assertEqual(random.getstate(), rng)

    def test_wrong_plan_identity_and_split_rejected_before_optimizer(self):
        bad = {"capabilityVersion":old_checkpoint.CAPABILITY}
        for change in (dict(plan=bad), dict(train=[{**s,"split":"validation"} for s in self.train])):
            with self.assertRaises(ValueError): self.run_loop(**change)

    def test_pair_failure_preserves_actual_counts_and_original_error(self):
        primary = RuntimeError("synthetic pair failure")
        def pair(*args, **kwargs):
            counts, ledger = args[6], args[7]; counts["discriminator"] += 1; ledger["discriminator"] += 1
            raise primary
        def capture(error, **kwargs):
            self.assertIs(error, primary); self.assertEqual(kwargs["context"]["optimizerSteps"], {"generator":0,"discriminator":1})
            return {"status":"synthetic_capture_complete"}
        with self.assertRaises(RuntimeError) as caught:
            self.run_loop(pair_runner=pair,capture_sink=capture,context_for_sample=lambda sample,pos:{"sampleId":sample["sampleId"]})
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator":0,"discriminator":1})
        self.assertEqual(primary.object_support_failure_capture_receipt["status"], "synthetic_capture_complete")

    def test_secondary_capture_failure_does_not_replace_primary(self):
        primary = RuntimeError("synthetic primary")
        def pair(*args, **kwargs): raise primary
        def broken(*args, **kwargs): raise OSError("synthetic capture failure")
        with self.assertRaises(RuntimeError) as caught:
            self.run_loop(pair_runner=pair,capture_sink=broken,context_for_sample=lambda *a:{})
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.object_support_failure_capture_receipt["status"], "capture_incomplete")

    def test_bad_final_validation_rows_are_not_accepted(self):
        def validation(model,samples,order,*,epoch):
            rows = validation_rows(samples,epoch)
            metrics = lifecycle.ranking.rank_validation_epoch(rows,[s["sampleId"] for s in samples],epoch=epoch,eligible_epochs=(12,24))
            if epoch==24: rows[0]["fullRgbMae"] = .9
            return metrics,rows
        with self.assertRaisesRegex(ValueError,"final rows/metrics"): self.run_loop(validation_runner=validation)

    def test_changed_checkpoint_after_selection_is_rejected(self):
        def sink(epoch,value):
            if epoch is None: return b"tampered"
            return {"path":".runtime/synthetic-support/checkpoint-24.pt","sha256":hashlib.sha256(value).hexdigest()}
        with self.assertRaisesRegex(ValueError,"changed before reload"): self.run_loop(checkpoint_sink=sink)

    def test_policy_hash_matches_new_configuration(self):
        self.assertEqual(hashlib.sha256((ROOT/checkpoint.POLICY["path"]).read_bytes()).hexdigest(),checkpoint.POLICY["sha256"])
        policy=json.loads((ROOT/checkpoint.POLICY["path"]).read_text(encoding="utf-8"))
        self.assertEqual(policy["capabilityVersion"],checkpoint.CAPABILITY)
        self.assertFalse(policy["currentWorkBoundary"]["realGpuAdmission"])
        self.assertFalse(policy["currentWorkBoundary"]["realTraining"])
        proposed=policy["proposedExecutionConfiguration"]
        for key in ("epochs","generatorOptimizerSteps","discriminatorOptimizerSteps","maxWallSeconds",
                "cpuThreads","maxGpuMemoryFraction","maximumTemperatureC","minimumFreeVramMiB","minimumFreeDiskMiB","maxOutputMiB"):
            self.assertEqual(self.configuration["executionCeiling"][key],proposed[key],key)
        self.assertEqual(self.configuration["seed"],proposed["seed"])
        self.assertEqual(self.configuration["optimizer"],proposed["optimizer"])
        self.assertEqual(self.configuration["checkpointSelection"]["eligibleEpochs"],proposed["checkpointEligibleEpochs"])


if __name__ == "__main__": unittest.main()
