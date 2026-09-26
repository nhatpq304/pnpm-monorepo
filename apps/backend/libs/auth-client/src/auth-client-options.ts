export type AuthClientOptions = {
  readonly issuer: string;
  readonly jwksUri: string;
  readonly audience: string;
};

export const AuthClientOptionsToken = Symbol('AuthClientOptions');

export const AuthClientEnvKeys = {
  issuer: 'AUTH_ISSUER',
  jwksUri: 'AUTH_JWKS_URI',
  audience: 'AUTH_AUDIENCE',
} as const satisfies Record<keyof AuthClientOptions, string>;

export function readAuthClientOptions(env: Readonly<Record<string, string | undefined>>): AuthClientOptions {
  const issuer = env[AuthClientEnvKeys.issuer];
  const jwksUri = env[AuthClientEnvKeys.jwksUri];
  const audience = env[AuthClientEnvKeys.audience];
  if (!issuer || !jwksUri || !audience) {
    const missingKeys = Object.values(AuthClientEnvKeys).filter((key) => !env[key]);
    throw new Error(`auth-client: missing env ${missingKeys.join(', ')}`);
  }

  return { issuer, jwksUri, audience };
}
