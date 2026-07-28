// ---------------------------------------------------------------
// CLAVE SIMPLE (no es seguridad real, solo filtra visitas casuales.
// Cualquiera que vea este archivo .js puede leer la clave en texto plano.
// Si algún día esto importa de verdad, hay que moverlo a un backend.)
// ---------------------------------------------------------------
const CLAVE = "hypnos2026"; // <-- cámbiala aquí

document.getElementById('lock-btn').addEventListener('click', tryUnlock);
document.getElementById('lock-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryUnlock();
});

function tryUnlock(){
  const val = document.getElementById('lock-input').value;
  if (val === CLAVE) {
    document.getElementById('lock').hidden = true;
    document.getElementById('app').hidden = false;
    // Fix: si el teclado del celular había scrolleado la página, esto
    // asegura que el dashboard aparezca arriba del todo, no a medio scroll.
    window.scrollTo(0, 0);
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
const COLORES = ['#3a6b5c','#b5482f','#7a8fa3','#c9a24b','#8a6d9e','#5f9ea0','#a35f5f','#767676','#4b7a8f','#9e7a3a'];

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
let currentView = 'resumen';

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
  // Los listeners de navegación se activan PRIMERO, pase lo que pase después.
  // Así, si algo falla al dibujar una vista (ej. Chart.js no cargó), las
  // pestañas siguen funcionando igual.
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      safeRenderView(currentView);
    });
  });

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await cargarDatos();
    renderKPIs();
    safeRenderView(currentView);
  });

  await cargarDatos();
  renderKPIs();
  safeRenderView(currentView);

  // Asegura que quede arriba del todo una vez que ya cargó el contenido real.
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

// Envuelve renderView en try/catch: si una vista específica falla, muestra
// el error en pantalla en vez de dejar la página muda sin explicación.
function safeRenderView(view){
  try {
    renderView(view);
  } catch (err) {
    console.error('Error al dibujar la vista', view, err);
    document.getElementById('content').innerHTML = `
      <div class="card">
        <p style="color:var(--over);">Ocurrió un error mostrando esta vista.</p>
        <p style="color:var(--dim); font-size:0.82rem; margin-top:0.5rem;">Detalle técnico: <code>${err.message || err}</code></p>
        <p style="color:var(--dim); font-size:0.82rem; margin-top:0.5rem;">Si el error menciona "Chart", probablemente Chart.js no cargó (revisa si tienes un bloqueador de anuncios activo en este sitio).</p>
      </div>
    `;
  }
}

function chartDisponible(){
  return typeof Chart !== 'undefined';
}

