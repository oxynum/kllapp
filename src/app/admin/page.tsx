import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  // Email stats by category
  const emailStats = await db.execute(sql`
    SELECT
      category,
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int as last_24h,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as last_7d,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as last_30d
    FROM email_logs
    GROUP BY category
    ORDER BY category
  `).catch(() => []);

  const rows = await db.execute(sql`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.created_at,
      (SELECT u.name FROM users u
       JOIN organization_members om ON om.user_id = u.id
       WHERE om.organization_id = o.id AND om.is_owner = true LIMIT 1) as owner_name,
      (SELECT u.email FROM users u
       JOIN organization_members om ON om.user_id = u.id
       WHERE om.organization_id = o.id AND om.is_owner = true LIMIT 1) as owner_email,
      (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = o.id AND status = 'active') as total_users,
      (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = o.id AND role = 'admin' AND status = 'active') as admin_count,
      (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = o.id AND role = 'manager' AND status = 'active') as manager_count,
      (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = o.id AND role = 'collaborator' AND status = 'active') as collaborator_count,
      (SELECT COUNT(*)::int FROM projects WHERE organization_id = o.id) as project_count,
      (SELECT COUNT(*)::int FROM clients WHERE organization_id = o.id) as client_count,
      (SELECT COUNT(*)::int FROM workplaces WHERE organization_id = o.id) as workplace_count,
      (SELECT COUNT(*)::int FROM desks WHERE organization_id = o.id) as desk_count,
      (SELECT MAX(u.updated_at) FROM users u
       JOIN organization_members om ON om.user_id = u.id
       WHERE om.organization_id = o.id) as last_activity,
      (SELECT COALESCE(SUM(te.value::numeric * COALESCE(pa.daily_rate::numeric, p.daily_rate::numeric, 0)), 0)
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       LEFT JOIN project_assignments pa ON pa.user_id = te.user_id AND pa.project_id = te.project_id
       WHERE p.organization_id = o.id AND te.type = 'worked')::numeric as total_revenue
    FROM organizations o
    ORDER BY o.created_at DESC
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <AdminDashboard organizations={rows as any[]} emailStats={emailStats as any[]} />;
}
