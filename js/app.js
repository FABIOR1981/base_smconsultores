const API = '/.netlify/functions';

let tablas = { empresa: [], llamado: [], postulante: [], 'llamado-empresa': [], 'llamado-postulante': [] };
let csvData = [], csvHeaders = [], columnMapping = {}, extraFields = [];
let duplicadosLista = [];
let llamadoIdParaPostulantes = null;

// ========== PAGINACIÓN GLOBAL ==========
const paginacion = {
  empresa:    { pag: 1, tam: 25, total: 0 },
  llamado:    { pag: 1, tam: 25, total: 0 },
  postulante: { pag: 1, tam: 25, total: 0 }
};

function paginarArray(arr, tipo) {
  const p = paginacion[tipo];
  p.total = Math.max(1, Math.ceil(arr.length / p.tam));
  if (p.pag > p.total) p.pag = p.total;
  if (p.pag < 1) p.pag = 1;
  const inicio = (p.pag - 1) * p.tam;
  return arr.slice(inicio, inicio + p.tam);
}

function actualizarInfoPag(tipo, mostrados, total) {
  const id = 'infoPag' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const el = document.getElementById(id);
  if (el) el.textContent = `Pág ${paginacion[tipo].pag} de ${paginacion[tipo].total} (${total} total)`;
}

function cambiarPag(tipo, delta) {
  paginacion[tipo].pag += delta;
  if (tipo === 'empresa') renderEmpresas();
  if (tipo === 'llamado') renderLlamados();
  if (tipo === 'postulante') renderPostulantes();
}

function cambiarTamPag(tipo) {
  const selectId = 'tamPag' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const val = document.getElementById(selectId)?.value || 25;
  paginacion[tipo].tam = parseInt(val);
  paginacion[tipo].pag = 1;
  if (tipo === 'empresa') renderEmpresas();
  if (tipo === 'llamado') renderLlamados();
  if (tipo === 'postulante') renderPostulantes();
}

// ========== INICIO ==========
document.addEventListener('DOMContentLoaded', () => {
  cargarTablas();
  document.getElementById('llamFecha').valueAsDate = new Date();
  switchTab('dashboard');
});

// ========== TABS ==========
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  document.getElementById('btn-' + name).classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'empresas') renderEmpresas();
  if (name === 'llamados') renderLlamados();
  if (name === 'postulantes') renderPostulantes();
}

// ========== CARGAR TABLAS ==========
async function cargarTablas() {
  const entries = await Promise.all(
    Object.keys(tablas).map(async (t) => {
      try {
        const res = await fetch(`${API}/get-table?table=${t}`);
        return [t, await res.json()];
      } catch (e) {
        return [t, []];
      }
    })
  );
  tablas = Object.fromEntries(entries);
  llenarSelectsEmpresa();
  llenarSelectLlamados();
}

async function subirTabla(nombre) {
  const res = await fetch(`${API}/update-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: nombre, data: tablas[nombre] })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`${nombre}: ${JSON.stringify(err)}`);
  }
}

async function actualizarStats() {
  try {
    await fetch(`${API}/update-stats`, { method: 'POST' });
  } catch (e) {
    // Silencioso: si falla, el dashboard usa fallback local
  }
}

function generarId(tabla) {
  const arr = tablas[tabla];
  return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

function normalizar(t) { return (t || '').toLowerCase().trim().replace(/\s+/g, ' '); }

// ========== LLENAR SELECTS ==========
function llenarSelectsEmpresa() {
  ['empresaSelect', 'llamEmpresa', 'filtroEmpresaLlam'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    const firstOpt = sel.options[0] ? sel.options[0].outerHTML : '';
    sel.innerHTML = firstOpt;
    tablas.empresa.forEach(e => {
      sel.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
    sel.value = prev;
  });
}

function llenarSelectLlamados() {
  const sel = document.getElementById('postuLlamado');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- Sin llamado --</option>';
  tablas.llamado.forEach(l => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    sel.innerHTML += `<option value="${l.id}">#${l.id} - ${l.nombre_llamado} (${l.cargo})${emp ? ' | ' + emp.nombre : ''}</option>`;
  });
  sel.value = prev;
}

