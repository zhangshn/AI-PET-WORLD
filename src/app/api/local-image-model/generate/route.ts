function validateEngineResponse(
  payload: LocalImageEngineResponse
):
  | { ok: true; payload: Required<LocalImageEngineResponse> }
  | { ok: false; error: { zh: string; en: string } } {
  const imageUrl = payload.imageUrl
  const imageFormat = payload.imageFormat
  const width = payload.width
  const height = payload.height
  const license = payload.license
  const originalityConfirmed = payload.originalityConfirmed

  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageUrl 缺失或协议不被允许。只允许 http、https 或 data:image URL。",
        en: "The real image engine returned a missing or disallowed imageUrl. Only http, https, or data:image URLs are allowed.",
      },
    }
  }

  if (imageFormat !== "png" && imageFormat !== "webp" && imageFormat !== "jpg") {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageFormat 不被允许。",
        en: "The real image engine returned a disallowed imageFormat.",
      },
    }
  }

  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 width 不合法。",
        en: "The real image engine returned an invalid width.",
      },
    }
  }

  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 height 不合法。",
        en: "The real image engine returned an invalid height.",
      },
    }
  }

  if (
    license !== "self_owned" &&
    license !== "cc0" &&
    license !== "commercial_license"
  ) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 license 不被允许。",
        en: "The real image engine returned a disallowed license.",
      },
    }
  }

  if (originalityConfirmed !== true) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎没有确认 originalityConfirmed=true。",
        en: "The real image engine did not confirm originalityConfirmed=true.",
      },
    }
  }

  return {
    ok: true,
    payload: {
      imageUrl,
      imageFormat,
      width,
      height,
      license,
      originalityConfirmed,
    },
  }
}