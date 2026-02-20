// TODO: Implement the dashboard shell layout
//
// This layout wraps all pages under /dashboard with:
//   - <Sidebar /> on the left (fixed width, full height)
//   - A main content area on the right (flex-1, scrollable)
//
// Layout sketch:
//   ┌──────────┬────────────────────────────────┐
//   │ Sidebar  │  {children}                    │
//   │ (nav)    │  (scrollable page content)     │
//   └──────────┴────────────────────────────────┘
//
// This is a server component — do NOT add "use client".
// Auth guard lives in each page (or middleware), not here.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* TODO: <Sidebar /> */}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
