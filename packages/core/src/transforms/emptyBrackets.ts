import type { Transform} from '../types';

/**
* EmptyBrackets：删除空括号（新增规则，默认关闭）。
*
* 场景：OCR 或网页复制产生的 `（）`、`""` 等空括号对，多为排版噪音。
* 只删完全为空的成对括号，不碰有内容的。
*/
const EMPTY_PAIRS = /（）|\(\)|「」|『』|【】|“”|''|""|〈〉|＜＞|〔〕/g;

export const transform: Transform = {
id: 'EmptyBrackets',
title: '删除空括号',
description: '删除内容为空的成对括号：（）()「」『』"" 等（默认关闭，需手动开启）',
run(text) {
return text.replace(EMPTY_PAIRS, '');
},
};
