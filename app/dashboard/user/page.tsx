import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Package, ShoppingCart, MapPin, Star, Clock } from "lucide-react"

// Demo data for when Supabase is not configured
const DEMO_ORDERS = [
  {
    id: "demo-order-1",
    total_amount: 45.99,
    status: "delivered",
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    business: {
      name: "Demo Restaurant",
      logo_url: null,
    },
    delivery: {
      status: "delivered",
      estimated_delivery_time: new Date(Date.now() - 82800000).toISOString(),
    },
  },
  {
    id: "demo-order-2",
    total_amount: 23.5,
    status: "in_transit",
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    business: {
      name: "Demo Electronics Store",
      logo_url: null,
    },
    delivery: {
      id: "demo-delivery-1",
      status: "in_transit",
      estimated_delivery_time: new Date(Date.now() + 1800000).toISOString(), // 30 min from now
    },
  },
  {
    id: "demo-order-3",
    total_amount: 67.25,
    status: "pending",
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    business: {
      name: "Demo Fashion Store",
      logo_url: null,
    },
    delivery: {
      status: "pending",
      estimated_delivery_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    },
  },
]

const DEMO_ITEMS = [
  {
    id: "demo-item-1",
    name: "Wireless Headphones",
    price: 89.99,
    business: {
      name: "TechStore Pro",
      rating: 4.5,
    },
  },
  {
    id: "demo-item-2",
    name: "Organic Coffee Beans",
    price: 24.99,
    business: {
      name: "Coffee Corner",
      rating: 4.8,
    },
  },
  {
    id: "demo-item-3",
    name: "Designer T-Shirt",
    price: 39.99,
    business: {
      name: "Fashion Hub",
      rating: 4.3,
    },
  },
  {
    id: "demo-item-4",
    name: "Smartphone Case",
    price: 19.99,
    business: {
      name: "Mobile Accessories",
      rating: 4.6,
    },
  },
  {
    id: "demo-item-5",
    name: "Artisan Pizza",
    price: 16.99,
    business: {
      name: "Bella Italia",
      rating: 4.9,
    },
  },
  {
    id: "demo-item-6",
    name: "Running Shoes",
    price: 129.99,
    business: {
      name: "SportZone",
      rating: 4.4,
    },
  },
]

// Check if we have valid Supabase configuration
const hasSupabaseConfig = () => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export default async function UserDashboardPage() {
  const user = await requireRole("user")
  const isDemo = !hasSupabaseConfig()

  let orders = DEMO_ORDERS
  let recommendedItems = DEMO_ITEMS

  if (!isDemo) {
    const supabase = await createClient()

    try {
      // Fetch user's recent orders
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          *,
          business:businesses(name, logo_url),
          delivery:deliveries(status, estimated_delivery_time)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

      // Fetch recommended items
      const { data: itemsData } = await supabase
        .from("items")
        .select(`
          *,
          business:businesses(name, rating)
        `)
        .eq("is_available", true)
        .limit(6)

      orders = ordersData || DEMO_ORDERS
      recommendedItems = itemsData || DEMO_ITEMS
    } catch (error) {
      console.error("Database error, using demo data:", error)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back, {user.profile?.full_name}!</h1>
        <p className="text-gray-600">Track your orders and discover new items</p>
        {isDemo && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              🚀 Demo Mode: This is a preview with sample data. Connect Supabase to enable full functionality.
            </p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-semibold">Browse Items</h3>
                <p className="text-sm text-gray-600 mb-4">Discover new products</p>
                <Button asChild size="sm">
                  <Link href="/businesses">Shop Now</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <h3 className="font-semibold">Track Orders</h3>
                <p className="text-sm text-gray-600 mb-4">Live delivery tracking</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/my-orders">View Orders</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold">Order History</h3>
                <p className="text-sm text-gray-600 mb-4">View past purchases</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/my-orders">View All</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Your latest purchases and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{order.business?.name}</h4>
                          <p className="text-sm text-gray-600">${order.total_amount}</p>
                          <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={order.delivery?.status === "delivered" ? "default" : "secondary"}>
                          {order.delivery?.status || order.status}
                        </Badge>
                        {order.delivery?.status === "in_transit" && (
                          <Button asChild size="sm" className="mt-2">
                            <Link href={`/delivery/${order.delivery.id}/track`}>Track</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No orders yet</p>
                  <Button asChild className="mt-4">
                    <Link href="/businesses">Start Shopping</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommended Items */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended for You</CardTitle>
              <CardDescription>Items you might like based on your preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedItems?.map((item: any) => (
                  <Link key={item.id} href={`/items/${item.id}`} className="group">
                    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                      <h4 className="font-semibold group-hover:text-blue-600 line-clamp-2">{item.name}</h4>
                      <p className="text-sm text-gray-600">{item.business?.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-green-600">${item.price}</span>
                        <div className="flex items-center text-sm text-gray-500">
                          <Star className="h-3 w-3 mr-1" />
                          {item.business?.rating || "New"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Quick View */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold">{user.profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold">{user.profile?.phone || "Not set"}</p>
                </div>
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/profile">Edit Profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle>Active Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.some((order: any) => order.delivery?.status === "in_transit") ? (
                <div className="space-y-3">
                  {orders
                    .filter((order: any) => order.delivery?.status === "in_transit")
                    .map((order: any) => (
                      <div key={order.id} className="p-3 border rounded-lg">
                        <h4 className="font-semibold text-sm">{order.business?.name}</h4>
                        <p className="text-xs text-gray-600">Order #{order.id.slice(0, 8)}</p>
                        <Button asChild size="sm" className="mt-2 w-full">
                          <Link href={`/delivery/${order.delivery.id}/track`}>Track Live</Link>
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">No active deliveries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
