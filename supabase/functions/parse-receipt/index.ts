import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type ParsedItem = { name: string; amount_cents: number; quantity: number };

type ParsedReceipt = {
  merchant: string | null;
  receipt_date: string | null;
  items: ParsedItem[];
  tax_cents: number;
  tip_cents: number;
};

const RECEIPT_SCHEMA = `{
  "merchant": string | null,
  "receipt_date": "YYYY-MM-DD" | null,
  "items": [{ "name": string, "amount_cents": number, "quantity": number }],
  "tax_cents": number,
  "tip_cents": number
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { storage_path } = await req.json();
    if (!storage_path) {
      return json({ error: 'storage_path required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: file, error: dlError } = await supabase.storage
      .from('receipts')
      .download(storage_path);

    if (dlError || !file) {
      return json({ error: dlError?.message ?? 'Failed to download image' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mime = storage_path.endsWith('.png') ? 'image/png' : 'image/jpeg';

    let parsed: ParsedReceipt;

    if (openaiKey) {
      parsed = await parseWithOpenAI(base64, mime, openaiKey);
    } else {
      parsed = emptyParsed();
    }

    return json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});

async function parseWithOpenAI(
  base64: string,
  mime: string,
  apiKey: string
): Promise<ParsedReceipt> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract structured data from restaurant receipts. Return ONLY valid JSON matching: ${RECEIPT_SCHEMA}. Amounts in cents (integer). Include every line item. If tax or tip are separate lines, put them in tax_cents/tip_cents not in items.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Parse this receipt image.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('No OCR result');

  const raw = JSON.parse(content);
  return normalizeParsed(raw);
}

function normalizeParsed(raw: Record<string, unknown>): ParsedReceipt {
  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map((it) => ({
        name: String(it.name ?? 'Item'),
        amount_cents: Math.round(Number(it.amount_cents ?? 0)),
        quantity: Math.max(1, Math.round(Number(it.quantity ?? 1))),
      }))
    : [];

  return {
    merchant: raw.merchant ? String(raw.merchant) : null,
    receipt_date: raw.receipt_date ? String(raw.receipt_date) : null,
    items: items.filter((i) => i.amount_cents > 0),
    tax_cents: Math.round(Number(raw.tax_cents ?? 0)),
    tip_cents: Math.round(Number(raw.tip_cents ?? 0)),
  };
}

function emptyParsed(): ParsedReceipt {
  return {
    merchant: null,
    receipt_date: null,
    items: [],
    tax_cents: 0,
    tip_cents: 0,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
