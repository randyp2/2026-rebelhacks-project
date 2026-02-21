"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type CameraPose = {
	position: THREE.Vector3;
	target: THREE.Vector3;
	up: THREE.Vector3;
};

type UseFloorFocusCameraArgs = {
	selectedFloor: number | null;
	cameraY: number;
	cameraZ: number;
	floorGap: number;
	onFloorSelect: (floor: number) => void;
};

export function useFloorFocusCamera({
	selectedFloor,
	cameraY,
	cameraZ,
	floorGap,
	onFloorSelect,
}: UseFloorFocusCameraArgs) {
	const cameraRef = useRef<THREE.Camera | null>(null);
	const controlsRef = useRef<OrbitControlsImpl | null>(null);
	const preFocusPoseRef = useRef<CameraPose | null>(null);
	const prevSelectedFloorRef = useRef<number | null>(selectedFloor);

	const [restorePose, setRestorePose] = useState<CameraPose | null>(null);
	const [orbitPose, setOrbitPose] = useState<CameraPose | null>(null);

	const isFloorView = selectedFloor !== null;
	const selectedY = useMemo(() => {
		if (selectedFloor === null) return cameraY;
		return (selectedFloor - 1) * floorGap;
	}, [selectedFloor, cameraY, floorGap]);

	const defaultOrbitPosition = useMemo<[number, number, number]>(
		() => [3, cameraY + 1, cameraZ],
		[cameraY, cameraZ],
	);
	const defaultOrbitTarget = useMemo<[number, number, number]>(
		() => [0, cameraY, 0],
		[cameraY],
	);

	const activeOrbitPose = orbitPose ?? restorePose;
	const nonFloorPosition = useMemo<[number, number, number]>(() => {
		if (!activeOrbitPose) return defaultOrbitPosition;
		return [
			activeOrbitPose.position.x,
			activeOrbitPose.position.y,
			activeOrbitPose.position.z,
		];
	}, [activeOrbitPose, defaultOrbitPosition]);
	const nonFloorTarget = useMemo<[number, number, number]>(() => {
		if (!activeOrbitPose) return defaultOrbitTarget;
		return [
			activeOrbitPose.target.x,
			activeOrbitPose.target.y,
			activeOrbitPose.target.z,
		];
	}, [activeOrbitPose, defaultOrbitTarget]);
	const nonFloorUp = useMemo<[number, number, number]>(() => {
		if (!activeOrbitPose) return [0, 1, 0];
		return [activeOrbitPose.up.x, activeOrbitPose.up.y, activeOrbitPose.up.z];
	}, [activeOrbitPose]);

	const cameraPosition = useMemo<[number, number, number]>(() => {
		if (isFloorView) return [0, selectedY + 32, 2];
		return nonFloorPosition;
	}, [isFloorView, selectedY, nonFloorPosition]);
	const controlsTarget = useMemo<[number, number, number]>(() => {
		if (isFloorView) return [0, selectedY, 4];
		return nonFloorTarget;
	}, [isFloorView, selectedY, nonFloorTarget]);

	const savePreFocusPose = () => {
		if (selectedFloor !== null || preFocusPoseRef.current) return;
		const camera = cameraRef.current;
		const controls = controlsRef.current;
		if (!camera || !controls) return;
		preFocusPoseRef.current = {
			position: camera.position.clone(),
			target: controls.target.clone(),
			up: camera.up.clone(),
		};
	};

	const clearFocusedFloor = () => {
		if (selectedFloor === null) return;
		const savedPose = preFocusPoseRef.current;
		if (savedPose) {
			const nextPose: CameraPose = {
				position: savedPose.position.clone(),
				target: savedPose.target.clone(),
				up: savedPose.up.clone(),
			};
			setOrbitPose(nextPose);
			setRestorePose(nextPose);
		}
		preFocusPoseRef.current = null;
		onFloorSelect(selectedFloor);
	};

	const handleFloorSelection = (floor: number) => {
		if (selectedFloor === null) {
			savePreFocusPose();
			onFloorSelect(floor);
			return;
		}
		if (selectedFloor === floor) {
			clearFocusedFloor();
			return;
		}
		onFloorSelect(floor);
	};

	useEffect(() => {
		if (restorePose === null) return;
		const controls = controlsRef.current;
		if (!controls) return;
		controls.target.copy(restorePose.target);
		controls.update();
	}, [restorePose]);

	useEffect(() => {
		const previous = prevSelectedFloorRef.current;
		if (
			previous !== null &&
			selectedFloor === null &&
			preFocusPoseRef.current
		) {
			const savedPose = preFocusPoseRef.current;
			const nextPose: CameraPose = {
				position: savedPose.position.clone(),
				target: savedPose.target.clone(),
				up: savedPose.up.clone(),
			};
			setOrbitPose(nextPose);
			setRestorePose(nextPose);
			preFocusPoseRef.current = null;
		}
		prevSelectedFloorRef.current = selectedFloor;
	}, [selectedFloor]);

	return {
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
		isControlsEnabled: !isFloorView && restorePose === null,
	};
}
