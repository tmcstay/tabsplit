export interface LineItem {
  description: string
  price: number
}

export interface ParseResult {
  items: LineItem[]
  total: number | null
  subtotal: number | null
  rawLines: string[]
  excluded: string[]
}

export function parseReceiptText(text: string): ParseResult {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: LineItem[] = []
  let total: number | null = null
  let subtotal: number | null = null
  const excluded: string[] = []

  // Any dollar amount anywhere in a line
  const priceRe = /\$?([\d,]+\.\d{2})/g
  // A line that is *only* a price — nothing else
  const priceOnlyRe = /^\$?[\d,]+\.\d{2}$/
  // Quantity prefix at line start
  const qtyXRe = /^(\d+)\s*[xX×]\s+/
  const qtyWordRe = /^(\d+)\s+(?=[A-Za-z])/

  // Lines that are never item descriptions.
  // \btip\b prevents the customer-fillable tip line from borrowing a price.
  const skipRe = /total|subtotal|gst|tax|inc\b|cash|eftpos|change|invoice|table\b|order\b|served|powered|www\.|receipt|@|\bcard\b|\btip\b|prices shown|abn\b|\bmethod\b|balance|surcharge/i

  const junkRe = /^[\d\s\W]{0,6}$/

  // ── Determine item zone ──────────────────────────────────────────────────────
  // Only parse lines that appear between the "Description" header and the first
  // "Subtotal" line.  Nothing below Subtotal is ever a line item.
  const descHeaderRe = /^description\b/i
  const subtotalLineRe = /\bsubtotal\b/i

  let zoneStart = 0     // first line to consider (inclusive)
  let zoneEnd = rawLines.length  // last line to consider (exclusive)

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

  // ── Extract subtotal and total (search all rawLines) ─────────────────────────

  for (const line of rawLines) {
    if (!subtotalLineRe.test(line)) continue
    const prices = [...line.matchAll(priceRe)]
    if (!prices.length) continue
    const amt = parseFloat(prices[prices.length - 1][1].replace(',', ''))
    if (!isNaN(amt) && amt > 0) { subtotal = amt; break }
  }

  const totalRe = /total|amount due|amount payable|balance due|to pay/i
  for (const line of rawLines) {
    if (!totalRe.test(line)) continue
    const prices = [...line.matchAll(priceRe)]
    if (!prices.length) continue
    const amt = parseFloat(prices[prices.length - 1][1].replace(',', ''))
    if (!isNaN(amt) && amt > 0 && (total === null || amt > total)) total = amt
  }

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

  return { items, total, subtotal, rawLines, excluded }
}
