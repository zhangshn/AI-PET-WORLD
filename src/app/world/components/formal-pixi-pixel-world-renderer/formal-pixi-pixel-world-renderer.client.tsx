// 该组件用于在正式世界中用 PixiJS 渲染 PixelWorldView 像素缓冲区。

"use client";

import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { PixelWorldPixelBufferFrame } from "@/world/pixel-worldview";
import styles from "./formal-pixi-pixel-world-renderer.module.css";

export function FormalPixiPixelWorldRendererClient(input: {
  buffer: PixelWorldPixelBufferFrame;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const app = new Application();
    let initialized = false;
    let disposed = false;

    mount.replaceChildren();

    async function initialize() {
      await app.init({
        width: input.buffer.canvas.width,
        height: input.buffer.canvas.height,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      initialized = true;

      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }

      mount.appendChild(app.canvas);

      const root = new Container();
      input.buffer.layers.forEach((layer) => {
        const graphics = new Graphics();

        layer.cells.forEach((cell) => {
          if (!cell.visible) return;

          graphics.rect(cell.x, cell.y, cell.width, cell.height);
          graphics.fill({
            color: parseColorHintToNumber(cell.colorHint),
            alpha: clampOpacity(cell.opacity),
          });
        });

        root.addChild(graphics);
      });

      app.stage.addChild(root);
    }

    void initialize();

    return () => {
      disposed = true;
      if (initialized) app.destroy(true, { children: true });
      mount.replaceChildren();
    };
  }, [input.buffer]);

  return (
    <section className={styles.shell}>
      <h2 className={styles.heading}>正式 PixiJS PixelWorldView Renderer</h2>
      <p className={styles.description}>
        只消费 PixelWorldPixelBufferFrame，不读取 runtime，不生成默认宠物。
      </p>
      <div className={styles.stageFrame}>
        <div ref={mountRef} className={styles.mount} aria-label="Formal Pixi PixelWorldView canvas mount" />
      </div>
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>worldId: {input.buffer.worldId}</span>
        <span className={styles.statusItem}>tick: {input.buffer.tick}</span>
        <span className={styles.statusItem}>cellCount: {input.buffer.cellCount}</span>
        <span className={styles.statusItem}>layers: {input.buffer.layers.length}</span>
      </div>
    </section>
  );
}

function parseColorHintToNumber(colorHint?: string): number {
  if (!colorHint || !/^#[0-9a-f]{6}$/i.test(colorHint)) return 0xff00ff;
  return Number.parseInt(colorHint.slice(1), 16);
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}
