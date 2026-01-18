# Déploiement sur Portainer

Ce guide explique comment déployer FormBuilder Standalone sur Portainer avec Docker Compose.

## Prérequis
- Portainer installé et accessible
- Accès à un registre Docker (Docker Hub ou privé)
- Variables d'environnement configurées (voir `.env.example`)

## 1. Créer un fichier `docker-compose.yml`

```yaml
version: '3.8'
services:
  app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: sh -c "npm install && npm run build && npm run start"
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

## 2. Déployer via Portainer

1. Connectez-vous à Portainer
2. Allez dans "Stacks" > "Add stack"
3. Collez le contenu du `docker-compose.yml`
4. Ajoutez vos variables d'environnement dans l'onglet dédié ou via `.env`
5. Cliquez sur "Deploy the stack"

## 3. Accéder à l'application

- Rendez-vous sur `http://[votre-serveur]:3000`

## Notes
- Adaptez le service `app` si vous utilisez une image Docker personnalisée
- Pour la production, montez un volume pour la base de données si besoin
- Consultez la documentation Portainer pour plus d'options avancées
