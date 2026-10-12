"""Isolated small CPU networks; never real data, parent graph/factory/probe."""
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
import compare_stage4_mvp256_dry_rgb_bias_precision_cpu as runner


class TinyModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.other = torch.nn.Parameter(torch.zeros(1))
        self.core = torch.nn.Module(); self.core.core = torch.nn.Module()
        decoder = self.core.core.final_rgb_decoder = torch.nn.Module()
        decoder.base = torch.nn.Module()
        decoder.base.layers = torch.nn.Sequential(*[torch.nn.Identity() for _ in range(4)],torch.nn.Conv2d(48,3,1))
    def forward(self,conditions,_table,appearance_regime=None,return_evidence=False):
        value = self.core.core.final_rgb_decoder.base.layers(conditions)
        return (value,{"synthetic":True}) if return_evidence else value


def model_factory(**_kwargs):
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(20260929); return TinyModel()


def critic_factory(): return torch.nn.Linear(1,1)


def graph(model):
    parameters = tuple(model.parameters())
    return parameters,{},0,{"synthetic":True,"tensors":len(parameters),
        "parameters":[{"name":name,"shape":list(value.shape),"elements":value.numel()} for name,value in model.named_parameters()]}


def prepare(_reader):
    return {"trainOrdinal":2,"season":"dry_season","order":["synthetic"],
            "sourceIdentity":{"sampleId":"synthetic2","split":"train","ordinal":0}}


def loader(_reader,plan,ordinal,season):
    assert ordinal == 2 and season == "dry_season"
    return {"split":"train","sampleId":plan["sourceIdentity"]["sampleId"],"image":torch.zeros(3,2,2),
            "conditions":torch.arange(192,dtype=torch.float32).reshape(48,2,2)*0.001,
            "objectInstanceTable":[]},runner.parent.encode_season(season),{"synthetic":True}


def probe_fixture(model,critic,sample,code,counters,budget,*,failure_evidence, reject=False, other_gradient=False, partial=False, mutate=None, cancellation=False, last_nonfinite=False):
    saved = runner.parent.state(critic)
    parameters,_,_,measured = graph(model); gradients = []
    try:
        counters["generatorForwardsAttempted"] += 1
        output,_ = model(sample["conditions"][None],[],appearance_regime=code,return_evidence=True)
        counters["generatorForwardsCompleted"] += 1
        if partial: raise RuntimeError("synthetic partial root cause")
        critic.train().requires_grad_(True)
        d_loss = critic(output.detach().mean().reshape(1,1)).square().sum()
        runner.parent.autograd(d_loss,tuple(critic.parameters()),counters,"discriminator",budget)
        critic.eval().requires_grad_(False)
        structured = output.sum()*0.25; whole = output.sum()*0.125; core = output.sum()*0.0625
        if cancellation:
            pattern = torch.tensor([1e8,1.,-1e8,1.]).reshape(1,1,2,2).repeat(1,3,1,1)
            structured = (output*pattern).sum(); whole = (output*(-pattern)).sum(); core = output.sum()
        total = (structured.float()+whole.float()).float()+core.float()
        candidate = isinstance(model.get_submodule(runner.TARGET),runner.DiagnosticRGBConv)
        if reject: total = total+model.get_submodule(runner.TARGET).bias.sum()*0.001
        if other_gradient and candidate: total = total+model.other.sum()*0.01
        for i,value in enumerate((total,structured,whole,core)):
            if last_nonfinite and i == 3: value = value*float("nan")
            gradients.append(runner.parent.autograd(value,parameters,counters,"generator",budget,retain=i<3))
        summary = runner.summarize_all(parameters,measured,gradients,[])
        if summary["allFailureIndices"]:
            original = ValueError("actual total gradient identity differs at parameter "+str(summary["allFailureIndices"][0]))
            runner.parent.record_gradient_failure(failure_evidence,measured,parameters,gradients,original)
            raise original
        if mutate is not None: mutate(model,sample)
        return {"synthetic":True,"notRealProbe":True}
    except BaseException as error:
        runner.parent.record_gradient_failure(failure_evidence,measured,parameters,gradients,error)
        raise
    finally:
        critic.eval().requires_grad_(False)
        assert runner.parent.state(critic) == saved


