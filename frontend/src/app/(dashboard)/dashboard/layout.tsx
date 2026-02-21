/**
 * DashboardLayout
 *
 * Server component wrapping every /dashboard/* page.
 * Sidebar is a client component (needs usePathname).
 */

import DashboardHeader from "@/components/layout/DashboardHeader"
import Sidebar from "@/components/layout/Sidebar"
import { createServerSupabaseClient } from "@/utils/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()

  const user = authData.user
  const userFullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
      <Sidebar userFullName={userFullName} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
