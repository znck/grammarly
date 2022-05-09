import { readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export class FileStorage {
  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true })
  }

  getItem(key: string): string | null {
    try {
      return readFileSync(resolve(this.directory, key), 'utf-8')
    } catch {
      return null
    }
  }

  setItem(key: string, value: string): void {
    writeFileSync(resolve(this.directory, key), value)
  }

  removeItem(key: string): void {
    rmSync(resolve(this.directory, key), { force: true })
  }

  clear() {
    rmSync(this.directory, { force: true, recursive: true })
    mkdirSync(this.directory, { recursive: true })
  }

  key(index: number): string | undefined {
    return readdirSync(this.directory)[index]
  }

  get length(): number {
    return readdirSync(this.directory).length
  }
}
