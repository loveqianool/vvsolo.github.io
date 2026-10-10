/**
 * Punctuation（原 `_sp.$Punctuation`）：标点符号修正。
 *
 * 语义：`this.rpHook({ at, rps })`——先按字符表把半角/异体标点映射为全角，
 * 再跑 13 组 rps：合并重复标点（……/——/～～ 的去重与成对化）、省略号/破折号
 * 后缀清理、?! 连用的规范化（?!→?!、??→??? 等）等。
 * 逐行对照 old-core-pretty.js 的 `((e) => { _sp.$Punctuation ... })({...})`。
 */
import type { Transform, RunContext } from '../types';
import { rpHook, type HookDef, type RpsPair } from '../utils';

export const PUNCT_AT: [string, string] = [
  "-︐︑︒︓︔︕︖‛｀‐━―─ーˉ﹣~〜∽∼⁓﹗!﹫＠﹟＃﹩＄﹪％﹠＆﹡ꁘ(﹙﹚)﹐,｡.．∶﹕︰:﹔;､丶﹑﹖?⋯┅¨▪•‧・﹒ꔷ︳﹛﹜{}〝〞｢″〃｣‴⌈⌋﹤﹥︿﹀＾﹦＝﹢＋／﹨＼｜︱¦‖＂‟′＇",
  "—，、。：；！？``——————－～～～～～！！@@##$$%%&&＊＊（（）），，。。。：：：：；；、、、？？………······〉｛｝｛｝“”“””””「」＜＞∧∨^==++/\\\\||||\"\"''",
];

export const PUNCT_RPS: RpsPair[] = [
  [
    /([·、`°—－～：；（）［］｛｝%∧∨〈〉《》])\1+/g,
    (m: string, g1: string): string =>
      ~'—－～'.indexOf(g1) ? g1 + g1 : ~'·、`°'.indexOf(g1) ? '……' : g1,
  ],
  [/…[，；：、。·`～—？！]+|[，；。·`～—？！]+(?=…)|。。+|，，+/g, '…'],
  [/…+/g, '……'],
  [/……(?=等[，。！？、])/g, ''],
  [/^(?:…+\n){2,}/gm, '……\n'],
  [/“：|：“”/g, '：“'],
  [/、”“/g, '”、“'],
  [/。）。/g, '）。'],
  [/([…。，！？])”[，；：、。·`～—？！]/g, '$1”'],
  [/([，；：、。·`])[，；：、。·`～—？！]+/g, '$1'],
  [/([？！])[，；：、。·`～—]+/g, '$1'],
  [/～[，；：、。·`—？！]+/g, '～'],
  [
    /[？！]{2,}/g,
    (m: string): string => {
      const firstIsAsk = '？' === m.charAt(0);
      const rest = m.slice(1);
      return firstIsAsk
        ? ~rest.indexOf('！')
          ? '？！'
          : '？？？'
        : ~rest.indexOf('？')
          ? '！？'
          : '！！！';
    },
  ],
];

const PUNCT_HOOK: HookDef = { at: PUNCT_AT, rps: PUNCT_RPS };

export const transform: Transform = {
  id: 'Punctuation',
  title: '标点符号修正',
  description:
    '半角标点转全角；合并重复标点（……、——、～～ 成对化）；规范 ?! 连用与省略号后缀。',
  run(text: string, _args: string[], _ctx: RunContext): string {
    return rpHook(text, PUNCT_HOOK);
  },
};
