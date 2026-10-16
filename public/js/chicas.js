// "Las chicas": todas las jugadoras, sus familias y la bienvenida para elegir a tu hija.
import { sb, estado, cargarJugadoras, imagenMiniatura, misHijas } from './datos.js';
import { leerImagen, achicar } from './imagen.js';
import { h, icono, aviso, hoja, confirmar, mensajeError, cargandoEn, iniciales, plural, sinAcentos } from './ui.js';
import { irA } from './app.js';

export function avatarJugadora(j, clase = '') {
  const a = h('span.avatar', { clase });
  if (j.foto_path) a.append(imagenMiniatura(j.foto_path, ''));
  else a.textContent = iniciales(j.nombre, j.apellido);
  return a;
}

function textoPadres(j) {
  return j.padres.map((id) => estado.perfilPorId.get(id)).filter(Boolean)
    .sort((a, b) => (a.rol === 'mamá' ? 0 : 1) - (b.rol === 'mamá' ? 0 : 1))
    .map((p) => `${p.rol === 'mamá' ? 'Mamá' : 'Papá'}: ${p.nombre}`);
}

function fotosDe(j) {
  return estado.fotos.filter((f) => f.jugadoras.includes(j.id)).length;
}

// ---------- Pantalla principal ----------
export async function pantallaChicas() {
  const mias = new Set(misHijas().map((j) => j.id));
  const todas = estado.jugadoras.slice().sort((a, b) =>
    sinAcentos(a.nombre + a.apellido).localeCompare(sinAcentos(b.nombre + b.apellido)));
  const resto = todas.filter((j) => !mias.has(j.id));

  const tarjeta = (j) => h('button.tarjeta-chica', { type: 'button', clase: mias.has(j.id) ? 'mia' : '', onclick: () => detalle(j) },
    avatarJugadora(j),
    h('b', `${j.nombre} ${j.apellido}`),
    h('small', textoPadres(j).join(' y ') || 'Sin familia vinculada'),
    h('small', plural(fotosDe(j), 'foto', 'fotos')));

  return [
    h('div.encabezado-pantalla',
      h('div', h('h1', 'Las chicas'), h('p.suave', `${plural(todas.length, 'jugadora', 'jugadoras')} en el equipo`)),
      h('button.btn.btn-rojo.btn-chico', { type: 'button', onclick: () => editarJugadora(null, { esMia: false }) }, icono('mas'), 'Agregar jugadora')),
    mias.size ? h('section', h('h2', mias.size === 1 ? 'Mi hija' : 'Mis hijas'),
      h('div.grilla-chicas', { style: 'margin-top:12px' }, todas.filter((j) => mias.has(j.id)).map(tarjeta))) : null,
    (resto.length || !todas.length) ? h('section', mias.size ? h('h2', 'Todo el equipo') : null,
      resto.length
        ? h('div.grilla-chicas', { style: mias.size ? 'margin-top:12px' : '' }, resto.map(tarjeta))
        : (!todas.length ? h('div.vacio', icono('chicas'), h('h2', 'Todavía no hay jugadoras'),
          h('p.suave', 'Agregá a tu hija para que aparezca acá y se la pueda marcar en las fotos.'),
          h('button.btn.btn-rojo', { type: 'button', onclick: () => editarJugadora(null, { esMia: true }) }, icono('mas'), 'Agregar a mi hija')) : null)) : null,
  ];
}

function refrescarPantalla() {
  if (location.hash.startsWith('#/chicas')) irA('chicas');
}

