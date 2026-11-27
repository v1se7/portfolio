// =========================================================
// Калькулятор стоимости работ.
// Цены задаются в HTML (data-price), класс авто — множитель.
// Кнопка «Записаться с этим списком» переносит выбор в форму заявки.
// =========================================================
const calcForm = document.getElementById('calc-form');
const calcSum = document.getElementById('calc-sum');
const calcList = document.getElementById('calc-list');
const money = n => Math.round(n / 50) * 50; // округляем до 50 ₽
const fmt = n => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

function calcUpdate() {
  const k = parseFloat(calcForm.querySelector('[name="carClass"]:checked').value);
  const checked = [...calcForm.querySelectorAll('[data-price]:checked')];
  const total = checked.reduce((sum, el) => sum + money(+el.dataset.price * k), 0);
  calcSum.textContent = checked.length ? fmt(total) : '—';

  // цены в списке тоже пересчитываем под класс машины
  calcForm.querySelectorAll('[data-price]').forEach(el => {
    el.parentElement.querySelector('b').textContent = fmt(money(+el.dataset.price * k));
  });
  return { k, checked, total };
}

calcForm.addEventListener('change', calcUpdate);
calcUpdate();

document.getElementById('calc-book').addEventListener('click', () => {
  const { k, checked, total } = calcUpdate();
  const carClass = calcForm.querySelector('[name="carClass"]:checked').parentElement.querySelector('span').firstChild.textContent.trim();
  calcList.value = checked.length
    ? `${carClass}: ${checked.map(el => el.dataset.name).join(', ')} — ~${fmt(total)}`
    : '';
  // если в калькуляторе только ТО-работы, выбираем «Техобслуживание»
  if (checked.length) document.getElementById('service').value = 'Техобслуживание';
});
