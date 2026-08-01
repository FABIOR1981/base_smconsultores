// Helper de autenticación compartido por las funciones.
// Genera y valida un token firmado (HMAC-SHA256) sin necesidad de guardar sesiones en ningún lado.
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET; // OBLIGATORIO: configurar en Netlify (Site settings > Environment variables)
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function firmar(usuario) {
  if (!SECRET) throw new Error('Falta configurar SESSION_SECRET en las variables de entorno de Netlify');
  const payload = { usuario, exp: Date.now() + DURACION_MS };
  const data = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function verificar(token) {
  if (!SECRET || !token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  const sigEsperada = base64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(sigEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload; // { usuario, exp }
  } catch {
    return null;
  }
}

// Extrae y valida el token del header Authorization: Bearer <token>
function requireAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verificar(token);
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function generarSalt() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { firmar, verificar, requireAuth, hashPassword, generarSalt };
