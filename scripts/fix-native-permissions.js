// node-pty ships its macOS spawn-helper binary inside prebuilds/darwin-*/,
// and some npm install/extraction paths strip its executable bit, which
// makes every pty spawn fail with a generic "posix_spawnp failed." error.
// Restore +x on it (and pty.node, for good measure) after every install.
const fs = require('node:fs')
const path = require('node:path')

const prebuildsDir = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds')

if (!fs.existsSync(prebuildsDir)) process.exit(0)

for (const platformDir of fs.readdirSync(prebuildsDir)) {
  if (!platformDir.startsWith('darwin')) continue
  const dir = path.join(prebuildsDir, platformDir)
  for (const file of fs.readdirSync(dir)) {
    fs.chmodSync(path.join(dir, file), 0o755)
  }
}
