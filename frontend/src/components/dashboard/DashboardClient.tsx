"use client";

/**
 * DashboardClient
 *
 * The interactive shell of the overview page.
 * Owns all state: selectedFloor, selectedRoom.
 * Building3D is lazy-loaded (ssr: false) to keep Three.js off the server.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────┬──────────────────┐
/**
 * Layout (desktop):
 *   ┌──────────────────────────────────┬──────────────────┐
 *   │  3D Building (top)               │  RoomDetailsPanel │
 *   │  FloorHeatmap (when floor set)   │  NotificationList │
 *   └──────────────────────────────────┴──────────────────┘
 */

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { NotificationList } from "@/components/animate-ui/components/community/notification-list";
import FloorHeatmap from "@/components/heatmap/FloorHeatmap";
import RoomDetailsPanel from "@/components/panels/RoomDetailsPanel";
import { useAlerts } from "@/hooks/useAlerts";
import type { EnrichedRoom } from "@/hooks/useRoomRisk";
import { useRoomRisk } from "@/hooks/useRoomRisk";
import type { DashboardRoom } from "@/types/dashboard";
import type { AlertRow } from "@/types/database";
import Spinner from "../ui/spinner";

// Lazy-load the Canvas so Three.js is never bundled into the server render
const Building3D = dynamic(() => import("@/components/building/Building3D"), {
	ssr: false,
	loading: () => <Spinner />,
});

type Props = {
	initialRooms: DashboardRoom[];
	initialAlerts: AlertRow[];
	initialRoomToPeople: Record<
		string,
		{
			name: string;
			riskLevel: string | null;
			riskScore: number | null;
		}[]
	>;
};

function AlertFeedFallback() {
	return (
		<div className="flex h-full flex-col">
			<div className="mb-3 flex shrink-0 items-center justify-between">
				<span className="text-sm font-semibold text-foreground">
					Live Alerts
				</span>
				<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
					Loading...
				</span>
			</div>
			<div className="space-y-2">
				{Array.from({ length: 3 }).map((_, idx) => (
					<div
						key={idx}
						className="rounded-md border border-border bg-accent/50 p-3"
					>
						<div className="mb-2 h-3 w-28 animate-pulse rounded bg-slate-700/40" />
						<div className="mb-2 h-3 w-full animate-pulse rounded bg-slate-700/30" />
						<div className="h-3 w-20 animate-pulse rounded bg-slate-700/25" />
					</div>
				))}
			</div>
		</div>
	);
}

export default function DashboardClient({
	initialRooms,
	initialAlerts,
	initialRoomToPeople,
}: Props) {
	const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<EnrichedRoom | null>(null);
	const [isFloorMapOpen, setIsFloorMapOpen] = useState(false);

	const { rooms, floorData } = useRoomRisk(initialRooms);
	const alerts = useAlerts(initialAlerts);

	const floorRooms = useMemo(
		() =>
			selectedFloor !== null
				? rooms.filter((r) => r.floor === selectedFloor)
				: [],
		[rooms, selectedFloor],
	);

	const handleFloorSelect = (floor: number | null) => {
		setSelectedFloor(floor);
		if (floor === null) setIsFloorMapOpen(false);
		setSelectedRoom(null);
	};

	// For the 2D heatmap (receives full EnrichedRoom)
	const handleRoomSelect = (room: EnrichedRoom) => {
		setSelectedRoom((prev) => (prev?.room_id === room.room_id ? null : room));
	};

	// For the 3D building tiles (receives only roomId string)
	const handleRoomSelectById = useCallback(
		(roomId: string) => {
			const room = rooms.find((r) => r.room_id === roomId) ?? null;
			if (!room) return;
			setSelectedRoom((prev) => (prev?.room_id === roomId ? null : room));
		},
		[rooms],
	);

	return (
		<div className="flex min-h-full gap-4 p-4">
			{/* ── Left column: 3D view ── */}
			<div className="flex min-w-0 flex-1 flex-col gap-4">
				<div className="rounded-lg border border-primary/10 overflow-hidden h-[820px]">
					<div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
						<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Building Overview
						</span>
						{selectedFloor ? (
							<span className="text-[10px] text-muted-foreground">
								— Floor {selectedFloor} selected · click again to deselect
							</span>
						) : (
							<span className="text-[10px] text-muted-foreground">
								— Click a floor to drill down
							</span>
						)}
					</div>
					<Building3D
						floors={floorData}
						selectedFloor={selectedFloor}
						onFloorSelect={handleFloorSelect}
						onRoomSelect={handleRoomSelectById}
					/>
				</div>

				{selectedFloor !== null && isFloorMapOpen ? (
					<FloorHeatmap
						floor={selectedFloor}
						rooms={floorRooms}
						selectedRoomId={selectedRoom?.room_id ?? null}
						onRoomSelect={handleRoomSelect}
						onMinimize={() => setIsFloorMapOpen(false)}
					/>
				) : selectedFloor === null ? (
					<div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8">
						<p className="text-xs italic text-muted-foreground">
							Select a floor to see the room layout
						</p>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setIsFloorMapOpen(true)}
						className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card py-8 text-xs font-medium text-foreground/90 transition hover:bg-accent hover:text-foreground"
					>
						Click to expand floor map
					</button>
				)}
			</div>

			{/* ── Right column: details + alert feed ── */}
			<div className="flex w-72 shrink-0 flex-col gap-4">
				{/* Room details panel (conditional) */}
					{selectedRoom && (
						<RoomDetailsPanel
							room={selectedRoom}
							alerts={alerts}
							tiedPeople={initialRoomToPeople[selectedRoom.room_id] ?? []}
							onClose={() => setSelectedRoom(null)}
						/>
					)}

				{/* Alert list — always visible */}
				<div className="flex min-h-0 flex-1 flex-col">
					<NotificationList alerts={alerts} />
				</div>
			</div>
		</div>
	);
}
