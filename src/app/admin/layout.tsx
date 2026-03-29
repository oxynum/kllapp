import { requireSuperAdmin } from "@/lib/auth-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
