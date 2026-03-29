import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
  decimal,
  date,
  boolean,
  uniqueIndex,
  primaryKey,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================
// Auth.js required tables
// ============================================================

export const authUsers = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// ============================================================
// Application enums
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "collaborator",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);

export const projectTypeEnum = pgEnum("project_type", [
  "service",
  "product",
  "training",
  "internal",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "active",
  "closed",
]);

export const timeEntryTypeEnum = pgEnum("time_entry_type", [
  "worked",
  "forecast",
  "pipeline",
]);

export const absenceTypeEnum = pgEnum("absence_type", [
  "vacation",
  "sick",
  "training",
  "remote",
  "other",
]);

export const absenceStatusEnum = pgEnum("absence_status", [
  "pending",
  "approved",
  "rejected",
]);

export const expenseCategoryTypeEnum = pgEnum("expense_category_type", [
  "salary",
  "freelance",
  "general",
  "investment",
]);

export const expenseTypeEnum = pgEnum("expense_type", ["actual", "forecast"]);

export const recurrenceEnum = pgEnum("recurrence", [
  "once",
  "monthly",
  "quarterly",
  "yearly",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "pending",
  "active",
  "declined",
]);

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "outlook",
  "apple",
  "other",
]);

// ============================================================
// Application tables — Organizations
// ============================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: userRoleEnum("role").default("collaborator"),
  isOwner: boolean("is_owner").default(false),
  status: memberStatusEnum("status").default("pending"),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
});

// ============================================================
// Application tables
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: text("auth_user_id")
    .unique()
    .references(() => authUsers.id),
  email: text("email").unique(),
  name: text("name"),
  role: userRoleEnum("role").default("collaborator"),
  hourlyCost: decimal("hourly_cost", { precision: 10, scale: 2 }),
  dailyCost: decimal("daily_cost", { precision: 10, scale: 2 }),
  hoursPerDay: decimal("hours_per_day", { precision: 4, scale: 2 }).default("7"),
  status: userStatusEnum("status").default("active"),
  locale: text("locale").default("fr"),
  currentOrganizationId: uuid("current_organization_id").references(
    () => organizations.id
  ),
  defaultWorkplaceId: uuid("default_workplace_id").references(
    () => workplaces.id, { onDelete: "set null" }
  ),
  isSuperAdmin: boolean("is_super_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contact: text("contact"),
  email: text("email"),
  billingRate: decimal("billing_rate", { precision: 10, scale: 2 }),
  isAbsence: boolean("is_absence").default(false),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  parentId: uuid("parent_id"),
  type: projectTypeEnum("type").default("service"),
  dailyRate: decimal("daily_rate"),
  fixedPrice: decimal("fixed_price"),
  budget: decimal("budget"),
  billable: boolean("billable").notNull().default(true),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: projectStatusEnum("status").default("draft"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectAssignments = pgTable("project_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role"),
  dailyRate: decimal("daily_rate"),
  dailyCost: decimal("daily_cost", { precision: 10, scale: 2 }),
});

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: decimal("value", { precision: 5, scale: 2 }).notNull(),
    type: timeEntryTypeEnum("type").default("worked"),
    probability: integer("probability"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("time_entries_user_project_date_idx").on(
      table.userId,
      table.projectId,
      table.date
    ),
  ]
);

export const absences = pgTable("absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  value: decimal("value", { precision: 3, scale: 2 }).notNull(),
  type: absenceTypeEnum("type").notNull(),
  note: text("note"),
  approvedBy: uuid("approved_by").references(() => users.id),
  status: absenceStatusEnum("status").default("pending"),
});

export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: expenseCategoryTypeEnum("type").notNull(),
  parentId: uuid("parent_id"),
  organizationId: uuid("organization_id").references(() => organizations.id),
});

