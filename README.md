# base_smconsultores

App de gestión de Empresas, Llamados y Postulantes (SM Consultores), desplegada en Netlify.
Los datos se guardan como archivos JSON en el repo `FABIOR1981/bd` (carpeta `smconsultores`), leídos/escritos
por las funciones serverless a través de la API de contenidos de GitHub.

## Variables de entorno (configurar en Netlify > Site settings > Environment variables)

- `GITHUB_TOKEN` — token con permiso de escritura (`contents:write`) sobre el repo `FABIOR1981/bd`.
- `SESSION_SECRET` — string aleatoria larga (ej: 40+ caracteres), usada para firmar los tokens de sesión del login.
  Generar una con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Login

La app pide usuario y contraseña antes de mostrar cualquier dato. Las credenciales se validan contra
`smconsultores/usuarios.json` dentro del repo `FABIOR1981/bd` (mismo lugar que las demás tablas).

Formato de `usuarios.json`:
```json
[
  { "usuario": "admin", "salt": "....", "hash": "...." }
]
```

La contraseña **nunca se guarda en texto plano**: se guarda `sha256(salt + password)`. El `salt` es aleatorio
por usuario para que dos usuarios con la misma contraseña no tengan el mismo hash, y para dificultar ataques
de tablas precomputadas (rainbow tables).

### Cómo dar de alta un usuario

```bash
node scripts/generar-usuario.js <usuario> <password>
```

Esto imprime un objeto `{ usuario, salt, hash }`. Agregalo al array en `smconsultores/usuarios.json` (en el
repo `bd`) y subilo — a mano, o con la misma API de contenidos de GitHub que usan las funciones.

### Notas de seguridad

- El login devuelve un token firmado (HMAC-SHA256 con `SESSION_SECRET`) válido por 8 horas, que el frontend
  guarda en `sessionStorage` y envía en el header `Authorization: Bearer <token>` en cada request.
- Las funciones `get-table`, `update-table` y `update-stats` rechazan cualquier request sin un token válido.
- `SHA-256 + salt` es aceptable para este caso de uso (pocos usuarios, app interna), pero para un sistema con
  más usuarios o expuesto públicamente conviene usar un algoritmo pensado para contraseñas (bcrypt, scrypt o
  Argon2), que son deliberadamente lentos para dificultar ataques de fuerza bruta — SHA-256 es rápido por
  diseño y no fue pensado para hashear contraseñas.
