// Contrôle d'accès à un formulaire, partagé par les routes API liées aux documents.
//
// Reprend exactement la logique de src/app/forms/[id]/responses/page.tsx : propriétaire,
// partage explicite (FormShare) ou administrateur global. Le rôle est relu en base plutôt
// que pris dans le JWT, pour rester juste après un changement de rôle.
//
// Un formulaire à la corbeille (deletedAt non nul) est invisible ici, y compris pour un
// administrateur : seules les routes /api/admin/trash le manipulent encore.

import { prisma } from './prisma'
import type { JWTPayload } from './auth'

export type FormAccessLevel = 'read' | 'write'

const WRITE_PERMISSIONS = ['edit', 'admin']
const READ_PERMISSIONS = ['view', 'edit', 'admin']

export async function getAccessibleForm(
  formId: string,
  session: JWTPayload,
  level: FormAccessLevel
) {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })

  if (user?.role === 'admin') {
    return prisma.form.findFirst({ where: { id: formId, deletedAt: null } })
  }

  const permissions = level === 'write' ? WRITE_PERMISSIONS : READ_PERMISSIONS

  return prisma.form.findFirst({
    where: {
      id: formId,
      deletedAt: null,
      OR: [
        { userId: session.userId },
        { shares: { some: { userId: session.userId, permission: { in: permissions } } } },
      ],
    },
  })
}
