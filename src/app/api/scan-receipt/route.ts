import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type MediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

function isSupportedImage(type: string): type is MediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI scanning not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  // For PDFs, we need to use document support; for images, use vision
  const isPdf = file.type === "application/pdf";
  const isImage = isSupportedImage(file.type);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Unsupported file type for scanning. Use JPEG, PNG, WebP, or PDF." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const anthropic = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [];

  if (isPdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    });
  } else {
    content.push({
      type: "image",
      source: { type: "base64", media_type: file.type as MediaType, data: base64 },
    });
  }

  content.push({
    type: "text",
    text: `Analyse this receipt/invoice and extract the following information in JSON format:
{
  "amount": number (total amount including tax, use the final total),
  "currency": string (e.g. "EUR", "USD"),
  "date": string (format YYYY-MM-DD, or null if not found),
  "vendor": string (merchant/vendor name, or null if not found),
  "description": string (brief description of the purchase, max 100 chars),
  "vat_amount": number or null (VAT/tax amount if visible),
  "category_hint": string (one of: "transport", "meals", "accommodation", "supplies", "software", "telecom", "other")
}

Return ONLY the JSON object, no other text.`,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON from the response (handle potential markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse receipt data", raw: text },
        { status: 422 }
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ data: extracted });
  } catch (err) {
    console.error("[scan-receipt] AI extraction failed:", err);
    return NextResponse.json(
      { error: "AI extraction failed" },
      { status: 500 }
    );
  }
}
