import { trims } from '../utils';
import type { Transform } from '../types';

export const transform: Transform = {
  id: 'Init',
  title: '排版初始化',
  description: '统一空白字符、去除每行行首与文末空格、压缩连续空行为单个换行',
  run(text) {
    // 原实现：`(this + "\n").trims().replace(/\n\n+/g, "\n")`
    return trims(text + '\n').replace(/\n\n+/g, '\n');
  },
};
