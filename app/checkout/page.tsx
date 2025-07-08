"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { getCart, getCartTotal, clearCart } from "@/lib/cart"
import { MapPin, Truck, CreditCard } from "lucide-react"
import type { CartItem, TransportService } from "@/lib/types"

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [transportServices, setTransportServices] = useState<TransportService[]>([])
  const [selectedTransport, setSelectedTransport] = useState<string>("")
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: "",
    city: "",
    phone: "",
    notes: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const items = getCart()
    setCartItems(items)

    if (items.length === 0) {
      router.push("/cart")
      return
    }

    // Fetch available transport services
    const fetchTransportServices = async () => {
      const { data } = await supabase
        .from("transport_services")
        .select(`
          *,
          driver:profiles(full_name, phone)
        `)
        .eq("status", "available")
        .eq("is_verified", true)
        .order("rating", { ascending: false })

      if (data) setTransportServices(data)
    }

    fetchTransportServices()
  }, [supabase, router])

  const subtotal = getCartTotal()
  const tax = subtotal * 0.08
  const selectedTransportService = transportServices.find((t) => t.id === selectedTransport)
  const deliveryFee = selectedTransportService
    ? selectedTransportService.base_rate + 5 * selectedTransportService.per_km_rate
    : 0
  const total = subtotal + tax + deliveryFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Please log in to place an order")

      if (!selectedTransport) throw new Error("Please select a transport service")

      // Group items by business
      const itemsByBusiness = cartItems.reduce(
        (acc, cartItem) => {
          const businessId = cartItem.item.business_id
          if (!acc[businessId]) {
            acc[businessId] = []
          }
          acc[businessId].push(cartItem)
          return acc
        },
        {} as Record<string, CartItem[]>,
      )

      // Create orders for each business
      for (const [businessId, businessItems] of Object.entries(itemsByBusiness)) {
        const businessTotal = businessItems.reduce((sum, item) => sum + item.item.price * item.quantity, 0)

        // Create order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            business_id: businessId,
            total_amount: businessTotal,
            delivery_address: `${deliveryInfo.address}, ${deliveryInfo.city}`,
            delivery_phone: deliveryInfo.phone,
            delivery_notes: deliveryInfo.notes,
            status: "pending",
          })
          .select()
          .single()

        if (orderError) throw orderError

        // Create order items
        const orderItems = businessItems.map((cartItem) => ({
          order_id: order.id,
          item_id: cartItem.item.id,
          quantity: cartItem.quantity,
          price: cartItem.item.price,
        }))

        const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

        if (itemsError) throw itemsError

        // Create delivery
        const { error: deliveryError } = await supabase.from("deliveries").insert({
          order_id: order.id,
          transport_service_id: selectedTransport,
          pickup_address: "Business Address", // In real app, get from business
          delivery_address: `${deliveryInfo.address}, ${deliveryInfo.city}`,
          delivery_fee: deliveryFee,
          distance_km: 5, // Simplified - calculate actual distance
          status: "pending",
        })

        if (deliveryError) throw deliveryError
      }

      // Clear cart and redirect
      clearCart()
      router.push("/success")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (cartItems.length === 0) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Delivery Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="address">Street Address *</Label>
                      <Input
                        id="address"
                        value={deliveryInfo.address}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={deliveryInfo.city}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={deliveryInfo.phone}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Delivery Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={deliveryInfo.notes}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, notes: e.target.value })}
                      placeholder="Special instructions for delivery..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Transport Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 mr-2" />
                    Select Transport Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transportServices.length > 0 ? (
                    <div className="space-y-3">
                      {transportServices.map((service) => (
                        <div
                          key={service.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedTransport === service.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedTransport(service.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{service.service_name}</h4>
                              <p className="text-sm text-gray-600">{service.vehicle_type}</p>
                              <div className="flex items-center mt-1">
                                <Badge variant="secondary" className="mr-2">
                                  ⭐ {service.rating.toFixed(1)}
                                </Badge>
                                <span className="text-xs text-gray-500">{service.total_deliveries} deliveries</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${(service.base_rate + 5 * service.per_km_rate).toFixed(2)}</p>
                              <p className="text-xs text-gray-500">Est. delivery fee</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">No transport services available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3">
                      {cartItems.map((cartItem) => (
                        <div key={cartItem.item.id} className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{cartItem.item.name}</h4>
                            <p className="text-sm text-gray-600">
                              ${cartItem.item.price} × {cartItem.quantity}
                            </p>
                          </div>
                          <span className="font-semibold">${(cartItem.item.price * cartItem.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Fee</span>
                        <span>${deliveryFee.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full" size="lg" disabled={loading || !selectedTransport}>
                      {loading ? "Placing Order..." : "Place Order"}
                    </Button>

                    <div className="text-center">
                      <div className="flex items-center justify-center text-sm text-gray-600">
                        <CreditCard className="h-4 w-4 mr-2" />
                        <span>Secure payment processing</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
