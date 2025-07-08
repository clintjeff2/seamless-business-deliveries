import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Package, MapPin, Clock, Star, Eye } from "lucide-react"

export default async function MyOrdersPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch user's orders with related data
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      business:businesses(name, logo_url, category:categories(icon)),
      order_items(
        *,
        item:items(name, price, image_url)
      ),
      delivery:deliveries(
        id,
        status,
        estimated_delivery_time,
        actual_delivery_time,
        transport_service:transport_services(service_name, phone)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "default"
      case "in_transit":
        return "default"
      case "pending":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getDeliveryStatus = (order: any) => {
    if (order.delivery) {
      return order.delivery.status
    }
    return order.status
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-gray-600">Track your orders and view order history</p>
        </div>

        {orders && orders.length > 0 ? (
          <div className="space-y-6">
            {orders.map((order: any) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        {order.business?.logo_url ? (
                          <img
                            src={order.business.logo_url || "/placeholder.svg"}
                            alt={order.business.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-2xl">{order.business?.category?.icon || "🏪"}</span>
                        )}
                      </div>
                      <div>
                        <CardTitle>{order.business?.name}</CardTitle>
                        <CardDescription>
                          Order #{order.id.slice(0, 8)} • {new Date(order.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusColor(getDeliveryStatus(order))}>{getDeliveryStatus(order)}</Badge>
                      <p className="text-lg font-bold mt-1">${order.total_amount}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Order Items */}
                  <div className="space-y-2 mb-4">
                    {order.order_items?.map((orderItem: any) => (
                      <div key={orderItem.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs">
                            {orderItem.quantity}
                          </span>
                          <span>{orderItem.item?.name}</span>
                        </div>
                        <span className="font-semibold">${(orderItem.price * orderItem.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Delivery Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        Delivery Address
                      </h4>
                      <p className="text-sm text-gray-600">{order.delivery_address}</p>
                      {order.delivery_phone && <p className="text-sm text-gray-600">Phone: {order.delivery_phone}</p>}
                    </div>

                    {order.delivery && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Delivery Timeline
                        </h4>
                        {order.delivery.estimated_delivery_time && (
                          <p className="text-sm text-gray-600">
                            Estimated: {new Date(order.delivery.estimated_delivery_time).toLocaleString()}
                          </p>
                        )}
                        {order.delivery.actual_delivery_time && (
                          <p className="text-sm text-gray-600">
                            Delivered: {new Date(order.delivery.actual_delivery_time).toLocaleString()}
                          </p>
                        )}
                        {order.delivery.transport_service && (
                          <p className="text-sm text-gray-600">
                            Driver: {order.delivery.transport_service.service_name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex space-x-2">
                      {order.delivery?.status === "in_transit" && (
                        <Button asChild size="sm">
                          <Link href={`/delivery/${order.delivery.id}/track`}>
                            <MapPin className="h-4 w-4 mr-2" />
                            Track Delivery
                          </Link>
                        </Button>
                      )}

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/orders/${order.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                    </div>

                    <div className="flex space-x-2">
                      {getDeliveryStatus(order) === "delivered" && (
                        <Button variant="outline" size="sm">
                          <Star className="h-4 w-4 mr-2" />
                          Leave Review
                        </Button>
                      )}

                      <Button variant="outline" size="sm">
                        Reorder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-24 w-24 mx-auto text-gray-400 mb-6" />
            <h2 className="text-2xl font-semibold mb-2">No orders yet</h2>
            <p className="text-gray-600 mb-8">Start shopping to see your orders here</p>
            <Button asChild size="lg">
              <Link href="/businesses">Start Shopping</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
