import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

// Shared read-only query. Importing this module never queries or launches a process.
export function processIdentity(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true, timeout: 10_000 }).trim()
}
