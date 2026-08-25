"use strict";

const RUTA_DATOS = "./data/estado_demanda.json";

const ORDEN_CANALES = ["108", "Colaborativa / 911", "Espontáneas", "Particulares"];

const ESTADOS = [
  { clave: "se_contacta", etiqueta: "Se contacta" },
  { clave: "no_se_contacta", etiqueta: "No se contacta" },
  { clave: "sin_cubrir", etiqueta: "Sin cubrir" },
  { clave: "desestimado", etiqueta: "Desestimado" },
];

const elementos = {
  subtitulo: document.querySelector("#subtitulo"),
  kpiTotal: document.querySelector("#kpiTotal"),
  kpiSeContacta: document.querySelector("#kpiSeContacta"),
  kpiSeContactaLabel: document.querySelector("#kpiSeContactaLabel"),
  kpiNoSeContacta: document.querySelector("#kpiNoSeContacta"),
  kpiNoSeContactaLabel: document.querySelector("#kpiNoSeContactaLabel"),
  kpiSinCubrir: document.querySelector("#kpiSinCubrir"),
  kpiSinCubrirLabel: document.querySelector("#kpiSinCubrirLabel"),
  kpiDesestimado: document.querySelector("#kpiDesestimado"),
  kpiDesestimadoLabel: document.querySelector("#kpiDesestimadoLabel"),
  columnasZonas: document.querySelector("#columnasZonas"),
  dashboardContainer: document.querySelector(".dashboard-container"),
  btnExportar: document.querySelector("#btnExportar"),
  carruselPrev: document.querySelector("#carruselPrev"),
  carruselNext: document.querySelector("#carruselNext"),
  carruselDots: document.querySelector("#carruselDots"),
};

const ZONAS_POR_PAGINA = 2;

let paginasZonas = [];
let paginaActual = 0;

function formatearNumero(valor) {
  return valor.toLocaleString("es-AR");
}

function calcularPorcentaje(cantidad, total) {
  if (!total) {
    return 0;
  }

  return Math.round((cantidad / total) * 100);
}

function renderizarIndicadoresGenerales(datos) {
  const { total } = datos;

  elementos.kpiTotal.textContent = formatearNumero(total.total);

  elementos.kpiSeContacta.textContent = formatearNumero(total.se_contacta);
  elementos.kpiSeContactaLabel.textContent =
    `Se contacta (${calcularPorcentaje(total.se_contacta, total.total)}%)`;

  elementos.kpiNoSeContacta.textContent = formatearNumero(total.no_se_contacta);
  elementos.kpiNoSeContactaLabel.textContent =
    `No se contacta (${calcularPorcentaje(total.no_se_contacta, total.total)}%)`;

  elementos.kpiSinCubrir.textContent = formatearNumero(total.sin_cubrir);
  elementos.kpiSinCubrirLabel.textContent =
    `Sin cubrir (${calcularPorcentaje(total.sin_cubrir, total.total)}%)`;

  elementos.kpiDesestimado.textContent = formatearNumero(total.desestimado);
  elementos.kpiDesestimadoLabel.textContent =
    `Desestimado (${calcularPorcentaje(total.desestimado, total.total)}%)`;
}

function construirSubKpis(resumen) {
  return ESTADOS.map(({ clave, etiqueta }) => {
    const cantidad = resumen[clave];
    const porcentaje = calcularPorcentaje(cantidad, resumen.total);
    const claseVerde = clave === "se_contacta" ? " green-light" : "";

    return `
      <div class="sub-kpi-card${claseVerde}">
        <div class="sub-kpi-value">${formatearNumero(cantidad)} (${porcentaje}%)</div>
        <div class="sub-kpi-label">${etiqueta}</div>
      </div>
    `;
  }).join("");
}

