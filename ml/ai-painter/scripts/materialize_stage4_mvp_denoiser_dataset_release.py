from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.complete_world.mvp_denoiser_release import materialize_release


def main():
    parser = ArgumentParser()
    parser.add_argument("--parent", required=True)
    parser.add_argument("--parent-sha256", required=True)
    parser.add_argument("--foundation-qualification", required=True)
    parser.add_argument("--foundation-qualification-sha256", required=True)
    args = parser.parse_args()
    result = materialize_release(
        Path.cwd(),
        parent_binding={"path": args.parent.replace("\\", "/"), "sha256": args.parent_sha256},
        foundation_qualification_binding={
            "path": args.foundation_qualification.replace("\\", "/"),
            "sha256": args.foundation_qualification_sha256,
        },
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
