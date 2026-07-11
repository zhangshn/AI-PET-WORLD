import Link from "next/link"
import { readFile } from "node:fs/promises"
import path from "node:path"
import styles from "../page.module.css"

type DictionaryLatest = {
  dictionaryVersionId: string
  status: string
  generatedAt: string
  dictionaryPath: string
  summary: DictionarySummary
}

type DictionaryExport = {
  requiredCategories: string[]
  entries: DictionaryEntry[]
  summary: DictionarySummary
}

type DictionarySummary = {
  documentCount: number
  entryCount: number
  categories: Record<string, number>
  registeredFailureCodeCount: number
  hardFailureCodeCount: number
  unregisteredHardFailureCodeCount: number
  trainingLabelCount: number
  missingCategories: string[]
}

type DictionaryEntry = {
  id: string
  category: string
  name: string
  title: string
  type: string
  version?: string
  status?: string
  sourcePath: string
  hardFailures?: string[]
}

const activeDocuments = [
  "versions/current-single-map-visual-scope",
  "generation-task/task-package-schema",
  "director/director-output-schema",
  "ecology/single-map-ecology-fields",
  "material-recipe/single-map-material-field-schema",
  "composition-recipe/single-map-composition-fields",
  "review/single-map-visual-acceptance",
  "review/failure-codes",
]

const requiredTaskFields = [
  "singleMapScope",
  "singleMapEcologyFields",
  "singleMapMaterialFields",
  "singleMapCompositionFields",
  "singleMapAcceptance",
  "drawingProcess",
  "professionalArtDirection",
  "materialRecipe",
  "compositionRecipe",
  "runtimeRenderLayerRecipe",
  "qualityRubric",
]

const requiredDirectorFields = [
  "singleMapScopePlan",
  "singleMapEcologyPlan",
  "singleMapMaterialPlan",
  "singleMapCompositionPlan",
  "singleMapAcceptancePlan",
  "drawingProcessPlan",
  "artDirectionPlan",
  "materialPlan",
  "compositionPlan",
  "renderLayerPlan",
  "qualityGatePlan",
]

export const dynamic = "force-dynamic"

