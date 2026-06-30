export interface LineItem {
  description: string
  price: number
}

export type FieldResult =
  | { status: 'found'; value: number }
  | { status: 'blank' }
  | { status: 'not_found' }

export interface ReceiptFields {
  subtotal: FieldResult
  totalExTax: FieldResult
  gst: FieldResult
  totalIncTax: FieldResult
  toPay: FieldResult
  tip: FieldResult
  total: FieldResult
}

export interface ParseResult {
  items: LineItem[]
  total: number | null
  subtotal: number | null
  rawLines: string[]
  excluded: string[]
  fields: ReceiptFields
}

// Module-level so detectField can access them
const priceRe = /\$?([\d,]+\.\d{2})/g
const priceOnlyRe = /^\$?[\d,]+\.\d{2}$/

/**
 * Detect a single receipt field by label regex, with lookahead.
 * - Same-line price: label and value on one line (e.g. "Subtotal $113.00")
 * - Next-line price: label then value-only line (e.g. "Subtotal:\n$113.00")
 * - Returns 'blank' if label found but no price in lookahead window
 * - Returns 'not_found' if label never appears
 */
function detectField(rawLines: string[], labelRe: RegExp, maxLook = 2): FieldResult {
  for (let i = 0; i < rawLines.length; i++) {
    if (!labelRe.test(rawLines[i])) continue

    // Check same line for a price
    const samePrices = [...rawLines[i].matchAll(priceRe)]
    if (samePrices.length > 0) {
      const amt = parseFloat(samePrices[samePrices.length - 1][1].replace(',', ''))
      if (!isNaN(amt)) return { status: 'found', value: amt }
    }

    // Look ahead for a price-only line (no intervening text lines)
    for (let j = i + 1; j <= Math.min(i + maxLook, rawLines.length - 1); j++) {
      if (priceOnlyRe.test(rawLines[j])) {
        const amt = parseFloat(rawLines[j].replace(/[$,]/g, ''))
        if (!isNaN(amt)) return { status: 'found', value: amt }
      }
      // Any real text line between label and value means the value is absent
      if (rawLines[j].length > 3) break
    }

    return { status: 'blank' }
  }
  return { status: 'not_found' }
}

function fieldValue(f: FieldResult): number | null {
  return f.status === 'found' ? f.value : null
}

