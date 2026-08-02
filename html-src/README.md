# Cómo se arma index.html (a partir de julio 2026)

`index.html` **ya no se edita a mano**. Se genera automáticamente juntando los
fragmentos de `html-src/` con el script `build-html.js`.

## Estructura

```
html-src/
  layout.html       <- esqueleto: <head>, header, tabs, <script>, con marcadores <!--INCLUDE:archivo-->
  login.html        <- pantalla de login
  dashboard.html     <- pestaña Dashboard
  empresas.html      <- pestaña Empresas
  llamados.html      <- pestaña Llamados
  postulantes.html   <- pestaña Postulantes
  modales.html        <- todos los modales (duplicados, cargando, llamado, postulante, resultados)
build-html.js       <- script que junta todo y escribe /index.html
index.html          <- SE GENERA SOLO. No editar directamente, se pisa en cada build.
```

## Cómo editar algo

1. Encontrá el fragmento correspondiente en `html-src/` (ej: para cambiar el formulario
   de Llamados, editás `html-src/llamados.html`).
2. Corré el build para regenerar `index.html` y ver el resultado:
   ```bash
   node build-html.js
   # o, equivalente:
   npm run build
   ```
3. Probá localmente abriendo `index.html` en el navegador (o con un servidor local).

## Cómo agregar una pestaña/sección nueva

1. Creá el archivo nuevo en `html-src/` (ej: `html-src/reportes.html`).
2. Agregá el marcador `<!--INCLUDE:reportes.html-->` en `html-src/layout.html`, en el
   lugar donde tiene que aparecer.
3. Corré `node build-html.js` para confirmar que arma bien.

## Deploy en Netlify

No hace falta correr el build a mano antes de subir a GitHub — **Netlify lo corre
solo**, configurado en `netlify.toml`:

```toml
[build]
  command = "node build-html.js"
```

Cuando hacés push, Netlify: 1) corre `node build-html.js` (regenera `index.html`
fresco a partir de `html-src/`), 2) publica el sitio con ese `index.html` ya armado.
El comportamiento para quien usa la app no cambia en nada — sigue siendo un solo
HTML servido de una sola vez, sin pedidos extra al navegar entre pestañas.

## Por qué se hizo así (y no con fetch() en el navegador)

Se evaluaron 3 caminos:

1. **Multi-página real** (cada sección un `.html` con links): se descartó porque
   perdía el estado de sesión/login y los datos ya cargados en memoria al navegar
   entre páginas.
2. **Fragmentos cargados en vivo con `fetch()`** en el navegador: agregaba una demora
   chica al cambiar de pestaña y complejidad para manejar el estado de carga.
3. **Este enfoque (build-time)**: el split solo existe como código fuente; en
   producción sigue siendo un único HTML, sin cambios de comportamiento ni riesgo
   para el login/sesión ya armados.
