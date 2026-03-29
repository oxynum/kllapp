/**
 * One-shot migration script: creates a default organization and links all
 * existing users, clients, and projects to it.
 *
 * Run with: npx tsx src/lib/db/migrate-to-orgs.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { isNull } from "drizzle-orm";

async function migrate() {
  // Dynamic imports so env is loaded before DB connection is created
  const { db } = await import("./index");
  const {
    organizations,
    organizationMembers,
    users,
    clients,
    projects,
    expenseCategories,
  } = await import("./schema");

  console.log("Starting migration to organizations...");

  // 1. Create default organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Mon Organisation",
      slug: "default",
    })
    .returning();

  console.log(`Created organization: ${org.name} (${org.id})`);

  // 2. Fetch all existing users
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users to migrate`);

  // Find the first admin to mark as owner
  const firstAdmin = allUsers.find((u) => u.role === "admin");

  // 3. Create memberships for all users
  for (const user of allUsers) {
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      email: user.email ?? "",
      role: user.role ?? "collaborator",
      isOwner: firstAdmin ? user.id === firstAdmin.id : allUsers.indexOf(user) === 0,
      status: "active",
      joinedAt: new Date(),
    });
  }
  console.log(`Created ${allUsers.length} organization memberships`);

  // 4. Set currentOrganizationId on all users
  await db
    .update(users)
    .set({ currentOrganizationId: org.id })
    .where(isNull(users.currentOrganizationId));
  console.log("Updated users.currentOrganizationId");

  // 5. Assign all clients to the default org
  await db
    .update(clients)
    .set({ organizationId: org.id })
    .where(isNull(clients.organizationId));
  console.log("Updated clients.organizationId");

  // 6. Assign all projects to the default org
  await db
    .update(projects)
    .set({ organizationId: org.id })
    .where(isNull(projects.organizationId));
  console.log("Updated projects.organizationId");

  // 7. Assign all expense categories to the default org
  await db
    .update(expenseCategories)
    .set({ organizationId: org.id })
    .where(isNull(expenseCategories.organizationId));
  console.log("Updated expenseCategories.organizationId");

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
