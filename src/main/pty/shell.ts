import { execFileSync } from 'node:child_process'
import os from 'node:os'
import pty, { type IPty } from 'node-pty'
import type { PtyCreateOptions } from '@shared/types'

export function resolveShell(): string {
  return process.env.SHELL || '/bin/zsh'
}

/**
 * Apps launched from Finder/Dock (not from a terminal) inherit a minimal
 * process.env with none of the user's shell customizations (nvm, homebrew
 * shellenv, etc). Spawn a login shell once at startup and merge its real
 * PATH in, so every pty we spawn afterwards sees the same PATH Terminal.app
 * would give it.
 */
export function fixPathEnv(): void {
  const shell = resolveShell()
  try {
    const output = execFileSync(shell, ['-l', '-c', 'echo -n "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000
    })
    const path = output.trim()
    if (path) {
      process.env.PATH = path
    }
  } catch (error) {
    console.error(
      '[chraude] failed to resolve login shell PATH, falling back to inherited env',
      error
    )
  }
}

function buildEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8'
  }
}

export function spawnSession(opts: PtyCreateOptions): IPty {
  const shell = resolveShell()
  const loginFlag = /zsh|bash/.test(shell) ? ['-l'] : []
  return pty.spawn(shell, loginFlag, {
    name: 'xterm-256color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd || os.homedir(),
    env: buildEnv()
  })
}
