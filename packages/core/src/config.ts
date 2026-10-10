/**
* 引擎内部配置：照搬 old-core-pretty.js 的 `config` 对象 + 章节模板表。
*
* - `internalConfig`：Separator / Linenum / maxLinenum / endStrs / novelTitle /
* novelAuthor / nSeparator / enSep / rCoord。enSep、rCoord 用 commReg 复刻原文件
* 的动态构建过程（先 commFmt 展开 `{$xxx}` 再 new RegExp）。
* - `chapterCommon` / `chapterModel`：原 `chap.common` / `chap.model` 章节正则模板表，
* 供 utils.ts 的 chapFlag / chapReg / chapSafety 使用。
* 注意：原 `$Chapter` 在 safe 模式下会改写 `chap.model.t2 = chap.model.t21`，
* 因此 chapterModel 保持可变（不要 freeze），由 Chapter transform 按原语义处理。
*/
import { commFmt, commReg} from './common';
import { defaultConfig} from './types';
import type { RunContext, TypesetConfig} from './types';

export interface InternalConfig {
separator: string;
textSeparator: string;
divide: string;
linenum: number;
maxLinenum: number;
endStrs: RegExp;
novelTitle: RegExp;
novelAuthor: RegExp;
/** 正则源码字符串（原 config.nSeparator） */
nSeparator: string;
enSep: RegExp;
rCoord: RegExp;
}

export const internalConfig: InternalConfig = {
separator: '＊＊＊　　＊＊＊　　＊＊＊',
textSeparator: '＊'.repeat(35),
divide: '：',
linenum: 35,
maxLinenum: 200,
endStrs:
/^[（【“「<]?(?:未完待[续續]|未完|待[续續]|完[结結]|全[文书書][完终終]|[完终終])[）】”」>]?$/gm,
novelTitle:
/^[ 　]*(《([^》\n]+)》(.*[^。？！…\n]|$)|[书書]名[：\:](.+))$/m,
novelAuthor:
/^[ 　]*((?:作者|[续續改][写寫]|排[版编]|[精一二点點]校|作家|整理|改编|[编編译譯著]者|[编辑編輯][录錄]|著作?|翻[译譯]|勘[误誤校]|校[正证注订訂对對笺箋]|[笺箋][正证校注订訂])[：\:].*)$/gm,
nSeparator:
'^(?:' + '＊＊＊　　＊＊＊　　＊＊＊'.replace(/[ 　]+/g, '[ 　]*') + ')$',
enSep: commReg("\\b[a-zA-Z]+\\b[{$enSep}](?: |\\b[a-zA-Z]+\\b)?", 'g'),
rCoord: commReg(
"\\b(?:\\d{1,3}(?:[.。]\\d{1,2})?[{$qfwPun}\\x22\\x27°]){2}",
'g',
),
};

/** 原 `chap.common`：章节模板里的 `{$xxx}` 占位表（第二遍 fmt 用它展开）。 */
export const chapterCommon: Record<string, string | string[]> = {
  sep: "： 　，、．·。—.,:|-",
  en: "{0,280}",
  b: ["〖【\\[", "\\]】〗"],
  ct: "章",
  c: ["卷部", "集篇季册冊辑輯", "章折回幕节節话話"],
  ca: ["部分", "章[节節]|段落|[单單]元|[段场場阙闕]"],
  n: ["0-9", "０-９", "零一二三四五六七八九十"],
  nc: "上中下续终續終",
  ss: "[（\\(]?[0-9０-９一二三四五六七八九十上中下续终續終]{0,3}[）\\)]?",
  sw: "[0-9]{1,2}|[零一二三四五六七八九十]{1,3}",
  nh: "[0-9]{1,5}(?:[-—.][0-9]{1,5})?",
  n0: "[0-9]{1,5}",
  n1: "[0-9０-９]{1,5}",
  n2: "[0-9０-９]{1,5}(?:[-—.][0-9０-９]{1,5})?",
  n3: "[0０○〇零一二三四五六七八九十百千壹贰叁肆伍陆柒捌玖拾佰仟两廿卅卌貳叄陸兩]{1,7}",
  n4: "最[初终尾終]|[上下]半|[序初前始后终首末尾後終]之?|[上中下续断开續斷開]",
  w0: "[简簡自]介|自述|介[绍紹]|[预預]告|相[关關]",
  w1: "[作译譯编編著]者",
  w2: "(?:完[结結]|[完终終])",
  w3: "[☆★○●◎◇◆□■△▲※＃#]",
};

