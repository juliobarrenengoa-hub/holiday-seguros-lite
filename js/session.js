/**
 * Gestión de sesión — token en sessionStorage.
 */
var session = (function () {
  var KEY_TOKEN = 'hsl_token';
  var KEY_USER = 'hsl_usuario';

  function save(token, usuario) {
    sessionStorage.setItem(KEY_TOKEN, token || '');
    sessionStorage.setItem(KEY_USER, usuario || '');
  }

  function token() {
    return sessionStorage.getItem(KEY_TOKEN) || '';
  }

  function usuario() {
    return sessionStorage.getItem(KEY_USER) || '';
  }

  function clear() {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USER);
  }

  function isActive() {
    return !!token();
  }

  return { save: save, token: token, usuario: usuario, clear: clear, isActive: isActive };
})();
