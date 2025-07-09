"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

export function DeliverySearchForm({ initialSearch }: { initialSearch: string }) {
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    
    router.push(`/dashboard/transport/requests?${params.toString()}`)
  }

  const handleClear = () => {
    setSearchTerm("")
    const params = new URLSearchParams(searchParams)
    params.delete('search')
    router.push(`/dashboard/transport/requests?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex items-center gap-4">
      <Input
        type="text"
        placeholder="Search by Order ID"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="default" size="sm">
        <Search className="mr-2 h-4 w-4" />
        Search
      </Button>
      {searchTerm && (
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
      )}
    </form>
  )
}