'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'

interface ServiceStatusCardProps {
  transportService: {
    id: string
    status: string
    service_name: string
  }
}

export function ServiceStatusCard({ transportService }: ServiceStatusCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function toggleServiceStatus() {
    setIsLoading(true)
    
    try {
      const newStatus = transportService.status === "available" ? "offline" : "available"

      const { error } = await supabase
        .from("transport_services")
        .update({ status: newStatus })
        .eq("id", transportService.id)

      if (error) {
        console.error("Error updating status:", error)
        return
      }

      // Refresh the page to reflect the updated status
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Status</CardTitle>
        <CardDescription>Manage your availability</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Current Status</span>
            <Badge variant={transportService.status === "available" ? "default" : "secondary"}>
              {transportService.status}
            </Badge>
          </div>
          <Button 
            className="w-full" 
            onClick={toggleServiceStatus}
            disabled={isLoading}
          >
            {isLoading 
              ? "Updating..." 
              : transportService.status === "available" 
                ? "Go Offline" 
                : "Go Online"
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