def execute(output,**changes):
    options = {"output":output,"synthetic":True,"prepare":prepare,"loader":loader,"model_factory":model_factory,
               "critic_factory":critic_factory,"graph_function":graph,"probe_function":probe_fixture}
    options.update(changes); return runner.execute(**options)


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone(); self.flags = runner.backend_state()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng,torch.random.get_rng_state()))
        self.assertEqual(self.flags,runner.backend_state()); torch.set_num_threads(self.threads)
        self.assertFalse(torch.cuda.is_initialized())

    def test_complete_pair_is_not_qualification_and_repeat_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); execute(output)
            data = (output/"report.json").read_bytes(); report = json.loads(data)
            self.assertEqual(report["status"],"comparison_completed_candidate_probe_passed_single_train_not_qualified")
            self.assertFalse(report["boundary"]["qualified"]); self.assertTrue(report["boundary"]["synthetic"])
            self.assertEqual(report["sourceIdentity"]["ordinal"],0); self.assertEqual(report["trainOrdinal"],2)
            self.assertTrue(all(report["parity"].values()))
            for row in report["pathResults"]:
                self.assertEqual(row["initialState"],row["finalState"])
                self.assertEqual(row["measurements"]["allParameterIdentity"]["parameterCount"],3)
            self.assertEqual(report["callCounts"],{path:runner.capture.EXPECTED_COUNTS for path in ("native","candidate")})
            with self.assertRaisesRegex(ValueError,"already consumed"): execute(output)
            self.assertEqual((output/"report.json").read_bytes(),data)

    def test_candidate_still_rejected_keeps_all_masks_original_errors(self):
        def reject(*args,**kwargs): return probe_fixture(*args,**kwargs,cancellation=True)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            execute(output,probe_function=reject)
            report = json.loads((output/"report.json").read_text())
            self.assertEqual(report["status"],"comparison_completed_candidate_rejected_closed")
            self.assertEqual(len(report["pathResults"]),2)
            for row in report["pathResults"]:
                self.assertEqual(row["gate"]["status"],"original_gradient_gate_rejected")
                summary = row["measurements"]["allParameterIdentity"]
                self.assertEqual(len(summary["parameters"]),3)
                self.assertIn(2,summary["allFailureIndices"])
            self.assertLessEqual(len(report["outsideToleranceExamples"]),8)
            self.assertTrue(all(value["matchesFloat64ReturnedFloat32"] for value in report["pathResults"][1]["measurements"]["targetBiasFourVjps"]))

    def test_complete_counts_but_last_finite_gate_rejection_preserves_root(self):
        def nonfinite(*args,**kwargs): return probe_fixture(*args,**kwargs,last_nonfinite=True)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"nonfinite generator gradients"):
                execute(Path(directory),probe_function=nonfinite)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(failure["error"],"nonfinite generator gradients")
            self.assertEqual(failure["callCounts"]["native"],runner.capture.EXPECTED_COUNTS)
            self.assertEqual(failure["observedPrefixes"]["native"]["generatorVjps"],3)
            self.assertEqual(failure["originalFailureEvidence"]["originalError"],failure["error"])

    def test_direct_bias_scalar_injection_is_reference_conflict(self):
        def reject(*args,**kwargs): return probe_fixture(*args,**kwargs,reject=True)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"bias differs from observed FP64"):
                execute(Path(directory),probe_function=reject)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(len(failure["partialPathResults"]),2)

    def test_scalar_byte_comparison_preserves_signed_zero_and_shape(self):
        self.assertTrue(runner.same_bytes(torch.tensor(1.),torch.tensor(1.)))
        self.assertFalse(runner.same_bytes(torch.tensor(0.),torch.tensor(-0.)))
        self.assertFalse(runner.same_bytes(torch.tensor(1.),torch.tensor([1.])))

    def test_non_target_gradient_change_fails_with_both_path_evidence(self):
        def changed(*args,**kwargs): return probe_fixture(*args,**kwargs,other_gradient=True)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"non-target generator gradient bytes differ"):
                execute(Path(directory),probe_function=changed)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(len(failure["partialPathResults"]),2)
            self.assertEqual(failure["partialPathResults"][1]["measurements"]["allParameterIdentity"]["allFailureIndices"],[0])

    def test_forward_change_and_bad_initial_graph_fail(self):
        class Changed(runner.DiagnosticRGBConv):
            def forward(self,value): return super().forward(value)+1e-4
        def altered(model):
            result = runner.install_candidate(model); model.get_submodule(runner.TARGET).__class__ = Changed; return result
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"whole forward bytes differ"):
                execute(Path(directory),installer=altered)
        def bad_graph(model):
            values = graph(model); values[3]["parameters"][2]["name"] = "missing_bias"; return values
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"bias absent"): execute(Path(directory),graph_function=bad_graph)
            self.assertEqual(json.loads((Path(directory)/"failure.json").read_text())["callCounts"],{})

    def test_partial_exception_prefix_and_missing_observations(self):
        def partial(*args,**kwargs): return probe_fixture(*args,**kwargs,partial=True)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError,"synthetic partial root cause"): execute(Path(directory),probe_function=partial)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(failure["callCounts"]["native"]["generatorForwardsCompleted"],1)
            self.assertEqual(failure["callCounts"]["native"]["generatorGradCallsAttempted"],0)
            self.assertNotIn("candidate",failure["callCounts"])
            self.assertEqual(failure["originalProbeErrors"]["native"]["message"],failure["error"])
        def missing(_m,_c,_s,_code,counters,_budget,**_kwargs):
            for key,max_value in runner.capture.EXPECTED_COUNTS.items():
                for _ in range(max_value): counters[key] += 1
            return {}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"incomplete observed"): execute(Path(directory),probe_function=missing)

    def test_state_rng_backend_source_restoration_and_autograd_unpatch(self):
        original = runner.parent.autograd
        def rng(_model,_sample): torch.rand(1)
        def backend(_model,_sample): torch.backends.mkldnn.enabled = not self.flags["mkldnnEnabled"]
        def source(_model,sample): sample["conditions"].add_(1)
        def model(value,_sample):
            with torch.no_grad(): value.other.add_(1)
        for mutation,pattern in ((rng,"RNG/source"),(backend,"backend changed"),(source,"RNG/source"),(model,"state changed")):
            def mutate(*args,**kwargs): return probe_fixture(*args,**kwargs,mutate=mutation)
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(ValueError,pattern): execute(Path(directory),probe_function=mutate)
                self.assertTrue((Path(directory)/"failure.json").exists())
            self.assertIs(runner.parent.autograd,original)
            self.assertTrue(torch.equal(self.rng,torch.random.get_rng_state()))
            self.assertEqual(self.flags,runner.backend_state())

    def test_time_call_output_budget_and_wrong_namespace(self):
        clock_values = iter((0.,121.,122.))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"120-second"):
                execute(Path(directory),clock=lambda:next(clock_values))
            self.assertEqual(json.loads((Path(directory)/"failure.json").read_text())["callCounts"],{})
        counters = runner.capture.LimitedCounters(); counters["generatorForwardsAttempted"] += 1
        with self.assertRaisesRegex(ValueError,"call limit"): counters["generatorForwardsAttempted"] += 1
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); (output/"quota.bin").write_bytes(b"x"*runner.LIMITS["combinedOutputBytes"])
            with self.assertRaisesRegex(ValueError,"reserved terminal quota"): execute(output)
            self.assertFalse((output/"claim.json").exists())
        for output in (runner.ROOT/runner.OUTPUT,runner.ROOT/runner.capture.OUTPUT,runner.ROOT/runner.parent.OUTPUT):
            with self.assertRaisesRegex(ValueError,"system-temp namespace"): execute(output)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError,"real overrides forbidden"): runner.execute(output=Path(directory))
            self.assertFalse((Path(directory)/"claim.json").exists())

    def test_full_parameter_masks_missing_nonfinite_and_examples_cap(self):
        parameters = tuple(torch.zeros(3) for _ in range(107))
        measured = {"parameters":[{"name":"p"+str(i)} for i in range(107)]}
        gradients = [[torch.ones(3) for _ in range(107)]]+[[None for _ in range(107)] for _ in range(3)]
        gradients[0][4] = None; gradients[0][7] = torch.full((3,),float("nan"))
        examples = []; result = runner.summarize_all(parameters,measured,gradients,examples)
        self.assertEqual(result["parameterCount"],107); self.assertEqual(len(examples),8)
        self.assertEqual(result["allFailureIndices"],[i for i in range(107) if i != 4])
        self.assertTrue(result["parameters"][4]["noneGradients"]["actualTotal"])
        self.assertEqual(result["parameters"][7]["status"],"invalid_or_nonfinite")
        json.dumps(result,allow_nan=False)

    def test_source_closure_and_frozen_read_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [*runner.parent.FILES,runner.capture.PROGRAM,runner.capture.TEST,runner.PROGRAM,runner.TEST,
                     runner.PRECISION["path"],runner.PRECISION_TEST["path"]]
            for path in paths:
                target = root/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_text("")
            reader = runner.parent.Reader(root); closure = runner.source_closure(reader)
            self.assertIn(runner.PROGRAM,closure); self.assertIn(runner.TEST,closure)
            self.assertIn(runner.PRECISION["path"],closure)
            bindings = [{"path":path,"sha256":sha} for path,sha in reader.observed.items()]
            frozen = runner.FrozenReader(bindings,root)
            with self.assertRaisesRegex(ValueError,"outside frozen closure"): frozen.read({"path":"unbound","sha256":"a"*64})
            (root/runner.PROGRAM).write_text("changed")
            with self.assertRaisesRegex(ValueError,"SHA differs"): frozen.snapshot(runner.PROGRAM)

    def test_resource_guards_and_parameter_object_preservation(self):
        model = model_factory(); original = tuple(model.named_parameters()); state = runner.parent.state(model)
        runner.install_candidate(model)
        self.assertEqual(runner.parent.state(model),state)
        self.assertTrue(all(n==m and p is q for (n,p),(m,q) in zip(original,model.named_parameters())))
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with runner.capture.guards(output):
                for operation in (lambda:torch.cuda._lazy_init(),lambda:torch.save({},output/"x.pt"),
                                  lambda:torch.load(output/"x.pt"),lambda:torch.ones(1,requires_grad=True).backward()):
                    with self.assertRaises(AssertionError): operation()
                for path in (output/"image.PNG",output.parent/"registry.json"):
                    with self.assertRaises(ValueError): path.open("w")


if __name__ == "__main__": unittest.main()
