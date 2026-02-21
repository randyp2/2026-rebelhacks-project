"use client";

import { MonitorCog, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ThemeMode = "night" | "system" | "day";

const STORAGE_KEY = "dashboard_theme_mode";
const CYCLE_ORDER: ThemeMode[] = ["night", "system", "day"];

function applyMode(mode: ThemeMode) {
	const root = document.documentElement;
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const shouldUseDark = mode === "night" || (mode === "system" && prefersDark);
	root.classList.toggle("dark", shouldUseDark);
}

export default function ThemeCycleButton() {
	const [mode, setMode] = useState<ThemeMode>("system");

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
		const initialMode =
			stored === "night" || stored === "system" || stored === "day"
				? stored
				: "system";
		queueMicrotask(() => setMode(initialMode));
		applyMode(initialMode);
	}, []);

	useEffect(() => {
		if (mode !== "system") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onSystemThemeChange = () => applyMode("system");
		media.addEventListener("change", onSystemThemeChange);
		return () => media.removeEventListener("change", onSystemThemeChange);
	}, [mode]);

	const label = useMemo(() => {
		if (mode === "night") return "Night";
		if (mode === "day") return "Day";
		return "System";
	}, [mode]);

	const Icon = useMemo(() => {
		if (mode === "night") return Moon;
		if (mode === "day") return Sun;
		return MonitorCog;
	}, [mode]);

	const cycleTheme = () => {
		const nextMode =
			CYCLE_ORDER[(CYCLE_ORDER.indexOf(mode) + 1) % CYCLE_ORDER.length];
		setMode(nextMode);
		localStorage.setItem(STORAGE_KEY, nextMode);
		applyMode(nextMode);
	};

	return (
		<button
			type="button"
			onClick={cycleTheme}
			className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
			aria-label={`Theme: ${label}. Click to cycle theme mode.`}
			title={`Theme: ${label}`}
		>
			<Icon className="h-3.5 w-3.5" />
		</button>
	);
}
