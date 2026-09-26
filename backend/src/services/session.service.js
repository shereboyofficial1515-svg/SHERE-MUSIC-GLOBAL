import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: '/',
  };
}

/** Sign a JWT for the user and store it in an HTTP-only cookie. */
export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, env.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: env.jwt.expiresIn,
  });
  res.cookie(env.cookie.name, token, { ...cookieOptions(), maxAge: env.cookie.maxAgeMs });
}

export function clearSession(res) {
  res.clearCookie(env.cookie.name, cookieOptions());
}