function renderKPIs(){
  const totalGastado = DATA.gastos.reduce((sum, g) => sum + g.monto, 0);
  const presupuestoAnual = DATA.presupuestoMensual * 12;
  const pct = presupuestoAnual > 0 ? (totalGastado / presupuestoAnual * 100).toFixed(1) : null;
  const over = presupuestoAnual > 0 && totalGastado > presupuestoAnual;

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
      <div class="value ${over ? 'over' : ''}">${pct !== null ? pct + '%' : '—'}</div>
    </div>
  `;
  if (presupuestoAnual === 0) {
    document.getElementById('kpis').insertAdjacentHTML('beforeend',
      `<p class="no-print" style="width:100%; color:var(--over); font-size:0.8rem; margin-top:0.4rem;">
        ⚠ El presupuesto está en $0 — probablemente falta re-desplegar Code.gs como nueva versión en Apps Script (Deploy → Manage deployments → editar → New version).
      </p>`);
  }
}

// Agrupa un arreglo de gastos según una función de clave
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
  if (view === 'resumen') return renderResumen();
  if (view === 'tipoestado') return renderTipoEstado();
  if (view === 'informes') return renderInformes();
  if (view === 'categoria') return renderCategoria();
  renderAgrupado(view);
}

// ---------------------------------------------------------------
// Vista: Resumen (landing, todo en gráficos)
// ---------------------------------------------------------------
let chartResumenMensual = null;
let chartResumenCategoria = null;
let chartResumenTipo = null;
let chartResumenEstado = null;

function renderResumen(){
  const content = document.getElementById('content');

  if (!chartDisponible()) {
    content.innerHTML = `<div class="card"><p style="color:var(--over);">No se pudo cargar la librería de gráficos (Chart.js). Revisa tu conexión a internet o si un bloqueador de anuncios está bloqueando cdnjs.cloudflare.com en este sitio.</p></div>`;
    return;
  }

  content.innerHTML = `
    <div class="card" style="margin-bottom:1.2rem;">
      <h3>Gasto real por mes</h3>
      <div style="position:relative; height:260px;"><canvas id="chart-resumen-mensual"></canvas></div>
    </div>
    <div class="grid-2" style="margin-bottom:1.2rem;">
      <div class="card">
        <h3>Por categoría (año completo)</h3>
        <div style="position:relative; height:260px;"><canvas id="chart-resumen-categoria"></canvas></div>
      </div>
      <div class="card">
        <div class="grid-2" style="gap:0.5rem;">
          <div>
            <h3>Tipo de pago</h3>
            <div style="position:relative; height:220px;"><canvas id="chart-resumen-tipo"></canvas></div>
          </div>
          <div>
            <h3>Estado</h3>
            <div style="position:relative; height:220px;"><canvas id="chart-resumen-estado"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Gasto real por mes (barras) + línea de presupuesto de referencia
  const porMesTodos = {};
  for (let n = 1; n <= 12; n++) porMesTodos[n] = 0;
  DATA.gastos.forEach(g => {
    const n = Number(g.mes);
    if (n >= 1 && n <= 12) porMesTodos[n] += g.monto;
  });
  const dataMensual = Object.values(porMesTodos);

  if (chartResumenMensual) chartResumenMensual.destroy();
  chartResumenMensual = new Chart(document.getElementById('chart-resumen-mensual'), {
    type: 'bar',
    data: {
      labels: MESES.map(m => m.slice(0,3)),
      datasets: [
        {
          label: 'Gasto real',
          data: dataMensual,
          backgroundColor: dataMensual.map(v => (DATA.presupuestoMensual > 0 && v > DATA.presupuestoMensual) ? '#b5482f' : '#3a6b5c'),
          borderRadius: 3
        },
        {
          label: 'Presupuesto de referencia',
          data: MESES.map(() => DATA.presupuestoMensual),
          type: 'line',
          borderColor: '#999',
          borderDash: [4,4],
          pointRadius: 0,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)}` } }
      },
      scales: { y: { ticks: { callback: v => fmt(v) } } }
    }
  });

  // Por categoría (donut, año completo)
  const porCat = agrupar(DATA.gastos, g => g.categoria);
  const catEntradas = Object.entries(porCat)
    .map(([n, its]) => [n, its.reduce((s,g) => s + g.monto, 0)])
    .filter(([,t]) => t > 0)
    .sort((a,b) => b[1] - a[1]);
  const totalCat = catEntradas.reduce((s,[,t]) => s + t, 0);

  if (chartResumenCategoria) chartResumenCategoria.destroy();
  chartResumenCategoria = new Chart(document.getElementById('chart-resumen-categoria'), {
    type: 'doughnut',
    data: { labels: catEntradas.map(([n]) => n), datasets: [{ data: catEntradas.map(([,t]) => t), backgroundColor: COLORES, borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } },
      tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw/totalCat*100).toFixed(1)}%)` } } } }
  });

  // Tipo
  const porTipo = agrupar(DATA.gastos, g => g.tipo);
  const tipoEntradas = Object.entries(porTipo).map(([n, its]) => [n, its.reduce((s,g) => s + g.monto, 0)]);
  const totalTipo = tipoEntradas.reduce((s,[,t]) => s + t, 0);
  if (chartResumenTipo) chartResumenTipo.destroy();
  chartResumenTipo = new Chart(document.getElementById('chart-resumen-tipo'), {
    type: 'doughnut',
    data: { labels: tipoEntradas.map(([n]) => n), datasets: [{ data: tipoEntradas.map(([,t]) => t), backgroundColor: ['#3a6b5c','#b5482f'], borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } },
      tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw/totalTipo*100).toFixed(1)}%)` } } } }
  });

  // Estado
  const porEstado = agrupar(DATA.gastos, g => g.estado);
  const estadoEntradas = Object.entries(porEstado).map(([n, its]) => [n, its.reduce((s,g) => s + g.monto, 0)]);
  const totalEstado = estadoEntradas.reduce((s,[,t]) => s + t, 0);
  const coloresEstado = { 'Pagado': '#3a6b5c', 'Presupuestado': '#7a8fa3', 'Por pagar': '#b5482f' };
  if (chartResumenEstado) chartResumenEstado.destroy();
  chartResumenEstado = new Chart(document.getElementById('chart-resumen-estado'), {
    type: 'doughnut',
    data: { labels: estadoEntradas.map(([n]) => n), datasets: [{ data: estadoEntradas.map(([,t]) => t), backgroundColor: estadoEntradas.map(([n]) => coloresEstado[n] || '#999'), borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } },
      tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw/totalEstado*100).toFixed(1)}%)` } } } }
  });
}