/** 原 `chap.model`：章节正则模板（第一遍 fmt 用它展开 `{$t0}` 等）。 */
export const chapterModel: Record<string, string | string[]> = {
  f: commFmt("[{$space}]*"),
  s: "[{$sep}]{1,4}",
  sn: "[{$sep}]{0,4}",
  sz: "[{$sep}之]{1,4}",
  e: ".{$en}[^。：;；\\n]",
  es: ".{$en}[^，。：;；、…？！’”』」\\n]",
  ez: ".{1,40}",
  t0: "正文|文[案按]|[题題][注记註記跋]|[题題开開][卷篇头场頭場][诗词语詩詞語]|{$w1}(?:[案按]|寄[语語]|[前感]言|[后後的][话話])|[卷篇][首后後][语語]?|完[本结結]感言|[開开][場场]白|[脚标批附腳標][注註]|[注註][释解釋]|[导導][读讀语語]|[绪緒弁][言论論]|寄[语語]|[提总總梗]要|梗概|素材|目[录錄]|[大细总提細總][纲綱]|{$w0}|(?:小[说說]|作[品者]|主要人物|人物|[内內]容|本书|[全本下][{$c.0}{$c.1}])(?:{$w0})",
  t1: [
      "序篇章|首部曲|{$w1}序|[续續外][{$n}]?[{$c.2}]|(?:序章?|前[言记記]|尾[声聲]|[后後][记記]|楔子|引[子言文]|序[言论論文目曲传傳跋]|附[录錄]|[绪緒弁][言论論]|[后後][话話序语語]|附[记記语語]|尾[记記跋]|跋[尾文语語]|[首小节自次总代節總简原]序|大?[结結]局|终[章曲]|序幕|间幕|幕间|最终[话回]|[上下中]部|其[{$n}]{1,3}){$ss}",
      "(?:同人[续續]?|[前后外续正後續间間转轉别][传篇傳章]|完[结結]篇|特[别別]篇|[前后外里裏]番|[番篇]外[篇卷章语語]?){$ss}",
    ],
  t2: "((?:第?{$n2}|第?{$n3}|{$n4})(?:{$ca.0}|{$ca.1}|[{$c}]))",
  t3: "([\\(（〔](?:{$n2}|{$n3}|[{$nc}])[\\)）〕])",
  t4: "([折卷册冊段节節])({$n1}|{$n3})",
  t5: "(?:\\b(?:chapter|section|chap|ch|part)\\b|\\bno\\.|{$w3})[ \\.]*({$n1})",
  t6: "({$n2}|{$n3})",
  t20: "((?:{$n2}|{$n3}|{$n4})(?:{$ca.0}|{$ca.1}|[{$c}]))",
  t21: "((?:第{$n2}|第{$n3}|{$n4})(?:{$ca.0}|{$ca.1}|[{$c}]))",
  t80: "[\\[\\(（〖【〈［〔]({$n2}|{$n3})[\\]\\)）〗】〉］〕]",
  t81: "[\\[\\(（〖【〈［〔]((?:第?{$n2}|第?{$n3}|{$n4})[{$c}])[\\]\\)）〗】〉］〕]",
  t90: "(?:第?{$n2}|第?{$n3}|{$n4})",
  t91: "(?:第{$n2}|第{$n3}|{$n4})",
  ts: "[第\\(（][{$n.0}{$n.1}\\- 　]{3,12}[{$c}\\）)]",
};

export interface ResolvedConfig extends TypesetConfig {
maxLinenum: number;
}

/**
* 把用户配置（ctx.config）与引擎内部配置合并：
* linenum 默认 35，下限 1，上限 internalConfig.maxLinenum（200）。
*/
export function resolveConfig(ctx?: Partial<RunContext>): ResolvedConfig {
const c: TypesetConfig = ctx?.config?? defaultConfig;
const raw = Math.floor(Number(c.linenum));
const linenum = Math.min(
Math.max(Number.isFinite(raw)? raw: internalConfig.linenum, 1),
internalConfig.maxLinenum,
);
return {...c, linenum, maxLinenum: internalConfig.maxLinenum};
}
