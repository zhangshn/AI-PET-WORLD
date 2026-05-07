/**
 * 当前文件负责：展示 P-Phone 天气 App。
 */

import styles from "@/styles/world-styles/phone/weather/p-phone-weather-app.module.css"

type Props = {
  weatherLabel: string
  periodLabel: string
  worldTimeLabel: string
  onBack: () => void
}

function buildSystemDateLabel(): string {
  const now = new Date()

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
    .format(now)
    .replace(/\s/g, "")
}

export default function PPhoneWeatherApp({
  weatherLabel,
  periodLabel,
  worldTimeLabel,
  onBack,
}: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          type="button"
          aria-label="返回 P-Phone 首页"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <p>WEATHER</p>
          <h2>天气</h2>
        </div>
      </header>

      <section className={styles.currentCard}>
        <p>当前天气</p>
        <h3>{weatherLabel}</h3>

        <div className={styles.weatherIcon}>
          <span className={styles.sun} />
          <span className={styles.cloudA} />
          <span className={styles.cloudB} />
        </div>

        <span>{buildSystemDateLabel()}</span>
      </section>

      <section className={styles.infoPanel}>
        <article>
          <span>世界时段</span>
          <strong>{periodLabel}</strong>
        </article>

        <article>
          <span>世界时间</span>
          <strong>{worldTimeLabel}</strong>
        </article>

        <article>
          <span>天气来源</span>
          <strong>AI-PET-WORLD</strong>
        </article>
      </section>

      <section className={styles.forecastPanel}>
        <h4>天气说明</h4>
        <p>
          当前天气来自游戏世界运行状态。这里展示的是世界内天气，不是现实城市天气。
          后续可以扩展为按区域、生态、季节变化的动态天气预报。
        </p>
      </section>
    </div>
  )
}