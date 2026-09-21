"""CPU evidence for per-sample coverage, target-free probes and explicit limits."""
from copy import deepcopy
import inspect
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0,str(ROOT / "ml/ai-painter/src"))
import diagnose_training_sampling_alignment as diagnosis
from ai_painter.complete_world.sample_timestep_schedule import sample_timestep, coverage_by_sample


class AlignmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def step(self,i,e,**overrides):
        args=dict(sample_ordinal=i,sample_count=2,presentation_index=e,diffusion_steps=1000,stride=137,seed=20260908)
        return sample_timestep(**{**args,**overrides})

    def config(self):
        return {"diffusionSteps":1000,"training":{"seed":20260908,"timestepCoverageStride":137,
                "timestepSampling":"deterministic_full_schedule_cover_v2"}}

    def rows(self):
        return [{"sampleId":s,"split":"train","seed":seed,"baselinePixelsAndMeasurementsExact":True,
            "targetUsedForInitialization":False,
            "parityPairs":[{"timesteps":list(p),"sourceArmCoveredParity":i,"teacherCleanLatentMse":[1.,2.]}
                           for p in diagnosis.PAIRS],
            "trajectory":[{"timestep":t,"freeCleanLatentMse":2.,"teacherCleanLatentMse":1.,"inputDistributionMse":3.}
                          for t in diagnosis.sampling.trajectory.SNAPSHOTS]}
            for i,s in enumerate(diagnosis.sampling.source.previous.SAMPLES)
            for seed in diagnosis.SETTINGS["seedsBySample"][i]]

    def test_legacy_pool_hides_per_sample_alias_even_after_more_epochs(self):
        result=diagnosis.coverage_proposal(self.config())
        self.assertEqual(result["legacyPerSampleCycleLength"],500)
        for count in ("500","1000"):
            old=result["coverage"][count]["legacy"]
            self.assertTrue(old["globalUnionFullScheduleCovered"])
            self.assertFalse(old["everySampleFullScheduleCovered"])
            self.assertEqual([r["uniqueTimestepCount"] for r in old["samples"].values()],[500,500])

    def test_same_budget_removes_parity_lock_without_claiming_full_coverage(self):
        result=diagnosis.coverage_proposal(self.config())["coverage"]["500"]["proposed"]
        self.assertTrue(result["globalUnionFullScheduleCovered"])
        self.assertFalse(result["everySampleFullScheduleCovered"])
        for sample in result["samples"].values():
            self.assertEqual(sample["uniqueTimestepCount"],500)
            self.assertEqual((sample["evenPresentations"],sample["oddPresentations"]),(250,250))

    def test_full_cycle_covers_every_timestep_for_each_sample(self):
        for i in range(2):
            self.assertEqual({self.step(i,e) for e in range(1000)},set(range(1000)))
            self.assertEqual(self.step(i,1000),self.step(i,0))

    def test_interleaving_and_resume_do_not_change_sample_sequence(self):
        expected={(i,e):self.step(i,e) for i in range(2) for e in range(10)}
        interleaved={(i,e):self.step(i,e) for e in range(10) for i in (1,0)}
        resumed={(i,e):self.step(i,e) for e in (*range(5),*range(5,10)) for i in range(2)}
        self.assertEqual(expected,interleaved)
        self.assertEqual(expected,resumed)

    def test_integer_validation_rejects_boolean_and_float(self):
        for key in ("sample_ordinal","sample_count","presentation_index","diffusion_steps","stride","seed"):
            for value in (True,1.):
                with self.assertRaisesRegex(ValueError,"integer"):
                    self.step(0,0,**{key:value})

    def test_invalid_identity_counter_or_stride_rejected(self):
        for fields in ({"sample_ordinal":2},{"sample_ordinal":-1},{"sample_count":0},{"sample_count":1001},
                       {"presentation_index":-1},{"diffusion_steps":1},{"stride":2},{"stride":0},{"stride":1001}):
            with self.assertRaisesRegex(ValueError,"invalid"):
                self.step(0,0,**fields)

    def test_general_coprime_cycle_stays_bounded_and_complete(self):
        for size,stride,count in ((7,3,3),(16,5,4),(1000,137,3)):
            for i in range(count):
                sequence=[self.step(i,e,diffusion_steps=size,stride=stride,sample_count=count) for e in range(size)]
                self.assertEqual(set(sequence),set(range(size)))

    def test_coverage_rejects_empty_invalid_or_unidentified_samples(self):
        for sequences in ({},{"a":[]},{"a":[True]},{"a":[-1]},{"a":[1000]},{"a":[.5]},{"": [1]}):
            with self.assertRaises(ValueError):
                coverage_by_sample(sequences,diffusion_steps=1000,inference_timesteps=[999,0])

    def test_capture_exactly_preserves_sampler_and_has_no_target_parameter(self):
        import torch
        self.assertNotIn("target",inspect.signature(diagnosis.capture).parameters)
        conditions=torch.zeros(1,23,192,256)
        alpha=(1-torch.linspace(.0001,.02,1000)).cumprod(0)
        predictor=lambda x,t,c:x*.25
        old=diagnosis.sampling.trajectory.capture_rollout(torch,predictor,conditions,alpha,17,lambda:None)
        new=diagnosis.capture(torch,predictor,conditions,alpha,17,lambda:None)
        self.assertTrue(torch.equal(old[0],new[0]))
        self.assertTrue(torch.equal(old[1],new[1]))
        self.assertEqual(old[3],new[4])
        self.assertEqual(tuple(new[3]),diagnosis.sampling.trajectory.SNAPSHOTS)
        self.assertTrue(torch.equal(new[3][999],new[0]))
        self.assertTrue(all(torch.equal(old[2][t],new[2][t]) for t in old[2]))
        self.assertFalse(torch.cuda.is_initialized())

    def test_summary_keeps_both_directions_without_causal_or_release_claim(self):
        result=diagnosis.summarize(self.rows())
        self.assertEqual(len(result["parityComparisons"]),60)
        self.assertEqual(result["parityComparisons"][0]["unseenToSeenRatio"],2.)
        self.assertEqual(result["parityComparisons"][-1]["unseenToSeenRatio"],.5)
        for key in ("parityAloneProvesNoiseCause","trainingInputFormulaIsBug","scheduleAdopted","checkpointSelected","formalVisualQualification"):
            self.assertIs(result[key],False)

    def test_incomplete_reordered_parity_or_trajectory_matrix_rejected(self):
        rows=self.rows()
        for bad in (rows[:-1],rows[::-1],rows+[rows[0]]):
            with self.assertRaisesRegex(ValueError,"matrix"):
                diagnosis.summarize(bad)
        for key in ("parityPairs","trajectory"):
            bad=deepcopy(rows)
            bad[0][key].pop()
            with self.assertRaisesRegex(ValueError,"matrix"):
                diagnosis.summarize(bad)

    def test_wrong_parity_scope_and_nonfinite_values_rejected(self):
        for field,value in (("split","validation"),("targetUsedForInitialization",True),("baselinePixelsAndMeasurementsExact",False)):
            rows=self.rows()
            rows[0][field]=value
            with self.assertRaises(ValueError):
                diagnosis.summarize(rows)
        rows=self.rows()
        rows[0]["parityPairs"][0]["sourceArmCoveredParity"]=1
        with self.assertRaisesRegex(ValueError,"parity"):
            diagnosis.summarize(rows)
        for value in (float("nan"),float("inf"),-1.,True):
            rows=self.rows()
            rows[0]["parityPairs"][0]["teacherCleanLatentMse"][0]=value
            with self.assertRaisesRegex(ValueError,"invalid"):
                diagnosis.summarize(rows)
            rows=self.rows()
            rows[0]["trajectory"][0]["inputDistributionMse"]=value
            with self.assertRaisesRegex(ValueError,"invalid"):
                diagnosis.summarize(rows)

    def test_zero_denominator_is_unknown_not_fabricated_ratio(self):
        rows=self.rows()
        rows[0]["parityPairs"][0]["teacherCleanLatentMse"]=[0.,1.]
        self.assertIsNone(diagnosis.summarize(rows)["parityComparisons"][0]["unseenToSeenRatio"])

    def test_proposal_does_not_mutate_config_or_allow_training(self):
        config=self.config()
        before=deepcopy(config)
        result=diagnosis.coverage_proposal(config)
        self.assertEqual(config,before)
        self.assertEqual(result["implementationStatus"],"cpu_implemented_not_adopted_not_trained")
        for key in ("optimizerUpdatesAllowed","scheduleAdoptionAllowed","formalQualificationAllowed"):
            self.assertIs(diagnosis.SETTINGS[key],False)
        self.assertEqual(diagnosis.SETTINGS["automaticRetries"],0)


if __name__ == "__main__":
    unittest.main()
