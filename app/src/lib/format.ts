/** Zeta準拠の数値表記: 1万以上は「6.2万」形式に省略 */
export function fmtCount(n: number): string {
  if (n >= 10_000) {
    const man = n / 10_000;
    return `${man >= 10 ? Math.round(man) : Math.round(man * 10) / 10}万`;
  }
  return n.toLocaleString();
}

export function fmtDateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
