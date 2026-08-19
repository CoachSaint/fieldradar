export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, useSearch } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured on server" });
    }

    const body = {
      model: "openai/gpt-4o-mini",
      max_tokens: 3800,
      messages: [
        {
          role: "system",
          content: "You are a field-marketing intelligence scout for home-services contractors. TODAY IS AUGUST 18, 2026. CRITICAL TEMPORAL RULES:\n1. Only return REAL UPCOMING future events occurring between August 18, 2026 and March 2027.\n2. NEVER return past events from 2024, 2025, or earlier in 2026.\n3. Strictly enforce the user's target city, state, and geographic radius. Never return events from different states.\n4. All dates MUST be YYYY-MM-DD."
        },
        { role: "user", content: prompt }
      ],
    };

    if (useSearch) {
      body.plugins = [{ id: "web" }];
    }

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://fieldradar-terminal.vercel.app",
        "X-Title": "FieldRadar",
      },
      body: JSON.stringify(body),
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      return res.status(orRes.status).json({ error: "AI provider error", details: errText });
    }

    const data = await orRes.json();
    const content = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content });
  } catch (error) {
    console.error("AI Handler Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
