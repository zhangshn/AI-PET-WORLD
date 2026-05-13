/**
 * 当前文件负责：提供像素图层测试页使用的像素美术原型。
 */

import styles from "./pixel-layer-test.module.css"

type PixelTone =
  | "empty"
  | "shadow"
  | "fur"
  | "furDark"
  | "skin"
  | "cloth"
  | "clothDark"
  | "roof"
  | "wall"
  | "wood"
  | "leaf"
  | "leafDark"
  | "light"
  | "detail"

const toneByChar: Record<string, PixelTone> = {
  ".": "empty",
  s: "shadow",
  f: "fur",
  F: "furDark",
  k: "skin",
  c: "cloth",
  C: "clothDark",
  r: "roof",
  w: "wall",
  o: "wood",
  l: "leaf",
  L: "leafDark",
  y: "light",
  d: "detail",
}

function PixelGrid({
  title,
  rows,
}: {
  title: string
  rows: readonly string[]
}) {
  return (
    <div className={styles.prototypeGrid} aria-label={title}>
      {rows.flatMap((row, rowIndex) =>
        Array.from(row).map((char, columnIndex) => {
          const tone = toneByChar[char] ?? "empty"

          return (
            <span
              data-pixel-tone={tone}
              key={`${rowIndex}-${columnIndex}`}
            />
          )
        })
      )}
    </div>
  )
}

export function PixelPetPrototype() {
  const rows = [
    "................",
    "....F......F....",
    "...FfF....FfF...",
    "...fffffffff....",
    "..fffdfffdff....",
    "..ffffddffff....",
    "..ffffddddff....",
    ".Ffffffffffff...",
    "FFFfffffffffF...",
    ".Ffffffffffff...",
    "..ffffffffff....",
    "...ff....ff.....",
    "...ff....ff.....",
    "..ss......ss....",
    ".ssssssssssss...",
    "................",
  ] as const

  return <PixelGrid rows={rows} title="Pixel pet prototype" />
}

export function PixelButlerPrototype() {
  const rows = [
    "................",
    "......CCCC......",
    ".....CkkkkC.....",
    ".....kdkdk......",
    ".....kkdkk......",
    "......kkk.......",
    ".....cccccc.....",
    "....cCccccCc....",
    "...kcCccccCck...",
    "...k.cCccCc.k...",
    ".....cccccc.....",
    ".....cC..Cc.....",
    ".....oo..oo.....",
    "....soo..oos....",
    "...ssssssssss...",
    "................",
  ] as const

  return <PixelGrid rows={rows} title="Pixel butler prototype" />
}

export function PixelHousePrototype() {
  const rows = [
    "................",
    "......rr........",
    ".....rrrr.......",
    "....rrrrrr......",
    "...rrrrrrrr.....",
    "..rrrrrrrrrr....",
    ".rrrrrrrrrrrr...",
    "...wwwwwwww.....",
    "...wywwwyww.....",
    "...wwwwwwww.....",
    "...wwwddwww.....",
    "...wwwddwww.....",
    "..oooooooooo....",
    ".oooooooooooo...",
    "ssssssssssssss..",
    "................",
  ] as const

  return <PixelGrid rows={rows} title="Pixel house prototype" />
}

export function PixelTreePrototype() {
  const rows = [
    "................",
    "......LLLL......",
    "....LLllllLL....",
    "...LLllllllLL...",
    "..LLllllllllLL..",
    "..LllllllllllL..",
    "...LlllllllLL...",
    "....LLllllL.....",
    "......oooo......",
    "......oooo......",
    "......oooo......",
    ".....oooooo.....",
    "....oooooooo....",
    "...ssssssssss...",
    "..ssssssssssss..",
    "................",
  ] as const

  return <PixelGrid rows={rows} title="Pixel tree prototype" />
}
