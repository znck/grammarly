export interface Registerable {
  register(): {
    dispose(): void
  }
}