// ============================================================
// EMPRESAS
// ============================================================
function renderEmpresas() {
  let lista = [...tablas.empresa];
  const paginada = paginarArray(lista, 'empresa');
  const tbody = document.getElementById('tablaEmpresas');
  tbody.innerHTML = paginada.map(e => {
    const count = tablas.llamado.filter(l => l.empresa_id === e.id).length;
    return `<tr>
      <td>#${e.id}</td>
      <td><strong>${e.nombre}</strong></td>
      <td>${e.rubro || '-'}</td>
      <td><span class="badge badge-blue">${count}</span></td>
    </tr>`;
  }).join('');
  actualizarInfoPag('empresa', paginada.length, lista.length);
}

async function guardarEmpresa() {
  const nombre = document.getElementById('empNombre').value.trim();
  const rubro = document.getElementById('empRubro').value.trim();
  if (!nombre) return alert('Ingresa el nombre de la empresa.');

  const existe = tablas.empresa.find(e => normalizar(e.nombre) === normalizar(nombre));
  if (existe) {
    document.getElementById('empWarning').classList.remove('hidden');
    document.getElementById('empWarning').textContent = `⚠️ La empresa "${existe.nombre}" ya existe.`;
    return;
  }

  document.getElementById('empWarning').classList.add('hidden');
  document.getElementById('modalCargando').classList.remove('hidden');

  tablas.empresa.push({ id: generarId('empresa'), nombre, rubro });
  await subirTabla('empresa');
  await actualizarStats();

  document.getElementById('empNombre').value = '';
  document.getElementById('empRubro').value = '';
  llenarSelectsEmpresa();
  renderEmpresas();
  document.getElementById('modalCargando').classList.add('hidden');
  alert('Empresa guardada correctamente.');
}

// ============================================================
// LLAMADOS
// ============================================================
function renderLlamados() {
  filtrarLlamados();
}

function filtrarLlamados() {
  const empresaId = document.getElementById('filtroEmpresaLlam').value;
  const busqueda = normalizar(document.getElementById('buscarLlamado').value);

  let lista = tablas.llamado;
  if (empresaId) lista = lista.filter(l => l.empresa_id == empresaId);
  if (busqueda) lista = lista.filter(l =>
    normalizar(l.nombre_llamado).includes(busqueda) ||
    normalizar(l.cargo).includes(busqueda) ||
    normalizar(l.area).includes(busqueda)
  );

  const paginada = paginarArray(lista, 'llamado');
  const tbody = document.getElementById('tablaLlamados');
  tbody.innerHTML = paginada.map(l => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    const count = tablas['llamado-postulante'].filter(r => r.llamado_id === l.id).length;
    return `<tr>
      <td>#${l.id}</td>
      <td>${l.nombre_llamado}</td>
      <td>${l.cargo}</td>
      <td>${l.area}</td>
      <td>${emp ? emp.nombre : '-'}</td>
      <td>${l.fecha}</td>
      <td><span class="badge badge-green">${count}</span></td>
      <td><button class="btn btn-primary btn-sm" onclick="verLlamado(${l.id})">Ver</button></td>
    </tr>`;
  }).join('');
  actualizarInfoPag('llamado', paginada.length, lista.length);
}

async function guardarLlamado() {
  const empresaId = document.getElementById('llamEmpresa').value;
  const nombre = document.getElementById('llamNombre').value.trim();
  const fecha = document.getElementById('llamFecha').value;
  const cargo = document.getElementById('llamCargo').value.trim();
  const area = document.getElementById('llamArea').value.trim();

  if (!empresaId) return alert('Selecciona una empresa.');
  if (!nombre || !fecha || !cargo || !area) return alert('Completa todos los campos.');

  document.getElementById('modalCargando').classList.remove('hidden');

  const id = generarId('llamado');
  tablas.llamado.push({ id, nombre_llamado: nombre, fecha, cargo, area, empresa_id: parseInt(empresaId) });
  tablas['llamado-empresa'].push({ llamado_id: id, empresa_id: parseInt(empresaId) });

  await subirTabla('llamado');
  await subirTabla('llamado-empresa');
  await actualizarStats();

  document.getElementById('llamNombre').value = '';
  document.getElementById('llamCargo').value = '';
  document.getElementById('llamArea').value = '';
  llenarSelectLlamados();
  renderLlamados();
  document.getElementById('modalCargando').classList.add('hidden');
  alert('Llamado guardado correctamente.');
}

