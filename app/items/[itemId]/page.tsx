import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Star, MapPin, ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { AddToCartButton } from "@/components/ui/add-to-cart-button"
import { notFound } from "next/navigation"

export default async function ItemDetailPage({ params }: { params: { itemId: string } }) {
  const supabase = await createClient()

  // Fetch item details with business info
  const { data: item } = await supabase
    .from("items")
    .select(`
      *,
      business:businesses(
        id,
        name,
        address,
        city,
        phone,
        rating,
        total_reviews,
        category:categories(name, icon)
      )
    `)
    .eq("id", params.itemId)
    .single()

  if (!item) {
    notFound()
  }

  // Fetch related items from the same business
  const { data: relatedItems } = await supabase
    .from("items")
    .select("*")
    .eq("business_id", item.business_id)
    .eq("is_available", true)
    .neq("id", item.id)
    .limit(4)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/businesses/${item.business.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {item.business.name}
          </Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Item Image */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            {item.image_url ? (
              <img
                src={item.image_url || "/placeholder.svg"}
                alt={item.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Package className="h-24 w-24 text-gray-400" />
            )}
          </div>
        </div>

        {/* Item Details */}
        <div>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{item.name}</h1>
            <p className="text-2xl font-bold text-green-600 mb-4">${item.price}</p>

            <div className="flex items-center space-x-4 mb-4">
              <Badge variant={item.is_available && item.stock_quantity > 0 ? "default" : "secondary"}>
                {item.is_available && item.stock_quantity > 0 ? "In Stock" : "Out of Stock"}
              </Badge>
              {item.stock_quantity > 0 && (
                <span className="text-sm text-gray-600">{item.stock_quantity} available</span>
              )}
            </div>

            {item.description && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-700">{item.description}</p>
              </div>
            )}

            <div className="mb-6">
              <AddToCartButton item={item} size="lg" />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Business Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>{item.business.category?.icon}</span>
                <span>{item.business.name}</span>
              </CardTitle>
              <CardDescription>Sold by this business</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold">{item.business.rating.toFixed(1)}</span>
                  <span className="text-sm text-gray-600">({item.business.total_reviews} reviews)</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {item.business.address}, {item.business.city}
                  </span>
                </div>
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href={`/businesses/${item.business.id}`}>View Business Profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Related Items */}
      {relatedItems && relatedItems.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">More from {item.business.name}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedItems.map((relatedItem: any) => (
              <Link key={relatedItem.id} href={`/items/${relatedItem.id}`} className="group">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                      {relatedItem.image_url ? (
                        <img
                          src={relatedItem.image_url || "/placeholder.svg"}
                          alt={relatedItem.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <h3 className="font-semibold group-hover:text-blue-600 line-clamp-2">{relatedItem.name}</h3>
                    <p className="font-bold text-green-600 mt-2">${relatedItem.price}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
