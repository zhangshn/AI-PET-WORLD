"""Existing dataset-entry adapter; no training, model construction or GPU."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from ai_painter.complete_world.source_correction_release import materialize_release


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    result = materialize_release(Path.cwd(), {"path": args.request, "sha256": args.sha256})
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
