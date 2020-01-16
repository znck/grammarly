# Grammarly

Unofficial Grammarly extension.

![Preview of Grammarly diagnostics](./assets/screenshot1.png)

## Features

- Issue highlighting with hover description.
- Replacement and synonym suggestions.
- Checks plaintext and markdown.

## Extension Settings

This extension contributes to the following settings:

### Machine Scoped

- `grammarly.username`: A username for grammarly.com (optional).
- `grammarly.password`: A password for grammarly.com (optional).

### Resource

- `grammarly.audience`: Sets the default audience for every document.
- `grammarly.dialect`: Sets the default dialect for every document.
- `grammarly.domain`: Sets the default domain for every document.
- `grammarly.emotions`: Sets the default list of emotions for every document.
- `grammarly.goals`: Sets the default list of goals for every document.
- `grammarly.userWords`: Custom word in the user dictionary.
- `grammarly.overrides`: Customize `audience`, `dialect`, `domain`, `emotions` and `goals` for specific documents.
- `grammarly.diagnostics`: Sets language-specific rules to ignore unnecessary diagnostics.

## Release Notes

### Version 0.6.0

Ignore diagnostics in regions of markdown. By default, fenced code blocks are ignored.

To ignore inline code snippets, set `grammarly.diagnostics` to:

```json
{
  "[markdown]": {
    "ignore": ["inlineCode", "code"]
  }
}
```

The `ignore` option uses node types from remark AST, you can find supported type in [this example on ASTExplorer](https://astexplorer.net/#/gist/6f869d3c43eed83a533b8146ac0f470b/latest).

### Version 0.5.0

Custom Grammarly goals per document.

### Version 0.4.0

Dismiss alerts.

### Version 0.3.0

Save words to local or Grammarly dictionary.

![Add to dictionary example](./assets/screenshot2.png)

### Version 0.1.0

Uses incremental document sync to send operational transformation messages to Grammarly API which
gives near real-time feedback/diagnostics.

### Version 0.0.0

The initial release of unofficial Grammarly extension.

**Enjoy!**
