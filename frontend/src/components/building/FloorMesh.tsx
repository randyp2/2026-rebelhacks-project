"use client";
/**
 * AnimatedFloorGroup (FloorMesh.tsx)
 *
 * A single floor slab in the 3D building scene with animated selection.
 *
 * When selected:
 *   - slab tilts toward camera (-82° on X)
 *   - pops forward on Z
 *   - room heatmap tiles on top face fade into view
 *
 * When another floor is selected:
 *   - slab fades to 0.0 opacity (fully hidden)
 */

import { memo, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { getRiskHexColor } from "@/lib/riskColor";
import type { RoomRiskRow } from "@/types/database";

export type FloorMeshProps = {
  floor: number;
  yPosition: number;
  isSelected: boolean;
  hasSelection: boolean; // any floor is currently selected (drives fade of others)
  rooms: RoomRiskRow[]; // rooms for this floor's heatmap tiles
  onClick: () => void;
  onRoomSelect: (roomId: string) => void;
};

const SLAB_W = 14;
const SLAB_H = 0.65;
const SLAB_D = 9;

// Room tile grid: 10 cols × 5 rows on the slab top face
const GRID_COLS = 10;
const GRID_ROWS = 5;
const ROOM_SLOTS = GRID_COLS * GRID_ROWS;
const TILE_Y = SLAB_H / 2 + 0.04; // sits just above the top face
const TILE_W = 1.05;
const TILE_D = 0.95;
const NEUTRAL_SLAB_COLOR = new THREE.Color("#334155");

const FloorMesh = memo(function FloorMesh({
  yPosition,
  isSelected,
  hasSelection,
  rooms,
  onClick,
  onRoomSelect,
}: FloorMeshProps) {
  // animRef targets the inner group so the outer group can hold the static y-position
  const animRef = useRef<THREE.Group>(null);
  const slabMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tileMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const [hoveredSlab, setHoveredSlab] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  // Pad rooms to exactly 50 slots (10×5 grid)
  const roomSlots = useMemo<(RoomRiskRow | null)[]>(() => {
    const slots: (RoomRiskRow | null)[] = [];
    for (let i = 0; i < ROOM_SLOTS; i++) slots.push(rooms[i] ?? null);
    return slots;
  }, [rooms]);

  useFrame((_, delta) => {
    const g = animRef.current;
    if (!g) return;
    const speed = delta * 5;

    // Focused floor mode: selected floor becomes a larger, flat plan view.
    const focusScale = isSelected && hasSelection ? 1.7 : 1;
    const nextScale = THREE.MathUtils.lerp(g.scale.x, focusScale, speed);
    g.scale.setScalar(nextScale);

    // Keep floor flat for 2D plan view while selected.
    g.quaternion.slerp(new THREE.Quaternion(), speed);

    // Bring selected floor slightly forward in focused mode.
    g.position.z = THREE.MathUtils.lerp(
      g.position.z,
      isSelected && hasSelection ? 1.0 : 0,
      speed,
    );

    // Slab opacity: fade non-selected floors when any floor is selected
    const slab = slabMatRef.current;
    if (slab) {
      slab.opacity = THREE.MathUtils.lerp(
        slab.opacity,
        isSelected || !hasSelection ? 1.0 : 0.0,
        speed,
      );
    }

    // Room tile opacity: reveal as floor opens, hide as it closes
    const tileTarget = isSelected ? 1.0 : 0.0;
    for (const m of tileMatsRef.current) {
      if (m) m.opacity = THREE.MathUtils.lerp(m.opacity, tileTarget, speed);
    }
  });

  return (
    // Outer group: holds the static y-position — never mutated by useFrame
    <group position={[0, yPosition, 0]}>
      {/* Inner group: animated by useFrame (rotation, z-position) */}
      <group ref={animRef}>
        {/* ── Main slab ── */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredSlab(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHoveredSlab(false);
            document.body.style.cursor = "default";
          }}
        >
          <boxGeometry args={[SLAB_W, SLAB_H, SLAB_D]} />
          <meshStandardMaterial
            ref={slabMatRef}
            color={NEUTRAL_SLAB_COLOR}
            emissive={NEUTRAL_SLAB_COLOR}
            emissiveIntensity={hoveredSlab ? 0.35 : isSelected ? 0.2 : 0}
            roughness={0.55}
            metalness={0.15}
            transparent
            opacity={1}
          />
        </mesh>

        {/* ── Room heatmap tiles on top face ── */}
        {roomSlots.map((room, idx) => {
          const col = idx % GRID_COLS;
          const row = Math.floor(idx / GRID_COLS);
          const x = ((col + 0.5) / GRID_COLS - 0.5) * SLAB_W;
          const z = ((row + 0.5) / GRID_ROWS - 0.5) * SLAB_D;
          const tileColor = room
            ? new THREE.Color(getRiskHexColor(room.risk_score))
            : new THREE.Color("#1e293b");
          const isHovered = room !== null && hoveredRoomId === room.room_id;

          return (
            <group key={idx}>
              <mesh
                position={[x, TILE_Y, z]}
                onClick={(e) => {
                  e.stopPropagation();
                  if (room) onRoomSelect(room.room_id);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  if (room) {
                    setHoveredRoomId(room.room_id);
                    document.body.style.cursor = "pointer";
                  }
                }}
                onPointerOut={() => {
                  setHoveredRoomId(null);
                  document.body.style.cursor = "default";
                }}
              >
                <boxGeometry args={[TILE_W, 0.08, TILE_D]} />
                <meshStandardMaterial
                  ref={(mat) => {
                    if (mat) tileMatsRef.current[idx] = mat;
                  }}
                  color={tileColor}
                  emissive={tileColor}
                  emissiveIntensity={isHovered ? 0.6 : 0.15}
                  transparent
                  opacity={0}
                />
              </mesh>
              {room && (!hasSelection || isSelected) && (
                <Text
                  position={[x, TILE_Y + 0.06, z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.16}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  {room.room_id}
                </Text>
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
});

export default FloorMesh;
