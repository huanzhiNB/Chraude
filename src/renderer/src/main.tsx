import './assets/main.css'

import { createRoot } from 'react-dom/client'
import ChromeApp from './ChromeApp'
import TabContentApp from './TabContentApp'

window.addEventListener('error', (e) =>
  console.error('[window error]', e.error?.stack || e.message)
)
window.addEventListener('unhandledrejection', (e) =>
  console.error('[unhandled rejection]', e.reason?.stack || e.reason)
)

// No StrictMode: each mount spawns a real PTY-backed shell process, which is
// a genuine OS-level side effect, not the kind of impure render StrictMode's
// dev-only double-invoke is meant to catch. Double-mounting xterm.js also
// hits a real xterm.js bug where an in-flight async Viewport resize callback
// fires after the first instance's dispose() has already torn down its core.
const params = new URLSearchParams(window.location.search)
const isTabContent = params.get('mode') === 'tab'

createRoot(document.getElementById('root')!).render(
  isTabContent ? <TabContentApp tabId={params.get('tab') ?? ''} /> : <ChromeApp />
)
