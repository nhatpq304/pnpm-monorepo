# Keycloak backend — implementation plan

Scope: backend only (design sections 1 + 2). Frontend OIDC integration is a later plan.

## Goal

Keycloak (backed by Postgres) is the identity provider. Backend services verify Keycloak access
tokens with `auth-client`, configured entirely from env. The hand-rolled `apps/backend/auth`
service is removed.

## Decisions

- Keycloak `26.7.4`, Postgres `17-alpine`, both pinned.
- Keycloak config lives in `infra/keycloak/` (not a pnpm package): multi-stage Dockerfile + realm file.
- Realm file uses `${ENV}` placeholders; imported only when the realm does not exist yet.
- Postgres has no folder: the official image creates the single `keycloak` DB/user from env.
- Every environment-specific value comes from env. Dev compose has dev-only defaults
  (`${VAR:-default}`); prod compose requires them (`${VAR:?}`).
- `auth-client` reads `AUTH_ISSUER`, `AUTH_JWKS_URI`, `AUTH_AUDIENCE` itself and fails fast.
  Issuer and JWKS URI are separate because tokens carry the public URL while services reach
  Keycloak by its internal hostname.
- Roles come from `realm_access.roles`, unfiltered.

## Steps

### 1. Remove the auth service

- `git rm -r apps/backend/auth`
- Root `package.json`: drop `dev:auth`, `build:auth`, `test:auth`.
- Compose: drop the `auth` services; the frontend loses `depends_on: auth`.
- `apps/frontend/nginx.conf`: drop the `/api/auth/` block (nginx fails to start on an unresolvable upstream).
- `apps/frontend/proxy.conf.mjs`: empty object until the first backend service exists.
- `pnpm install` to update the lockfile.

### 2. `infra/keycloak/Dockerfile`

```dockerfile
FROM quay.io/keycloak/keycloak:26.7.4 AS base
COPY realm-app.json /opt/keycloak/data/import/realm-app.json

FROM base AS dev
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]

FROM base AS build
ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.4 AS runtime
COPY --from=build /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
```

### 3. `infra/keycloak/realm-app.json`

```json
{
  "realm": "app",
  "enabled": true,
  "registrationAllowed": true,
  "registrationEmailAsUsername": true,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": false,
  "revokeRefreshToken": true,
  "refreshTokenMaxReuse": 0,
  "accessTokenLifespan": 300,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 36000,
  "roles": {
    "realm": [
      { "name": "user", "description": "Every registered user" },
      { "name": "admin", "description": "Administrators" },
      {
        "name": "default-roles-app",
        "composite": true,
        "composites": { "realm": ["offline_access", "uma_authorization", "user"] }
      }
    ]
  },
  "defaultRole": { "name": "default-roles-app" },
  "clients": [
    {
      "clientId": "frontend",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "redirectUris": ["${FRONTEND_URL}/*"],
      "webOrigins": ["${FRONTEND_URL}"],
      "attributes": {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris": "${FRONTEND_URL}/*"
      },
      "protocolMappers": [
        {
          "name": "api-audience",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "config": {
            "included.custom.audience": "api",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    }
  ]
}
```

### 4. Compose

Dev (`docker-compose.dev.yaml`): `postgres` (port 5432 published, named volume), `keycloak`
(target `dev`, port 8080, `depends_on: postgres healthy`, health check on management port 9000).
Prod (`docker-compose.yaml`): same services, target `runtime`, no Postgres port, all values required.

Keycloak env: `KC_DB=postgres`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD`,
`KC_BOOTSTRAP_ADMIN_USERNAME`, `KC_BOOTSTRAP_ADMIN_PASSWORD`, `KC_HOSTNAME`, `KC_HEALTH_ENABLED`
(dev), `KC_HTTP_ENABLED` + `KC_PROXY_HEADERS=xforwarded` (prod, TLS ends at the proxy), `FRONTEND_URL`.

### 5. `auth-client` reads env

`auth-client-options.ts`:

```ts
export type AuthClientOptions = {
  readonly issuer: string;
  readonly jwksUri: string;
  readonly audience: string;
};

export const AuthClientOptionsToken = Symbol('AuthClientOptions');

const EnvKeys = {
  issuer: 'AUTH_ISSUER',
  jwksUri: 'AUTH_JWKS_URI',
  audience: 'AUTH_AUDIENCE',
} as const satisfies Record<keyof AuthClientOptions, string>;

export function readAuthClientOptions(env: Readonly<Record<string, string | undefined>>): AuthClientOptions {
  const missingKeys = Object.values(EnvKeys).filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`auth-client: missing env ${missingKeys.join(', ')}`);
  }

  return { issuer: env[EnvKeys.issuer]!, jwksUri: env[EnvKeys.jwksUri]!, audience: env[EnvKeys.audience]! };
}
```

`auth-client.module.ts`: `forRoot()` takes no arguments; provider
`{ provide: AuthClientOptionsToken, useFactory: (): AuthClientOptions => readAuthClientOptions(process.env) }`.

`auth-user.ts`:

```ts
export type AccessTokenClaims = {
  readonly sub: string;
  readonly email?: string;
  readonly realm_access?: { readonly roles: readonly string[] };
};

export type AuthUser = {
  readonly id: string;
  readonly email: string | null;
  readonly roles: readonly string[];
};

export function mapClaimsToAuthUser(claims: AccessTokenClaims): AuthUser {
  return { id: claims.sub, email: claims.email ?? null, roles: claims.realm_access?.roles ?? [] };
}
```

`jwt.strategy.ts`: `issuer: options.issuer` instead of the removed `AuthIssuer` constant.

Tests: guard spec signs Keycloak-shaped tokens with a URL issuer, gets config via `vi.stubEnv`, and
covers the no-`realm_access` case; new `auth-client-options.spec.ts` covers missing env.

### 6. `.env.example`

Remove `JWT_PRIVATE_KEY`; document `POSTGRES_*`, `KC_BOOTSTRAP_ADMIN_*`, `KC_HOSTNAME`,
`FRONTEND_URL`, `AUTH_ISSUER`, `AUTH_JWKS_URI`, `AUTH_AUDIENCE`.

## Verification

1. `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`.
2. `pnpm docker:dev`: Postgres and Keycloak healthy; realm `app` imported with `${FRONTEND_URL}` substituted.
3. Real-token check (throwaway): temporarily enable direct access grants on `frontend`, create a
   test user, get a token by password grant, call a throwaway Nest app using `auth-client`
   (expect 200 with the user; 401 without a token), then revert the client and delete the user.
4. Prod image: `docker build --target runtime infra/keycloak` succeeds.
