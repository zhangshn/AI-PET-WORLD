/**
 * 当前文件负责：渲染住所室内家具、门与记录桌。
 */

import { Graphics } from "pixi.js"

import type { PetState } from "@/types/pet"

export function drawInteriorDoor(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 78, 148).fill(0x2f1f18)
  graphic.rect(x + 8, y + 8, 62, 132).fill(0x5f3a24)
  graphic.rect(x + 16, y + 18, 46, 52).fill({
    color: 0x7a4a2a,
    alpha: 0.5,
  })
  graphic.rect(x + 16, y + 78, 46, 48).fill({
    color: 0x3b2418,
    alpha: 0.36,
  })
  graphic.circle(x + 58, y + 74, 4).fill(0xfacc15)

  graphic.rect(x - 18, y + 140, 116, 10).fill({
    color: 0x0f172a,
    alpha: 0.24,
  })
}

export function drawRestCorner(graphic: Graphics, x: number, y: number) {
  graphic.rect(x - 18, y + 66, 172, 18).fill({
    color: 0x0f172a,
    alpha: 0.22,
  })

  graphic.rect(x, y + 18, 128, 60).fill(0x6b4b36)
  graphic.rect(x + 10, y + 8, 104, 34).fill(0x93c5fd)
  graphic.rect(x + 16, y + 13, 38, 20).fill(0xdbeafe)
  graphic.rect(x + 68, y + 20, 40, 14).fill({
    color: 0x60a5fa,
    alpha: 0.54,
  })

  graphic.rect(x, y + 70, 12, 24).fill(0x3b271c)
  graphic.rect(x + 116, y + 70, 12, 24).fill(0x3b271c)
}

export function drawStorageShelf(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 170, 18).fill(0x3b271c)
  graphic.rect(x + 8, y + 18, 154, 84).fill({
    color: 0x2f241f,
    alpha: 0.56,
  })

  for (let row = 0; row < 3; row += 1) {
    const shelfY = y + 30 + row * 24

    graphic.rect(x + 12, shelfY, 146, 5).fill(0x7a4a2a)

    for (let item = 0; item < 4; item += 1) {
      const itemX = x + 22 + item * 34

      graphic.rect(itemX, shelfY - 14, 13, 14).fill({
        color: row === 1 ? 0x38bdf8 : 0xfacc15,
        alpha: 0.45 + item * 0.08,
      })
    }
  }
}

export function drawBirthRecordDesk(
  graphic: Graphics,
  x: number,
  y: number,
  pet: PetState | null
) {
  graphic.rect(x, y + 86, 180, 20).fill({
    color: 0x0f172a,
    alpha: 0.22,
  })

  graphic.rect(x, y + 30, 160, 64).fill(0x6b4b36)
  graphic.rect(x + 10, y + 40, 140, 34).fill({
    color: 0x3b271c,
    alpha: 0.42,
  })

  graphic.rect(x + 22, y, 86, 46).fill(0x1e293b)
  graphic.rect(x + 28, y + 6, 74, 34).fill({
    color: pet ? 0x38bdf8 : 0x64748b,
    alpha: pet ? 0.34 : 0.18,
  })

  graphic.rect(x + 116, y + 18, 24, 28).fill({
    color: 0xf8fafc,
    alpha: 0.7,
  })
  graphic.rect(x + 120, y + 24, 16, 2).fill(0x94a3b8)
  graphic.rect(x + 120, y + 31, 12, 2).fill(0x94a3b8)
  graphic.rect(x + 120, y + 38, 14, 2).fill(0x94a3b8)
}