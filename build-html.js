// build-html.js
// Arma /index.html juntando html-src/layout.html + los fragmentos que referencia
// con marcadores <!--INCLUDE:archivo.html-->.
//
// Se corre solo (sin dependencias): node build-html.js
// Netlify lo corre automáticamente antes de cada deploy (ver netlify.toml).
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'html-src');
const LAYOUT = path.join(SRC_DIR, 'layout.html');
const SALIDA = path.join(__dirname, 'index.html');

function build() {
  let contenido = fs.readFileSync(LAYOUT, 'utf8');

  contenido = contenido.replace(/<!--INCLUDE:(.+?)-->/g, (match, nombreArchivo) => {
    const rutaFragmento = path.join(SRC_DIR, nombreArchivo.trim());
    if (!fs.existsSync(rutaFragmento)) {
      throw new Error(`build-html.js: no se encontró el fragmento "${nombreArchivo}" (${rutaFragmento})`);
    }
    return fs.readFileSync(rutaFragmento, 'utf8');
  });

  fs.writeFileSync(SALIDA, contenido, 'utf8');
  console.log(`✅ index.html generado a partir de html-src/ (${contenido.length} caracteres)`);
}

build();
