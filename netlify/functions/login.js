const { firmar, hashPassword } = require('./_auth');

const OWNER = 'FABIOR1981';
const REPO  = 'bd';
const PATH  = 'smconsultores';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let usuario, password;
  try {
    ({ usuario, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!usuario || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan usuario o password' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}/usuarios.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    // Mensaje genérico siempre, para no revelar si el usuario existe o no
    const credencialesInvalidas = { statusCode: 401, body: JSON.stringify({ error: 'Usuario o contraseña incorrectos' }) };

    if (!res.ok) return credencialesInvalidas;

    const file = await res.json();
    const usuarios = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));

    const u = usuarios.find(x => x.usuario === usuario);
    if (!u) return credencialesInvalidas;

    const hashCalculado = hashPassword(password, u.salt);
    if (hashCalculado !== u.hash) return credencialesInvalidas;

    const jwt = firmar(usuario);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwt, usuario })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
