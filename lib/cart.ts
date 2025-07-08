"use client"

import type { Item, CartItem } from "./types"

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return []
  const cart = localStorage.getItem("cart")
  return cart ? JSON.parse(cart) : []
}

export function addToCart(item: Item, quantity = 1) {
  const cart = getCart()
  const existingItem = cart.find((cartItem) => cartItem.item.id === item.id)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({ item, quantity })
  }

  localStorage.setItem("cart", JSON.stringify(cart))
  window.dispatchEvent(new Event("cartUpdated"))
}

export function updateCartItem(itemId: string, quantity: number) {
  const cart = getCart()
  const itemIndex = cart.findIndex((cartItem) => cartItem.item.id === itemId)

  if (itemIndex !== -1) {
    if (quantity <= 0) {
      cart.splice(itemIndex, 1)
    } else {
      cart[itemIndex].quantity = quantity
    }
    localStorage.setItem("cart", JSON.stringify(cart))
    window.dispatchEvent(new Event("cartUpdated"))
  }
}

export function removeFromCart(itemId: string) {
  const cart = getCart().filter((cartItem) => cartItem.item.id !== itemId)
  localStorage.setItem("cart", JSON.stringify(cart))
  window.dispatchEvent(new Event("cartUpdated"))
}

export function clearCart() {
  localStorage.removeItem("cart")
  window.dispatchEvent(new Event("cartUpdated"))
}

export function getCartTotal(): number {
  return getCart().reduce((total, cartItem) => total + cartItem.item.price * cartItem.quantity, 0)
}

export function getCartItemCount(): number {
  return getCart().reduce((total, cartItem) => total + cartItem.quantity, 0)
}
