import { NextRequest, NextResponse } from 'next/server'

interface LineItem {
  description: string
  price: number
}

function parseReceiptText(text: string): { items: LineItem[]; total: number | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: LineItem[] = []
  let total: number | null = null

  // Price at end of line: optional $, optional space, digits, dot, 2 digits
  const priceRe = /\$?\s*([\d,]+\.\d{2})\s*$/
  // Quantity prefix: "2x ", "2 x ", "2× ", "2 X "
  const qtyRe = /^(\d+)\s*[xX×]\s+/
  // Total-like keywords — capture the largest (avoids subtotal overwriting total)
  const totalRe = /^(total|grand total|amount due|amount payable|balance due|balance)/i
  // Lines to skip entirely
  const skipRe = /^(gst|tax|vat|service charge|surcharge|tip|gratuity|cash tendered|change|eftpos|visa|mastercard|amex|card|payment received|rounding)/i

  for (const line of lines) {
    const priceMatch = line.match(priceRe)
    if (!priceMatch) continue

    const price = parseFloat(priceMatch[1].replace(',', ''))
    if (isNaN(price) || price <= 0) continue

    const descRaw = line.slice(0, line.lastIndexOf(priceMatch[0])).trim()

    if (skipRe.test(descRaw)) continue

    if (totalRe.test(descRaw)) {
      if (total === null || price > total) total = price
      continue
    }

    if (descRaw.length < 2) continue

    const qtyMatch = descRaw.match(qtyRe)
    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1], 10)
      const desc = descRaw.slice(qtyMatch[0].length).trim()
      const unitPrice = Math.round((price / qty) * 100) / 100
      for (let i = 0; i < qty; i++) {
        items.push({ description: desc, price: unitPrice })
      }
    } else {
      items.push({ description: descRaw, price })
    }
  }

  return { items, total }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OCR not configured.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const imageBase64: string | undefined = body?.image
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
  }

  const visionRes = await fetch(
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

  if (!visionRes.ok) {
    console.error('Vision API error:', await visionRes.text())
    return NextResponse.json({ error: 'OCR service error.' }, { status: 502 })
  }

  const visionData = await visionRes.json()
  const block = visionData.responses?.[0]

  if (block?.error) {
    return NextResponse.json({ error: block.error.message }, { status: 422 })
  }

  const text: string = block?.fullTextAnnotation?.text ?? ''
  const { items, total } = parseReceiptText(text)

  return NextResponse.json({ items, total })
}
