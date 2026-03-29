import type { ParsedAction } from "./parser";
import type { OrgRole } from "@/lib/auth-context";
import { executeTool } from "../tools";

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function executeQuickAction(
  action: ParsedAction,
  ctx: { userId: string; organizationId: string; role: OrgRole }
): Promise<ActionResult> {
  try {
    switch (action.intent) {
      case "create_time_entry": {
        const result = await executeTool("create_time_entry", {
          project_id: action.params.project_id,
          date: action.params.date,
          value: action.params.value,
          note: action.params.note,
        }, ctx);

        const typed = result as { success?: boolean; message?: string; error?: string };
        if (typed.error) {
          return { success: false, message: typed.error };
        }
        return { success: true, message: typed.message ?? "Time entry created.", data: result };
      }

      case "create_expense": {
        const result = await executeTool("create_expense", {
          amount: action.params.amount,
          date: action.params.date,
          description: action.params.description,
          category_name: action.params.category_name,
          project_id: action.params.project_id,
        }, ctx);

        const typed = result as { success?: boolean; message?: string; error?: string };
        if (typed.error) {
          return { success: false, message: typed.error };
        }
        return { success: true, message: typed.message ?? "Expense created.", data: result };
      }

      case "query": {
        // Queries should be redirected to the chat
        return {
          success: true,
          message: action.displayMessage,
          data: { redirectToChat: true, question: action.params.question },
        };
      }

      default:
        return { success: false, message: "Unknown action type." };
    }
  } catch (err) {
    console.error("[quick-action] Execution failed:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Action failed.",
    };
  }
}
