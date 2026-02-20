"use client"
/**
 * Header
 *
 * Top bar rendered above the main content area on every dashboard page.
 * Shows the current page title, a notification bell (with badge), and user avatar.
 */

import Link from "next/link"
import { Bell } from "lucide-react"

type HeaderProps = {
  title: string
  userFullName: string | null
  userAvatarUrl: string | null
  unreadAlertCount?: number
}

export default function Header({
  title,
  userFullName,
  unreadAlertCount = 0,
}: HeaderProps) {
  const initials = userFullName
    ? userFullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?"

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 bg-[#080d14] px-6">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">SafeStay AI</span>
        <span className="text-slate-600">/</span>
        <h1 className="text-sm font-semibold text-slate-200">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Alert bell */}
        <Link
          href="/dashboard/alerts"
          className="relative rounded p-1 text-slate-400 transition-colors hover:text-slate-200"
          aria-label={`${unreadAlertCount} unread alerts`}
        >
          <Bell className="h-4 w-4" />
          {unreadAlertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
            </span>
          )}
        </Link>

        {/* User avatar */}
        {userFullName && (
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[11px] font-bold text-white"
              aria-label={userFullName}
            >
              {initials}
            </div>
            <span className="max-w-[120px] truncate text-xs text-slate-400">{userFullName}</span>
          </div>
        )}
      </div>
    </header>
  )
}
