import { redirect } from "next/navigation"
import { getUser } from "@/lib/auth"

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  // Redirect to role-specific dashboard
  switch (user.profile?.role) {
    case "business":
      redirect("/dashboard/business")
    case "transport":
      redirect("/dashboard/transport")
    default:
      redirect("/dashboard/user")
  }
}
