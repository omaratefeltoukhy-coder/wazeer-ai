import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { callAI } from "@/lib/ai/gateway";

const InputSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  type: z.string().min(1).max(40),
  description: z.string().min(5).max(2000),
  target_audience: z.string().max(500).optional().default(""),
  pain_point: z.string().max(1000).optional().default(""),
  desired_result: z.string().max(1000).optional().default(""),
  goal: z.string().max(40).optional().default("sales"),
  country: z.string().max(80).optional().default(""),
  currency: z.string().max(8).optional().default("USD"),
  language: z.string().max(8).optional().default("en"),
  product_url: z.string().max(500).optional().default(""),
  price_one_time: z.number().optional(),
  price_subscription: z.number().optional(),
  free_trial: z.boolean().optional().default(false),
  discount: z.string().max(200).optional().default(""),
});

// (credit cost is centralised in src/lib/billing/plans.ts)

function slugify(s: string, fallback: string) {
  const v = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return v || fallback;
}

type GenInput = z.infer<typeof InputSchema>;

// Deterministic mock kit used when LOVABLE_API_KEY is missing so the
// demo / preview flow works without provider credentials. Mirrors the
// shape returned by the real AI tool so downstream persistence is identical.
function buildMockKit(data: GenInput) {
  const brandName = data.name || "Your Business";
  const audience = data.target_audience || "small business owners";
  const pain = data.pain_point || "growth feels slow and overwhelming";
  const result = data.desired_result || "a steady stream of customers without the marketing grind";
  const goalCopy: Record<string, string> = {
    sales: "drive sales",
    leads: "capture qualified leads",
    subscribers: "grow recurring subscribers",
    awareness: "build brand awareness",
  };
  const goal = goalCopy[data.goal] ?? "drive sales";

  const isSubLike = ["subscription", "course", "coaching", "membership"].includes(data.type);
  const billing = isSubLike ? "month" : "one_time";
  const price = isSubLike ? 29 : 49;

  return {
    brand: {
      brand_name: brandName,
      tone: "Confident, helpful, and approachable — premium without being stiff.",
      visual_style: "Clean, modern SaaS with rounded cards, soft shadows, and gradient accents.",
      positioning: `${brandName} helps ${audience} ${result}, without needing a marketing team.`,
      colors: { primary: "#07111F", accent: "#10B981", background: "#F8FAFC" },
      audience: {
        persona: `Busy ${audience} who want results without the learning curve.`,
        demographics: data.country ? `Adults 25–55, primarily in ${data.country}.` : "Adults 25–55, English-speaking markets.",
        psychographics: "Time-strapped, ambitious, prefers tools that ship work over tools that show dashboards.",
      },
      benefits: [
        "Skip the setup — start selling on day one",
        "Stay on-brand without hiring a designer",
        "Know exactly what to do next every week",
      ],
      pain_points: [pain, "Drowning in tools that don't talk to each other", "No idea which campaigns are actually working"],
      objections: [
        "I'm not technical, will I figure this out?",
        "Will the AI sound like me, or generic?",
        "Is this another subscription that won't pay for itself?",
      ],
    },
    offer: {
      name: `${brandName} — Launch Offer`,
      description: `A focused offer designed to ${goal} for ${audience}. Built around the outcome they actually pay for: ${result}.`,
      price,
      billing_interval: billing as "one_time" | "month" | "year",
      free_trial_days: isSubLike ? 7 : 0,
    },
    storefront: {
      title: brandName,
      hero: {
        headline: `${brandName}: ${result}.`,
        sub: `For ${audience} who are tired of ${pain}.`,
        cta: data.goal === "leads" ? "Get the free guide" : data.goal === "subscribers" ? "Start free trial" : "Get started",
      },
      benefits: [
        { title: "Set up in minutes, not weeks", body: "Wazeer AI builds your storefront, content, and growth plan from one input." },
        { title: "Stays on-brand automatically", body: `Every asset matches ${brandName}'s tone, colors, and audience without manual tweaks.` },
        { title: "Always know your next move", body: "AI recommendations spotlight what's working and what to fix — no analyst needed." },
      ],
      how_it_works: [
        { step: "Tell us about your business", body: `Describe what you sell — we already captured: ${data.description.slice(0, 140)}${data.description.length > 140 ? "…" : ""}` },
        { step: "Wazeer AI builds the kit", body: "Storefront, offer, content, ads, and emails — drafted for your review in minutes." },
        { step: "Approve and launch", body: "Edit anything, then go live with one click. Performance dashboards and recommendations turn on automatically." },
      ],
      testimonials: [
        { quote: `Finally, ${result} without doing five things at once. ${brandName} feels like a small team in my pocket.`, author: `Early ${brandName} user` },
        { quote: "I used to spend weekends writing emails and ad copy. Now I review and approve in minutes.", author: "Founder, beta cohort" },
      ],
      faq: [
        { q: "How long does setup take?", a: "Most users have a complete kit ready within minutes of finishing the wizard." },
        { q: "Can I edit the AI output?", a: "Yes. Every section, image, email, and ad is fully editable. AI gives you a strong first draft, you keep control." },
        { q: "What if my brand changes?", a: "Update your business profile and Wazeer AI re-aligns new content with the latest brand voice and visuals." },
        { q: "Will my ads launch automatically?", a: "Never. Ads, emails, and posts always need your explicit approval before they go live." },
      ],
      final_cta: {
        headline: `Ready to ${goal}?`,
        sub: `${brandName} is set up. Launch in one click.`,
        cta: "Start selling with AI",
      },
    },
    recommendations: [
      {
        category: "storefront",
        title: "Publish your storefront",
        problem: "Your storefront is in draft mode — no one can see it yet.",
        recommendation: "Review the AI-generated copy, replace one or two lines with your own voice, and publish.",
        priority: "high" as const,
      },
      {
        category: "creative",
        title: "Generate your first ad creative",
        problem: "You don't have any ad assets ready, which means no paid traffic experiments yet.",
        recommendation: "Open AI Images and generate 3 ad creatives in your brand colors. Use them in a small Meta ads test.",
        priority: "medium" as const,
      },
      {
        category: "email",
        title: "Set up a welcome email sequence",
        problem: "New leads don't get a follow-up, so you're losing them silently.",
        recommendation: "Generate a 3-email welcome sequence and turn on the automation when you're ready.",
        priority: "medium" as const,
      },
    ],
  };
}

