export interface Registerable {
  register(): {
    dispose(): void
  }
}

export interface AuthParams {
  username: string
  password: string
}
