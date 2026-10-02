import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { pool } from './db.ts';
import { HttpError, type Req } from './http.ts';
import { sign } from './jwt.ts';

/**
 * Подмножество GoTrue (/auth/v1): регистрация с подтверждением кодом из 6 цифр,
 * вход по паролю и по коду, восстановление пароля, refresh, user, logout.
 * «Письма» не отправляются: коды пишутся в консоль и доступны на GET /dev/otp?email=…
 */

interface UserRow {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  raw_user_meta_data: Record<string, unknown>;
  raw_app_meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

const ACCESS_TTL = 3600;

function userJson(u: UserRow) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    phone: '',
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.raw_app_meta_data,
    user_metadata: u.raw_user_meta_data,
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  };
}

async function findUser(email: string): Promise<UserRow | null> {
  const r = await pool.query<UserRow>(`select * from auth.users where lower(email) = lower($1)`, [email]);
  return r.rows[0] ?? null;
}

async function getUser(id: string): Promise<UserRow> {
  const r = await pool.query<UserRow>(`select * from auth.users where id = $1`, [id]);
  if (!r.rows[0]) throw new HttpError(404, { code: 'user_not_found', msg: 'User not found' });
  return r.rows[0];
}

async function issueSession(user: UserRow) {
  await pool.query(`update auth.users set last_sign_in_at = now() where id = $1`, [user.id]);
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomBytes(24).toString('base64url');
  await pool.query(`insert into devstack.refresh_tokens (token, user_id) values ($1, $2)`, [refresh, user.id]);
  const access_token = sign({
    aud: 'authenticated',
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    iat: now,
    exp: now + ACCESS_TTL,
    session_id: randomUUID(),
    app_metadata: user.raw_app_meta_data,
    user_metadata: user.raw_user_meta_data,
    aal: 'aal1',
    is_anonymous: false,
  });
  return {
    access_token,
    token_type: 'bearer',
    expires_in: ACCESS_TTL,
    expires_at: now + ACCESS_TTL,
    refresh_token: refresh,
    user: userJson(await getUser(user.id)),
  };
}

async function issueOtp(email: string, type: string): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query(`insert into devstack.otps (email, type, code) values (lower($1), $2, $3)`, [email, type, code]);
  console.log(`[devstack] код ${type} для ${email}: ${code}`);
}

async function consumeOtp(email: string, types: string[], code: string): Promise<boolean> {
  const r = await pool.query(
    `update devstack.otps set used_at = now()
      where id = (select id from devstack.otps
                   where email = lower($1) and type = any($2) and code = $3 and used_at is null
                     and created_at > now() - interval '1 hour'
                   order by id desc limit 1)
      returning id`,
    [email, types, code],
  );
  return r.rowCount === 1;
}

const badRequest = (code: string, msg: string, status = 400) => new HttpError(status, { code, error_code: code, msg });

