import { db } from "@/lib/db";
import { projects, clients, timeEntries, expenses } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { Insight } from "../analyzer";

export async function checkBudgetOverrun(
  organizationId: string,
  locale: string
): Promise<Insight[]> {
  const isFr = locale === "fr";
  const insights: Insight[] = [];

  // Get projects with budgets
  const budgetedProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.name,
      budget: projects.budget,
      dailyRate: projects.dailyRate,
      status: projects.status,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(projects.status, "active"),
        sql`${projects.budget} IS NOT NULL AND CAST(${projects.budget} AS DECIMAL) > 0`
      )
    );

  for (const project of budgetedProjects) {
    const budget = parseFloat(project.budget!);
    const dailyRate = project.dailyRate ? parseFloat(project.dailyRate) : 0;

    // Get total days worked
    const [timeAgg] = await db
      .select({
        totalDays: sql<string>`COALESCE(SUM(CAST(${timeEntries.value} AS DECIMAL)), 0)`,
      })
      .from(timeEntries)
      .where(
        and(eq(timeEntries.projectId, project.id), eq(timeEntries.type, "worked"))
      );

    // Get total expenses
    const [expenseAgg] = await db
      .select({
        totalExpenses: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(eq(expenses.projectId, project.id));

    const totalDays = parseFloat(timeAgg.totalDays);
    const totalExpenses = parseFloat(expenseAgg.totalExpenses);
    const consumed = totalDays * dailyRate + totalExpenses;
    const pct = budget > 0 ? Math.round((consumed / budget) * 100) : 0;

    if (pct >= 90) {
      insights.push({
        id: `budget-${project.id}`,
        type: "critical",
        category: "budget",
        title: isFr
          ? `${project.name} : budget consommé à ${pct}%`
          : `${project.name}: budget ${pct}% consumed`,
        description: isFr
          ? `Le projet ${project.name} (${project.clientName ?? "sans client"}) a consommé ${consumed.toFixed(0)}€ sur un budget de ${budget.toFixed(0)}€.`
          : `Project ${project.name} (${project.clientName ?? "no client"}) has consumed ${consumed.toFixed(0)}€ out of a ${budget.toFixed(0)}€ budget.`,
        actionSuggestion: isFr
          ? "Envisagez de réduire l'allocation ou d'augmenter le budget."
          : "Consider reducing allocation or increasing the budget.",
        relatedEntityId: project.id,
        relatedEntityType: "project",
        severity: pct >= 100 ? 10 : 8,
      });
    } else if (pct >= 75) {
      insights.push({
        id: `budget-${project.id}`,
        type: "warning",
        category: "budget",
        title: isFr
          ? `${project.name} : budget consommé à ${pct}%`
          : `${project.name}: budget ${pct}% consumed`,
        description: isFr
          ? `Le projet approche de son budget. ${consumed.toFixed(0)}€ consommés sur ${budget.toFixed(0)}€.`
          : `Project is approaching its budget. ${consumed.toFixed(0)}€ consumed out of ${budget.toFixed(0)}€.`,
        actionSuggestion: isFr
          ? "Surveillez les prochaines saisies de temps."
          : "Monitor upcoming time entries.",
        relatedEntityId: project.id,
        relatedEntityType: "project",
        severity: 6,
      });
    }
  }

  return insights;
}
