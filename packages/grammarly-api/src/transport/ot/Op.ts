import { OpDelete } from './OpDelete';
import { OpInsert } from './OpInsert';
import { OpRetain } from './OpRetain';

export type Op = OpRetain | OpInsert | OpDelete;
