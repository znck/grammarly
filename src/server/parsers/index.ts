import * as markdown from './markdown';

interface Parser {
  parse(content: string): (interval: [number, number]) => string[];
}

export const parsers: Record<string, Parser> = {
  markdown,
};
