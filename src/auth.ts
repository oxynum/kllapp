import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  authUsers,
  accounts,
  sessions,
  verificationTokens,
  users,
  organizationMembers,
  emailLogs,
} from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Resend({
      from: process.env.EMAIL_FROM ?? "KLLAPP <noreply@localhost>",
      async sendVerificationRequest({ identifier: email, url }) {
        const { sendEmail } = await import("@/lib/email");
        const subject = "Connexion à KLLAPP";
        await sendEmail({
          to: email,
          subject,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h2 style="color:#111827;">Connexion à KLLAPP</h2><p style="color:#4b5563;line-height:1.6;">Cliquez sur le lien ci-dessous pour vous connecter :</p><a href="${url}" style="display:inline-block;background:#111827;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;margin:16px 0;">Se connecter</a><p style="color:#9ca3af;font-size:13px;margin-top:24px;">Si vous n'avez pas demandé ce lien, ignorez cet email.</p></div>`,
        });
        await db.insert(emailLogs).values({
          category: "magic_link",
          recipientEmail: email,
          subject,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) token.sub = user.id;

      // Refresh org context from DB on signIn, explicit update, or every 5 minutes
      const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      const lastRefreshed = (token.lastRefreshedAt as number) ?? 0;
      const needsRefresh =
        trigger === "signIn" ||
        trigger === "update" ||
        now - lastRefreshed > TOKEN_REFRESH_INTERVAL;

      if (needsRefresh && token.sub) {
        try {
          const [appUser] = await db
            .select({ id: users.id, currentOrganizationId: users.currentOrganizationId, locale: users.locale, isSuperAdmin: users.isSuperAdmin })
            .from(users)
            .where(eq(users.authUserId, token.sub));

          if (appUser) {
            token.appUserId = appUser.id;
            token.currentOrganizationId = appUser.currentOrganizationId;
            token.locale = appUser.locale ?? "fr";
            token.isSuperAdmin = appUser.isSuperAdmin ?? false;

            if (appUser.currentOrganizationId) {
              const [membership] = await db
                .select({ role: organizationMembers.role, isOwner: organizationMembers.isOwner })
                .from(organizationMembers)
                .where(
                  and(
                    eq(organizationMembers.userId, appUser.id),
                    eq(organizationMembers.organizationId, appUser.currentOrganizationId)
                  )
                );
              token.orgRole = membership?.role ?? null;
              token.isOrgOwner = membership?.isOwner ?? false;
            } else {
              token.orgRole = null;
              token.isOrgOwner = false;
            }
          }

          token.lastRefreshedAt = now;
        } catch (err) {
          console.error("[KLLAPP] JWT refresh failed — keeping cached token:", {
            error: err instanceof Error ? err.message : String(err),
            cause: err instanceof Error && err.cause ? String(err.cause) : "no cause",
            userId: token.sub,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.appUserId = token.appUserId ?? "";
      session.user.currentOrganizationId = token.currentOrganizationId ?? null;
      session.user.orgRole = token.orgRole ?? null;
      session.user.isOrgOwner = token.isOrgOwner ?? false;
      session.user.locale = (token.locale as string) ?? "fr";
      session.user.isSuperAdmin = (token.isSuperAdmin as boolean) ?? false;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Fires AFTER authUsers row is created — FK constraint is satisfied
      if (user.email && user.id) {
        // 1. Chercher un user app pré-créé par admin (email match, pas encore lié)
        const [unlinkedUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, user.email), isNull(users.authUserId)));

        let appUserId: string;

        if (unlinkedUser) {
          await db
            .update(users)
            .set({ authUserId: user.id })
            .where(eq(users.id, unlinkedUser.id));
          appUserId = unlinkedUser.id;
        } else {
          // 2. Première connexion, aucun user pré-créé : auto-créer avec role collaborator
          const [newUser] = await db.insert(users).values({
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            authUserId: user.id,
            role: "collaborator",
          }).returning({ id: users.id });
          appUserId = newUser.id;
        }

        // 3. Lier les invitations pending envoyées à cet email + activate
        await db
          .update(organizationMembers)
          .set({ userId: appUserId, status: "active" })
          .where(
            and(
              eq(organizationMembers.email, user.email),
              isNull(organizationMembers.userId)
            )
          );

        // 4. If user has no currentOrganizationId, set it to the first org
        const [appUserRow] = await db
          .select({ currentOrganizationId: users.currentOrganizationId })
          .from(users)
          .where(eq(users.id, appUserId));

        if (!appUserRow?.currentOrganizationId) {
          const [firstMembership] = await db
            .select({ organizationId: organizationMembers.organizationId })
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.userId, appUserId),
                ne(organizationMembers.status, "declined")
              )
            );

          if (firstMembership) {
            await db
              .update(users)
              .set({ currentOrganizationId: firstMembership.organizationId })
              .where(eq(users.id, appUserId));
          }
        }
      }
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
    error: "/login",
  },
});