export function parseReceiptText(text: string): ParseResult {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: LineItem[] = []
  const excluded: string[] = []

  // Quantity prefix at line start
  const qtyXRe = /^(\d+)\s*[xX×]\s+/
  const qtyWordRe = /^(\d+)\s+(?=[A-Za-z])/

  // Lines that are never item descriptions.
  const skipRe = /total|subtotal|gst|tax|inc\b|cash|eftpos|change|invoice|table\b|order\b|served|powered|www\.|receipt|@|\bcard\b|\btip\b|prices shown|abn\b|\bmethod\b|balance|surcharge/i

  const junkRe = /^[\d\s\W]{0,6}$/

  // ── Determine item zone ──────────────────────────────────────────────────────
  // Only parse lines between the "Description" header and the first "Subtotal" line.
  const descHeaderRe = /^description\b/i
  const subtotalLineRe = /\bsubtotal\b/i

  let zoneStart = 0
  let zoneEnd = rawLines.length

  for (let i = 0; i < rawLines.length; i++) {
    if (descHeaderRe.test(rawLines[i])) { zoneStart = i + 1; break }
  }
  for (let i = 0; i < rawLines.length; i++) {
    if (subtotalLineRe.test(rawLines[i])) { zoneEnd = i; break }
  }

  const itemLines = rawLines.slice(zoneStart, zoneEnd)

  // ── Parse line items (zone only) ─────────────────────────────────────────────

  function pushItem(descRaw: string, price: number) {
    const qtyXMatch = descRaw.match(qtyXRe)
    const qtyWordMatch = !qtyXMatch ? descRaw.match(qtyWordRe) : null

    if (qtyXMatch) {
      const qty = parseInt(qtyXMatch[1], 10)
      const desc = descRaw.slice(qtyXMatch[0].length).trim()
      if (desc.length < 2) return
      const unitPrice = Math.round((price / qty) * 100) / 100
      for (let i = 0; i < qty; i++) items.push({ description: desc, price: unitPrice })
    } else if (qtyWordMatch) {
      const qty = parseInt(qtyWordMatch[1], 10)
      const desc = descRaw.slice(qtyWordMatch[0].length).trim()
      if (desc.length < 2) return
      const unitPrice = Math.round((price / qty) * 100) / 100
      for (let i = 0; i < qty; i++) items.push({ description: desc, price: unitPrice })
    } else {
      items.push({ description: descRaw, price })
    }
  }

  const skipIndex = new Set<number>()

  for (let i = 0; i < itemLines.length; i++) {
    if (skipIndex.has(i)) continue

    const line = itemLines[i]

    if (line.length < 3) continue
    if (junkRe.test(line)) continue
    if (skipRe.test(line)) { excluded.push(line); continue }

    // Strategy 1: price on the next line only (e.g. "Pasta Quattro Formaggi\n$27.90")
    const nextLine = itemLines[i + 1] ?? ''
    if (priceOnlyRe.test(nextLine) && !skipRe.test(nextLine)) {
      const price = parseFloat(nextLine.replace('$', '').replace(',', ''))
      if (!isNaN(price) && price > 0) {
        const ownPrices = [...line.matchAll(priceRe)]
        if (ownPrices.length === 0) {
          skipIndex.add(i + 1)
          pushItem(line, price)
          continue
        }
      }
    }

    // Strategy 2: price on the same line
    const allPrices = [...line.matchAll(priceRe)]
    if (allPrices.length === 0) continue

    const lastMatch = allPrices[allPrices.length - 1]
    const price = parseFloat(lastMatch[1].replace(',', ''))
    if (isNaN(price) || price <= 0) continue

    const descRaw = line.slice(0, lastMatch.index).trim().replace(/[\s\-–:]+$/, '').trim()
    if (descRaw.length < 3) continue

    pushItem(descRaw, price)
  }

  // ── Detect receipt fields (all rawLines, with same-line + lookahead) ─────────

  const fields: ReceiptFields = {
    subtotal:    detectField(rawLines, /\bsubtotal\b/i),
    totalExTax:  detectField(rawLines, /\btotal\b.*\bex(?:cl(?:uding)?)?\b/i),
    gst:         detectField(rawLines, /^\s*gst\b/i),
    totalIncTax: detectField(rawLines, /\btotal\b.*\binc(?:l(?:uding)?)?\b/i),
    toPay:       detectField(rawLines, /\bto\s*pay\b|\bamount\s+due\b|\bamount\s+payable\b|\bbalance\s+due\b/i),
    tip:         detectField(rawLines, /^\s*tip\b/i),
    total:       detectField(rawLines, /^\s*total\s*:?\s*$/i),
  }

  // Backward-compatible derived values
  const subtotal = fieldValue(fields.subtotal) ?? fieldValue(fields.totalExTax) ?? null
  const total = fieldValue(fields.totalIncTax) ?? fieldValue(fields.toPay) ?? fieldValue(fields.total) ?? null

  // ── Infer tip from totals difference (never from a blank Tip: label) ─────────

  if (subtotal !== null && total !== null) {
    const impliedTip = Math.round((total - subtotal) * 100) / 100
    if (impliedTip > 0.02) {
      items.push({ description: 'Tip', price: impliedTip })
    }
  } else if (total !== null) {
    const sum = Math.round(items.reduce((s, item) => s + item.price, 0) * 100) / 100
    const impliedTip = Math.round((total - sum) * 100) / 100
    if (impliedTip > 0.02) {
      items.push({ description: 'Tip', price: impliedTip })
    }
  }

  return { items, total, subtotal, rawLines, excluded, fields }
}
