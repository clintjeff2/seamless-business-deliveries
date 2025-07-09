import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Search, Package, Clock, MapPin, DollarSign } from "lucide-react"
import Link from "next/link"
import { OrderSearchForm } from "@/components/business/OrderSearchForm"

export default async function BusinessOrdersPage({ searchParams }: { searchParams: { search?: string; status?: string } }) {
  const user = await requireRole("business")
  const supabase = await createClient()

  // Fetch business info
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single()

  if (!business) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-gray-600">Manage your business orders</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Complete Your Business Setup</h2>
            <p className="text-gray-600 mb-6">
              You need to complete your business registration to start receiving orders.
            </p>
            <Button asChild>
              <Link href="/register/business">Complete Setup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Build query based on search parameters
  let query = supabase
    .from("orders")
    .select(`
      *,
      order_items(*, item:items(name, price)),
      business:businesses(name),
      delivery:deliveries(status, delivery_address)
    `)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })

  // Apply filters if provided
  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status)
  }

  const { data: orders, error } = await query

  if (error) {
    console.error("Error fetching orders:", error)
  }

  // Filter orders based on search term
  const searchTerm = searchParams.search?.toLowerCase() || ""
  const filteredOrders = orders?.filter((order) => {
    const orderIdMatch = order.id.toLowerCase().includes(searchTerm)
    const customerMatch = order.customer_name?.toLowerCase().includes(searchTerm) || false
    return orderIdMatch || customerMatch
  }) || []

  // Calculate stats
  const stats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(order => order.status === "pending").length,
    confirmed: filteredOrders.filter(order => order.status === "confirmed").length,
    completed: filteredOrders.filter(order => order.status === "completed").length,
    cancelled: filteredOrders.filter(order => order.status === "cancelled").length,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-gray-600">Manage your business orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
              </div>
              <MapPin className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
              </div>
              <div className="h-6 w-6 bg-red-600 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Form */}
      <OrderSearchForm 
        initialSearch={searchParams.search || ""} 
        initialStatus={searchParams.status || "all"} 
      />

      {/* Orders List */}
      {error ? (
        <div className="text-center py-16">
          <p className="text-red-500 font-semibold">Failed to fetch orders. Please try again later.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No orders found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || searchParams.status !== "all" ? "Try adjusting your search or filters" : "Orders will appear here once customers place them"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                    <CardDescription>
                      {format(new Date(order.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      order.status === "completed" ? "default" :
                      order.status === "pending" ? "secondary" :
                      order.status === "confirmed" ? "outline" :
                      order.status === "cancelled" ? "destructive" : "secondary"
                    }>
                      {order.status}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/business/orders/${order.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Customer:</strong> {order.customer_name || "N/A"}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Phone:</strong> {order.customer_phone || "N/A"}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Total:</strong> <span className="text-green-600 font-semibold">${order.total_amount}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Delivery Address:</strong> {order.delivery_address}
                    </p>
                    {order.delivery && (
                      <p className="text-sm text-gray-600">
                        <strong>Delivery Status:</strong> {order.delivery.status}
                      </p>
                    )}
                  </div>
                </div>

                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-4">
                    <Separator className="mb-3" />
                    <p className="text-sm font-semibold mb-2">Items:</p>
                    <div className="space-y-1">
                      {order.order_items.map((orderItem: any, index: number) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span>{orderItem.quantity}x {orderItem.item?.name || "Unknown Item"}</span>
                          <span>${(orderItem.quantity * (orderItem.item?.price || orderItem.price || 0)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}