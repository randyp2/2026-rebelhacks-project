"use client"
/**
 * Building3D
 *
 * Three.js scene showing a stacked floor-plan of the hotel.
 * Receives pre-aggregated FloorData[] — no data fetching here.
 *
 * Interaction:
 *   Click a floor slab → calls onFloorSelect(floor)
 *   OrbitControls for rotate/zoom (pan disabled)
 */

import { Suspense, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Text } from "@react-three/drei"
import FloorMesh from "./FloorMesh"
import type { FloorData } from "@/hooks/useRoomRisk"

const FLOOR_GAP = 0.9 // vertical distance between floor centres

type Building3DProps = {
  floors: FloorData[]
  selectedFloor: number | null
  onFloorSelect: (floor: number) => void
}

export default function Building3D({ floors, selectedFloor, onFloorSelect }: Building3DProps) {
  // Keep the camera centred on the building regardless of floor count
  const cameraY = useMemo(() => {
    if (!floors.length) return 2
    const maxFloor = Math.max(...floors.map((f) => f.floor))
    return ((maxFloor - 1) * FLOOR_GAP) / 2
  }, [floors])

  const cameraZ = useMemo(() => {
    // More floors → pull back further
    return Math.max(14, 10 + floors.length * 1.2)
  }, [floors.length])

  return (
    <div className="h-72 w-full bg-[#07090f]">
      <Canvas
        camera={{ position: [3, cameraY + 1, cameraZ], fov: 42 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.45} />
          <directionalLight position={[6, 12, 8]} intensity={0.9} castShadow={false} />
          <directionalLight position={[-4, -4, -4]} intensity={0.2} />

          {/* Floor slabs */}
          {floors.map((fd) => {
            const yPos = (fd.floor - 1) * FLOOR_GAP
            return (
              <group key={fd.floor}>
                <FloorMesh
                  floor={fd.floor}
                  yPosition={yPos}
                  averageRisk={fd.averageRisk}
                  isSelected={selectedFloor === fd.floor}
                  onClick={() => onFloorSelect(fd.floor)}
                />
                {/* Floor label on the left side */}
                <Text
                  position={[-6.2, yPos, 0]}
                  fontSize={0.28}
                  color="#64748b"
                  anchorX="right"
                  anchorY="middle"
                >
                  {`F${fd.floor}`}
                </Text>
                {/* Risk score label above slab */}
                <Text
                  position={[0, yPos + 0.26, 0]}
                  fontSize={0.22}
                  color="white"
                  anchorX="center"
                  anchorY="bottom"
                >
                  {fd.averageRisk.toFixed(1)}
                </Text>
              </group>
            )
          })}

          {floors.length === 0 && (
            <Text position={[0, 0, 0]} fontSize={0.5} color="#475569">
              No floor data
            </Text>
          )}

          <OrbitControls
            enablePan={false}
            minDistance={8}
            maxDistance={30}
            maxPolarAngle={Math.PI / 2 + 0.1}
            target={[0, cameraY, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
