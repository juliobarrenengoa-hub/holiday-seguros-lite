# GUÍA DE REFERENCIA — Holiday Seguros Lite

---

## 1. ¿Dónde está guardada la aplicación?

La aplicación vive en **dos sitios a la vez**:

### En tu Mac (código fuente)
```
/Users/barrenengoa/Sites/holiday-seguros-lite/
```
Estructura de archivos:
```
holiday-seguros-lite/
├── index.html              ← Toda la pantalla (HTML)
├── css/app.css             ← Estilos visuales
├── js/
│   ├── app.js              ← Lógica principal de la SPA
│   ├── api.js              ← Comunicación con el backend
│   ├── session.js          ← Gestión de sesión/token
│   └── utils.js            ← Funciones auxiliares
├── apps-script/
│   └── Código.gs           ← Backend (se copia a Google Apps Script)
├── img/                    ← Iconos de la app (PNG)
├── manifest.json           ← Configuración PWA (icono móvil)
└── sw.js                   ← Service Worker (funcionamiento offline)
```

### En Internet (publicado)
- **URL pública**: `https://juliobarrenengoa-hub.github.io/holiday-seguros-lite/`
- **Repositorio GitHub**: `https://github.com/juliobarrenengoa-hub/holiday-seguros-lite`
- La publicación es automática: cada vez que guardas cambios en GitHub, la web se actualiza sola (GitHub Pages).

### El backend (datos y lógica del servidor)
- **Google Apps Script**: `https://script.google.com` → proyecto Holiday Seguros Lite
- **Google Sheets (pólizas)**: ID `1RQqu-cvNfY6AzhJb-o33BAxNpTDZaUxVYWamfp63mU0`
- **Google Sheets (usuarios)**: ID `1ydE0Ks4rew8RLf6IRqu8DPGMBZmOJd64fkqqLj80AOU`
- **Google Drive (documentos)**: carpeta ID `1ND3i3RwSWL2uA92KQiad94K_EQdTEwxG`

---

## 2. Copia de seguridad

### Opción A — La más fácil (ya está hecha automáticamente)
El repositorio GitHub **es tu copia de seguridad**. Cada vez que haces `git push`, GitHub guarda una copia con historial completo. Puedes recuperar cualquier versión anterior.

Para descargar una copia completa del código en cualquier momento:
1. Ve a `https://github.com/juliobarrenengoa-hub/holiday-seguros-lite`
2. Botón verde **Code** → **Download ZIP**

### Opción B — Copia local del Mac
Simplemente copia la carpeta entera a otro lugar:
```bash
cp -r /Users/barrenengoa/Sites/holiday-seguros-lite ~/Desktop/backup-hsl-$(date +%Y%m%d)
```

### Copia de seguridad de los datos (Google Sheets)
Los datos (pólizas, usuarios) están en Google Sheets. Para exportarlos:
1. Abre el Sheet de pólizas en `docs.google.com`
2. **Archivo → Descargar → Microsoft Excel (.xlsx)**

---

## 3. Volver a trabajar con la aplicación

### Desde VS Code

1. **Abrir el proyecto**
   ```
   File → Open Folder → /Users/barrenengoa/Sites/holiday-seguros-lite
   ```
   O desde Terminal:
   ```bash
   code /Users/barrenengoa/Sites/holiday-seguros-lite
   ```

2. **Arrancar servidor local** (para ver la app en el navegador mientras editas)
   En la Terminal de VS Code:
   ```bash
   cd /Users/barrenengoa/Sites/holiday-seguros-lite
   bash serve.sh
   ```
   Luego abre `http://localhost:8095` en el navegador.

3. **Guardar cambios en GitHub** (para publicar)
   En el Terminal de VS Code:
   ```bash
   git add -A
   git commit -m "Descripción del cambio"
   git push
   ```
   En 1-2 minutos la URL pública se actualiza.

4. **Actualizar el backend** (Apps Script)
   Si modificas `apps-script/Código.gs`, hay que copiarlo manualmente a `https://script.google.com` y redesplegar (ver punto 5 más abajo).

---

### Desde Claude Code

1. **Arrancar Claude Code** en la carpeta del proyecto:
   ```bash
   cd /Users/barrenengoa/Sites/holiday-seguros-lite
   claude
   ```

2. **Describir los cambios** que quieres hacer en lenguaje natural. Claude Code lee todos los archivos del proyecto y aplica los cambios directamente.

3. **Los cambios se guardan** automáticamente en los archivos del Mac. Para publicarlos en Internet:
   ```bash
   git push
   ```
   (Claude Code normalmente hace el `git add` y `git commit` solo, pero el `push` debes confirmarlo tú o pedírselo explícitamente).

4. **Contexto de sesión**: Si llevas mucho tiempo sin usar Claude Code en este proyecto, al empezar una sesión nueva dile:
   > *"Continúa el desarrollo de Holiday Seguros Lite. Es una SPA en `/Users/barrenengoa/Sites/holiday-seguros-lite` con backend en Google Apps Script."*

---

## 4. Pasar la aplicación a otros usuarios

