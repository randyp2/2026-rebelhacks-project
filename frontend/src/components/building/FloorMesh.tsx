"use client"
/**
 * FloorMesh
 *
 * A single floor slab in the 3D building scene.
 * Receives processed data only — no business logic here.
 *
 * Visual states:
 *   default  → base risk color, no emissive
 *   hovered  → emissiveIntensity 0.35 (brightens)
 *   selected → emissiveIntensity 0.2 + scale nudge
 */

import { memo, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { getRiskHexColor } from "@/lib/riskColor"

export type FloorMeshProps = {
  floor: number
  yPosition: number
  averageRisk: number
  isSelected: boolean
  onClick: () => void
}

const SLAB_W = 10
const SLAB_H = 0.28
const SLAB_D = 6

const FloorMesh = memo(function FloorMesh({
  yPosition,
  averageRisk,
  isSelected,
  onClick,
}: FloorMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const color = new THREE.Color(getRiskHexColor(averageRisk))
  const emissiveIntensity = hovered ? 0.35 : isSelected ? 0.2 : 0

  const handleOver = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = "pointer"
  }, [])

  const handleOut = useCallback(() => {
    setHovered(false)
    document.body.style.cursor = "default"
  }, [])

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      onClick()
    },
    [onClick]
  )

  return (
    <mesh
      ref={meshRef}
      position={[0, yPosition, 0]}
      scale={isSelected ? [1.02, 1, 1.02] : [1, 1, 1]}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <boxGeometry args={[SLAB_W, SLAB_H, SLAB_D]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.55}
        metalness={0.15}
      />
    </mesh>
  )
})

export default FloorMesh
