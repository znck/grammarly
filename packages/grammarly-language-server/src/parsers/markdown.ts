import remark from 'remark';
import { Node, Parent } from 'unist';
import IntervalTree from '@flatten-js/interval-tree';

const parser = remark();

export function parse(content: string) {
  const ast = parser.parse(content);
  const tree = new IntervalTree();

  iterate(ast as Parent, node => {
    const { type, position } = node;
    if (position) {
      tree.insert([position.start.offset!, position.end.offset!], type);
    }
  });

  return (interval: [number, number]) => tree.search(interval) as string[];
}

function iterate(node: Parent, fn: (node: Node) => void) {
  const queue: Parent[] = [node];

  fn(node);

  while (queue.length) {
    const node = queue.shift()!;

    node.children.forEach(node => {
      fn(node);

      if (Array.isArray(node.children)) {
        queue.push(node as Parent);
      }
    });
  }
}