// ---------------------------------------------------------------
// Acordeón genérico usado por "Por mes" y "Por trimestre"
// ---------------------------------------------------------------
let accCounter = 0;
const groupItemsRegistry = {};

function renderAgrupado(view){
  let keyFn;
  if (view === 'mes') keyFn = g => mesDeFecha(g);
  if (view === 'trimestre') keyFn = g => trimestreDeMes(g);

  const grupos = agrupar(DATA.gastos, keyFn);
  const presupuestoRef = view === 'trimestre' ? DATA.presupuestoMensual * 3 : DATA.presupuestoMensual;

  document.getElementById('content').innerHTML = Object.entries(grupos)
    .map(([nombre, items]) => {
      let subgrupos = null;
      if (view === 'trimestre') {
        subgrupos = Object.entries(agrupar(items, g => mesDeFecha(g)));
      }
      return acordeonGrupo(nombre, items, presupuestoRef, { subgrupos, miniCharts: true });
    })
    .join('');

  activarAcordeones();
}

// nombre, items, presupuestoRef (o null), opts: { subgrupos, miniCharts, pctShare }
function acordeonGrupo(nombre, items, presupuestoRef, opts = {}){
  const total = items.reduce((sum, g) => sum + g.monto, 0);
  let pct = null, over = false;

  if (opts.pctShare !== undefined) {
    pct = opts.pctShare;
  } else if (presupuestoRef > 0) {
    pct = total / presupuestoRef * 100;
    over = pct > 100;
  }

  const id = 'acc' + (accCounter++);
  groupItemsRegistry[id] = items;

  return `
    <div class="acc" data-id="${id}">
      <div class="acc-head">
        <span class="acc-chevron">▸</span>
        <span class="acc-title">${nombre}</span>
        <span class="acc-total ${over ? 'over' : ''}">${fmt(total)}${pct !== null ? ` (${pct.toFixed(1)}%)` : ''}</span>
      </div>
      <div class="acc-body">
        ${pct !== null ? `<div class="bar-track"><div class="bar-fill ${over ? 'over' : ''}" style="width:${Math.min(pct,100)}%"></div></div>` : ''}
        ${opts.miniCharts ? `
          <div class="mini-charts">
            <div class="mini-chart-box"><p class="mini-chart-label">Por categoría</p><canvas id="${id}-cat"></canvas></div>
            <div class="mini-chart-box"><p class="mini-chart-label">Por tipo</p><canvas id="${id}-tipo"></canvas></div>
          </div>
        ` : ''}
        ${opts.subgrupos ? `<p class="group-title" style="margin-top:1rem;">Meses en este trimestre</p>${
          opts.subgrupos.map(([subNombre, subItems]) => acordeonGrupo(subNombre, subItems, null, {})).join('')
        }` : ''}
        ${tablaItems(items)}
      </div>
    </div>
  `;
}

