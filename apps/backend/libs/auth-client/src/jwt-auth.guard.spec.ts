import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync, KeyObject } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { AuthClientModule } from './auth-client.module';
import { type AccessTokenClaims, type AuthUser } from './auth-user';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const Issuer = 'http://localhost:8080/realms/app';
const Audience = 'api';
const KeyId = 'test-key';
const KeycloakClaims = {
  sub: 'user-1',
  email: 'user@example.com',
  realm_access: { roles: ['user', 'admin'] },
} as const satisfies AccessTokenClaims;

type TokenOverrides = {
  readonly claims?: AccessTokenClaims;
  readonly issuer?: string;
  readonly audience?: string;
};

@Controller('me')
class MeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  public getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}

function generateRsaKeyPair(): { readonly privateKey: KeyObject; readonly publicKey: KeyObject } {
  return generateKeyPairSync('rsa', { modulusLength: 2048 });
}

function signToken(privateKey: KeyObject, overrides: TokenOverrides = {}): string {
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  return new JwtService().sign(
    { ...(overrides.claims ?? KeycloakClaims) },
    {
      privateKey: privateKeyPem,
      algorithm: 'RS256',
      keyid: KeyId,
      issuer: overrides.issuer ?? Issuer,
      audience: overrides.audience ?? Audience,
      expiresIn: '5m',
    },
  );
}

describe('JwtAuthGuard', () => {
  const trustedKeys = generateRsaKeyPair();
  let jwksServer: Server;
  let app: INestApplication;
  let baseUrl: string;

  const requestingMeFunc = (token?: string): Promise<Response> =>
    fetch(`${baseUrl}/me`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  beforeAll(async () => {
    const publicJwk = { ...trustedKeys.publicKey.export({ format: 'jwk' }), kid: KeyId, alg: 'RS256', use: 'sig' };
    jwksServer = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, resolve));
    const jwksPort = (jwksServer.address() as AddressInfo).port;

    vi.stubEnv('AUTH_ISSUER', Issuer);
    vi.stubEnv('AUTH_JWKS_URI', `http://localhost:${jwksPort}/certs`);
    vi.stubEnv('AUTH_AUDIENCE', Audience);
    const moduleRef = await Test.createTestingModule({
      imports: [AuthClientModule.forRoot()],
      controllers: [MeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app.close();
    jwksServer.close();
  });

  it('exposes the user for a valid token', async () => {
    const response = await requestingMeFunc(signToken(trustedKeys.privateKey));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'user-1', email: 'user@example.com', roles: ['user', 'admin'] });
  });

  it('treats a token without realm roles as having none', async () => {
    const response = await requestingMeFunc(signToken(trustedKeys.privateKey, { claims: { sub: 'user-2' } }));

    expect(await response.json()).toEqual({ id: 'user-2', email: null, roles: [] });
  });

  it('rejects a request without a token', async () => {
    expect((await requestingMeFunc()).status).toBe(401);
  });

  it('rejects a token from another issuer', async () => {
    const token = signToken(trustedKeys.privateKey, { issuer: 'http://localhost:8080/realms/other' });

    expect((await requestingMeFunc(token)).status).toBe(401);
  });

  it('rejects a token issued for another audience', async () => {
    expect((await requestingMeFunc(signToken(trustedKeys.privateKey, { audience: 'billing' }))).status).toBe(401);
  });

  it('rejects a token signed by an untrusted key', async () => {
    expect((await requestingMeFunc(signToken(generateRsaKeyPair().privateKey))).status).toBe(401);
  });
});
