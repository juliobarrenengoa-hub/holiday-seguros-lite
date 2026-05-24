/**
 * HOLIDAY SEGUROS LITE — App principal
 * Controla todas las vistas, navegación y lógica de la SPA.
 */
(function () {
  var $ = utils.$;
  var escapeHtml = utils.escapeHtml;

  // ─── State ──────────────────────────────────────────────────────────────

  var gestionData = [];
  var gestionPagina = 1;
  var gestionPorPagina = 25;
  var gestionFiltros = [];
  var gestionBusqueda = '';
  var searchTimer = null;
  var gestionSearchTimer = null;
  var polizaActual = null;

  // ─── Init ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initConfigCheck();
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

  window.doLoginGoogle = function () {
    utils.setMsg('login-msg', 'El login con Google solo funciona dentro de Apps Script. Usa usuario y contraseña.', 'error');
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
      utils.show('btn-docs');
    } else {
      $('f-fila').value = '';
      $('f-url-drive').value = '';
      $('f-tipo-cliente').value = 'Particular';
      utils.hide('btn-baja');
      utils.hide('btn-docs');
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
    var campos = ['f-dni', 'f-nombre', 'f-n-poliza', 'f-ramo', 'f-cia', 'f-prima', 'f-vencimiento'];
    for (var i = 0; i < campos.length; i++) {
      if (!$(campos[i]).value.trim()) {
        utils.setMsg('form-msg', 'Completa todos los campos obligatorios.', 'error');
        $(campos[i]).focus();
        return;
      }
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
    var fileInput = $('f-archivos');
    var files = fileInput ? fileInput.files : [];

    setBtnProcessing('btn-guardar', 'Guardando...');
    utils.setMsg('form-msg', 'Procesando...', 'ok');

    var archivosPromise;
    if (files.length > 0 && !fila) {
      archivosPromise = Promise.all(Array.from(files).map(function (f) {
        return utils.toBase64(f).then(function (b64) {
          return { nombre: f.name, data: b64, mimeType: f.type };
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
        if (!fila && res.urlDrive) {
          utils.show('btn-docs');
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

  // ─── Gestión ──────────────────────────────────────────────────────────

  function initGestion() {
    gestionPagina = 1;
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
    if (!gestionBusqueda) return gestionData;
    return gestionData.filter(function (r) {
      var texto = [r.nombre_completo, r.dni_cif, r.n_poliza, r.ramo, r.cia, r.matricula, r.poblacion, r.telefono, r.email].join(' ').toLowerCase();
      return texto.indexOf(gestionBusqueda) !== -1;
    });
  }

  function renderGestion() {
    var filtered = filtrarGestion();
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / gestionPorPagina));
    if (gestionPagina > totalPages) gestionPagina = totalPages;

    var start = (gestionPagina - 1) * gestionPorPagina;
    var page = filtered.slice(start, start + gestionPorPagina);

    var tbody = $('gestion-tbody');
    tbody.innerHTML = '';
    utils.show('gestion-results');

    page.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'clickable';
      tr.innerHTML = '<td>' + escapeHtml(r.nombre_completo) + '</td>'
        + '<td>' + escapeHtml(r.dni_cif) + '</td>'
        + '<td>' + escapeHtml(r.n_poliza) + '</td>'
        + '<td>' + escapeHtml(r.ramo) + '</td>'
        + '<td>' + escapeHtml(r.cia) + '</td>'
        + '<td>' + escapeHtml(r.matricula) + '</td>'
        + '<td style="text-align:right">' + escapeHtml(r.prima) + '</td>'
        + '<td>' + escapeHtml(r.vencimiento) + '</td>';
      tr.addEventListener('click', function () { abrirFicha(r); });
      tbody.appendChild(tr);
    });

    $('gestion-info').textContent = 'Mostrando ' + (start + 1) + '-' + Math.min(start + gestionPorPagina, total) + ' de ' + total;
    renderPagination(totalPages);
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

    var headers = ['Nombre', 'DNI/CIF', 'Nº Póliza', 'Ramo', 'Compañía', 'Matrícula', 'Prima', 'Vencimiento', 'Teléfono', 'Email', 'Población', 'CP', 'Provincia'];
    var csv = '﻿' + headers.join(';') + '\n';
    filtered.forEach(function (r) {
      csv += [r.nombre_completo, r.dni_cif, r.n_poliza, r.ramo, r.cia, r.matricula, r.prima, r.vencimiento, r.telefono, r.email, r.poblacion, r.cp, r.provincia]
        .map(utils.csvEscape).join(';') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'polizas_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };

  // ─── Catálogo ─────────────────────────────────────────────────────────

  function initCatalogo() {
    $('cat-ramo-input').value = '';
    $('cat-cia-input').value = '';
    utils.setMsg('cat-ramo-msg', '', '');
    utils.setMsg('cat-cia-msg', '', '');

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