function verLlamado(id) {
  const l = tablas.llamado.find(x => x.id === id);
  if (!l) return;
  const emp = tablas.empresa.find(e => e.id === l.empresa_id);
  const rels = tablas['llamado-postulante'].filter(r => r.llamado_id === id);
  const postulantes = rels.map(r => tablas.postulante.find(p => p.id === r.postulante_id)).filter(Boolean);

  document.getElementById('modalLlamadoTitulo').textContent = `Llamado #${l.id}`;
  document.getElementById('modalLlamadoBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><dt>Nombre</dt><dd>${l.nombre_llamado}</dd></div>
      <div class="detail-item"><dt>Cargo</dt><dd>${l.cargo}</dd></div>
      <div class="detail-item"><dt>Área</dt><dd>${l.area}</dd></div>
      <div class="detail-item"><dt>Fecha</dt><dd>${l.fecha}</dd></div>
      <div class="detail-item"><dt>Empresa</dt><dd>${emp ? emp.nombre : '-'}</dd></div>
    </div>
    <h3 style="margin-top:1.5rem;margin-bottom:0.75rem;font-size:1rem;font-weight:700;">Postulantes (${postulantes.length})</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>Email</th><th>Teléfono</th></tr></thead>
        <tbody>${postulantes.map(p => `<tr><td>#${p.id}</td><td>${p.nombre}</td><td>${p.apellido}</td><td>${p.email || '-'}</td><td>${p.telefono || '-'}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  document.getElementById('modalLlamado').classList.remove('hidden');
}

function cerrarModalLlamado() {
  document.getElementById('modalLlamado').classList.add('hidden');
}

// ============================================================
// POSTULANTES
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
  const paginada = paginarArray(lista, 'postulante');
  const tbody = document.getElementById('tablaPostulantes');
  tbody.innerHTML = paginada.map(p => {
    const rels = tablas['llamado-postulante'].filter(r => r.postulante_id === p.id);
    return `<tr>
      <td>#${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.apellido}</td>
      <td>${p.email || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td><span class="badge badge-green">${rels.length}</span></td>
      <td><button class="btn btn-primary btn-sm" onclick="verPostulante(${p.id})">Ver</button></td>
    </tr>`;
  }).join('');
  actualizarInfoPag('postulante', paginada.length, lista.length);
}

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
  document.getElementById('csvTableWrap').classList.remove('hidden');
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
    <div class="field-tag">${f} <button onclick="removeExtraField('${f}')">×</button></div>
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

async function guardarPostulantesCSV() {
  if (csvData.length === 0) return alert('Carga un archivo CSV primero.');

  llamadoIdParaPostulantes = document.getElementById('postuLlamado').value;
  if (llamadoIdParaPostulantes) llamadoIdParaPostulantes = parseInt(llamadoIdParaPostulantes);

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

  noDuplicados.forEach(row => {
    const nuevo = construirPostulanteObj(row, generarId('postulante'));
    tablas.postulante.push(nuevo);
    if (llamadoIdParaPostulantes) {
      tablas['llamado-postulante'].push({ llamado_id: llamadoIdParaPostulantes, postulante_id: nuevo.id });
    }
  });

  if (duplicadosLista.length === 0) {
    await subirPostulantes();
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
          <option value="nuevo">➕ Nuevo</option>
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
  const badges = { ignorar: '<span class="badge badge-yellow">Ignorar</span>', actualizar: '<span class="badge badge-green">Actualizar</span>', nuevo: '<span class="badge badge-blue">Nuevo</span>' };
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
    if (d.accion === 'ignorar') {
      if (llamadoIdParaPostulantes) {
        const tieneRel = tablas['llamado-postulante'].some(
          r => r.llamado_id === llamadoIdParaPostulantes && r.postulante_id === d.existente.id
        );
        if (!tieneRel) {
          tablas['llamado-postulante'].push({ llamado_id: llamadoIdParaPostulantes, postulante_id: d.existente.id });
        }
      }
    } else if (d.accion === 'actualizar') {
      const actualizado = construirPostulanteObj(d.row, d.existente.id);
      const idx = tablas.postulante.findIndex(p => p.id === d.existente.id);
      if (idx !== -1) tablas.postulante[idx] = actualizado;
      if (llamadoIdParaPostulantes) {
        const tieneRel = tablas['llamado-postulante'].some(
          r => r.llamado_id === llamadoIdParaPostulantes && r.postulante_id === d.existente.id
        );
        if (!tieneRel) {
          tablas['llamado-postulante'].push({ llamado_id: llamadoIdParaPostulantes, postulante_id: d.existente.id });
        }
      }
    } else if (d.accion === 'nuevo') {
      const nuevo = construirPostulanteObj(d.row, generarId('postulante'));
      tablas.postulante.push(nuevo);
      if (llamadoIdParaPostulantes) {
        tablas['llamado-postulante'].push({ llamado_id: llamadoIdParaPostulantes, postulante_id: nuevo.id });
      }
    }
  }

  await subirPostulantes();
  document.getElementById('modalCargando').classList.add('hidden');
}

async function subirPostulantes() {
  await subirTabla('postulante');
  if (llamadoIdParaPostulantes) await subirTabla('llamado-postulante');
  await actualizarStats();

  csvData = []; csvHeaders = []; columnMapping = {}; extraFields = [];
  document.getElementById('csvFile').value = '';
  document.getElementById('csvPreviewBox').classList.add('hidden');
  document.getElementById('csvTableWrap').classList.add('hidden');
  document.getElementById('postuLlamado').value = '';
  document.getElementById('postuLlamadoInfo').classList.add('hidden');

  renderPostulantes();
  alert('Postulantes guardados correctamente.');
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

  const extras = Object.keys(p).filter(k => !['id', 'nombre', 'apellido', 'email', 'telefono'].includes(k));

  document.getElementById('modalPostulanteTitulo').textContent = `${p.nombre} ${p.apellido}`;
  document.getElementById('modalPostulanteBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><dt>ID</dt><dd>#${p.id}</dd></div>
      <div class="detail-item"><dt>Email</dt><dd>${p.email || '-'}</dd></div>
      <div class="detail-item"><dt>Teléfono</dt><dd>${p.telefono || '-'}</dd></div>
      ${extras.map(k => `<div class="detail-item"><dt>${k}</dt><dd>${p[k] || '-'}</dd></div>`).join('')}
    </div>
    <h3 style="margin-top:1.5rem;margin-bottom:0.75rem;font-size:1rem;font-weight:700;">Llamados asociados (${llamadosInfo.length})</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Empresa</th><th>Fecha</th></tr></thead>
        <tbody>${llamadosInfo.map(l => `<tr><td>#${l.id}</td><td>${l.nombre_llamado}</td><td>${l.cargo}</td><td>${l.area}</td><td>${l.empresa_nombre}</td><td>${l.fecha}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  document.getElementById('modalPostulante').classList.remove('hidden');
}

function cerrarModalPostulante() {
  document.getElementById('modalPostulante').classList.add('hidden');
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  try {
    const res = await fetch(`${API}/get-table?table=stats`);
    const stats = await res.json();
    if (!stats || typeof stats.empresas !== 'number') throw new Error('No stats');

    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card"><div class="stat-number">${stats.empresas}</div><div class="stat-label">Empresas</div></div>
      <div class="stat-card"><div class="stat-number">${stats.llamados}</div><div class="stat-label">Llamados</div></div>
      <div class="stat-card"><div class="stat-number">${stats.postulantes}</div><div class="stat-label">Postulantes</div></div>
      <div class="stat-card"><div class="stat-number">${stats.postulaciones}</div><div class="stat-label">Postulaciones</div></div>
    `;
  } catch (e) {
    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card"><div class="stat-number">${tablas.empresa.length}</div><div class="stat-label">Empresas</div></div>
      <div class="stat-card"><div class="stat-number">${tablas.llamado.length}</div><div class="stat-label">Llamados</div></div>
      <div class="stat-card"><div class="stat-number">${tablas.postulante.length}</div><div class="stat-label">Postulantes</div></div>
      <div class="stat-card"><div class="stat-number">${tablas['llamado-postulante'].length}</div><div class="stat-label">Postulaciones</div></div>
    `;
  }

  const ultLlam = [...tablas.llamado].reverse().slice(0, 5);
  document.getElementById('dash-ult-llamados').innerHTML = ultLlam.map(l => {
    const emp = tablas.empresa.find(e => e.id === l.empresa_id);
    return `<tr><td>#${l.id}</td><td>${l.nombre_llamado}</td><td>${l.cargo}</td><td>${emp ? emp.nombre : '-'}</td><td>${l.fecha}</td></tr>`;
  }).join('');

  const ultPost = [...tablas.postulante].reverse().slice(0, 5);
  document.getElementById('dash-ult-postulantes').innerHTML = ultPost.map(p =>
    `<tr><td>#${p.id}</td><td>${p.nombre}</td><td>${p.apellido}</td><td>${p.email || '-'}</td></tr>`
  ).join('');
}
