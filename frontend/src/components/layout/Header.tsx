"use client";

/**
 * Header
 *
 * Top bar rendered above the main content area on every dashboard page.
 * Shows the current page title and the theme cycle button.
 */

import ThemeCycleButton from "@/components/layout/ThemeCycleButton";

type HeaderProps = {
	title: string;
};

export default function Header({ title }: HeaderProps) {
	return (
		<header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
			{/* Page title */}
			<div className="flex items-center gap-2">
				<span className="text-[10px] uppercase tracking-widest text-muted-foreground">
					HG
				</span>
				<span className="text-muted-foreground">/</span>
				<h1 className="text-sm font-semibold text-foreground">{title}</h1>
			</div>

			<ThemeCycleButton />
		</header>
	);
}
