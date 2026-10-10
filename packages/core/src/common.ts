/**
* common：正则片段表 + 占位符展开工具。
*
* 照抄 old-core-pretty.js 开头的 `common` 对象。注意这些值是**转义后的正则片段
* 字符串**（如 "\\x00-\\x09..."），搬运时保持原样，不要"修正"转义。
*
* commFmt / commReg 定义在这里而不是 utils.ts：它们只依赖 common，
* 放在这里可以避免 config.ts ↔ utils.ts 的循环依赖。
* 下游从包根 `import { commFmt, commReg} from '@typeset/core'` 即可。
*/
export const common = {
space:
"\\x00-\\x09\\x0b\\x0c\\x0e-\\x20\\xa0\\x7f\\u1680\\u180e\\u2000-\\u200f\\u2028-\\u202f\\u205f-\\u2064\\u3000\\ue004\\ue07b\\ue11a\\ue1d5\\ue4c6\\uee21\\uf604\\uf04a\\uf8f5\\ufe0f\\ufeff",
han: "⺀-⻿⼀-⿟぀-ゟ゠-ヺー-ヿ㄀-ㄯ㇀-㇣㈀-㋿㐀-䶿一-鿿豈-﫿",
latin: "À-ÖØ-öø-ÿĀ-ſƀ-ɏḀ-ỿⱠ-ⱿꜢ-ꜧꜫ-ꟿꬰ-ꭩ",
hwPun: "!-/:-@[-`{-~¡-¿",
fwPun: "·–—―…※、。〈〉《》【】〔〕〖〗〝〞・！-／：-＠～￠-￥",
qfwPun: "‘’“”「」『』",
ofwPun: "°％‰‱℃℉%",
enSep: "'`＇‘’『』",
mw: "哟啊哈哦呵呀啦吧嗯哼咦呜喂啪喔嘿呃哎唷唔咛呦唰啧吡喏呸咳呼嗖咯吱咕啐碰哗啵嗞嘞噶咂呓嗬吇嗵扑哧噗呲嗤呛嘶嗝呱嘟咿叽笃喳嘎嘀哩嘤唧咪喵哞嗷呯砰哄嚯叮咚哐咝噼嘭咣咔咹嚓嗡恩耶咻吖轰隆汪驾呔啜雪哺嗫铮汩滴答诶蛤嗐刷嗒咵蹬铿溜滋歘霹喲嗚嚀嘖譁囈撲嗆嘰篤嚶噝轟駕囁錚誒鏗",
sf: "☠",
} as const;

/**
* 原 `_sp.commFmt`：把字符串里的 `{$xxx}` 占位替换为 common 表对应片段，
* 找不到的占位保持原样。
*/
export function commFmt(s: string): string {
const table = common as unknown as Record<string, string>;
return s.replace(/\{\$\w+\}/g, (e) => table[e.slice(2, -1)] || e);
}

/**
* 原 `_sp.commReg`：先 commFmt 展开占位，再 new RegExp。
* flags 为 "" 时传 ""，缺省为 "g"。
*/
export function commReg(pattern: string, flags?: string): RegExp {
return new RegExp(commFmt(pattern), flags === ""? "": flags || "g");
}
