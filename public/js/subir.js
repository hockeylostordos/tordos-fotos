// "Subir fotos": 1) elegir o sacar fotos  2) etiquetarlas  3) subirlas con barra de progreso.
import { sb, estado, api, cargarFotos, cargarDivisiones, misHijas } from './datos.js';
import { leerImagen, achicar, fechaDeFoto, LADO_FOTO, CALIDAD_FOTO, LADO_MINIATURA, CALIDAD_MINIATURA } from './imagen.js';
import { h, icono, aviso, pedirTexto, mensajeError, MESES, MESES_CORTOS, ACTIVIDADES, plural, sinAcentos } from './ui.js';
import { avatarJugadora } from './chicas.js';
import { irA } from './app.js';

// El estado vive acá: si cambiás de pantalla mientras sube, la subida sigue.
const s = nuevaSubida();
let contenedor = null;
let candado = null;

function nuevaSubida() {
  const hoy = new Date();
  return {
    fase: 'elegir',
    archivos: [],
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    fechaDetectada: false,
    division: null,
    actividad: null,
    titulo: '',
    jugadoras: new Set(),
    errorEtiquetas: '',
  };
}

function reiniciar() {
  s.archivos.forEach((a) => URL.revokeObjectURL(a.vista));
  Object.assign(s, nuevaSubida());
}

export function subiendo() {
  return s.fase === 'subiendo';
}

export function pantallaSubir() {
  contenedor = h('div');
  pintar();
  return contenedor;
}

function pintar() {
  if (!contenedor) return;
  const vistas = { elegir: vistaElegir, etiquetar: vistaEtiquetar, subiendo: vistaSubiendo, listo: vistaListo };
  contenedor.replaceChildren(...[].concat(vistas[s.fase]()).filter(Boolean));
  contenedor.style.display = 'grid';
  contenedor.style.gap = '20px';
}

function indicador(paso) {
  return h('div.pasos', { 'aria-hidden': 'true' }, [1, 2, 3].map((n) => h('span', { clase: n <= paso ? 'hecho' : '' })));
}

