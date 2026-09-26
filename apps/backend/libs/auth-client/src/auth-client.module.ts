import { DynamicModule, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthClientOptions, AuthClientOptionsToken, readAuthClientOptions } from './auth-client-options';
import { JwtStrategy } from './jwt.strategy';

@Module({})
export class AuthClientModule {
  public static forRoot(): DynamicModule {
    return {
      module: AuthClientModule,
      imports: [PassportModule],
      providers: [
        { provide: AuthClientOptionsToken, useFactory: (): AuthClientOptions => readAuthClientOptions(process.env) },
        JwtStrategy,
      ],
    };
  }
}
