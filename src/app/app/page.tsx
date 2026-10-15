import { PageHeader } from "@/components/page";
import { requireOrgContext } from "@/lib/auth/context";

export default async function DashboardPage() {
  const ctx = await requireOrgContext("dashboard:read");
  return <PageHeader title={`Hola, ${ctx.user.name.split(" ")[0]}`} description={ctx.org.name} />;
}
