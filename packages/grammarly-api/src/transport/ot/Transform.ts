import { Delta } from './Delta';
import { Range } from './Range';

export interface Transform {
  highlights: Range[];
  context: Range;
  alternatives?: Delta;
}
