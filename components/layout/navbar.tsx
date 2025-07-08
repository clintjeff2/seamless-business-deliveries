"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Menu, X, Package, Truck, Store, User } from "lucide-react"
import type { Profile } from "@/lib/types"

// Demo profile for when Supabase is not configured
const DEMO_PROFILE = {
  id: "demo-user-123",
  email: "demo@example.com",
  full_name: "Demo User",
  phone: "+1234567890",
  role: "user" as const,
  avatar_url: null,
  address: "123 Demo Street",
  city: "Demo City",
  latitude: 40.7128,
  longitude: -74.006,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Check if we have valid Supabase configuration
const hasSupabaseConfig = () => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const initAuth = async () => {
      if (!hasSupabaseConfig()) {
        // Demo mode
        setIsDemo(true)
        setUser({ id: "demo-user-123", email: "demo@example.com" })
        setProfile(DEMO_PROFILE)
        return
      }

      // Real Supabase mode
      const supabase = createClient()

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setUser(user)
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
          setProfile(profile)
        }

        // Set up auth state change listener
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            setUser(session.user)
            const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
            setProfile(profile)
          } else {
            setUser(null)
            setProfile(null)
          }
        })

        return () => subscription.unsubscribe()
      } catch (error) {
        console.error("Auth initialization error:", error)
      }
    }

    initAuth()
  }, [])

  useEffect(() => {
    // Get cart count from localStorage
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]")
      setCartCount(cart.reduce((sum: number, item: any) => sum + item.quantity, 0))
    } catch (error) {
      console.error("Error reading cart:", error)
      setCartCount(0)
    }
  }, [])

  const handleSignOut = async () => {
    if (isDemo) {
      // Demo mode - just clear state
      setUser(null)
      setProfile(null)
      router.push("/")
      return
    }

    // Real Supabase mode
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Sign out error:", error)
      router.push("/")
    }
  }

  const getDashboardLink = () => {
    if (!profile) return "/dashboard"
    switch (profile.role) {
      case "business":
        return "/dashboard/business"
      case "transport":
        return "/dashboard/transport"
      default:
        return "/dashboard/user"
    }
  }

  const getRoleIcon = () => {
    if (!profile) return <User className="h-4 w-4" />
    switch (profile.role) {
      case "business":
        return <Store className="h-4 w-4" />
      case "transport":
        return <Truck className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const isPublicPage = pathname === "/" || pathname.startsWith("/about") || pathname.startsWith("/contact")

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Package className="h-6 w-6" />
              <span className="font-bold text-xl">DeliveryHub</span>
            </Link>

            {isPublicPage && (
              <div className="hidden md:flex items-center space-x-6">
                <Link href="/businesses" className="text-sm font-medium hover:text-primary">
                  Businesses
                </Link>
                <Link href="/categories/restaurants" className="text-sm font-medium hover:text-primary">
                  Restaurants
                </Link>
                <Link href="/categories/electronics" className="text-sm font-medium hover:text-primary">
                  Electronics
                </Link>
                <Link href="/categories/clothing" className="text-sm font-medium hover:text-primary">
                  Fashion
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {profile?.role === "user" && (
                  <Link href="/cart" className="relative">
                    <Button variant="ghost" size="icon">
                      <ShoppingCart className="h-5 w-5" />
                      {cartCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                          {cartCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} alt={profile?.full_name || ""} />
                        <AvatarFallback>{profile?.full_name?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.full_name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        <div className="flex items-center space-x-1 pt-1">
                          {getRoleIcon()}
                          <span className="text-xs capitalize">{profile?.role}</span>
                          {isDemo && (
                            <Badge variant="secondary" className="text-xs">
                              Demo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getDashboardLink()}>Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">Settings</Link>
                    </DropdownMenuItem>
                    {profile?.role === "user" && (
                      <DropdownMenuItem asChild>
                        <Link href="/my-orders">My Orders</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Sign Up</Link>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-2">
              <Link href="/businesses" className="px-2 py-1 text-sm font-medium hover:text-primary">
                Businesses
              </Link>
              <Link href="/categories/restaurants" className="px-2 py-1 text-sm font-medium hover:text-primary">
                Restaurants
              </Link>
              <Link href="/categories/electronics" className="px-2 py-1 text-sm font-medium hover:text-primary">
                Electronics
              </Link>
              <Link href="/categories/clothing" className="px-2 py-1 text-sm font-medium hover:text-primary">
                Fashion
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
