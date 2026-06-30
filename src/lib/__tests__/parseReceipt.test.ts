import { describe, it, expect } from 'vitest'
import { parseReceiptText } from '../parseReceipt'

describe('parseReceiptText — item zone restriction', () => {
  it('produces exactly 5 items and no phantom 6th from footer or blank fields', () => {
    // 5 items summing to $113.00, Subtotal $113.00, Total Inc Tax $113.00,
    // blank Tip:, blank Total:, footer "Prices shown in AUD"
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

    const { items, total, subtotal, fields } = parseReceiptText(text)

    expect(items, 'exactly 5 food items — no phantom from footer or blank fields').toHaveLength(5)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'no tip item when totals match').toHaveLength(0)

    const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100
    expect(sum, 'items sum to $113.00').toBe(113.00)

    expect(subtotal, 'subtotal extracted from receipt').toBe(113.00)
    expect(total, 'total extracted from receipt').toBe(113.00)

    expect(fields.subtotal).toEqual({ status: 'found', value: 113 })
    expect(fields.totalIncTax).toEqual({ status: 'found', value: 113 })
    expect(fields.tip).toEqual({ status: 'blank' })
    expect(fields.total).toEqual({ status: 'blank' })
    expect(fields.gst.status).toBe('not_found')
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

    const { items, subtotal, fields } = parseReceiptText(text)

    const tipItems = items.filter(i => /tip/i.test(i.description))
    expect(tipItems, 'one tip item inferred from total difference').toHaveLength(1)
    expect(tipItems[0].price, 'tip = $57.50 - $50.00').toBe(7.50)
    expect(subtotal, 'subtotal detected').toBe(50.00)
    expect(fields.tip).toEqual({ status: 'blank' })
    expect(fields.totalIncTax).toEqual({ status: 'found', value: 57.50 })
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

  it('detects Subtotal and Total Inc Tax when label and value are on separate lines', () => {
    // OCR often splits label and value across two lines
    const text = [
      'My Restaurant',
      '',
      'Description    Amount',
      'Burger         $22.00',
      'Pasta          $28.00',
      '',
      'Subtotal:',
      '$50.00',
      'Tip:',
      'Total Inc Tax:',
      '$50.00',
    ].join('\n')

    const { items, subtotal, total, fields } = parseReceiptText(text)

    expect(fields.subtotal).toEqual({ status: 'found', value: 50 })
    expect(fields.totalIncTax).toEqual({ status: 'found', value: 50 })
    expect(fields.tip).toEqual({ status: 'blank' })
    expect(subtotal, 'subtotal from separate-line detection').toBe(50)
    expect(total, 'total from separate-line detection').toBe(50)
    expect(items).toHaveLength(2)
  })
})
