function parseItems(text: string): Array<{ section: string; service: string; price: string }> {
  const items: Array<{ section: string; service: string; price: string }> = []
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^ITEM:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\$[\d,]+(?:\.\d{2})?)/i)
    if (match) {
      items.push({ section: match[1].trim(), service: match[2].trim(), price: match[3].trim() })
    }
  }
  return items
}

export async function POST(request: Request) {
  const { quoteText, email, quoteId, test = false } = await request.json();

  const items = parseItems(quoteText ?? "");
  const generatedQuoteId = quoteId || `JR-${Date.now()}`;
  const webhookUrl = (process.env.N8N_JR_QUOTE_WEBHOOK_URL || "").trim();

  if (!webhookUrl) {
    console.log("[DEV BYPASS] Quote webhook skipped. Items:", JSON.stringify(items, null, 2));
    return new Response("ok", { status: 200 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, quoteId: generatedQuoteId, items, test }),
    });

    if (!response.ok) {
      return new Response("Webhook delivery failed", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Quote webhook fetch failed:", err);
    return new Response("Webhook delivery failed", { status: 502 });
  }
}
