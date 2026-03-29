import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL!, {
  max: 1,
  connect_timeout: 10,
});

async function migrate() {
  console.log("[migrate] Running production migrations...");

  // 0001: Add is_absence column to clients
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_absence boolean DEFAULT false`;
  console.log("[migrate] ✓ clients.is_absence");

  // 0002: Calendar integrations
  await sql`DO $$ BEGIN CREATE TYPE calendar_provider AS ENUM ('google','outlook','apple','other'); EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`CREATE TABLE IF NOT EXISTS calendar_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    ics_url text NOT NULL,
    label text NOT NULL,
    color text,
    is_enabled boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`;
  console.log("[migrate] ✓ calendar_integrations");

  // 0003: Calendar shares (many-to-many: calendar ↔ user)
  await sql`CREATE TABLE IF NOT EXISTS calendar_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_integration_id uuid NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    shared_with_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS calendar_shares_unique ON calendar_shares (calendar_integration_id, shared_with_user_id)`;
  console.log("[migrate] ✓ calendar_shares");

  // 0004: Project forecasts (previsionnel)
  await sql`CREATE TABLE IF NOT EXISTS project_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date date NOT NULL,
    value decimal(5,2) NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS project_forecasts_unique ON project_forecasts (project_id, date)`;
  console.log("[migrate] ✓ project_forecasts");

  // 0005: Workplaces (lieux de travail)
  await sql`DO $$ BEGIN
    CREATE TYPE workplace_type AS ENUM ('remote', 'office', 'client');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`CREATE TABLE IF NOT EXISTS workplaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type workplace_type NOT NULL DEFAULT 'office',
    address text,
    latitude decimal(10,7),
    longitude decimal(10,7),
    color text,
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS user_workplaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workplace_id uuid NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date date NOT NULL,
    created_at timestamp DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_workplaces_unique ON user_workplaces (user_id, date)`;
  console.log("[migrate] ✓ workplaces + user_workplaces");

  // 0006: Default workplace for users
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_workplace_id uuid REFERENCES workplaces(id) ON DELETE SET NULL`;
  console.log("[migrate] ✓ users.default_workplace_id");

  // 0008: Floor plans, desks, desk bookings
  await sql`CREATE TABLE IF NOT EXISTS floor_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workplace_id uuid NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    floor_number integer NOT NULL DEFAULT 0,
    layout jsonb NOT NULL DEFAULT '[]'::jsonb,
    width integer NOT NULL DEFAULT 1200,
    height integer NOT NULL DEFAULT 800,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS floor_plans_workplace_floor_idx ON floor_plans (workplace_id, floor_number)`;

  await sql`CREATE TABLE IF NOT EXISTS desks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id uuid NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    label text NOT NULL,
    x decimal(10,2) NOT NULL,
    y decimal(10,2) NOT NULL,
    rotation decimal(6,2) NOT NULL DEFAULT '0',
    width decimal(10,2) NOT NULL DEFAULT '60',
    height decimal(10,2) NOT NULL DEFAULT '40',
    is_available boolean DEFAULT true,
    zone text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS desk_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    desk_id uuid NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date date NOT NULL,
    booked_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS desk_bookings_desk_date_idx ON desk_bookings (desk_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS desk_bookings_user_date_idx ON desk_bookings (user_id, date)`;
  console.log("[migrate] ✓ floor_plans + desks + desk_bookings");

  // 0010: Desk group/visible/locked columns
  await sql`ALTER TABLE desks ADD COLUMN IF NOT EXISTS group_id text`;
  await sql`ALTER TABLE desks ADD COLUMN IF NOT EXISTS visible boolean DEFAULT true`;
  await sql`ALTER TABLE desks ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false`;
  console.log("[migrate] ✓ desks.group_id, visible, locked");

  // 0009: Email logs for admin tracking
  await sql`DO $$ BEGIN
    CREATE TYPE email_category AS ENUM ('magic_link', 'invitation', 'notification');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`CREATE TABLE IF NOT EXISTS email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category email_category NOT NULL,
    recipient_email text NOT NULL,
    organization_id uuid REFERENCES organizations(id),
    sent_by uuid REFERENCES users(id),
    subject text,
    created_at timestamp DEFAULT now()
  )`;
  console.log("[migrate] ✓ email_logs");

  // 0007: Super admin flag
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false`;
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (adminEmail) {
    await sql`UPDATE users SET is_super_admin = true WHERE email = ${adminEmail} AND is_super_admin = false`;
    console.log(`[migrate] ✓ users.is_super_admin (${adminEmail})`);
  } else {
    console.log("[migrate] ⚠ SUPER_ADMIN_EMAIL not set, skipping super-admin promotion");
  }

  await sql.end();
  console.log("[migrate] Done.");
}

migrate().catch((err) => {
  console.error("[migrate] Failed:", err.message);
  process.exit(1);
});
