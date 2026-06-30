import { describe, it, expect } from 'vitest'
import { parseReceiptText } from '../parseReceipt'

describe('parseReceiptText — item zone restriction', () => {
  it('produces exactly 5 items and no phantom 6th from footer or blank fields', () => {
    // Exact receipt from the bug report:
    // 5 items summing to $113.00, Subtotal $113.00, Total Inc Tax $113.00,
    // blank Tip:, blank Total:, footer "Prices shown in AUD"
    // Bug: "Prices shown in AUD" was being paired with the adjacent $113.00 via
    // Strategy 1, producing a phantom line item.
    const text = [
      'My Restaurant',
      'ABN 12 345 678 901',
      '',
      'Description          Amount',
      'Burger               $22.00',
      'Pasta                $28.00',
      'Pizza                $25.00',
      'Salad                $18.00',
      'Dessert              $20.00',
      '',
      'Subtotal             $113.00',
      'Tip:',
      'Total:',
      'Total Inc Tax        $113.00',
      'Prices shown in AUD',
    ].join('\n')

    const { items, total, subtotal } = parseReceiptText(text)

    expect(items, 'exactly 5 food items — no phantom from footer or blank fields').toHaveLength(5)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'no tip item when totals match').toHaveLength(0)

    const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100
    expect(sum, 'items sum to $113.00').toBe(113.00)

    expect(subtotal, 'subtotal extracted from receipt').toBe(113.00)
    expect(total, 'total extracted from receipt').toBe(113.00)
  })

  it('creates a Tip item equal to Total Inc Tax minus Subtotal when they differ', () => {
    const text = [
      'My Restaurant',
      '',
      'Description    Amount',
      'Burger         $22.00',
      'Pasta          $28.00',
      '',
      'Subtotal       $50.00',
      'Tip:',
      'Total Inc Tax  $57.50',
    ].join('\n')

    const { items, subtotal } = parseReceiptText(text)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'one tip item inferred from total difference').toHaveLength(1)
    expect(tipItems[0].price, 'tip = $57.50 - $50.00').toBe(7.50)
    expect(subtotal, 'subtotal detected').toBe(50.00)
  })

  it('does not parse lines below Subtotal as items even without Description header', () => {
    const text = [
      'Some Cafe',
      'Flat White         $5.50',
      'Avocado Toast     $18.00',
      'Subtotal          $23.50',
      'Prices shown in AUD',
      'GST included',
      'Total Inc Tax     $23.50',
    ].join('\n')

    const { items } = parseReceiptText(text)

    const phantom = items.find(i => /prices|gst/i.test(i.description))
    expect(phantom, 'no phantom footer items').toBeUndefined()
    expect(items).toHaveLength(2)
  })
})