export const projectDependencies = pgTable(
  "project_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceProjectId: uuid("source_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    targetProjectId: uuid("target_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("project_dependencies_source_target_idx").on(
      table.sourceProjectId,
      table.targetProjectId
    ),
  ]
);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => expenseCategories.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id),
  userId: uuid("user_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  recurrence: recurrenceEnum("recurrence").default("once"),
  type: expenseTypeEnum("type").default("actual"),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================
// Calendar integrations
// ============================================================

// ─── Workplaces (lieux de travail) ────────────────────────────
export const workplaceTypeEnum = pgEnum("workplace_type", ["remote", "office", "client"]);

export const workplaces = pgTable("workplaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: workplaceTypeEnum("type").notNull().default("office"),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userWorkplaces = pgTable(
  "user_workplaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workplaceId: uuid("workplace_id")
      .notNull()
      .references(() => workplaces.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("user_workplaces_unique").on(table.userId, table.date),
  ]
);

// ─── Email logs (for admin tracking) ────────────────────────────

export const emailCategoryEnum = pgEnum("email_category", [
  "magic_link",
  "invitation",
  "notification",
]);

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: emailCategoryEnum("category").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  sentBy: uuid("sent_by").references(() => users.id),
  subject: text("subject"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Floor plans & desk booking ─────────────────────────────────

export const floorPlans = pgTable(
  "floor_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workplaceId: uuid("workplace_id")
      .notNull()
      .references(() => workplaces.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    floorNumber: integer("floor_number").notNull().default(0),
    layout: jsonb("layout").notNull().default([]),
    width: integer("width").notNull().default(1200),
    height: integer("height").notNull().default(800),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("floor_plans_workplace_floor_idx").on(
      table.workplaceId,
      table.floorNumber
    ),
  ]
);

export const desks = pgTable("desks", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  x: decimal("x", { precision: 10, scale: 2 }).notNull(),
  y: decimal("y", { precision: 10, scale: 2 }).notNull(),
  rotation: decimal("rotation", { precision: 6, scale: 2 }).notNull().default("0"),
  width: decimal("width", { precision: 10, scale: 2 }).notNull().default("60"),
  height: decimal("height", { precision: 10, scale: 2 }).notNull().default("40"),
  isAvailable: boolean("is_available").default(true),
  zone: text("zone"),
  groupId: text("group_id"),
  visible: boolean("visible").default(true),
  locked: boolean("locked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const deskBookings = pgTable(
  "desk_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deskId: uuid("desk_id")
      .notNull()
      .references(() => desks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    bookedBy: uuid("booked_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("desk_bookings_desk_date_idx").on(table.deskId, table.date),
    index("desk_bookings_user_date_idx").on(table.userId, table.date),
  ]
);

// ─── Project forecasts (previsionnel) ────────────────────────────
export const projectForecasts = pgTable(
  "project_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: decimal("value", { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("project_forecasts_unique").on(table.projectId, table.date),
  ]
);

export const calendarIntegrations = pgTable("calendar_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: calendarProviderEnum("provider").notNull(),
  icsUrl: text("ics_url").notNull(),
  label: text("label").notNull(),
  color: text("color"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// Calendar shares (many-to-many: calendar ↔ user)
// ============================================================

export const calendarShares = pgTable("calendar_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarIntegrationId: uuid("calendar_integration_id")
    .notNull()
    .references(() => calendarIntegrations.id, { onDelete: "cascade" }),
  sharedWithUserId: uuid("shared_with_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("calendar_shares_unique").on(table.calendarIntegrationId, table.sharedWithUserId),
]);

// ============================================================
// Relations
// ============================================================

export const authUsersRelations = relations(authUsers, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  user: one(users, {
    fields: [authUsers.id],
    references: [users.authUserId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  authUser: one(authUsers, {
    fields: [accounts.userId],
    references: [authUsers.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  authUser: one(authUsers, {
    fields: [sessions.userId],
    references: [authUsers.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  clients: many(clients),
  projects: many(projects),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  authUser: one(authUsers, {
    fields: [users.authUserId],
    references: [authUsers.id],
  }),
  currentOrganization: one(organizations, {
    fields: [users.currentOrganizationId],
    references: [organizations.id],
  }),
  organizationMemberships: many(organizationMembers),
  timeEntries: many(timeEntries),
  projectAssignments: many(projectAssignments),
  absences: many(absences),
  expenses: many(expenses),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  parent: one(projects, {
    fields: [projects.parentId],
    references: [projects.id],
    relationName: "projectHierarchy",
  }),
  subProjects: many(projects, {
    relationName: "projectHierarchy",
  }),
  timeEntries: many(timeEntries),
  projectAssignments: many(projectAssignments),
  expenses: many(expenses),
  dependenciesAsSource: many(projectDependencies, {
    relationName: "dependencySource",
  }),
  dependenciesAsTarget: many(projectDependencies, {
    relationName: "dependencyTarget",
  }),
}));

export const projectAssignmentsRelations = relations(
  projectAssignments,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectAssignments.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectAssignments.userId],
      references: [users.id],
    }),
  })
);

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [timeEntries.projectId],
    references: [projects.id],
  }),
}));

export const absencesRelations = relations(absences, ({ one }) => ({
  user: one(users, {
    fields: [absences.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [absences.approvedBy],
    references: [users.id],
  }),
}));

export const projectDependenciesRelations = relations(
  projectDependencies,
  ({ one }) => ({
    sourceProject: one(projects, {
      fields: [projectDependencies.sourceProjectId],
      references: [projects.id],
      relationName: "dependencySource",
    }),
    targetProject: one(projects, {
      fields: [projectDependencies.targetProjectId],
      references: [projects.id],
      relationName: "dependencyTarget",
    }),
  })
);

export const expenseCategoriesRelations = relations(
  expenseCategories,
  ({ one, many }) => ({
    parent: one(expenseCategories, {
      fields: [expenseCategories.parentId],
      references: [expenseCategories.id],
      relationName: "categoryHierarchy",
    }),
    children: many(expenseCategories, {
      relationName: "categoryHierarchy",
    }),
    expenses: many(expenses),
  })
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [expenses.organizationId],
    references: [organizations.id],
  }),
}));

