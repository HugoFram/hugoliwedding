import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountdown, WEDDING_START, WEDDING_END } from '../public/assets/countdown.mjs';

test('décompose le temps restant sans dépendre du fuseau du visiteur', () => {
  assert.deepEqual(getCountdown(WEDDING_START - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000), {
    state: 'upcoming', days: 2, hours: 3, minutes: 4, seconds: 5,
  });
  assert.equal(WEDDING_START, Date.parse('2028-06-09T22:00:00Z'));
});
test('ne finit pas une fraction de seconde avant le mariage', () => {
  assert.equal(getCountdown(WEDDING_START - 1).seconds, 1);
  assert.equal(getCountdown(WEDDING_START - 1).state, 'upcoming');
});
test('affiche le grand jour pendant toute la journée en France', () => {
  assert.equal(getCountdown(WEDDING_START).state, 'today');
  assert.equal(getCountdown(WEDDING_END - 1).state, 'today');
});
test('passe au souvenir après le mariage, sans valeurs négatives', () => {
  assert.deepEqual(getCountdown(WEDDING_END), { state: 'past', days: 0, hours: 0, minutes: 0, seconds: 0 });
});
test('rejette une date invalide', () => {
  assert.throws(() => getCountdown(NaN), TypeError);
});
