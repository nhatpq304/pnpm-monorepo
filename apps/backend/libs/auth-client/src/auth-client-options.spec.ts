import { readAuthClientOptions } from './auth-client-options';

describe('readAuthClientOptions', () => {
  it('reads every option from env', () => {
    const options = readAuthClientOptions({
      AUTH_ISSUER: 'http://localhost:8080/realms/app',
      AUTH_JWKS_URI: 'http://keycloak:8080/realms/app/protocol/openid-connect/certs',
      AUTH_AUDIENCE: 'api',
    });

    expect(options).toEqual({
      issuer: 'http://localhost:8080/realms/app',
      jwksUri: 'http://keycloak:8080/realms/app/protocol/openid-connect/certs',
      audience: 'api',
    });
  });

  it('names every missing env var', () => {
    expect(() => readAuthClientOptions({ AUTH_ISSUER: 'http://localhost:8080/realms/app', AUTH_AUDIENCE: '' })).toThrow(
      'auth-client: missing env AUTH_JWKS_URI, AUTH_AUDIENCE',
    );
  });
});
