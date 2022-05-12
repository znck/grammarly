---
'grammarly': patch
'grammarly-languageclient': patch
'grammarly-languageserver': patch
---

Pause text checking session

- Commands:
  - `Grammarly: Pause text check` — Available when active editor has an active Grammarly session
  - `Grammarly: Resume text check` — Available when active editor has a paused Grammarly session
  - `Grammarly: Restart language server`
- Configuration:
  - `grammarly.startTextCheckInPausedState` — When enabled, new text checking session is paused initially
