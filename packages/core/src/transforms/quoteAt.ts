/**
 * `$Quote/$ESQuote/$CNQuote` 三个方法在原实现里共享同一个闭包对象
 * `((e) => {...})({ at: [...], rps: [...] })` 中的 `at` 表。
 *
 * 注意原实现的细节：`$CNQuote` 调的是 `e.at.reverse()`——**原地**反转共享数组。
 * 因此连续两次调用 `$CNQuote` 时第二次会用回未反转的表（原实现的 quirk，
 * fixture 也是按此行为生成的）。这里用模块级可变数组原样保留该语义：
 * - `$ESQuote` 用原序：『→‘ 』→’ 「→“ 」→”
 * - `$CNQuote` 每次调用先反转再用：‘→『 ’→』 “→「 ”→」
 */
export const quoteAt: [string, string] = ['『』「」', '‘’“”'];
