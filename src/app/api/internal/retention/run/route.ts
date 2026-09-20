import { NextRequest, NextResponse } from 'next/server'
import { runDueRetentionPurges } from '@/lib/retention-purge'

// POST /api/internal/retention/run — déclenche les purges de conservation dont l'échéance
// quotidienne est atteinte (réponses RGPD et journal d'activité).
//
// La minuterie en processus (src/lib/maintenance-scheduler.ts) suffit dans le cas courant ;
// cette route existe pour les déploiements qui préfèrent un cron externe, ou pour forcer un
// passage sans redémarrer le conteneur. Même authentification par secret partagé que
// /api/internal/reports/run, et exclusion du filtrage IP par le middleware.
//
// Les interrupteurs restent souverains : un appel ici ne purge rien tant que la purge
// automatique n'est pas activée dans l'écran d'administration correspondant.
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-internal-secret')
    if (!secret || !process.env.JWT_SECRET || secret !== process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const summary = await runDueRetentionPurges()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Erreur lors du passage des purges de conservation:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
