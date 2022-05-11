import { createStore, get, set, keys, del, delMany } from 'idb-keyval'

export class VirtualStorage {
  public items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

export class IDBStorage extends VirtualStorage {
  private store = createStore('grammarly-languageserver', 'localStorage')

  async load(): Promise<void> {
    for (const key of await keys<string>(this.store)) {
      const value = await get<string>(key, this.store)
      if (value != null) {
        this.items.set(key, value)
      }
    }
  }

  clear(): void {
    delMany(Array.from(this.items.keys()), this.store)
    super.clear()
  }

  getItem(key: string): string | null {
    get(key, this.store).then((value) => {
      if (value != null) {
        this.items.set(key, value)
      } else {
        this.items.delete(key)
      }
    })

    return super.getItem(key)
  }

  removeItem(key: string): void {
    del(key, this.store)
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    set(key, value, this.store)
    this.items.set(key, value)
  }
}
