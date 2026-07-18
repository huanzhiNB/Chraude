import type { ChraudeAPI } from './index'

declare global {
  interface Window {
    chraude: ChraudeAPI
  }
}
