---
status: ready-for-dev
source_prd: _bmad-output/planning-artifacts/prd-intercom-saas-v1.md
---

# Epics & User Stories — Intercom SaaS V1

Ordre d'exécution recommandé pour le déploiement d'aujourd'hui : **Epic 1 → 2 → 3 → 4**.
Epic 5 est un stretch goal, à ne prendre que si le temps le permet après le déploiement.

---

## Epic 1 — Backend Valkey (remplace le store filesystem)

**But** : réimplémenter `store.ts` sur Valkey au lieu du filesystem, sans changer la forme
des données exposées (`PresenceInfo`, `Message`) pour ne pas casser les appelants.

### Story 1.1 — Client Valkey et configuration

**As a** développeur déployant le service, **I want** une connexion Valkey configurable par
variable d'environnement, **so that** le service pointe vers le conteneur `valkey` en
docker-compose sans code en dur.

- Tasks:
  - Ajouter la dépendance `iovalkey` dans `package.json`
  - Créer `src/valkey/client.ts` : exporte un client connecté via `VALKEY_URL`
    (`redis://valkey:6379` par défaut)
- AC:
  - Given `VALKEY_URL` n'est pas défini, When le client démarre, Then il se connecte à
    `redis://localhost:6379`
  - Given `VALKEY_URL=redis://valkey:6379`, When le client démarre dans le conteneur `api`,
    Then la connexion au conteneur `valkey` réussit

### Story 1.2 — Présence via clés TTL

**As a** agent qui s'enregistre, **I want** que ma présence expire automatiquement si je ne
la renouvelle pas, **so that** les agents morts disparaissent sans nettoyage manuel par PID.

- Tasks:
  - Dans `src/valkey/presenceStore.ts`, implémenter `register(code, project)` :
    `SET presence:{code} {json} EX 30`
  - Implémenter `heartbeat(code)` : `EXPIRE presence:{code} 30` (renouvelle le TTL)
  - Implémenter `listAgents(projectFilter?)` : `SCAN` sur `presence:*`, parse JSON, filtre
    par projet
  - Supprimer la logique `isPidAlive`/`getPpid`/`getAncestorPids` (obsolète en mode réseau)
- AC:
  - Given un agent enregistré, When 30s passent sans heartbeat, Then `listAgents()` ne le
    retourne plus
  - Given un agent enregistré, When il envoie un heartbeat avant expiration, Then il reste
    visible dans `listAgents()`

### Story 1.3 — Inbox via Streams

**As a** agent qui envoie un message, **I want** qu'il soit stocké dans un Stream Valkey par
destinataire, **so that** l'ordre est garanti et l'historique récent est consultable.

- Tasks:
  - Dans `src/valkey/messageStore.ts`, implémenter `sendMessage(from, to, message, replyTo?)` :
    `XADD inbox:{to} MAXLEN ~ 1000 * from {from} message {message} reply_to {replyTo ?? ""}`
  - Implémenter `peekMessages(code)` : `XRANGE inbox:{code} - +`, mappe vers `Message[]`
  - Implémenter `ackMessage(code, messageId)` : `XDEL inbox:{code} {messageId}`
  - Implémenter `ackAll(code)` : lit tous les IDs puis `XDEL` en lot
  - Réutiliser `assertSafeId` (déjà écrit dans `src/store.ts`) sur `from`/`to`/`code` avant
    toute clé Valkey — même garde-fou anti path-traversal, appliqué ici aux clés Valkey pour
    éviter l'injection de motifs `SCAN`/nom de clé arbitraire
- AC:
  - Given deux agents enregistrés, When A envoie un message à B, Then `peekMessages(B)`
    retourne ce message avec le bon `from`
  - Given un message dans l'inbox, When `ackMessage` est appelé avec son id, Then il
    disparaît de `peekMessages`
  - Given un `to` ou `code` contenant `../` ou des caractères hors `[A-Za-z0-9_-]`, When une
    fonction du store est appelée, Then elle lève une erreur avant tout accès Valkey

### Story 1.4 — Notification Pub/Sub

**As a** service API, **I want** être notifié immédiatement quand un message est ajouté à un
inbox, **so that** je peux pousser l'événement aux clients connectés en SSE.

- Tasks:
  - Dans `sendMessage` (`src/valkey/messageStore.ts`), après le `XADD`, publier sur le canal
    `notify:{to}` (`PUBLISH notify:{to} {messageId}`)
  - Créer `src/valkey/subscribe.ts` : expose `onNewMessage(code, callback)` qui s'abonne à
    `notify:{code}`
