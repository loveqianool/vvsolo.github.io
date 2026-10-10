import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import { transform } from '../src/transforms/finish';

/**
 * 回归：safetyAfter 里引号规范化的字符组必须是 [^”"，\n]，
 * 其中 。 为 U+3002（原实现如此）。曾因转录漏掉 。 导致
 * 直引号内含 。 时被错误转成弯引号——24 组 fixture 恰好没覆盖，
 * 靠本文件锁定。期望值由旧引擎 $Finish 实测得到。
 *
 * 注意：必须用直引号 " 输入才能触发差异（弯引号输入下替换是幂等的）。
 */
describe('Finish regression: U+3002 in quote class', () => {
  const cases: Array<[string, string]> = [
    // 。 阻断匹配：保持直引号不变（漏 。 的版本会错误转成弯引号）
    ['say "a。b" ok', 'say "a。b" ok'],
    // 无 。 时正常规范化为弯引号
    ['say "ab" ok', 'say “ab” ok'],
    // 半角逗号不在排除组里，照常规范化
    ['say "a,b" ok', 'say “a,b” ok'],
  ];
  for (const [input, expected] of cases) {
    it(JSON.stringify(input), () => {
      expect(transform.run(input, [], { config: defaultConfig })).toBe(expected);
    });
  }
});
