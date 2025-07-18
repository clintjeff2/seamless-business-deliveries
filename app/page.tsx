import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Package, 
  Truck, 
  Store, 
  MapPin, 
  Clock, 
  Shield, 
  ArrowRight, 
  CheckCircle,
  Star,
  Users,
  Building,
  MessageSquare,
  LucideIcon,
  PieChart,
  ShoppingCart,
  Zap
} from "lucide-react"

// Process step component for reusability
interface ProcessStepProps {
  icon: LucideIcon;
  title: string;
  description: string;
  step: number;
  iconColor: string;
  bgColor: string;
}

function ProcessStep({ icon: Icon, title, description, step, iconColor, bgColor }: ProcessStepProps) {
  return (
    <div className="relative">
      {step < 6 && <div className="absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent hidden md:block" />}
      <div className="flex flex-col items-center text-center z-10 relative">
        <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center mb-4`}>
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>
        <div className="bg-primary text-primary-foreground text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center absolute top-0 right-0 md:right-10">
          {step}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm max-w-xs">{description}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-background/50 to-background py-20 px-4 border-b">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.025] dark:opacity-[0.05]"></div>
        <div className="container mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-4">
            🚀 Now Live - Real-time Delivery Tracking
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Connect. Order. Track.
            <span className="text-primary block">Delivered.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The complete platform connecting businesses, customers, and transport services with real-time delivery
            tracking and seamless order management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/businesses">Browse Businesses</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-8 px-4 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">10K+</p>
              <p className="text-sm text-muted-foreground">Daily Deliveries</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">1.2K+</p>
              <p className="text-sm text-muted-foreground">Partner Businesses</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">800+</p>
              <p className="text-sm text-muted-foreground">Transport Partners</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">98%</p>
              <p className="text-sm text-muted-foreground">On-time Delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Everything You Need in One Platform</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whether you're a customer, business owner, or transport service, we've got you covered with powerful tools
              and real-time tracking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>For Customers</CardTitle>
                <CardDescription>Browse, order, and track deliveries in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Browse local businesses
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Real-time order tracking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Multiple payment options
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Rate and review services
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Chat with delivery personnel
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Store className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>For Businesses</CardTitle>
                <CardDescription>Manage inventory, orders, and grow your customer base</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Easy product management
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Real-time order notifications
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Comprehensive analytics dashboard
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Customer insights and feedback
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Automated inventory tracking
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>For Transport</CardTitle>
                <CardDescription>Manage deliveries and earn with flexible scheduling</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Flexible scheduling options
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Smart route optimization
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Real-time earnings tracking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    Customer ratings and feedback
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                    In-app navigation assistance
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works - Delivery Process */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">The Delivery Journey</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How DeliveryHub Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From ordering to delivery, our seamless process ensures your items arrive quickly and safely
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-10 px-4 relative">
            <ProcessStep 
              icon={ShoppingCart} 
              title="Place Order" 
              description="Browse businesses, add items to your cart, and place your order with ease"
              step={1}
              iconColor="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            
            <ProcessStep 
              icon={Store} 
              title="Business Accepts" 
              description="The business receives and confirms your order, starting preparation"
              step={2}
              iconColor="text-green-600 dark:text-green-400"
              bgColor="bg-green-100 dark:bg-green-900/30"
            />
            
            <ProcessStep 
              icon={Package} 
              title="Ready for Pickup" 
              description="Your order is prepared and packaged, awaiting transport pickup"
              step={3}
              iconColor="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
            />
            
            <ProcessStep 
              icon={Truck} 
              title="Delivery Started" 
              description="A transport partner collects your order from the business"
              step={4}
              iconColor="text-purple-600 dark:text-purple-400"
              bgColor="bg-purple-100 dark:bg-purple-900/30"
            />
            
            <ProcessStep 
              icon={MapPin} 
              title="In Transit" 
              description="Track your order in real-time as it makes its way to you"
              step={5}
              iconColor="text-red-600 dark:text-red-400"
              bgColor="bg-red-100 dark:bg-red-900/30"
            />
            
            <ProcessStep 
              icon={CheckCircle} 
              title="Delivered" 
              description="Order arrives at your doorstep. Rate your experience and enjoy!"
              step={6}
              iconColor="text-teal-600 dark:text-teal-400"
              bgColor="bg-teal-100 dark:bg-teal-900/30"
            />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 px-4 border-t border-b">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Popular Categories</h2>
            <p className="text-xl text-muted-foreground">Discover businesses across different categories</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Link href="/categories/restaurants" className="group">
              <Card className="text-center border hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="text-4xl mb-2">🍽️</div>
                  <CardTitle className="group-hover:text-primary transition-colors">Restaurants</CardTitle>
                  <CardDescription>Food delivery from local restaurants</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/categories/electronics" className="group">
              <Card className="text-center border hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="text-4xl mb-2">📱</div>
                  <CardTitle className="group-hover:text-primary transition-colors">Electronics</CardTitle>
                  <CardDescription>Latest gadgets and devices</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/categories/clothing" className="group">
              <Card className="text-center border hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="text-4xl mb-2">👕</div>
                  <CardTitle className="group-hover:text-primary transition-colors">Clothing</CardTitle>
                  <CardDescription>Apparel and accessories</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/categories/groceries" className="group">
              <Card className="text-center border hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="text-4xl mb-2">🛒</div>
                  <CardTitle className="group-hover:text-primary transition-colors">Groceries</CardTitle>
                  <CardDescription>Fresh produce and essentials</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>

          <div className="flex justify-center mt-8">
            <Button variant="outline" asChild>
              <Link href="/businesses">
                View All Categories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Real-Time Updates</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Real-Time Tracking That Actually Works
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Never wonder where your order is again. Our advanced GPS tracking system provides live updates from
                pickup to delivery, giving you peace of mind with every order.
              </p>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Live GPS Location Updates</h3>
                    <p className="text-sm text-muted-foreground">See exactly where your delivery is on the map</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Accurate Delivery Estimates</h3>
                    <p className="text-sm text-muted-foreground">Know exactly when your order will arrive</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Direct Communication</h3>
                    <p className="text-sm text-muted-foreground">Chat directly with your delivery driver</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Secure and Reliable</h3>
                    <p className="text-sm text-muted-foreground">End-to-end encryption and reliable service</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-background to-muted rounded-lg p-8 text-center border shadow-sm">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/10 animate-pulse"></div>
                </div>
                <div className="text-6xl mb-4 relative z-10">📍</div>
                <div className="marker-pulse absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/5 rounded-full"></div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Live Tracking Map</h3>
              <p className="text-muted-foreground">See your delivery driver's exact location and estimated arrival time</p>
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-muted-foreground">Current Status</p>
                    <p className="font-medium">In Transit</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estimated Arrival</p>
                    <p className="font-medium">12:45 PM</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distance</p>
                    <p className="font-medium">1.2 km away</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Benefits */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">For Businesses</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Grow Your Business With Our Delivery Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Expand your reach, increase sales, and delight customers with our seamless delivery solutions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border">
              <CardHeader>
                <PieChart className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get valuable insights into your sales, customer preferences, and delivery performance. Make data-driven decisions to optimize your business operations.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Quick Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get started in minutes with our easy onboarding process. Upload your products, set your hours, and start accepting orders right away.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Customer Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Reach new customers through our marketplace. Our platform brings qualified leads directly to your business with zero marketing costs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              What Our Users Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Don't just take our word for it - see what our customers, businesses, and transport partners have to say
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="mr-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Sarah Johnson</p>
                    <p className="text-sm text-muted-foreground">Customer</p>
                  </div>
                </div>
                <div className="flex text-amber-500 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground">
                  "The real-time tracking is a game-changer! I can see exactly where my order is and chat directly with the driver. This app has made ordering so much more convenient."
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="mr-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Alex Thompson</p>
                    <p className="text-sm text-muted-foreground">Business Owner</p>
                  </div>
                </div>
                <div className="flex text-amber-500 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground">
                  "Since joining DeliveryHub, we've seen a 40% increase in orders. The platform is intuitive to use, and the analytics help us understand our customers better."
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="mr-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Michael Rodriguez</p>
                    <p className="text-sm text-muted-foreground">Transport Partner</p>
                  </div>
                </div>
                <div className="flex text-amber-500 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground">
                  "The route optimization has helped me complete more deliveries in less time. The flexible schedule works perfectly with my other commitments."
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about our platform
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">How do I track my order?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Once your order is confirmed, you can track it in real-time through the "My Orders" section. You'll see the driver's location, estimated arrival time, and can even chat with them directly.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">How do I become a transport partner?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sign up as a transport partner through our registration page. After verifying your information and completing a brief orientation, you can start accepting delivery requests based on your availability.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">What are the fees for businesses?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We charge a small percentage of each transaction and provide all the tools you need to manage orders, track inventory, and analyze sales data. Contact us for specific pricing details for your business size.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">Is there a minimum order value?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Minimum order values are set by individual businesses. You can see the minimum order requirement before checkout. Some businesses offer free delivery above certain order values.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">How are delivery times calculated?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We use a combination of distance, traffic conditions, order preparation time, and historical data to provide accurate delivery estimates. Our AI constantly improves these predictions for better accuracy.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-lg">What happens if there's an issue with my order?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You can report issues directly through the app. Our customer service team is available 24/7 to help resolve any problems with orders, deliveries, or payments. Most issues are resolved within minutes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of businesses and customers already using DeliveryHub to simplify their delivery needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">
                Sign Up Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground hover:bg-primary-foreground/10 text-primary-foreground"
              asChild
            >
              <Link href="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-12 px-4 border-t">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Package className="h-6 w-6 text-primary" />
                <span className="font-bold text-xl">DeliveryHub</span>
              </div>
              <p className="text-muted-foreground">
                Connecting businesses, customers, and transport services for seamless deliveries across communities.
              </p>
              <div className="flex space-x-4 mt-4">
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.049c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.049H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z"/>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">For Customers</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/businesses" className="hover:text-foreground transition-colors">
                    Browse Businesses
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-foreground transition-colors">
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link href="/my-orders" className="hover:text-foreground transition-colors">
                    Track Orders
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="hover:text-foreground transition-colors">
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">For Businesses</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/register/business" className="hover:text-foreground transition-colors">
                    List Your Business
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/business" className="hover:text-foreground transition-colors">
                    Business Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/business-resources" className="hover:text-foreground transition-colors">
                    Resources
                  </Link>
                </li>
                <li>
                  <Link href="/business-pricing" className="hover:text-foreground transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} DeliveryHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
