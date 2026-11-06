from pathlib import Path
import hashlib
import json
import tempfile
import unittest

from ai_painter.complete_world.live_natural_world_input import ARCHIVE,STORE,descriptor_head,load_live_natural_world_input


class LiveInputBoundaryTest(unittest.TestCase):
    def test_caller_cannot_pick_arbitrary_or_unversioned_path(self):
        for p in ("data/world/input.json",ARCHIVE+"/latest/input.json",ARCHIVE+"/"+"a"*64+"/../input.json",ARCHIVE.upper()+"/"+"a"*64+"/input.json"):
            with self.subTest(path=p),self.assertRaises(ValueError):
                descriptor_head({"path":p})

    def test_archive_must_match_head_identity_before_opening_current_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=ARCHIVE+"/"+"a"*64+"/input.json";f=Path(tmp)/p;f.parent.mkdir(parents=True)
            raw=json.dumps(dict(schemaVersion="natural-world-live-map-input-v1",qualification="current_conditions_only",
                nativeShape=[1,23,768,1024],stage=2,head={"path":"foreign/world","sha256":"b"*64})).encode()
            f.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,"wrong live Store"):
                load_live_natural_world_input(root=tmp,descriptor_binding={"path":p,"sha256":hashlib.sha256(raw).hexdigest()})

    def test_previously_valid_descriptor_cannot_supply_the_live_tensor_after_store_advance(self):
        with tempfile.TemporaryDirectory() as tmp:
            head=hashlib.sha256(b'{"tick":3}').hexdigest()
            p=ARCHIVE+"/"+head+"/input.json";f=Path(tmp)/p;f.parent.mkdir(parents=True)
            store=Path(tmp)/STORE;store.parent.mkdir(parents=True);store.write_bytes(b'{"tick":4}')
            raw=json.dumps(dict(schemaVersion="natural-world-live-map-input-v1",qualification="current_conditions_only",
                nativeShape=[1,23,768,1024],stage=2,head={"path":STORE,"sha256":head})).encode()
            f.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,"hash differs"):
                load_live_natural_world_input(root=tmp,descriptor_binding={"path":p,"sha256":hashlib.sha256(raw).hexdigest()})
