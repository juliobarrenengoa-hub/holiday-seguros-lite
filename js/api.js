/**
 * API Client — comunica la SPA con el backend Apps Script.
 * Todas las llamadas pasan por api.call() que gestiona el redirect de Apps Script.
 */
var api = (function () {
  // URL del deploy de Apps Script — hardcodeada en producción.
  // Se puede sobreescribir via localStorage('hsl_api_url') para desarrollo.
  var BASE_URL = 'https://script.google.com/macros/s/AKfycbwS2741OEpJfaM8pbcNcvC8m5SRdmk_GprWPRqwJOhxrjUGHFktu6ykcwO-AbAM0i_R/exec';

  // URL del deployment con access:ANYONE para el popup de Google login
  var GOOGLE_AUTH_URL = 'https://script.google.com/macros/s/AKfycbw31-C2X7Rw2qmr6V6zk_OW_CQJDA2eyrVqCloykwLprSOI5dGjdstoNxb3m5XVNVTh/exec?action=googleAuth';

  function setBaseUrl(url) {
    BASE_URL = url.replace(/\/+$/, '');
  }

  function getBaseUrl() {
    return BASE_URL;
  }

  function getGoogleAuthUrl() {
    return GOOGLE_AUTH_URL;
  }

  function call(action, body) {
    if (!BASE_URL) return Promise.reject(new Error('API no configurada. Establece la URL del deploy.'));

    var url = BASE_URL + '?action=' + encodeURIComponent(action);

    return fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ data: JSON.stringify(body || {}) }),
      redirect: 'follow'
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        if (text.indexOf('<!DOCTYPE') !== -1 || text.indexOf('<html') !== -1) {
          throw new Error('La API devolvió HTML en lugar de JSON. Verifica el deploy de Apps Script.');
        }
        throw new Error('Respuesta no válida del servidor.');
      }
    });
  }

  function login(usuario, password, extra) {
    return call('login', { usuario: usuario, password: password, extra: extra || _browserInfo() });
  }

  function loginGoogle(extra) {
    return call('loginGoogle', { extra: extra || _browserInfo() });
  }

  function cambiarPassword(token, nueva, repetir) {
    return call('cambiarPassword', { token: token, nueva: nueva, repetir: repetir });
  }

  function checkSession(token) {
    return call('checkSession', { token: token });
  }

  function logout(token) {
    return call('logout', { token: token });
  }

  function buscar(token, valor) {
    return call('buscar', { token: token, valor: valor });
  }

  function registros(token) {
    return call('registros', { token: token });
  }

  function guardarPoliza(token, datos, archivos, fila) {
    return call('guardarPoliza', { token: token, datos: datos, archivos: archivos || [], fila: fila || 0 });
  }

  function eliminarPoliza(token, fila) {
    return call('eliminarPoliza', { token: token, fila: fila });
  }

  function catalogos(token) {
    return call('catalogos', { token: token });
  }

  function guardarCatalogo(token, tipo, nombre) {
    return call('guardarCatalogo', { token: token, tipo: tipo, nombre: nombre });
  }

  function bajaCatalogo(token, tipo, id) {
    return call('bajaCatalogo', { token: token, tipo: tipo, id: id });
  }

  function poblarCatalogosPorDefecto(token) {
    return call('poblarCatalogosPorDefecto', { token: token });
  }

  function listarAgentes(token) {
    return call('listarAgentes', { token: token });
  }

  function dashboard(token, agente) {
    return call('dashboard', { token: token, agente: agente || '' });
  }

  function listarArchivos(token, urlDrive) {
    return call('listarArchivos', { token: token, urlDrive: urlDrive });
  }

  function subirArchivos(token, urlDrive, archivos) {
    return call('subirArchivos', { token: token, urlDrive: urlDrive, archivos: archivos });
  }

  function eliminarArchivo(token, urlDrive, fileId) {
    return call('eliminarArchivo', { token: token, urlDrive: urlDrive, fileId: fileId });
  }

  function _browserInfo() {
    var ua = navigator.userAgent || '';
    return {
      user_agent: ua,
      dispositivo: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Móvil' : 'Ordenador',
      navegador: /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : 'Otro',
      sistema_operativo: /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : 'Otro',
      idioma: navigator.language || '',
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    };
  }

  return {
    setBaseUrl: setBaseUrl,
    getBaseUrl: getBaseUrl,
    getGoogleAuthUrl: getGoogleAuthUrl,
    call: call,
    login: login,
    loginGoogle: loginGoogle,
    cambiarPassword: cambiarPassword,
    checkSession: checkSession,
    logout: logout,
    buscar: buscar,
    registros: registros,
    guardarPoliza: guardarPoliza,
    eliminarPoliza: eliminarPoliza,
    catalogos: catalogos,
    guardarCatalogo: guardarCatalogo,
    bajaCatalogo: bajaCatalogo,
    poblarCatalogosPorDefecto: poblarCatalogosPorDefecto,
    dashboard: dashboard,
    listarAgentes: listarAgentes,
    listarArchivos: listarArchivos,
    subirArchivos: subirArchivos,
    eliminarArchivo: eliminarArchivo
  };
})();
