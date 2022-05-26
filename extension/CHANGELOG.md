# Changelog

## 0.22.1

- c2a3108: Update dependencies

## 0.22.0

- ce4c6cb: Add **Files > Include** and **Files > Exclude** setting
  - Deprecate setting `grammarly.patterns` in favor of `grammarly.files.include`
  - Add `grammarly.files.include` and `grammarly.files.exclude` settings for selecting documents

## 0.20.0

- 2de7e79: Support for connected Grammarly account in web extension (https://github.dev and https://vscode.dev)
- 75fce63: Pause text checking session
  - Commands:
    - `Grammarly: Pause text check` — Available when the active editor has an active Grammarly session
    - `Grammarly: Resume text check` — Available when the active editor has a paused Grammarly session
    - `Grammarly: Restart language server`
  - Configuration:
    - `grammarly.startTextCheckInPausedState` — When enabled, new text checking session is paused initially

## 0.18.1

- c735bc8: Use config from workspace configuration (correctly)

## 0.18.0

- a30aa93: Support for connected Grammarly account

## 0.16.0

- 1b8a750: Use Grammarly SDK

## 0.14.0

- 1ed857d: Show diagnostics in the correct position after accepting fixes

## 0.13.0

- OAuth Support