function tablaItems(items){
  return `
    <table style="margin-top:0.6rem;">
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
}

function activarAcordeones(){
  document.querySelectorAll('.acc-head').forEach(head => {
    head.addEventListener('click', () => {
      const acc = head.closest('.acc');
      acc.classList.toggle('open');
      if (acc.classList.contains('open') && !acc.dataset.rendered) {
        acc.dataset.rendered = '1';
        renderMiniCharts(acc.dataset.id);
      }
    });
  });
}

// Gráficos chicos (categoría + tipo) que se crean recién al abrir el acordeón
function renderMiniCharts(id){
  const items = groupItemsRegistry[id];
  const catCanvas = document.getElementById(id + '-cat');
  const tipoCanvas = document.getElementById(id + '-tipo');
  if (!items || !catCanvas || !tipoCanvas) return;

  if (!chartDisponible()) {
    catCanvas.parentElement.innerHTML = '<p style="color:var(--dim); font-size:0.78rem;">Gráfico no disponible.</p>';
    tipoCanvas.parentElement.innerHTML = '<p style="color:var(--dim); font-size:0.78rem;">Gráfico no disponible.</p>';
    return;
  }

  const porCat = agrupar(items, g => g.categoria);
  const catEntradas = Object.entries(porCat).map(([n, its]) => [n, its.reduce((s,g) => s + g.monto, 0)]).filter(([,t]) => t > 0).sort((a,b) => b[1]-a[1]);
  const totalCat = catEntradas.reduce((s,[,t]) => s + t, 0);

  new Chart(catCanvas, {
    type: 'doughnut',
    data: { labels: catEntradas.map(([n]) => n), datasets: [{ data: catEntradas.map(([,t]) => t), backgroundColor: COLORES, borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw/totalCat*100).toFixed(1)}%)` } } } }
  });

  const porTipo = agrupar(items, g => g.tipo);
  const tipoEntradas = Object.entries(porTipo).map(([n, its]) => [n, its.reduce((s,g) => s + g.monto, 0)]);
  const totalTipo = tipoEntradas.reduce((s,[,t]) => s + t, 0);

  new Chart(tipoCanvas, {
    type: 'doughnut',
    data: { labels: tipoEntradas.map(([n]) => n), datasets: [{ data: tipoEntradas.map(([,t]) => t), backgroundColor: ['#3a6b5c','#b5482f'], borderColor: '#fff', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw/totalTipo*100).toFixed(1)}%)` } } } }
  });
}

// ---------------------------------------------------------------
// Vista: Por categoría — selector Total/Q1-Q4 + gráfico de torta + % explícito
// ---------------------------------------------------------------
let categoriaScope = 'total';
let chartCategoria = null;

function renderCategoria(){
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card no-print" style="margin-bottom:1.2rem;">
      <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        ${['total','Q1','Q2','Q3','Q4'].map(s => `
          <button class="scope-btn ${s === categoriaScope ? 'active' : ''}" data-scope="${s}">
            ${s === 'total' ? 'Total anual' : s}
          </button>`).join('')}
      </div>
    </div>
    <div class="grid-2" style="align-items:start;">
      <div class="card">
        <h3>Distribución</h3>
        <div style="position:relative; height:300px;"><canvas id="chart-categoria"></canvas></div>
      </div>
      <div class="card">
        <h3>Detalle por categoría</h3>
        <div id="categoria-lista"></div>
      </div>
    </div>
  `;

  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      categoriaScope = btn.dataset.scope;
      renderCategoria();
    });
  });

  const gastosFiltrados = categoriaScope === 'total'
    ? DATA.gastos
    : DATA.gastos.filter(g => trimestreDeMes(g) === categoriaScope);

  const grupos = agrupar(gastosFiltrados, g => g.categoria);
  const entradas = Object.entries(grupos)
    .map(([nombre, items]) => [nombre, items, items.reduce((s, g) => s + g.monto, 0)])
    .filter(([, , total]) => total > 0)
    .sort((a, b) => b[2] - a[2]);

  const totalGeneral = entradas.reduce((s, [, , t]) => s + t, 0);

  document.getElementById('categoria-lista').innerHTML = entradas
    .map(([nombre, items, total]) => acordeonGrupo(nombre, items, null, {
      pctShare: totalGeneral > 0 ? (total / totalGeneral * 100) : 0
    }))
    .join('') || '<p style="color:var(--dim); font-size:0.85rem;">Sin gastos en este período.</p>';
  activarAcordeones();

  const ctx = document.getElementById('chart-categoria');
  if (chartDisponible()) {
    if (chartCategoria) chartCategoria.destroy();
    chartCategoria = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entradas.map(([n]) => n),
        datasets: [{ data: entradas.map(([, , t]) => t), backgroundColor: COLORES, borderColor: '#fff', borderWidth: 2 }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.raw)} (${(c.raw / totalGeneral * 100).toFixed(1)}%)` } }
        }
      }
    });
  } else if (ctx) {
    ctx.parentElement.innerHTML = '<p style="color:var(--dim); font-size:0.85rem;">Gráfico no disponible (Chart.js no cargó).</p>';
  }
}

// ---------------------------------------------------------------
// Vista: Tipo y Estado
// ---------------------------------------------------------------
function renderTipoEstado(){
  const total = DATA.gastos.reduce((s, g) => s + g.monto, 0);

  const porTipo = agrupar(DATA.gastos, g => g.tipo);
  const porEstado = agrupar(DATA.gastos, g => g.estado);
  const pendientes = DATA.gastos.filter(g => g.estado === 'Por pagar');
  const totalPendiente = pendientes.reduce((s, g) => s + g.monto, 0);

  function filaBarra(nombre, items, claseExtra){
    const suma = items.reduce((s, g) => s + g.monto, 0);
    const pct = total > 0 ? (suma / total * 100) : 0;
    return `
      <div class="group-title" style="margin-top:1rem;">${nombre} — ${fmt(suma)} (${pct.toFixed(1)}%)</div>
      <div class="bar-track"><div class="bar-fill ${claseExtra || ''}" style="width:${pct}%"></div></div>
    `;
  }

  let html = `
    <div class="grid-2" style="margin-bottom:1.2rem;">
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

    <div class="card">
      <h3 style="color:var(--over);">Pendientes de pago — ${fmt(totalPendiente)} en ${pendientes.length} ítems</h3>
      <p style="color:var(--dim); font-size:0.82rem; margin-top:0.2rem;">Esto es plata comprometida que todavía no se ha pagado — sirve para hacer seguimiento y no perderle la pista.</p>
      ${Object.entries(agrupar(pendientes, g => g.categoria)).map(([cat, items]) => {
        return acordeonGrupo(`${cat} (${mesesUnicos(items)})`, items, null, {});
      }).join('') || '<p style="color:var(--dim); font-size:0.85rem; margin-top:0.5rem;">No hay pendientes 🎉</p>'}
    </div>
  `;

  document.getElementById('content').innerHTML = html;
  activarAcordeones();
}

function mesesUnicos(items){
  const meses = [...new Set(items.map(g => mesDeFecha(g)))];
  return meses.length > 2 ? `${meses.length} meses` : meses.join(', ');
}

// ---------------------------------------------------------------
// Vista: Informes — por mes, trimestre o año completo, imprimible / PDF
// ---------------------------------------------------------------
let informeScope = 'mes';
let informeValor = null;

function renderInformes(){
  const mesesConDatos = [...new Set(DATA.gastos.map(g => Number(g.mes)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 12)
    .sort((a,b) => a - b);

  if (informeValor === null && mesesConDatos.length) informeValor = mesesConDatos[0];

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card no-print" style="margin-bottom:1.2rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
      <div style="display:flex; gap:0.4rem;">
        <button class="scope-btn informe-scope-btn ${informeScope === 'mes' ? 'active' : ''}" data-scope="mes">Por mes</button>
        <button class="scope-btn informe-scope-btn ${informeScope === 'trimestre' ? 'active' : ''}" data-scope="trimestre">Por trimestre</button>
        <button class="scope-btn informe-scope-btn ${informeScope === 'anio' ? 'active' : ''}" data-scope="anio">Año completo</button>
      </div>
      <div id="informe-selector-extra"></div>
      <button id="print-btn" style="margin-left:auto; border:1px solid var(--border); background:#fff; padding:0.5rem 1rem; border-radius:4px; cursor:pointer;">Imprimir / Guardar como PDF</button>
    </div>
    <div id="informe-content"></div>
  `;

  document.querySelectorAll('.informe-scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      informeScope = btn.dataset.scope;
      if (informeScope === 'mes') informeValor = mesesConDatos[0];
      else if (informeScope === 'trimestre') informeValor = 'Q1';
      else informeValor = null;
      renderInformes();
    });
  });

  const extra = document.getElementById('informe-selector-extra');
  if (informeScope === 'mes') {
    extra.innerHTML = `<select id="informe-valor">${mesesConDatos.map(n => `<option value="${n}" ${n === informeValor ? 'selected' : ''}>${MESES[n-1]}</option>`).join('')}</select>`;
    document.getElementById('informe-valor').addEventListener('change', e => { informeValor = Number(e.target.value); renderInformeContenido(); });
  } else if (informeScope === 'trimestre') {
    extra.innerHTML = `<select id="informe-valor">${['Q1','Q2','Q3','Q4'].map(q => `<option value="${q}" ${q === informeValor ? 'selected' : ''}>${q}</option>`).join('')}</select>`;
    document.getElementById('informe-valor').addEventListener('change', e => { informeValor = e.target.value; renderInformeContenido(); });
  } else {
    extra.innerHTML = '';
  }

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  renderInformeContenido();
}

