import type { OrgRole } from "@/lib/auth-context";
import { checkBudgetOverrun } from "./rules/budget-overrun";
import { checkTimeUnderEntry } from "./rules/time-underentry";
import { checkAvailability } from "./rules/availability";

export interface Insight {
  id: string;
  type: "warning" | "info" | "critical";
  category: "budget" | "time" | "expense" | "availability" | "profitability";
  title: string;
  description: string;
  actionSuggestion: string;
  relatedEntityId: string;
  relatedEntityType: "project" | "user" | "expense";
  severity: number;
}

export async function generateInsights(
  organizationId: string,
  role: OrgRole,
  locale: string
): Promise<Insight[]> {
  if (role !== "admin" && role !== "manager") {
    return [];
  }

  const insights: Insight[] = [];

  try {
    const [budgetInsights, timeInsights, availabilityInsights] = await Promise.all([
      checkBudgetOverrun(organizationId, locale),
      checkTimeUnderEntry(organizationId, locale),
      checkAvailability(organizationId, locale),
    ]);

    insights.push(...budgetInsights, ...timeInsights, ...availabilityInsights);
  } catch (err) {
    console.error("[ai-insights] Error generating insights:", err);
  }

  // Sort by severity (highest first)
  return insights.sort((a, b) => b.severity - a.severity);
}
