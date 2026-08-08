import { NextRequest, NextResponse } from 'next/server'
import { runDueReports } from '@/lib/report-scheduler'

// POST /api/internal/reports/run — déclenche la vérification des échéances de rapport.
//
// Le planificateur en processus (src/instrumentation.ts) suffit dans le cas courant ; cette
// route existe pour les déploiements qui préfèrent un cron externe, ou pour forcer un passage
// sans redémarrer le conteneur. Même authentification par secret partagé que
// /api/internal/ip-lists, et exclusion du filtrage IP par le middleware.
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-internal-secret')
    if (!secret || !process.env.JWT_SECRET || secret !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const summary = await runDueReports()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Erreur lors du passage du planificateur de rapports:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
