import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const targets = [
  { name: 'server', cwd: path.join(projectRoot, 'server'), script: 'start' },
  { name: 'client', cwd: path.join(projectRoot, 'client'), script: 'dev' },
]

const children = []
let isShuttingDown = false

function stopAll(exitCode = 0) {
  if (isShuttingDown) return
  isShuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
    }
    process.exit(exitCode)
  }, 500)
}

for (const target of targets) {
  const child = spawn(npmCommand, ['run', target.script], {
    cwd: target.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('error', (error) => {
    console.error(`Failed to start ${target.name}:`, error.message)
    stopAll(1)
  })

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.error(`${target.name} process exited (${reason}). Stopping all.`)
    stopAll(code ?? 1)
  })

  children.push(child)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
