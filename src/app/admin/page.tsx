import { requireSuperadmin } from "@/lib/auth/context";

export default async function AdminHome() {
  const { user } = await requireSuperadmin();
  return <h1 className="p-8 text-2xl font-semibold">Plataforma · {user.name}</h1>;
}