// ---------- Detalle de una jugadora ----------
function detalle(j) {
  const esMia = j.padres.includes(estado.yo.id);
  const cant = fotosDe(j);
  const btnVer = h('a.btn.btn-azul.btn-bloque', { href: '#/fotos?jugadora=' + j.id }, icono('galeria'),
    cant ? `Ver sus ${plural(cant, 'foto', 'fotos')}` : 'Ver sus fotos');
  const btnMia = h('button.btn.btn-bloque', { type: 'button', clase: esMia ? 'btn-borde' : 'btn-rosa' },
    icono('corazon'), esMia ? 'Ya no es mi hija' : 'Es mi hija');
  const btnEditar = h('button.btn.btn-celeste.btn-bloque', { type: 'button' }, icono('editar'), 'Cambiar nombre o foto');
  const btnBorrar = estado.yo.es_admin ? h('button.btn.btn-peligro.btn-bloque', { type: 'button' }, icono('borrar'), 'Borrar jugadora') : null;

  const v = hoja(`${j.nombre} ${j.apellido}`, h('div', { style: 'display:grid;gap:12px;justify-items:center;text-align:center' },
    avatarJugadora(j, 'grande'),
    h('p.suave', textoPadres(j).join(' y ') || 'Todavía nadie la marcó como su hija'),
    h('div', { style: 'display:grid;gap:10px;width:100%' }, btnVer, btnMia, btnEditar, btnBorrar)));

  btnVer.onclick = () => v.cerrar();
  btnEditar.onclick = () => { v.cerrar(); editarJugadora(j); };
  btnMia.onclick = async () => {
    if (esMia) {
      const ok = await confirmar('¿Desvincularte?', `${j.nombre} va a dejar de figurar como tu hija. Sus fotos no se borran.`, { si: 'Sí, desvincular' });
      if (!ok) return;
      const { error } = await sb.from('familia').delete().eq('perfil_id', estado.yo.id).eq('jugadora_id', j.id);
      if (error) return aviso(mensajeError(error), 'error');
    } else {
      const { error } = await sb.from('familia').insert({ perfil_id: estado.yo.id, jugadora_id: j.id });
      if (error) return aviso(mensajeError(error), 'error');
      aviso(`¡Listo! ${j.nombre} figura como tu hija.`, 'bien');
    }
    await cargarJugadoras();
    v.cerrar();
    refrescarPantalla();
  };
  if (btnBorrar) btnBorrar.onclick = async () => {
    const ok = await confirmar('¿Borrar jugadora?',
      `Se borra a ${j.nombre} ${j.apellido} de la lista y se la quita de las fotos donde estaba marcada. Las fotos no se borran.`,
      { si: 'Sí, borrar', peligro: true });
    if (!ok) return;
    const { error } = await sb.from('jugadoras').delete().eq('id', j.id);
    if (error) return aviso(mensajeError(error), 'error');
    estado.fotos.forEach((f) => { f.jugadoras = f.jugadoras.filter((id) => id !== j.id); });
    await cargarJugadoras();
    v.cerrar();
    aviso('Jugadora borrada.');
    refrescarPantalla();
  };
}

// ---------- Agregar o editar una jugadora ----------
export function editarJugadora(j, { esMia = false, alGuardar } = {}) {
  return new Promise((resolver) => {
    let fotoNueva = null;
    let guardada = null;
    const nombre = h('input.entrada', { type: 'text', autocapitalize: 'words', value: j ? j.nombre : '', required: true });
    const apellido = h('input.entrada', { type: 'text', autocapitalize: 'words', value: j ? j.apellido : '', required: true });
    const vista = h('div', { style: 'display:grid;justify-items:center;gap:10px' });
    const archivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const btnFoto = h('button.btn.btn-celeste.btn-chico', { type: 'button', onclick: () => archivo.click() }, icono('camara'), j && j.foto_path ? 'Cambiar foto' : 'Elegir foto');
    const casillaMia = h('input', { type: 'checkbox', checked: esMia, style: 'width:24px;height:24px;accent-color:var(--rojo)' });
    const boton = h('button.btn.btn-rojo.btn-bloque', { type: 'submit' }, j ? 'Guardar cambios' : 'Agregar jugadora');

    const pintarVista = (src) => {
      const av = src ? h('span.avatar.grande', h('img', { src, alt: '' }))
        : (j ? avatarJugadora(j, 'grande') : h('span.avatar.grande', icono('persona')));
      vista.replaceChildren(av, btnFoto);
    };
    pintarVista(null);

    archivo.onchange = async () => {
      const f = archivo.files[0];
      if (!f) return;
      try {
        const { img, url } = await leerImagen(f);
        fotoNueva = await achicar(img, 400, 0.82, { recorteCuadrado: true });
        URL.revokeObjectURL(url);
        pintarVista(URL.createObjectURL(fotoNueva.blob));
      } catch (e) {
        aviso(mensajeError(e), 'error');
      }
    };

    const form = h('form', { style: 'display:grid;gap:16px' },
      vista, archivo,
      h('label.campo', h('span', 'Nombre'), nombre),
      h('label.campo', h('span', 'Apellido'), apellido),
      j ? null : h('label', { style: 'display:flex;gap:12px;align-items:center;font-weight:700;color:var(--azul)' }, casillaMia, 'Es mi hija'),
      boton);

    const v = hoja(j ? 'Editar jugadora' : 'Agregar jugadora', form, { alCerrar: () => resolver(guardada) });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const datos = { nombre: nombre.value.trim(), apellido: apellido.value.trim() };
      if (!datos.nombre || !datos.apellido) return aviso('Completá nombre y apellido.', 'error');

      if (!j) {
        const parecida = estado.jugadoras.find((x) => sinAcentos(x.nombre + x.apellido) === sinAcentos(datos.nombre + datos.apellido));
        if (parecida && !(await confirmar('¿Ya está cargada?', `Ya hay una jugadora llamada ${parecida.nombre} ${parecida.apellido}. ¿Querés agregarla igual?`, { si: 'Agregar igual' }))) return;
      }

      const listo = cargandoEn(boton, 'Guardando…');
      try {
        let id = j && j.id;
        if (!j) {
          const { data, error } = await sb.from('jugadoras').insert({ ...datos, creado_por: estado.yo.id }).select('id').single();
          if (error) throw error;
          id = data.id;
          if (casillaMia.checked) {
            const r = await sb.from('familia').insert({ perfil_id: estado.yo.id, jugadora_id: id });
            if (r.error) throw r.error;
          }
        }
        const cambios = { ...datos };
        if (fotoNueva) {
          const ruta = `jugadoras/${id}-${Date.now().toString(36)}.jpg`;
          const sube = await sb.storage.from('miniaturas').upload(ruta, fotoNueva.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
          if (sube.error) throw sube.error;
          cambios.foto_path = ruta;
        }
        const { error } = await sb.from('jugadoras').update(cambios).eq('id', id);
        if (error) throw error;

        await cargarJugadoras();
        guardada = estado.jugadoraPorId.get(id);
        v.cerrar();
        aviso(j ? 'Cambios guardados.' : `¡${datos.nombre} ya está en el equipo!`, 'bien');
        if (alGuardar) alGuardar(guardada);
        else refrescarPantalla();
      } catch (err) {
        listo();
        aviso(mensajeError(err, 'No se pudo guardar.'), 'error');
      }
    };
  });
}

