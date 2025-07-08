import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Star, MapPin, Phone } from "lucide-react"

export default async function BusinessesPage() {
  const supabase = await createClient()

  // Fetch all active businesses with their categories
  const { data: businesses } = await supabase
    .from("businesses")
    .select(`
      *,
      category:categories(name, icon, slug)
    `)
    .eq("is_active", true)
    .order("rating", { ascending: false })

  // Fetch categories for filtering
  const { data: categories } = await supabase.from("categories").select("*").order("name")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">All Businesses</h1>
        <p className="text-gray-600">Discover local businesses and their products</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search businesses..." className="pl-10" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm">
              All
            </Button>
            {categories?.map((category: any) => (
              <Button key={category.id} variant="outline" size="sm" asChild>
                <Link href={`/categories/${category.slug}`}>
                  {category.icon} {category.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Business Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses?.map((business: any) => (
          <Link key={business.id} href={`/businesses/${business.id}`} className="group">
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
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
                <CardTitle className="group-hover:text-blue-600">{business.name}</CardTitle>
                <CardDescription className="line-clamp-2">{business.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {business.category?.icon} {business.category?.name}
                    </Badge>
                    <div className="flex items-center text-sm text-gray-600">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      {business.rating.toFixed(1)} ({business.total_reviews})
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {business.address}, {business.city}
                  </div>

                  {business.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      {business.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {businesses?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-semibold mb-2">No businesses found</h2>
          <p className="text-gray-600">Be the first to register your business!</p>
          <Button asChild className="mt-4">
            <Link href="/register">Register Your Business</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
