import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a receipt parser. Extract all line items from the receipt image.
Return ONLY a valid JSON array like: [{"name":"Item name","price":1234.50},...]
- Include only food/drink/product items with prices
- Use the numeric price value without currency symbols
- If a line shows quantity x price, multiply them for the total price
- Skip taxes, totals, subtotals, tips, and service charges
- Return an empty array [] if no items found`;

async function tryClaude(imageBase64: string, mimeType: string): Promise<{ name: string; price: number }[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg', data: imageBase64 },
          },
          { type: 'text', text: 'Parse this receipt and return the JSON array of items.' },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

async function tryGoogle(imageBase64: string): Promise<{ name: string; price: number }[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('No Google Vision key');

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION' }] }],
      }),
    }
  );

  const data = await res.json();
  const fullText: string = data.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!fullText) return [];

  // Parse text lines looking for item + price patterns
  const lines = fullText.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const items: { name: string; price: number }[] = [];
  const priceRe = /([0-9]+[.,][0-9]{2})/g;

  for (const line of lines) {
    const prices = line.match(priceRe);
    if (!prices) continue;
    const price = parseFloat(prices[prices.length - 1].replace(',', '.'));
    const name = line.replace(priceRe, '').replace(/\s+/g, ' ').trim();
    if (name && price > 0) items.push({ name, price });
  }

  return items;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    let items: { name: string; price: number }[] = [];
    let provider = 'none';

    // Try Claude first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        items = await tryClaude(base64, mimeType);
        provider = 'claude';
      } catch (e) {
        console.error('Claude OCR failed:', e);
      }
    }

    // Fallback to Google Vision
    if (!items.length && process.env.GOOGLE_VISION_API_KEY) {
      try {
        items = await tryGoogle(base64);
        provider = 'google';
      } catch (e) {
        console.error('Google Vision failed:', e);
      }
    }

    // If both failed, return signal to use Tesseract on client
    if (!items.length) {
      return NextResponse.json({ items: [], provider: 'tesseract', base64 });
    }

    return NextResponse.json({ items, provider });
  } catch (err) {
    console.error('Scan error:', err);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
