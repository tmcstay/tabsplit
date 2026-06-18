import { NextRequest, NextResponse } from 'next/server'

interface LineItem {
  description: string
  price: number
}

function parseReceiptText(text: string): { items: LineItem[]; total: number | null } {
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
  // Skip lines containing any of these keywords anywhere
  const skipRe = /total|subtotal|gst|tax|inc\b|cash|eftpos|change|invoice|table\b|order\b|served|powered|www\.|receipt|@|\bcard\b/i
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

  // Extract total separately: find the largest price on a line containing "total"
  const totalRe = /total|amount due|amount payable|balance due/i
  for (const line of lines) {
    if (!totalRe.test(line)) continue
    const prices = [...line.matchAll(priceRe)]
    if (!prices.length) continue
    const amt = parseFloat(prices[prices.length - 1][1].replace(',', ''))
    if (!isNaN(amt) && amt > 0 && (total === null || amt > total)) total = amt
  }

  return { items, total }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    console.error('OCR: GOOGLE_VISION_API_KEY is missing or empty')
    return NextResponse.json(
      { error: 'Google Vision API key not configured', detail: 'GOOGLE_VISION_API_KEY environment variable is missing or empty' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const imageBase64: string | undefined = body?.image
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided.', detail: 'Request body must be JSON with an "image" field containing a base64-encoded image.' }, { status: 400 })
  }

  let visionRes: Response
  try {
    visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    )
  } catch (err) {
    console.error('OCR: fetch to Vision API failed:', err)
    return NextResponse.json(
      { error: 'OCR service unreachable.', detail: String(err) },
      { status: 502 }
    )
  }

  if (!visionRes.ok) {
    const detail = await visionRes.text()
    console.error(`OCR: Vision API returned HTTP ${visionRes.status} ${visionRes.statusText}:`, detail)
    return NextResponse.json(
      { error: 'Vision API request failed.', visionStatus: visionRes.status, visionStatusText: visionRes.statusText, detail },
      { status: 502 }
    )
  }

  const visionData = await visionRes.json()
  const block = visionData.responses?.[0]

  if (block?.error) {
    console.error('OCR: Vision API response error:', block.error)
    return NextResponse.json(
      { error: 'Vision API returned an error.', detail: block.error.message },
      { status: 422 }
    )
  }

  const text: string = block?.fullTextAnnotation?.text ?? ''
  if (!text) {
    console.warn('OCR: Vision API returned no text. Full response:', JSON.stringify(visionData))
  }

  const { items, total } = parseReceiptText(text)

  return NextResponse.json({ items, total, rawText: text })
}
