/**
 * HOLIDAY SEGUROS LITE — App principal
 * Controla todas las vistas, navegación y lógica de la SPA.
 */
(function () {
  var $ = utils.$;
  var escapeHtml = utils.escapeHtml;

  // ─── Columnas disponibles en gestión ────────────────────────────────────

  // Orden canónico = orden de columnas en DATOS_POLIZAS del GSheet.
  // Este array es la fuente de verdad para el panel de selección y el orden por defecto.
  var TODAS_COLUMNAS = [
    { key: 'fecha_alta',      label: 'Fecha alta',    defaultOn: false },
    { key: 'agente',          label: 'Agente',        defaultOn: false },
    { key: 'tipo',            label: 'Tipo',          defaultOn: false },
    { key: 'dni_cif',         label: 'DNI/CIF',       defaultOn: true  },
    { key: 'nombre_completo', label: 'Nombre',        defaultOn: true  },
    { key: 'telefono',        label: 'Teléfono',      defaultOn: false },
    { key: 'email',           label: 'Email',         defaultOn: false },
    { key: 'domicilio',       label: 'Domicilio',     defaultOn: false },
    { key: 'numero',          label: 'Número',        defaultOn: false },
    { key: 'poblacion',       label: 'Población',     defaultOn: false },
    { key: 'cp',              label: 'C.P.',          defaultOn: false },
    { key: 'provincia',       label: 'Provincia',     defaultOn: false },
    { key: 'n_poliza',        label: 'Nº Póliza',     defaultOn: true  },
    { key: 'f_pol',           label: 'F. póliza',     defaultOn: false },
    { key: 'ramo',            label: 'Ramo',          defaultOn: true  },
    { key: 'cia',             label: 'Compañía',      defaultOn: true  },
    { key: 'matricula',       label: 'Matrícula',     defaultOn: true  },
    { key: 'prima',           label: 'Prima',         defaultOn: true,  align: 'right', numeric: true },
    { key: 'c_corredor',      label: 'Com. corredor', defaultOn: false, align: 'right', numeric: true },
    { key: 'c_agente',        label: 'Com. agente',   defaultOn: false, align: 'right', numeric: true },
    { key: 'vencimiento',     label: 'Vencimiento',   defaultOn: true  }
  ];

  // ─── State ──────────────────────────────────────────────────────────────

  var gestionData = [];
  var gestionPagina = 1;
  var gestionPorPagina = 25;
  var gestionFiltros = [];
  var gestionBusqueda = '';
  var gestionColsVisible = null;          // array de keys en orden de visualización
  var gestionSort = { key: null, dir: 0 }; // dir: 0=sin orden, 1=asc, -1=desc
  var gestionFiltrosFecha = [];           // [{campo, label, desde, hasta}]
  var searchTimer = null;
  var gestionSearchTimer = null;
  var polizaActual = null;

  // ── Documentos inline ──────────────────────────────────────────────────
  var docsUrlDrive = '';            // URL carpeta Drive del registro activo
  var docsStagedFiles = [];         // File[] pendientes solo en alta nueva
  var docsArchivosEnDrive = [];     // [{id,nombre,url,mimeType}] del Drive

  // ─── Validaciones y auto-formato ────────────────────────────────────────

  /**
   * Matrícula española: 4 dígitos + espacio + 3 letras (mayúsculas).
   * Acepta "1234abc", "1234 abc", "1234ABC" → convierte a "1234 ABC".
   */
  window.autoFormatMatricula = function (input) {
    var val = input.value.trim().replace(/\s+/g, '');
    if (!val) return;
    var m = val.match(/^(\d{4})([A-Za-z]{3})$/);
    if (m) input.value = m[1] + ' ' + m[2].toUpperCase();
  };

  /**
   * Vencimiento: rellena con la fecha póliza + 1 año.
   * Si el campo vencimiento ya tiene valor no lo sobreescribe (permite cambio manual).
   */
  window.autoVencimiento = function () {
    var fechaPol = $('f-fecha-pol').value;
    if (!fechaPol) return;
    var vencEl = $('f-vencimiento');
    // Auto-rellena solo si vencimiento está vacío
    if (vencEl.value) return;
    var d = new Date(fechaPol + 'T00:00:00');
    d.setFullYear(d.getFullYear() + 1);
    vencEl.value = d.toISOString().slice(0, 10);
  };

  /**
   * Importe en euros: acepta "1500", "1500.5", "1500,50", "1.500,50" → "1.500,00 €".
   * Vacío se deja vacío. No sobreescribe si ya está formateado.
   */
  window.autoFormatMoneda = function (input) {
    var raw = input.value.trim().replace(/€/g, '').replace(/\s/g, '');
    if (!raw) return;
    // Detectar si usa coma como decimal ("1.500,50") o punto ("1500.50")
    var num;
    if (raw.indexOf(',') !== -1) {
      // Formato español: quitar puntos de miles y convertir coma a punto
      num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    } else {
      num = parseFloat(raw);
    }
    if (isNaN(num) || !isFinite(num)) return;
    // Formatear como "1.500,00 €"
    var partes = num.toFixed(2).split('.');
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = entero + ',' + partes[1] + ' €';
  };

  /**
   * Convierte "1.500,00 €" (o variantes) → float.
   * Devuelve 0 si el valor no es numérico.
   */
  function _parseMoneda(val) {
    if (!val) return 0;
    var s = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Convierte un número float → "1.500,00 €".
   */
  function _formatMonedaNum(num) {
    var partes = num.toFixed(2).split('.');
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return entero + ',' + partes[1] + ' €';
  }

  // ─── Init ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initConfigCheck();
    // Conectar el input de archivos del formulario con el gestor inline
    var fArchivos = $('f-archivos');
    if (fArchivos) {
      fArchivos.addEventListener('change', function () {
        docsHandleFiles(this.files);
        this.value = '';
      });
    }
  });

  function initConfigCheck() {
    // Si hay una URL guardada en localStorage (modo dev), tiene prioridad
    var savedUrl = localStorage.getItem('hsl_api_url') || '';
    if (savedUrl) {
      api.setBaseUrl(savedUrl);
    }
    // api.js ya tiene la URL hardcodeada como valor por defecto,
    // así que getBaseUrl() nunca estará vacío en producción.

    if (session.isActive()) {
      api.checkSession(session.token()).then(function (res) {
        if (res.success) {
          showApp();
        } else {
          session.clear();
          showLogin();
        }
      }).catch(function () {
        showLogin();
      });
    } else {
      showLogin();
    }
  }

  // ─── Config ─────────────────────────────────────────────────────────────

  function showConfig() {
    hideAll();
    utils.show('view-config');
    var input = $('config-url');
    if (input) input.value = api.getBaseUrl() || '';
  }

  window.saveConfig = function () {
    var url = ($('config-url').value || '').trim();
    if (!url) {
      utils.setMsg('config-msg', 'Introduce la URL del deploy de Apps Script.', 'error');
      return;
    }
    localStorage.setItem('hsl_api_url', url);
    api.setBaseUrl(url);
    utils.setMsg('config-msg', 'Guardado. Verificando conexión...', 'ok');

    api.call('checkSession', { token: '' }).then(function () {
      showLogin();
    }).catch(function (err) {
      utils.setMsg('config-msg', 'Error de conexión: ' + err.message, 'error');
    });
  };

  // ─── Login ──────────────────────────────────────────────────────────────

  function showLogin() {
    hideAll();
    utils.show('view-login');
    var u = $('login-user');
    if (u) u.focus();
  }

  window.doLogin = function () {
    var user = $('login-user').value.trim();
    var pass = $('login-pass').value;
    if (!user || !pass) {
      utils.setMsg('login-msg', 'Introduce usuario y contraseña.', 'error');
      return;
    }

    setBtnProcessing('btn-login', 'Validando...');
    api.login(user, pass).then(function (res) {
      restoreBtn('btn-login');
      if (!res.success) {
        utils.setMsg('login-msg', res.msg || 'Acceso denegado.', 'error');
        return;
      }
      session.save(res.token, res.nombre);
      if (res.cambioPassword) {
        showCambioPassword();
      } else {
        showApp();
      }
    }).catch(function (err) {
      restoreBtn('btn-login');
      utils.setMsg('login-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.exitApp = function () {
    window.close();
    // Fallback si el navegador no permite cerrar la pestaña
    setTimeout(function () {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;font-family:sans-serif;color:#607d8b;">'
        + '<span style="font-size:2.5rem">✓</span>'
        + '<p style="margin:0;font-size:1rem">Puedes cerrar esta pestaña.</p>'
        + '</div>';
    }, 300);
  };

  window.toggleLoginPass = function () {
    var input = $('login-pass');
    var icon = $('login-eye');
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '🙈';
    } else {
      input.type = 'password';
      icon.textContent = '👁️';
    }
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      if (!$('view-login').classList.contains('hidden')) {
        doLogin();
      } else if (!$('view-cambio-pass').classList.contains('hidden')) {
        doCambioPassword();
      }
    }
  });

  // ─── Cambio password ───────────────────────────────────────────────────

  function showCambioPassword() {
    hideAll();
    utils.show('view-cambio-pass');
  }

  window.doCambioPassword = function () {
    var p1 = $('new-pass').value;
    var p2 = $('repeat-pass').value;
    if (!p1 || !p2) { utils.setMsg('cambio-msg', 'Introduce y repite la contraseña.', 'error'); return; }
    if (p1 !== p2) { utils.setMsg('cambio-msg', 'Las contraseñas no coinciden.', 'error'); return; }

    setBtnProcessing('btn-cambio', 'Guardando...');
    api.cambiarPassword(session.token(), p1, p2).then(function (res) {
      restoreBtn('btn-cambio');
      if (res.success) {
        utils.setMsg('cambio-msg', 'Contraseña actualizada. Entrando...', 'ok');
        setTimeout(showApp, 800);
      } else {
        utils.setMsg('cambio-msg', res.msg || 'Error.', 'error');
      }
    }).catch(function (err) {
      restoreBtn('btn-cambio');
      utils.setMsg('cambio-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.cancelCambio = function () {
    session.clear();
    showLogin();
  };

  // ─── App principal ────────────────────────────────────────────────────

  function showApp() {
    hideAll();
    utils.show('app-shell');
    $('nav-user').textContent = '👤 ' + session.usuario();
    navigateTo('inicio');
  }

  // ─── User dropdown ────────────────────────────────────────────────────

  window.toggleUserMenu = function () {
    $('user-dropdown').classList.toggle('hidden');
  };

  document.addEventListener('click', function (e) {
    var wrap = $('user-menu-wrap');
    var dd = $('user-dropdown');
    if (dd && wrap && !wrap.contains(e.target)) {
      dd.classList.add('hidden');
    }
  });

  // ─── Modal: cambio password desde la app ─────────────────────────────

  window.openCambioPasswordApp = function () {
    $('user-dropdown').classList.add('hidden');
    $('modal-new-pass').value = '';
    $('modal-repeat-pass').value = '';
    utils.setMsg('modal-cambio-msg', '', '');
    $('modal-cambio-pass').classList.remove('hidden');
    setTimeout(function () { $('modal-new-pass').focus(); }, 50);
  };

  window.closeModalCambioPassword = function () {
    $('modal-cambio-pass').classList.add('hidden');
  };

  window.doModalCambioPassword = function () {
    var p1 = $('modal-new-pass').value;
    var p2 = $('modal-repeat-pass').value;
    if (!p1 || !p2) { utils.setMsg('modal-cambio-msg', 'Introduce y repite la contraseña.', 'error'); return; }
    if (p1 !== p2) { utils.setMsg('modal-cambio-msg', 'Las contraseñas no coinciden.', 'error'); return; }

    setBtnProcessing('btn-modal-cambio', 'Guardando...');
    api.cambiarPassword(session.token(), p1, p2).then(function (res) {
      restoreBtn('btn-modal-cambio');
      if (res.success) {
        utils.setMsg('modal-cambio-msg', '✓ Contraseña actualizada correctamente.', 'ok');
        setTimeout(closeModalCambioPassword, 1400);
      } else {
        utils.setMsg('modal-cambio-msg', res.msg || 'Error al guardar.', 'error');
      }
    }).catch(function (err) {
      restoreBtn('btn-modal-cambio');
      utils.setMsg('modal-cambio-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.toggleModalPass = function (inputId, btn) {
    var input = $(inputId);
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  };

  function hideAll() {
    ['view-config', 'view-login', 'view-cambio-pass', 'app-shell'].forEach(function (id) {
      utils.hide(id);
    });
  }

  window.navigateTo = function (view) {
    var views = document.querySelectorAll('.app-view');
    views.forEach(function (v) { v.classList.remove('active'); });
    var target = $('view-' + view);
    if (target) target.classList.add('active');

    var links = document.querySelectorAll('.nav-links button');
    links.forEach(function (b) { b.classList.remove('active'); });
    var activeBtn = document.querySelector('.nav-links button[data-view="' + view + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    closeMobileMenu();

    if (view === 'inicio') initInicio();
    if (view === 'dashboard') initDashboard();
    if (view === 'gestion') initGestion();
    if (view === 'catalogo') initCatalogo();
  };

  window.doLogout = function () {
    api.logout(session.token());
    session.clear();
    // Limpiar estado en memoria para que el próximo login cargue su propia config
    gestionColsVisible = null;
    gestionSort = { key: null, dir: 0 };
    gestionData = [];
    showLogin();
  };

  window.toggleMobileMenu = function () {
    var links = document.querySelector('.nav-links');
    if (links) links.classList.toggle('open');
  };

  function closeMobileMenu() {
    var links = document.querySelector('.nav-links');
    if (links) links.classList.remove('open');
  }

  // ─── Inicio (búsqueda rápida + menú) ─────────────────────────────────

  function initInicio() {
    $('txt-buscar').value = '';
    $('tabla-resultados').innerHTML = '';
    utils.hide('resultados-inicio');
    $('search-status').textContent = '';
  }

  window.onSearchInput = function () {
    clearTimeout(searchTimer);
    var val = $('txt-buscar').value.trim();
    if (val.length < 3) {
      utils.hide('resultados-inicio');
      $('search-status').textContent = val.length > 0 ? 'Escribe al menos 3 caracteres...' : '';
      return;
    }
    $('search-status').textContent = 'Buscando...';
    searchTimer = setTimeout(function () { doBuscar(val); }, 400);
  };

  function doBuscar(valor) {
    api.buscar(session.token(), valor).then(function (res) {
      if (!res.success) {
        handleSessionError(res);
        return;
      }
      var items = res.resultados || [];
      $('search-status').textContent = items.length ? items.length + ' resultado(s)' : 'Sin resultados.';
      renderResultados(items);
    }).catch(function (err) {
      $('search-status').textContent = 'Error: ' + err.message;
    });
  }

  function renderResultados(items) {
    var tbody = $('tabla-resultados');
    tbody.innerHTML = '';
    if (!items.length) { utils.hide('resultados-inicio'); return; }

    utils.show('resultados-inicio');
    items.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'clickable';
      tr.innerHTML = '<td>' + escapeHtml(r.nombre_completo) + '</td>'
        + '<td>' + escapeHtml(r.dni_cif) + '</td>'
        + '<td>' + escapeHtml(r.n_poliza) + '</td>'
        + '<td>' + escapeHtml(r.ramo) + '</td>'
        + '<td>' + escapeHtml(r.cia) + '</td>'
        + '<td>' + escapeHtml(r.vencimiento) + '</td>';
      tr.addEventListener('click', function () { abrirFicha(r); });
      tbody.appendChild(tr);
    });
  }

  window.goAltaNueva = function () {
    polizaActual = null;
    navigateTo('formulario');
    initFormulario(null);
  };

  // ─── Formulario (alta/edición) ────────────────────────────────────────

  function abrirFicha(r) {
    polizaActual = r;
    navigateTo('formulario');
    initFormulario(r);
  }

  function initFormulario(r) {
    var form = $('formPoliza');
    form.reset();
    cargarSelectsCatalogo();

    $('form-title').textContent = r ? 'Editar póliza' : 'Nueva póliza';
    $('form-mode').textContent = r ? 'Editando registro existente' : 'Modo alta nueva';
    utils.setMsg('form-msg', '', '');

    if (r) {
      $('f-fila').value = r.fila || '';
      $('f-url-drive').value = r.url || '';
      $('f-tipo-cliente').value = r.tipo || 'Particular';
      $('f-dni').value = r.dni_cif || '';
      $('f-nombre').value = r.nombre || '';
      $('f-ape1').value = r.ape1 || '';
      $('f-ape2').value = r.ape2 || '';
      $('f-telefono').value = r.telefono || '';
      $('f-email').value = r.email || '';
      $('f-domicilio').value = r.domicilio || '';
      $('f-numero').value = r.numero || '';
      $('f-poblacion').value = r.poblacion || '';
      $('f-cp').value = r.cp || '';
      $('f-provincia').value = r.provincia || '';
      $('f-n-poliza').value = r.n_poliza || '';
      $('f-fecha-pol').value = r.f_pol || '';
      $('f-matricula').value = r.matricula || '';
      $('f-prima').value = r.prima || '';
      $('f-c-corredor').value = r.c_corredor || '';
      $('f-c-agente').value = r.c_agente || '';
      $('f-vencimiento').value = r.vencimiento || '';

      setTimeout(function () {
        if (r.ramo) $('f-ramo').value = r.ramo;
        if (r.cia) $('f-cia').value = r.cia;
      }, 300);

      utils.show('btn-baja');
      initDocsInline(r.url || '');
    } else {
      $('f-fila').value = '';
      $('f-url-drive').value = '';
      $('f-tipo-cliente').value = 'Particular';
      utils.hide('btn-baja');
      initDocsInline('');
    }
  }

  function cargarSelectsCatalogo() {
    api.catalogos(session.token()).then(function (res) {
      if (!res.success) return;
      renderSelect('f-ramo', res.ramos, '- Seleccionar ramo -');
      renderSelect('f-cia', res.cias, '- Seleccionar compañía -');
      if (polizaActual) {
        if (polizaActual.ramo) $('f-ramo').value = polizaActual.ramo;
        if (polizaActual.cia) $('f-cia').value = polizaActual.cia;
      }
    }).catch(function () {});
  }

  function renderSelect(id, items, placeholder) {
    var sel = $(id);
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>';
    (items || []).forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      sel.appendChild(opt);
    });
    if (current) {
      sel.value = current;
      if (!sel.value && current) {
        var opt2 = document.createElement('option');
        opt2.value = current;
        opt2.textContent = current;
        sel.appendChild(opt2);
        sel.value = current;
      }
    }
  }

  window.onCpChange = function () {
    var cp = $('f-cp').value.trim();
    if (cp.length >= 5) {
      var prov = utils.provinciaDesdeCp(cp);
      if (prov) $('f-provincia').value = prov;
    }
  };

  window.guardarPoliza = function () {
    var campos = ['f-dni', 'f-nombre', 'f-telefono', 'f-email', 'f-n-poliza', 'f-fecha-pol', 'f-ramo', 'f-cia', 'f-matricula', 'f-prima', 'f-vencimiento'];
    for (var i = 0; i < campos.length; i++) {
      if (!$(campos[i]).value.trim()) {
        utils.setMsg('form-msg', 'Completa todos los campos obligatorios.', 'error');
        $(campos[i]).focus();
        return;
      }
    }

    // Auto-formatear antes de validar (cubre el caso de no haber salido del campo)
    autoFormatMatricula($('f-matricula'));
    autoFormatMoneda($('f-prima'));
    autoFormatMoneda($('f-c-corredor'));
    autoFormatMoneda($('f-c-agente'));

    // Validar formato matrícula: exactamente 4 dígitos + espacio + 3 letras mayúsculas
    if (!/^\d{4} [A-Z]{3}$/.test($('f-matricula').value.trim())) {
      utils.setMsg('form-msg', 'Matrícula no válida. Formato: 4 números + 3 letras (ej. 1234 ABC).', 'error');
      $('f-matricula').focus();
      return;
    }

    // Validar formato email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('f-email').value.trim())) {
      utils.setMsg('form-msg', 'El email no tiene un formato válido.', 'error');
      $('f-email').focus();
      return;
    }

    var datos = {
      tipo_cliente: $('f-tipo-cliente').value,
      dni_cif: $('f-dni').value.trim(),
      nombre: $('f-nombre').value.trim(),
      apellido1: $('f-ape1').value.trim(),
      apellido2: $('f-ape2').value.trim(),
      telefono: $('f-telefono').value.trim(),
      email: $('f-email').value.trim(),
      domicilio: $('f-domicilio').value.trim(),
      numero: $('f-numero').value.trim(),
      poblacion: $('f-poblacion').value.trim(),
      cp: $('f-cp').value.trim(),
      provincia: $('f-provincia').value.trim(),
      n_poliza: $('f-n-poliza').value.trim(),
      fecha_pol: $('f-fecha-pol').value,
      ramo: $('f-ramo').value,
      cia: $('f-cia').value,
      matricula: $('f-matricula').value.trim(),
      prima: $('f-prima').value.trim(),
      c_corredor: $('f-c-corredor').value.trim(),
      c_agente: $('f-c-agente').value.trim(),
      vencimiento: $('f-vencimiento').value,
      url_drive: $('f-url-drive').value
    };

    var fila = $('f-fila').value ? Number($('f-fila').value) : 0;

    setBtnProcessing('btn-guardar', 'Guardando...');
    utils.setMsg('form-msg', 'Procesando...', 'ok');

    // Archivos staged en alta nueva (en edición se suben inline directamente)
    var archivosPromise;
    if (docsStagedFiles.length > 0 && !fila) {
      archivosPromise = Promise.all(docsStagedFiles.map(function (f) {
        return utils.toBase64(f).then(function (b64) {
          return { nombre: f.name, data: b64, mimeType: f.type || 'application/octet-stream' };
        });
      }));
    } else {
      archivosPromise = Promise.resolve([]);
    }

    archivosPromise.then(function (archivos) {
      return api.guardarPoliza(session.token(), datos, archivos, fila);
    }).then(function (res) {
      restoreBtn('btn-guardar');
      if (res.success) {
        utils.setMsg('form-msg', res.msg, 'ok');
        if (res.urlDrive) $('f-url-drive').value = res.urlDrive;
        if (!fila && res.fila) {
          // Primera vez guardada: pasar a modo edición para evitar duplicados
          $('f-fila').value = res.fila;
          $('form-title').textContent = 'Editar póliza';
          $('form-mode').textContent = 'Editando registro existente';
          utils.show('btn-baja');
          // Reinicializar docs con la carpeta Drive ya creada
          docsStagedFiles = [];
          initDocsInline(res.urlDrive || '');
        }
      } else {
        handleSessionError(res);
        utils.setMsg('form-msg', res.msg || 'Error al guardar.', 'error');
      }
    }).catch(function (err) {
      restoreBtn('btn-guardar');
      utils.setMsg('form-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.darBaja = function () {
    var fila = $('f-fila').value;
    if (!fila) return;
    if (!confirm('¿Seguro que quieres dar de baja esta póliza? Se moverá al histórico.')) return;

    setBtnProcessing('btn-baja', 'Procesando...');
    api.eliminarPoliza(session.token(), Number(fila)).then(function (res) {
      restoreBtn('btn-baja');
      if (res.success) {
        utils.setMsg('form-msg', res.msg, 'ok');
        setTimeout(function () { navigateTo('inicio'); }, 1200);
      } else {
        handleSessionError(res);
        utils.setMsg('form-msg', res.msg || 'Error.', 'error');
      }
    }).catch(function (err) {
      restoreBtn('btn-baja');
      utils.setMsg('form-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.limpiarFormulario = function () {
    polizaActual = null;
    initFormulario(null);
  };

  // ─── Documentos ───────────────────────────────────────────────────────

  window.verDocumentos = function () {
    var url = $('f-url-drive').value;
    if (!url) { alert('Este expediente no tiene carpeta documental.'); return; }
    navigateTo('documentos');
    initDocumentos(url);
  };

  function initDocumentos(urlDrive) {
    $('docs-status').textContent = 'Cargando documentos...';
    $('docs-list').innerHTML = '';
    $('docs-url').value = urlDrive;

    api.listarArchivos(session.token(), urlDrive).then(function (res) {
      if (!res.success) {
        $('docs-status').textContent = res.msg || 'Error.';
        return;
      }
      var archivos = res.archivos || [];
      $('docs-status').textContent = archivos.length ? archivos.length + ' documento(s)' : 'No hay documentos.';
      renderDocumentos(archivos);
    }).catch(function (err) {
      $('docs-status').textContent = 'Error: ' + err.message;
    });
  }

  function renderDocumentos(archivos) {
    var list = $('docs-list');
    list.innerHTML = '';
    archivos.forEach(function (a) {
      var div = document.createElement('div');
      div.className = 'doc-item';
      div.innerHTML = '<span class="doc-name">' + escapeHtml(a.nombre) + '</span>'
        + '<span class="doc-date">' + escapeHtml(a.fecha) + '</span>'
        + '<div class="btn-group">'
        + '<a href="' + escapeHtml(a.url) + '" target="_blank" class="btn btn-small btn-outline">Abrir</a>'
        + '<button class="btn btn-small btn-danger" data-id="' + escapeHtml(a.id) + '" data-name="' + escapeHtml(a.nombre) + '">Eliminar</button>'
        + '</div>';
      div.querySelector('.btn-danger').addEventListener('click', function () {
        eliminarDoc(a.id, a.nombre);
      });
      list.appendChild(div);
    });
  }

  window.subirDocs = function () {
    var input = $('docs-file-input');
    var files = input.files;
    if (!files.length) { alert('Selecciona archivos.'); return; }
    var urlDrive = $('docs-url').value;

    $('docs-status').textContent = 'Subiendo ' + files.length + ' archivo(s)...';
    Promise.all(Array.from(files).map(function (f) {
      return utils.toBase64(f).then(function (b64) {
        return { nombre: f.name, data: b64, mimeType: f.type };
      });
    })).then(function (archivos) {
      return api.subirArchivos(session.token(), urlDrive, archivos);
    }).then(function (res) {
      input.value = '';
      if (res.success) {
        initDocumentos(urlDrive);
      } else {
        $('docs-status').textContent = res.msg || 'Error.';
      }
    }).catch(function (err) {
      $('docs-status').textContent = 'Error: ' + err.message;
    });
  };

  function eliminarDoc(fileId, nombre) {
    if (!confirm('¿Eliminar "' + nombre + '"?')) return;
    var urlDrive = $('docs-url').value;

    api.eliminarArchivo(session.token(), urlDrive, fileId).then(function (res) {
      if (res.success) {
        initDocumentos(urlDrive);
      } else {
        alert(res.msg || 'Error.');
      }
    }).catch(function (err) {
      alert('Error: ' + err.message);
    });
  }

  window.volverDesdeDocumentos = function () {
    navigateTo('formulario');
    if (polizaActual) initFormulario(polizaActual);
  };

  // ─── Dashboard ────────────────────────────────────────────────────────

  function initDashboard() {
    $('dash-status').textContent = 'Cargando dashboard...';

    api.dashboard(session.token()).then(function (res) {
      if (!res.success) {
        handleSessionError(res);
        $('dash-status').textContent = res.msg || 'Error.';
        return;
      }
      $('dash-status').textContent = '';
      renderDashboard(res);
    }).catch(function (err) {
      $('dash-status').textContent = 'Error: ' + err.message;
    });
  }

  function renderDashboard(res) {
    var k = res.kpis;
    $('kpi-total').textContent = utils.formatNumero(k.totalPolizas);
    $('kpi-prima').textContent = utils.formatImporte(k.primaTotal);
    $('kpi-corredor').textContent = utils.formatImporte(k.comisionCorredor);
    $('kpi-agente').textContent = utils.formatImporte(k.comisionAgente);
    $('kpi-vencidas').textContent = utils.formatNumero(k.vencidas);
    $('kpi-vencen30').textContent = utils.formatNumero(k.vencen30);

    renderBarChart('chart-ramo', res.porRamo, 'polizas', utils.formatNumero);
    renderBarChart('chart-cia', res.porCompania, 'polizas', utils.formatNumero);
    renderBarChart('chart-ramo-prima', res.porRamo, 'prima', utils.formatImporte);
    renderBarChart('chart-cia-prima', res.porCompania, 'prima', utils.formatImporte);
    renderBarChart('chart-venc-mes', res.vencimientosPorMes, 'polizas', utils.formatNumero);
    renderBarChart('chart-pol-mes', res.polizasPorMes, 'polizas', utils.formatNumero);
    renderBarChart('chart-prima-mes', res.primasPorMes, 'prima', utils.formatImporte);
  }

  function renderBarChart(containerId, datos, campo, formatFn) {
    var el = $(containerId);
    if (!el) return;
    if (!datos || !datos.length) { el.innerHTML = '<p class="status-text">Sin datos</p>'; return; }

    var max = datos.reduce(function (m, d) { return Math.max(m, d[campo] || 0); }, 0) || 1;
    var html = '<ul class="bar-list">';
    datos.forEach(function (d) {
      var pct = Math.max(2, ((d[campo] || 0) / max) * 100);
      html += '<li class="bar-item">'
        + '<span class="bar-label" title="' + escapeHtml(d.label) + '">' + escapeHtml(d.label) + '</span>'
        + '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>'
        + '<span class="bar-value">' + formatFn(d[campo] || 0) + '</span>'
        + '</li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  // ─── Documentación inline ────────────────────────────────────────────────

  /** Extrae la extensión legible de un nombre de archivo o mimeType. */
  function _extArchivo(nombre, mimeType) {
    var m = (nombre || '').match(/\.([^.]{1,5})$/);
    if (m) return m[1].toLowerCase();
    var mm = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png',
      'image/gif': 'gif', 'image/webp': 'webp',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt', 'application/zip': 'zip'
    };
    return mm[mimeType] || 'arch';
  }

  /**
   * Inicializa la sección de docs inline del formulario.
   * Llamar desde initFormulario con la URL Drive del registro (o '' si alta nueva).
   */
  function initDocsInline(urlDrive) {
    docsUrlDrive = urlDrive || '';
    docsStagedFiles = [];
    docsArchivosEnDrive = [];
    var statusEl = $('docs-inline-status');
    var uploadEl = $('docs-upload-status');
    if (statusEl) statusEl.textContent = '';
    if (uploadEl) uploadEl.textContent = '';

    if (docsUrlDrive) {
      if (statusEl) statusEl.textContent = 'Cargando documentos…';
      api.listarArchivos(session.token(), docsUrlDrive).then(function (res) {
        if (statusEl) statusEl.textContent = '';
        if (res.success) {
          docsArchivosEnDrive = res.archivos || [];
          renderDocsLista();
        } else {
          if (statusEl) statusEl.textContent = res.msg || 'Error al cargar documentos.';
        }
      }).catch(function (err) {
        if (statusEl) statusEl.textContent = 'Error: ' + err.message;
      });
    } else {
      renderDocsLista(); // lista vacía + zona de drop
    }
  }

  function renderDocsLista() {
    var list = $('docs-inline-list');
    if (!list) return;
    list.innerHTML = '';

    // Archivos en Drive
    docsArchivosEnDrive.forEach(function (a) {
      var ext = _extArchivo(a.nombre, a.mimeType);
      var div = document.createElement('div');
      div.className = 'docs-item';
      var link = document.createElement('a');
      link.className = 'docs-item-name';
      link.href = a.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = a.nombre;
      link.textContent = a.nombre;
      var extSpan = document.createElement('span');
      extSpan.className = 'docs-item-ext';
      extSpan.textContent = ext;
      var delBtn = document.createElement('button');
      delBtn.className = 'docs-item-delete';
      delBtn.title = 'Eliminar';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        docsEliminarArchivo(a.id, a.nombre);
      });
      div.appendChild(extSpan);
      div.appendChild(link);
      div.appendChild(delBtn);
      list.appendChild(div);
    });

    // Archivos staged (pendientes, solo alta nueva)
    docsStagedFiles.forEach(function (f, idx) {
      var ext = _extArchivo(f.name, f.type);
      var div = document.createElement('div');
      div.className = 'docs-item docs-item-staged';
      var extSpan = document.createElement('span');
      extSpan.className = 'docs-item-ext';
      extSpan.textContent = ext;
      var nameSpan = document.createElement('span');
      nameSpan.className = 'docs-item-name';
      nameSpan.style.cursor = 'default';
      nameSpan.style.color = 'var(--text-muted)';
      nameSpan.title = f.name;
      nameSpan.innerHTML = escapeHtml(f.name) + ' <em style="font-size:0.76rem">(pendiente)</em>';
      var delBtn = document.createElement('button');
      delBtn.className = 'docs-item-delete';
      delBtn.title = 'Quitar';
      delBtn.textContent = '🗑️';
      (function (i) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          docsStagedFiles.splice(i, 1);
          renderDocsLista();
        });
      }(idx));
      div.appendChild(extSpan);
      div.appendChild(nameSpan);
      div.appendChild(delBtn);
      list.appendChild(div);
    });

    if (!docsArchivosEnDrive.length && !docsStagedFiles.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:8px 12px;font-size:0.83rem;color:var(--text-faint)';
      empty.textContent = 'Sin documentos adjuntos.';
      list.appendChild(empty);
    }
  }

  window.docsDropZoneClick = function () {
    var input = $('f-archivos');
    if (input) input.click();
  };

  window.docsDropZoneOver = function (e) {
    e.preventDefault();
    var dz = $('docs-drop-zone');
    if (dz) dz.classList.add('dragover');
  };

  window.docsDropZoneLeave = function (e) {
    var dz = $('docs-drop-zone');
    if (dz) dz.classList.remove('dragover');
  };

  window.docsDropZoneDrop = function (e) {
    e.preventDefault();
    var dz = $('docs-drop-zone');
    if (dz) dz.classList.remove('dragover');
    docsHandleFiles(e.dataTransfer.files);
  };

  function docsHandleFiles(files) {
    if (!files || !files.length) return;
    if (docsUrlDrive) {
      // Registro existente: subir inmediatamente a Drive
      docsSubirInmediato(Array.from(files));
    } else {
      // Alta nueva: staging local hasta que se grabe la póliza
      Array.from(files).forEach(function (f) { docsStagedFiles.push(f); });
      renderDocsLista();
    }
  }

  function docsSubirInmediato(files) {
    var uploadEl = $('docs-upload-status');
    if (uploadEl) uploadEl.textContent = 'Subiendo ' + files.length + ' archivo(s)…';
    Promise.all(files.map(function (f) {
      return utils.toBase64(f).then(function (b64) {
        return { nombre: f.name, data: b64, mimeType: f.type || 'application/octet-stream' };
      });
    })).then(function (archivos) {
      return api.subirArchivos(session.token(), docsUrlDrive, archivos);
    }).then(function (res) {
      if (!res.success) {
        if (uploadEl) uploadEl.textContent = res.msg || 'Error al subir.';
        return null;
      }
      if (uploadEl) uploadEl.textContent = '';
      return api.listarArchivos(session.token(), docsUrlDrive);
    }).then(function (res) {
      if (res && res.success) {
        docsArchivosEnDrive = res.archivos || [];
        renderDocsLista();
      }
    }).catch(function (err) {
      if (uploadEl) uploadEl.textContent = 'Error: ' + err.message;
    });
  }

  function docsEliminarArchivo(fileId, nombre) {
    if (!confirm('¿Eliminar "' + nombre + '"?')) return;
    api.eliminarArchivo(session.token(), docsUrlDrive, fileId).then(function (res) {
      if (res.success) {
        docsArchivosEnDrive = docsArchivosEnDrive.filter(function (a) { return a.id !== fileId; });
        renderDocsLista();
      } else {
        alert(res.msg || 'Error al eliminar.');
      }
    }).catch(function (err) {
      alert('Error: ' + err.message);
    });
  }

  // ─── Gestión — columnas y configuración por usuario ──────────────────────

  /** Clave de localStorage específica del usuario actual. */
  function _gestionCfgKey() {
    return 'hsl_gestion_cfg_' + (session.usuario() || 'default');
  }

  function loadGestionCols() {
    var raw = localStorage.getItem(_gestionCfgKey());
    if (raw) {
      try {
        var cfg = JSON.parse(raw);
        if (cfg.cols && cfg.cols.length) {
          gestionColsVisible = cfg.cols;
          if (cfg.sort) gestionSort = cfg.sort;
          return;
        }
      } catch (e) {}
    }
    // Valores por defecto: columnas con defaultOn en orden canónico del sheet
    gestionColsVisible = TODAS_COLUMNAS.filter(function (c) { return c.defaultOn; }).map(function (c) { return c.key; });
    gestionSort = { key: null, dir: 0 };
  }

  function saveGestionCols() {
    localStorage.setItem(_gestionCfgKey(), JSON.stringify({
      cols: gestionColsVisible,
      sort: gestionSort
    }));
  }

  window.toggleColumnasPanel = function () {
    var panel = $('columnas-panel');
    var isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      renderColumnasPanel();
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  };

  /** El panel siempre muestra columnas en orden canónico (TODAS_COLUMNAS). */
  function renderColumnasPanel() {
    if (!gestionColsVisible) loadGestionCols();
    var lista = $('columnas-lista');
    lista.innerHTML = TODAS_COLUMNAS.map(function (c) {
      var checked = gestionColsVisible.indexOf(c.key) !== -1 ? ' checked' : '';
      return '<label class="col-check-item"><input type="checkbox" value="' + escapeHtml(c.key) + '"' + checked + ' onchange="toggleColumna(this)"> ' + escapeHtml(c.label) + '</label>';
    }).join('');
  }

  window.toggleColumna = function (cb) {
    if (!gestionColsVisible) loadGestionCols();
    var key = cb.value;
    if (cb.checked) {
      if (gestionColsVisible.indexOf(key) === -1) {
        // Insertar en posición canónica respecto a las columnas ya visibles
        var canonIdx = -1;
        TODAS_COLUMNAS.forEach(function (c, i) { if (c.key === key) canonIdx = i; });
        var insertAt = gestionColsVisible.length;
        for (var i = canonIdx + 1; i < TODAS_COLUMNAS.length; i++) {
          var pos = gestionColsVisible.indexOf(TODAS_COLUMNAS[i].key);
          if (pos !== -1) { insertAt = pos; break; }
        }
        gestionColsVisible.splice(insertAt, 0, key);
      }
    } else {
      gestionColsVisible = gestionColsVisible.filter(function (k) { return k !== key; });
    }
    saveGestionCols();
    gestionPagina = 1;
    renderGestion();
  };

  window.resetColumnas = function () {
    gestionColsVisible = TODAS_COLUMNAS.filter(function (c) { return c.defaultOn; }).map(function (c) { return c.key; });
    gestionSort = { key: null, dir: 0 };
    saveGestionCols();
    renderColumnasPanel();
    gestionPagina = 1;
    renderGestion();
  };

  // Cerrar panel de columnas al hacer clic fuera
  document.addEventListener('click', function (e) {
    var panel = $('columnas-panel');
    var btn = $('btn-columnas');
    if (!panel || panel.classList.contains('hidden')) return;
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });

  // ─── Gestión — filtros fecha ───────────────────────────────────────────

  window.toggleFiltroFechaForm = function () {
    var form = $('filtro-fecha-form');
    var isHidden = form.classList.contains('hidden');
    if (isHidden) {
      $('filtro-campo').value = '';
      $('filtro-desde').value = '';
      $('filtro-hasta').value = '';
      form.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
    }
  };

  window.aplicarFiltroFecha = function () {
    var campo = $('filtro-campo').value;
    if (!campo) { utils.setMsg('gestion-status', 'Selecciona el campo fecha.', 'error'); return; }
    var desde = $('filtro-desde').value;
    var hasta = $('filtro-hasta').value;
    if (!desde && !hasta) { utils.setMsg('gestion-status', 'Indica al menos una fecha (desde o hasta).', 'error'); return; }

    var labelMap = { fecha_alta: 'Fecha alta', f_pol: 'F. póliza', vencimiento: 'Vencimiento' };
    gestionFiltrosFecha.push({ campo: campo, label: labelMap[campo] || campo, desde: desde, hasta: hasta });
    $('filtro-fecha-form').classList.add('hidden');
    gestionPagina = 1;
    renderGestion();
  };

  window.quitarFiltroFecha = function (idx) {
    gestionFiltrosFecha.splice(Number(idx), 1);
    gestionPagina = 1;
    renderGestion();
  };

  function renderFiltroChips() {
    var container = $('filtros-activos');
    if (!container) return;
    if (!gestionFiltrosFecha.length) { container.innerHTML = ''; return; }
    container.innerHTML = gestionFiltrosFecha.map(function (f, i) {
      var txt = f.label;
      if (f.desde && f.hasta) txt += ': ' + f.desde + ' → ' + f.hasta;
      else if (f.desde) txt += ': desde ' + f.desde;
      else if (f.hasta) txt += ': hasta ' + f.hasta;
      return '<span class="filtro-chip">' + escapeHtml(txt) + ' <button onclick="quitarFiltroFecha(' + i + ')" title="Quitar filtro">✕</button></span>';
    }).join('');
  }

  // ─── Gestión ──────────────────────────────────────────────────────────

  function initGestion() {
    loadGestionCols(); // siempre recarga: la clave depende del usuario en sesión
    gestionPagina = 1;
    gestionFiltrosFecha = [];
    gestionBusqueda = '';
    var buscarInput = $('gestion-buscar');
    if (buscarInput) buscarInput.value = '';
    $('gestion-status').textContent = 'Cargando registros...';
    $('gestion-tbody').innerHTML = '';
    utils.hide('gestion-results');

    api.registros(session.token()).then(function (res) {
      if (!res.success) {
        handleSessionError(res);
        $('gestion-status').textContent = res.msg || 'Error.';
        return;
      }
      gestionData = res.registros || [];
      $('gestion-status').textContent = gestionData.length + ' registro(s) cargados';
      renderGestion();
    }).catch(function (err) {
      $('gestion-status').textContent = 'Error: ' + err.message;
    });
  }

  window.onGestionSearch = function () {
    clearTimeout(gestionSearchTimer);
    gestionSearchTimer = setTimeout(function () {
      gestionBusqueda = $('gestion-buscar').value.trim().toLowerCase();
      gestionPagina = 1;
      renderGestion();
    }, 300);
  };

  function filtrarGestion() {
    var result = gestionData;

    // Búsqueda de texto
    if (gestionBusqueda) {
      result = result.filter(function (r) {
        var texto = [r.nombre_completo, r.dni_cif, r.n_poliza, r.ramo, r.cia, r.matricula, r.poblacion, r.telefono, r.email].join(' ').toLowerCase();
        return texto.indexOf(gestionBusqueda) !== -1;
      });
    }

    // Filtros por fecha (AND)
    gestionFiltrosFecha.forEach(function (f) {
      result = result.filter(function (r) {
        var val = String(r[f.campo] || '').trim().slice(0, 10);
        if (!val) return false;
        if (f.desde && val < f.desde) return false;
        if (f.hasta && val > f.hasta) return false;
        return true;
      });
    });

    // Ordenación
    if (gestionSort.key && gestionSort.dir !== 0) {
      var colDef = null;
      TODAS_COLUMNAS.forEach(function (c) { if (c.key === gestionSort.key) colDef = c; });
      var isNumeric = colDef && colDef.numeric;
      result = result.slice().sort(function (a, b) {
        var av = a[gestionSort.key] != null ? a[gestionSort.key] : '';
        var bv = b[gestionSort.key] != null ? b[gestionSort.key] : '';
        if (isNumeric) {
          // Parsear importes con formato "1.500,00 €"
          var na = parseFloat(String(av).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
          var nb = parseFloat(String(bv).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
          return gestionSort.dir * (na - nb);
        }
        return gestionSort.dir * String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' });
      });
    }

    return result;
  }

  function renderGestion() {
    if (!gestionColsVisible) loadGestionCols();

    var filtered = filtrarGestion();
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / gestionPorPagina));
    if (gestionPagina > totalPages) gestionPagina = totalPages;

    var start = (gestionPagina - 1) * gestionPorPagina;
    var page = filtered.slice(start, start + gestionPorPagina);

    // Columnas activas: respeta el orden de gestionColsVisible (el que el usuario configuró)
    var activeCols = gestionColsVisible.map(function (key) {
      for (var i = 0; i < TODAS_COLUMNAS.length; i++) {
        if (TODAS_COLUMNAS[i].key === key) return TODAS_COLUMNAS[i];
      }
      return null;
    }).filter(Boolean);

    // ── Thead: ordenable (clic) y reordenable (drag) ───────────────────────
    var thead = $('gestion-thead');
    thead.innerHTML = '';
    var headerRow = document.createElement('tr');
    activeCols.forEach(function (c, colIdx) {
      var th = document.createElement('th');
      if (c.align) th.style.textAlign = c.align;
      th.draggable = true;
      th.title = 'Clic para ordenar · Arrastra para mover';

      // Icono de orden
      var sortIcon = gestionSort.key === c.key
        ? (gestionSort.dir === 1 ? ' ▲' : ' ▼') : '';
      th.textContent = c.label + sortIcon;

      // Ciclo de ordenación: asc → desc → sin orden
      th.addEventListener('click', function () {
        if (gestionSort.key === c.key) {
          if (gestionSort.dir === 1)       { gestionSort.dir = -1; }
          else if (gestionSort.dir === -1) { gestionSort.key = null; gestionSort.dir = 0; }
          else                             { gestionSort.dir = 1; }
        } else {
          gestionSort.key = c.key;
          gestionSort.dir = 1;
        }
        saveGestionCols();
        gestionPagina = 1;
        renderGestion();
      });

      // ── Drag-to-reorder ─────────────────────────────────────────────────
      th.addEventListener('dragstart', function (e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(colIdx));
        th.classList.add('col-th-dragging');
      });
      th.addEventListener('dragend', function () {
        th.classList.remove('col-th-dragging');
        headerRow.querySelectorAll('th').forEach(function (el) { el.classList.remove('col-th-over'); });
      });
      th.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        headerRow.querySelectorAll('th').forEach(function (el) { el.classList.remove('col-th-over'); });
        th.classList.add('col-th-over');
      });
      th.addEventListener('dragleave', function () {
        th.classList.remove('col-th-over');
      });
      th.addEventListener('drop', function (e) {
        e.preventDefault();
        th.classList.remove('col-th-over');
        var fromIdx = Number(e.dataTransfer.getData('text/plain'));
        var toIdx = colIdx;
        if (fromIdx === toIdx) return;
        var moved = gestionColsVisible.splice(fromIdx, 1)[0];
        gestionColsVisible.splice(toIdx, 0, moved);
        saveGestionCols();
        renderGestion();
        if (!$('columnas-panel').classList.contains('hidden')) renderColumnasPanel();
      });

      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Tbody
    var tbody = $('gestion-tbody');
    tbody.innerHTML = '';
    utils.show('gestion-results');

    page.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'clickable';
      tr.innerHTML = activeCols.map(function (c) {
        var val = escapeHtml(String(r[c.key] != null ? r[c.key] : ''));
        return '<td' + (c.align ? ' style="text-align:' + c.align + '"' : '') + '>' + val + '</td>';
      }).join('');
      tr.addEventListener('click', function () { abrirFicha(r); });
      tbody.appendChild(tr);
    });

    // ── Tfoot: totales de columnas numéricas (sobre el conjunto filtrado completo) ─
    var tfoot = $('gestion-tfoot');
    tfoot.innerHTML = '';
    var numCols = activeCols.filter(function (c) { return c.numeric; });
    if (numCols.length && filtered.length) {
      var sums = {};
      numCols.forEach(function (c) { sums[c.key] = 0; });
      filtered.forEach(function (r) {
        numCols.forEach(function (c) { sums[c.key] += _parseMoneda(r[c.key]); });
      });
      var tfootRow = document.createElement('tr');
      activeCols.forEach(function (c, idx) {
        var td = document.createElement('td');
        if (c.align) td.style.textAlign = c.align;
        if (idx === 0) {
          td.innerHTML = '<span class="tfoot-label">Total (' + filtered.length + ')</span>';
        } else if (c.numeric) {
          td.innerHTML = '<span class="tfoot-sum">' + _formatMonedaNum(sums[c.key]) + '</span>';
        }
        tfootRow.appendChild(td);
      });
      tfoot.appendChild(tfootRow);
    }

    $('gestion-info').textContent = 'Mostrando ' + (total ? start + 1 : 0) + '-' + Math.min(start + gestionPorPagina, total) + ' de ' + total;
    renderPagination(totalPages);
    renderFiltroChips();
  }

  function renderPagination(totalPages) {
    var container = $('gestion-pages');
    container.innerHTML = '';

    var prevBtn = document.createElement('button');
    prevBtn.textContent = '‹ Anterior';
    prevBtn.disabled = gestionPagina <= 1;
    prevBtn.addEventListener('click', function () { gestionPagina--; renderGestion(); });
    container.appendChild(prevBtn);

    var maxButtons = 7;
    var startPage = Math.max(1, gestionPagina - Math.floor(maxButtons / 2));
    var endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    for (var p = startPage; p <= endPage; p++) {
      var btn = document.createElement('button');
      btn.textContent = p;
      if (p === gestionPagina) btn.className = 'current';
      btn.dataset.page = p;
      btn.addEventListener('click', function () { gestionPagina = Number(this.dataset.page); renderGestion(); });
      container.appendChild(btn);
    }

    var nextBtn = document.createElement('button');
    nextBtn.textContent = 'Siguiente ›';
    nextBtn.disabled = gestionPagina >= totalPages;
    nextBtn.addEventListener('click', function () { gestionPagina++; renderGestion(); });
    container.appendChild(nextBtn);
  }

  window.onGestionPageSize = function () {
    gestionPorPagina = Number($('gestion-page-size').value) || 25;
    gestionPagina = 1;
    renderGestion();
  };

  window.exportarExcel = function () {
    var filtered = filtrarGestion();
    if (!filtered.length) { alert('No hay datos para exportar.'); return; }

    // CSV exporta todos los campos en orden canónico del sheet.
    // Cabeceras derivadas de TODAS_COLUMNAS para evitar discrepancias.
    var fields  = TODAS_COLUMNAS.map(function (c) { return c.key; });
    var headers = TODAS_COLUMNAS.map(function (c) { return c.label; });

    var csv = '﻿' + headers.join(';') + '\n';
    filtered.forEach(function (r) {
      csv += fields.map(function (f) { return utils.csvEscape(r[f] != null ? r[f] : ''); }).join(';') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'polizas_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };

  // ─── Catálogo ─────────────────────────────────────────────────────────

  window.sincronizarCatalogos = function () {
    utils.setMsg('cat-global-msg', '⌛ Sincronizando desde pólizas...', 'ok');
    // Recargar catálogos — _sembrarCatalogos() se ejecuta automáticamente en el backend
    api.catalogos(session.token()).then(function (res) {
      if (!res.success) { handleSessionError(res); return; }
      renderCatalogoTabla('cat-ramo-tabla', res.catalogoRamos, 'RAMO');
      renderCatalogoTabla('cat-cia-tabla', res.catalogoCompanias, 'CIA');
      var totalRamos = (res.catalogoRamos || []).length;
      var totalCias  = (res.catalogoCompanias || []).length;
      utils.setMsg('cat-global-msg',
        '✓ Sincronizado — ' + totalRamos + ' ramos, ' + totalCias + ' compañías.', 'ok');
    }).catch(function (err) {
      utils.setMsg('cat-global-msg', 'Error: ' + err.message, 'error');
    });
  };

  window.poblarCatalogosDefecto = function () {
    utils.setMsg('cat-global-msg', '⌛ Cargando predeterminados...', 'ok');
    api.poblarCatalogosPorDefecto(session.token()).then(function (res) {
      utils.setMsg('cat-global-msg', res.msg || 'Listo.', res.success ? 'ok' : 'error');
      if (res.success) initCatalogo();
    }).catch(function (err) {
      utils.setMsg('cat-global-msg', 'Error: ' + err.message, 'error');
    });
  };

  function initCatalogo() {
    $('cat-ramo-input').value = '';
    $('cat-cia-input').value = '';
    utils.setMsg('cat-ramo-msg', '', '');
    utils.setMsg('cat-cia-msg', '', '');
    utils.setMsg('cat-global-msg', '', '');

    api.catalogos(session.token()).then(function (res) {
      if (!res.success) { handleSessionError(res); return; }
      renderCatalogoTabla('cat-ramo-tabla', res.catalogoRamos, 'RAMO');
      renderCatalogoTabla('cat-cia-tabla', res.catalogoCompanias, 'CIA');
    }).catch(function (err) {
      utils.setMsg('cat-ramo-msg', 'Error: ' + err.message, 'error');
    });
  }

  function renderCatalogoTabla(tbodyId, items, tipo) {
    var tbody = $(tbodyId);
    tbody.innerHTML = '';
    (items || []).forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escapeHtml(item.nombre) + '</td>'
        + '<td><span class="badge-activo ' + (item.activo ? 'si' : 'no') + '">' + (item.activo ? 'Activo' : 'Inactivo') + '</span></td>'
        + '<td>' + (item.activo ? '<button class="btn btn-small btn-danger">Baja</button>' : '') + '</td>';
      var bajaBtn = tr.querySelector('.btn-danger');
      if (bajaBtn) {
        bajaBtn.addEventListener('click', function () {
          bajaCatalogoItem(tipo, item.id, item.nombre);
        });
      }
      tbody.appendChild(tr);
    });
  }

  window.guardarCatalogoRamo = function () {
    var nombre = $('cat-ramo-input').value.trim();
    if (!nombre) { utils.setMsg('cat-ramo-msg', 'Escribe un nombre.', 'error'); return; }
    api.guardarCatalogo(session.token(), 'RAMO', nombre).then(function (res) {
      utils.setMsg('cat-ramo-msg', res.msg, res.success ? 'ok' : 'error');
      if (res.success) { $('cat-ramo-input').value = ''; initCatalogo(); }
    }).catch(function (err) { utils.setMsg('cat-ramo-msg', 'Error: ' + err.message, 'error'); });
  };

  window.guardarCatalogoCia = function () {
    var nombre = $('cat-cia-input').value.trim();
    if (!nombre) { utils.setMsg('cat-cia-msg', 'Escribe un nombre.', 'error'); return; }
    api.guardarCatalogo(session.token(), 'CIA', nombre).then(function (res) {
      utils.setMsg('cat-cia-msg', res.msg, res.success ? 'ok' : 'error');
      if (res.success) { $('cat-cia-input').value = ''; initCatalogo(); }
    }).catch(function (err) { utils.setMsg('cat-cia-msg', 'Error: ' + err.message, 'error'); });
  };

  function bajaCatalogoItem(tipo, id, nombre) {
    if (!confirm('¿Dar de baja "' + nombre + '"?')) return;
    var msgId = tipo === 'RAMO' ? 'cat-ramo-msg' : 'cat-cia-msg';
    api.bajaCatalogo(session.token(), tipo, id).then(function (res) {
      utils.setMsg(msgId, res.msg, res.success ? 'ok' : 'error');
      if (res.success) initCatalogo();
    }).catch(function (err) { utils.setMsg(msgId, 'Error: ' + err.message, 'error'); });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  function setBtnProcessing(id, text) {
    var btn = $(id);
    if (!btn) return;
    btn.dataset.original = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    btn.classList.add('processing');
  }

  function restoreBtn(id) {
    var btn = $(id);
    if (!btn) return;
    btn.textContent = btn.dataset.original || 'Guardar';
    btn.disabled = false;
    btn.classList.remove('processing');
  }

  function handleSessionError(res) {
    if (res && res.msg && res.msg.indexOf('Sesión') !== -1) {
      session.clear();
      alert('Tu sesión ha caducado. Vuelve a iniciar sesión.');
      showLogin();
    }
  }
})();
