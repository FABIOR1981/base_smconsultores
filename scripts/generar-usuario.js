// Uso: node scripts/generar-usuario.js <usuario> <password>
// Imprime el JSON listo para agregar al array de usuarios.json
const crypto = require('crypto');

const [, , usuario, password] = process.argv;

if (!usuario || !password) {
  console.error('Uso: node scripts/generar-usuario.js <usuario> <password>');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(salt + password).digest('hex');

console.log(JSON.stringify({ usuario, salt, hash }, null, 2));