- AC:
  - Given un abonné actif sur `notify:aaaa`, When un message est envoyé à `aaaa`, Then le
    callback est appelé en moins de 100ms

---

## Epic 2 — API HTTP + SSE

**But** : exposer les opérations existantes en HTTP, plus un flux SSE pour la notification
live. Réutilise les fonctions d'Epic 1.

### Story 2.1 — Serveur HTTP de base

**As a** client (script, futur MCP, dashboard), **I want** une API HTTP simple, **so that**
je peux interagir avec l'intercom sans stdio MCP.

- Tasks:
  - Créer `src/api/http.ts` : serveur `Bun.serve` sur le port `PORT` (défaut `8787`)
  - Router minimal (switch sur `req.method` + `url.pathname`, pas de framework — pas besoin
    de plus pour 7 routes)
  - Route `GET /health` → `200 { status: "ok" }`, sans auth
- AC:
  - Given le service démarré, When `GET /health`, Then réponse `200` avec `{"status":"ok"}`

### Story 2.2 — Routes CRUD messagerie

**As a** client HTTP, **I want** les 6 opérations existantes en REST, **so that** je peux
m'enregistrer, envoyer, lire, répondre et acquitter des messages.

- Tasks:
  - `POST /register` `{code, project}` → appelle `presenceStore.register`
  - `POST /heartbeat` `{code}` → appelle `presenceStore.heartbeat`
  - `GET /who?scope=project|all&project=X` → `presenceStore.listAgents`
  - `POST /send` `{from, to, message}` → `messageStore.sendMessage`
  - `POST /reply` `{from, message_id, message}` → lit l'original via `peekMessages`, envoie,
    puis ack (même logique que `server.ts` actuel, portée en HTTP)
  - `GET /peek?code=X` → `messageStore.peekMessages`
  - `POST /ack` `{code, message_id}` → `messageStore.ackMessage`
  - `POST /ack_all` `{code}` → `messageStore.ackAll`
  - Toutes les routes body JSON invalide → `400`
- AC:
  - Given un agent enregistré, When `POST /send` puis `GET /peek`, Then le message envoyé
    apparaît dans la réponse
  - Given un `message_id` invalide sur `/ack`, When appelé, Then `404` (pas de crash serveur)

### Story 2.3 — Endpoint SSE `/events`

**As a** client connecté, **I want** un flux SSE qui pousse les nouveaux messages en temps
réel, **so that** je n'ai pas besoin de poller `/peek`.

- Tasks:
  - `GET /events?code=X` : ouvre une réponse `text/event-stream`, s'abonne via
    `onNewMessage(code, ...)` (Epic 1.4), écrit `data: {message JSON}\n\n` à chaque nouveau
    message
  - Heartbeat SSE toutes les 15s (`: ping\n\n`) pour garder la connexion vivante à travers
    les proxys/reverse-proxy du VPS
  - Fermeture propre de l'abonnement Valkey quand le client se déconnecte
    (`req.signal.addEventListener("abort", ...)`)
