"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { addToCart } from "@/lib/cart"
import { ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Item } from "@/lib/types"

interface AddToCartButtonProps {
  item: Item
  quantity?: number
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
}

export function AddToCartButton({ item, quantity = 1, variant = "default", size = "sm" }: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleAddToCart = async () => {
    if (!item.is_available || item.stock_quantity <= 0) {
      toast({
        title: "Item Unavailable",
        description: "This item is currently out of stock",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      addToCart(item, quantity)
      toast({
        title: "Added to Cart",
        description: `${item.name} has been added to your cart`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAddToCart}
      disabled={loading || !item.is_available || item.stock_quantity <= 0}
      variant={variant}
      size={size}
    >
      {loading ? (
        "Adding..."
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-1" />
          Add to Cart
        </>
      )}
    </Button>
  )
}
