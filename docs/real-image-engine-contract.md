# AI-PET-WORLD 真实出图模型接口契约

当前文件作用：定义 AI-PET-WORLD 端游视觉系统中第三层真实出图模型的输入、输出、安全边界与本地运行方式。

---

## 1. 三层结构

AI-PET-WORLD 的真实出图链路分为三层：

主项目 Next.js：localhost:3000  
本地出图文件服务：localhost:7860  
真实出图模型服务：localhost:8000

职责划分：

| 层级 | 服务 | 职责 |
|---|---|---|
| 第一层 | 主项目 Next.js | 世界运行、PromptPackage、Candidate、VisualJudge、ApprovedFrame、/world 展示 |
| 第二层 | 本地出图文件服务 | 调用真实模型、保存图片文件、返回本地 HTTP URL |
| 第三层 | 真实出图模型服务 | 真正把 prompt 生成 PNG/WebP/JPG 图片 |

---

## 2. 端口约定

推荐端口：

| 服务 | 地址 |
|---|---|
| 主项目 | http://localhost:3000 |
| 本地出图文件服务 | http://localhost:7860 |
| 真实出图模型服务 | http://localhost:8000 |

真实出图模型服务推荐提供：

| 方法 | 地址 | 作用 |
|---|---|---|
| GET | /health | 健康检查 |
| POST | /generate | 正式生成图片 |

---

## 3. 真实出图模型请求体

POST /generate 推荐接收：

| 字段 | 类型 | 必须 | 说明 |
|---|---|---:|---|
| prompt | string | 是 | 正向提示词 |
| negativePrompt | string | 是 | 负向提示词 |
| width | number | 是 | 图片宽度 |
| height | number | 是 | 图片高度 |
| imageFormat | png / webp / jpg | 是 | 输出格式 |
| promptPackage | object | 建议 | 主项目生成的视觉提示包 |
| controlSketch | object | 建议 | 构图控制信息，不能直接展示 |
| visualFixHints | array | 建议 | VisualJudge 失败后的修复提示 |
| metadata | object | 建议 | worldId、tick、sourceFactIds 等来源链 |

最小请求示例：

{
  "prompt": "top-down pixel world scene",
  "negativePrompt": "text, watermark, logo, blurry",
  "width": 1536,
  "height": 1024,
  "imageFormat": "png"
}

---

## 4. 允许的返回方式

真实出图模型可以使用三种返回方式。

### 4.1 返回图片 URL

{
  "imageUrl": "http://localhost:8000/generated/world-001.png",
  "imageFormat": "png",
  "width": 1536,
  "height": 1024,
  "license": "self_owned",
  "originalityConfirmed": true
}

### 4.2 返回 base64

{
  "imageBase64": "真实 PNG/WebP/JPG 图片 base64",
  "imageFormat": "png",
  "width": 1536,
  "height": 1024,
  "license": "self_owned",
  "originalityConfirmed": true
}

支持字段别名：

- imageBase64
- base64
- b64_json

### 4.3 直接返回图片二进制

响应头可以是：

- Content-Type: image/png
- Content-Type: image/webp
- Content-Type: image/jpeg

响应体必须是真实 PNG/WebP/JPG 图片字节。

---

## 5. 图片 URL 规则

imageUrl 只允许：

- http://...
- https://...
- data:image/...

禁止：

- 本地文件路径
- file://
- SVG
- HTML
- JSON
- 调试图
- 占位图
- 假图

---

## 6. 授权字段要求

真实出图模型最终必须提供：

{
  "license": "self_owned",
  "originalityConfirmed": true
}

允许的 license：

- self_owned
- cc0
- commercial_license

不允许：

- unknown
- internet_copy
- unlicensed
- third_party_unverified

如果真实模型不返回 license，可以由本地出图文件服务显式配置：

AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE=self_owned  
AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED=true

必须显式配置，不允许默认假定原创安全。

---

## 7. 本地图片保存规则

端游方案必须保存图片文件。

推荐保存目录：

F:\ai-pet-world-generated

候选图目录：

F:\ai-pet-world-generated\candidates\

未来正式图目录：

F:\ai-pet-world-generated\approved\

本地出图文件服务返回给主项目的应该是 HTTP URL，例如：

{
  "imageUrl": "http://localhost:7860/generated/candidates/2026-06-08/candidate-xxx.png",
  "imageFormat": "png",
  "width": 1536,
  "height": 1024,
  "license": "self_owned",
  "originalityConfirmed": true
}

主项目只读取 URL，不直接读取硬盘路径。

---

## 8. 正式游戏链路

完整链路：

1. WorldRuntimeSaveRecord
2. PromptPackage
3. AiImageGenerationRequest
4. localhost:3000/api/local-image-model/generate
5. localhost:7860/generate
6. localhost:8000/generate
7. 保存图片到 F:\ai-pet-world-generated
8. 返回 http://localhost:7860/generated/...
9. AiImageCandidate hidden
10. VisualJudge
11. ApprovedFrame
12. /world 展示

---

## 9. 禁止事项

真实出图模型不得：

- 返回 SVG
- 返回 Canvas
- 返回 HTML
- 返回 JSON 调试图
- 返回占位图
- 返回纯色假图
- 返回本地文件路径
- 返回 file:// 路径
- 复制未授权第三方作品
- 改写 WorldRuntimeSaveRecord
- 绕过 VisualJudge
- 直接让 /world 展示 Candidate

---

## 10. 当前实际状态

| 项目 | 状态 |
|---|---:|
| 主项目 localhost:3000 | 已完成 |
| 本地出图文件服务 localhost:7860 | 已完成 |
| 图片保存目录 F:\ai-pet-world-generated | 已完成 |
| 真实出图模型 localhost:8000 | 未完成 |
| SD WebUI 桥接器 | 代码存在，但未配置 endpoint |
| 真实生成闭环 | 未开始 |

当前真正缺口：

实现或接入一个真正能生成 PNG/WebP/JPG 的真实出图模型服务。

---

## 11. 下一步

下一步进入：

AI-PAINTER-12-F：真实出图模型最小实现方案

目标：

实现 localhost:8000/generate。  
它必须真正生成 PNG/WebP/JPG，不能返回假图、占位图或程序绘图结果。
