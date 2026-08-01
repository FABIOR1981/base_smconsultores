const { requireAuth } = require('./_auth');

const OWNER = 'FABIOR1981';
const REPO  = 'bd';
const PATH  = 'smconsultores';

// Solo se permite escribir estas tablas desde la app (usuarios.json queda fuera de este endpoint)
const TABLAS_PERMITIDAS = ['empresa', 'llamado', 'postulante', 'llamado-empresa', 'llamado-postulante'];
const MAX_REGISTROS = 5000; // límite razonable para evitar payloads gigantes por error o abuso

exports.handler = async (event) => {
  const sesion = requireAuth(event);
  if (!sesion) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let table, data;
  try {
    ({ table, data } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!table || !Array.isArray(data)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan table o data' }) };
  }
  if (!TABLAS_PERMITIDAS.includes(table)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tabla no permitida' }) };
  }
  if (data.length > MAX_REGISTROS) {
    return { statusCode: 400, body: JSON.stringify({ error: `Demasiados registros (máx ${MAX_REGISTROS})` }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const filePath = `${PATH}/${table}.json`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

  try {
    // 1. Obtener SHA si el archivo ya existe
    let sha = null;
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Preparar contenido
    const contentB64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    const body = {
      message: `Actualizar ${table}.json desde app Netlify`,
      content: contentB64,
      ...(sha && { sha })
    };

    // 3. Subir
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return { statusCode: putRes.status, body: JSON.stringify(err) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};