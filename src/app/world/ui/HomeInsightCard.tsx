/**
 * 当前文件负责：展示正式 world 页中的家园状态摘要。
 */

import type {
  HomeConstructionStage,
  HomeEvolutionFocus,
  HomeState,
  HomeStatus,
} from "@/types/home"

import styles from "@/styles/world-styles/home-insight-card.module.css"

type Props = {
  home: HomeState | null
}

function getStatusLabel(status?: HomeStatus): string {
  if (!status) return "未知"

  if (status === "idle") return "待建设"
  if (status === "building") return "建设中"
  if (status === "completed") return "已完成"

  return status
}

function getStageLabel(stage?: HomeConstructionStage): string {
  if (!stage) return "未知阶段"

  if (stage === "temporary_shelter") return "临时庇护"
  if (stage === "foundation") return "地基阶段"
  if (stage === "frame") return "框架阶段"
  if (stage === "roof") return "屋顶阶段"
  if (stage === "interior") return "内部整理"
  if (stage === "garden") return "庭院建设"
  if (stage === "completed") return "完整家园"

  return stage
}

function getFocusLabel(focus?: HomeEvolutionFocus): string {
  if (!focus) return "均衡"

  if (focus === "balanced") return "均衡"
  if (focus === "expansion") return "扩展"
  if (focus === "stability") return "稳定"
  if (focus === "comfort") return "舒适"
  if (focus === "order") return "秩序"
  if (focus === "adaptive") return "适应"

  return focus
}

function getProgressLabel(progress: number): string {
  return `${Math.round(progress)}%`
}

function buildHomeSummary(home: HomeState): string {
  if (home.status === "completed") {
    return "家园已经形成稳定结构。它会继续作为生命体活动、恢复和建立关系的基础空间。"
  }

  if (home.status === "building") {
    return "家园正在建设中。管家会在孵化器和宠物状态允许时推进空间完善。"
  }

  return "家园暂时没有进入明显建设阶段。世界会优先处理孵化器和生命状态。"
}

export default function HomeInsightCard({ home }: Props) {
  if (!home) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>HOME</div>
            <h2 className={styles.title}>家园未生成</h2>
          </div>

          <div className={styles.badge}>等待中</div>
        </div>

        <p className={styles.description}>
          世界还没有读取到家园状态。
        </p>
      </section>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>HOME</div>
          <h2 className={styles.title}>家园状态</h2>
        </div>

        <div className={styles.badge}>{getStatusLabel(home.status)}</div>
      </div>

      <div className={styles.grid}>
        <div>
          <span>等级</span>
          <strong>Lv.{home.level}</strong>
        </div>

        <div>
          <span>建设阶段</span>
          <strong>{getStageLabel(home.constructionStage)}</strong>
        </div>

        <div>
          <span>成长方向</span>
          <strong>{getFocusLabel(home.evolutionFocus)}</strong>
        </div>

        <div>
          <span>总进度</span>
          <strong>{getProgressLabel(home.progress)}</strong>
        </div>

        <div>
          <span>庭院进度</span>
          <strong>{getProgressLabel(home.gardenProgress)}</strong>
        </div>

        <div>
          <span>舒适度</span>
          <strong>{Math.round(home.comfort)}</strong>
        </div>
      </div>

      <div className={styles.meterGroup}>
        <div>
          <span>稳定</span>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{ width: `${Math.min(100, Math.max(0, home.stability))}%` }}
            />
          </div>
        </div>

        <div>
          <span>扩展</span>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{ width: `${Math.min(100, Math.max(0, home.expansion))}%` }}
            />
          </div>
        </div>
      </div>

      <p className={styles.description}>
        {buildHomeSummary(home)}
      </p>
    </section>
  )
}