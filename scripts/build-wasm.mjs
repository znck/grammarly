// @ts-check
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

for (const language of ['html', 'markdown']) {
  console.log(`* Build language ${language}`)
  execSync(`$(pnpm bin)/tree-sitter build-wasm ${resolve(rootDir, `node_modules/tree-sitter-${language}`)}`, {
    stdio: 'inherit',
  })
  execSync(`mv tree-sitter-${language}.wasm tree-sitter/`, { stdio: 'inherit' })
}
