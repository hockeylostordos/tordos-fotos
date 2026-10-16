# Los Tordos · Fotos de Hockey Femenino

App privada para que las familias suban y vean las fotos de las chicas.

- **Supabase**: login, datos, etiquetas y miniaturas.
- **Google Drive** (hockeylostordos@gmail.com): fotos en tamaño completo, en la carpeta
  `Fotos Los Tordos (app) / AÑO / MES`.
- **Cloudflare Pages**: aloja la app y hace de puente seguro con Drive.
- **GitHub**: guarda el código. El "despertador" de Supabase corre acá cada 2 días.

## Qué hay en cada carpeta

| Carpeta | Para qué |
|---|---|
| `public/` | La app que ven los papás (pantallas, estilos, íconos) |
| `public/js/config.js` | URL y llave pública de Supabase |
| `functions/api/` | Funciones del servidor: registro con código, subir a Drive, ver/descargar fotos, admin |
| `lib/servidor.js` | Conexión con Drive y Supabase usando las llaves secretas |
| `supabase/` | Scripts SQL de la base de datos (01 ya corrido, 02 correr una vez) |
| `.github/workflows/` | Despertador automático de Supabase |

## Configuración de Cloudflare Pages

- Framework preset: **None**
- Build command: *(vacío)*
- Build output directory: **public**

Variables (Settings → Variables and Secrets), todas como **Secret**:

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_URL` | `https://soghigxnqtuoouvbekde.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → Legacy → anon |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API Keys → Legacy → service_role |
| `GOOGLE_CLIENT_ID` | Google Cloud → Clientes OAuth |
| `GOOGLE_CLIENT_SECRET` | Google Cloud → Clientes OAuth |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground |

Para comprobar que todo está bien conectado: abrir `https://TU-APP.pages.dev/api/salud`.
Tiene que decir `ok` en las tres líneas.

## Detalles útiles

- La primera persona que se registra queda como **administrador**.
- Las cuentas se crean ya confirmadas: no se manda mail de verificación.
- Las fotos se achican a 2048 px de lado (unos 0,5 a 1 MB) antes de subirlas.
- Borrar una foto la manda a la papelera; solo un admin la borra para siempre.
