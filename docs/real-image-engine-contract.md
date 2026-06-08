# AI-PET-WORLD 真实出图模型接口契约

当前文件作用：定义 AI-PET-WORLD 端游视觉系统中第三层真实出图模型的输入、输出、安全边界与本地运行方式。

---

## 1. 当前三层结构

AI-PET-WORLD 的真实出图链路分为三层：

```text
主项目 Next.js
http://localhost:3000

↓ 调用

本地出图文件服务
http://localhost:7860

↓ 调用

真实出图模型服务
http://localhost:8000