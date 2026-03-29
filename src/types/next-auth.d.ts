import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      appUserId: string;
      currentOrganizationId: string | null;
      orgRole: string | null;
      isOrgOwner: boolean;
      isSuperAdmin: boolean;
      locale: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    currentOrganizationId?: string | null;
    orgRole?: string | null;
    isOrgOwner?: boolean;
    isSuperAdmin?: boolean;
    locale?: string;
  }
}
