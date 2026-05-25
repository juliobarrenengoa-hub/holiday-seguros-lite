/**
 * Utilidades compartidas.
 */
var utils = (function () {
  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.remove('hidden');
  }

  function hide(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.add('hidden');
  }

  function setMsg(id, text, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg';
    if (type === 'error') el.classList.add('red-text');
    else if (type === 'ok') el.classList.add('green-text');
    else el.classList.add('blue-text');
  }

  function formatImporte(valor) {
    var n = parseFloat(valor);
    if (!isFinite(n)) return '0,00 €';
    // Formato manual "X.XXX,XX €" — no depende de toLocaleString (falla en algunos entornos)
    var abs = Math.abs(n).toFixed(2).split('.');
    var entero = abs[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '-' : '') + entero + ',' + abs[1] + ' €';
  }

  function formatNumero(valor) {
    var n = parseInt(valor, 10);
    if (!isFinite(n)) return '0';
    return n.toLocaleString('es-ES');
  }

  function provinciaDesdeCp(cp) {
    if (!cp) return '';
    var prefijo = cp.toString().padStart(5, '0').substring(0, 2);
    var mapa = {
      '01':'Álava','02':'Albacete','03':'Alicante','04':'Almería','05':'Ávila','06':'Badajoz',
      '07':'Islas Baleares','08':'Barcelona','09':'Burgos','10':'Cáceres','11':'Cádiz',
      '12':'Castellón','13':'Ciudad Real','14':'Córdoba','15':'A Coruña','16':'Cuenca',
      '17':'Girona','18':'Granada','19':'Guadalajara','20':'Gipuzkoa','21':'Huelva',
      '22':'Huesca','23':'Jaén','24':'León','25':'Lleida','26':'La Rioja','27':'Lugo',
      '28':'Madrid','29':'Málaga','30':'Murcia','31':'Navarra','32':'Ourense','33':'Asturias',
      '34':'Palencia','35':'Las Palmas','36':'Pontevedra','37':'Salamanca','38':'S.C. Tenerife',
      '39':'Cantabria','40':'Segovia','41':'Sevilla','42':'Soria','43':'Tarragona',
      '44':'Teruel','45':'Toledo','46':'Valencia','47':'Valladolid','48':'Bizkaia',
      '49':'Zamora','50':'Zaragoza','51':'Ceuta','52':'Melilla'
    };
    return mapa[prefijo] || '';
  }

  function toBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function csvEscape(valor) {
    var s = String(valor == null ? '' : valor);
    if (s.indexOf('"') !== -1 || s.indexOf(';') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  return {
    escapeHtml: escapeHtml,
    $: $,
    show: show,
    hide: hide,
    setMsg: setMsg,
    formatImporte: formatImporte,
    formatNumero: formatNumero,
    provinciaDesdeCp: provinciaDesdeCp,
    toBase64: toBase64,
    csvEscape: csvEscape
  };
})();
