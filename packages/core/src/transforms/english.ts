/**
 * English：修正英文排版（大小写规范）。
 * 对照 old-core-pretty.js 的 `_sp.$English` 及配套的 `_english` 配置表、
 * `rpHooks` / `rpHook` 机制。
 *
 * 移植要点（均与原实现逐行对齐）：
 * - `common._ac` / `common._ei` 在原实现里是模块加载时以一行 commFmt 算出的
 * 动态片段；这里同样以一行算出，并用 `eiReg` 复刻 `commReg` 对 `{$_ac}` /
 * `{$_ei}` 的展开（flags 缺省 "g"，与原 `commReg` 一致）。
 * - `maskLetter` 等有状态单例从 `./masks` 共享模块引入（与 Quote/Finish 共用
 * 同一份 mask 状态，原 pipeline 语义要求如此）。
 * - 开头的 `this.conv("Letter")` 内联为全角字母→半角映射（与 pipeline 里独立
 * 的 Letter 步骤幂等）。
 * - 原实现有一处笔误：`_english.SpeciaComb`（少了个 l）恒为 undefined，
 * 拼出的正则字面量是 `\b(?:undefined)\b`；为与 fixture 行为一致，这里原样保留。
 */
import type { Transform} from '../types';
import { commFmt} from '../common';
import {
  getReg,
  rpAt,
  rpAtArr,
  rps,
  toLetterCase,
  matchLetterCase,
  type RpsPair,
} from '../utils';
import { maskLetter} from '../masks';
import { internalConfig} from '../config';

/** 原 `common._ac`：` "0-9a-zA-Z{$hwPun}{$fwPun}{$latin}".commFmt()` 一行算出 */
export const AC_SOURCE: string = commFmt('0-9a-zA-Z{$hwPun}{$fwPun}{$latin}');
/** 原 `common._ei`：同理一行算出 */
export const EI_SOURCE: string = commFmt(
"[a-zA-Z{$latin}\\']+(?:[ ][a-zA-Z{$latin}\\']+){0,4}",
);

/**
 * 复刻原 `String.prototype.commReg`，但占位表额外支持动态的 `{$_ac}` / `{$_ei}`
 *（原实现里它们是运行时挂到 common 对象上的属性）。
 */
function eiReg(pattern: string, flags?: string): RegExp {
  const expanded = pattern.replace(/\{\$\w+\}/g, (ph) => {
    const k = ph.slice(2, -1);
    if (k === '_ac') return AC_SOURCE;
    if (k === '_ei') return EI_SOURCE;
    return commFmt(ph);
  });
return new RegExp(expanded, flags === ''? '': flags || 'g');
}

