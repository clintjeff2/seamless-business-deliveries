'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map } from '@/components/ui/map'; // Your enhanced map component
import { MapPin, Phone, Package, Truck, CheckCircle, Clock, Navigation, AlertTriangle, Battery, Signal } from 'lucide-react';
import { format } from 'date-fns';
import type { DeliveryStatus } from '@/lib/types';

interface DeliveryWithDetails {
  id: string;
  status: DeliveryStatus;
  current_latitude?: number;
  current_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_address: string;
  estimated_delivery_time?: string;
  distance_km?: number;
  original_distance_km?: number;
  orders?: {
    id: string;
    business?: {
      name: string;
    };
  };
  transport_service?: {
    service_name: string;
    vehicle_type: string;
    phone?: string;
    driver?: {
      full_name: string;
      phone?: string;
    };
  };
}

interface RouteInfo {
  distance: number;
  duration: number;
  durationInTraffic: number;
  geometry: any;
  steps: any[];
}

const deliverySteps = [
  {
    step: 1,
    status: 'pending',
    icon: Package,
    label: 'Order Confirmed',
    desc: 'Your order has been placed',
  },
  {
    step: 2,
    status: 'accepted',
    icon: CheckCircle,
    label: 'Driver Assigned',
    desc: 'A driver has accepted your delivery',
  },
  {
    step: 3,
    status: 'picked_up',
    icon: Package,
    label: 'Order Picked Up',
    desc: 'Driver has collected your order',
  },
  {
    step: 4,
    status: 'in_transit',
    icon: Truck,
    label: 'On the Way',
    desc: 'Your order is being delivered',
  },
  {
    step: 5,
    status: 'delivered',
    icon: CheckCircle,
    label: 'Delivered',
    desc: 'Order has been delivered',
  },
];

