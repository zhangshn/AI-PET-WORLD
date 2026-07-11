const command = process.argv[2] ?? "unknown-live-world-command"

console.error(
  JSON.stringify(
    {
      ok: false,
      status: "retired_live_world_command_blocked",
      command,
      reason:
        "The retired 5x5 Chunk, P10-P17, butler, and ecosystem route is outside the current authorized complete-map scope.",
      currentEntry: "npm run run:complete-game-world",
      checkEntry: "npm run check:complete-game-world",
      planEntry: "npm run plan:complete-game-world",
    },
    null,
    2,
  ),
)

process.exitCode = 1
