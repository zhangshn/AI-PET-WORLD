import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ai_painter.complete_world.current_natural_world_input import DESCRIPTOR_PATH, load_current_natural_world_input


class CurrentInputBoundaryTest(unittest.TestCase):
    def test_historical_path_and_non_native_stage_are_rejected_before_io(self):
        for path,stage in (("old/tick-0.json",2),(DESCRIPTOR_PATH,1)):
            with self.subTest(path=path,stage=stage), self.assertRaisesRegex(ValueError,"fixed native"):
                load_current_natural_world_input(root="absent",descriptor_binding={"path":path},stage=stage)

    def test_independent_reader_rejects_tampered_bytes_and_non_current_scope(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            p=root/DESCRIPTOR_PATH
            p.parent.mkdir(parents=True)
            data=json.dumps({"schemaVersion":"historical","scope":"old"}).encode()
            p.write_bytes(data)
            with self.assertRaisesRegex(ValueError,"hash differs"):
                load_current_natural_world_input(root=root,descriptor_binding={"path":DESCRIPTOR_PATH,"sha256":"0"*64})
            with self.assertRaisesRegex(ValueError,"scope differs"):
                load_current_natural_world_input(root=root,descriptor_binding={"path":DESCRIPTOR_PATH,"sha256":hashlib.sha256(data).hexdigest()})


if __name__=="__main__":
    unittest.main()
