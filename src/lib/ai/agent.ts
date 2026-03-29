import Anthropic from "@anthropic-ai/sdk";
import type { OrgRole } from "@/lib/auth-context";
import { buildSystemPrompt } from "./context-builder";
import { getToolDefinitions, executeTool } from "./tools";

const MAX_TOOL_ROUNDS = 8;

interface AgentContext {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  locale: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Runs the AI agent loop with tool use.
 * Yields text chunks as they are generated (for SSE streaming).
 */
export async function* runAgent(
  userMessage: string,
  history: ChatMessage[],
  ctx: AgentContext
): AsyncGenerator<{ type: "text" | "tool_use" | "done"; content: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield { type: "text", content: "AI service is not configured." };
    yield { type: "done", content: "" };
    return;
  }

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(ctx);
  const tools = getToolDefinitions(ctx.role);

  // Build messages from history + new message
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    });

    // Process response content blocks
    const toolResults: Anthropic.MessageParam[] = [];
    let hasToolUse = false;
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
        yield { type: "text", content: block.text };
      } else if (block.type === "tool_use") {
        hasToolUse = true;

        yield {
          type: "tool_use",
          content: JSON.stringify({ tool: block.name, id: block.id }),
        };

        // Execute the tool
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          {
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            role: ctx.role,
          }
        );

        // Add assistant message with the full content (text + tool_use)
        // and tool result for the next round
        toolResults.push({
          role: "user",
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            },
          ],
        });
      }
    }

    if (!hasToolUse) {
      // No more tool calls, agent is done
      yield { type: "done", content: textContent };
      return;
    }

    // Add the assistant response and tool results for the next iteration
    messages.push({
      role: "assistant",
      content: response.content,
    });
    for (const tr of toolResults) {
      messages.push(tr);
    }
  }

  yield { type: "text", content: "\n\n*Maximum tool iterations reached.*" };
  yield { type: "done", content: "" };
}
