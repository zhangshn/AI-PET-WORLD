/**
 * 当前文件负责：展示 P-Phone 游戏设置入口。
 */

import styles from "@/styles/world-styles/phone/settings/p-phone-settings-app.module.css"

type Props = {
  onBack: () => void
}

export default function PPhoneSettingsApp({ onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ‹
        </button>

        <div>
          <p>Settings</p>
          <h2>设置</h2>
        </div>
      </header>

      <div className={styles.settingList}>
        <article>
          <span>声音</span>
          <strong>后续接入 BGM / SFX</strong>
        </article>

        <article>
          <span>显示</span>
          <strong>后续接入画面缩放与窗口设置</strong>
        </article>

        <article>
          <span>存档</span>
          <strong>后续接入本地存档与离线补算</strong>
        </article>

        <article>
          <span>开发审计</span>
          <strong>按 F3 打开</strong>
        </article>
      </div>
    </div>
  )
}