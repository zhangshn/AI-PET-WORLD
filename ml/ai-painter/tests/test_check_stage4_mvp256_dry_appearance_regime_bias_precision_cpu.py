"""Full successor artificial-scene probe plus isolated control-plane negatives."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import torch
sys.path.insert(0,str(Path(__file__).absolute().parents[3]/"ml/ai-painter/scripts"))
import check_stage4_mvp256_dry_appearance_regime_bias_precision_cpu as checker
from test_object_appearance_regime_conditioned_cpu import ORDER,scene
from test_compare_stage4_mvp256_dry_rgb_bias_precision_cpu import model_factory as tiny_model,critic_factory as tiny_critic,graph as tiny_graph


def prepare_full(_reader):
    return {"order":ORDER,"selected":{str(ordinal):{"identity":{"sampleId":"synthetic-"+str(ordinal),"split":"train","ordinal":0}}
            for ordinal,_ in checker.SELECTED}}


def load_full(_reader,plan,ordinal,season):
    conditions,table = scene()
    image = torch.linspace(0,1,256)[None,None,:].expand(3,192,256).contiguous()
    return {"split":"train","sampleId":plan["selected"][str(ordinal)]["identity"]["sampleId"],
            "image":image,"conditions":conditions[0],"objectInstanceTable":table},checker.parent.encode_season(season),{"synthetic":True}


def prepare_small(_reader):
    return {"order":["synthetic"],"selected":{str(ordinal):{"identity":{"sampleId":"s"+str(ordinal),"split":"train","ordinal":0}}
            for ordinal,_ in checker.SELECTED}}


def load_small(_reader,plan,ordinal,season):
    return {"split":"train","sampleId":plan["selected"][str(ordinal)]["identity"]["sampleId"],"image":torch.zeros(3,2,2),
            "conditions":torch.zeros(48,2,2),"objectInstanceTable":[]},checker.parent.encode_season(season),{"synthetic":True}


def fake_probe(_model,_critic,_sample,_code,counters,budget,*,failure_evidence):
    for key,maximum in checker.comparison.capture.EXPECTED_COUNTS.items():
        for _ in range(maximum): budget(); counters[key] += 1
    return {"syntheticCounterFixtureOnly":True,"realMathRun":False}


def execute_small(output,**changes):
    options = {"output":output,"synthetic":True,"prepare":prepare_small,"loader":load_small,
        "model_factory":tiny_model,"baseline_factory":tiny_model,"critic_factory":tiny_critic,
        "graph_function":tiny_graph,"probe_function":fake_probe}
    options.update(changes); return checker.execute(**options)


class SuccessorCheckerTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone(); self.flags = checker.comparison.backend_state()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng,torch.random.get_rng_state())); self.assertEqual(self.flags,checker.comparison.backend_state())
        torch.set_num_threads(self.threads); self.assertFalse(torch.cuda.is_initialized())

    def test_full_synthetic_four_regimes_original_losses_107_gate_heads_slices(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            checker.execute(output=output,synthetic=True,prepare=prepare_full,loader=load_full,model_factory=checker.build,
                baseline_factory=checker.parent.build,critic_factory=checker.parent.build_conditional_texture_discriminator,
                graph_function=checker.graph,probe_function=checker.probe)
            data = (output/"report.json").read_bytes(); report = json.loads(data)
            self.assertEqual(report["callCounts"],checker.EXPECTED)
            self.assertFalse(report["boundary"]["qualified"]); self.assertTrue(report["boundary"]["synthetic"])
            self.assertEqual(report["actualGraph"]["tensors"],107); self.assertEqual(report["actualGraph"]["elements"],2240671)
            self.assertEqual(report["parameterInitialization"]["originalParameterDigest"],report["parameterInitialization"]["successorParameterDigest"])
            self.assertNotEqual(report["parameterInitialization"]["originalState"]["sha256"],report["initialState"]["model"]["sha256"])
            self.assertEqual(report["initialState"],report["finalState"])
            for (_,season),row in zip(checker.SELECTED,report["sampleResults"]):
                self.assertEqual(row["season"],season)
                self.assertTrue(row["allParameterIdentity"]["passedAllOriginalToleranceMasks"])
                self.assertEqual(len(row["allParameterIdentity"]["parameters"]),107)
                active = checker.parent.SEASONS.index(season)
                self.assertGreater(row["seasonalSliceL2"][active],0)
                self.assertTrue(all(value==0 for i,value in enumerate(row["seasonalSliceL2"]) if i != active))
                self.assertTrue(all(value>0 for value in row["candidateHeadL2"].values()))
                self.assertEqual(set(row["fourHeadUpdate"]["headDiagnostics"]),set(checker.parent.ROLES))
            with self.assertRaisesRegex(ValueError,"already consumed"):
                execute_small(output)
            self.assertEqual((output/"report.json").read_bytes(),data)

    def test_full_probe_last_nonfinite_keeps_four_computed_sets_and_root(self):
        model = checker.build(condition_channel_order=ORDER).train()
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(20260929); critic = checker.parent.build_conditional_texture_discriminator().eval().requires_grad_(False)
        sample,code,_ = load_full(None,prepare_full(None),2,"dry_season")
        original = torch.autograd.grad; calls = []
        def last_nonfinite(*args,**kwargs):
            values = original(*args,**kwargs); calls.append(1)
            if len(calls) == 5:
                values = list(values); values[0] = torch.full_like(values[0],float("nan")); values = tuple(values)
            return values
        counts = checker.Counters(); evidence = {}
        with patch.object(torch.autograd,"grad",last_nonfinite):
            with self.assertRaisesRegex(ValueError,"nonfinite generator gradients"):
                checker.probe(model,critic,sample,code,counts,lambda:None,failure_evidence=evidence)
        self.assertEqual(evidence["originalError"],"nonfinite generator gradients")
        self.assertEqual(evidence["gradientSetsAvailable"],4)
        self.assertEqual(counts["generatorGradCallsCompleted"],4)
        self.assertTrue(evidence["allParameterIdentity"]["allFailureIndices"])
        json.dumps(evidence,allow_nan=False)

    def test_secondary_diagnostic_and_invariant_errors_preserve_original(self):
        # Small proxy graph exercises error precedence without invoking a real
        # model, objective or global predecessor patch.
        model = tiny_model(); model.condition_channel_order = ("synthetic",)
        with torch.random.fork_rng(devices=[]): critic = tiny_critic().eval().requires_grad_(False)
        sample,code,_ = load_small(None,prepare_small(None),2,"dry_season")
        def computed_then_fail(loss,parameters,counters,kind,budget,retain=False,observed=None):
            counters[kind+"GradCallsAttempted"] += 1; counters[kind+"GradCallsCompleted"] += 1
            values = tuple(torch.zeros_like(p) for p in parameters)
            if observed is not None: observed.append(values)
            if kind == "generator" and len(observed) == 4:
                sample["conditions"].add_(1)
                torch.rand(1); torch.backends.mkldnn.enabled = not self.flags["mkldnnEnabled"]
                raise RuntimeError("original synthetic prefix error")
            return tuple(torch.ones_like(p) for p in parameters)
        objective = lambda _c,p,_s,_t,_o:(p.sum(),{"v21UnchangedTotal":p.sum(),"wholeFrameFidelity":p.sum(),"objectCoreRgbWeighted":p.sum()})
        evidence = {}; counters = checker.Counters()
        # Objectives are new-checker aliases added for deterministic unit faults.
        with patch.object(checker,"graph",tiny_graph),patch.object(checker,"autograd",computed_then_fail), \
             patch.object(checker,"discriminator_objective",lambda _c,p,_s:(p.sum(),{})), \
             patch.object(checker,"generator_objective",objective), \
             patch.object(checker,"summarize_all",side_effect=RuntimeError("secondary diagnostic error")):
            with self.assertRaisesRegex(RuntimeError,"original synthetic prefix error"):
                checker.probe(model,critic,sample,code,counters,lambda:None,failure_evidence=evidence)
        self.assertEqual(evidence["originalError"],"original synthetic prefix error")
        self.assertEqual(evidence["secondaryDiagnosticErrors"][0]["message"],"secondary diagnostic error")
        self.assertEqual(evidence["secondaryInvariantErrors"][0]["message"],"source/instance mutated")
        self.assertEqual(evidence["secondaryInvariantErrors"][1]["message"],"probe RNG/backend mutated")
        self.assertTrue(torch.equal(self.rng,torch.random.get_rng_state())); self.assertEqual(self.flags,checker.comparison.backend_state())

    def test_control_pair_counts_repeat_and_partial_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); execute_small(output)
            report = json.loads((output/"report.json").read_text())
            self.assertEqual(report["callCounts"],checker.EXPECTED)
            self.assertEqual(len(report["sampleResults"]),4)
            with self.assertRaises(ValueError): execute_small(output)
        def partial(_m,_c,_s,_code,counters,_budget,**_kwargs):
            counters["generatorForwardsAttempted"] += 1; counters["generatorForwardsCompleted"] += 1
            counters["generatorGradCallsAttempted"] += 1
            raise RuntimeError("synthetic partial root")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError,"synthetic partial root"): execute_small(Path(directory),probe_function=partial)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(failure["callCounts"]["generatorGradCallsAttempted"],1)
            self.assertEqual(failure["callCounts"]["generatorGradCallsCompleted"],0)
            self.assertFalse((Path(directory)/"report.json").exists())

    def test_wrong_season_id_initialization_state_and_backend_rejected(self):
        def wrong_season(*args):
            sample,_,identity = load_small(*args); return sample,checker.parent.encode_season("wet_season"),identity
        def wrong_id(*args):
            sample,code,identity = load_small(*args); sample["sampleId"] = "wrong"; return sample,code,identity
        def wrong_baseline(**kwargs):
            model = tiny_model(**kwargs)
            with torch.no_grad(): model.other.add_(1)
            return model
        for changes,pattern in (({"loader":wrong_season},"regime"),({"loader":wrong_id},"source"),({"baseline_factory":wrong_baseline},"initialization")):
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(ValueError,pattern): execute_small(Path(directory),**changes)
        for target in ("model","source","backend"):
            def mutation(model,critic,sample,code,counters,budget,**kwargs):
                result = fake_probe(model,critic,sample,code,counters,budget,**kwargs)
                if target == "model":
                    with torch.no_grad(): model.other.add_(1)
                elif target == "source": sample["conditions"].add_(1)
                else: torch.backends.mkldnn.enabled = not self.flags["mkldnnEnabled"]
                return result
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError): execute_small(Path(directory),probe_function=mutation)
            self.assertEqual(self.flags,checker.comparison.backend_state())

    def test_timeout_per_case_caps_output_and_old_namespace(self):
        clock_values = iter((0.,181.,182.))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"180-second"):
                execute_small(Path(directory),clock=lambda:next(clock_values))
            self.assertEqual(json.loads((Path(directory)/"failure.json").read_text())["callCounts"],checker.parent.COUNTS)
        counters = checker.Counters(); counters.begin_case(); counters["generatorForwardsAttempted"] += 1
        with self.assertRaisesRegex(ValueError,"call limit"): counters["generatorForwardsAttempted"] += 1
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); (output/"quota.bin").write_bytes(b"x"*checker.BUDGET["outputBytes"])
            with self.assertRaisesRegex(ValueError,"reserved terminal"): execute_small(output)
            self.assertFalse((output/"claim.json").exists())
        for output in (checker.ROOT/checker.OUTPUT,checker.ROOT/checker.parent.OUTPUT,checker.ROOT/checker.comparison.OUTPUT):
            with self.assertRaisesRegex(ValueError,"isolated synthetic"): execute_small(output)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"real callback/path"): checker.execute(output=Path(directory))

    def test_historical_snapshot_mapping_and_strict_source_reads(self):
        self.assertEqual(checker.historical_binding(checker.parent.SPEC),checker.OLD_SPEC)
        self.assertEqual(checker.historical_binding(checker.comparison.GUIDE),checker.OLD_GUIDE)
        with self.assertRaisesRegex(ValueError,"historical guide"): checker.historical_binding(checker.GUIDE)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/"s.py").write_bytes(b"source")
            binding = {"path":"s.py","sha256":hashlib.sha256(b"source").hexdigest()}
            reader = checker.FrozenReader([binding],root); reader.read(binding)
            (root/"s.py").write_bytes(b"changed")
            with self.assertRaises(ValueError): reader.unchanged()
            with self.assertRaises(ValueError): reader.read({"path":"missing","sha256":"a"*64})

    def test_own_graph_identity_rejects_predecessor_and_does_not_patch_old_globals(self):
        parent_graph,parent_probe,parent_seasonal = checker.parent.graph,checker.parent.probe,checker.parent.seasonal_parameter
        model = checker.build(condition_channel_order=ORDER)
        _,groups,index,actual = checker.graph(model)
        self.assertEqual(actual["capability"],checker.CAPABILITY)
        self.assertNotIn(index,{i for rows in groups.values() for i in rows})
        with self.assertRaises(ValueError): checker.graph(checker.parent.build(condition_channel_order=ORDER))
        self.assertIs(checker.parent.graph,parent_graph); self.assertIs(checker.parent.probe,parent_probe)
        self.assertIs(checker.parent.seasonal_parameter,parent_seasonal)


if __name__ == "__main__": unittest.main()
