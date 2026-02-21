"use client";

/**
 * Building3D
 *
 * Three.js scene showing a stacked floor-plan of the hotel.
 * Receives pre-aggregated FloorData[] — no data fetching here.
 *
 * Interaction:
 *   Click a floor slab → calls onFloorSelect(floor)
 *   Click a room tile  → calls onRoomSelect(roomId)
 *   OrbitControls for rotate/zoom (pan disabled)
 */

import { OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { FloorData } from "@/hooks/useRoomRisk";
import FloorMesh from "./FloorMesh";

const FLOOR_GAP = 1.4; // vertical distance between floor centres
const NEUTRAL_FLOOR_DOT = "#64748b";

type Building3DProps = {
	floors: FloorData[];
	selectedFloor: number | null;
	onFloorSelect: (floor: number) => void;
	onRoomSelect: (roomId: string) => void;
};

type CameraRigProps = {
	targetPosition: [number, number, number];
	targetLookAt: [number, number, number];
};

function CameraRig({ targetPosition, targetLookAt }: CameraRigProps) {
	const { camera } = useThree();
	const targetPos = useMemo(() => new THREE.Vector3(), []);
	const targetCtr = useMemo(() => new THREE.Vector3(), []);

	useEffect(() => {
		return () => {
			camera.up.set(0, 1, 0);
		};
	}, [camera]);

	useFrame((_, delta) => {
		const t = 1 - Math.exp(-delta * 4);
		targetPos.set(...targetPosition);
		targetCtr.set(...targetLookAt);
		camera.position.lerp(targetPos, t);
		// Stabilize top-down orientation and prevent sideways roll.
		camera.up.set(0, 0, -1);
		camera.lookAt(targetCtr);
	});

	return null;
}

export default function Building3D({
	floors,
	selectedFloor,
	onFloorSelect,
	onRoomSelect,
}: Building3DProps) {
	const isFloorView = selectedFloor !== null;
	const floorOptions = useMemo(
		() => [...floors].sort((a, b) => a.floor - b.floor),
		[floors],
	);

	// Keep the camera centred on the building regardless of floor count
	const cameraY = useMemo(() => {
		if (!floors.length) return 2;
		const maxFloor = Math.max(...floors.map((f) => f.floor));
		return ((maxFloor - 1) * FLOOR_GAP) / 2;
	}, [floors]);

	const cameraZ = useMemo(() => {
		return Math.max(16, 11 + floors.length * 1.4);
	}, [floors.length]);

	const selectedY = useMemo(() => {
		if (selectedFloor === null) return cameraY;
		return (selectedFloor - 1) * FLOOR_GAP;
	}, [selectedFloor, cameraY]);

	const cameraPosition = useMemo<[number, number, number]>(() => {
		if (isFloorView) return [0, selectedY + 32, 2];
		return [3, cameraY + 1, cameraZ];
	}, [isFloorView, selectedY, cameraY, cameraZ]);

	const controlsTarget = useMemo<[number, number, number]>(() => {
		if (isFloorView) return [0, selectedY, 4];
		return [0, cameraY, 0];
	}, [isFloorView, selectedY, cameraY]);

	return (
		<div className="relative h-[820px] w-full bg-[#07090f]">
			{isFloorView && (
				<button
					type="button"
					onClick={() => {
						if (selectedFloor !== null) onFloorSelect(selectedFloor);
					}}
					className="absolute right-3 top-3 z-10 rounded-md border border-white/15 bg-[#111827]/85 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-[#1f2937]"
				>
					Exit floor view
				</button>
			)}
			{floorOptions.length > 0 && (
				<div className="absolute right-3 top-16 z-10">
					<div className="flex flex-col">
						{floorOptions.map((fd, idx) => {
							const floor = fd.floor;
							const active = selectedFloor === floor;
							return (
								<div key={floor} className="flex flex-col">
									<div className="flex items-center gap-2">
										<button
											type="button"
											aria-label={`View floor ${floor}`}
											onClick={() => onFloorSelect(floor)}
											className={`h-4 w-4 rounded-full border transition ${
												active
													? "border-white ring-2 ring-white/40"
													: "border-slate-200/80"
											}`}
											style={{ backgroundColor: NEUTRAL_FLOOR_DOT }}
										/>
										<button
											type="button"
											onClick={() => onFloorSelect(floor)}
											className={`text-xs transition ${
												active
													? "font-semibold text-orange-200"
													: "text-slate-200 hover:text-white"
											}`}
										>
											Floor {floor}
										</button>
									</div>
									{idx < floorOptions.length - 1 && (
										<div
											className="ml-[7px] my-1.5 h-4 border-l border-slate-400/80"
											aria-hidden="true"
										/>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
			<Canvas
				camera={{ position: [3, cameraY + 1, cameraZ], fov: 42 }}
				gl={{ antialias: true }}
				dpr={[1, 2]}
			>
				<Suspense fallback={null}>
					{isFloorView && (
						<CameraRig
							targetPosition={cameraPosition}
							targetLookAt={controlsTarget}
						/>
					)}
					{/* Lighting */}
					<ambientLight intensity={0.45} />
					<directionalLight
						position={[6, 12, 8]}
						intensity={0.9}
						castShadow={false}
					/>
					<directionalLight position={[-4, -4, -4]} intensity={0.2} />

					{/* Floor slabs */}
					{floors.map((fd) => {
						const yPos = (fd.floor - 1) * FLOOR_GAP;
						return (
							<group key={fd.floor}>
								<FloorMesh
									floor={fd.floor}
									yPosition={yPos}
									isSelected={selectedFloor === fd.floor}
									hasSelection={selectedFloor !== null}
									rooms={fd.rooms}
									onClick={() => onFloorSelect(fd.floor)}
									onRoomSelect={onRoomSelect}
								/>
								{/* Floor label on the left side */}
								{!isFloorView && (
									<Text
										position={[-6.2, yPos, 0]}
										fontSize={0.28}
										color="#64748b"
										anchorX="right"
										anchorY="middle"
									>
										{`F${fd.floor}`}
									</Text>
								)}
							</group>
						);
					})}

					{floors.length === 0 && (
						<Text position={[0, 0, 0]} fontSize={0.5} color="#475569">
							No floor data
						</Text>
					)}

					<OrbitControls
						zoomSpeed={1.69}
						rotateSpeed={2}
						makeDefault
						enabled={!isFloorView}
						enablePan={false}
						enableRotate={!isFloorView}
						autoRotate={false}
						minDistance={12}
						maxDistance={60}
						enableDamping={!isFloorView}
						dampingFactor={0.08}
						minPolarAngle={isFloorView ? 0 : 0.1}
						maxPolarAngle={Math.PI / 2 + 0.1}
						target={controlsTarget}
					/>
				</Suspense>
			</Canvas>
		</div>
	);
}
