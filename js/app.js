// ========== CONFIG ==========
const API = '/.netlify/functions';

// ========== ESTADO GLOBAL ==========
let tablas = {
  empresa: [],
  llamado: [],
  postulante: [],
  'llamado-empresa': [],
  'llamado-postulante': []
};

let csvData = [];
let csvHeaders = [];
let columnMapping = {};
let extraFields = [];
let duplicadosLista = [];
let empresaIdGlobal = null;
let llamadoIdGlobal = null;

// ========== INICIO ==========
document.addEventListener('DOMContentLoaded', () => {
  cargarTablas();
  document.getElementById('llamadoFecha').valueAsDate = new Date();
  switchTab('cargar');
});

// ========== TABS ==========
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.remove('hidden');
  document.getElementById('btn-' + tabName).classList.add('active');

  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'llamados') renderLlamados();
  if (tabName === 'postulantes') renderPostulantes();
}

// ========== LOG ==========
function log(msg) {
  const el = document.getElementById('log');
  el.classList.remove('hidden');
  el.innerHTML += '> ' + msg + '<br>';
  el.scrollTop = el.scrollHeight;
}

// ========== CARGAR TABLAS ==========
async function cargarTablas() {
  log('Cargando tablas desde GitHub...');
  for (const t of Object.keys(tablas)) {
    try {
      const res = await fetch(`${API}/get-table?table=${t}`);
      tablas[t] = await res.json();
    } catch (e) {
      tablas[t] = [];
    }
  }
  renderEmpresas();
  renderLlamadosSelect();
  log(`Listo. Empresas: ${tablas.empresa.length}, Llamados: ${tablas.llamado.length}, Postulantes: ${tablas.postulante.length}`);
}

// ========== EMPRESA ==========
function renderEmpresas() {
  const sel = document.getElementById('empresaSelect');
  sel.innerHTML = '<option value="">-- Crear nueva empresa --</option>';
  tablas.empresa.forEach((e, i) => {
    sel.innerHTML += `<option value="${i}">${e.nombre}${e.rubro ? ' (' + e.rubro + ')' : ''}</option>`;
  });
}

function toggleNuevaEmpresa() {
  const sel = document.getElementById('empresaSelect').value;
  document.getElementById('nuevaEmpresaBox').classList.toggle('hidden', sel !== '');
  document.getElementById('empresaWarning').classList.add('hidden');
}

function checkEmpresaDuplicada() {
  const nombre = normalizar(document.getElementById('empresaNombre').value);
  if (!nombre) return;
  const existe = tablas.empresa.find(e => normalizar(e.nombre) === nombre);
  const warn = document.getElementById('empresaWarning');
  if (existe) {
    warn.classList.remove('hidden');
    warn.textContent = `⚠️ La empresa "${existe.nombre}" ya existe (ID: ${existe.id}). Se usará la existente.`;
  } else {
    warn.classList.add('hidden');
  }
}

// ========== LLAMADO ==========
function renderLlamadosSelect() {
  const sel = document.getElementById('llamadoSelect');
  sel.innerHTML = '<option value="">-- Selecciona un llamado --</option>';
  tablas.llamado.forEach((l, i) => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    sel.innerHTML += `<option value="${i}">#${l.id} - ${l.nombre_llamado} | ${l.cargo} | ${emp ? emp.nombre : 'Sin empresa'}</option>`;
  });
}

function toggleTipoLlamado() {
  const tipo = document.querySelector('input[name="tipoLlamado"]:checked').value;
  document.getElementById('llamadoExistenteBox').classList.toggle('hidden', tipo === 'nuevo');
  document.getElementById('llamadoNuevoBox').classList.toggle('hidden', tipo === 'complementario');
}

function cargarDatosLlamado() {
  const idx = document.getElementById('llamadoSelect').value;
  const info = document.getElementById('llamadoInfo');
  if (idx === '') { info.classList.add('hidden'); return; }
  const l = tablas.llamado[idx];
  const emp = tablas.empresa.find(e => e.id === l.empresa_id);
  info.innerHTML = `
    <strong>Llamado:</strong> ${l.nombre_llamado}<br>
    <strong>Fecha:</strong> ${l.fecha}<br>
    <strong>Cargo:</strong> ${l.cargo}<br>
    <strong>Área:</strong> ${l.area}<br>
    <strong>Empresa:</strong> ${emp ? emp.nombre : 'N/A'}`;
  info.classList.remove('hidden');
}

