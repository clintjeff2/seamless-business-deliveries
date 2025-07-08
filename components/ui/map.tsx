"use client"

import { useEffect, useRef } from "react"

interface MapProps {
  center: [number, number]
  zoom?: number
  markers?: Array<{
    position: [number, number]
    title?: string
    color?: string
  }>
  className?: string
}

export function Map({ center, zoom = 13, markers = [], className = "" }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map (using a simple implementation for demo)
    // In production, you would use Mapbox GL JS or Google Maps
    const initMap = () => {
      if (mapInstanceRef.current) return

      // Simple map placeholder - replace with actual Mapbox/Google Maps implementation
      const mapElement = mapRef.current!
      mapElement.innerHTML = `
        <div class="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center relative">
          <div class="text-center">
            <div class="text-2xl mb-2">🗺️</div>
            <p class="text-sm text-gray-600">Map View</p>
            <p class="text-xs text-gray-500">Lat: ${center[0]}, Lng: ${center[1]}</p>
          </div>
          ${markers
            .map(
              (marker, index) => `
            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" 
                 style="margin-left: ${index * 20}px; margin-top: ${index * 20}px;">
              <div class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
                📍
              </div>
              ${marker.title ? `<div class="text-xs mt-1 bg-white px-1 rounded shadow">${marker.title}</div>` : ""}
            </div>
          `,
            )
            .join("")}
        </div>
      `
    }

    initMap()
  }, [center, markers])

  return <div ref={mapRef} className={`w-full h-full ${className}`} />
}
