import { getCountdown } from './countdown.mjs';

const counter = document.querySelector('#countdown');
const title = document.querySelector('#countdown-title');
const message = document.querySelector('#countdown-message');
const units = [
  ['days', 'jour'], ['hours', 'heure'], ['minutes', 'minute'], ['seconds', 'seconde'],
].map(([id, label]) => ({
  id, label,
  valueElement: document.getElementById(id),
  labelElement: document.getElementById(`${id}-label`),
}));

function updateCountdown() {
  const remaining = getCountdown();
  counter.hidden = remaining.state !== 'upcoming';
  if (remaining.state === 'upcoming') {
    for (const { id, label, valueElement, labelElement } of units) {
      valueElement.textContent = String(remaining[id]).padStart(2, '0');
      labelElement.textContent = label + (remaining[id] > 1 ? 's' : '');
    }
  } else if (remaining.state === 'today') {
    title.textContent = 'Le grand jour est arrivé !';
    message.textContent = 'C’est aujourd’hui que l’on se dit oui. À tout à l’heure !';
  } else {
    title.textContent = 'Le début d’une belle suite.';
    message.textContent = 'Mariés depuis le 10 juin 2028. Merci de faire partie de notre histoire.';
  }
}

updateCountdown();
setInterval(updateCountdown, 1000);
