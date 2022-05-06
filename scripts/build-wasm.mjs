// @ts-check
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageNameByLanguage = {
  html: 'tree-sitter-html',
  markdown: 'tree-sitter-markdown',
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
for (const language in packageNameByLanguage) {
  const packageName = packageNameByLanguage[language]
  console.log(`* Building ${language}`)
  execSync(`$(pnpm bin)/tree-sitter build-wasm ${resolve(rootDir, `node_modules/${packageName}`)}`, {
    stdio: 'inherit',
  })
  execSync(`mv ${packageName}.wasm tree-sitter/tree-sitter-${language}.wasm`, { stdio: 'inherit' })
}
