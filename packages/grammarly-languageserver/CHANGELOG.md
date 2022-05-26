# grammarly-languageserver

## 0.0.4

### Patch Changes

- c2a3108: Fix the grammarly-languageserver executable's shebang

## 0.0.3

### Patch Changes

- 2de7e79: Support for connected Grammarly account in web extension (https://github.dev and https://vscode.dev)
- bdbee32: Fix import path in grammarly-languageserver bin
- 75fce63: Pause text checking session

  - Commands:
    - `Grammarly: Pause text check` — Available when active editor has an active Grammarly session
    - `Grammarly: Resume text check` — Available when active editor has a paused Grammarly session
    - `Grammarly: Restart language server`
  - Configuration:
    - `grammarly.startTextCheckInPausedState` — When enabled, new text checking session is paused initially

## 0.0.2

### Patch Changes

- c735bc8: Use config from workspace configuration in Grammarly SDK

## 0.0.1

### Patch Changes

- a30aa93: Support for connected Grammarly account