Los usuarios **no necesitan instalar nada**. Solo necesitan la URL:

```
https://juliobarrenengoa-hub.github.io/holiday-seguros-lite/
```

### Para darles acceso:
1. **Crear su usuario** en el Google Sheet de seguridad:
   - Abre: `https://docs.google.com/spreadsheets/d/1ydE0Ks4rew8RLf6IRqu8DPGMBZmOJd64fkqqLj80AOU`
   - Hoja **USUARIOS**
   - Añade una fila con: `USERNAME | EMAIL | (dejar vacío) | Activo | SI | NO`
   - Para establecer la contraseña inicial, usa la función `adminResetPassword` desde el editor de Apps Script:
     ```javascript
     adminResetPassword('NombreUsuario', 'contraseñaInicial')
     ```
     (Menú **Ejecutar** → selecciona la función → ejecutar)

2. **Enviarles** la URL + su usuario + contraseña provisional.

3. En el primer login, la app les pedirá que cambien la contraseña provisional.

---

## 5. Actualizar el backend (Apps Script) — paso a paso

Cada vez que se modifica `apps-script/Código.gs` en el Mac, hay que subirlo a Google:

1. Abre el archivo local en cualquier editor de texto y copia todo el contenido (`Cmd+A` → `Cmd+C`)
2. Ve a `https://script.google.com` → abre el proyecto **Holiday Seguros Lite**
3. Selecciona todo el código actual del editor (`Cmd+A`) → pégalo (`Cmd+V`)
4. Guarda (`Cmd+S`)
5. Haz clic en **Implementar** → **Administrar implementaciones**
6. En la implementación existente, haz clic en el **lápiz ✏️** → selecciona **Nueva versión** → **Implementar**

---

## 6. Instalar la app en el móvil (icono en la pantalla de inicio)

La aplicación ya está configurada como **PWA (Progressive Web App)**, lo que permite instalarla como si fuera una app nativa.

### En iPhone / iPad (Safari)
1. Abre Safari y ve a: `https://juliobarrenengoa-hub.github.io/holiday-seguros-lite/`
2. Pulsa el botón de **Compartir** (el cuadrado con la flecha hacia arriba)
3. Desplázate y pulsa **"Añadir a la pantalla de inicio"**
4. Ponle el nombre que quieras → **Añadir**
5. Aparecerá un icono en la pantalla de inicio. Al abrirlo, funciona a pantalla completa sin barra del navegador.

### En Android (Chrome)
1. Abre Chrome y ve a la URL
2. Chrome mostrará automáticamente un banner **"Añadir a pantalla de inicio"** (o pulsa los tres puntos → **"Instalar app"**)
3. Acepta → el icono aparece en la pantalla de inicio

### En ordenador (Chrome / Edge)
1. Ve a la URL
2. En la barra de direcciones aparece un icono de instalación (⊕ o pantalla con flecha)
3. Haz clic → **Instalar**
4. Se abre como ventana independiente sin navegador

---

## Resumen rápido

| ¿Qué necesito? | ¿Dónde? |
|---|---|
| Editar código | `/Users/barrenengoa/Sites/holiday-seguros-lite/` |
| Ver la app en local | `http://localhost:8095` (tras ejecutar `bash serve.sh`) |
| App pública | `https://juliobarrenengoa-hub.github.io/holiday-seguros-lite/` |
| Código en GitHub | `https://github.com/juliobarrenengoa-hub/holiday-seguros-lite` |
| Backend (Apps Script) | `https://script.google.com` |
| Datos pólizas | Google Sheets ID `1RQqu-cvNfY6AzhJb-o33BAxNpTDZaUxVYWamfp63mU0` |
| Datos usuarios | Google Sheets ID `1ydE0Ks4rew8RLf6IRqu8DPGMBZmOJd64fkqqLj80AOU` |
| Publicar cambios | `git push` desde Terminal |

---

## 7. Actualizar la app en los dispositivos de los usuarios

**No tienes que hacer nada en los dispositivos de los usuarios.** La actualización es automática:

1. Haces `git push` en tu Mac → GitHub Pages actualiza la URL pública en 1-2 minutos.
2. La próxima vez que el usuario abra la app (desde el navegador o desde el icono instalado), el navegador detecta la nueva versión y la descarga en segundo plano.
3. Al cerrar y volver a abrir la app, ya tienen la versión actualizada.

### Si un usuario sigue viendo la versión antigua
Basta con que cierre completamente la app y la vuelva a abrir. Si persiste:
- **Móvil**: mantener pulsado el icono → cerrar → volver a abrir
- **Ordenador**: cerrar la ventana de la app → volver a abrirla desde el icono del escritorio
- **Navegador**: `Ctrl+Shift+R` (Windows) o `Cmd+Shift+R` (Mac) para forzar recarga sin caché

### Importante: el backend (Apps Script) es independiente
Si el cambio afecta al backend (`Código.gs`), además del `git push` debes redesplegar el Apps Script (ver punto 5). Ese cambio también es instantáneo para todos los usuarios una vez desplegado.
