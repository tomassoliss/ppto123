// ---------------------------------------------------------------
// CLAVE SIMPLE (no es seguridad real, solo filtra visitas casuales.
// Cualquiera que vea este archivo .js puede leer la clave en texto plano.
// Si algún día esto importa de verdad, hay que moverlo a un backend.)
// ---------------------------------------------------------------
const CLAVE = "Hypnos2026."; // <-- cámbiala aquí

document.getElementById('lock-btn').addEventListener('click', tryUnlock);
document.getElementById('lock-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryUnlock();
});

function tryUnlock(){
  const val = document.getElementById('lock-input').value;
  if (val === CLAVE) {
    document.getElementById('lock').hidden = true;
    document.getElementById('app').hidden = false;
    init();
  } else {
    alert('Clave incorrecta');
  }
}

// ---------------------------------------------------------------
// Formato de plata en pesos chilenos
// ---------------------------------------------------------------
function fmt(n){
  return '$' + Math.round(n).toLocaleString('es-CL');
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mesDeFecha(g){
  const n = Number(g.mes);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? MESES[n - 1] : g.mes;
}

function trimestreDeMes(g){
  const n = Number(g.mes);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return 'Q' + Math.ceil(n / 3);
  return 'Sin trimestre';
}

// ---------------------------------------------------------------
// URL del Web App de Google Apps Script (el que termina en /exec)
// ---------------------------------------------------------------
const SHEET_URL = "https://script.google.com/macros/s/AKfycbzJFLXk7D_EhkZ2PFshOzzNvjT-NbmFyk-IptKK7v71yO_fI9JU1NhaTMDgxIh2RdxZzQ/exec";

// ---------------------------------------------------------------
// Carga de datos y arranque
// ---------------------------------------------------------------
let DATA = null;
let currentView = 'mes';

async function cargarDatos(){
  const content = document.getElementById('content');
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
    document.getElementById('last-update').textContent =
      'Actualizado: ' + new Date(DATA.actualizado).toLocaleString('es-CL');
  } catch (err) {
    content.innerHTML = `<p style="color:var(--over)">No se pudo cargar el Sheet. Revisa que SHEET_URL en app.js esté bien pegada y que el deploy esté activo.<br><small>${err}</small></p>`;
    throw err;
  }
}

async function init(){
  await cargarDatos();
  renderKPIs();
  renderView(currentView);

  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderView(currentView);
    });
  });

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await cargarDatos();
    renderKPIs();
    renderView(currentView);
  });
}