// ---------- Bienvenida: elegir a tu hija ----------
export async function pantallaBienvenida() {
  const yo = estado.yo;
  const elegidas = new Set(misHijas().map((j) => j.id));
  const lista = h('div');
  const buscador = h('input.entrada', { type: 'search', placeholder: 'Buscar por nombre', 'aria-label': 'Buscar jugadora' });

  function terminar() {
    try { localStorage.setItem('tordos-bienvenida-' + yo.id, '1'); } catch { /* */ }
    irA('inicio');
  }

  function pintarLista() {
    const t = sinAcentos(buscador.value);
    const js = estado.jugadoras
      .filter((j) => !t || sinAcentos(j.nombre + ' ' + j.apellido).includes(t))
      .sort((a, b) => sinAcentos(a.nombre).localeCompare(sinAcentos(b.nombre)));
    lista.replaceChildren(js.length
      ? h('div.elegir-chicas', js.map((j) => h('button.elegir-chica', { type: 'button', 'aria-pressed': elegidas.has(j.id), onclick: (e) => {
        if (elegidas.has(j.id)) elegidas.delete(j.id); else elegidas.add(j.id);
        e.currentTarget.setAttribute('aria-pressed', elegidas.has(j.id));
      } }, avatarJugadora(j), `${j.nombre} ${j.apellido}`)))
      : h('p.suave', estado.jugadoras.length ? 'No encontramos ese nombre.' : 'Todavía no hay ninguna jugadora cargada. ¡Agregá a tu hija!'));
  }
  buscador.oninput = pintarLista;
  pintarLista();

  const guardar = h('button.btn.btn-rojo.btn-bloque', { type: 'button' }, 'Listo, entrar');
  guardar.onclick = async () => {
    const actuales = new Set(misHijas().map((j) => j.id));
    const nuevas = [...elegidas].filter((id) => !actuales.has(id));
    if (nuevas.length) {
      const listo = cargandoEn(guardar, 'Guardando…');
      const { error } = await sb.from('familia').insert(nuevas.map((jugadora_id) => ({ perfil_id: yo.id, jugadora_id })));
      if (error) { listo(); return aviso(mensajeError(error), 'error'); }
      await cargarJugadoras();
    }
    terminar();
  };

  return [
    h('div', h('h1', `¡Bienvenid${yo.rol === 'mamá' ? 'a' : 'o'}, ${yo.nombre}!`),
      h('p.suave', { style: 'margin-top:6px' }, 'Antes de empezar, contanos quién es tu hija. Si la otra mamá o papá ya la cargó, tocala en la lista.')),
    h('section.tarjeta',
      h('h2', '¿Ya está en la lista?'),
      estado.jugadoras.length > 8 ? buscador : null,
      lista),
    h('button.btn.btn-celeste.btn-bloque', { type: 'button', onclick: async () => {
      const nueva = await editarJugadora(null, { esMia: true, alGuardar: () => {} });
      if (nueva) { elegidas.add(nueva.id); pintarLista(); }
    } }, icono('mas'), 'Mi hija no está: agregarla'),
    guardar,
    h('button.btn.btn-texto', { type: 'button', onclick: terminar }, 'Lo hago después'),
  ];
}

