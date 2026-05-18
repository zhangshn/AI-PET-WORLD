/**
 * 当前文件负责：用 SVG 线框展示 ProceduralRenderer v0 的 DrawCommand 调试结果。
 */

import type { ReactNode } from "react"

import type {
  DrawCommand,
  RenderableWorldSnapshot,
} from "@/world/rendering/renderer-gateway"
import type { Point2D } from "@/world/spatial/spatial-gateway"

const VIEW_SCALE = 24
const VIEW_PADDING = 24
const MAX_VISIBLE_COMMANDS = 400

export function ProceduralRendererWireframePreview(input: {
  title: string
  snapshot: RenderableWorldSnapshot | null
}) {
  if (!input.snapshot) {
    return (
      <article>
        <h2>{input.title}</h2>
        <p>暂无 RenderableWorldSnapshot。</p>
      </article>
    )
  }

  const { mapSize, worldId } = input.snapshot.visualState
  const visibleCommands = input.snapshot.drawCommands.slice(
    0,
    MAX_VISIBLE_COMMANDS
  )
  const summary = {
    worldId,
    drawCommandCount: input.snapshot.drawCommands.length,
    visibleCommandCount: visibleCommands.length,
    maxVisibleCommandCount: MAX_VISIBLE_COMMANDS,
    mapSize,
  }

  return (
    <article
      style={{
        border: "1px solid currentColor",
        borderRadius: 12,
        padding: 12,
        overflow: "auto",
      }}
    >
      <h2>{input.title}</h2>
      <p>这是 debug 线框预览，只读取 DrawCommand，不代表正式世界画面。</p>
      <svg
        aria-label={input.title}
        height={mapSize.rows * VIEW_SCALE + VIEW_PADDING * 2}
        role="img"
        style={{
          display: "block",
          maxWidth: "100%",
          background: "transparent",
        }}
        viewBox={`0 0 ${mapSize.columns * VIEW_SCALE + VIEW_PADDING * 2} ${
          mapSize.rows * VIEW_SCALE + VIEW_PADDING * 2
        }`}
        width={mapSize.columns * VIEW_SCALE + VIEW_PADDING * 2}
      >
        {visibleCommands.map(renderDrawCommand)}
      </svg>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </article>
  )
}

function toScreenPoint(point: Point2D): Point2D {
  return {
    x: point.x * VIEW_SCALE + VIEW_PADDING,
    y: point.y * VIEW_SCALE + VIEW_PADDING,
  }
}

function toSvgPoints(points: Point2D[]): string {
  return points
    .map((point) => {
      const screenPoint = toScreenPoint(point)
      return `${screenPoint.x},${screenPoint.y}`
    })
    .join(" ")
}

function dashToStrokeDasharray(dash?: number[]): string | undefined {
  return dash?.join(" ")
}

function renderDrawCommand(command: DrawCommand): ReactNode {
  if (command.kind === "point") {
    return renderPointCommand(command)
  }

  if (command.kind === "line") {
    return renderLineCommand(command)
  }

  if (command.kind === "label") {
    return renderLabelCommand(command)
  }

  return renderShapeCommand(command)
}

function renderShapeCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind === "polygon") {
    return (
      <polygon
        fill="none"
        key={command.id}
        opacity={command.debugStyle.opacity}
        points={toSvgPoints(command.geometry.polygon.points)}
        stroke="currentColor"
        strokeDasharray={dashToStrokeDasharray(command.debugStyle.dash)}
        strokeWidth={command.debugStyle.strokeWidth}
      />
    )
  }

  if (command.geometry.kind === "multiPolygon") {
    return command.geometry.multiPolygon.polygons.map((polygon, index) => (
      <polygon
        fill="none"
        key={`${command.id}-polygon-${index}`}
        opacity={command.debugStyle.opacity}
        points={toSvgPoints(polygon.points)}
        stroke="currentColor"
        strokeDasharray={dashToStrokeDasharray(command.debugStyle.dash)}
        strokeWidth={command.debugStyle.strokeWidth}
      />
    ))
  }

  return null
}

function renderPointCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "point") {
    return null
  }

  const point = toScreenPoint(command.geometry.point)

  return (
    <circle
      cx={point.x}
      cy={point.y}
      fill="currentColor"
      key={command.id}
      opacity={command.debugStyle.opacity}
      r={3}
    />
  )
}

function renderLineCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "line") {
    return null
  }

  return (
    <polyline
      fill="none"
      key={command.id}
      opacity={command.debugStyle.opacity}
      points={toSvgPoints(command.geometry.line.points)}
      stroke="currentColor"
      strokeDasharray={dashToStrokeDasharray(command.debugStyle.dash)}
      strokeWidth={command.debugStyle.strokeWidth}
    />
  )
}

function renderLabelCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "point") {
    return null
  }

  const point = toScreenPoint(command.geometry.point)

  return (
    <text
      fill="currentColor"
      fontSize={10}
      key={command.id}
      opacity={0.85}
      x={point.x}
      y={point.y}
    >
      {command.label ?? command.id}
    </text>
  )
}
