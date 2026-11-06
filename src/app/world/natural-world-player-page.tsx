import { headers } from "next/headers"
import { authorizeWorldPlayerRead } from "@/server/world-player-access/session.mjs"
import { readNaturalPlayerView } from "@/world/runtime/natural-player-view"
import { NaturalWorldSessionForm } from "./natural-world-session-form"
import styles from "./natural-world-player.module.css"

export async function NaturalWorldPlayerPage({worldId,historyCursor}:{worldId:string; historyCursor?:string | string[]}) {
  const grant=await authorizeWorldPlayerRead(await headers(),worldId)
  if (!grant.ok) {
    return <main className={styles.page}><section className={styles.panel}>
      <div className={styles.eyebrow}>AI-PET-WORLD · 玩家入口</div>
      <h1>{grant.status===401?"登录自然首区":grant.status===403?"当前账号没有此世界的访问权":"玩家服务暂不可用"}</h1>
      {grant.status===401 && <><p>首次入场需使用服务器签发的一次性邀请。已有游戏账号可以直接登录。</p><NaturalWorldSessionForm /></>}
      {grant.status===403 && <NaturalWorldSessionForm signedIn />}
    </section></main>
  }
  const view=await readNaturalPlayerView(grant,true,historyCursor)
  const historyLink=(cursor?:string)=>"/world?"+new URLSearchParams(cursor ? {worldId,history:cursor} : {worldId}).toString()+"#world-history"
  return <main className={styles.page}><section className={styles.panel}>
    <div className={styles.eyebrow}>AI-PET-WORLD · 自然首区</div>
    {view ? <>
      <h1>首区 · 第 {view.tick} 个模拟日</h1>
      <p>游戏账号 {grant.username}　世界 {view.worldId}</p>
      <p>模拟日期 {view.date??"尚未建立"}　已保存 {view.eventCount} 条事件</p>
      {view.weather && <dl className={styles.conditions}>
        <div><dt>气温</dt><dd>{view.weather.temperature.toFixed(2)} °C</dd></div>
        <div><dt>相对湿度</dt><dd>{view.weather.humidity.toFixed(2)}%</dd></div>
        <div><dt>日降雨量</dt><dd>{Number(view.weather.rain.toPrecision(3))} mm</dd></div>
        <div><dt>风速</dt><dd>{view.weather.wind.toFixed(2)} m/s</dd></div>
      </dl>}
      <p>{view.lastEvent==="evolution"?"最近一次变化由服务器上的天气模型计算并保存。":view.lastEvent==="maintenance"?"最近一次记录为首区初始化。":"世界已建立。"}</p>
      {view.weatherProgress && <section aria-label="天气计算状态">
        <h2>天气计算状态</h2>
        {view.weatherProgress.status==="exhausted" ? <p>
          本轮天气预测的验证范围到第 {view.weatherProgress.validatedThroughDay} 个模拟日。服务器已完成第 {view.weatherProgress.day} 天的天气计算，并已停止本轮预测。
        </p> : view.weatherProgress.status==="ongoing" ? <p>
          天气已计算到第 {view.weatherProgress.day} 个模拟日。本轮验证范围内还剩 {view.weatherProgress.daysRemaining} 个模拟日。
        </p> : view.weatherProgress.status==="stopped" ? <p>
          天气服务已在第 {view.weatherProgress.day} 个模拟日停止推进。
        </p> : <p>当前存档的天气计算状态暂时无法核对。</p>}
        {view.date && view.weather && view.history?.status==="available" &&
          <p>仍可查看这个世界已保存的模拟日期、天气和历史记录。</p>}
      </section>}
      {view.history && <section id="world-history" aria-label="近期世界记录">
        <h2>{historyCursor === undefined ? "近期世界记录" : "更早世界记录"}</h2>
        {view.history.status!=="available" ? <>
          <p>{view.history.status === "stale_page" ? "世界存档已更新，或此链接属于其他存档。" :
            view.history.status === "invalid_page" ? "历史分页链接无效。" : "暂时无法核对这段历史，请稍后重新读取。"}</p>
          <a href={historyLink()}>返回最近记录</a>
        </> : <>
          <p>共保存 {view.eventCount} 条，{historyCursor === undefined ? "以下为最近" : "本页显示"} {view.history.entries.length} 条，按模拟时间倒序排列。</p>
          <ol>{view.history.entries.map(entry=><li key={entry.cursor}>
            <strong>{entry.date} · 第 {entry.tick} 天</strong>
            <p>{entry.kind==="maintenance"?"世界维护":"世界演化"} · 已记录 {entry.changeCount} 项变化</p>
            {entry.weather.length>0 && <p>{entry.weather.map(w=>w.label+" "+Number(w.value.toPrecision(3))+" "+w.unit).join("，")}</p>}
          </li>)}</ol>
          <nav aria-label="世界记录翻页">
            {view.history.newer !== undefined && <a href={historyLink(view.history.newer)}>查看较新记录</a>}
            {view.history.newer !== undefined && view.history.older && "　"}
            {view.history.older && <a href={historyLink(view.history.older)}>查看更早记录</a>}
          </nav>
        </>}
      </section>}
      <h2>当前地图</h2>
      <p>{{
        missing: "这一时刻还没有发布游戏画面。",
        unverified: "当前画面缺少完整的自然世界审核凭证。",
        conflict: "地图发布记录未通过一致性检查。当前世界的画面暂时无法显示。",
        unavailable: "服务器暂时无法读取地图发布记录。请稍后重试。",
      }[view.frameStatus]}</p>
      <a className={styles.refresh} href={"/world?worldId="+encodeURIComponent(worldId)}>读取最新世界状态</a>
    </> : <><h1>暂时无法读取这个世界</h1><p>请保留当前世界链接，稍后重新读取。</p></>}
    <NaturalWorldSessionForm signedIn />
  </section></main>
}
