# 当前文件作用：提供 AI-PET-WORLD 真实 local image model 的本地契约服务入口；未接入真实模型前不生成图片、不返回假图。

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


HOST = "127.0.0.1"
PORT = 7001

REQUIRED_RESPONSE_FIELDS = [
    "imageUrl",
    "imageFormat",
    "width",
    "height",
    "license",
    "originalityConfirmed",
]

ALLOWED_IMAGE_FORMATS = ["png", "webp", "jpg"]
ALLOWED_LICENSES = ["self_owned", "cc0", "commercial_license"]


class LocalImageModelHandler(BaseHTTPRequestHandler):
    server_version = "AI-PET-WORLD-LocalImageModelContract/0.1"

    def do_GET(self) -> None:
        if self.path == "/health":
            self.write_json(
                200,
                {
                    "ok": False,
                    "status": "local_image_model_implementation_not_connected",
                    "model": "ai-pet-world-local-image-model-contract-server",
                    "version": "contract-shell-1",
                    "supportsWorldVisualPainter": True,
                    "supportsResponseContract": True,
                    "supportsHiddenCandidateOutput": True,
                    "supportsPng": True,
                    "supportsWebp": True,
                    "supportsJpg": True,
                    "requiredResponseShape": REQUIRED_RESPONSE_FIELDS,
                    "message": "local image model 契约服务已启动，但真实图像生成模型尚未接入。",
                    "messageEn": "The local image model contract service is running, but no real image generation model is connected.",
                    "canShowToPlayer": False,
                    "tags": [
                        "local_image_model_contract_server",
                        "implementation_not_connected",
                        "does_not_generate",
                        "fake_image_forbidden",
                        "not_player_visible",
                    ],
                },
            )
            return

        self.write_not_found()

    def do_POST(self) -> None:
        if self.path == "/dry-run":
            self.handle_dry_run()
            return

        if self.path == "/generate":
            self.handle_generate()
            return

        self.write_not_found()

    def handle_dry_run(self) -> None:
        payload_result = self.read_json_body()

        if not payload_result["ok"]:
            self.write_json(
                400,
                {
                    "ok": False,
                    "status": "invalid_json",
                    "message": payload_result["error"],
                    "messageEn": payload_result["error"],
                    "canShowToPlayer": False,
                    "tags": ["local_image_model_dry_run", "invalid_json"],
                },
            )
            return

        payload = payload_result["payload"]
        request_body = payload.get("requestBody") if isinstance(payload, dict) else None

        audit = validate_generation_request(request_body)

        if not audit["requestContractValid"]:
            self.write_json(
                422,
                {
                    "ok": False,
                    "status": "local_image_model_dry_run_request_invalid",
                    "model": "ai-pet-world-local-image-model-contract-server",
                    "version": "contract-shell-1",
                    **audit,
                    "requiredResponseShape": REQUIRED_RESPONSE_FIELDS,
                    "willReturnImageUrl": False,
                    "willReturnImageFormat": False,
                    "willReturnWidth": False,
                    "willReturnHeight": False,
                    "willReturnLicense": False,
                    "willReturnOriginalityConfirmed": False,
                    "willPersistOnlyAsHiddenCandidate": False,
                    "message": "dry-run 请求契约检查未通过。",
                    "messageEn": "The dry-run request contract check failed.",
                    "canShowToPlayer": False,
                    "tags": [
                        "local_image_model_dry_run",
                        "request_contract_failed",
                        "does_not_generate",
                        "not_player_visible",
                    ],
                },
            )
            return

        self.write_json(
            501,
            {
                "ok": False,
                "status": "local_image_model_implementation_not_connected",
                "model": "ai-pet-world-local-image-model-contract-server",
                "version": "contract-shell-1",
                **audit,
                "requiredResponseShape": REQUIRED_RESPONSE_FIELDS,
                "willReturnImageUrl": False,
                "willReturnImageFormat": False,
                "willReturnWidth": False,
                "willReturnHeight": False,
                "willReturnLicense": False,
                "willReturnOriginalityConfirmed": False,
                "willPersistOnlyAsHiddenCandidate": False,
                "message": "契约服务理解正式视觉请求，但真实 local image model implementation 尚未接入，因此不能声明会返回 6 个图片字段。",
                "messageEn": "The contract service understands the formal visual request, but no real local image model implementation is connected, so it cannot declare the six image fields.",
                "nextStep": {
                    "zh": "接入真实 local image model 后，dry-run 必须返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
                    "en": "After connecting a real local image model, dry-run must return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
                },
                "canShowToPlayer": False,
                "tags": [
                    "local_image_model_dry_run",
                    "implementation_not_connected",
                    "request_contract_checked",
                    "does_not_generate",
                    "fake_image_forbidden",
                    "not_player_visible",
                ],
            },
        )

    def handle_generate(self) -> None:
        payload_result = self.read_json_body()

        if not payload_result["ok"]:
            self.write_json(
                400,
                {
                    "ok": False,
                    "status": "invalid_json",
                    "message": payload_result["error"],
                    "messageEn": payload_result["error"],
                    "canShowToPlayer": False,
                    "tags": ["local_image_model_generate", "invalid_json"],
                },
            )
            return

        request_body = payload_result["payload"]
        audit = validate_generation_request(request_body)

        if not audit["requestContractValid"]:
            self.write_json(
                422,
                {
                    "ok": False,
                    "status": "local_image_model_generate_request_invalid",
                    "model": "ai-pet-world-local-image-model-contract-server",
                    "version": "contract-shell-1",
                    **audit,
                    "requiredResponseShape": REQUIRED_RESPONSE_FIELDS,
                    "message": "正式生成请求契约检查未通过。",
                    "messageEn": "The formal generate request contract check failed.",
                    "canShowToPlayer": False,
                    "tags": [
                        "local_image_model_generate",
                        "request_contract_failed",
                        "does_not_generate",
                        "not_player_visible",
                    ],
                },
            )
            return

        self.write_json(
            501,
            {
                "ok": False,
                "status": "local_image_model_implementation_not_connected",
                "model": "ai-pet-world-local-image-model-contract-server",
                "version": "contract-shell-1",
                **audit,
                "requiredResponseShape": REQUIRED_RESPONSE_FIELDS,
                "message": "真实 local image model implementation 尚未接入。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
                "messageEn": "No real local image model implementation is connected. This service will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
                "nextStep": {
                    "zh": "下一步接入真实图像生成模型，使 /generate 返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
                    "en": "Next connect a real image generation model so /generate returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
                },
                "canShowToPlayer": False,
                "tags": [
                    "local_image_model_generate",
                    "implementation_not_connected",
                    "request_contract_checked",
                    "does_not_generate",
                    "fake_image_forbidden",
                    "not_player_visible",
                ],
            },
        )

    def read_json_body(self) -> dict[str, Any]:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8")

            if not raw_body:
                return {"ok": False, "error": "Request body is empty."}

            payload = json.loads(raw_body)

            if not isinstance(payload, dict):
                return {"ok": False, "error": "Request body must be a JSON object."}

            return {"ok": True, "payload": payload}
        except Exception as error:
            return {"ok": False, "error": str(error)}

    def write_not_found(self) -> None:
        self.write_json(
            404,
            {
                "ok": False,
                "status": "not_found",
                "message": "未知 local image model endpoint。",
                "messageEn": "Unknown local image model endpoint.",
                "canShowToPlayer": False,
                "tags": ["local_image_model_contract_server", "not_found"],
            },
        )

    def write_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[local-image-model] {self.address_string()} - {format % args}")


