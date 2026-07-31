const OWNER = 'FABIOR1981';
const REPO  = 'bd';
const PATH  = 'smconsultores';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.GITHUB_TOKEN;
  const filePath = `${PATH}/stats.json`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

  try {
    // 1. Leer tablas para calcular totales
    const tablas = ['empresa', 'llamado', 'postulante', 'llamado-postulante'];
    const counts = {};

    for (const t of tablas) {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}/${t}.json`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      if (res.status === 200) {
        const file = await res.json();
        const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
        counts[t] = Array.isArray(data) ? data.length : 0;
      } else {
        counts[t] = 0;
      }
    }

    const stats = {
      empresas: counts.empresa,
      llamados: counts.llamado,
      postulantes: counts.postulante,
      postulaciones: counts['llamado-postulante'],
      actualizado: new Date().toISOString()
    };

    // 2. Obtener SHA de stats.json si existe
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

    // 3. Guardar stats.json
    const contentB64 = Buffer.from(JSON.stringify(stats, null, 2)).toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Actualizar stats.json',
        content: contentB64,
        ...(sha && { sha })
      })
    });

    if (!putRes.ok) throw new Error('Error guardando stats');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
