import { createParser, transformers } from '../src'
import { readFile } from 'node:fs/promises'
import { RichText } from '@grammarly/sdk'

expect.addSnapshotSerializer({
  test(value) {
    return typeof value !== 'string'
  },
  print(richtext, _print, indent) {
    return (richtext as RichText).ops
      .map((op) =>
        indent(
          JSON.stringify(op.insert).slice(1, -1) +
            (op.attributes == null || Object.keys(op.attributes).length === 0
              ? ''
              : ' ' + JSON.stringify(op.attributes)),
        ),
      )
      .join('\n')
  },
})

describe('markdown', () => {
  test('encode', async () => {
    const parser = await createParser('markdown')
    const contents = await readFile(`${__dirname}/markdown.md`, 'utf-8')
    const [richtext] = transformers.markdown.encode(parser.parse(contents))
    expect(richtext).toMatchSnapshot()
  })

  test('decode', async () => {
    expect(
      transformers.markdown.decode({
        ops: [
          //
          { insert: 'This is ' },
          { insert: 'bold text', attributes: { bold: true } },
          { insert: '.' },
        ],
      }),
    ).toMatchInlineSnapshot(`"This is **bold text**."`)
  })
})
