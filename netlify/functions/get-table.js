const { requireAuth } = require('./_auth');

const OWNER = 'FABIOR1981';
const REPO  = 'bd';
const PATH  = 'smconsultores';

exports.handler = async (event) => {
  const sesion = requireAuth(event);
  if (!sesion) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  const table = event.queryStringParameters.table;
  if (!table) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta parámetro table' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}/${table}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (res.status === 404) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    if (!res.ok) throw new Error(`GitHub ${res.status}`);

    const file = await res.json();
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: content
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};