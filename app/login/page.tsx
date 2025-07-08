import { AuthForm } from "@/components/auth/auth-form"

export default function LoginPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <AuthForm mode="login" />
      </div>
    </div>
  )
}
