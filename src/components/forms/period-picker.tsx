'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MANUAL_PERIOD_OPTIONS } from '@/lib/manual-period'
import type { ReportPeriod } from '@/types/form'

interface PeriodPickerProps {
  period: ReportPeriod
  onChange: (period: ReportPeriod) => void
}

// Sélecteur de période partagé par l'export des réponses et la page de statistiques : les deux
// écrans proposent les mêmes modes, et resolveReportRange() les interprète identiquement.
export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
  const patch = (changes: Partial<ReportPeriod>) => onChange({ ...period, ...changes })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {MANUAL_PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => patch({ mode: option.value })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              period.mode === option.value
                ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period.mode === 'last_days' && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            type="number"
            min={1}
            max={3650}
            value={period.days ?? 7}
            onChange={(e) => patch({ days: Number(e.target.value) })}
            className="w-24"
          />
          <span className="text-sm text-gray-500">derniers jours</span>
        </div>
      )}

      {period.mode === 'custom' && (
        <div className="grid max-w-md grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Du</Label>
            <Input
              type="date"
              value={period.from ?? ''}
              onChange={(e) => patch({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Au</Label>
            <Input
              type="date"
              value={period.to ?? ''}
              onChange={(e) => patch({ to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
