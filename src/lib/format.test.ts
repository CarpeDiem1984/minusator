import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber } from './format'

describe('format', () => {
  it('числа с пробелами между тысячами', () => {
    expect(formatNumber(1520)).toBe('1 520')
    expect(formatNumber(2.5)).toBe('2,5')
    expect(formatNumber(0)).toBe('0')
  })
  it('деньги с копейками и знаком рубля', () => {
    expect(formatMoney(6725.4)).toBe('6 725,40 ₽')
    expect(formatMoney(95)).toBe('95,00 ₽')
  })
})
