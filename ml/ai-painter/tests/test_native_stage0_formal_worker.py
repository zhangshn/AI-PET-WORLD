import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ai_painter.complete_world import native_stage0_formal_contract as c


class LocalFormalStageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)

    def test_exclusive_checkpoint_and_aggregate_reserve(self):
        dst=self.root/"recovery.pt"
        with patch.object(c,"ROOT",self.root):
            ref=c.publish(dst,b"x",self.root)
            self.assertEqual(ref["sha256"],hashlib.sha256(b"x").hexdigest())
            with self.assertRaises(FileExistsError):c.publish(dst,b"replacement",self.root)
            self.assertEqual(dst.read_bytes(),b"x")
            with self.assertRaises(ValueError):c.room(self.root,65*c.MIB,64*c.MIB)

    def test_fresh_ticket_rejects_parent_skipped_position_or_foreign_worker(self):
        root=self.root/"run";folder=root/"segments/01";folder.mkdir(parents=True)
        f=folder/"ticket.json";active=self.root/"active.json"
        active.write_text(json.dumps({"runnerPid":22,"executableSha256":"actual"}))
        ticket={"runId":c.RUN_ID,"phase":"cpu_rehearsal","segment":1,"startPair":0,"endPair":24,
                "issuedAtUtc":"2026-11-03T00:00:00+00:00","segmentDeadlineUtc":"2026-11-03T00:10:00+00:00",
                "runDeadlineUtc":"2026-11-03T06:00:00+00:00","policySha256":"sha","ownerRunnerPid":22,"previous":None}
        with patch.object(c,"CPU_RUN",root),patch.object(c,"ACTIVE",active),patch.object(c,"binding_external_python",return_value="actual"):
            at=c.timestamp(ticket["issuedAtUtc"])+1
            f.write_text(json.dumps(ticket));self.assertIsNone(c.verify_ticket(root,1,cpu=True,policy_sha="sha",current_time=at)["previous"])
            for changed in ({"previous":{"source":"smoke"}},{"ownerRunnerPid":9},{"endPair":48},{"phase":"train"},{"policySha256":"wrong"}):
                with self.subTest(changed=changed),self.assertRaises(ValueError):
                    f.write_text(json.dumps({**ticket,**changed}));c.verify_ticket(root,1,cpu=True,policy_sha="sha",current_time=at)
            f.write_text(json.dumps(ticket))
            with self.assertRaises(ValueError):c.verify_ticket(root,1,cpu=True,policy_sha="sha",current_time=at+900)

    def test_mode_receipt_preserves_order_and_exact_boolean_types(self):
        old=[{"modules":[("",True),("layer",False)],"requiresGrad":[("w",True)]}]
        self.assertEqual(c.primitive_modes(old)[0]["modules"],[["",True],["layer",False]])
        old[0]["modules"][0]=("",1)
        with self.assertRaises(ValueError):c.primitive_modes(old)

if __name__=="__main__":unittest.main()
