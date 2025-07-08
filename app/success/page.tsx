import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Package, MapPin } from "lucide-react"
import Link from "next/link"

export default function SuccessPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-green-600 mb-2">Order Placed Successfully!</h1>
          <p className="text-gray-600">Thank you for your order. We're preparing it for delivery.</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>Here's what happens with your order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">1</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold">Order Confirmation</p>
                  <p className="text-sm text-gray-600">We've received your order and notified the business</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-orange-600">2</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold">Preparation</p>
                  <p className="text-sm text-gray-600">The business will prepare your items</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-600">3</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold">Pickup & Delivery</p>
                  <p className="text-sm text-gray-600">Our transport partner will collect and deliver your order</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-green-600">4</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold">Live Tracking</p>
                  <p className="text-sm text-gray-600">Track your delivery in real-time once it's on the way</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/my-orders">
              <Package className="h-4 w-4 mr-2" />
              View My Orders
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/businesses">Continue Shopping</Link>
          </Button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <MapPin className="h-4 w-4 inline mr-1" />
            You'll receive SMS updates and can track your delivery live once it's dispatched.
          </p>
        </div>
      </div>
    </div>
  )
}
