export interface LineItem {
  description: string
  price: number
}

export function parseReceiptText(text: string): { items: LineItem[]; total: number | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: LineItem[] = []
  let total: number | null = null

  // Any dollar amount anywhere in a line
  const priceRe = /\$?([\d,]+\.\d{2})/g
  // A line that is *only* a price — nothing else (e.g. "$27.90" or "27.90")
  const priceOnlyRe = /^\$?[\d,]+\.\d{2}$/
  // Quantity prefix at line start: "2x ", "2 x ", "2× ", "2 Flat White"
  const qtyXRe = /^(\d+)\s*[xX×]\s+/
  const qtyWordRe = /^(\d+)\s+(?=[A-Za-z])/
  // Skip lines containing any of these keywords anywhere.
  // \btip\b: receipts often print a blank "Tip:" line for the customer to fill in;
  // skipping it prevents Strategy 1 from mistakenly pairing it with the next price line.
  const skipRe = /total|subtotal|gst|tax|inc\b|cash|eftpos|change|invoice|table\b|order\b|served|powered|www\.|receipt|@|\bcard\b|\btip\b/i
  // Lines that are just numbers, punctuation, or very short
  const junkRe = /^[\d\s\W]{0,6}$/

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

  for (let i = 0; i < lines.length; i++) {
    if (skipIndex.has(i)) continue

    const line = lines[i]

    if (line.length < 3) continue
    if (junkRe.test(line)) continue
    if (skipRe.test(line)) continue

    // Strategy 1: price on the next line only (e.g. "1 Pasta Quattro Formaggi\n$27.90")
    const nextLine = lines[i + 1] ?? ''
    if (priceOnlyRe.test(nextLine) && !skipRe.test(nextLine)) {
      const price = parseFloat(nextLine.replace('$', '').replace(',', ''))
      if (!isNaN(price) && price > 0) {
        // Make sure current line has no price of its own (avoid double-counting)
        const ownPrices = [...line.matchAll(priceRe)]
        if (ownPrices.length === 0) {
          skipIndex.add(i + 1)
          pushItem(line, price)
          continue
        }
      }
    }

    // Strategy 2: price on the same line (original behaviour)
    const allPrices = [...line.matchAll(priceRe)]
    if (allPrices.length === 0) continue

    const lastMatch = allPrices[allPrices.length - 1]
    const price = parseFloat(lastMatch[1].replace(',', ''))
    if (isNaN(price) || price <= 0) continue

    const descRaw = line.slice(0, lastMatch.index).trim().replace(/[\s\-–:]+$/, '').trim()
    if (descRaw.length < 3) continue

    pushItem(descRaw, price)
  }

  // Extract subtotal separately (used for tip inference below)
  let subtotal: number | null = null
  const subtotalLineRe = /subtotal/i
  for (const line of lines) {
    if (!subtotalLineRe.test(line)) continue
    const prices = [...line.matchAll(priceRe)]
    if (!prices.length) continue
    const amt = parseFloat(prices[prices.length - 1][1].replace(',', ''))
    if (!isNaN(amt) && amt > 0) { subtotal = amt; break }
  }

  // Extract total: find the largest price on a line containing "total", "amount due", etc.
  const totalRe = /total|amount due|amount payable|balance due|to pay/i
  for (const line of lines) {
    if (!totalRe.test(line)) continue
    const prices = [...line.matchAll(priceRe)]
    if (!prices.length) continue
    const amt = parseFloat(prices[prices.length - 1][1].replace(',', ''))
    if (!isNaN(amt) && amt > 0 && (total === null || amt > total)) total = amt
  }

  // Infer a tip only from the difference between printed receipt totals.
  // A blank "Tip:" label (with no adjacent price) is not treated as a tip.
  if (subtotal !== null && total !== null) {
    const impliedTip = Math.round((total - subtotal) * 100) / 100
    if (impliedTip > 0.02) {
      items.push({ description: 'Tip', price: impliedTip })
    }
  } else if (total !== null) {
    // No subtotal line: fall back to comparing parsed item sum to total
    const sum = Math.round(items.reduce((s, item) => s + item.price, 0) * 100) / 100
    const impliedTip = Math.round((total - sum) * 100) / 100
    if (impliedTip > 0.02) {
      items.push({ description: 'Tip', price: impliedTip })
    }
  }

  return { items, total }
}
