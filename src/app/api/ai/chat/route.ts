import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, organizations, organizationMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { runAgent } from "@/lib/ai/agent";
import type { OrgRole } from "@/lib/auth-context";

interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = (await request.json()) as ChatRequest;
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (body.message.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  // Get user context
  const appUserId = session.user.appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  const [appUser] = await db
    .select({
      id: users.id,
      name: users.name,
      locale: users.locale,
      currentOrganizationId: users.currentOrganizationId,
    })
    .from(users)
    .where(eq(users.id, appUserId));

  if (!appUser?.currentOrganizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, appUser.currentOrganizationId));

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, appUserId),
        eq(organizationMembers.organizationId, appUser.currentOrganizationId),
        eq(organizationMembers.status, "active")
      )
    );

  const role = (membership?.role as OrgRole) ?? "collaborator";

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const agentStream = runAgent(
          body.message,
          body.history ?? [],
          {
            userId: appUser.id,
            userName: appUser.name ?? "User",
            organizationId: appUser.currentOrganizationId!,
            organizationName: org?.name ?? "Organization",
            role,
            locale: appUser.locale ?? "fr",
          }
        );

        for await (const chunk of agentStream) {
          const data = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("[ai-chat] Agent error:", err);
        const errorData = JSON.stringify({
          type: "text",
          content: "An error occurred while processing your request.",
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