export const generateBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 0) Reserve credits up-front; refund on failure.
    await requireEntitlement(data.workspace_id, "storefront");
    await consumeCredits(data.workspace_id, "business_generation");

    // 1) Insert business as `generating`
    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .insert({
        workspace_id: data.workspace_id,
        user_id: userId,
        name: data.name,
        type: data.type as never,
        description: data.description,
        target_audience: data.target_audience || null,
        pain_point: data.pain_point || null,
        desired_result: data.desired_result || null,
        goal: data.goal,
        country: data.country || null,
        currency: data.currency,
        language: data.language,
        status: "generating",
      })
      .select("id")
      .single();
    if (bizErr || !biz) throw new Error(bizErr?.message || "Failed to create business");
    const businessId = biz.id as string;

    // 2) Save raw input
    await supabase.from("business_inputs").insert({
      business_id: businessId,
      input_type: "wizard",
      original_text: data.description,
      extracted_data_json: JSON.parse(JSON.stringify(data)),
    });

    // 3) Call Lovable AI for full plan via tool calling.
    // If LOVABLE_API_KEY is missing, fall back to a deterministic mock kit so
    // the wizard still produces a complete, persistable result for demos.
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const provider: "lovable_ai" | "mock" = LOVABLE_API_KEY ? "lovable_ai" : "mock";

    const sysPrompt = `You are Wazeer AI, a senior brand & growth strategist. Given a business brief, you produce a complete go-to-market kit: brand profile, opening offer, storefront sections, and 3 high-impact recommendations. Be specific, premium, conversion-focused. Always reply via the provided tool.`;

    const userPrompt = `Business brief:
Name: ${data.name}
Type: ${data.type}
Description: ${data.description}
Target audience: ${data.target_audience}
Pain point: ${data.pain_point}
Desired result: ${data.desired_result}
Primary goal: ${data.goal}
Country: ${data.country}
Currency: ${data.currency}
Language: ${data.language}`;

    const tool = {
      type: "function" as const,
      function: {
        name: "build_business_kit",
        description: "Return a complete brand profile, offer, storefront content and recommendations.",
        parameters: {
          type: "object",
          properties: {
            brand: {
              type: "object",
              properties: {
                brand_name: { type: "string" },
                tone: { type: "string" },
                visual_style: { type: "string" },
                positioning: { type: "string" },
                colors: {
                  type: "object",
                  properties: {
                    primary: { type: "string" },
                    accent: { type: "string" },
                    background: { type: "string" },
                  },
                  required: ["primary", "accent", "background"],
                  additionalProperties: false,
                },
                audience: {
                  type: "object",
                  properties: {
                    persona: { type: "string" },
                    demographics: { type: "string" },
                    psychographics: { type: "string" },
                  },
                  required: ["persona", "demographics", "psychographics"],
                  additionalProperties: false,
                },
                benefits: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
                pain_points: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
                objections: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
              },
              required: ["brand_name", "tone", "visual_style", "positioning", "colors", "audience", "benefits", "pain_points", "objections"],
              additionalProperties: false,
            },
            offer: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "number" },
                billing_interval: { type: "string", enum: ["one_time", "month", "year"] },
                free_trial_days: { type: "number" },
              },
              required: ["name", "description", "price", "billing_interval", "free_trial_days"],
              additionalProperties: false,
            },
            storefront: {
              type: "object",
              properties: {
                title: { type: "string" },
                hero: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    sub: { type: "string" },
                    cta: { type: "string" },
                  },
                  required: ["headline", "sub", "cta"],
                  additionalProperties: false,
                },
                benefits: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"], additionalProperties: false }, minItems: 3, maxItems: 4 },
                how_it_works: { type: "array", items: { type: "object", properties: { step: { type: "string" }, body: { type: "string" } }, required: ["step", "body"], additionalProperties: false }, minItems: 3, maxItems: 4 },
                testimonials: { type: "array", items: { type: "object", properties: { quote: { type: "string" }, author: { type: "string" } }, required: ["quote", "author"], additionalProperties: false }, minItems: 2, maxItems: 3 },
                faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"], additionalProperties: false }, minItems: 4, maxItems: 6 },
                final_cta: {
                  type: "object",
                  properties: { headline: { type: "string" }, sub: { type: "string" }, cta: { type: "string" } },
                  required: ["headline", "sub", "cta"],
                  additionalProperties: false,
                },
              },
              required: ["title", "hero", "benefits", "how_it_works", "testimonials", "faq", "final_cta"],
              additionalProperties: false,
            },
            recommendations: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  title: { type: "string" },
                  problem: { type: "string" },
                  recommendation: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["category", "title", "problem", "recommendation", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["brand", "offer", "storefront", "recommendations"],
          additionalProperties: false,
        },
      },
    };

    let kit: ReturnType<typeof buildMockKit>;
    if (provider === "mock") {
      kit = buildMockKit(data);
    } else {
      try {
        const aiRes = await callAI({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [tool as any],
          toolChoice: { type: "function", function: { name: "build_business_kit" } },
        });

        const args = aiRes.toolCalls?.[0]?.function?.arguments;
        if (!args) throw new Error("AI returned no structured output");
        kit = typeof args === "string" ? JSON.parse(args) : args;
      } catch (err) {
        // Provider call failed mid-flight (network, parse, etc). Refund and
        // surface the error — falling back to mock here would hide real
        // outages from operators.
        await refundCredits(data.workspace_id, "business_generation", { business_id: businessId });
        await supabase.from("businesses").update({ status: "failed", generation_log_json: { provider, error: err instanceof Error ? err.message : String(err) } }).eq("id", businessId);
        throw err;
      }
    }

    // 4) Persist generated artifacts
    const slug = slugify(data.name, `biz-${businessId.slice(0, 6)}`);
    const isSubLike = ["subscription", "course", "coaching", "membership"].includes(data.type);
    const billing = kit.offer.billing_interval === "one_time" ? null : kit.offer.billing_interval;

    const writes = await Promise.all([
      supabase.from("brand_profiles").insert({
        business_id: businessId,
        brand_name: kit.brand.brand_name,
        tone: kit.brand.tone,
        visual_style: kit.brand.visual_style,
        positioning: kit.brand.positioning,
        colors_json: kit.brand.colors,
        audience_json: kit.brand.audience,
        benefits_json: kit.brand.benefits,
        pain_points_json: kit.brand.pain_points,
        objections_json: kit.brand.objections,
      }),
      supabase.from("offers").insert({
        business_id: businessId,
        name: kit.offer.name,
        description: kit.offer.description,
        type: data.type as never,
        price: kit.offer.price,
        currency: data.currency,
        billing_interval: isSubLike ? (billing ?? "month") : billing,
        free_trial_days: kit.offer.free_trial_days ?? 0,
        status: "draft",
      }),
      supabase.from("storefronts").insert({
        business_id: businessId,
        slug,
        title: kit.storefront.title,
        status: "draft",
        content_json: kit.storefront,
      }),
      supabase.from("ai_recommendations").insert(
        (kit.recommendations as any[]).map((r) => ({
          business_id: businessId,
          category: r.category,
          title: r.title,
          problem: r.problem,
          recommendation: r.recommendation,
          priority: r.priority,
          status: "open",
          confidence_score: 0.8,
        })),
      ),
    ]);

    const writeError = writes.find((w) => w.error)?.error;
    if (writeError) {
      await refundCredits(data.workspace_id, "business_generation", { business_id: businessId });
      await supabase.from("businesses").update({ status: "failed", generation_log_json: { write_error: writeError.message } }).eq("id", businessId);
      throw new Error(`Failed to save generated kit: ${writeError.message}`);
    }

    await supabase
      .from("businesses")
      .update({
        status: "ready",
        generation_log_json: provider === "mock"
          ? { provider: "mock", note: "LOVABLE_API_KEY not set — content is templated." }
          : { provider: "lovable_ai", model: "google/gemini-2.5-flash" },
      })
      .eq("id", businessId);

    return { business_id: businessId, slug, provider };
  });

