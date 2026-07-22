import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// Claude Code persists each conversation's transcript continuously as it
// happens, at ~/.claude/projects/<sanitized-cwd>/<session-uuid>.jsonl — the
// same convention this very session's own transcript is stored under.
// Sanitizing replaces every character that isn't alphanumeric or a dash
// (not just "/" — e.g. "." and "@" in a username also become dashes) with a
// dash. The most recently modified file in that directory is the session
// currently running in that directory, if any.
function sanitizeCwdForProjectDir(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9-]/g, '-')
}

export function findLatestClaudeSessionId(absoluteCwd: string): string | null {
  const projectDir = join(homedir(), '.claude', 'projects', sanitizeCwdForProjectDir(absoluteCwd))

  let latestName: string | null = null
  let latestMtimeMs = -Infinity
  try {
    for (const name of readdirSync(projectDir)) {
      if (!name.endsWith('.jsonl')) continue
      const { mtimeMs } = statSync(join(projectDir, name))
      if (mtimeMs > latestMtimeMs) {
        latestMtimeMs = mtimeMs
        latestName = name
      }
    }
  } catch {
    return null
  }

  return latestName ? latestName.slice(0, -'.jsonl'.length) : null
}