export default function DeliveryTrackingPage() {
  const params = useParams();
  const deliveryId = params.deliveryId as string;
  const [delivery, setDelivery] = useState<DeliveryWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<Date | null>(null);
  const [trafficDelay, setTrafficDelay] = useState<number>(0);
  const [driverStatus, setDriverStatus] = useState<'online' | 'offline' | 'away'>('online');
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const fetchDelivery = async () => {
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select(
            `
            *,
            orders(
              id,
              business:businesses(name)
            ),
            transport_service:transport_services(
              service_name,
              vehicle_type,
              phone,
              driver:profiles(full_name, phone)
            )
          `
          )
          .eq('id', deliveryId)
          .single();

        if (error) throw error;
        if (mounted) {
          setDelivery(data);
          setError(null);
        }
      } catch (error: any) {
        if (mounted) {
          setError(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDelivery();

    // Set up real-time subscription for delivery updates
    const deliveryChannel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        (payload: { new: DeliveryWithDetails }) => {
          if (mounted) {
            setDelivery((prev) => {
              if (!prev) return null;
              return { ...prev, ...payload.new };
            });
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      deliveryChannel.unsubscribe();
    };
  }, [deliveryId, supabase]);

  // Handle route updates from the map
  const handleRouteUpdate = (newRouteInfo: RouteInfo) => {
    setRouteInfo(newRouteInfo);
    
    // Calculate estimated arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + newRouteInfo.durationInTraffic * 1000);
    setEstimatedArrival(arrivalTime);
    
    // Calculate traffic delay
    const delay = newRouteInfo.durationInTraffic - newRouteInfo.duration;
    setTrafficDelay(delay);
  };

  // Simulate driver status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const statuses: ('online' | 'offline' | 'away')[] = ['online', 'away'];
      setDriverStatus(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Show loading spinner
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !delivery) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Delivery Not Found</h1>
          <p className="text-gray-600">
            {error || "The delivery you're looking for doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  // Get status step from delivery status
  const getStatusStep = (status: DeliveryStatus): number => {
    const statusToStep: Record<DeliveryStatus, number> = {
      pending: 1,
      accepted: 2,
      picked_up: 3,
      in_transit: 4,
      delivered: 5,
      cancelled: 0,
    };
    return statusToStep[status] || 0;
  };

  const currentStep = getStatusStep(delivery.status);

  // Get map center coordinates with proper fallback
  const mapCenter: [number, number] =
    delivery?.current_latitude && delivery?.current_longitude
      ? [delivery.current_longitude, delivery.current_latitude]
      : delivery?.delivery_latitude && delivery?.delivery_longitude
      ? [delivery.delivery_longitude, delivery.delivery_latitude]
      : [-74.006, 40.7128]; // Default to NYC if no coordinates available

  // Define destination for routing
  const destination: [number, number] | undefined =
    delivery?.delivery_latitude && delivery?.delivery_longitude
      ? [delivery.delivery_longitude, delivery.delivery_latitude]
      : undefined;

  // Define map markers with proper types
  const mapMarkers = [
    ...(delivery?.current_latitude && delivery?.current_longitude
      ? [
          {
            position: [
              delivery.current_longitude,
              delivery.current_latitude,
            ] as [number, number],
            title: 'Driver Current Location',
            color: '#3B82F6', // Blue
          },
        ]
      : []),
    ...(delivery?.delivery_latitude && delivery?.delivery_longitude
      ? [
          {
            position: [
              delivery.delivery_longitude,
              delivery.delivery_latitude,
            ] as [number, number],
            title: 'Delivery Destination',
            color: '#EF4444', // Red
          },
        ]
      : []),
  ];

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (!delivery.original_distance_km || !routeInfo) return 0;
    const remainingDistance = routeInfo.distance / 1000; // Convert to km
    const traveledDistance = delivery.original_distance_km - remainingDistance;
    return Math.max(0, Math.min(100, (traveledDistance / delivery.original_distance_km) * 100));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Enhanced Map Section */}
      <div className="h-[65vh] relative">
        <Map
          center={mapCenter}
          markers={mapMarkers}
          className="w-full h-full"
          showLiveLocation={true}
          destination={destination}
          onRouteUpdate={handleRouteUpdate}
        />
        
        {/* Real-time Stats Overlay */}
        <div className="absolute top-4 right-4 space-y-2">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                driverStatus === 'online' ? 'bg-green-500' :
                driverStatus === 'away' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium dark:text-white">
                Driver {driverStatus}
              </span>
            </div>
          </div>
          
          {routeInfo && (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ETA</span>
                  <span className="text-sm font-bold dark:text-white">
                    {formatTimeRemaining(routeInfo.durationInTraffic)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Distance</span>
                  <span className="text-sm font-bold dark:text-white">
                    {(routeInfo.distance / 1000).toFixed(1)} km
                  </span>
                </div>
                {trafficDelay > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-600 dark:text-red-400">Traffic Delay</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      +{formatTimeRemaining(trafficDelay)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Delivery Info Section */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            {/* Header with enhanced info */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2 flex items-center dark:text-white">
                <MapPin className="h-6 w-6 mr-2" />
                Track Your Delivery
              </h1>
              <div className="flex items-center justify-between">
                <p className="text-gray-600 dark:text-gray-400">
                  Order #{delivery.orders?.id?.slice(0, 8)} from{' '}
                  {delivery.orders?.business?.name}
                </p>
                {estimatedArrival && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Arriving at {format(estimatedArrival, 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Progress Bar */}
            {routeInfo && delivery.original_distance_km && (
              <div className="mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium dark:text-white">Delivery Progress</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {calculateProgress().toFixed(0)}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${calculateProgress()}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Started: {delivery.original_distance_km.toFixed(1)} km</span>
                      <span>Remaining: {(routeInfo.distance / 1000).toFixed(1)} km</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Enhanced Status Timeline */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="dark:text-white">Delivery Status</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            delivery.status === 'delivered'
                              ? 'default'
                              : 'secondary'
                          }
                          className="ml-2"
                        >
                          {delivery.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <div className={`w-2 h-2 rounded-full ${
                          driverStatus === 'online' ? 'bg-green-500' :
                          driverStatus === 'away' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {deliverySteps.map((step, index) => (
                        <div
                          key={step.step}
                          className="flex items-center space-x-4"
                        >
                          <div className="relative">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                step.step <= currentStep
                                  ? 'bg-green-100 text-green-600 ring-2 ring-green-500'
                                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                              }`}
                            >
                              <step.icon className="h-5 w-5" />
                            </div>
                            {index < deliverySteps.length - 1 && (
                              <div className={`absolute top-10 left-1/2 w-0.5 h-8 transform -translate-x-1/2 ${
                                step.step < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                              }`}></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p
                              className={`font-semibold ${
                                step.step <= currentStep
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {step.label}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
                            {step.step === currentStep && (
                              <div className="mt-2 flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  Current Status
                                </span>
                              </div>
                            )}
                          </div>
                          {step.step <= currentStep && (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Route Information */}
                {routeInfo && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center dark:text-white">
                        <Navigation className="h-5 w-5 mr-2" />
                        Route Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total Distance:</span>
                            <span className="text-sm font-medium dark:text-white">
                              {(routeInfo.distance / 1000).toFixed(1)} km
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Normal Time:</span>
                            <span className="text-sm font-medium dark:text-white">
                              {formatTimeRemaining(routeInfo.duration)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">With Traffic:</span>
                            <span className="text-sm font-medium dark:text-white">
                              {formatTimeRemaining(routeInfo.durationInTraffic)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Traffic Delay:</span>
                            <span className={`text-sm font-medium ${
                              trafficDelay > 300 ? 'text-red-600 dark:text-red-400' :
                              trafficDelay > 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              {trafficDelay > 0 ? `+${formatTimeRemaining(trafficDelay)}` : 'None'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Route Type:</span>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              Fastest
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated:</span>
                            <span className="text-sm font-medium dark:text-white">
                              {format(new Date(), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Enhanced Driver Info and Details */}
              <div className="space-y-6">
                {delivery.transport_service && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center dark:text-white">
                        <Truck className="h-5 w-5 mr-2" />
                        Driver Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold dark:text-white">
                              {delivery.transport_service.service_name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {delivery.transport_service.vehicle_type}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${
                              driverStatus === 'online' ? 'bg-green-500' :
                              driverStatus === 'away' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium dark:text-white capitalize">
                              {driverStatus}
                            </span>
                          </div>
                        </div>
                        
                        {delivery.transport_service.driver && (
                          <div className="border-t pt-4 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold dark:text-white">
                                  {delivery.transport_service.driver.full_name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Driver</p>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Signal className="h-4 w-4 text-green-500" />
                                <Battery className="h-4 w-4 text-green-500" />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {delivery.transport_service.phone && (
                          <div className="space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(`tel:${delivery.transport_service.phone}`)}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Call Driver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(`sms:${delivery.transport_service.phone}`)}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Send Message
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Delivery Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center dark:text-white">
                      <Package className="h-5 w-5 mr-2" />
                      Delivery Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="font-semibold dark:text-white">Delivery Address</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {delivery.delivery_address}
                        </p>
                      </div>
                      
                      {estimatedArrival && (
                        <div>
                          <p className="font-semibold dark:text-white">Estimated Arrival</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {format(estimatedArrival, "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      )}
                      
                      {delivery.estimated_delivery_time && (
                        <div>
                          <p className="font-semibold dark:text-white">Original Estimate</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {format(
                              new Date(delivery.estimated_delivery_time),
                              "MMM d, yyyy 'at' h:mm a"
                            )}
                            </p>
                          </div>
                        )}
                      
                      {routeInfo && (
                        <div>
                          <p className="font-semibold dark:text-white">Remaining Distance</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {(routeInfo.distance / 1000).toFixed(1)} km
                          </p>
                        </div>
                      )}
                      
                      {delivery.original_distance_km && (
                        <div>
                          <p className="font-semibold dark:text-white">Original Distance</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {delivery.original_distance_km} km
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Live Updates */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center dark:text-white">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Live Updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse"></div>
                        <div>
                          <p className="text-sm font-medium dark:text-white">Driver online</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {format(new Date(), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                      
                      {trafficDelay > 0 && (
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                          <div>
                            <p className="text-sm font-medium dark:text-white">Traffic detected</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              +{formatTimeRemaining(trafficDelay)} delay
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium dark:text-white">Route optimized</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Following fastest route
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}