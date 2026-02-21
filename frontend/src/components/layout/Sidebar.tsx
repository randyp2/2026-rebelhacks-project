"use client"
/**
 * Sidebar
 *
 * Fixed-width navigation rail for all dashboard pages.
 * Active route is highlighted via usePathname().
 * Sign-out navigates to the /logout page.
 */

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Shield,
  LayoutDashboard,
  Hotel,
  Bell,
  Users,
  Settings,
  LogOut,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard",         label: "Overview", icon: LayoutDashboard, exact: true  },
  { href: "/dashboard/rooms",   label: "Rooms",    icon: Hotel,           exact: false },
  { href: "/dashboard/alerts",  label: "Alerts",   icon: Bell,            exact: false },
  { href: "/dashboard/persons", label: "Persons",  icon: Users,           exact: false },
  { href: "/dashboard/settings",label: "Settings", icon: Settings,        exact: false },
] as const

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-white/8 bg-[#080d14]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/8 px-4">
        <Shield className="h-5 w-5 shrink-0 text-blue-400" />
        <span className="text-sm font-bold tracking-tight text-slate-100">HotelGuard</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "text-blue-400 font-medium hover:bg-white/5"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/8 p-2">
        <button
          type="button"
          onClick={() => router.push("/logout")}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
