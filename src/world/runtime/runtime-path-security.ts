import { lstat, mkdir, realpath } from "node:fs/promises"
import path from "node:path"

/**
 * Resolve a runtime path only when its lexical and physical location stay
 * below the configured runtime root. Existing symlink/reparse components are
 * rejected so a latest-index value cannot redirect reads or writes elsewhere.
 */
export async function assertRuntimePath(
  candidate: string,
  root: string,
  options: { allowRoot?: boolean } = {},
): Promise<string> {
  if (!path.isAbsolute(candidate)) {
    throw new Error("runtime path must be absolute")
  }

  const rootAbsolute = path.resolve(root)
  await mkdir(rootAbsolute, { recursive: true })
  const rootReal = await realpath(rootAbsolute)
  const lexical = path.resolve(candidate)
  const relative = path.relative(rootAbsolute, lexical)
  if (
    (!options.allowRoot && relative.length === 0) ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("runtime path is outside configured root")
  }

  const segments = relative ? relative.split(path.sep) : []
  let current = rootAbsolute
  for (const segment of segments) {
    current = path.join(current, segment)
    try {
      const stat = await lstat(current)
      if (stat.isSymbolicLink()) {
        throw new Error("runtime symlink or junction is not allowed")
      }
    } catch (error) {
      if (isNodeFileError(error) && error.code === "ENOENT") break
      throw error
    }
  }

  try {
    const physical = await realpath(lexical)
    if (!isInside(rootReal, physical)) {
      throw new Error("runtime path resolves outside configured root")
    }
  } catch (error) {
    if (!(isNodeFileError(error) && error.code === "ENOENT")) throw error
    const parent = await realpathExistingAncestor(path.dirname(lexical))
    if (!isInside(rootReal, parent)) {
      throw new Error("runtime parent resolves outside configured root")
    }
  }

  return lexical
}

async function realpathExistingAncestor(candidate: string): Promise<string> {
  let current = path.resolve(candidate)
  while (true) {
    try {
      return await realpath(current)
    } catch (error) {
      if (!(isNodeFileError(error) && error.code === "ENOENT")) throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      current = parent
    }
  }
}

export function assertRuntimePathSegment(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error(`${label} is not a safe runtime path segment`)
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
