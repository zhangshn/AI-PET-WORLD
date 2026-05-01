/**
 * 当前文件负责：计算紫微宫格展示样式。
 */

export function getZiweiPalaceCellStyle(params: {
  isNatalLife: boolean
  isDynamicLife: boolean
  isSupport: boolean
  isOpposite: boolean
  isActive: boolean
  hasActiveMarker: boolean
}): {
  border: string
  background: string
} {
  let border = "1px solid #ccc"
  let background = "#fff"

  if (params.isNatalLife) {
    border = "2px solid #ff4d4f"
    background = "#fff1f0"
  }

  if (params.isOpposite) {
    border = "2px solid #faad14"
    background = "#fffbe6"
  }

  if (params.isSupport) {
    border = "2px dashed #1677ff"
    background = "#f0f8ff"
  }

  if (params.isDynamicLife || params.isActive || params.hasActiveMarker) {
    border = "3px solid #722ed1"
    background = "#f9f0ff"
  }

  return {
    border,
    background
  }
}