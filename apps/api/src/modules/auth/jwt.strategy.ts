/**
 * JWT strategy for Passport with JWKS support
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';

const issuer = process.env.AUTH_JWT_ISSUER!;
const audience = process.env.AUTH_JWT_AUDIENCE!;
const jwksUri = process.env.AUTH_JWT_JWKS_URL!;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
        jwksUri,
      }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    // map claims to user object
    return { 
      sub: payload.sub, 
      email: payload.email, 
      workspaceId: payload['workspaceId'] ?? 'debug-ws' 
    };
  }
}
