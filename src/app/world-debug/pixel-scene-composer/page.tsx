// 该页面用于通过合并后的像素视觉 Debug 实验室打开组合预览视图。

import PixelVisualLabClient from "../pixel-visual-lab/pixel-visual-lab-client";

export default function PixelSceneComposerPage() {
  return <PixelVisualLabClient initialMode="composer" />;
}
