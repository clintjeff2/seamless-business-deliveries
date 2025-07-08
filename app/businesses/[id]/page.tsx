import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, MapPin, Phone, Globe, Clock } from "lucide-react"
import Link from "next/link"
import { AddToCartButton } from "@/components/ui/add-to-cart-button"
import { notFound } from "next/navigation"

export default async function BusinessDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Fetch business details
  const { data: business } = await supabase
    .from("businesses")
    .select(`
      *,
      category:categories(name, icon, slug)
    `)
    .eq("id", params.id)
    .eq("is_active", true)
    .single()

  if (!business) {
    notFound()
  }

  // Fetch business items
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("business_id", params.id)
    .eq("is_available", true)
    .order("name")

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      *,
      user:profiles(full_name, avatar_url)
    `)
    .eq("business_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Business Header */}
      <div className="mb-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-start space-x-6">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                {business.logo_url ? (
                  <img
                    src={business.logo_url || "/placeholder.svg"}
                    alt={business.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-4xl">{business.category?.icon || "🏪"}</div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold">{business.name}</h1>
                  <Badge variant="secondary">
                    {business.category?.icon} {business.category?.name}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="font-semibold">{business.rating.toFixed(1)}</span>
                    <span className="ml-1">({business.total_reviews} reviews)</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Open Now</span>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">{business.description}</p>
              </div>
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Contact Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                  <span>
                    {business.address}, {business.city}
                  </span>
                </div>
                {business.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{business.phone}</span>
                  </div>
                )}
                {business.website && (
                  <div className="flex items-center text-sm">
                    <Globe className="h-4 w-4 mr-2 text-gray-500" />
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Menu & Items</CardTitle>
              <CardDescription>Available items from {business.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {items && items.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {items.map((item: any) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <Link href={`/items/${item.id}`} className="hover:text-blue-600">
                            <h3 className="font-semibold">{item.name}</h3>
                          </Link>
                          <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                          <p className="font-bold text-green-600 mt-2">${item.price}</p>
                        </div>
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center ml-4">
                          {item.image_url ? (
                            <img
                              src={item.image_url || "/placeholder.svg"}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="text-2xl">📦</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={item.stock_quantity > 0 ? "default" : "secondary"}>
                          {item.stock_quantity > 0 ? "In Stock" : "Out of Stock"}
                        </Badge>
                        <AddToCartButton item={item} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📦</div>
                  <p className="text-gray-600">No items available at the moment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reviews */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Customer Reviews</CardTitle>
              <CardDescription>{business.total_reviews} reviews</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          {review.user?.avatar_url ? (
                            <img
                              src={review.user.avatar_url || "/placeholder.svg"}
                              alt={review.user.full_name}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-sm">{review.user?.full_name?.charAt(0) || "U"}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{review.user?.full_name || "Anonymous"}</p>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating ? "text-yellow-500 fill-current" : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      {review.comment && <p className="text-sm text-gray-700">{review.comment}</p>}
                      <p className="text-xs text-gray-500 mt-1">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">No reviews yet</p>
                  <p className="text-sm text-gray-500">Be the first to leave a review!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
