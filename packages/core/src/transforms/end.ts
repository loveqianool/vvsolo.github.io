import { getTransform } from '../registry';
import { rps, type RpsPair } from '../utils';
import { transform as finishTransform } from './finish';
import type { Transform } from '../types';

/**
 * 原 `$End` 的 IIFE 参数 e。
 * 注意替换串 `" --\\x3e "` 里 `\x3e` 是字符串转义即 `>`，故为 `" --> "`。
 */
const END_RPS: RpsPair[] = [
  [/—{1,2}>/g, ' --> '],
  [/={1,2}>/g, ' => '],
  [/Co。，? ?Ltd。?/gi, 'Co.,Ltd.'],
];

export const transform: Transform = {
  id: 'End',
  title: '结尾处理',
  description: '规范箭头与 Co.,Ltd. 缩写写法，然后执行排版收尾',
  run(text, _args, ctx) {
    // 原实现：`this.conv("Char").rps(e).$Finish()`
    // conv 内部均未传额外参数，故 Char / Finish 都以空 args 调用（与原实现一致）。
    // Char 由 getTransform 运行时解析：它是另一组的 transform，
    // 这里不静态导入不存在的模块，避免循环依赖与并行开发冲突。
    const afterChar = getTransform('Char').run(text, [], ctx);
    return finishTransform.run(rps(afterChar, END_RPS), [], ctx);
  },
};
