// GET /api/salud
// Página de control: dice si la configuración está completa y si Drive y Supabase responden.
// No muestra ninguna llave, solo "ok" o el problema.
import { json, faltantes, supabase, tokenGoogle, carpeta, CARPETA_RAIZ, limpiarEnv } from '../../lib/servidor.js';

export async function onRequestGet({ env: envOriginal }) {
  const env = limpiarEnv(envOriginal);
  const resultado = { variables: 'ok', supabase: 'sin probar', drive: 'sin probar' };

  const falta = faltantes(env, false);
  if (falta.length) {
    resultado.variables = 'Faltan: ' + falta.join(', ');
    return json(resultado);
  }

  try {
    await supabase(env, '/rest/v1/configuracion?select=id&limit=1');
    resultado.supabase = 'ok';
  } catch (e) {
    resultado.supabase = 'Error: ' + e.message;
  }

  try {
    await tokenGoogle(env);
    await carpeta(env, 'root', CARPETA_RAIZ);
    resultado.drive = 'ok (carpeta "' + CARPETA_RAIZ + '" lista)';
  } catch (e) {
    resultado.drive = 'Error: ' + e.message;
  }

  return json(resultado);
}
