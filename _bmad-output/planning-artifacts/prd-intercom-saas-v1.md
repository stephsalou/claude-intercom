---
status: done
---

# PRD — Intercom SaaS V1 (backend hébergé)

## Vision

Transformer l'outil `claude-intercom` (store filesystem local + serveur MCP stdio) en un
service réseau centralisé, déployable en une commande sur un VPS via Docker Compose, pour
que plusieurs agents Claude Code — potentiellement sur des machines différentes —
communiquent via un backend partagé rapide.

## Objectif "aujourd'hui"

Avoir, en fin de journée, un `docker-compose up -d` fonctionnel sur le VPS exposant :
présence, envoi/réception de messages, notification live, protégé par un token. Pas de
dashboard, pas de multi-org avancé, pas de facturation — ça viendra après.

## Portée V1 (dans le scope d'aujourd'hui)

- Backend **Valkey** (Streams + TTL + Pub/Sub) remplaçant le store filesystem (`store.ts`)
- **API HTTP** (Bun) exposant les 6 opérations existantes : `who`, `send`, `reply`, `peek`,
  `ack`, `ack_all`
- Endpoint **SSE** `/events` pour la notification live des nouveaux messages
- **Auth minimale** : un token statique par workspace (variable d'env), vérifié sur chaque
  requête (`Authorization: Bearer <token>`)
- **Docker Compose** (service `valkey` + service `api`), déployable en une commande sur le
  VPS
- Endpoint **`/health`** pour vérifier le déploiement

## Hors scope V1 (reporté explicitement)

- Dashboard web (epic séparé, plus tard)
- Multi-tenant avancé / RBAC / JWT par utilisateur (un token partagé par workspace suffit
  pour démarrer)
- Historique durable Postgres / recherche / audit
- Réécriture du serveur MCP stdio existant (`src/server.ts`) pour appeler l'API distante au
  lieu du store local — livré comme **Epic 5, stretch**, si le temps le permet aujourd'hui,
  sinon demain
- Webhooks, intégrations Slack/Discord
- Rate limiting avancé (aucune limite fine en V1, juste la limite implicite de Valkey)

## Success criteria

- `docker-compose up -d` sur le VPS démarre `valkey` + `api` sans erreur
- Un `curl` avec le bon token peut : s'enregistrer (`register`), envoyer un message
  (`send`), le recevoir en direct via `/events` (SSE), l'acquitter (`ack`)
- Un token invalide ou absent est rejeté avec 401
- Les données de présence expirent automatiquement (TTL Valkey) sans process de nettoyage
  manuel (`isPidAlive` disparaît du chemin réseau)
- Un redémarrage du service `api` ne perd pas les messages non lus (persistés dans Valkey,
  pas en mémoire du process `api`)

## Décisions techniques verrouillées

Issues des recherches et recommandations précédentes dans cette conversation — non
rediscutées ici :

- Transport live : **SSE** (pas Socket.IO — unidirectionnel suffisant, moins de ressources,
  reconnexion native)
- Store : **Valkey** (pas Redis — licence BSD vs AGPLv3, wire-compatible, ~8% plus rapide)
- Modèle de données : présence = clés TTL, inbox = Stream par agent (`XADD`/`XREAD`,
  `MAXLEN` pour trim), notification = Pub/Sub qui déclenche le fan-out SSE
- Runtime : **Bun** (déjà utilisé dans le repo, pas de changement d'écosystème)
- Déploiement V1 : **Docker Compose** sur VPS unique, pas de cluster/K8s à ce stade
