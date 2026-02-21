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
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFloorFocusCamera } from "@/hooks/useFloorFocusCamera";
import type { FloorData } from "@/hooks/useRoomRisk";
import FloorMesh from "./FloorMesh";

const FLOOR_GAP = 1.4; // vertical distance between floor centres
const NEUTRAL_FLOOR_DOT = "#64748b";

type Building3DProps = {
	floors: FloorData[];
	selectedFloor: number | null;
	onFloorSelect: (floor: number | null) => void;
	onRoomSelect: (roomId: string) => void;
};

type CameraRigProps = {
	targetPosition: [number, number, number];
	targetLookAt: [number, number, number];
	targetUp?: [number, number, number];
	onSettled?: () => void;
};

function CameraRig({
	targetPosition,
	targetLookAt,
	targetUp = [0, 1, 0],
	onSettled,
}: CameraRigProps) {
	const { camera } = useThree();
	const targetPos = useMemo(() => new THREE.Vector3(), []);
	const targetCtr = useMemo(() => new THREE.Vector3(), []);
	const targetUpVec = useMemo(() => new THREE.Vector3(), []);
	const hasSettledRef = useRef(false);

	useEffect(() => {
		return () => {
			camera.up.set(0, 1, 0);
		};
	}, [camera]);

	useFrame((_, delta) => {
		// Mild ease-in: keeps responsiveness while avoiding a sharp initial snap.
		const tLinear = 1 - Math.exp(-delta * 4.4);
		const t = tLinear * (0.7 + 0.3 * tLinear);
		targetPos.set(...targetPosition);
		targetCtr.set(...targetLookAt);
		targetUpVec.set(...targetUp);
		camera.position.lerp(targetPos, t);
		camera.up.lerp(targetUpVec, t);
		camera.lookAt(targetCtr);

		if (!onSettled) return;
		const posError = camera.position.distanceTo(targetPos);
		const upError = camera.up.distanceTo(targetUpVec);
		if (posError < 0.05 && upError < 0.02) {
			if (!hasSettledRef.current) {
				hasSettledRef.current = true;
				onSettled();
			}
			return;
		}
		hasSettledRef.current = false;
	});

	return null;
}

export default function Building3D({
	floors,
	selectedFloor,
	onFloorSelect,
	onRoomSelect,
}: Building3DProps) {
	const [bodyCursor, setBodyCursor] = useState<"default" | "pointer">("default");
	const [isDarkTheme, setIsDarkTheme] = useState(true);

	const isFloorView = selectedFloor !== null;
	const floorOptions = useMemo(
		() => [...floors].sort((a, b) => b.floor - a.floor),
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

	const {
		cameraRef,
		controlsRef,
		restorePose,
		cameraPosition,
		controlsTarget,
		nonFloorPosition,
		nonFloorTarget,
		nonFloorUp,
		handleFloorSelection,
		clearFocusedFloor,
		setRestorePose,
		isControlsEnabled,
	} = useFloorFocusCamera({
		selectedFloor,
		cameraY,
		cameraZ,
		floorGap: FLOOR_GAP,
		onFloorSelect,
	});

	useEffect(() => {
		document.body.style.cursor = bodyCursor;
		return () => {
			document.body.style.cursor = "default";
		};
	}, [bodyCursor]);

	useEffect(() => {
		const root = document.documentElement;
		const updateThemeState = () => setIsDarkTheme(root.classList.contains("dark"));
		updateThemeState();

		const observer = new MutationObserver(updateThemeState);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const floorSlabColor = isDarkTheme ? "#334155" : "#dbeafe";
	const emptyTileColor = isDarkTheme ? "#1e293b" : "#eff6ff";
	const floorLabelColor = isDarkTheme ? "#64748b" : "#64748b";
	const emptyStateColor = isDarkTheme ? "#475569" : "#94a3b8";

	return (
		<div className="relative h-[820px] w-full bg-background">
			{isFloorView && (
				<button
					type="button"
					onClick={() => {
						setBodyCursor("default");
						clearFocusedFloor();
					}}
					className="absolute right-3 top-3 z-10 cursor-pointer rounded-md border border-border bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
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
											onClick={() => handleFloorSelection(floor)}
											className={`h-4 w-4 cursor-pointer rounded-full border transition ${
												active
													? "border-white ring-2 ring-ring/40"
													: "border-border"
											}`}
											style={{ backgroundColor: NEUTRAL_FLOOR_DOT }}
										/>
										<button
											type="button"
											onClick={() => handleFloorSelection(floor)}
											className={`cursor-pointer text-xs transition ${
												active
													? "font-semibold text-orange-200"
													: "text-foreground hover:text-accent-foreground"
											}`}
										>
											Floor {floor}
										</button>
									</div>
									{idx < floorOptions.length - 1 && (
										<div
											className="ml-[7px] my-1.5 h-4 cursor-pointer border-l border-border"
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
				onCreated={(state) => {
					cameraRef.current = state.camera;
				}}
				onPointerEnter={() => {
					if (selectedFloor !== null) {
						setBodyCursor("pointer");
					}
				}}
				onPointerLeave={() => {
					setBodyCursor("default");
				}}
				onPointerMissed={(e) => {
					if (selectedFloor === null) return;
					if ((e as MouseEvent & { delta: number }).delta > 4) return;
					setBodyCursor("default");
					clearFocusedFloor();
				}}
			>
				<Suspense fallback={null}>
					{isFloorView && (
						<CameraRig
							targetPosition={cameraPosition}
							targetLookAt={controlsTarget}
							targetUp={[0, 0, -1]}
						/>
					)}
					{!isFloorView && restorePose !== null && (
						<CameraRig
							targetPosition={nonFloorPosition}
							targetLookAt={nonFloorTarget}
							targetUp={nonFloorUp}
							onSettled={() => setRestorePose(null)}
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
									slabColor={floorSlabColor}
									emptyTileColor={emptyTileColor}
									rooms={fd.rooms}
									onClick={() => handleFloorSelection(fd.floor)}
									onRoomSelect={onRoomSelect}
								/>
								{/* Floor label on the left side */}
								{!isFloorView && (
									<Text
										position={[-6.2, yPos, 0]}
										fontSize={0.28}
										color={floorLabelColor}
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
						<Text position={[0, 0, 0]} fontSize={0.5} color={emptyStateColor}>
							No floor data
						</Text>
					)}

					<OrbitControls
						ref={(instance) => {
							controlsRef.current = instance;
						}}
						zoomSpeed={0.67}
						rotateSpeed={0.67}
						makeDefault
						enabled={isControlsEnabled}
						enablePan={false}
						enableRotate={isControlsEnabled}
						autoRotate={false}
						minDistance={12}
						maxDistance={60}
						enableDamping={isControlsEnabled}
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