/** 原 `_english` 配置表（Upper/Special/SpecialComb/Unit 为长 alternation 字符串） */
export const ENGLISH_TABLE = {
  Upper:
  'S+VIP|V+IP|WQLMLGB|NASDAQ|[SPNMCE]ICU|E[MD]BA|PTS[DT]|AIDS|APEC|CCTV|CDMA|CUBA|EAPM|ESPN|HDMI|HTML|IMAX|IMDB|IPTV|NASA|OLED|SARS|SEGA|SOHO|SWAT|WCBA|YYDS|OOXX|XXOO|A[TP]M|B2[BCMA]|C[AI]A|C[BC]D|C[CEFTOI]O|C2[ABC]|CN[NM]|[EO]TC|FDA|PV[CPE]|I[BC]M|IS[OP]|L[ES]D|MM[PB]|WT[FO]|[ABC]BS|[ABN]BC|[ICR]CU|[CG]PU|[SH]UV|[VD]CD|[DR]NA|[NC]BA|[MK]TV|[SG]PA|UV[ABCD]|AED|AMC|BGM|CSS|DIY|DEA|EDA|EMS|FBI|GDP|GPS|GSM|IMF|IPO|KGB|LOL|LSP|MBA|MPV|MRI|NDE|NHK|NND|NPC|NTR|O2O|OEM|OMG|ORV|PDA|PPT|RPG|QRS|SOS|TMD|TNT|TVB|UFO|USA|VCR|VPN|WPS|YQF|C[TDR]|D[PCJ]|O[SAL]|P[CS]|I[DPC]|[SJ]B|[STP]M|[VAMCX]R|[ADTM]V|[UV]I|[OJUP]K|[EIQY]Q|NG|VS|I',
  Special:
  'iPhone|iPhoneSE|iPhoneX|iPhoneXR|iPhoneXRMax|iPhoneXR|iPad|iPadPro|iPadAir|iMac|iTv|iPod|iOS|ThinkPad|Windows|Apple|Linux|Unix|FreeBSD|JavaScript|JScript|VBScript|TikTok|toC|toB|PlayStation|ing',
  SpecialComb:
  'McCai|McCall|McClure|McCormick|McCoy|McCullough|McDaniel|McDonald|McDowell|McGee|McGuire|McIntyre|McKayla|McKee|McKenna|McKenzie|McKile|McKinley|McKinney|McLovin|MacDonald|Zhuang ?Bility|Niu ?Bility|Sha ?Bility|Game ?Over',
  Unit: 'MHz|GHz|KHz|kWh|kW|mWh|gWh|mA|μA|mV|μV|mΩ|μΩ|Mbps|mmHg|MT/s|Kbit|Kbyte|bit|byte',
  UnitTest: /kW|mA|mV/i,
  Overlap:
  /\b(buling|duang|bling|ding|ring|fuck|goal|what|why|who|biu|bye|yes|hia|mua|dei|gei|ha|up|go|no|hi|ok)\1+\b/gi,
} as const;

export interface EnglishHook {
  hit?: RegExp | RegExp[];
  skip?: RegExp;
  need?: RegExp;
  at?: [string, string];
  rp?: [RegExp, string];
  rps?: RpsPair[] | Record<string, RpsPair[]>;
  lc?: string;
/** mf / me / mu1 / ms / mu2 / ml1 / ml2 等 matchLetterCase 钩子 */
  [k: string]: unknown;
}

/** 原 `_english.FixFirst` */
export const FIX_FIRST: EnglishHook[] = [
{
  hit: [
  /\b[a-zA-Z]{2,}(?:·\b[a-zA-Z]{2,}\b){1,4}/g,
  /\b[a-zA-Z]{2,}(?:[－—\-]\b[a-zA-Z]{2,}\b){3,}/g,
  ],
  rp: [/[·－—\-]/g, ' '],
},
{ hit: /\b[a-zA-Z]+\d+\b[年月日号楼幢区路]/g, rp: [/\d+/, ' $&']},
{
  mf: eiReg(
  "\\b[a-zA-Z{$latin}\\-\\']+(?:[ ，][a-zA-Z{$latin}\\-\\']+)*",
  'g',
  ),
},
{ hit: /\b[\w\-\\\/]{2,}\b/g, need: /\d/, lc: 'u'},
];

