'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { cn, getLoginBackgroundStyle } from '@/lib/utils'
import type { LoginPageSettings } from '@/types/form'

interface PublicSettings {
  siteName: string
  siteLogo: string | null
  registrationEnabled: boolean
  loginPageSettings: LoginPageSettings | null
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<PublicSettings>({
    siteName: 'FormBuilder',
    siteLogo: null,
    registrationEnabled: true,
    loginPageSettings: null,
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur de connexion')
      }

      toast({
        title: 'Connexion réussie',
        description: `Bienvenue sur ${settings.siteName} !`,
      })

      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const background = getLoginBackgroundStyle(settings.loginPageSettings)
  const showForgotPassword = settings.loginPageSettings?.showForgotPassword ?? true

  return (
    <div
      className={cn('relative min-h-screen flex items-center justify-center p-4 overflow-hidden', background.className)}
      style={background.style}
    >
      {background.imageLayerStyle && <div style={background.imageLayerStyle} />}
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {settings.siteLogo ? (
              <img src={settings.siteLogo} alt={settings.siteName} className="h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {settings.siteName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{settings.siteName}</CardTitle>
          <CardDescription>
            Connectez-vous à votre compte
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {showForgotPassword && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
            {settings.registrationEnabled && (
              <p className="text-sm text-muted-foreground text-center">
                Pas encore de compte ?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  S'inscrire
                </Link>
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