def validate_generation_request(request_body: Any) -> dict[str, bool]:
    if not isinstance(request_body, dict):
        return build_audit(False, False, False, False, False, False)

    model_task = request_body.get("modelTask")
    response_contract = request_body.get("responseContract")
    metadata = request_body.get("metadata")

    understands_model_task = (
        isinstance(model_task, dict)
        and model_task.get("taskKind") == "generate_hidden_world_bitmap_candidate"
        and model_task.get("outputPurpose") == "hidden_ai_image_candidate"
        and model_task.get("mustReturnResponseContract") is True
        and model_task.get("mustNotDisplayDirectly") is True
        and model_task.get("mustNotRewriteWorldFacts") is True
        and model_task.get("mustNotUseProgrammaticRenderer") is True
        and model_task.get("mustNotCopyUnlicensedThirdPartyWorks") is True
        and model_task.get("canShowToPlayer") is False
    )

    understands_prompt_package = bool(request_body.get("promptPackage"))
    understands_control_sketch = bool(request_body.get("controlSketch"))

    understands_response_contract = (
        isinstance(response_contract, dict)
        and all(
            field in response_contract.get("requiredFields", [])
            for field in REQUIRED_RESPONSE_FIELDS
        )
        and response_contract.get("canShowToPlayer") is False
        and response_contract.get("mustPersistAsAiImageCandidate") is True
        and response_contract.get("mustPassVisualJudge") is True
    )

    understands_visual_fix_hints = isinstance(
        request_body.get("visualFixHints"), list
    )

    source_fact_ids = metadata.get("sourceFactIds") if isinstance(metadata, dict) else None

    understands_world_facts_locked = (
        isinstance(metadata, dict)
        and isinstance(source_fact_ids, list)
        and len(source_fact_ids) > 0
        and metadata.get("canShowToPlayer") is False
        and metadata.get("cannotApprove") is True
    )

    return build_audit(
        understands_model_task,
        understands_prompt_package,
        understands_control_sketch,
        understands_response_contract,
        understands_visual_fix_hints,
        understands_world_facts_locked,
    )


def build_audit(
    understands_model_task: bool,
    understands_prompt_package: bool,
    understands_control_sketch: bool,
    understands_response_contract: bool,
    understands_visual_fix_hints: bool,
    understands_world_facts_locked: bool,
) -> dict[str, bool]:
    request_contract_valid = (
        understands_model_task
        and understands_prompt_package
        and understands_control_sketch
        and understands_response_contract
        and understands_visual_fix_hints
        and understands_world_facts_locked
    )

    return {
        "requestContractValid": request_contract_valid,
        "understandsModelTask": understands_model_task,
        "understandsPromptPackage": understands_prompt_package,
        "understandsControlSketch": understands_control_sketch,
        "understandsResponseContract": understands_response_contract,
        "understandsVisualFixHints": understands_visual_fix_hints,
        "understandsWorldFactsLocked": understands_world_facts_locked,
    }


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), LocalImageModelHandler)

    print("[local-image-model] contract server started")
    print(f"[local-image-model] health:   http://localhost:{PORT}/health")
    print(f"[local-image-model] dry-run:  http://localhost:{PORT}/dry-run")
    print(f"[local-image-model] generate: http://localhost:{PORT}/generate")
    print("[local-image-model] real image model implementation: not connected")
    print("[local-image-model] fake image output: forbidden")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[local-image-model] stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()