- AC:
  - Given un client connecté à `/events?code=aaaa`, When un autre agent envoie un message à
    `aaaa`, Then le client reçoit l'événement SSE sans avoir appelé `/peek`
  - Given un client déconnecté (ferme l'onglet/process), When la connexion se ferme, Then
    l'abonnement Valkey correspondant est libéré (pas de fuite)

---

## Epic 3 — Auth minimale par token de workspace

**But** : empêcher qu'un tiers non autorisé lise/écrive sur le service exposé publiquement
sur le VPS. Pas de RBAC, pas de comptes utilisateurs — un token partagé par workspace, à
faire évoluer plus tard.

### Story 3.1 — Vérification du token sur chaque route

**As an** opérateur du service, **I want** que toute requête (sauf `/health`) exige un
token valide, **so that** le service exposé sur Internet n'est pas ouvert à tous.

- Tasks:
  - `src/api/auth.ts` : `isValidToken(token)` compare contre la liste `API_TOKENS` (env,
    séparée par virgules)
  - Dans `src/api/http.ts`, avant de router (sauf `/health`) : lire le header
    `Authorization: Bearer <token>`, rejeter avec `401` si absent/invalide
- AC:
  - Given aucun header `Authorization`, When une route protégée est appelée, Then `401`
  - Given un token présent dans `API_TOKENS`, When une route protégée est appelée, Then la
    requête est traitée normalement
  - Given `GET /health`, When appelé sans token, Then `200` (toujours accessible pour le
    monitoring)

---

## Epic 4 — Déploiement Docker Compose sur le VPS

**But** : un `docker-compose up -d` qui démarre tout, prêt pour la prod du jour.

### Story 4.1 — Dockerfile du service API

**As an** opérateur, **I want** une image Docker du service API basée sur Bun, **so that**
elle tourne de façon identique en local et sur le VPS.

- Tasks:
  - Créer `Dockerfile` à la racine : `FROM oven/bun:1`, `COPY . .`, `RUN bun install
    --production`, `CMD ["bun", "src/api/http.ts"]`, `EXPOSE 8787`
- AC:
  - Given l'image construite (`docker build .`), When lancée avec `VALKEY_URL` et
    `API_TOKENS` en env, Then `GET /health` répond `200`

### Story 4.2 — docker-compose.yml

**As an** opérateur, **I want** un seul fichier orchestrant `valkey` + `api`, **so that** le
déploiement tient en une commande.

- Tasks:
  - Créer `docker-compose.yml` :
    - service `valkey` : image `valkey/valkey:8`, volume nommé pour la persistance
      (`valkey-data:/data`), pas de port exposé publiquement (réseau interne uniquement)
    - service `api` : build `.`, `env_file: .env`, `ports: ["8787:8787"]`, `depends_on:
      valkey`
    - `restart: unless-stopped` sur les deux services
  - Créer `.env.example` documentant `API_TOKENS`, `VALKEY_URL=redis://valkey:6379`, `PORT`
  - Ajouter `.env` au `.gitignore` (le fichier réel ne doit jamais être commité)
- AC:
  - Given `.env` rempli sur le VPS, When `docker-compose up -d`, Then `valkey` et `api`
    démarrent, et `curl http://<vps>:8787/health` répond `200`
  - Given le VPS redémarre, When les conteneurs redémarrent (`restart: unless-stopped`),
    Then les données Valkey persistent (volume nommé)

### Story 4.3 — Vérification bout-en-bout post-déploiement

**As an** opérateur, **I want** un scénario de vérification manuel documenté, **so that** je
sais que le déploiement du jour fonctionne réellement avant de le considérer terminé.

- Tasks:
  - Ajouter dans `README.md` une section "Déploiement V1 (VPS)" avec la séquence de
    vérification : register → who → send → peek (ou SSE) → ack, en `curl`, avec exemples de
    commandes exactes
- AC:
  - Given le service déployé, When la séquence `curl` du README est exécutée dans l'ordre,
    Then chaque étape retourne le résultat attendu documenté (codes 200, message reçu, etc.)

---

## Epic 5 — (Stretch) Rewiring du serveur MCP stdio vers l'API distante

**But** : faire parler le serveur MCP existant (`src/server.ts`, utilisé par Claude Code en
local) au nouveau backend réseau au lieu du store filesystem local. **Explicitement reporté
si le temps manque aujourd'hui** — le service backend (Epics 1-4) est utilisable et
vérifiable indépendamment via `curl`/SSE sans cette story.

### Story 5.1 — Client HTTP dans le serveur MCP

**As a** Claude Code agent, **I want** que mes appels `who`/`send`/`peek`/etc. passent par
l'API distante, **so that** je communique avec des agents sur d'autres machines, pas
seulement en local.

- Tasks:
  - Créer `src/mcpClient.ts` : wrappe `fetch` vers `INTERCOM_API_URL` avec le token
    `INTERCOM_API_TOKEN` (env), une fonction par opération
  - Dans `src/server.ts`, remplacer les imports de `./store.js` par `./mcpClient.js` (même
    signatures de fonctions, changement de source de données uniquement)
  - `hook.ts`/`watcher.ts` : remplacer `peekMessagesSync`/`findMyCodeSync` (fs-based) par un
    appel HTTP synchrone équivalent, ou consommer `/events` en SSE depuis `watcher.ts` au
    lieu de `fs.watch`
- AC:
  - Given `INTERCOM_API_URL` configuré, When un agent appelle l'outil MCP `send`, Then le
    message apparaît dans l'inbox du destinataire via l'API distante (vérifiable par
    `curl GET /peek`)
  - Given deux instances Claude Code sur deux machines différentes pointant vers le même
    `INTERCOM_API_URL`, When l'une envoie un message à l'autre, Then l'autre le reçoit (test
    qui n'était pas possible avec le store filesystem local)
