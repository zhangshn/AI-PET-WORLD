"""Read the fixed released train split only. The outer diagnostic job owns resource limits."""
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[3]


def main():
    if sys.argv[1:]!=["--verify-train48"]:
        raise ValueError("expected --verify-train48")
    sys.path.insert(0,str(ROOT/"ml/ai-painter/src"))
    from ai_painter.complete_world.native_stage1_train_source import NativeStage1TrainSource,MANIFEST,GEOMETRY
    source=NativeStage1TrainSource(ROOT)
    def write(row):print(json.dumps(row,separators=(",",":"),allow_nan=False),flush=True)
    write({"kind":"source","sourceRelease":MANIFEST,"trainMembership":source.manifest["splits"]["train"],"trainCount":len(source),
           "geometry":list(GEOMETRY.identity()),"stageTrainingAuthorized":False})
    objects=0
    for index in range(len(source)):
        row=source.describe(source.read_arrays(index));objects+=row["objectCount"];write(row)
    write({"kind":"complete","trainCount":len(source),"objectCount":objects,"torchImported":"torch" in sys.modules,
           "modelForwards":0,"optimizerUpdates":0,"stageTrainingAuthorized":False})


if __name__=="__main__":
    main()
