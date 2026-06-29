import { describe, it, expect } from 'vitest'
import { parseReceiptText } from '../parseReceipt'

describe('parseReceiptText — blank Tip line bug', () => {
  it('does not create a Tip item when Tip: is blank and Subtotal equals Total Inc Tax', () => {
    // Fixture: 5 items summing to $113.00, Subtotal $113.00, blank Tip:, Total Inc Tax $113.00
    // Bug: the parser was pairing "Tip:" with the next nearby price via Strategy 1,
    // incorrectly creating a $113.00 tip line item.
    const text = [
      'My Restaurant',
      'Table 5',
      '',
      'Burger           $22.00',
      'Pasta            $28.00',
      'Pizza            $25.00',
      'Salad            $18.00',
      'Dessert          $20.00',
      '',
      'Subtotal         $113.00',
      'Tip:',
      'Total Inc Tax    $113.00',
    ].join('\n')

    const { items, total } = parseReceiptText(text)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'no tip item should be created when totals match').toHaveLength(0)

    expect(items, '5 food items only').toHaveLength(5)

    const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100
    expect(sum, 'items sum to $113.00').toBe(113.00)

    expect(total, 'total extracted from receipt').toBe(113.00)
  })

  it('creates a Tip item equal to Total Inc Tax minus Subtotal when they differ', () => {
    const text = [
      'My Restaurant',
      '',
      'Burger           $22.00',
      'Pasta            $28.00',
      '',
      'Subtotal         $50.00',
      'Tip:',
      'Total Inc Tax    $57.50',
    ].join('\n')

    const { items } = parseReceiptText(text)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'one tip item inferred from total difference').toHaveLength(1)
    expect(tipItems[0].price, 'tip = $57.50 - $50.00').toBe(7.50)
  })
})
