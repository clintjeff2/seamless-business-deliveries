import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Truck, MapPin, Clock, DollarSign, Star } from "lucide-react"

export default async function TransportDashboardPage() {
  const user = await requireRole("transport")
  const supabase = await createClient()

  // Fetch transport service info
  const { data: transportService } = await supabase
    .from("transport_services")
    .select("*")
    .eq("driver_id", user.id)
    .single()

  // Fetch recent deliveries
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select(`
      *,
      order:orders(*, business:businesses(name))
    `)
    .eq("transport_service_id", transportService?.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const stats = {
    totalDeliveries: deliveries?.length || 0,
    activeDeliveries: deliveries?.filter((d) => ["accepted", "picked_up", "in_transit"].includes(d.status)).length || 0,
    completedDeliveries: deliveries?.filter((d) => d.status === "delivered").length || 0,
    totalEarnings:
      deliveries?.filter((d) => d.status === "delivered").reduce((sum, d) => sum + (d.delivery_fee || 0), 0) || 0,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Transport Dashboard</h1>
        <p className="text-gray-600">{transportService?.service_name || "Your Transport Service"}</p>
      </div>

      {!transportService ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Complete Your Transport Setup</h2>
            <p className="text-gray-600 mb-6">
              You need to complete your transport service registration to start delivering.
            </p>
            <Button asChild>
              <Link href="/register/transport">Complete Setup</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Deliveries</p>
                    <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
                  </div>
                  <Truck className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Deliveries</p>
                    <p className="text-2xl font-bold">{stats.activeDeliveries}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold">{stats.completedDeliveries}</p>
                  </div>
                  <Star className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Earnings</p>
                    <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Service Status */}
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
                  <div className="flex items-center justify-between">
                    <span>Vehicle Type</span>
                    <span className="font-semibold">{transportService.vehicle_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Base Rate</span>
                    <span className="font-semibold">${transportService.base_rate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Per KM Rate</span>
                    <span className="font-semibold">${transportService.per_km_rate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rating</span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="font-semibold">{transportService.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <Button className="w-full">
                    {transportService.status === "available" ? "Go Offline" : "Go Online"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Deliveries */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Deliveries</CardTitle>
                  <CardDescription>Your latest delivery requests</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/transport/requests">View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {deliveries && deliveries.length > 0 ? (
                  <div className="space-y-3">
                    {deliveries.slice(0, 5).map((delivery: any) => (
                      <div key={delivery.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">{delivery.order?.business?.name}</h4>
                          <p className="text-sm text-gray-600">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {delivery.delivery_address.slice(0, 30)}...
                          </p>
                          <p className="text-xs text-gray-500">{new Date(delivery.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={delivery.status === "delivered" ? "default" : "secondary"}>
                            {delivery.status}
                          </Badge>
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            ${delivery.delivery_fee || "0.00"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No deliveries yet</p>
                    <p className="text-sm text-gray-500 mt-2">Go online to start receiving delivery requests</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
