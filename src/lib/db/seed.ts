import { config } from "dotenv";
config({ path: ".env.local" });

async function seed() {
  const { db } = await import("./index");
  const { clients, projects, expenseCategories } = await import("./schema");

  console.log("Seeding database...");

  // Create expense categories
  await db.insert(expenseCategories).values([
    { name: "Masse salariale", type: "salary" },
    { name: "Sous-traitance", type: "freelance" },
    { name: "Loyer", type: "general" },
    { name: "Abonnements SaaS", type: "general" },
    { name: "Déplacements", type: "general" },
    { name: "Matériel informatique", type: "investment" },
  ]);

  console.log("Expense categories created");

  // Create sample client
  const [client1] = await db
    .insert(clients)
    .values({
      name: "Acme Corp",
      contact: "Jean Dupont",
      email: "jean@acme.com",
      billingRate: "650",
    })
    .returning();

  console.log("Client created");

  // Create sample project
  await db.insert(projects).values({
    name: "Refonte SI",
    clientId: client1.id,
    type: "service",
    dailyRate: "650",
    budget: "120000",
    status: "active",
  });

  console.log("Project created");

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