function renderInformeContenido(){
  let items, titulo, presupuestoRef;

  if (informeScope === 'mes') {
    items = DATA.gastos.filter(g => Number(g.mes) === informeValor);
    titulo = MESES[informeValor - 1];
    presupuestoRef = DATA.presupuestoMensual;
  } else if (informeScope === 'trimestre') {
    items = DATA.gastos.filter(g => trimestreDeMes(g) === informeValor);
    titulo = informeValor;
    presupuestoRef = DATA.presupuestoMensual * 3;
  } else {
    items = DATA.gastos;
    titulo = 'Año completo';
    presupuestoRef = DATA.presupuestoMensual * 12;
  }

  const total = items.reduce((s, g) => s + g.monto, 0);
  const pct = presupuestoRef > 0 ? (total / presupuestoRef * 100) : null;
  const over = pct !== null && pct > 100;
  const porCategoria = agrupar(items, g => g.categoria);

  document.getElementById('informe-content').innerHTML = `
    <div class="card" style="margin-bottom:1.2rem;">
      <h3>Informe de gastos — ${titulo}</h3>
      <p style="color:var(--dim); font-size:0.8rem; margin-bottom:1rem;">Generado el ${new Date().toLocaleDateString('es-CL')}</p>
      <div class="grid-4">
        <div class="kpi">
          <div class="label">Presupuesto de referencia</div>
          <div class="value">${fmt(presupuestoRef)}</div>
        </div>
        <div class="kpi">
          <div class="label">Gasto real</div>
          <div class="value ${over ? 'over' : ''}">${fmt(total)}</div>
        </div>
        <div class="kpi">
          <div class="label">% del presupuesto usado</div>
          <div class="value ${over ? 'over' : ''}">${pct !== null ? pct.toFixed(1) + '%' : '—'}</div>
        </div>
        <div class="kpi">
          <div class="label">N° de ítems registrados</div>
          <div class="value">${items.length}</div>
        </div>
      </div>
      <p style="color:var(--dim); font-size:0.76rem; margin-top:0.8rem;">"Presupuesto de referencia" es el monto fijo definido en tu Sheet (pestaña Config) escalado al período elegido — no un presupuesto específico negociado para ${titulo}.</p>
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
      ${tablaItems(items)}
    </div>
  `;
}

function claseEstado(estado){
  if (estado === 'Pagado') return 'pagado';
  if (estado === 'Por pagar' || estado === 'Confirmado sin pagar') return 'confirmado';
  return 'presupuestado';
}