/** 原 `_english.FixLast`（注意 key 顺序与原字面量一致，rpHook 按 for-in 顺序执行） */
export const FIX_LAST: EnglishHook[] = [
{ hit: eiReg('.{$_ei}', 'g'), need: eiReg('[{$han}]', 'g'), lc: 's'},
{
  hit: [
  eiReg('《[ {$_ac}]{2,}》'),
  eiReg('（[ {$_ac}]{2,}）'),
  eiReg('【[ {$_ac}]{2,}】'),
  ],
  need: /[ ，]/,
  lc: 'z',
},
{
  me: eiReg('[{$latin}][A-Za-z]+', 'g'),
  mu1: eiReg('^[{$latin}]', 'gm'),
  ms: /——\b[a-zA-Z]+(?: [a-zA-Z]+){1,2}\b/g,
  mu2:
  /\b(?:(?:([a-z])\1+|abc?d?e?f?g?|c?defg?|xyz|jqka?|wsad|wasd|qwerty|(What|Why|Fuck|Goal|Go)(?:[，。！？]\2){1,4}|[a-zA-Z](?:[\+\-\.][a-zA-Z])+)\b|[a-zA-Z]{1,4}[国省市县山城江河]|[odlODL]\'[a-z])/gi,
  ml1: /\b(?:And|Or|By|To|\d+X\d+|Em+|Hm+|Oh+|Ah+|Wa+|Ha+|Nim|Ssi|Xi)\b/g,
  ml2:
  / \b(?:A|About|An|And|As|At|Be|But|By|For|From|In|Into|Is|Nor|Of|Off|On|Onto|Or|Out|Over|Should|So|The|To|Under|Will|With|Yet)\b /g,
},
{
  hit: /\b(?:Mrs?|Ms|Doc|Dr|Jr|Rev|Hon|Mmes?|Esq|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)\b。(?!$)/g,
  rp: [/。/, '.'],
},
{
  hit: [
  /\b(?:\d[\.。\d]{1,18} ?)(?:(?:portion|second|minute|barrel|sheet|group|batch|bunch|pint|pair|kcal|roll|unit|grad|head|bolt|pile|hour|turn|se[tc]|min|rad|cal|bar|gal|deg|lot|mmg|bag|vin|pkg|vax|vw|cg|bu|ex|re|ml|in|[mμnk]s|[ok]z|f[rt]|[gy]d|p[txc]|[krcmnμ]m|[cszevhm]|[ml][。\.]t|sh[。\.]t|(?:sq|cu)[。\.](?:ft|m)|sq[。\.](?:in|yd))\b|(?:doz|gr|kg|lb|in|g|l)。?|(?:[ml][。\.]t|sh[。\.]t|g[。\.]gr)[。\.])/gi,
  /。\b(?:Txt|Jpe?g|Bmp|Png|Net|Gif|Ppt|Webp|Avi|Mkv|MP[345])\b/g,
  /\b(?:[\w-—]+@\b[\w-—]+\b(?:[。\.]\b[\w-—]+\b)+|(?:(?:https?|ftp|file)[:：]\/{2})?\b(?:[-\w]+[。\.])+(?:com|net|org|gov|top|xyz|cn|ru|me|io))\b/gi,
  ],
  at: ['：。—', ':.-'],
  lc: 'l',
},
];

/** 原 `_sp.rpHook`：按 key 的 for-in 顺序执行 at/rp/rps/lc/m* 操作 */
function rpHook(s: string, hook: EnglishHook): string {
  let out = s;
  for (const k in hook) {
    if (k === 'hit' || k === 'skip' || k === 'need') continue;
    if (k.slice(0, 2) === 'at') out = rpAtArr(out, hook.at as [string, string], '');
    else if (k === 'rp') {
      const [re, rep] = hook.rp as [RegExp, string];
      out = out.replace(re, rep);
    } else if (k === 'rps') out = rps(out, hook.rps as RpsPair[]);
  else if (k === 'lc') out = toLetterCase(out, hook.lc as string);
  else if (k.charAt(0) === 'm')
  out = matchLetterCase(out, hook[k] as RegExp, k.slice(1, 2));
}
return out;
}

/** 原 `_sp.rpHooks`：有 hit 时逐个匹配做 skip/need/纯数字过滤后执行 rpHook */
function rpHooks(s: string, hooks: EnglishHook[]): string {
  return hooks.reduce((acc, h) => {
    if (Object.prototype.hasOwnProperty.call(h, 'hit')) {
      const hits = Array.isArray(h.hit)? (h.hit as RegExp[]): [h.hit as RegExp];
      return hits.reduce(
      (a, re) =>
      a.replace(re, (m) =>
      m.search(/^\d+$/) > -1 ||
      (Object.prototype.hasOwnProperty.call(h, 'skip') &&
      m.search(h.skip as RegExp) > -1) ||
      (Object.prototype.hasOwnProperty.call(h, 'need') &&
      m.search(h.need as RegExp) < 0)
      ? m
      : rpHook(m, h),
      ),
      acc,
      );
    }
  return rpHook(acc, h);
}, s);
}

/** 内联的 conv("Letter")：全角字母 → 半角（字面量由校验脚本逐字节核对） */
/** 字面量校验用，对照 old-core-pretty.js */
export const LETTER_PAIR: [string, string] = [
"ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
];

function applyLetter(s: string): string {
  return rpAt(s, LETTER_PAIR);
}

type Lookup = (t: string) => string | undefined;
/** 原 `$English` 开头 reduce 构造的 Special/SpecialComb/Unit 查找函数 */
const lookupSpecial: Lookup = (t: string) =>
ENGLISH_TABLE.Special.split('|').find(
(e) => e.toLowerCase() === ('' + t).replace(/ +/g, '').toLowerCase(),
);
const lookupSpecialComb: Lookup = (t: string) =>
ENGLISH_TABLE.SpecialComb.split('|').find(
(e) => e.toLowerCase() === ('' + t).replace(/ +/g, '').toLowerCase(),
);
const lookupUnit: Lookup = (t: string) =>
ENGLISH_TABLE.Unit.split('|').find(
(e) => e.toLowerCase() === ('' + t).replace(/ +/g, '').toLowerCase(),
);

export const transform: Transform = {
  id: 'English',
  title: '修正英文排版',
  description:
  '英文大小写规范：缩写强制大写（NASA/CCTV）、品牌保留原形（iPhone）、单位规范（Mbps）、多余大小写统一为标题式等。',
  run(text: string): string {
    if (text.length < 2 || text.search(/[a-zA-Z]/) < 0) return text;
    let s = applyLetter(text).replace(/\b(?:[A-Z][a-z]+){3,}\b/g, (m) =>
      m.replace(/[A-Z]/g, ' $&').slice(1),
    );
    s = maskLetter(s, internalConfig.novelAuthor);
    s = maskLetter(s, /&\b[a-zA-Z][a-zA-Z1-8]{1,30}\b[;；]/g);
    s = maskLetter(s, /\b(?:(?:[A-Z][a-z]+){2,}|[a-z]+[A-Z][a-z]*)\b/g);
    s = rpHooks(s, FIX_FIRST);
    s = matchLetterCase(
      s,
      getReg('\\b(?:' + ENGLISH_TABLE.Upper + ')\\b', 'gi'),
      'u',
    );
    s = s.replace(
      getReg(
        '\\b(' + ENGLISH_TABLE.Special + ')( ?[0-9]{1,4}[a-z]{0,6})?\\b',
        'gi',
      ),
      (_m, t, n) =>
        (lookupSpecial(t) as unknown as string) +
        ((n && (n as string).toUpperCase()) || ''),
    );
    // 原实现笔误：`_english.SpeciaComb`（少了个l）恒为 undefined，
    // 实际构造出的正则字面量是 \b(?:undefined)\b；为与 fixture 行为一致原样保留
    s = s.replace(
      getReg(
        '\\b(?:' +
          String(
            (ENGLISH_TABLE as unknown as Record<string, unknown>)[
              'SpeciaComb'
            ],
          ) +
          ')\\b',
        'gi',
      ),
      (m) => lookupSpecialComb(m) as string,
    );
    s = s.replace(
      getReg(
        '\\b([0-9][0-9。\\.]{0,18} ?)?(' + ENGLISH_TABLE.Unit + ')\\b',
        'gi',
      ),
      (_m, t, n) =>
        (n as string).search(ENGLISH_TABLE.UnitTest) > -1
          ? t
            ? t + (lookupUnit(n) as unknown as string)
            : _m
          : (t || '') + (lookupUnit(n) as unknown as string),
    );
    s = s.replace(ENGLISH_TABLE.Overlap, (m, t) =>
      toLetterCase(t, 'f').repeat(~~(m.length / t.length)),
    );
    s = rpHooks(s, FIX_LAST);
    return s;
  },
};
