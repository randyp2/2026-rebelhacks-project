/**
 * DashboardPage
 *
 * Streams the dashboard shell immediately and resolves Supabase-backed
 * user + risk/alert data behind a Suspense boundary to avoid blocking route
 * navigation on uncached fetches.
 */

import { Suspense } from "react";
import DashboardClient from "@/components/dashboard/DashboardClient";
import {
	getDashboardRooms,
	getPersonsWithRisk,
	getRecentAlerts,
	type PersonWithRiskRow,
} from "@/lib/supabase/queries";
import { createServerSupabaseClient } from "@/utils/supabase/server";

function DashboardFallback() {
	return (
		<div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
			Loading dashboard...
		</div>
	);
}

type TiedPerson = {
	name: string;
	riskLevel: PersonWithRiskRow["risk_level"];
	riskScore: PersonWithRiskRow["risk_score"];
};

function buildRoomToPeople(persons: PersonWithRiskRow[]): Record<string, TiedPerson[]> {
	const roomToPeopleByName = new Map<string, Map<string, TiedPerson>>();

	for (const person of persons) {
		for (const roomId of person.current_rooms) {
			if (!roomToPeopleByName.has(roomId)) {
				roomToPeopleByName.set(roomId, new Map<string, TiedPerson>());
			}

			roomToPeopleByName.get(roomId)?.set(person.full_name, {
				name: person.full_name,
				riskLevel: person.risk_level,
				riskScore: person.risk_score,
			});
		}
	}

	const roomToPeople: Record<string, TiedPerson[]> = {};
	for (const [roomId, peopleByName] of roomToPeopleByName.entries()) {
		roomToPeople[roomId] = Array.from(peopleByName.values()).sort((left, right) =>
			left.name.localeCompare(right.name),
		);
	}

	return roomToPeople;
}

async function DashboardPageContent() {
	const supabase = await createServerSupabaseClient();

	// Parallel fetch — all queries run concurrently
	const [rooms, alerts, persons] = await Promise.all([
		getDashboardRooms(supabase).catch(() => []),
		getRecentAlerts(supabase).catch(() => []),
		getPersonsWithRisk(supabase).catch(() => []),
	]);

	const roomToPeople = buildRoomToPeople(persons);

	return (
		<DashboardClient
			initialRooms={rooms}
			initialAlerts={alerts}
			initialRoomToPeople={roomToPeople}
		/>
	);
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<DashboardFallback />}>
			<DashboardPageContent />
		</Suspense>
	);
}
