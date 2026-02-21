"use client";

/**
 * Sidebar
 *
 * Fixed-width navigation rail for all dashboard pages.
 * Active route is highlighted via usePathname().
 * Sign-out navigates to the /logout page.
 */

import {
	Bell,
	LayoutDashboard,
	LogOut,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
	{ href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
	{ href: "/dashboard/alerts", label: "Alerts", icon: Bell, exact: false },
	{ href: "/dashboard/persons", label: "Persons", icon: Users, exact: false },
	{
		href: "/dashboard/settings",
		label: "Settings",
		icon: Settings,
		exact: false,
	},
] as const;

type SidebarProps = {
	userFullName: string | null;
};

export default function Sidebar({ userFullName }: SidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const initials = useMemo(() => {
		if (!userFullName) return "?";
		return userFullName
			.split(" ")
			.map((name) => name[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
	}, [userFullName]);

	useEffect(() => {
		if (!menuOpen) return;
		const onDocumentClick = (event: MouseEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		};
		const onEsc = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDocumentClick);
		document.addEventListener("keydown", onEsc);
		return () => {
			document.removeEventListener("mousedown", onDocumentClick);
			document.removeEventListener("keydown", onEsc);
		};
	}, [menuOpen]);

	return (
		<aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-background">
			{/* Logo */}
			<div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
				<Shield className="h-5 w-5 shrink-0 text-primary" />
				<span className="text-sm font-bold tracking-tight text-foreground">
					HotelGuard
				</span>
			</div>

			{/* Nav links */}
			<nav className="flex-1 space-y-0.5 px-2 py-3">
				{NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
					const active = exact ? pathname === href : pathname.startsWith(href);
					return (
						<Link
							key={href}
							href={href}
							className={[
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
								active
									? "bg-accent text-foreground font-medium"
									: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							].join(" ")}
						>
							<Icon className="h-4 w-4 shrink-0" />
							{label}
						</Link>
					);
				})}
			</nav>

			{/* Avatar menu */}
			<div className="relative border-t border-border p-3" ref={menuRef}>
				{menuOpen && (
					<div className="absolute bottom-full left-3 mb-2 w-52 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg shadow-black/20">
						<div className="px-2 py-1.5 text-xs text-foreground/80">
							{userFullName ?? "Unknown user"}
						</div>
						<button
							type="button"
							onClick={() => router.push("/logout")}
							className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
						>
							<LogOut className="h-4 w-4 shrink-0" />
							Sign out
						</button>
					</div>
				)}
				<button
					type="button"
					onClick={() => setMenuOpen((prev) => !prev)}
					className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition hover:ring-2 hover:ring-ring/40"
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					aria-label="Open account menu"
				>
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
						{initials}
					</div>
				</button>
			</div>
		</aside>
	);
}