export const calendarIntegrationsRelations = relations(
  calendarIntegrations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [calendarIntegrations.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [calendarIntegrations.organizationId],
      references: [organizations.id],
    }),
    shares: many(calendarShares),
  })
);

export const calendarSharesRelations = relations(
  calendarShares,
  ({ one }) => ({
    calendarIntegration: one(calendarIntegrations, {
      fields: [calendarShares.calendarIntegrationId],
      references: [calendarIntegrations.id],
    }),
    sharedWithUser: one(users, {
      fields: [calendarShares.sharedWithUserId],
      references: [users.id],
    }),
  })
);

// ============================================================
// Floor plan & desk booking relations
// ============================================================

export const floorPlansRelations = relations(floorPlans, ({ one, many }) => ({
  workplace: one(workplaces, {
    fields: [floorPlans.workplaceId],
    references: [workplaces.id],
  }),
  organization: one(organizations, {
    fields: [floorPlans.organizationId],
    references: [organizations.id],
  }),
  desks: many(desks),
}));

export const desksRelations = relations(desks, ({ one, many }) => ({
  floorPlan: one(floorPlans, {
    fields: [desks.floorPlanId],
    references: [floorPlans.id],
  }),
  organization: one(organizations, {
    fields: [desks.organizationId],
    references: [organizations.id],
  }),
  bookings: many(deskBookings),
}));

export const deskBookingsRelations = relations(deskBookings, ({ one }) => ({
  desk: one(desks, {
    fields: [deskBookings.deskId],
    references: [desks.id],
  }),
  user: one(users, {
    fields: [deskBookings.userId],
    references: [users.id],
    relationName: "deskBookingUser",
  }),
  bookedByUser: one(users, {
    fields: [deskBookings.bookedBy],
    references: [users.id],
    relationName: "deskBookingBookedBy",
  }),
  organization: one(organizations, {
    fields: [deskBookings.organizationId],
    references: [organizations.id],
  }),
}));
