'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Users,
  Mail,
  Database,
  Palette,
  Settings,
  Shield,
  Type,
  Trash2,
  Cloud,
  Lock,
  ShieldCheck,
} from 'lucide-react'

interface AdminSettingsClientProps {
  user: {
    id: string
    email: string
    name: string | null
    role: string
  }
}

export function AdminSettingsClient({ user }: AdminSettingsClientProps) {
  const adminSections = [
    {
      title: 'Utilisateurs',
      description: 'Gérer les utilisateurs et leurs rôles',
      icon: Users,
      href: '/admin/users',
      color: 'bg-blue-500',
    },
    {
      title: 'Polices',
      description: 'Gérer les polices d\'écriture disponibles',
      icon: Type,
      href: '/admin/fonts',
      color: 'bg-pink-500',
    },
    {
      title: 'SMTP & Templates',
      description: 'Configurer les emails et les templates',
      icon: Mail,
      href: '/admin/smtp',
      color: 'bg-green-500',
    },
    {
      title: 'Base de données',
      description: 'Gérer et sauvegarder la base de données',
      icon: Database,
      href: '/admin/database',
      color: 'bg-orange-500',
    },
    {
      title: 'Personnalisation',
      description: 'Nom du site, logo et favicon',
      icon: Palette,
      href: '/admin/customization',
      color: 'bg-purple-500',
    },
    {
      title: 'Paramètres généraux',
      description: 'Configuration générale du site',
      icon: Settings,
      href: '/admin/general',
      color: 'bg-gray-500',
    },
    {
      title: 'Corbeille',
      description: 'Restaurer ou supprimer définitivement les formulaires supprimés',
      icon: Trash2,
      href: '/admin/trash',
      color: 'bg-red-500',
    },
    {
      title: 'NextCloud',
      description: 'Configurer la connexion WebDAV partagée pour lier des fichiers aux formulaires',
      icon: Cloud,
      href: '/admin/nextcloud',
      color: 'bg-blue-500',
    },
    {
      title: 'Sécurité',
      description: 'Listes IP, protection anti-bruteforce et adresses bloquées',
      icon: Lock,
      href: '/admin/security',
      color: 'bg-slate-700',
    },
    {
      title: 'RGPD',
      description: 'Durée de conservation des réponses, recherche et droits des personnes',
      icon: ShieldCheck,
      href: '/admin/gdpr',
      color: 'bg-emerald-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au tableau de bord
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h1 className="text-xl font-semibold">Administration</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Panneau d'administration</h2>
          <p className="text-gray-600 mt-1">
            Gérez les utilisateurs, la configuration et les paramètres du système.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${section.color}`}>
                      <section.icon className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{section.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
