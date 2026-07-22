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

const HOME_DIR = os.homedir()

/**
 * node-pty has no API for a session's current working directory — only its
 * foreground process's *name* (used for tab titles). lsof is the standard
 * macOS way to read a process's actual cwd (there's no /proc here). This
 * reads the shell process's own cwd (not whatever foreground child, if any,
 * is currently running), matching what a shell's own prompt/OSC7 would show.
 */
export function getShellCwd(pid: number): string | undefined {
  try {
    const output = execFileSync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], {
      encoding: 'utf8',
      timeout: 1000
    })
    const line = output.split('\n').find((l) => l.startsWith('n'))
    if (!line) return undefined
    const path = line.slice(1)
    return path.startsWith(HOME_DIR) ? `~${path.slice(HOME_DIR.length)}` : path
  } catch {
    return undefined
  }
}

/**
 * node-pty's own foreground-process-name getter (ptyProcess.process, used
 * for tab titles above) turns out to be unreliable for this specific check:
 * on macOS it reads the mutable "process name" field a program can rewrite
 * via Node's `process.title = ...` (Claude Code does this, setting it to its
 * own version string like "2.1.217" rather than leaving it as "claude").
 * `ps -o comm=` instead reads the immutable original exec name recorded at
 * process-start time, unaffected by that — so this checks whether any
 * direct child of the shell is genuinely the `claude` binary.
 */
export function isClaudeForeground(shellPid: number): boolean {
  try {
    const childPids = execFileSync('pgrep', ['-P', String(shellPid)], {
      encoding: 'utf8',
      timeout: 1000
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (childPids.length === 0) return false

    const comms = execFileSync('ps', ['-o', 'comm=', '-p', childPids.join(',')], {
      encoding: 'utf8',
      timeout: 1000
    })
    return comms.split('\n').some((line) => {
      const comm = line.trim()
      return comm === 'claude' || comm.endsWith('/claude')
    })
  } catch {
    return false
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
