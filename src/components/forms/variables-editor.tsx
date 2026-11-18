'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MAX_ROUTE_VARIABLE_LENGTH,
  MAX_ROUTE_VARIABLES,
  toVariableKey,
} from '@/lib/document-fields'
import type { EmailRouteVariable } from '@/types/form'
import { Plus, X } from 'lucide-react'

// Shared by the template modal (values common to every route) and each route (its own values):
// same keys, same limits, same collision warnings, so the two never drift apart.
export function VariablesEditor({
  title,
  description,
  variables,
  onChange,
  shadowedTags,
}: {
  title: string
  description: ReactNode
  variables: EmailRouteVariable[]
  onChange: (variables: EmailRouteVariable[]) => void
  shadowedTags: { tags: Set<string>; note: string }[]
}) {
  const update = (index: number, patch: Partial<EmailRouteVariable>) =>
    onChange(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)))

  return (
    <div className="space-y-3">
      <div>
        <Label>{title}</Label>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>

      {variables.map((variable, index) => {
        const key = variable.key.replace(/^_+|_+$/g, '')
        const duplicate =
          key && variables.findIndex((v) => v.key.replace(/^_+|_+$/g, '') === key) < index
        const shadow = key ? shadowedTags.find((s) => s.tags.has(key)) : undefined
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                value={variable.key}
                onChange={(e) => update(index, { key: toVariableKey(e.target.value) })}
                placeholder="date"
                aria-label="Nom du jeton"
                className="w-48 font-mono"
              />
              <Input
                value={variable.value}
                onChange={(e) => update(index, { value: e.target.value })}
                placeholder="{today|JJ/MM/AAAA}"
                aria-label={key ? `Valeur de {${key}}` : 'Valeur'}
                maxLength={MAX_ROUTE_VARIABLE_LENGTH}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => onChange(variables.filter((_, i) => i !== index))}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Retirer cette valeur"
                aria-label="Retirer cette valeur"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {key && !duplicate && (
              <p className="pl-1 text-xs text-gray-500">
                Jeton : <code className="font-mono text-gray-700">{`{${key}}`}</code>
                {shadow && <span className="ml-2 text-amber-700">— {shadow.note}</span>}
              </p>
            )}
            {duplicate && (
              <p className="pl-1 text-xs text-amber-700">
                Déjà défini plus haut : cette ligne sera ignorée.
              </p>
            )}
          </div>
        )
      })}

      {variables.length < MAX_ROUTE_VARIABLES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...variables, { key: '', value: '' }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une valeur
        </Button>
      )}
    </div>
  )
}
