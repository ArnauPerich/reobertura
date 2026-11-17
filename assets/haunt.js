(function () {
  // URL del Worker de Cloudflare (sin barra final)
  var API = window.HAUNT_API || 'https://reobertura.arnau-perichiglesias.workers.dev';

  function $(s) { return document.querySelector(s); }

  var closed = $('[data-closed]');
  var closedMsg = $('[data-closed-msg]');
  var app = $('[data-app]');
  var lock = $('[data-lock]');
  var inputs = Array.prototype.slice.call(lock.querySelectorAll('input'));
  var button = lock.querySelector('button');
  var msg = $('[data-msg]');
  var leftEl = $('[data-left]');
  var status = $('[data-status]');
  var solvedBox = $('[data-solved]');

  var id = window.HAUNT_ID || new URLSearchParams(location.search).get('p');
  if (!id || !/^[a-z0-9]{4,20}$/.test(id)) return; // sin prueba: se queda el "tancat"

  var KEY = 'haunt:' + id;
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function forget() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function showClosed(text) {
    app.hidden = true;
    closed.hidden = false;
    if (text) closedMsg.textContent = text;
  }

  function setMsg(text, isError) {
    msg.textContent = text || '';
    msg.className = 'msg' + (isError ? ' error' : '');
  }

  function setLocked(on) {
    inputs.forEach(function (x) { x.disabled = on; });
    button.disabled = on;
  }


  // Números al azar repartidos por una caja (prueba sin enunciado)
  function xifres(n, cls) {
    var box = document.createElement('div');
    box.className = cls;
    box.setAttribute('aria-hidden', 'true');
    var sizes = [13, 15, 18, 22, 26, 32, 40];
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.textContent = Math.floor(Math.random() * 10);
      s.style.left = (Math.random() * 96) + '%';
      s.style.top = (Math.random() * 94) + '%';
      s.style.fontSize = sizes[Math.floor(Math.random() * sizes.length)] + 'px';
      s.style.transform = 'rotate(' + Math.round(Math.random() * 50 - 25) + 'deg)';
      if (Math.random() < .2) s.className = 'r';
      box.appendChild(s);
    }
    return box;
  }

  function render(d, animate) {
    closed.hidden = true;
    app.hidden = false;
    document.title = 'Prova ' + d.num + ' · Gran reobertura';
    $('[data-top]').textContent = 'Prova ' + d.num + ' de IV';
    $('[data-title]').textContent = d.num + ' · ' + d.titol;
    $('[data-comment]').textContent = '«' + d.comentari + '»';
    var en = $('[data-enigma]');
    if (d.xifres) {
      if (!en.dataset.xifres) {
        en.dataset.xifres = '1';
        if (en.previousElementSibling) en.previousElementSibling.hidden = true;
        en.innerHTML = '';
        en.appendChild(xifres(70, 'xifres-camp'));
        document.body.insertBefore(xifres(160, 'xifres-fons'), document.body.firstChild);
      }
    } else {
      en.innerHTML = d.enigma;
    }

    if (d.solved) {
      document.body.classList.add('is-solved');
      status.textContent = 'DESACTIVAT';
      lock.hidden = true;
      solvedBox.hidden = false;
      if (animate) solvedBox.querySelector('.stamp').classList.add('stamp-in');
      return;
    }

    document.body.classList.remove('is-solved');
    status.textContent = 'ACTIU';
    lock.hidden = false;
    solvedBox.hidden = true;

    if (d.left <= 0) {
      setLocked(true);
      leftEl.textContent = '';
      setMsg('Has esgotat els intents d\'avui. El passatge torna a obrir-se demà.', true);
    } else {
      setLocked(false);
      leftEl.textContent = 'Intents restants avui: ' + d.left + ' de ' + (d.max || 3);
    }
  }

  function shake() {
    lock.classList.remove('shake');
    msg.classList.remove('flicker');
    void lock.offsetWidth;
    lock.classList.add('shake');
    msg.classList.add('flicker');
  }

  // 1) Lo último que se vio, al instante. 2) Lo que diga el servidor, que manda.
  var cached = load();
  if (cached) render(cached);
  else showClosed('Obrint el passatge…');

  fetch(API + '/prova/' + id, { cache: 'no-store' })
    .then(function (r) {
      if (r.status === 404) { forget(); showClosed('Només s\'hi entra amb invitació.'); return; }
      return r.json().then(function (d) { save(d); render(d); });
    })
    .catch(function () {
      if (!cached) showClosed('No hi ha connexió amb el passatge. Torna-ho a provar.');
    });

  // Casillas: solo dígitos, avance automático, retroceso y pegar
  inputs.forEach(function (input, i) {
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
      if (!button.disabled) setMsg('');
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
    });
    input.addEventListener('paste', function (e) {
      var digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach(function (d, j) { if (inputs[j]) inputs[j].value = d; });
      inputs[Math.min(digits.length, 4) - 1].focus();
    });
  });

  lock.addEventListener('submit', function (e) {
    e.preventDefault();
    var codi = inputs.map(function (x) { return x.value; }).join('');
    if (codi.length < 4) { setMsg('Calen quatre xifres.', true); return; }

    button.disabled = true;
    setMsg('Comprovant…');
    fetch(API + '/prova/' + id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codi: codi })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        button.disabled = false;
        if (d.error) { setMsg('Calen quatre xifres.', true); return; }
        save(d);
        if (d.solved) { setMsg(''); render(d, true); return; }
        render(d);
        if (d.wrong) {
          if (!d.locked) setMsg('ERROR · El comentari segueix actiu.', true);
          shake();
          inputs.forEach(function (x) { x.value = ''; });
          if (!d.locked) inputs[0].focus();
        }
      })
      .catch(function () {
        button.disabled = false;
        setMsg('No hi ha connexió amb el passatge. Torna-ho a provar.', true);
      });
  });
})();
