"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";

function getTitleFromPathname(pathname: string): string {
	if (pathname === "/dashboard") return "Overview";
	if (pathname.startsWith("/dashboard/alerts")) return "Alerts";
	if (pathname.startsWith("/dashboard/persons")) return "Persons";
	if (pathname.startsWith("/dashboard/settings")) return "Settings";
	return "Dashboard";
}

export default function DashboardHeader() {
	const pathname = usePathname();
	const title = getTitleFromPathname(pathname);

	return <Header title={title} />;
}
