"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"

interface OrderSearchFormProps {
  initialSearch: string
  initialStatus: string
}

export function OrderSearchForm({ initialSearch, initialStatus }: OrderSearchFormProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters()
  }

  const updateFilters = () => {
    const params = new URLSearchParams(searchParams)
    
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    
    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter)
    } else {
      params.delete('status')
    }
    
    router.push(`/dashboard/business/orders?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    const params = new URLSearchParams(searchParams)
    
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    
    if (value && value !== 'all') {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    
    router.push(`/dashboard/business/orders?${params.toString()}`)
  }

  const handleClear = () => {
    setSearchTerm("")
    setStatusFilter("all")
    router.push(`/dashboard/business/orders`)
  }

  return (
    <div className="mb-6 space-y-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <Input
          type="text"
          placeholder="Search by Order ID or Customer Name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="default" size="sm">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        {(searchTerm || statusFilter !== 'all') && (
          <Button type="button" variant="outline" size="sm" onClick={handleClear}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </form>
    </div>
  )
}