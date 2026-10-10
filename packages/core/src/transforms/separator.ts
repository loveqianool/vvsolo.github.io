/**
 * Separator（原 `_sp.$Separator`）：分隔符规范。
 *
 * 语义：`this.rps([...17 组...])`——把 `***`、`---`、`@@@`、连续 `＊`、
 * `——分割线——` 等各种分隔线统一收敛为 `@@@@` 占位，再展开成标准分隔符；
 * 行首 `＊＊…(35+)` 的整行分隔先用 `〔★※★〕` 暂存，最后换成 textSeparator。
 * 逐行对照 old-core-pretty.js 的 `((e) => { _sp.$Separator ... })([...])`。
 *
 * 原实现在数组里直接写死 `config.Separator` / `config.tSeparator`；
 * 这里改从 ctx.config 取（separator / textSeparator），默认值与原 config 一致，
 * fixture 回归可验证等价。
 */
import type { Transform, RunContext } from '../types';
import type { RpsPair } from '../utils';
import { rps } from '../utils';

/** 17 组规则；sep/tSep 运行时传入（原 config.Separator / config.tSeparator） */
export function separatorRules(sep: string, tSep: string): RpsPair[] {
  return [
    [/[ 　]+(?=[#§·●◎◇◆□■△▲※〓＝﹡＋＠☆★—－─=~～＊×\*\-\+@])/g, ''],
    [/^＊＊{34,}$/gm, '〔★※★〕'],
    [/[#§·●◎◇◆□■△▲※〓＝﹡＋＠]{3,}/g, '@@@@'],
    [/[`&★☆—－─=~～＊×\-\+]{4,}/g, '@@@@'],
    [/^[#§·●◎◇◆□■△▲※〓＝﹡＋☆★—－─=~～＊×\*\-\+]{2,}$/gm, '@@@@'],
    [/([。！？…—”」’』])[*xX]{4,}/g, '$1\n@@@@\n'],
    [/^[＊×\*]{3,}/gm, '@@@@'],
    [/\*\*{3,}$/g, '@@@@'],
    [/[\-—＠@][\-—＠分切割线]{3,}[\-—＠@]/g, '@@@@'],
    [/\b([a-zA-Z]+)\b[\-—]@@@+/g, '$1-XXXXX'],
    [/@@@+……$/g, '@@@@'],
    [/([：，；])\n?@@@@\n?/g, '$1****'],
    [/\b(\d+)\b\n?@@@@\n?\b(\d)/g, '$1****$2'],
    [/@@@@\n?(?=[，。！？…’”』」])/g, '****'],
    [/(?:@@+\n*)+/g, '\n@@@@\n'],
    [/\n+@@@@\n+/g, '\n' + sep + '\n'],
    [/〔★※★〕/g, tSep],
  ];
}

export const transform: Transform = {
  id: 'Separator',
  title: '分隔符规范',
  description:
    '将 ***、---、@@@、——分割线—— 等各类分隔线统一为标准分隔符样式。',
  run(text: string, _args: string[], ctx: RunContext): string {
    return rps(text, separatorRules(ctx.config.separator, ctx.config.textSeparator));
  },
};
