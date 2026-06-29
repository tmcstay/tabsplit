import { NextRequest, NextResponse } from 'next/server'
import { parseReceiptText } from '@/lib/parseReceipt'

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
