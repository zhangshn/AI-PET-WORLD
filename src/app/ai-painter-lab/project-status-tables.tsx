import styles from "./page.module.css"

type Props = {
  engineeringAssets: number
  candidateAssets: number
  trainableAssets: number
  vjB2Acceptable: number
  vjB2Unacceptable: number
}

export function ProjectStatusTables({ engineeringAssets, candidateAssets, trainableAssets, vjB2Acceptable, vjB2Unacceptable }: Props) {
  const hasAssets = trainableAssets > 0
  const progress = [
    ["1", "原始素材保全", "完成", "20 张原始 PNG 独立保存，不作为可信标注"],
    ["2", "分层单体协议", "完成", "定义 RGBA 图层、通道、层级、尺寸和锚点"],
    ["3", "同源资产构建器", "完成", "同一图层生成 sprite、Alpha Mask、哈希元数据"],
    ["4", "工程单体链路验证", engineeringAssets > 0 ? "完成" : "进行中", `当前 ${engineeringAssets} 个工程资产，不计入训练`],
    ["5", "首批正式单体", hasAssets ? "完成" : "进行中", `候选 ${candidateAssets} 个，正式 ${trainableAssets} 个；VJ-B2 完成前不能准入`],
    ["6", "单体资产训练集", "未开始", "首批正式单体通过完整性校验后批量扩充"],
    ["6A", "VJ-B2 质量样本集", "进行中", `合格 ${vjB2Acceptable}/40，不合格 ${vjB2Unacceptable}/40；未达门槛禁止训练`],
    ["7", "单体生成模型", "未开始", "使用可信单体资产训练本地小模型"],
    ["8", "结构驱动世界画面", "未开始", "单体稳定后组合地形、道路、建筑和动态对象"],
  ]

  const plan = [
    ["A", "树木样本", "树干透明层 + 树冠透明层", "生成首个可验证精灵图和三类 Mask"],
    ["B", "单体类别扩展", "石块、草簇、材料、建筑部件", "建立可训练的分类单体资产集"],
    ["C", "单体模型训练", "本地训练、验证、失败样本隔离", "模型可以自主生成合格单体"],
    ["D", "场景结构合成", "Scene Blueprint 放置已批准单体", "生成结构正确的静态世界场景"],
    ["E", "场景画质训练", "学习统一光照、材质、像素细节", "接近目标参考图质量"],
    ["F", "视觉审核闸门", "完整性、结构、画质与世界事实检查", "不合格画面禁止展示"],
    ["G", "动态层", "人物、动物、动作与环境动画", "静态世界合格后再接入"],
  ]

  const functions = [
    ["原始素材登记", "可用", "正确", "只保存来源文件与登记信息，不伪造 Mask"],
    ["RGBA 分层资产输入", "可用", "正确", "拒绝无 Alpha、空 Alpha、尺寸不一致图层"],
    ["精灵图合成", "可用", "正确", "按 zIndex 合成，不改变图层事实"],
    ["精准 Mask 生成", "可用", "正确", "直接读取同源图层 Alpha，不从 PNG 猜测"],
    ["文件哈希绑定", "可用", "正确", "记录图层、精灵图和 Mask 的 SHA-256"],
    ["页面展示闸门", "可用", "正确", "没有真实资产时只显示未就绪"],
    ["工程树木资产", engineeringAssets > 0 ? "可用" : "缺失", engineeringAssets > 0 ? "正确" : "未完成", "只验证分层、Mask、哈希和页面预览，不进入训练"],
    ["候选树木资产", candidateAssets > 0 ? "可用" : "缺失", candidateAssets > 0 ? "代理审核通过" : "未完成", "VJ-A 与 VJ-B1 已通过，但实际画质仍未达到最终参考标准"],
    ["单体 VJ-A 客观审核", "可用", "正确", "检查尺寸、二值 Alpha、覆盖率、色彩层次、明度跨度、边缘密度与同源标注"],
    ["单体 VJ-B1 品质代理审核", "可用", "正确", "检查平涂、内部细节、高光阴影、轮廓复杂度、材质分离和类别图层"],
    ["单体 VJ-B2 学习型审核", "训练阻断", "正确", "实现已完成，但正负可信样本不足，当前没有可用模型权重"],
    ["VJ-B2 数据与模型代码", "可用", "正确", "自有样本协议、正负数据门槛、小型 CNN、训练、权重哈希和推理入口已建立"],
    ["首个正式树木资产", hasAssets ? "可用" : "缺失", hasAssets ? "待抽检" : "未完成", "当前工程树画质未达到最终参考标准"],
    ["模型训练", "阻断", "正确", "可信资产不足时不应启动正式训练"],
    ["世界画面生成", "阻断", "正确", "前置单体资产与模型尚未完成"],
  ]

  return (
    <>
      <StatusTable title="总进度表" subtitle="按大模块计算，不把演示代码当成功能完成。" headers={["阶段", "模块", "状态", "真实结果"]} rows={progress} />
      <StatusTable title="后续执行计划" subtitle="必须完成一个大模块并验收后，才能进入下一模块。" headers={["顺序", "大模块", "主要工作", "完成标准"]} rows={plan} />
      <StatusTable title="功能与正确性检查" subtitle="“正确”表示当前实现符合新方案；“未完成”不是错误，但不能对外宣称完成。" headers={["功能", "状态", "判断", "检查依据"]} rows={functions} />
    </>
  )
}

function StatusTable({ title, subtitle, headers, rows }: {
  title: string
  subtitle: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>PROJECT CONTROL</small><h2>{title}</h2></div>
        <p>{subtitle}</p>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.statusTable}>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={`${title}-${row[0]}`}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}><span className={statusClass(cell)}>{cell}</span></td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

function statusClass(value: string) {
  if (["完成", "可用", "正确"].includes(value)) return styles.good
  if (["进行中", "待抽检", "代理审核通过"].includes(value)) return styles.active
  if (["缺失", "未完成", "未开始", "阻断", "训练阻断", "VJ-A 未通过"].includes(value)) return styles.blocked
  return undefined
}
