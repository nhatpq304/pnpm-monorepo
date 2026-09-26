import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthClientOptionsToken, type AuthClientOptions } from './auth-client-options';
import { mapClaimsToAuthUser, type AccessTokenClaims, type AuthUser } from './auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  public constructor(@Inject(AuthClientOptionsToken) options: AuthClientOptions) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({ jwksUri: options.jwksUri, cache: true, rateLimit: true }),
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ['RS256'],
    });
  }

  public validate(claims: AccessTokenClaims): AuthUser {
    return mapClaimsToAuthUser(claims);
  }
}
