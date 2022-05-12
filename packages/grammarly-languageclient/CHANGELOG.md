# grammarly-languageclient

## 0.0.3

### Patch Changes

- 75fce63: Pause text checking session

  - Commands:
    - `Grammarly: Pause text check` — Available when active editor has an active Grammarly session
    - `Grammarly: Resume text check` — Available when active editor has a paused Grammarly session
    - `Grammarly: Restart language server`
  - Configuration:
    - `grammarly.startTextCheckInPausedState` — When enabled, new text checking session is paused initially

## 0.0.1

### Patch Changes

- a30aa93: Support for connected Grammarly account
