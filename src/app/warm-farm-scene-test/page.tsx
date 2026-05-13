/**
 * 当前文件负责：展示温暖农场像素 RPG 风格的家园组合预览。
 */

import styles from "./warm-farm-scene-test.module.css"

type SceneObject = {
  key: string
  className: string
  label: string
}

type FarmScene = {
  title: string
  subtitle: string
  stage: string
  modules: string[]
  objects: SceneObject[]
}

const coreRules = [
  "紫微斗数是第一核心，八字只在时间缺失时辅助补全。",
  "当前页面不是 Sprite Metadata 工具页，而是温暖农场像素 RPG 风格的组合预览。",
  "低保真也要表现生活化家园氛围，不能再像开发调试色块。",
  "所有物体按 16px tile 网格摆放，不复制任何具体游戏素材，不引入图片。",
]

const scenes: FarmScene[] = [
  {
    title: "初始家园预览",
    subtitle: "以宠物抵达点和初始照护点为中心，验证第一天的空地、路径、管家和宠物。",
    stage: "HOME-00 / HOME-01",
    modules: ["草地 tile", "泥土路径", "宠物抵达点", "临时照护箱", "管家", "宠物", "树木", "石头"],
    objects: [
      { key: "path-a", className: styles.pathStarterA, label: "泥土路径" },
      { key: "path-b", className: styles.pathStarterB, label: "路径边缘" },
      { key: "arrival", className: styles.arrivalPoint, label: "宠物抵达点" },
      { key: "care-box", className: styles.careCrate, label: "临时照护箱" },
      { key: "butler", className: styles.butlerSprite, label: "管家" },
      { key: "pet", className: styles.petSprite, label: "宠物" },
      { key: "tree-a", className: styles.treeLarge, label: "树木" },
      { key: "stone", className: styles.stoneCluster, label: "小石头" },
      { key: "grass-a", className: styles.grassTuftA, label: "草簇" },
    ],
  },
  {
    title: "小屋建设预览",
    subtitle: "以小屋为中心，展示屋顶、墙体、地基、门窗、阴影和木材储物区。",
    stage: "HOME-02 / HOME-03",
    modules: ["地基", "墙体", "屋顶", "门窗", "木材", "储物箱", "管家站位", "建筑阴影"],
    objects: [
      { key: "house-shadow", className: styles.houseShadow, label: "建筑阴影" },
      { key: "house", className: styles.pixelHouse, label: "基础小屋" },
      { key: "path-a", className: styles.pathHouseA, label: "门前路径" },
      { key: "butler", className: styles.butlerBuilder, label: "建设管家" },
      { key: "wood", className: styles.woodStack, label: "木材" },
      { key: "storage", className: styles.storageBox, label: "储物箱" },
      { key: "tree", className: styles.treeSmall, label: "边缘树木" },
      { key: "flower", className: styles.flowerPatch, label: "小花" },
    ],
  },
  {
    title: "宠物生活区预览",
    subtitle: "以宠物和生活设施为中心，食物碗、饮水碗、床、储物箱和花园围绕安全角落摆放。",
    stage: "CARE-01",
    modules: ["宠物", "宠物床", "食物碗", "饮水碗", "小地毯", "储物箱", "花园地块", "安全角落"],
    objects: [
      { key: "pet-bed", className: styles.petBed, label: "宠物床" },
      { key: "food", className: styles.foodBowl, label: "食物碗" },
      { key: "water", className: styles.waterBowl, label: "饮水碗" },
      { key: "pet", className: styles.petResting, label: "宠物" },
      { key: "mat", className: styles.welcomeMat, label: "小地毯" },
      { key: "storage", className: styles.careStorage, label: "储物箱" },
      { key: "garden", className: styles.gardenBed, label: "花园地块" },
      { key: "fence", className: styles.fenceCorner, label: "安全角落" },
      { key: "lamp", className: styles.warmLamp, label: "暖光" },
    ],
  },
  {
    title: "领养中心预览",
    subtitle: "以临时领养中心、公告板和登记区域为中心，验证它像功能建筑而不是色块堆叠。",
    stage: "TOWN-01",
    modules: ["领养中心", "公告板", "登记台", "等待长椅", "抵达点", "欢迎垫", "路径", "树木"],
    objects: [
      { key: "building-shadow", className: styles.adoptionShadow, label: "建筑阴影" },
      { key: "building", className: styles.adoptionCenter, label: "临时领养中心" },
      { key: "board", className: styles.noticeBoard, label: "公告板" },
      { key: "counter", className: styles.counterDesk, label: "登记台" },
      { key: "bench", className: styles.waitingBench, label: "等待长椅" },
      { key: "arrival", className: styles.townArrivalPoint, label: "抵达点" },
      { key: "mat", className: styles.centerWelcomeMat, label: "欢迎垫" },
      { key: "path", className: styles.pathCenter, label: "入口路径" },
      { key: "tree", className: styles.treeCenter, label: "树木" },
    ],
  },
]

function renderSceneObject(object: SceneObject) {
  return (
    <span key={object.key} className={`${styles.sceneObject} ${object.className}`} title={object.label}>
      <span className={styles.objectLabel}>{object.label}</span>
    </span>
  )
}

export default function WarmFarmSceneTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>ART-03</p>
        <h1>温暖农场像素 RPG 风格组合预览</h1>
        <p>验证模块组合后是否像一个生活化、可长期成长的像素家园世界。</p>
      </section>

      <section className={styles.corePanel}>
        <h2>核心约束</h2>
        <div className={styles.coreGrid}>
          {coreRules.map((rule, index) => (
            <article key={rule} className={styles.coreCard}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sceneSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Scene Composition</p>
          <h2>4 个生活化组合场景</h2>
          <p>每个场景控制在 8 到 12 个关键物体，用 16px tile 网格、2.5D 建筑结构和温暖低饱和色彩验证方向。</p>
        </div>

        <div className={styles.sceneGrid}>
          {scenes.map((scene) => (
            <article key={scene.title} className={styles.sceneCard}>
              <header className={styles.sceneCardHeader}>
                <div>
                  <h3>{scene.title}</h3>
                  <p>{scene.subtitle}</p>
                </div>
                <strong>{scene.stage}</strong>
              </header>

              <div className={styles.pixelMap} aria-label={scene.title}>
                <span className={styles.groundDetailA} />
                <span className={styles.groundDetailB} />
                <span className={styles.groundDetailC} />
                <span className={styles.groundDetailD} />
                {scene.objects.map(renderSceneObject)}
              </div>

              <footer className={styles.moduleFooter}>
                <strong>使用模块</strong>
                <div>
                  {scene.modules.map((module) => (
                    <span key={module}>{module}</span>
                  ))}
                </div>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
