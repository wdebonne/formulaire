'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Lock,
  Loader2,
  Plus,
  Trash2,
  ShieldBan,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'

interface SecuritySettings {
  enabled: boolean
  maxFailedAttempts: number
  attemptWindowMinutes: number
  blockDurationMinutes: number
}

interface IpRule {
  id: string
  ipAddress: string
  listType: 'whitelist' | 'blacklist'
  note: string | null
  createdAt: string
}

interface BlockedIp {
  id: string
  ipAddress: string
  failedAttempts: number
  blockedUntil: string | null
}

const DEFAULT_SETTINGS: SecuritySettings = {
  enabled: true,
  maxFailedAttempts: 5,
  attemptWindowMinutes: 15,
  blockDurationMinutes: 15,
}

export function SecurityClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS)
  const [ipRules, setIpRules] = useState<IpRule[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([])

  const [newIp, setNewIp] = useState({ whitelist: '', blacklist: '' })
  const [newNote, setNewNote] = useState({ whitelist: '', blacklist: '' })
  const [addingType, setAddingType] = useState<'whitelist' | 'blacklist' | null>(null)

  const fetchAll = async () => {
    try {
      const [settingsRes, rulesRes, blockedRes] = await Promise.all([
        fetch('/api/admin/security'),
        fetch('/api/admin/security/ip-rules'),
        fetch('/api/admin/security/blocked-ips'),
      ])

      if (settingsRes.ok) setSettings(await settingsRes.json())
      if (rulesRes.ok) setIpRules(await rulesRes.json())
      if (blockedRes.ok) setBlockedIps(await blockedRes.json())
    } catch (error) {
      console.error('Error fetching security data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')

      const data = await res.json()
      setSettings(data)
      toast({ title: 'Paramètres sauvegardés', description: 'Les règles anti-bruteforce ont été mises à jour' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddIpRule = async (listType: 'whitelist' | 'blacklist') => {
    const ipAddress = newIp[listType].trim()
    if (!ipAddress) return

    setAddingType(listType)
    try {
      const res = await fetch('/api/admin/security/ip-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, listType, note: newNote[listType].trim() || undefined }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'ajout")

      setIpRules((prev) => [data, ...prev])
      setNewIp((prev) => ({ ...prev, [listType]: '' }))
      setNewNote((prev) => ({ ...prev, [listType]: '' }))
      toast({
        title: 'IP ajoutée',
        description: `${ipAddress} a été ajoutée à la liste ${listType === 'whitelist' ? 'blanche' : 'noire'}`,
      })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setAddingType(null)
    }
  }

  const handleDeleteIpRule = async (rule: IpRule) => {
    if (!confirm(`Retirer ${rule.ipAddress} de la liste ${rule.listType === 'whitelist' ? 'blanche' : 'noire'} ?`)) return

    try {
      const res = await fetch(`/api/admin/security/ip-rules/${rule.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')

      setIpRules((prev) => prev.filter((r) => r.id !== rule.id))
      toast({ title: 'IP retirée', description: `${rule.ipAddress} a été retirée de la liste` })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  const handleUnblock = async (block: BlockedIp) => {
    if (!confirm(`Débloquer l'adresse IP ${block.ipAddress} ?`)) return

    try {
      const res = await fetch(`/api/admin/security/blocked-ips/${block.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors du déblocage')

      setBlockedIps((prev) => prev.filter((b) => b.id !== block.id))
      toast({ title: 'IP débloquée', description: `${block.ipAddress} peut de nouveau se connecter` })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const renderIpList = (listType: 'whitelist' | 'blacklist') => {
    const rules = ipRules.filter((r) => r.listType === listType)
    const isWhitelist = listType === 'whitelist'

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {isWhitelist ? (
            <ShieldCheck className="w-4 h-4 text-green-600" />
          ) : (
            <ShieldBan className="w-4 h-4 text-red-600" />
          )}
          <h3 className="font-medium">{isWhitelist ? 'Liste blanche' : 'Liste noire'}</h3>
        </div>
        <p className="text-sm text-gray-500">
          {isWhitelist
            ? "Ces adresses IP ne sont jamais bloquées, même après plusieurs échecs de connexion."
            : "Ces adresses IP n'ont accès à aucune page du site."}
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Adresse IP (ex: 203.0.113.42)"
            value={newIp[listType]}
            onChange={(e) => setNewIp((prev) => ({ ...prev, [listType]: e.target.value }))}
            className="sm:max-w-[220px]"
          />
          <Input
            placeholder="Note (optionnel)"
            value={newNote[listType]}
            onChange={(e) => setNewNote((prev) => ({ ...prev, [listType]: e.target.value }))}
            className="flex-1"
          />
          <Button onClick={() => handleAddIpRule(listType)} disabled={addingType === listType || !newIp[listType].trim()}>
            {addingType === listType ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Ajouter
          </Button>
        </div>

        <div className="space-y-2">
          {rules.length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucune adresse dans cette liste</p>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-mono text-sm">{rule.ipAddress}</p>
                {rule.note && <p className="text-xs text-gray-500">{rule.note}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteIpRule(rule)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-slate-700" />
              <h1 className="text-xl font-semibold">Sécurité</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Anti-bruteforce rules */}
        <Card>
          <CardHeader>
            <CardTitle>Protection anti-bruteforce</CardTitle>
            <CardDescription>
              Bloque automatiquement une adresse IP après plusieurs tentatives de connexion échouées
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Activer la protection</p>
                <p className="text-sm text-gray-500">
                  Désactivez uniquement à des fins de débogage — non recommandé en production
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxFailedAttempts">Tentatives avant blocage</Label>
                <Input
                  id="maxFailedAttempts"
                  type="number"
                  min={1}
                  value={settings.maxFailedAttempts}
                  onChange={(e) => setSettings({ ...settings, maxFailedAttempts: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attemptWindowMinutes">Fenêtre de temps (minutes)</Label>
                <Input
                  id="attemptWindowMinutes"
                  type="number"
                  min={1}
                  value={settings.attemptWindowMinutes}
                  onChange={(e) => setSettings({ ...settings, attemptWindowMinutes: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blockDurationMinutes">Durée du blocage (minutes)</Label>
                <Input
                  id="blockDurationMinutes"
                  type="number"
                  min={1}
                  value={settings.blockDurationMinutes}
                  onChange={(e) => setSettings({ ...settings, blockDurationMinutes: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Exemple : avec les valeurs ci-dessus, une IP sera bloquée pendant {settings.blockDurationMinutes} minute(s)
              après {settings.maxFailedAttempts} échecs de connexion en moins de {settings.attemptWindowMinutes} minute(s).
            </p>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer les règles
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* IP lists */}
        <Card>
          <CardHeader>
            <CardTitle>Listes d'adresses IP</CardTitle>
            <CardDescription>
              Les adresses en liste noire sont bloquées sur l'ensemble du site (la propagation peut prendre jusqu'à une minute).
              Les adresses en liste blanche ne sont jamais bloquées par la protection anti-bruteforce.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {renderIpList('whitelist')}
            <div className="border-t pt-6">{renderIpList('blacklist')}</div>
          </CardContent>
        </Card>

        {/* Currently blocked IPs */}
        <Card>
          <CardHeader>
            <CardTitle>Adresses IP actuellement bloquées</CardTitle>
            <CardDescription>
              Bloquées automatiquement suite à plusieurs échecs de connexion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {blockedIps.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400 italic py-4">
                <ShieldAlert className="w-4 h-4" />
                Aucune adresse IP bloquée pour le moment
              </div>
            )}
            {blockedIps.map((block) => (
              <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-mono text-sm">{block.ipAddress}</p>
                  <p className="text-xs text-gray-500">
                    {block.failedAttempts} tentative(s) échouée(s) — bloquée jusqu'au{' '}
                    {block.blockedUntil ? new Date(block.blockedUntil).toLocaleString('fr-FR') : '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(block)}>
                  Débloquer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