export default async function WorldVisualDictionaryPage() {
  const data = await readDictionaryData()
  const summary = data.latest.summary
  const entriesByCategory = groupEntriesByCategory(data.dictionary.entries)
  const activeEntryIds = new Set(activeDocuments)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.textLink} href="/ai-painter-progress">
          返回训练主控台
        </Link>
        <p className={styles.kicker}>WORLD VISUAL DATA DICTIONARY</p>
        <h1>单一地图视觉数据字典</h1>
        <p>
          这里读取的是程序导出的本地字典，不是聊天临时判断。当前范围只做第一版完整世界地图画面：
          地形、水岸、道路、植物、岩石、材质层、构图、渲染层和验收标准。玩家、点击交互、建造和多 Tick 状态先保留架构，不进入本轮训练。
        </p>
        <dl className={styles.metrics}>
          <Metric label="字典版本" value={data.latest.dictionaryVersionId} />
          <Metric label="文档数量" value={summary.documentCount} />
          <Metric label="条目数量" value={summary.entryCount} />
          <Metric label="生成时间" value={formatDate(data.latest.generatedAt)} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>PROGRESS TABLE</p>
        <h2>进度表</h2>
        <dl className={styles.metrics}>
          <Metric label="必需分类缺失" value={summary.missingCategories.length} />
          <Metric label="登记失败码" value={summary.registeredFailureCodeCount} />
          <Metric label="硬失败码" value={summary.hardFailureCodeCount} />
          <Metric label="未登记硬失败码" value={summary.unregisteredHardFailureCodeCount} />
        </dl>
        <p className={styles.note}>
          当前结论：数据字典结构已闭合，失败码清账已闭合；下一步是让完整地图训练任务包、导演输出、机器审核和存储记录都强制读取这些字段。
        </p>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>PLAN TABLE</p>
        <h2>计划表</h2>
        <dl className={styles.factList}>
          <PlanItem
            step="1"
            title="数据字典"
            status="已完成"
            detail="导出 71 份文档、68 个条目、25 个分类，未登记硬失败码为 0。"
          />
          <PlanItem
            step="2"
            title="页面接入"
            status="进行中"
            detail="进度页新增数据字典入口，训练标准、字段和失败码可直接查看。"
          />
          <PlanItem
            step="3"
            title="程序接入"
            status="下一步"
            detail="完整地图训练、推理、审核、存储必须读取任务包字段和验收字段。"
          />
          <PlanItem
            step="4"
            title="完整地图训练"
            status="待执行"
            detail="只训练完整 RuntimeFrame，不再把局部素材候选当作正式地图通过。"
          />
        </dl>
      </section>

      <section className={styles.entryGrid}>
        <article className={styles.entryCard}>
          <span>ACTIVE SCOPE</span>
          <h2>当前只做单一完整地图</h2>
          <p>必须是完整游戏地图画面，不是局部草地、水面、树、石头、道路贴片。</p>
        </article>
        <article className={styles.entryCard}>
          <span>RESERVED</span>
          <h2>玩家与交互暂不做</h2>
          <p>角色、移动、点击、采集、建造、多 Tick 状态保留架构，当前不进入训练验收。</p>
        </article>
        <article className={styles.entryCard}>
          <span>STORAGE RULE</span>
          <h2>训练内容必须从存储读取</h2>
          <p>候选图、失败图、成功图、审核结果、失败码和标签必须落盘，页面只展示已存储记录。</p>
        </article>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>ACTIVE DOCUMENTS</p>
        <h2>当前地图训练必须读取的文档</h2>
        <div className={styles.resultGrid}>
          {data.dictionary.entries
            .filter((entry) => activeEntryIds.has(entry.id))
            .map((entry) => (
              <article className={styles.resultCard} key={entry.id}>
                <p className={styles.kicker}>{entry.category}</p>
                <h2>{entry.title}</h2>
                <p>{entry.sourcePath}</p>
                <p className={styles.note}>
                  {entry.type} / {entry.version ?? "no-version"} / {entry.status ?? "no-status"}
                </p>
              </article>
            ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>TASK PACKAGE</p>
        <h2>完整地图训练任务包必备字段</h2>
        <dl className={styles.factList}>
          {requiredTaskFields.map((field) => (
            <FieldItem key={field} label={field} />
          ))}
        </dl>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>DIRECTOR OUTPUT</p>
        <h2>导演输出必备字段</h2>
        <dl className={styles.factList}>
          {requiredDirectorFields.map((field) => (
            <FieldItem key={field} label={field} />
          ))}
        </dl>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>TABLE OF CONTENTS</p>
        <h2>数据字典目录</h2>
        <dl className={styles.factList}>
          {data.dictionary.requiredCategories.map((category) => (
            <div key={category}>
              <dt>{category}</dt>
              <dd>{summary.categories[category] ?? 0} entries</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>DETAIL</p>
        <h2>条目明细</h2>
        <div className={styles.resultGrid}>
          {Object.entries(entriesByCategory).map(([category, entries]) => (
            <article className={styles.resultCard} key={category}>
              <p className={styles.kicker}>{category}</p>
              <h2>{entries.length} entries</h2>
              <dl className={styles.factList}>
                {entries.map((entry) => (
                  <div key={entry.id}>
                    <dt>{entry.title}</dt>
                    <dd>{entry.sourcePath}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>PRINT VERSION</p>
        <h2>正式打印版文档</h2>
        <p>
          已生成 <code>docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md</code>，
          当前有效内容约 {data.printLineCount} 行。后续所有文档更新都必须带详细时间戳。
        </p>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function PlanItem({
  step,
  title,
  status,
  detail,
}: {
  step: string
  title: string
  status: string
  detail: string
}) {
  return (
    <div>
      <dt>
        {step}. {title} / {status}
      </dt>
      <dd>{detail}</dd>
    </div>
  )
}

function FieldItem({ label }: { label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>required</dd>
    </div>
  )
}

async function readDictionaryData() {
  const root = process.cwd()
  const latest = JSON.parse(
    await readFile(path.join(root, "data", "world-visual-data-dictionary", "latest.json"), "utf8"),
  ) as DictionaryLatest
  const dictionary = JSON.parse(await readFile(path.join(root, latest.dictionaryPath), "utf8")) as DictionaryExport
  const printText = await readFile(
    path.join(root, "docs", "world-visual-data-dictionary", "FULL_DICTIONARY_PRINT.md"),
    "utf8",
  )

  return {
    latest,
    dictionary,
    printLineCount: printText.split(/\r?\n/).filter((line) => line.trim()).length,
  }
}

function groupEntriesByCategory(entries: DictionaryEntry[]) {
  return entries.reduce<Record<string, DictionaryEntry[]>>((groups, entry) => {
    groups[entry.category] ??= []
    groups[entry.category].push(entry)
    return groups
  }, {})
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}
