import Anthropic from "@anthropic-ai/sdk";

export interface ParsedAction {
  intent: "create_time_entry" | "create_absence" | "create_expense" | "query";
  params: Record<string, unknown>;
  confidence: number;
  needsConfirmation: boolean;
  displayMessage: string;
}

export async function parseQuickAction(
  input: string,
  context: {
    projects: { id: string; name: string }[];
    userId: string;
    locale: string;
  }
): Promise<ParsedAction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });
  const today = new Date().toISOString().split("T")[0];
  const projectList = context.projects
    .map((p) => `- "${p.name}" (ID: ${p.id})`)
    .join("\n");

  const prompt = `Parse this natural language command into a structured action. Today is ${today}.

User input: "${input}"

Available projects:
${projectList}

Return a JSON object with:
{
  "intent": "create_time_entry" | "create_expense" | "query",
  "params": { ... },
  "confidence": 0.0-1.0,
  "needsConfirmation": true/false,
  "displayMessage": "Human-readable summary in ${context.locale === "fr" ? "French" : "English"}"
}

For create_time_entry params: { project_id, project_name, date (YYYY-MM-DD), value (days, e.g. 0.5), note? }
- "hier"/"yesterday" = ${new Date(Date.now() - 86400000).toISOString().split("T")[0]}
- "aujourd'hui"/"today" = ${today}
- Convert hours to days: 4h = 0.5, 8h = 1, 2h = 0.25

For create_expense params: { amount, date, description, category_name, project_id? }

For query: { question }

If you can't confidently parse the input, return {"intent":"query","params":{"question":"${input}"},"confidence":0.3,"needsConfirmation":false,"displayMessage":"..."}.

Return ONLY the JSON object.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as ParsedAction;
  } catch (err) {
    console.error("[quick-action] Parse failed:", err);
    return null;
  }
}
