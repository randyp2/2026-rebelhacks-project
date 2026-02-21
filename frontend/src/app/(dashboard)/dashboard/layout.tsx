/**
 * DashboardLayout
 *
 * Server component wrapping every /dashboard/* page.
 * Adds the dark class so all CSS variables resolve to the dark theme.
 * Sidebar is a client component (needs usePathname).
 */

import Sidebar from "@/components/layout/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex h-screen overflow-hidden bg-[#07090f]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
