import { FloatingNav } from "@/components/ui/sidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="relative h-screen overflow-hidden">
      <main className="h-full overflow-auto bg-gray-50">{children}</main>
      <FloatingNav />
    </div>
  );
}
