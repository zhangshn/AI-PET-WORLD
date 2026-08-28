import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const drawabilityLatestPath = path.join(root, "data/world-visual-data-dictionary/drawability/latest.json");
const printPath = path.join(root, "docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

function localTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(date).replaceAll("/", "-");
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}

function table(headers, rows) {
  const headerLine = `| ${headers.map(escapeCell).join(" | ")} |`;
  const ruleLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`);
  return [headerLine, ruleLine, ...rowLines].join("\n");
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

const latest = await readJson(latestPath);
const dictionary = await readJson(resolveProjectPath(latest.dictionaryPath));
const drawabilityPointer = await readJsonIfExists(drawabilityLatestPath);
const drawability = drawabilityPointer
  ? await readJson(resolveProjectPath(drawabilityPointer.summaryPath))
  : null;

const categories = groupBy(dictionary.entries, "category");
const sortedCategories = Array.from(categories.keys()).sort((a, b) => a.localeCompare(b));

const lines = [];

lines.push("# AI-PET-WORLD 世界视觉数据字典完整打印版");
lines.push("");
lines.push(`更新时间：${localTimestamp()} +08:00`);
lines.push("");
lines.push("状态：active-reference");
lines.push(`DictionaryVersionId: ${dictionary.dictionaryVersionId}`);
lines.push(`DictionaryLifecycleStatus: ${dictionary.status}`);
lines.push(`GeneratedAt: ${dictionary.generatedAt}`);
lines.push("");
lines.push("Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。");
lines.push("");
lines.push("本打印版只说明视觉词汇和历史溯源，不定义授权、能力发布或运行状态机。当前Owner职责只采用docs/DOCUMENT_AUTHORITY_INDEX.md中的GOV-OWNER-001。");
lines.push("");
lines.push("源条目中的owner review、owner accepted、owner rejected及对应旧失败码或训练标签是历史兼容词汇，不具有当前执行效力；新任务不得生成或消费这些词汇作为当前状态。");
lines.push("");

lines.push("## 1. 文档目录");
lines.push("");
lines.push(table(
  ["序号", "目录", "条目数"],
  sortedCategories.map((category, index) => [
    index + 1,
    `${category}/`,
    categories.get(category).length,
  ]),
));
lines.push("");

lines.push("## 2. 总览");
lines.push("");
lines.push(table(
  ["项目", "数量"],
  [
    ["文档数", dictionary.summary.documentCount],
    ["字典条目", dictionary.summary.entryCount],
    ["分类数", Object.keys(dictionary.summary.categories).length],
    ["注册失败码", dictionary.summary.registeredFailureCodeCount],
    ["Hard Failure", dictionary.summary.hardFailureCodeCount],
    ["未注册 Hard Failure", dictionary.summary.unregisteredHardFailureCodeCount],
    ["训练标签", dictionary.summary.trainingLabelCount],
    ["缺失分类", dictionary.summary.missingCategories.length],
  ],
));
lines.push("");

lines.push("## 3. 当前出图状态");
lines.push("");
lines.push(table(
  ["状态项", "内容"],
  [
    ["字典状态", drawability?.status ?? "missing_drawability_summary"],
    ["含义", drawability?.drawabilityMeaning ?? "未生成完整地图出图摘要"],
    ["字典版本", dictionary.dictionaryVersionId],
    ["注意", "dictionary_draw_ready只代表可以组织完整候选图生成任务，不代表训练数据充分、能力已经发布或机器审核已经通过。"],
  ],
));
lines.push("");

if (drawability) {
  lines.push("## 4. 完整地图出图绑定");
  lines.push("");
  lines.push(table(
    ["模块", "绑定条目"],
    [
      ["画布合同", drawability.taskBindings.canvasContract],
      ["地图模板", drawability.taskBindings.mapTemplate],
      ["渲染层级", drawability.taskBindings.layerStack],
      ["材质 Token", drawability.taskBindings.materialTokens],
      ["物体摆放", drawability.taskBindings.objectPlacement],
      ["过渡方案", drawability.taskBindings.transitionPlan.join(", ")],
      ["生成合同", drawability.taskBindings.generationContract],
      ["审核门槛", drawability.taskBindings.reviewGate],
    ],
  ));
  lines.push("");
}

lines.push("## 5. 分类详细内容");
lines.push("");
for (const category of sortedCategories) {
  const entries = categories.get(category).sort((a, b) => a.id.localeCompare(b.id));
  lines.push(`### ${category}/`);
  lines.push("");
  lines.push(table(
    ["ID", "类型", "版本", "状态", "来源", "摘要"],
    entries.map((entry) => [
      entry.id,
      entry.type,
      entry.version,
      entry.status,
      entry.sourcePath,
      entry.summary,
    ]),
  ));
  lines.push("");

  const failureRows = entries.flatMap((entry) =>
    entry.hardFailures.map((failure) => [
      entry.id,
      failure.code,
      failure.meaning,
    ]),
  );
  if (failureRows.length > 0) {
    lines.push(table(["条目", "失败码", "含义"], failureRows));
    lines.push("");
  }
}

lines.push("## 6. 注册失败码总表");
lines.push("");
lines.push(table(
  ["序号", "失败码", "含义", "典型修复目标"],
  dictionary.registeredFailureCodes.map((failure, index) => [
    index + 1,
    failure.code,
    failure.meaning,
    failure.typicalFixTarget,
  ]),
));
lines.push("");

lines.push("## 7. 训练标签总表");
lines.push("");
lines.push(table(
  ["标签", "含义", "是否可训练"],
  dictionary.trainingLabels.map((label) => [
    label.label,
    label.meaning,
    label.mayTrain,
  ]),
));
lines.push("");

lines.push("## 8. 适用边界");
lines.push("");
lines.push(table(
  ["缺口", "说明"],
  [
    ["训练数据", "字典已经具备完整候选图任务字段，但正负样本数量仍需由训练数据审计决定。"],
    ["能力发布", "RuntimeFrame必须通过当前机器审核、能力发布和Runtime门；已发布能力内不等待逐次Owner验收。"],
    ["自动生成", "下一步程序必须读取本字典版本生成候选图，并自动保存任务包、图片、审核记录和失败码。"],
  ],
));
lines.push("");

await mkdir(path.dirname(printPath), { recursive: true });
await writeFile(printPath, `${lines.join("\n").trimEnd()}\n`, "utf8");

console.log(`World visual data dictionary print written: ${projectPath(printPath)}`);
console.log(`dictionaryVersionId=${dictionary.dictionaryVersionId}`);
console.log(`entries=${dictionary.entries.length}`);
console.log(`drawabilityStatus=${drawability?.status ?? "missing"}`);
