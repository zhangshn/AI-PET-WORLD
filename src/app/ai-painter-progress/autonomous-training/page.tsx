import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import styles from "../detail.module.css"

export const dynamic = "force-dynamic"

type Summary = Record<string, unknown> | null

async function readJson(filePath: string): Promise<Summary> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return null
  }
}

function numberValue(summary: Summary, key: string) {
  const value = summary?.[key]
  return typeof value === "number" ? value : null
}

function percent(value: number | null) {
  return value === null ? "未生成" : `${(value * 100).toFixed(1)}%`
}

function fixed(value: number | null) {
  return value === null ? "未生成" : value.toFixed(4)
}

export default async function AutonomousTrainingPage() {
  const root = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
  const structure = await readJson(path.join(root, "structure-guided-training", "training-summary.json"))
  const rgb = await readJson(path.join(root, "rgb-refiner-training", "training-summary.json"))
  const local = await readJson(path.join(root, "local-asset-training", "training-summary.json"))
  const discrete = await readJson(path.join(root, "discrete-asset-training", "training-summary.json"))

  const structureIou = numberValue(structure, "bestStructureIoU")
  const rgbLoss = numberValue(rgb, "bestValidationLoss")
  const building = (local?.building ?? null) as Summary
  const discreteBuilding = (discrete?.building ?? null) as Summary
  const discreteTree = (discrete?.tree ?? null) as Summary
  const discreteRoad = (discrete?.road ?? null) as Summary
  const discreteShoreline = (discrete?.shoreline ?? null) as Summary

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">返回训练主页</Link>
        <p className={styles.kicker}>STAGE 09 / LOCAL MODEL TRAINING LOOP</p>
        <h1>本地自主训练闭环</h1>
        <p>
          这一页展示的是本地 AI Painter 小模型训练结果，不是程序画图结果。当前链路已经能训练和推理，
          但画面质量未达到 MVP 标准，所以继续阻断正式世界展示。
        </p>
        <dl className={styles.metrics}>
          <div><dt>训练场景</dt><dd>20</dd></div>
          <div><dt>结构 IoU</dt><dd>{percent(structureIou)}</dd></div>
          <div><dt>RGB 验证损失</dt><dd>{fixed(rgbLoss)}</dd></div>
          <div><dt>世界展示</dt><dd>继续阻断</dd></div>
        </dl>
      </header>

      <section className={styles.resultGrid}>
        <article className={styles.resultCard}>
          <span className={styles.pass}>结构学习有效</span>
          <h2>14 通道结构预测</h2>
          <p>结构头已经能保留道路、建筑区、水岸和主要空间分区，这是后续生成可控世界的基础。</p>
          <img src="/api/ai-painter/structure-guided-inference/structure" alt="结构预测预览" />
        </article>
        <article className={styles.resultCard}>
          <span className={styles.fail}>视觉审核未通过</span>
          <h2>结构模型 RGB 输出</h2>
          <p>语义位置基本能看出，但仍然低清、模糊、缺少像素材质，不能作为玩家画面。</p>
          <img src="/api/ai-painter/structure-guided-inference/generated" alt="结构模型 RGB 输出" />
        </article>
        <article className={styles.resultCard}>
          <span className={styles.fail}>细节审核未通过</span>
          <h2>RGB 细化输出</h2>
          <p>细化器还没有真正生成树冠、石头、木材和水岸纹理，质量仍未达标。</p>
          <img src="/api/ai-painter/rgb-refiner-inference" alt="RGB 细化输出" />
        </article>
        <article className={styles.resultCard}>
          <span className={styles.fail}>合成审核未通过</span>
          <h2>局部资产模型输出</h2>
          <p>建筑、树木、道路、水岸分开训练后再合成，链路成立，但局部对象仍有平均化和模糊问题。</p>
          <img src="/api/ai-painter/local-assets/composite" alt="局部资产模型输出" />
        </article>
        <article className={styles.resultCard}>
          <span className={styles.fail}>语义审核未通过</span>
          <h2>离散像素模型输出</h2>
          <p>离散颜色让边缘更硬，但像素类别准确率仍低，容易出现错误色块和对象错位。</p>
          <img src="/api/ai-painter/discrete-assets/composite" alt="离散像素模型输出" />
        </article>
        <article className={styles.resultCard}>
          <h2>本轮结论</h2>
          <p className={styles.note}>本地模型可以训练，但当前输出不合格；下一步不是程序画图，而是补训练数据、改模型表达能力和提高审核标准。</p>
          <dl className={styles.metrics}>
            <div><dt>局部建筑 Loss</dt><dd>{fixed(numberValue(building, "bestValidationLoss"))}</dd></div>
            <div><dt>建筑 Acc</dt><dd>{percent(numberValue(discreteBuilding, "bestValPixelAcc"))}</dd></div>
            <div><dt>树木 Acc</dt><dd>{percent(numberValue(discreteTree, "bestValPixelAcc"))}</dd></div>
            <div><dt>道路/水岸 Acc</dt><dd>{percent(Math.max(numberValue(discreteRoad, "bestValPixelAcc") ?? 0, numberValue(discreteShoreline, "bestValPixelAcc") ?? 0))}</dd></div>
          </dl>
        </article>
      </section>

      <section className={styles.panel}>
        <h2>下一阶段</h2>
        <p>
          继续走本地 AI Painter 训练路线：补齐高质量项目自有样本，强化局部对象、材质、边缘和完整场景生成能力，
          再通过 VJ-1/VJ-2 审核。程序绘制、结构贴合和调试预览已经从正式路线移除。
        </p>
      </section>
    </main>
  )
}
