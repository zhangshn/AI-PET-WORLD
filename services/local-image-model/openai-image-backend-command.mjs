// 当前文件作用：保留为禁用占位；禁止外接第三方图像 API，正式链路只允许本地或自研真实图像模型。

const COMMAND_NAME = "ai-pet-world-disabled-external-image-backend-command"
const COMMAND_VERSION = "disabled-external-image-backend-command-1"

process.stderr.write(
  JSON.stringify(
    {
      ok: false,
      status: "external_image_backend_adapter_disabled",
      message:
        "该第三方图像 backend adapter 已禁用。AI-PET-WORLD 正式链路只允许本地或自研真实图像模型命令。",
      provider: COMMAND_NAME,
      version: COMMAND_VERSION,
      canShowToPlayer: false,
      tags: [
        "external_image_backend_disabled",
        "local_or_self_owned_model_required",
        "not_player_visible",
      ],
    },
    null,
    2
  )
)

process.exitCode = 1
