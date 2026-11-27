// =========================================================
// Стоматология «Мята» — скрипты
// =========================================================

// ---------- 1. Тень у шапки при прокрутке ----------
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- 2. Мобильное меню (бургер) ----------
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
// закрываем меню после клика по пункту
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
// и при переходе на широкий экран
window.matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

// ---------- 3. FAQ: открыт только один вопрос за раз ----------
const faqItems = document.querySelectorAll('.faq__item');
faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach(other => { if (other !== item) other.open = false; });
  });
});

// ---------- 4. Маска телефона: +7 (900) 123-45-67 ----------
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

// ---------- 5. Отправка формы записи ----------
// Куда отправляем заявку (серверный скрипт на хостинге)
const FORM_ENDPOINT = 'send.php';
// На локальном компьютере PHP нет, поэтому там форма работает в демо-режиме.
// Чтобы проверить настоящую отправку локально, добавьте к адресу ?live
const DEMO_MODE = (['localhost', '127.0.0.1'].includes(location.hostname)
  || /github\.io$|netlify\.app$|vercel\.app$/.test(location.hostname)
  || location.protocol === 'file:') && !location.search.includes('live');

const form = document.getElementById('booking-form');
const errorBox = document.getElementById('form-error');
const successBox = document.getElementById('form-success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const phoneDigits = form.phone.value.replace(/\D/g, '');
  const consent = form.consent.checked;

  // проверка полей
  form.name.classList.toggle('is-invalid', name.length < 2);
  form.phone.classList.toggle('is-invalid', phoneDigits.length !== 11);
  form.consent.closest('.form__consent').classList.toggle('is-invalid', !consent);

  if (name.length < 2) return showError('Пожалуйста, укажите имя');
  if (phoneDigits.length !== 11) return showError('Проверьте номер телефона');
  if (!consent) return showError('Нужно согласие на обработку данных');
  showError('');

  const data = {
    name,
    phone: form.phone.value,
    service: form.service.value,
    consent,
    website: form.website.value, // ловушка для ботов
  };

  // Токен Telegram-бота здесь НЕ хранится: этот файл видит любой посетитель.
  // Браузер отправляет заявку в send.php, а уже сервер пересылает её в Telegram.
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Отправляем…';

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
    // Сетевая ошибка или ошибка сервера: показываем понятный текст и телефон
    const message = err instanceof TypeError ? 'Нет связи с сервером. Проверьте интернет или позвоните нам.' : err.message;
    showError(message + ' +7 (900) 000-00-00');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Записаться';
  }
});

function showError(text) { errorBox.textContent = text; }

// убираем красную подсветку, когда пользователь исправляет поле
form.addEventListener('input', e => e.target.classList.remove('is-invalid'));
form.consent.addEventListener('change', () => form.consent.closest('.form__consent').classList.remove('is-invalid'));

// ---------- 6. Плавное появление блоков при прокрутке ----------
const revealTargets = document.querySelectorAll('.section__head, .service, .feature, .doctor, .review, .faq__item, .booking > *, .contacts > *');
if ('IntersectionObserver' in window) {
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
    el.style.transitionDelay = (i % 4) * 80 + 'ms';
    io.observe(el);
  });
}
