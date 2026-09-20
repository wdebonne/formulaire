import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// La suite ne couvre que les modules purs de `src/lib` — ceux qui n'importent ni Prisma, ni
// `next/headers`, ni nodemailer. C'est précisément ce que la séparation pur / serveur suivie dans
// tout le projet rend possible : ils s'exécutent sans base, sans serveur et sans navigateur.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Les dates sont interprétées dans le fuseau du serveur (voir `form-options.ts`) : figer le
    // fuseau évite qu'un test passe à Paris et échoue sur un agent CI en UTC.
    env: { TZ: 'Europe/Paris' },
  },
})
