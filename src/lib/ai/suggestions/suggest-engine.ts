import Anthropic from "@anthropic-ai/sdk";
import type { SuggestionContext } from "./data-collector";

export interface TimeSuggestion {
  projectId: string;
  projectName: string;
  value: number;
  confidence: number;
  reason: string;
  source: "calendar" | "habit" | "assignment";
}

export async function generateSuggestions(
  ctx: SuggestionContext,
  targetDate: string,
  locale: string
): Promise<TimeSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Don't suggest if user is on absence
  if (ctx.absencesToday.length > 0) return [];

  // Don't suggest if all hours are already filled
  const existingTotal = ctx.existingEntries.reduce(
    (sum, e) => sum + parseFloat(e.value),
    0
  );
  if (existingTotal >= 1) return [];

  // Build context for Claude
  const dayOfWeek = new Date(targetDate).toLocaleDateString("en-US", { weekday: "long" });

  // Analyze recent patterns
  const projectDays = new Map<string, { name: string; totalDays: number; count: number }>();
  for (const entry of ctx.recentTimeEntries) {
    const existing = projectDays.get(entry.projectId) ?? {
      name: entry.projectName,
      totalDays: 0,
      count: 0,
    };
    existing.totalDays += parseFloat(entry.value);
    existing.count++;
    projectDays.set(entry.projectId, existing);
  }

  const patternSummary = Array.from(projectDays.entries())
    .map(([id, data]) => ({
      projectId: id,
      projectName: data.name,
      avgDaysPerWeek: (data.totalDays / 4).toFixed(2),
      frequency: data.count,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Already entered project IDs
  const alreadyEnteredIds = new Set(ctx.existingEntries.map((e) => e.projectId));
  const remainingCapacity = 1 - existingTotal;

  const prompt = `You are a time entry suggestion engine. Based on the data below, suggest time entries for ${targetDate} (${dayOfWeek}).

## Active project assignments
${ctx.activeAssignments.map((a) => `- ${a.projectName} (ID: ${a.projectId})`).join("\n")}

## Recent patterns (last 4 weeks)
${patternSummary.map((p) => `- ${p.projectName} (ID: ${p.projectId}): avg ${p.avgDaysPerWeek} days/week, ${p.frequency} entries`).join("\n")}

${ctx.calendarEvents.length > 0 ? `## Calendar events for today\n${ctx.calendarEvents.map((e) => `- ${e.summary} (${e.start} - ${e.end})`).join("\n")}` : ""}

## Already entered today
${ctx.existingEntries.length > 0 ? ctx.existingEntries.map((e) => `- ${e.projectName}: ${e.value} day(s)`).join("\n") : "None"}

## Constraints
- Remaining capacity: ${remainingCapacity} days
- Projects already entered today: ${Array.from(alreadyEnteredIds).join(", ") || "none"}
- Only suggest from active assignments
- Values must be multiples of 0.25 (quarter days)
- Total suggestions must not exceed remaining capacity

Return a JSON array of suggestions. Each suggestion:
{
  "projectId": "uuid",
  "projectName": "name",
  "value": 0.5,
  "confidence": 0.8,
  "reason": "Brief reason in ${locale === "fr" ? "French" : "English"}",
  "source": "habit" | "calendar" | "assignment"
}

Return ONLY the JSON array, no other text. Return an empty array [] if no confident suggestions.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const suggestions: TimeSuggestion[] = JSON.parse(match[0]);

    // Validate suggestions
    return suggestions
      .filter(
        (s) =>
          s.projectId &&
          s.value > 0 &&
          s.value <= remainingCapacity &&
          !alreadyEnteredIds.has(s.projectId) &&
          ctx.activeAssignments.some((a) => a.projectId === s.projectId)
      )
      .slice(0, 5);
  } catch (err) {
    console.error("[ai-suggest] Failed to generate suggestions:", err);
    return [];
  }
}
