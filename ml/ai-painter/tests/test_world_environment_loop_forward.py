"""158 CPU schema/checkpoint checks. No test calls predict or a model forward."""
import copy
import datetime as dt
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_loop_forward.py"
spec = importlib.util.spec_from_file_location("loop_forward158", PATH)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def fixture(tick=0, mode="primary"):
    c = worker.read_contract()
    start = worker.utc(c["simulationEpochUtc"]) + dt.timedelta(days=tick)
    stamp = lambda value: value.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    source = []
    for i in range(7):
        begin = start - dt.timedelta(days=7-i)
        archival = begin < worker.utc(c["simulationEpochUtc"])
        source.append({"origin": "external_archival_context" if archival else "committed_fixture_event",
                       "sourceRef": dict(c["archiveBindings"][0]) if archival else {"path": worker.EVIDENCE + "/run-"+'1'*32+"/store/integration158-ownerId/integration158-worldId.json.evolution/"+'b'*64+'.'+'c'*64+'.event.json', "sha256": "a"*64},
                       "periodStartUtc": stamp(begin), "periodEndUtc": stamp(begin + dt.timedelta(days=1)), "note": "private numeric fixture"})
    data = {"schemaVersion": c["inputContract"]["schemaVersion"], "taskId": c["taskId"], "contractSha256": worker.CONTRACT_SHA256,
            "mode": mode, "identity": {k: "integration158-"+k for k in worker.IDENTITY_FIELDS},
            "before": {"tick": tick, "stateVersion": tick, "eventCursor": tick, "fileSha256": "b"*64, "recordContentSha256": "c"*64},
            "interval": {"logicalStartUtc": stamp(start), "logicalEndUtc": stamp(start+dt.timedelta(days=1)), "durationSeconds": 86400},
            "window": {"fieldOrder": copy.deepcopy(c["fieldOrder"]), "units": copy.deepcopy(c["units"]), "values": [[0, 50+i, 20+i/10, 1+i/10] for i in range(7)]},
            "provenance": source}
    return data, c


