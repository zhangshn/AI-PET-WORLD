from argparse import ArgumentParser
import json
from pathlib import Path


def main() -> int:
    parser = ArgumentParser(description="Block autonomous training until every required structure channel is ready.")
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    if report.get("canStartAutonomousTraining") is not True:
        blocked = [name for name, value in report.get("channels", {}).items() if value.get("status") != "ready"]
        print(json.dumps({"status": "blocked", "reason": "component_training_data_not_ready", "blockedChannels": blocked}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps({"status": "ready", "message": "autonomous training may start"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