function renderKPIs(){
  const totalGastado = DATA.gastos.reduce((sum, g) => sum + g.monto, 0);
  const presupuestoAnual = DATA.presupuestoMensual * 12;
  const pct = (totalGastado / presupuestoAnual * 100).toFixed(1);
  const over = totalGastado > presupuestoAnual;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="label">Presupuesto anual</div>
      <div class="value">${fmt(presupuestoAnual)}</div>
    </div>
    <div class="kpi">
      <div class="label">Gasto real</div>
      <div class="value ${over ? 'over' : ''}">${fmt(totalGastado)}</div>
    </div>
    <div class="kpi">
      <div class="label">% ejecutado</div>
      <div class="value ${over ? 'over' : ''}">${pct}%</div>
    </div>
  `;
}

// Agrupa un arreglo de gastos según una función de clave (mes, trimestre, categoría)
function agrupar(gastos, keyFn){
  const grupos = {};
  gastos.forEach(g => {
    const k = keyFn(g);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(g);
  });
  return grupos;
}

function renderView(view){
  if (view === 'tipoestado') return renderTipoEstado();
  if (view === 'informes') return renderInformes();
  renderAgrupado(view);
}

function renderAgrupado(view){
  let keyFn;
  if (view === 'mes') keyFn = g => mesDeFecha(g);
  if (view === 'trimestre') keyFn = g => trimestreDeMes(g);
  if (view === 'categoria') keyFn = g => g.categoria;

  const grupos = agrupar(DATA.gastos, keyFn);
  const presupuestoRef = view === 'trimestre' ? DATA.presupuestoMensual * 3 : DATA.presupuestoMensual;

  let html = '';
  Object.entries(grupos).forEach(([nombre, items]) => {
    const total = items.reduce((sum, g) => sum + g.monto, 0);
    const pct = view !== 'categoria' ? (total / presupuestoRef * 100) : null;
    const over = pct !== null && pct > 100;

    html += `<div class="group-title">${nombre} — ${fmt(total)}${pct !== null ? ` (${pct.toFixed(1)}%)` : ''}</div>`;

    if (pct !== null) {
      html += `<div class="bar-track"><div class="bar-fill ${over ? 'over' : ''}" style="width:${Math.min(pct,100)}%"></div></div>`;
    }

    html += `
      <table style="margin-top:0.6rem; margin-bottom:1rem;">
        <thead><tr><th>Mes</th><th>Ítem</th><th>Categoría</th><th>Tipo</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>
          ${items.map(g => `
            <tr>
              <td>${mesDeFecha(g)}</td>
              <td>${g.item}</td>
              <td>${g.categoria}</td>
              <td>${g.tipo}</td>
              <td>${g.detalle || '—'}</td>
              <td>${fmt(g.monto)}</td>
              <td><span class="pill pill-${claseEstado(g.estado)}">${g.estado}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  });

  document.getElementById('content').innerHTML = html;
}

// ---------------------------------------------------------------
// Vista: Tipo y Estado
// ---------------------------------------------------------------
function renderTipoEstado(){
  const total = DATA.gastos.reduce((s, g) => s + g.monto, 0);

  const porTipo = agrupar(DATA.gastos, g => g.tipo);
  const porEstado = agrupar(DATA.gastos, g => g.estado);

  function filaBarra(nombre, items, claseExtra){
    const suma = items.reduce((s, g) => s + g.monto, 0);
    const pct = total > 0 ? (suma / total * 100) : 0;
    return `
      <div class="group-title" style="margin-top:1rem;">${nombre} — ${fmt(suma)} (${pct.toFixed(1)}%)</div>
      <div class="bar-track"><div class="bar-fill ${claseExtra || ''}" style="width:${pct}%"></div></div>
    `;
  }

  let html = `
    <div class="grid-2">
      <div class="card">
        <h3>Por tipo de pago</h3>
        ${Object.entries(porTipo).map(([nombre, items]) => filaBarra(nombre, items)).join('')}
      </div>
      <div class="card">
        <h3>Por estado</h3>
        ${Object.entries(porEstado).map(([nombre, items]) => {
          const claseExtra = nombre === 'Por pagar' ? 'over' : '';
          return filaBarra(nombre, items, claseExtra);
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('content').innerHTML = html;
}

// ---------------------------------------------------------------
// Vista: Informes (por mes, imprimible / exportable a PDF)
// ---------------------------------------------------------------
function renderInformes(){
  const mesesConDatos = [...new Set(DATA.gastos.map(g => Number(g.mes)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 12)
    .sort((a,b) => a - b);

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card no-print" style="margin-bottom:1.2rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
      <label for="informe-mes" style="font-size:0.85rem; color:var(--dim);">Mes del informe:</label>
      <select id="informe-mes" style="padding:0.4rem 0.6rem; border:1px solid var(--border); border-radius:4px;">
        ${mesesConDatos.map(n => `<option value="${n}">${MESES[n-1]}</option>`).join('')}
      </select>
      <button id="print-btn" style="margin-left:auto; border:1px solid var(--border); background:#fff; padding:0.5rem 1rem; border-radius:4px; cursor:pointer;">Imprimir / Guardar como PDF</button>
    </div>
    <div id="informe-content"></div>
  `;

  document.getElementById('informe-mes').addEventListener('change', e => {
    renderInformeMes(Number(e.target.value));
  });
  document.getElementById('print-btn').addEventListener('click', () => window.print());

  if (mesesConDatos.length) renderInformeMes(mesesConDatos[0]);
}

function renderInformeMes(mesNum){
  const items = DATA.gastos.filter(g => Number(g.mes) === mesNum);
  const total = items.reduce((s, g) => s + g.monto, 0);
  const presupuesto = DATA.presupuestoMensual;
  const pct = presupuesto > 0 ? (total / presupuesto * 100) : 0;
  const over = total > presupuesto;

  const porCategoria = agrupar(items, g => g.categoria);

  const html = `
    <div class="card" style="margin-bottom:1.2rem;">
      <h3>Informe de gastos — ${MESES[mesNum-1]}</h3>
      <p style="color:var(--dim); font-size:0.8rem; margin-bottom:1rem;">Generado el ${new Date().toLocaleDateString('es-CL')}</p>
      <div class="grid-4">
        <div class="kpi"><div class="label">Presupuesto</div><div class="value">${fmt(presupuesto)}</div></div>
        <div class="kpi"><div class="label">Gasto real</div><div class="value ${over ? 'over' : ''}">${fmt(total)}</div></div>
        <div class="kpi"><div class="label">% ejecutado</div><div class="value ${over ? 'over' : ''}">${pct.toFixed(1)}%</div></div>
        <div class="kpi"><div class="label">N° de ítems</div><div class="value">${items.length}</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem;">
      <h3>Por categoría</h3>
      ${Object.entries(porCategoria).map(([nombre, grupo]) => {
        const suma = grupo.reduce((s, g) => s + g.monto, 0);
        const pctCat = total > 0 ? (suma / total * 100) : 0;
        return `
          <div class="group-title" style="margin-top:0.8rem;">${nombre} — ${fmt(suma)} (${pctCat.toFixed(1)}%)</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pctCat}%"></div></div>
        `;
      }).join('')}
    </div>

    <div class="card">
      <h3>Detalle completo</h3>
      <table style="margin-top:0.6rem;">
        <thead><tr><th>Ítem</th><th>Categoría</th><th>Tipo</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>
          ${items.map(g => `
            <tr>
              <td>${g.item}</td>
              <td>${g.categoria}</td>
              <td>${g.tipo}</td>
              <td>${g.detalle || '—'}</td>
              <td>${fmt(g.monto)}</td>
              <td><span class="pill pill-${claseEstado(g.estado)}">${g.estado}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('informe-content').innerHTML = html;
}

function claseEstado(estado){
  if (estado === 'Pagado') return 'pagado';
  if (estado === 'Por pagar' || estado === 'Confirmado sin pagar') return 'confirmado';
  return 'presupuestado';
}
