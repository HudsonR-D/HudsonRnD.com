import { NextRequest, NextResponse } from 'next/server';

const MODELS = [
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    systemNote: "Optimize for Claude (Anthropic). Claude responds exceptionally well to: XML-tagged sections (<context>, <task>, <constraints>, <output_format>), explicit reasoning requests, clear role definitions, and structured output specifications. Claude's modern versions understand natural language well, so use XML tags only when they genuinely add clarity to complex prompts. Prefer clear headings and explicit language for simpler prompts."
  },
  {
    id: "gpt",
    label: "ChatGPT / o1",
    vendor: "OpenAI",
    systemNote: "Optimize for ChatGPT / o1 (OpenAI). GPT models benefit from: explicit role framing at the start, markdown headers to separate sections, numbered step-by-step instructions, clear output format specification, and explicit 'think step by step' or 'reason through this carefully' triggers. For o1 specifically, the model already reasons internally so prompts should be shorter and more direct — o1 dislikes over-specified reasoning instructions."
  },
  {
    id: "grok",
    label: "Grok",
    vendor: "xAI",
    systemNote: "Optimize for Grok (xAI). Grok responds well to: direct, assertive language with strong verbs, minimal ceremony, fewer soft constraints, concise framing over long system prompts, clear task statements followed immediately by relevant context, and explicit permission to speculate or take strong stances when needed. Avoid over-hedging or excessive safety framing."
  },
  {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    systemNote: "Optimize for Gemini (Google). Gemini performs best with: markdown formatting with clear headers and lists, explicit reasoning path requests for complex tasks, rich contextual framing provided upfront before the task, numbered steps for multi-part instructions, and specific output length or format targets. For technical or multi-step tasks, explicitly request that Gemini show its reasoning."
  }
];

const buildSystemPrompt = (modelNote: string) => `You are a world-class prompt engineer. Your job is to analyze a raw user prompt and transform it into a significantly better, model-optimized version.

${modelNote}

Current best practices to apply where relevant:
- Specificity: Replace vague requests with explicit requirements (audience, tone, length, format)
- Context injection: Add necessary framing the user forgot to include
- Output specification: Define exactly what "done" looks like
- Constraint clarity: Reduce hallucination by bounding the response scope
- Few-shot signals: When the task benefits from examples, note where they should go
- Chain-of-thought: Trigger reasoning for complex analytical tasks
- Role definition: Use persona/role when it genuinely helps (not as cargo cult)
- Anti-patterns removed: Eliminate filler, redundancy, contradictions, and ambiguity

CRITICAL RULES:
- Only apply techniques that genuinely help THIS specific prompt. Don't add XML tags for a simple one-sentence question. Don't add elaborate structure to a casual creative writing request.
- The enhanced prompt should feel like it was written by a human expert, not a template engine.
- Preserve the user's intent completely. Improve the vehicle, not the destination.
- If the original prompt is already good, say so and make only surgical tweaks.

Respond ONLY with valid JSON in this exact format:
{
  "enhanced_prompt": "the full improved prompt text",
  "diagnosis": "1-2 sentence honest assessment of what was weak about the original",
  "improvements": ["specific change made and why", "another change"],
  "techniques_applied": ["XML structure", "Few-shot framing", "Chain-of-thought trigger"],
  "confidence": "high|medium|low",
  "confidence_note": "brief note on confidence level if not high"
}`;

// Anthropic status codes that mean "no credits" rather than a real error
const CREDIT_ERRORS = new Set([402, 529]);

async function callGroqFallback(systemPrompt: string, userMessage: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Out of Anthropic credits and no GROQ_API_KEY set as fallback.");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant", // free tier on Groq
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Groq fallback also failed.");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const { rawPrompt, selectedModel } = await request.json();

    if (!rawPrompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const model = MODELS.find(m => m.id === selectedModel);
    if (!model) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(model.systemNote);
    const userMessage = `Here is the raw prompt to transform:\n\n"""\n${rawPrompt}\n"""\n\nTarget model: ${model.label} (${model.vendor})\n\nAnalyze and enhance this prompt. Return only the JSON object.`;

    let rawText: string;
    let usedFallback = false;

    // Primary: Haiku — cheapest Anthropic model
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    if (anthropicRes.ok) {
      const data = await anthropicRes.json();
      rawText = data.content?.[0]?.text || "";
    } else if (CREDIT_ERRORS.has(anthropicRes.status)) {
      // Credits exhausted — silently fall back to Groq free tier
      console.warn(`Anthropic returned ${anthropicRes.status} — switching to Groq fallback.`);
      rawText = await callGroqFallback(systemPrompt, userMessage);
      usedFallback = true;
    } else {
      const err = await anthropicRes.json();
      return NextResponse.json({ error: err.error?.message || "Anthropic API error" }, { status: 502 });
    }

    const clean = rawText.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Attach fallback flag so client can surface a subtle indicator if desired
    if (usedFallback) parsed._fallback = "groq";

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Wizard route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}