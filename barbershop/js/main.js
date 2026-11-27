// =========================================================
// Общие скрипты лендинга: меню, маска телефона, форма заявки,
// вкладки, появление блоков. Подходит для всех шаблонов.
// Телефон для сообщений об ошибке берётся из <body data-phone="...">
// =========================================================
const SITE_PHONE = document.body.dataset.phone || '';

// ---------- 1. Тень у шапки при прокрутке ----------
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- 2. Мобильное меню ----------
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

function setMenu(open) {
  burger.classList.toggle('is-open', open);
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  document.body.style.overflow = open ? 'hidden' : '';
}
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
window.matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

// ---------- 3. FAQ: открыт только один вопрос ----------
const faqItems = document.querySelectorAll('.faq__item');
faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach(other => { if (other !== item) other.open = false; });
  });
});

// ---------- 4. Вкладки (если есть на странице) ----------
document.querySelectorAll('[data-tabs]').forEach(group => {
  const buttons = group.querySelectorAll('[role="tab"]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        const active = b === btn;
        b.setAttribute('aria-selected', String(active));
        b.tabIndex = active ? 0 : -1;
        document.getElementById(b.getAttribute('aria-controls')).hidden = !active;
      });
    });
    btn.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const list = [...buttons];
      const next = list[(list.indexOf(btn) + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      next.focus();
      next.click();
    });
  });
});

// ---------- 5. Кнопки «Записаться» с выбором услуги ----------
// <a href="#booking" data-pick="Мужская стрижка"> подставит услугу в форму
document.querySelectorAll('[data-pick]').forEach(link => {
  link.addEventListener('click', () => {
    const select = document.querySelector('#booking-form select[data-label="Услуга"]');
    if (!select) return;
    const option = [...select.options].find(o => o.text === link.dataset.pick);
    if (option) select.value = option.value;
  });
});

// ---------- 6. Маска телефона: +7 (900) 123-45-67 ----------
const phoneInput = document.getElementById('phone');

function formatPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);
  const d = digits.slice(1);
  let out = '+7';
  if (d.length > 0) out += ' (' + d.slice(0, 3);
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ' ' + d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += '-' + d.slice(8, 10);
  return out;
}
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value ? formatPhone(phoneInput.value) : '';
});
phoneInput.addEventListener('focus', () => { if (!phoneInput.value) phoneInput.value = '+7 ('; });
phoneInput.addEventListener('blur', () => { if (phoneInput.value.replace(/\D/g, '').length <= 1) phoneInput.value = ''; });

// ---------- 7. Отправка формы ----------
const FORM_ENDPOINT = 'send.php';
// Без PHP (локально, GitHub Pages, Netlify) форма работает в демо-режиме:
// показывает «Спасибо», но никуда не отправляет. На хостинге с PHP — отправляет в Telegram.
// Принудительно включить отправку: добавить к адресу ?live
const DEMO_MODE = (['localhost', '127.0.0.1'].includes(location.hostname)
  || /github\.io$|netlify\.app$|vercel\.app$/.test(location.hostname)
  || location.protocol === 'file:') && !location.search.includes('live');

const form = document.getElementById('booking-form');
const errorBox = document.getElementById('form-error');
const successBox = document.getElementById('form-success');
const submitBtn = form.querySelector('button[type="submit"]');
const submitText = submitBtn.textContent;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim();
  const phoneDigits = form.elements.phone.value.replace(/\D/g, '');
  const consent = form.elements.consent.checked;

  form.elements.name.classList.toggle('is-invalid', name.length < 2);
  form.elements.phone.classList.toggle('is-invalid', phoneDigits.length !== 11);
  form.elements.consent.closest('.form__consent').classList.toggle('is-invalid', !consent);

  if (name.length < 2) return showError('Пожалуйста, укажите имя');
  if (phoneDigits.length !== 11) return showError('Проверьте номер телефона');
  if (!consent) return showError('Нужно согласие на обработку данных');
  showError('');

  // Все поля с data-label уходят в заявку как «Название: значение»
  const fields = {};
  form.querySelectorAll('[data-label]').forEach(el => {
    const value = el.tagName === 'SELECT' ? el.options[el.selectedIndex].text : el.value.trim();
    if (value) fields[el.dataset.label] = value;
  });

  const data = {
    name,
    phone: form.elements.phone.value,
    fields,
    consent,
    website: form.elements.website.value, // ловушка для ботов
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправляем…';

  try {
    if (DEMO_MODE) {
      console.log('Демо-режим, заявка не отправлена:', data);
      await new Promise(r => setTimeout(r, 700));
    } else {
      const response = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      let result = null;
      try { result = await response.json(); } catch { /* сервер ответил не JSON */ }
      if (!response.ok || !result || !result.ok) {
        throw new Error(result && result.error ? result.error : 'Не удалось отправить заявку. Пожалуйста, позвоните нам.');
      }
    }
    successBox.hidden = false;
    form.reset();
  } catch (err) {
    const message = err instanceof TypeError ? 'Нет связи с сервером. Проверьте интернет или позвоните нам.' : err.message;
    showError(message + (SITE_PHONE ? ' ' + SITE_PHONE : ''));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = submitText;
  }
});

document.getElementById('form-again')?.addEventListener('click', () => { successBox.hidden = true; });

function showError(text) { errorBox.textContent = text; }

form.addEventListener('input', e => e.target.classList.remove('is-invalid'));
form.elements.consent.addEventListener('change', () => form.elements.consent.closest('.form__consent').classList.remove('is-invalid'));

// ---------- 8. Плавное появление блоков при прокрутке ----------
const revealTargets = document.querySelectorAll('[data-reveal] > *, .section__head');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 4) * 70 + 'ms';
    io.observe(el);
  });
}

// ---------- 9. Год в подвале ----------
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
