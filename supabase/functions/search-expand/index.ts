// =========================================================
//  Supabase Edge Function: search-expand
//  검색어를 Claude Haiku로 한↔영 번역 + 연관 키워드로 확장
//  ⚠️ ANTHROPIC_API_KEY는 서버 시크릿으로만 저장 (프론트엔드 노출 금지)
// =========================================================
import Anthropic from "npm:@anthropic-ai/sdk@0.69.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string") return json({ terms: [] });

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system:
        "You expand search queries for a bilingual Korean/English AI image gallery. " +
        "Given a query, return concrete searchable keywords: the original term, its Korean↔English " +
        "translation, and a few closely related words — in BOTH Korean and English. " +
        "Only nouns/keywords someone would put in an image title. No sentences, no explanations.",
      messages: [{ role: "user", content: `Query: ${q}` }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { terms: { type: "array", items: { type: "string" } } },
            required: ["terms"],
            additionalProperties: false,
          },
        },
      },
    });

    const block = (msg.content as any[]).find((b) => b.type === "text");
    const parsed = JSON.parse(block?.text ?? '{"terms":[]}');
    const terms = Array.isArray(parsed.terms) ? parsed.terms.slice(0, 12) : [];
    return json({ terms });
  } catch (e) {
    // 실패해도 200 + 빈 배열 → 프론트는 로컬 사전으로 폴백
    return json({ terms: [], error: String(e) });
  }
});
