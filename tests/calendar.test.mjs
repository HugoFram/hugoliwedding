import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('le calendrier réserve uniquement le 10 juin, sans heure de cérémonie inventée', async () => {
  const calendar = await readFile(new URL('../public/hugoli-10-juin-2028.ics', import.meta.url), 'utf8');
  assert.ok(calendar.endsWith('\r\n'));
  assert.equal(calendar.replaceAll('\r\n', '').includes('\n'), false);
  for (const line of calendar.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `Ligne iCalendar trop longue : ${line}`);
  }
  const unfolded = calendar.replace(/\r\n[ \t]/g, '');
  assert.match(unfolded, /DTSTART;VALUE=DATE:20280610\r\n/);
  assert.match(unfolded, /DTEND;VALUE=DATE:20280611\r\n/);
  assert.match(unfolded, /LOCATION:Château des Comtes de Challes/);
  assert.match(unfolded, /SUMMARY:Mariage d’Hugo et Olivia/);
});