class InputChecks(unittest.TestCase):
    def test_three_primary_steps_and_two_probe_modes_accept_shapes(self):
        for tick, mode in [(0,"primary"),(1,"primary"),(2,"primary"),(2,"history_probe"),(2,"metadata_probe")]:
            d,c = fixture(tick,mode)
            self.assertEqual(worker.validate_input(worker.canonical(d),c),d)

    def test_unknown_and_future_fields_rejected(self):
        for target in ("root","window","before","interval","provenance"):
            d,c=fixture()
            obj = d if target=="root" else d["provenance"][0] if target=="provenance" else d[target]
            obj["futureTarget"]=[1,2,3,4]
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_formal_world_or_missing_identity_rejected(self):
        for mutate in (lambda d:d["identity"].update(worldId="mvp-natural-world-001"),lambda d:d["identity"].pop("regionId")):
            d,c=fixture();mutate(d)
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_bool_counter_future_tick_and_disagreement_rejected(self):
        for key,value in [("tick",False),("tick",3),("eventCursor",1),("fileSha256","bad")]:
            d,c=fixture();d["before"][key]=value
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_invalid_interval_and_early_probe_rejected(self):
        for field,value in [("logicalStartUtc","2020-01-08T00:00:00Z"),("logicalEndUtc","2020-01-10T00:00:00.000Z"),("durationSeconds",True)]:
            d,c=fixture();d["interval"][field]=value
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)
        d,c=fixture(0,"history_probe")
        with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_invalid_matrix_type_shape_units_and_guard_rejected(self):
        for mutate in (lambda d:d["window"]["values"].pop(),lambda d:d["window"]["values"][0].append(1),
                       lambda d:d["window"]["values"][0].__setitem__(1,True),lambda d:d["window"]["values"][0].__setitem__(1,101),
                       lambda d:d["window"]["units"].__setitem__(2,"K")):
            d,c=fixture();mutate(d)
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_nonfinite_duplicate_unsafe_integer_size_and_depth_rejected(self):
        for raw in (b'{"x":NaN}',b'{"x":1e999}',b'{"x":1,"x":2}',b'{"x":9007199254740992}',b' '*65537,b'['*34+b'0'+b']'*34):
            with self.assertRaises((ValueError,OverflowError)): worker.strict_json(raw)

    def test_provenance_future_origin_source_and_path_rejected(self):
        for mutate in (lambda d:d["provenance"][0].update(periodEndUtc="2020-01-08T00:00:00.000Z"),
                       lambda d:d["provenance"][0].update(origin="world_lived_event"),
                       lambda d:d["provenance"][0]["sourceRef"].update(sha256="0"*64),
                       lambda d:d["provenance"][-1]["sourceRef"].update(path="../../private.json")):
            d,c=fixture(2);mutate(d)
            with self.assertRaises(ValueError): worker.validate_input(worker.canonical(d),c)

    def test_metadata_note_does_not_change_feature_bytes(self):
        d,c=fixture(2,"metadata_probe");a=worker.feature_value_sha(d["window"]["values"])
        d["provenance"][0]["note"]="unrelated changed explanation"
        out=worker.validate_input(worker.canonical(d),c)
        self.assertEqual(a,worker.feature_value_sha(out["window"]["values"]))

    def test_committed_source_requires_fixed_run_store_and_same_identity(self):
        for replace in ('/runs/private/store/', '/run-'+ '1'*32 +'/outside/', '/run-'+ '1'*32 +'/store/another-owner/'):
            d,c=fixture(2)
            d['provenance'][-1]['sourceRef']['path']=worker.EVIDENCE+replace+'event.json'
            with self.assertRaises(ValueError):worker.validate_input(worker.canonical(d),c)

    def test_ieee_bytes_match_node_tiny_subnormal_negative_zero(self):
        d,_=fixture();d["window"]["values"][0][0]=4.825542730548925e-6;d["window"]["values"][1][0]=5e-324;d["window"]["values"][2][0]=-0.0
        raw=worker.canonical(d["window"]["values"])
        js="const fs=require('node:fs'),c=require('node:crypto');const v=JSON.parse(fs.readFileSync(0,'utf8'));const b=Buffer.alloc(224);v.flat().forEach((n,i)=>b.writeDoubleLE(n,i*8));process.stdout.write(c.createHash('sha256').update(b).digest('hex'))"
        r=subprocess.run(['node','-e',js],input=raw,capture_output=True,timeout=10)
        self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout.decode(),worker.feature_value_sha(worker.strict_json(raw)))
        # JSON -0 (not -0.0) must retain the same signed bit as JS JSON.parse.
        raw=raw.replace(b'-0.0',b'-0')
        r=subprocess.run(['node','-e',js],input=raw,capture_output=True,timeout=10)
        self.assertEqual(r.stdout.decode(),worker.feature_value_sha(worker.strict_json(raw)))

    def test_bad_input_does_not_load_model(self):
        with patch.object(worker,'load_model',side_effect=AssertionError('model load forbidden')) as load:
            with self.assertRaises(ValueError): worker.run(b'{}',worker.utc_now(),worker.time.monotonic())
            load.assert_not_called()

    def test_fixed_contract_and_model_code_bytes_match(self):
        c=worker.read_contract()
        for ref in c['modelCodeBindings']+[c['checkpoint']]:
            self.assertEqual(worker.sha(worker.read_fixed(ref)),ref['sha256'])


class CheckpointChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=worker.read_contract()
        # Loads tensors and validates metadata only; no call to predict.
        cls.module,cls.model,cls.torch=worker.load_model(cls.c)
        cls.checkpoint=cls.torch.load(io.BytesIO(worker.read_fixed(cls.c['checkpoint'])),map_location='cpu',weights_only=True)

    def test_real_checkpoint_identity_dtype_and_shape(self):
        validated=worker.validate_checkpoint(self.checkpoint,self.c,self.torch)
        self.assertEqual(tuple(validated['weights'].shape),(29,4))
        self.assertFalse(self.torch.cuda.is_initialized())

    def test_checkpoint_lineage_parent_and_boolean_fit_rejected(self):
        for key,value in [('contractSha256','0'*64),('trainingDatasetSha256','0'*64),('parentCheckpointSha256','0'*64),('fitCount',True),('onlyFittedColumn','T2M')]:
            c={**self.checkpoint,key:value}
            with self.assertRaises(ValueError): worker.validate_checkpoint(c,self.c,self.torch)

    def test_tensor_dtype_shape_nonfinite_and_zero_std_rejected(self):
        for kind in ('dtype','shape','nonfinite','zero_std'):
            m={k:v.clone() for k,v in self.model.items()}
            if kind=='dtype':m['weights']=m['weights'].float()
            elif kind=='shape':m['weights']=m['weights'][:1]
            elif kind=='nonfinite':m['weights'][0,0]=float('nan')
            else:m['inputStd'][0]=0
            with self.assertRaises(ValueError): worker.validate_checkpoint({**self.checkpoint,'model':m},self.c,self.torch)


if __name__=='__main__':
    unittest.main()
