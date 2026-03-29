import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return new Response("LIVEBLOCKS_SECRET_KEY not configured", { status: 500 });

  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id!;
  const appUserId = session.user.appUserId;

  // Read orgId from DB (not JWT cache) to handle org switches immediately
  let orgId = session.user.currentOrganizationId;
  if (appUserId) {
    const [appUser] = await db
      .select({ currentOrganizationId: users.currentOrganizationId })
      .from(users)
      .where(eq(users.id, appUserId));
    if (appUser?.currentOrganizationId) orgId = appUser.currentOrganizationId;
  }
  if (!orgId) return new Response("No organization", { status: 403 });

  const liveblocks = new Liveblocks({ secret });

  const liveblocksSession = liveblocks.prepareSession(userId, {
    userInfo: {
      name: session.user.name ?? "Utilisateur",
      email: session.user.email ?? "",
      color: stringToColor(userId),
      role: session.user.orgRole ?? "collaborator",
      image: session.user.image ?? undefined,
    },
  });

  liveblocksSession.allow(`kllapp:${orgId}:*`, liveblocksSession.FULL_ACCESS);

  const { status, body } = await liveblocksSession.authorize();
  return new Response(body, { status });
}

function stringToColor(str: string): string {
  if (!str) return "hsl(0, 70%, 50%)";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}