// ---------- Paso 1: elegir fotos ----------
function selectorArchivos({ camara }) {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  if (camara) input.setAttribute('capture', 'environment');
  else input.multiple = true;
  input.onchange = async () => {
    const nuevos = [...input.files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    if (!nuevos.length) return;
    for (const f of nuevos) {
      s.archivos.push({ archivo: f, vista: URL.createObjectURL(f), estado: 'esperando', error: '' });
    }
    await detectarFecha();
    pintar();
  };
  return input;
}

async function detectarFecha() {
  if (s.fechaDetectada) return;
  const cuenta = new Map();
  for (const a of s.archivos.slice(0, 40)) {
    const f = await fechaDeFoto(a.archivo);
    if (f) { const k = f.anio + '-' + f.mes; cuenta.set(k, (cuenta.get(k) || 0) + 1); }
  }
  if (!cuenta.size) return;
  const [k] = [...cuenta.entries()].sort((x, y) => y[1] - x[1])[0];
  const [anio, mes] = k.split('-').map(Number);
  Object.assign(s, { anio, mes, fechaDetectada: true });
}

function vistaElegir() {
  const inCamara = selectorArchivos({ camara: true });
  const inGaleria = selectorArchivos({ camara: false });
  const hay = s.archivos.length;

  const partes = [
    indicador(1),
    h('div', h('h1', 'Subir fotos'), h('p.suave', 'Paso 1 de 2: elegí las fotos que querés compartir.')),
    inCamara, inGaleria,
  ];

  if (!hay) {
    partes.push(h('div.elegir-origen',
      h('button.origen.galeria', { type: 'button', onclick: () => inGaleria.click() },
        icono('galeria'), h('span', 'Elegir de la galería', h('small', 'Podés marcar muchas fotos a la vez'))),
      h('button.origen.camara', { type: 'button', onclick: () => inCamara.click() },
        icono('camara'), h('span', 'Sacar una foto ahora', h('small', 'Se abre la cámara del celular')))));
    return partes;
  }

  partes.push(
    h('div.seccion-titulo', h('h2', plural(hay, 'foto elegida', 'fotos elegidas')),
      h('button.btn.btn-texto', { type: 'button', onclick: () => { reiniciar(); pintar(); } }, 'Empezar de nuevo')),
    h('div.previas', s.archivos.map((a, i) =>
      h('div.previa',
        h('img', { src: a.vista, alt: '' }),
        h('button.quitar', { type: 'button', 'aria-label': 'Quitar esta foto', onclick: () => {
          URL.revokeObjectURL(a.vista);
          s.archivos.splice(i, 1);
          pintar();
        } }, icono('x'))))),
    h('div.fila-botones',
      h('button.btn.btn-celeste', { type: 'button', onclick: () => inGaleria.click() }, icono('galeria'), 'Agregar más'),
      h('button.btn.btn-celeste', { type: 'button', onclick: () => inCamara.click() }, icono('camara'), 'Sacar otra')),
    h('div.pie-fijo',
      h('button.btn.btn-rojo.btn-bloque', { type: 'button', onclick: () => { s.fase = 'etiquetar'; pintar(); window.scrollTo(0, 0); } },
        'Siguiente: ponerles datos')));
  return partes;
}

// ---------- Paso 2: etiquetar ----------
function chip(texto, activo, alTocar, extra = {}) {
  return h('button.chip', { type: 'button', 'aria-pressed': !!activo, onclick: alTocar, ...extra }, texto);
}

function vistaEtiquetar() {
  const anioActual = new Date().getFullYear();
  const anios = [];
  for (let a = anioActual; a >= Math.min(2019, s.anio); a--) anios.push(a);

  const error = h('p.error-form', { hidden: !s.errorEtiquetas }, s.errorEtiquetas);

  const tituloInput = h('input.entrada', { type: 'text', maxlength: 80, value: s.titulo,
    placeholder: 'Ej: Final del torneo en el club', oninput: (e) => { s.titulo = e.target.value; } });

  const hijas = new Set(misHijas().map((j) => j.id));
  const ordenadas = estado.jugadoras.slice().sort((a, b) =>
    (hijas.has(b.id) - hijas.has(a.id)) || sinAcentos(a.nombre).localeCompare(sinAcentos(b.nombre)));

  const opcionalAbierto = s.actividad || s.titulo || s.jugadoras.size;

  return [
    indicador(2),
    h('div', h('h1', 'Contanos de qué son'), h('p.suave', `Paso 2 de 2: estos datos van para ${s.archivos.length === 1 ? 'la foto' : 'las ' + s.archivos.length + ' fotos'}.`)),
    s.fechaDetectada ? h('p.nota', `Las fotos dicen que son de ${MESES[s.mes - 1]} ${s.anio}. Si no es así, cambialo.`) : null,

    h('section.tarjeta',
      h('h2', 'Mes ', h('span.obligatorio', '*')),
      h('div.chips.meses', MESES_CORTOS.map((m, i) =>
        chip(m, s.mes === i + 1, () => { s.mes = i + 1; pintar(); }, { 'aria-label': MESES[i] }))),
      h('h2', 'Año ', h('span.obligatorio', '*')),
      h('div.chips', anios.map((a) => chip(String(a), s.anio === a, () => { s.anio = a; pintar(); })))),

    h('section.tarjeta',
      h('h2', 'División ', h('span.obligatorio', '*')),
      h('div.chips.rojo',
        estado.divisiones.map((d) => chip(d.nombre, s.division === d.id, () => { s.division = d.id; s.errorEtiquetas = ''; pintar(); })),
        chip([icono('mas'), 'Nueva división'], false, nuevaDivision, { clase: 'agregar' }))),

    h('details.tarjeta.opcional', { open: !!opcionalAbierto },
      h('summary', 'Más datos (opcional)'),
      h('div',
        h('div', h('h3', 'Tipo de actividad'),
          h('div.chips', { style: 'margin-top:10px' }, ACTIVIDADES.map((a) =>
            chip(a, s.actividad === a, () => { s.actividad = s.actividad === a ? null : a; pintar(); })))),
        h('div', h('h3', '¿Quiénes están en las fotos?'),
          ordenadas.length
            ? h('div.elegir-chicas', { style: 'margin-top:10px' }, ordenadas.map((j) =>
              h('button.elegir-chica', { type: 'button', 'aria-pressed': s.jugadoras.has(j.id), onclick: (e) => {
                if (s.jugadoras.has(j.id)) s.jugadoras.delete(j.id); else s.jugadoras.add(j.id);
                e.currentTarget.setAttribute('aria-pressed', s.jugadoras.has(j.id));
              } }, avatarJugadora(j), `${j.nombre} ${j.apellido}`)))
            : h('p.suave', { style: 'margin-top:8px' }, 'Todavía no hay jugadoras cargadas. Se agregan en "Las chicas".')),
        h('label.campo', h('span', 'Título'), tituloInput))),

    error,
    h('div.pie-fijo',
      h('button.btn.btn-rojo.btn-bloque', { type: 'button', onclick: empezarSubida },
        icono('subir'), `Subir ${plural(s.archivos.length, 'foto', 'fotos')}`)),
    h('button.btn.btn-texto', { type: 'button', onclick: () => { s.fase = 'elegir'; pintar(); } }, 'Volver a las fotos'),
  ];
}

async function nuevaDivision() {
  const nombre = await pedirTexto('Nueva división', { etiqueta: 'Nombre de la división', boton: 'Agregar división', ayuda: 'Por ejemplo: Octava A' });
  if (!nombre) return;
  const { data, error } = await sb.from('divisiones').insert({ nombre: nombre.trim(), orden: 100 }).select().single();
  if (error) return aviso(mensajeError(error, 'No se pudo agregar la división.'), 'error');
  await cargarDivisiones();
  s.division = data.id;
  s.errorEtiquetas = '';
  aviso(`Se agregó la división ${data.nombre}.`, 'bien');
  pintar();
}

// ---------- Paso 3: subir ----------
async function empezarSubida() {
  if (!s.division) {
    s.errorEtiquetas = 'Falta elegir la división.';
    pintar();
    contenedor.querySelector('.error-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  s.fase = 'subiendo';
  s.archivos.forEach((a) => { if (a.estado !== 'ok') { a.estado = 'esperando'; a.error = ''; } });
  pintar();
  window.scrollTo(0, 0);

  window.addEventListener('beforeunload', avisarSalida);
  try { candado = await navigator.wakeLock?.request('screen'); } catch { candado = null; }

  const cola = s.archivos.filter((a) => a.estado !== 'ok');
  // La primera sola (crea las carpetas en Drive) y después de a dos
  if (cola.length) await subirUna(cola.shift());
  const trabajadores = [0, 1].map(async () => {
    while (cola.length) await subirUna(cola.shift());
  });
  await Promise.all(trabajadores);

  window.removeEventListener('beforeunload', avisarSalida);
  try { await candado?.release(); } catch { /* */ }
  await cargarFotos().catch(() => {});
  s.fase = 'listo';
  if (contenedor && document.body.contains(contenedor)) pintar();
  else {
    const mal = s.archivos.filter((a) => a.estado === 'mal').length;
    aviso(mal ? `Terminó la subida, pero ${mal} no se pudieron subir.` : '¡Listo! Ya se subieron tus fotos.', mal ? 'error' : 'bien');
  }
}

function avisarSalida(e) {
  e.preventDefault();
  e.returnValue = '';
}

async function subirUna(a) {
  a.estado = 'subiendo';
  refrescar();
  try {
    const { img, url } = await leerImagen(a.archivo);
    const grande = await achicar(img, LADO_FOTO, CALIDAD_FOTO);
    const chica = await achicar(img, LADO_MINIATURA, CALIDAD_MINIATURA);
    URL.revokeObjectURL(url);

    const div = estado.divisionPorId.get(s.division);
    const nombreArchivo = [
      `${s.anio}-${String(s.mes).padStart(2, '0')}`, div && div.nombre, s.actividad, s.titulo,
      Date.now().toString(36),
    ].filter(Boolean).join(' ').slice(0, 110) + '.jpg';

    const params = new URLSearchParams({ anio: s.anio, mes: s.mes, nombre: nombreArchivo });
    const { driveId } = await api('/api/subir?' + params, { cuerpo: grande.blob, tipo: 'image/jpeg' });

    const ruta = `fotos/${s.anio}/${crypto.randomUUID()}.jpg`;
    const sube = await sb.storage.from('miniaturas').upload(ruta, chica.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (sube.error) throw sube.error;

    const { data: foto, error } = await sb.from('fotos').insert({
      drive_file_id: driveId,
      miniatura_path: ruta,
      nombre_archivo: nombreArchivo,
      ancho: grande.ancho,
      alto: grande.alto,
      mes: s.mes,
      anio: s.anio,
      division_id: s.division,
      tipo_actividad: s.actividad,
      titulo: s.titulo.trim() || null,
      subido_por: estado.yo.id,
    }).select('id').single();
    if (error) throw error;

    if (s.jugadoras.size) {
      const { error: e2 } = await sb.from('foto_jugadoras').insert([...s.jugadoras].map((jugadora_id) => ({ foto_id: foto.id, jugadora_id })));
      if (e2) console.error(e2);
    }
    a.estado = 'ok';
  } catch (e) {
    console.error(e);
    a.estado = 'mal';
    a.error = mensajeError(e, 'No se pudo subir.');
  }
  refrescar();
}

// Actualiza solo la barra y los íconos (sin redibujar todo)
function refrescar() {
  if (!contenedor || !document.body.contains(contenedor) || s.fase !== 'subiendo') return;
  const total = s.archivos.length;
  const hechas = s.archivos.filter((a) => a.estado === 'ok' || a.estado === 'mal').length;
  const barra = contenedor.querySelector('.barra-progreso div');
  const texto = contenedor.querySelector('[data-progreso]');
  if (barra) barra.style.width = Math.round((hechas / total) * 100) + '%';
  if (texto) texto.textContent = `${hechas} de ${total}`;
  contenedor.querySelectorAll('.previa').forEach((nodo, i) => {
    const a = s.archivos[i];
    if (!a || nodo.dataset.estado === a.estado) return;
    nodo.dataset.estado = a.estado;
    nodo.className = 'previa ' + ({ ok: 'ok', mal: 'mal', esperando: 'esperando' }[a.estado] || '');
    nodo.querySelector('.estado').replaceChildren(iconoEstado(a.estado));
  });
}

function iconoEstado(e) {
  if (e === 'ok') return icono('ok');
  if (e === 'mal') return icono('alerta');
  if (e === 'subiendo') return icono('cargando', 'girando');
  return '';
}

function vistaSubiendo() {
  const total = s.archivos.length;
  const hechas = s.archivos.filter((a) => a.estado === 'ok' || a.estado === 'mal').length;
  return [
    indicador(3),
    h('div', h('h1', 'Subiendo tus fotos…'), h('p.suave', 'Dejá la app abierta hasta que termine.')),
    h('div.tarjeta',
      h('div.seccion-titulo', h('b', 'Progreso'), h('b', { 'data-progreso': '' }, `${hechas} de ${total}`)),
      h('div.barra-progreso', h('div', { style: `width:${Math.round((hechas / total) * 100)}%` }))),
    h('div.previas', s.archivos.map((a) =>
      h('div.previa', { clase: { ok: 'ok', mal: 'mal', esperando: 'esperando' }[a.estado] || '', 'data-estado': a.estado },
        h('img', { src: a.vista, alt: '' }),
        h('div.estado', iconoEstado(a.estado))))),
  ];
}

function vistaListo() {
  const ok = s.archivos.filter((a) => a.estado === 'ok').length;
  const mal = s.archivos.filter((a) => a.estado === 'mal');
  const filtro = new URLSearchParams({ anio: s.anio, division: s.division });

  return [
    h('div.tarjeta.listo-grande',
      h('div.sello', icono(mal.length ? 'alerta' : 'ok')),
      h('h1', ok ? `¡Listo! Subiste ${plural(ok, 'foto', 'fotos')}` : 'No se pudo subir ninguna foto'),
      ok ? h('p.suave', `Quedaron guardadas en ${MESES[s.mes - 1]} ${s.anio}.`) : null,
      mal.length ? h('p.error-form', `${plural(mal.length, 'foto no se pudo subir', 'fotos no se pudieron subir')}: ${mal[0].error}`) : null),
    mal.length ? h('button.btn.btn-rojo.btn-bloque', { type: 'button', onclick: () => {
      s.archivos = s.archivos.filter((a) => a.estado !== 'ok');
      empezarSubida();
    } }, icono('recuperar'), 'Reintentar las que fallaron') : null,
    ok ? h('a.btn.btn-azul.btn-bloque', { href: '#/fotos?' + filtro, onclick: () => reiniciar() }, icono('galeria'), 'Ver las fotos') : null,
    h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: () => { reiniciar(); pintar(); } }, icono('subir'), 'Subir más fotos'),
    h('button.btn.btn-texto', { type: 'button', onclick: () => { reiniciar(); irA('inicio'); } }, 'Volver al inicio'),
  ];
}

