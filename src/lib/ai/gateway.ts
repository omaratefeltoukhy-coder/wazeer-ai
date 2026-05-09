// Unified AI gateway — tries Lovable first (for structured tool calls),
// falls back to OpenAI direct when Lovable is unavailable.
// Usage: import { callAI } from "@/lib/ai/gateway";

export type AITool = {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
};

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callAITool(
  messages: AIMessage[],
  tool: AITool,
  toolName: string
): Promise<any> {
  const aiRes = await callAI({
    messages,
    tools: [tool],
    toolChoice: { type: "function", function: { name: toolName } },
  });
  const args = aiRes.toolCalls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return typeof args === "string" ? JSON.parse(args) : args;
}

export async function callAI(options: {
  messages: AIMessage[];
  tools?: AITool[];
  toolChoice?: { type: "function"; function: { name: string } };
  temperature?: number;
  responseFormat?: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } } | { type: "json_object" };
  model?: string;
}): Promise<{ content?: string; toolCalls?: Array<{ function: { name: string; arguments: string } }>; images?: any[] }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Prefer Lovable when available (better structured output)
  if (lovableKey) {
    return callLovable(lovableKey, options);
  }

  // Fallback to OpenAI direct
  if (openaiKey) {
    return callOpenAI(openaiKey, options);
  }

  throw new Error("No AI provider configured. Add LOVABLE_API_KEY or OPENAI_API_KEY to .env");
}

async function callLovable(
  key: string,
  options: {
    messages: AIMessage[];
    tools?: AITool[];
    toolChoice?: { type: "function"; function: { name: string } };
    temperature?: number;
    responseFormat?: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } } | { type: "json_object" };
    model?: string;
  }
) {
  const body: Record<string, unknown> = {
    model: options.model ?? "google/gemini-2.5-flash",
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
  };
  if (options.tools?.length) body.tools = options.tools;
  if (options.toolChoice) body.tool_choice = options.toolChoice;
  if (options.responseFormat) body.response_format = options.responseFormat;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway failed (${res.status})`);
    }

    const json = await res.json();
    const msg = json?.choices?.[0]?.message;
    return {
      content: msg?.content,
      toolCalls: msg?.tool_calls,
      images: msg?.images,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  key: string,
  options: {
    messages: AIMessage[];
    tools?: AITool[];
    toolChoice?: { type: "function"; function: { name: string } };
    temperature?: number;
    responseFormat?: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } } | { type: "json_object" };
    model?: string;
  }
) {
  const body: Record<string, unknown> = {
    model: options.model ?? "gpt-4o-mini",
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }
  if (options.responseFormat) body.response_format = options.responseFormat;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("OpenAI rate limit hit. Try again shortly.");
      if (res.status === 401) throw new Error("OpenAI API key invalid. Check OPENAI_API_KEY.");
      throw new Error(`OpenAI failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const msg = json?.choices?.[0]?.message;
    return {
      content: msg?.content,
      toolCalls: msg?.tool_calls,
      images: msg?.images,
    };
  } finally {
    clearTimeout(timeout);
  }
}
