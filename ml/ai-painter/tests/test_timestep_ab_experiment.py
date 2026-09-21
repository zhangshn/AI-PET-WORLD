"""CPU preflight and counterexamples for the isolated timestep allocation A/B."""
from copy import deepcopy
import inspect
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0,str(ROOT / "ml/ai-painter/src"))
import painter_timestep_ab_experiment as trial
from painter_learning_capacity_experiment import bound_json


class TimestepAbTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)
        cls.package=trial.materialize(ROOT)

    def rows(self):
        return [{"arm":arm,"sampleId":s,"seed":seed,"baseline":{"final":dict.fromkeys(
            ("rgbMae","laplacianMae","phase4ResidualRmsAfterGlobalBiasRemoval"),2.)},
            "measurements":{"final":dict.fromkeys(("rgbMae","laplacianMae","phase4ResidualRmsAfterGlobalBiasRemoval"),1. if i else 1.5)}}
            for i,arm in enumerate(trial.ARMS) for j,s in enumerate(trial.previous.SAMPLES)
            for seed in trial.comparison.SETTINGS["seedsBySample"][j]]

    def test_scope_binds_current_parent_two_original_images_and_same_budget(self):
        p=self.package
        self.assertEqual(p,trial.materialize(ROOT))
        self.assertEqual(p["training"]["totalOptimizerStepLimit"],2000)
        self.assertEqual(p["training"]["optimizerStepsPerArm"],1000)
        self.assertEqual(p["resources"],trial.base.RESOURCES)
        self.assertEqual(p["samplingSchemes"],trial.SCHEMES)
        self.assertEqual(p["comparison"]["inferenceSteps"],50)
        self.assertEqual([r["sampleId"] for r in p["selectedRows"]],trial.previous.SAMPLES)
        self.assertTrue(all(r["split"]=="train" for r in p["selectedRows"]))
        self.assertTrue(all(v is False for v in p["qualification"].values()))
        self.assertEqual(len(set(b["sha256"] for b in p["trainingDecoders"].values())),1)

    def test_actual_training_schedules_equal_independently_enumerated_proof(self):
        from ai_painter.complete_world.sample_timestep_schedule import coverage_by_sample
        import train_ai_assisted_conditional_denoiser as trainer
        expected=trial.alignment.coverage_proposal(self.package["config"])["coverage"]["500"]
        for arm,label in zip(trial.ARMS,("legacy","proposed")):
            sequences={s:[int(trial.arm_timesteps(self.package,arm,e,i,"cpu").item()) for e in range(500)]
                       for i,s in enumerate(trial.previous.SAMPLES)}
            actual=coverage_by_sample(sequences,diffusion_steps=1000,inference_timesteps=trainer.inference_timesteps(1000,50,"cpu").tolist())
            self.assertEqual(actual,expected[label])

    def test_sampling_rejects_wrong_arm_step_index_or_scheme(self):
        for arm,e,i in (("bad",0,0),(trial.ARMS[0],500,0),(trial.ARMS[1],-1,0),(trial.ARMS[0],0,2),(trial.ARMS[1],True,0)):
            with self.assertRaises(ValueError): trial.arm_timesteps(self.package,arm,e,i,"cpu")
        p=deepcopy(self.package);p["samplingSchemes"][trial.ARMS[1]]="random"
        with self.assertRaises(ValueError):trial.arm_timesteps(p,trial.ARMS[1],0,0,"cpu")

    def test_both_arms_load_identical_exact_current_weights_and_normalization(self):
        from ai_painter.complete_world.split_training import state_hash
        left,ln=trial.load_arm(ROOT,self.package,trial.ARMS[0])
        right,rn=trial.load_arm(ROOT,self.package,trial.ARMS[1])
        self.assertEqual(state_hash((left.state_dict(),ln)),state_hash((right.state_dict(),rn)))
        self.assertTrue(all(not p.requires_grad for p in left.parameters()))

    def test_real_v6_cpu_update_respects_frozen_ae_heads_and_noise_target_scope(self):
        import torch
        import train_ai_assisted_conditional_denoiser as trainer
        from ai_painter.complete_world.split_training import state_hash
        model,norm=trial.load_arm(ROOT,self.package,trial.ARMS[1])
        parameters=trial.trainable_parameters(model)
        before=trial.frozen_hash(model);initial=state_hash(model.denoiser.state_dict())
        item=trial.dataset_for(ROOT,self.package)[0]
        image,conditions=item["image"][None],item["conditions"][None]
        clean=trainer.normalize_latent(model.autoencoder.encode(image),norm)
        alpha=trainer.build_diffusion_schedule(self.package["config"],"cpu")["alphasCumulative"]
        step=trial.arm_timesteps(self.package,trial.ARMS[1],0,0,"cpu")
        noise=torch.randn(clean.shape,generator=torch.Generator().manual_seed(17))
        noisy=trainer.add_noise(clean,noise,step,alpha);target=trainer.velocity_target(clean,noise,step,alpha)
        measured=trainer.predict_and_measure(model,noisy,target,clean,step,alpha,conditions,self.package["config"],target_image=image,latent_normalization=norm)
        measured["compositeLossTensor"].backward()
        self.assertTrue(trial.check_gradients(model))
        torch.optim.AdamW(parameters,lr=.0001,weight_decay=.01).step()
        self.assertEqual(trial.frozen_hash(model),before)
        self.assertNotEqual(state_hash(model.denoiser.state_dict()),initial)
        self.assertFalse(torch.cuda.is_initialized())

    def test_checkpoint_binds_parent_scheme_decoder_and_nonpromotion(self):
        p=self.package;arm=trial.ARMS[0]
        cp={"schemaVersion":"ai-painter-timestep-ab-checkpoint-v1","experimentIdentity":p["experimentIdentity"],"arm":arm,
            "optimizerSteps":1000,"parentDenoiser":p["initialDenoiser"],"trainingDecoder":p["trainingDecoders"][arm],
            "inferenceDecoder":p["inferenceDecoder"],"samplingScheme":p["samplingSchemes"][arm],
            "checkpointPromotable":False,"formalInferenceEligible":False}
        trial.validate_checkpoint(cp,p,arm)
        for key,value in (("optimizerSteps",999),("parentDenoiser",{}),("samplingScheme",trial.SCHEMA),("checkpointPromotable",True),("inferenceDecoder",{})):
            with self.assertRaises(ValueError):trial.validate_checkpoint({**cp,key:value},p,arm)

    def test_paired_summary_compares_candidate_to_control_and_parent(self):
        summary=trial.summarize(self.rows())
        self.assertEqual(summary["pairedCandidateVersusControl"]["rgbMae"]["improvedCount"],6)
        self.assertFalse(summary["checkpointSelected"])
        self.assertFalse(summary["formalVisualQualification"])

    def test_summary_rejects_missing_rows_baseline_change_and_nonfinite_values(self):
        rows=self.rows()
        for bad in (rows[:-1],rows[::-1]):
            with self.assertRaises(ValueError):trial.summarize(bad)
        bad=deepcopy(rows);bad[6]["baseline"]["final"]["rgbMae"]=3.
        with self.assertRaisesRegex(ValueError,"baselines"):trial.summarize(bad)
        for value in (float("nan"),-1.,True):
            bad=deepcopy(rows);bad[0]["measurements"]["final"]["rgbMae"]=value
            with self.assertRaises(ValueError):trial.summarize(bad)

    def test_summary_preserves_regression_without_selecting_best(self):
        rows=self.rows();rows[6]["measurements"]["final"]["rgbMae"]=4.
        summary=trial.summarize(rows)
        self.assertEqual(summary["pairedCandidateVersusControl"]["rgbMae"]["worseCount"],1)
        self.assertFalse(summary["checkpointSelected"])

    def test_replay_entry_does_not_save_images_when_disabled(self):
        source=inspect.getsource(trial.evaluate)
        self.assertIn("if save_images:",source)
        self.assertIn('baseline = previous_result["rows"][6+i*3+j]',source)
        self.assertFalse(inspect.signature(trial.evaluate).parameters["save_images"].default is False)

    def test_existing_resource_stop_kills_only_owned_child(self):
        child=type("Child",(),{"pid":123,"poll":lambda self:None,"wait":lambda self,timeout:None})()
        with patch.object(trial.previous.subprocess,"run") as run:
            run.return_value.returncode=0
            trial.previous.stop_owned(child)
        self.assertEqual(run.call_args.args[0],["taskkill.exe","/PID","123","/T","/F"])


if __name__=="__main__":unittest.main()
