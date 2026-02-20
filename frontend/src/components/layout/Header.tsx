// TODO: Implement Header
// Top header bar displayed across all dashboard pages.
//
// Contents:
//   - Left: breadcrumb or page title (passed via props)
//   - Right: logged-in user avatar + name, notification bell (alert count badge)
//
// Props:
//   - title: string — current page name shown as breadcrumb
//   - userFullName: string | null
//   - userAvatarUrl: string | null
//   - unreadAlertCount?: number — drives notification badge
//
// Behavior:
//   - Avatar click opens a small dropdown with "Profile" and "Sign out"
//   - Bell click navigates to /dashboard/alerts

type HeaderProps = {
  title: string
  userFullName: string | null
  userAvatarUrl: string | null
  unreadAlertCount?: number
}

export default function Header(_props: HeaderProps) {
  // TODO: implement
  return null
}
