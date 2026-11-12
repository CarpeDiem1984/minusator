const intFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const moneyFmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Обычные пробелы вместо неразрывных — чтобы одинаково выглядело и копировалось. */
const plain = (s: string) => s.replace(/[  ]/g, ' ')

/** 1520 → «1 520»; 2.5 → «2,5» */
export function formatNumber(n: number): string {
  return plain(Number.isInteger(n) ? intFmt.format(n) : numFmt.format(n))
}

/** 6725.4 → «6 725,40 ₽» */
export function formatMoney(n: number): string {
  return `${plain(moneyFmt.format(n))} ₽`
}
