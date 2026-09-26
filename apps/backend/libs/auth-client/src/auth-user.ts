export type AccessTokenClaims = {
  readonly sub: string;
  readonly email?: string;
  readonly realm_access?: {
    readonly roles: readonly string[];
  };
};

export type AuthUser = {
  readonly id: string;
  readonly email: string | null;
  readonly roles: readonly string[];
};

export function mapClaimsToAuthUser(claims: AccessTokenClaims): AuthUser {
  return { id: claims.sub, email: claims.email ?? null, roles: claims.realm_access?.roles ?? [] };
}
