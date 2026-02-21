// Full-page view of the alerts feed with filtering and sorting.
//
// Features:
//   - Filter by room_id, risk_score threshold, and date range
//   - Sort by timestamp (default: newest first) or risk_score
//   - Paginate: 25 alerts per page
//   - Each alert row links to the associated room detail
//   - Export to CSV button (TODO: implement client-side CSV download)
//
// Server component:
//   1. Fetch recent alert rows.
//   2. Render a table of currently alerted rooms (latest alert per room).
import { UltraQualityDataTable } from "@/components/ui/ultra-quality-data-table";
import {
	getPersonsWithRisk,
	getRecentAlerts,
	type PersonWithRiskRow,
} from "@/lib/supabase/queries";
import type { AlertRow } from "@/types/database";
import { createServerSupabaseClient } from "@/utils/supabase/server";

type AlertWithTiedPersons = AlertRow & {
	tied_person_names: string[];
};

function buildRoomToNames(persons: PersonWithRiskRow[]): Map<string, string[]> {
	const roomToNamesSet = new Map<string, Set<string>>();

	for (const person of persons) {
		for (const roomId of person.current_rooms) {
			if (!roomToNamesSet.has(roomId)) {
				roomToNamesSet.set(roomId, new Set<string>());
			}
			roomToNamesSet.get(roomId)?.add(person.full_name);
		}
	}

	const roomToNames = new Map<string, string[]>();
	for (const [roomId, names] of roomToNamesSet.entries()) {
		roomToNames.set(
			roomId,
			Array.from(names).sort((left, right) => left.localeCompare(right)),
		);
	}

	return roomToNames;
}

function buildPersonIdToName(persons: PersonWithRiskRow[]): Map<string, string> {
	const personIdToName = new Map<string, string>();
	for (const person of persons) {
		if (person.full_name.trim().length === 0) continue;
		personIdToName.set(person.id, person.full_name);
	}
	return personIdToName;
}

function normalizeAlert(
	alert: AlertRow,
	personIdToName: Map<string, string>,
	roomToNames: Map<string, string[]>,
): AlertWithTiedPersons {
	const directPersonName = alert.person_id
		? personIdToName.get(alert.person_id)
		: null;

	return {
		...alert,
		explanation: alert.explanation,
		tied_person_names:
			directPersonName !== null && directPersonName !== undefined
				? [directPersonName]
				: alert.room_id
					? (roomToNames.get(alert.room_id) ?? [])
					: [],
	};
}

export default async function AlertsPage() {
	const supabase = await createServerSupabaseClient();
	const [alerts, persons] = await Promise.all([
		getRecentAlerts(supabase, 500).catch(() => []),
		getPersonsWithRisk(supabase).catch(() => []),
	]);

	const personIdToName = buildPersonIdToName(persons);
	const roomToNames = buildRoomToNames(persons);
	const normalizedAlerts = alerts.map((alert) =>
		normalizeAlert(alert, personIdToName, roomToNames),
	);

	return (
		<div className="h-full overflow-auto p-4">
			<h1 className="mb-4 text-2xl font-bold">Alerts</h1>
			<UltraQualityDataTable alerts={normalizedAlerts} />
		</div>
	);
}
