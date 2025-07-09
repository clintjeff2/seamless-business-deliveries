import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Plus, Package, ShoppingBag, TrendingUp, Users } from "lucide-react"

export default async function BusinessDashboardPage() {
  const user = await requireRole("business")
  const supabase = await createClient()

  // Fetch business info
  const { data: business } = await supabase.from("businesses").select("*").eq("owner_id", user.id).single()

  // Fetch business items
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("business_id", business?.id)
    .order("created_at", { ascending: false })

  // Fetch recent orders
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      order_items(*, item:items(name))
    `)
    .eq("business_id", business?.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const stats = {
    totalItems: items?.length || 0,
    activeItems: items?.filter((item) => item.is_available).length || 0,
    totalOrders: orders?.length || 0,
    pendingOrders: orders?.filter((order) => order.status === "pending").length || 0,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Business Dashboard</h1>
        <p className="text-gray-600">{business?.name || "Your Business"}</p>
      </div>

      {!business ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Complete Your Business Setup</h2>
            <p className="text-gray-600 mb-6">You need to complete your business registration to start selling.</p>
            <Button asChild>
              <Link href="/register/business">Complete Setup</Link>
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
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold">{stats.totalItems}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Items</p>
                    <p className="text-2xl font-bold">{stats.activeItems}</p>
                  </div>
                  <ShoppingBag className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold">{stats.totalOrders}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Orders</p>
                    <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Items Management */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Items</CardTitle>
                  <CardDescription>Manage your product inventory</CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link href="/dashboard/business/items/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {items && items.length > 0 ? (
                  <div className="space-y-3">
                    {items.slice(0, 5).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">{item.name}</h4>
                          <p className="text-sm text-gray-600">${item.price}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={item.is_available ? "default" : "secondary"}>
                            {item.is_available ? "Available" : "Unavailable"}
                          </Badge>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/business/items/${item.id}`}>Edit</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <Button asChild variant="outline" className="w-full bg-transparent">
                        <Link href="/dashboard/business/items">View All Items</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">No items yet</p>
                    <Button asChild>
                      <Link href="/dashboard/business/items/new">Add Your First Item</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Latest customer orders</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/business/orders">View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {orders && orders.length > 0 ? (
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">Order #{order.id.slice(0, 8)}</h4>
                          <p className="text-sm text-gray-600">${order.total_amount}</p>
                          <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={order.status === "pending" ? "secondary" : "default"}>{order.status}</Badge>
                          <Button asChild size="sm" variant="outline" className="mt-1 bg-transparent">
                            <Link href={`/dashboard/business/orders/${order.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No orders yet</p>
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
