import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck } from "lucide-react"
import { DeliverySearchForm } from "@/components/transport/DeliverySearchForm"

export default async function DeliveriesPage({ searchParams }: { searchParams: { search?: string } }) {
  const user = await requireRole("transport")
  const supabase = await createClient()

  // Fetch transport service info
  const { data: transportService } = await supabase
    .from("transport_services")
    .select("*")
    .eq("driver_id", user.id)
    .single()

  if (!transportService) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Deliveries</h1>
          <p className="text-gray-600">Manage and track your delivery requests</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Complete Your Transport Setup</h2>
            <p className="text-gray-600 mb-6">
              You need to complete your transport service registration to start delivering.
            </p>
            <a 
              href="/register/transport"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Complete Setup
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch deliveries
  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select(`
      *,
      order:orders(*, business:businesses(name))
    `)
    .eq("transport_service_id", transportService.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching deliveries:", error)
  }

  // Filter deliveries based on search term
  const searchTerm = searchParams.search?.toLowerCase() || ""
  const filteredDeliveries = deliveries?.filter((delivery) =>
    delivery.order_id.toLowerCase().includes(searchTerm)
  ) || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Deliveries</h1>
        <p className="text-gray-600">Manage and track your delivery requests</p>
      </div>

      {/* Search Form - Client Component */}
      <DeliverySearchForm initialSearch={searchParams.search || ""} />

      {/* Deliveries List */}
      {error ? (
        <div className="text-center py-16">
          <p className="text-red-500 font-semibold">Failed to fetch deliveries. Please try again later.</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No deliveries found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm ? "Try adjusting your search" : "Check back later for new deliveries"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeliveries.map((delivery) => (
            <Card key={delivery.id} className="border-l-4" style={{ borderColor: delivery.status === "live" ? "green" : "gray" }}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Order ID: {delivery.order_id}</CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  {format(new Date(delivery.created_at), "dd MMM yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  <strong>Pickup:</strong> {delivery.pickup_address}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Status:</strong>{" "}
                  <Badge variant={delivery.status === "live" ? "default" : "secondary"}>
                    {delivery.status}
                  </Badge>
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Business:</strong> {delivery.order?.business?.name || "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Fee:</strong> ${delivery.delivery_fee || "0.00"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}