export async function handleAuth(req: Req, sub: string): Promise<{ status: number; body?: unknown }> {
  const body = req.method === 'GET' ? {} : req.json<Record<string, any>>();

  switch (`${req.method} ${sub}`) {
    case 'GET /settings':
      return { status: 200, body: { external: { email: true }, disable_signup: false, mailer_autoconfirm: false } };

    case 'POST /signup': {
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('validation_failed', 'Invalid email');
      if (password.length < 8) throw badRequest('weak_password', 'Password should be at least 8 characters', 422);
      const existing = await findUser(email);
      if (existing?.email_confirmed_at) {
        // Как GoTrue: не раскрываем, что email уже занят
        return { status: 200, body: { ...userJson(existing), identities: [] } };
      }
      let user = existing;
      if (!user) {
        const r = await pool.query<UserRow>(
          `insert into auth.users (instance_id, email, encrypted_password, raw_user_meta_data,
             confirmation_token, recovery_token, email_change_token_new, email_change)
           values ('00000000-0000-0000-0000-000000000000', lower($1),
                   extensions.crypt($2, extensions.gen_salt('bf')), $3, '', '', '', '')
           returning *`,
          [email, password, body.data ?? {}],
        );
        user = r.rows[0]!;
      } else {
        await pool.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1`, [user.id, password]);
      }
      await issueOtp(email, 'signup');
      return { status: 200, body: userJson(user) };
    }

    case 'POST /resend': {
      const user = await findUser(String(body.email ?? ''));
      if (user && !user.email_confirmed_at) await issueOtp(user.email, 'signup');
      return { status: 200, body: {} };
    }

    case 'POST /otp': {
      const email = String(body.email ?? '');
      const user = await findUser(email);
      if (!user) {
        if (body.create_user === false) throw badRequest('otp_disabled', 'Signups not allowed for otp', 422);
        throw badRequest('otp_disabled', 'Use signup', 422);
      }
      await issueOtp(user.email, 'email');
      return { status: 200, body: {} };
    }

    case 'POST /recover': {
      const user = await findUser(String(body.email ?? ''));
      if (user) await issueOtp(user.email, 'recovery');
      return { status: 200, body: {} };
    }

    case 'POST /verify': {
      const email = String(body.email ?? '');
      const type = String(body.type ?? '');
      const token = String(body.token ?? '');
      const user = await findUser(email);
      const types = type === 'signup' ? ['signup'] : type === 'recovery' ? ['recovery'] : ['email', 'signup'];
      if (!user || !(await consumeOtp(email, types, token))) {
        throw badRequest('otp_expired', 'Token has expired or is invalid', 403);
      }
      await pool.query(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1`, [user.id]);
      return { status: 200, body: await issueSession(await getUser(user.id)) };
    }

    case 'POST /token': {
      const grant = req.query.get('grant_type');
      if (grant === 'password') {
        const r = await pool.query<UserRow & { ok: boolean }>(
          `select *, encrypted_password = extensions.crypt($2, encrypted_password) as ok
             from auth.users where lower(email) = lower($1)`,
          [String(body.email ?? ''), String(body.password ?? '')],
        );
        const user = r.rows[0];
        if (!user || !user.ok) throw badRequest('invalid_credentials', 'Invalid login credentials');
        if (!user.email_confirmed_at) throw badRequest('email_not_confirmed', 'Email not confirmed');
        return { status: 200, body: await issueSession(user) };
      }
      if (grant === 'refresh_token') {
        const r = await pool.query<{ user_id: string }>(
          `update devstack.refresh_tokens set revoked = true where token = $1 and not revoked returning user_id`,
          [String(body.refresh_token ?? '')],
        );
        if (!r.rows[0]) throw badRequest('refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
        return { status: 200, body: await issueSession(await getUser(r.rows[0].user_id)) };
      }
      throw badRequest('unsupported_grant_type', `Unsupported grant type ${grant}`);
    }

    case 'GET /user': {
      if (req.claims.role !== 'authenticated' || !req.claims.sub) throw badRequest('no_authorization', 'Unauthorized', 401);
      return { status: 200, body: userJson(await getUser(req.claims.sub)) };
    }

    case 'PUT /user': {
      if (req.claims.role !== 'authenticated' || !req.claims.sub) throw badRequest('no_authorization', 'Unauthorized', 401);
      if (body.password !== undefined) {
        if (String(body.password).length < 8) throw badRequest('weak_password', 'Password should be at least 8 characters', 422);
        await pool.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`, [req.claims.sub, String(body.password)]);
      }
      if (body.data) {
        await pool.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() where id = $1`, [req.claims.sub, JSON.stringify(body.data)]);
      }
      return { status: 200, body: userJson(await getUser(req.claims.sub)) };
    }

    case 'POST /logout': {
      if (req.claims.sub) await pool.query(`update devstack.refresh_tokens set revoked = true where user_id = $1`, [req.claims.sub]);
      return { status: 204 };
    }
  }
  throw new HttpError(404, { code: 'not_found', msg: `devstack: ${req.method} /auth/v1${sub} не поддерживается` });
}

/** Последний код для email — для e2e-тестов */
export async function lastOtp(email: string): Promise<string | null> {
  const r = await pool.query<{ code: string }>(
    `select code from devstack.otps where email = lower($1) and used_at is null order by id desc limit 1`,
    [email],
  );
  return r.rows[0]?.code ?? null;
}