function construirTablaCanales(canales) {
  const canalesDisponibles = ORDEN_CANALES.filter(
    (nombre) => canales[nombre],
  );

  const filaTotal = `
    <tr class="row-total">
      <td>Total Demanda</td>
      ${canalesDisponibles
        .map((nombre) => `<td>${formatearNumero(canales[nombre].total)}</td>`)
        .join("")}
    </tr>
  `;

  const filasEstados = ESTADOS.map(({ clave, etiqueta }) => {
    const celdas = canalesDisponibles
      .map((nombre) => {
        const canal = canales[nombre];
        const cantidad = canal[clave];
        const porcentaje = calcularPorcentaje(cantidad, canal.total);

        return `<td>${formatearNumero(cantidad)} (${porcentaje}%)</td>`;
      })
      .join("");

    return `<tr><td>${etiqueta}</td>${celdas}</tr>`;
  }).join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>CANALES</th>
          ${canalesDisponibles.map((nombre) => `<th>${nombre}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${filaTotal}
        ${filasEstados}
      </tbody>
    </table>
  `;
}

function construirColumnaZona(zona) {
  const claseHeader = zona.estilo === "teal" ? " column-header--teal" : "";

  return `
    <div class="column-box">
      <div class="column-header${claseHeader}">
        <span>${zona.nombre}</span>
        <span class="total-badge">Total demanda: ${formatearNumero(zona.resumen.total)}</span>
      </div>

      <div class="sub-kpi-row">
        ${construirSubKpis(zona.resumen)}
      </div>

      ${construirTablaCanales(zona.canales)}
    </div>
  `;
}

function agruparEnPaginas(zonas, tamano) {
  const paginas = [];

  for (let indice = 0; indice < zonas.length; indice += tamano) {
    paginas.push(zonas.slice(indice, indice + tamano));
  }

  return paginas;
}

function renderizarPaginaActual() {
  const pagina = paginasZonas[paginaActual] || [];

  elementos.columnasZonas.innerHTML = pagina
    .map((zona) => construirColumnaZona(zona))
    .join("");

  elementos.carruselPrev.disabled = paginaActual === 0;
  elementos.carruselNext.disabled = paginaActual === paginasZonas.length - 1;

  elementos.carruselDots.innerHTML = paginasZonas
    .map((_, indice) => `
      <button
        type="button"
        class="carousel-dot${indice === paginaActual ? " is-active" : ""}"
        data-pagina="${indice}"
        aria-label="Ir a la página ${indice + 1}"
      ></button>
    `)
    .join("");
}

function irAPagina(indice) {
  if (indice < 0 || indice >= paginasZonas.length) {
    return;
  }

  paginaActual = indice;
  renderizarPaginaActual();
}

function renderizarZonas(datos) {
  paginasZonas = agruparEnPaginas(datos.zonas, ZONAS_POR_PAGINA);
  paginaActual = 0;

  renderizarPaginaActual();
}

function renderizarSubtitulo(datos) {
  elementos.subtitulo.textContent = `Datos de la ${datos.semana_label}`;
}

async function cargarDatos() {
  const respuesta = await fetch(RUTA_DATOS, { cache: "no-store" });

  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${RUTA_DATOS}. Código: ${respuesta.status}`);
  }

  const datos = await respuesta.json();

  renderizarSubtitulo(datos);
  renderizarIndicadoresGenerales(datos);
  renderizarZonas(datos);
}

function mostrarError(error) {
  console.error(error);

  elementos.subtitulo.textContent = "No se pudieron cargar los datos";
  elementos.columnasZonas.innerHTML = `
    <div class="empty-state">
      Ocurrió un error al cargar data/estado_demanda.json
    </div>
  `;
}

async function exportarImagen() {
  elementos.btnExportar.disabled = true;
  elementos.btnExportar.textContent = "Generando...";
  elementos.btnExportar.style.visibility = "hidden";

  try {
    const canvas = await html2canvas(elementos.dashboardContainer, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const enlace = document.createElement("a");
    enlace.download = `estado-demanda_${new Date().toISOString().slice(0, 10)}.png`;
    enlace.href = canvas.toDataURL("image/png");
    enlace.click();
  } catch (error) {
    console.error(error);
    alert("No se pudo generar la imagen.");
  } finally {
    elementos.btnExportar.style.visibility = "visible";
    elementos.btnExportar.disabled = false;
    elementos.btnExportar.textContent = "Exportar imagen";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarDatos().catch(mostrarError);
  elementos.btnExportar.addEventListener("click", exportarImagen);

  elementos.carruselPrev.addEventListener("click", () => irAPagina(paginaActual - 1));
  elementos.carruselNext.addEventListener("click", () => irAPagina(paginaActual + 1));

  elementos.carruselDots.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-pagina]");

    if (boton) {
      irAPagina(Number(boton.dataset.pagina));
    }
  });
});