// ========== CSV ==========
function handleCSV() {
  const file = document.getElementById('csvFile').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => parseCSV(e.target.result);
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return alert('CSV vacío o inválido');
  const sep = lines[0].includes(';') ? ';' : ',';
  csvHeaders = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  csvData = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    csvHeaders.forEach((h, i) => row[h] = vals[i] || '');
    return row;
  });

  columnMapping = {};
  ['nombre', 'apellido', 'email', 'telefono'].forEach(campo => {
    const match = csvHeaders.find(h => h.toLowerCase().includes(campo));
    if (match) columnMapping[campo] = match;
  });

  renderColumnMap();
  renderPreview();
  document.getElementById('csvPreviewBox').classList.remove('hidden');
  log(`CSV cargado: ${csvData.length} postulantes.`);
}

function renderColumnMap() {
  const box = document.getElementById('columnMap');
  const campos = ['nombre', 'apellido', 'email', 'telefono'];
  box.innerHTML = campos.map(campo => `
    <div>
      <label class="label" style="margin-top:0;">${campo.toUpperCase()}</label>
      <select id="map-${campo}" class="input" onchange="columnMapping['${campo}']=this.value; renderPreview()">
        <option value="">-- Ignorar --</option>
        ${csvHeaders.map(h => `<option value="${h}" ${columnMapping[campo] === h ? 'selected' : ''}>${h}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function addExtraField() {
  const name = document.getElementById('newFieldName').value.trim();
  if (!name || extraFields.includes(name)) return;
  extraFields.push(name);
  document.getElementById('newFieldName').value = '';
  renderExtraFields();
}

function renderExtraFields() {
  const box = document.getElementById('extraFields');
  box.innerHTML = extraFields.map(f => `
    <div class="badge badge-blue" style="display:flex; align-items:center; gap:0.5rem;">
      ${f}
      <button onclick="removeExtraField('${f}')" style="background:none; border:none; cursor:pointer; color:#1e40af; font-weight:700;">×</button>
    </div>
  `).join('');
}

function removeExtraField(f) {
  extraFields = extraFields.filter(x => x !== f);
  renderExtraFields();
}

function renderPreview() {
  const thead = document.getElementById('previewHead');
  const tbody = document.getElementById('previewBody');
  const displayCols = ['nombre', 'apellido', 'email', 'telefono', ...extraFields].filter(c => columnMapping[c] || extraFields.includes(c));
  thead.innerHTML = '<tr>' + displayCols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  tbody.innerHTML = csvData.slice(0, 5).map(row => {
    return '<tr>' + displayCols.map(c => {
      const val = columnMapping[c] ? row[columnMapping[c]] : (extraFields.includes(c) ? row[c] || '' : '');
      return `<td>${val}</td>`;
    }).join('') + '</tr>';
  }).join('');
  document.getElementById('previewCount').textContent = `Mostrando 5 de ${csvData.length} registros.`;
}

// ========== UTILIDADES ==========
function normalizar(t) {
  return (t || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function generarId(tabla) {
  const arr = tablas[tabla];
  return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

function construirPostulanteObj(row, id) {
  const obj = {
    id,
    nombre: columnMapping.nombre ? row[columnMapping.nombre] : '',
    apellido: columnMapping.apellido ? row[columnMapping.apellido] : '',
    email: columnMapping.email ? row[columnMapping.email] : '',
    telefono: columnMapping.telefono ? row[columnMapping.telefono] : ''
  };
  extraFields.forEach(f => { if (row[f] !== undefined) obj[f] = row[f]; });
  return obj;
}

function buscarDuplicado(nombre, apellido) {
  return tablas.postulante.find(p => normalizar(p.nombre) === normalizar(nombre) && normalizar(p.apellido) === normalizar(apellido));
}

// ========== GUARDADO PRINCIPAL ==========
async function iniciarGuardado() {
  log('Iniciando validación...');
  const tipo = document.querySelector('input[name="tipoLlamado"]:checked').value;

  if (tipo === 'nuevo') {
    const ln = document.getElementById('llamadoNombre').value.trim();
    const lf = document.getElementById('llamadoFecha').value;
    const lc = document.getElementById('llamadoCargo').value.trim();
    const la = document.getElementById('llamadoArea').value.trim();
    if (!ln || !lf || !lc || !la) return alert('Completa todos los datos del llamado.');

    const selIdx = document.getElementById('empresaSelect').value;
    if (selIdx === '') {
      const nom = document.getElementById('empresaNombre').value.trim();
      if (!nom) return alert('Ingresa el nombre de la empresa.');
      const existe = tablas.empresa.find(e => normalizar(e.nombre) === normalizar(nom));
      if (existe) {
        empresaIdGlobal = existe.id;
        log(`Empresa existente usada: ${existe.nombre}`);
      } else {
        empresaIdGlobal = generarId('empresa');
        tablas.empresa.push({ id: empresaIdGlobal, nombre: nom, rubro: document.getElementById('empresaRubro').value.trim() });
        log(`Nueva empresa ID=${empresaIdGlobal}`);
      }
    } else {
      empresaIdGlobal = tablas.empresa[selIdx].id;
    }

    llamadoIdGlobal = generarId('llamado');
    tablas.llamado.push({
      id: llamadoIdGlobal,
      nombre_llamado: ln,
      fecha: lf,
      cargo: lc,
      area: la,
      empresa_id: empresaIdGlobal
    });
    tablas['llamado-empresa'].push({ llamado_id: llamadoIdGlobal, empresa_id: empresaIdGlobal });
    log(`Nuevo llamado ID=${llamadoIdGlobal}`);

  } else {
    const selLlamado = document.getElementById('llamadoSelect').value;
    if (selLlamado === '') return alert('Selecciona un llamado existente.');
    const l = tablas.llamado[selLlamado];
    llamadoIdGlobal = l.id;
    empresaIdGlobal = l.empresa_id;
    log(`Complementario al llamado ID=${llamadoIdGlobal}`);
  }

  if (csvData.length === 0) return alert('Carga un archivo CSV primero.');

  // Detectar duplicados
  duplicadosLista = [];
  const noDuplicados = [];

  for (const row of csvData) {
    const nom = columnMapping.nombre ? row[columnMapping.nombre] : '';
    const ape = columnMapping.apellido ? row[columnMapping.apellido] : '';
    const existente = buscarDuplicado(nom, ape);
    if (existente) {
      duplicadosLista.push({ row, existente, accion: 'ignorar' });
    } else {
      noDuplicados.push(row);
    }
  }

  // Crear los no duplicados inmediatamente en memoria
  noDuplicados.forEach(row => {
    const nuevo = construirPostulanteObj(row, generarId('postulante'));
    tablas.postulante.push(nuevo);
    tablas['llamado-postulante'].push({ llamado_id: llamadoIdGlobal, postulante_id: nuevo.id });
  });
  if (noDuplicados.length) log(`${noDuplicados.length} postulantes nuevos listos.`);

  if (duplicadosLista.length === 0) {
    log('Sin duplicados. Subiendo a GitHub...');
    await subirTodo();
    return;
  }

  renderModalDuplicados();
  document.getElementById('modalDuplicados').classList.remove('hidden');
}

// ========== MODAL DUPLICADOS ==========
function renderModalDuplicados() {
  document.getElementById('dupCantidad').textContent = duplicadosLista.length;
  const tbody = document.getElementById('dupTablaBody');
  tbody.innerHTML = '';

  duplicadosLista.forEach((d, i) => {
    const nuevoObj = construirPostulanteObj(d.row, d.existente.id);
    const tr = document.createElement('tr');
    tr.id = `dup-row-${i}`;
    tr.className = 'row-ignorar';
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${d.existente.nombre} ${d.existente.apellido}</strong></td>
      <td><div class="compare-cell">${JSON.stringify(d.existente, null, 2)}</div></td>
      <td><div class="compare-cell">${JSON.stringify(nuevoObj, null, 2)}</div></td>
      <td>
        <select class="action-select" onchange="cambiarAccion(${i}, this.value)">
          <option value="ignorar" selected>🚫 Ignorar</option>
          <option value="actualizar">🔄 Actualizar</option>
          <option value="nuevo">➕ Crear nuevo</option>
        </select>
      </td>
      <td id="dup-estado-${i}"><span class="badge badge-yellow">Ignorar</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function cambiarAccion(index, accion) {
  duplicadosLista[index].accion = accion;
  const row = document.getElementById(`dup-row-${index}`);
  const estado = document.getElementById(`dup-estado-${index}`);
  row.className = accion === 'ignorar' ? 'row-ignorar' : accion === 'actualizar' ? 'row-actualizar' : 'row-nuevo';
  const badges = {
    ignorar: '<span class="badge badge-yellow">Ignorar</span>',
    actualizar: '<span class="badge badge-green">Actualizar</span>',
    nuevo: '<span class="badge badge-blue">Nuevo</span>'
  };
  estado.innerHTML = badges[accion];
}

function aplicarATodos(accion) {
  duplicadosLista.forEach((d, i) => {
    const sel = document.querySelector(`#dup-row-${i} select`);
    if (sel) { sel.value = accion; cambiarAccion(i, accion); }
  });
}

function cerrarModalDuplicados() {
  document.getElementById('modalDuplicados').classList.add('hidden');
}

async function confirmarDuplicados() {
  document.getElementById('modalDuplicados').classList.add('hidden');
  document.getElementById('modalCargando').classList.remove('hidden');

  for (const d of duplicadosLista) {
    const nom = d.existente.nombre;
    const ape = d.existente.apellido;

    if (d.accion === 'ignorar') {
      const tieneRel = tablas['llamado-postulante'].some(
        r => r.llamado_id === llamadoIdGlobal && r.postulante_id === d.existente.id
      );
      if (!tieneRel) {
        tablas['llamado-postulante'].push({ llamado_id: llamadoIdGlobal, postulante_id: d.existente.id });
      }
      log(`Ignorado: ${nom} ${ape}`);

    } else if (d.accion === 'actualizar') {
      const actualizado = construirPostulanteObj(d.row, d.existente.id);
      const idx = tablas.postulante.findIndex(p => p.id === d.existente.id);
      if (idx !== -1) tablas.postulante[idx] = actualizado;
      const tieneRel = tablas['llamado-postulante'].some(
        r => r.llamado_id === llamadoIdGlobal && r.postulante_id === d.existente.id
      );
      if (!tieneRel) {
        tablas['llamado-postulante'].push({ llamado_id: llamadoIdGlobal, postulante_id: d.existente.id });
      }
      log(`Actualizado: ${nom} ${ape} (ID: ${d.existente.id})`);

    } else if (d.accion === 'nuevo') {
      const nuevo = construirPostulanteObj(d.row, generarId('postulante'));
      tablas.postulante.push(nuevo);
      tablas['llamado-postulante'].push({ llamado_id: llamadoIdGlobal, postulante_id: nuevo.id });
      log(`Creado nuevo: ${nom} ${ape} (ID: ${nuevo.id})`);
    }
  }

  await subirTodo();
  document.getElementById('modalCargando').classList.add('hidden');
}

async function subirTodo() {
  const tablesToUpload = ['empresa', 'llamado', 'postulante', 'llamado-empresa', 'llamado-postulante'];
  for (const t of tablesToUpload) {
    log(`Subiendo ${t}.json...`);
    const res = await fetch(`${API}/update-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: t, data: tablas[t] })
    });
    if (!res.ok) {
      const err = await res.json();
      log(`ERROR en ${t}: ${JSON.stringify(err)}`);
      alert(`Error guardando ${t}.json`);
      return;
    }
  }

  log('✅ ¡Todo guardado exitosamente en GitHub!');
  alert('Datos guardados correctamente.');
  resetFormulario();
  await cargarTablas();
}

function resetFormulario() {
  csvData = [];
  csvHeaders = [];
  columnMapping = {};
  extraFields = [];
  document.getElementById('csvFile').value = '';
  document.getElementById('csvPreviewBox').classList.add('hidden');
  document.querySelector('input[name="tipoLlamado"][value="nuevo"]').checked = true;
  toggleTipoLlamado();
  document.getElementById('llamadoNombre').value = '';
  document.getElementById('llamadoCargo').value = '';
  document.getElementById('llamadoArea').value = '';
  document.getElementById('empresaNombre').value = '';
  document.getElementById('empresaRubro').value = '';
  document.getElementById('empresaWarning').classList.add('hidden');
  document.getElementById('llamadoInfo').classList.add('hidden');
  document.getElementById('llamadoSelect').value = '';
}

// ============================================================
// PESTAÑA: DASHBOARD
// ============================================================
function renderDashboard() {
  const totalEmpresas = tablas.empresa.length;
  const totalLlamados = tablas.llamado.length;
  const totalPostulantes = tablas.postulante.length;
  const totalRelaciones = tablas['llamado-postulante'].length;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${totalEmpresas}</div>
      <div class="stat-label">Empresas</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${totalLlamados}</div>
      <div class="stat-label">Llamados</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${totalPostulantes}</div>
      <div class="stat-label">Postulantes</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${totalRelaciones}</div>
      <div class="stat-label">Postulaciones</div>
    </div>
  `;

  // Últimos 5 llamados
  const ultimos = [...tablas.llamado].reverse().slice(0, 5);
  const tbody = document.getElementById('dash-ultimos');
  tbody.innerHTML = ultimos.map(l => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    const count = tablas['llamado-postulante'].filter(r => r.llamado_id === l.id).length;
    return `<tr>
      <td>#${l.id}</td>
      <td>${l.nombre_llamado}</td>
      <td>${l.cargo}</td>
      <td>${l.area}</td>
      <td>${emp ? emp.nombre : '-'}</td>
      <td>${l.fecha}</td>
      <td><span class="badge badge-blue">${count} postulantes</span></td>
    </tr>`;
  }).join('');
}

// ============================================================
// PESTAÑA: LLAMADOS
// ============================================================
function renderLlamados() {
  // Llenar filtro de empresas
  const filtro = document.getElementById('filtroEmpresa');
  filtro.innerHTML = '<option value="">Todas las empresas</option>';
  tablas.empresa.forEach(e => {
    filtro.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
  });
  filtrarLlamados();
}

function filtrarLlamados() {
  const empresaId = document.getElementById('filtroEmpresa').value;
  const busqueda = normalizar(document.getElementById('buscarLlamado').value);

  let lista = tablas.llamado;
  if (empresaId) lista = lista.filter(l => l.empresa_id == empresaId);
  if (busqueda) lista = lista.filter(l =>
    normalizar(l.nombre_llamado).includes(busqueda) ||
    normalizar(l.cargo).includes(busqueda) ||
    normalizar(l.area).includes(busqueda)
  );

  const tbody = document.getElementById('tablaLlamados');
  tbody.innerHTML = lista.map(l => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    const count = tablas['llamado-postulante'].filter(r => r.llamado_id === l.id).length;
    return `<tr>
      <td>#${l.id}</td>
      <td>${l.nombre_llamado}</td>
      <td>${l.cargo}</td>
      <td>${l.area}</td>
      <td>${emp ? emp.nombre : '-'}</td>
      <td>${l.fecha}</td>
      <td><span class="badge badge-blue">${count}</span></td>
      <td><button class="btn btn-sm" onclick="verLlamado(${l.id})">Ver</button></td>
    </tr>`;
  }).join('');
}

function verLlamado(id) {
  const l = tablas.llamado.find(x => x.id === id);
  if (!l) return;
  const emp = tablas.empresa.find(e => e.id === l.empresa_id);
  const rels = tablas['llamado-postulante'].filter(r => r.llamado_id === id);
  const postulantes = rels.map(r => tablas.postulante.find(p => p.id === r.postulante_id)).filter(Boolean);

  document.getElementById('modalLlamadoTitulo').textContent = `Llamado #${l.id} - ${l.nombre_llamado}`;
  document.getElementById('modalLlamadoBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><dt>Cargo</dt><dd>${l.cargo}</dd></div>
      <div class="detail-item"><dt>Área</dt><dd>${l.area}</dd></div>
      <div class="detail-item"><dt>Fecha</dt><dd>${l.fecha}</dd></div>
      <div class="detail-item"><dt>Empresa</dt><dd>${emp ? emp.nombre : '-'}</dd></div>
    </div>
    <h3 style="margin-top:1.5rem; margin-bottom:0.75rem; font-size:1rem; font-weight:700;">
      Postulantes (${postulantes.length})
    </h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>Email</th><th>Teléfono</th></tr></thead>
        <tbody>
          ${postulantes.map(p => `<tr>
            <td>#${p.id}</td>
            <td>${p.nombre}</td>
            <td>${p.apellido}</td>
            <td>${p.email || '-'}</td>
            <td>${p.telefono || '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('modalLlamado').classList.remove('hidden');
}

function cerrarModalLlamado() {
  document.getElementById('modalLlamado').classList.add('hidden');
}

// ============================================================
// PESTAÑA: POSTULANTES
// ============================================================
function renderPostulantes() {
  filtrarPostulantes();
}

function filtrarPostulantes() {
  const busqueda = normalizar(document.getElementById('buscarPostulante').value);
  let lista = tablas.postulante;
  if (busqueda) {
    lista = lista.filter(p =>
      normalizar(p.nombre).includes(busqueda) ||
      normalizar(p.apellido).includes(busqueda) ||
      normalizar(p.email).includes(busqueda) ||
      normalizar(p.telefono).includes(busqueda)
    );
  }

  const tbody = document.getElementById('tablaPostulantes');
  tbody.innerHTML = lista.map(p => {
    const rels = tablas['llamado-postulante'].filter(r => r.postulante_id === p.id);
    return `<tr>
      <td>#${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.apellido}</td>
      <td>${p.email || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td><span class="badge badge-green">${rels.length} llamado${rels.length !== 1 ? 's' : ''}</span></td>
      <td><button class="btn btn-sm" onclick="verPostulante(${p.id})">Ver detalle</button></td>
    </tr>`;
  }).join('');
}

function verPostulante(id) {
  const p = tablas.postulante.find(x => x.id === id);
  if (!p) return;

  const rels = tablas['llamado-postulante'].filter(r => r.postulante_id === id);
  const llamadosInfo = rels.map(r => {
    const l = tablas.llamado.find(ll => ll.id === r.llamado_id);
    if (!l) return null;
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    return { ...l, empresa_nombre: emp ? emp.nombre : '-' };
  }).filter(Boolean);

  // Extra fields dinámicos
  const extras = Object.keys(p).filter(k => !['id','nombre','apellido','email','telefono'].includes(k));

  document.getElementById('modalPostulanteTitulo').textContent = `${p.nombre} ${p.apellido}`;
  document.getElementById('modalPostulanteBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><dt>ID</dt><dd>#${p.id}</dd></div>
      <div class="detail-item"><dt>Email</dt><dd>${p.email || '-'}</dd></div>
      <div class="detail-item"><dt>Teléfono</dt><dd>${p.telefono || '-'}</dd></div>
      ${extras.map(k => `<div class="detail-item"><dt>${k}</dt><dd>${p[k] || '-'}</dd></div>`).join('')}
    </div>

    <h3 style="margin-top:1.5rem; margin-bottom:0.75rem; font-size:1rem; font-weight:700;">
      Llamados a los que se postuló (${llamadosInfo.length})
    </h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>ID Llamado</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Empresa</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          ${llamadosInfo.map(l => `<tr>
            <td>#${l.id}</td>
            <td>${l.nombre_llamado}</td>
            <td>${l.cargo}</td>
            <td>${l.area}</td>
            <td>${l.empresa_nombre}</td>
            <td>${l.fecha}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('modalPostulante').classList.remove('hidden');
}

function cerrarModalPostulante() {
  document.getElementById('modalPostulante').classList.add('hidden');
}
