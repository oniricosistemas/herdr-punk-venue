import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutBanner } from './banner-layout.mjs';

const cases = [
  ['Alerta Roja', ['ALERTA ROJA'], false],
  ['Los Violadores', ['LOS', 'VIOLADORES'], false],
  ['Todos Tus Muertos', ['TODOS TUS', 'MUERTOS'], true],
  ['Boom Boom Kid', ['BOOM', 'BOOM KID'], true],
  ['Embajada Boliviana', ['EMBAJADA', 'BOLIVIANA'], true],
];
for (const [name, lines, condensed] of cases) {
  test(`exact accessible name and capitalized layout: ${name}`, () => {
    assert.deepEqual(layoutBanner(name), { name, lines, condensed });
  });
}
test('11/12/16/17-character boundaries select one/two lines and condensation', () => {
  for (const [name, count, condensed] of [
    ['AAAAA BBBBB', 1, false], ['AAAAA BBBBBB', 2, false],
    ['AAAAAAA BBBBBBBB', 2, false], ['AAAAAAAA BBBBBBBB', 2, true],
  ]) {
    const result = layoutBanner(name);
    assert.equal(result.lines.length, count, name);
    assert.equal(result.condensed, condensed, name);
    assert.equal(result.name, name);
    assert.equal(result.lines.join(' '), name);
  }
});
test('all seven explicitly designated long names use two condensed lines', () => {
  for (const name of ['Todos Tus Muertos', 'Cadena Perpetua', 'Eterna Inocencia',
    'Embajada Boliviana', 'Cultura Violenta', 'Sugar Tampaxxx', 'Boom Boom Kid']) {
    const result = layoutBanner(name);
    assert.equal(result.name, name);
    assert.equal(result.lines.length, 2, name);
    assert.equal(result.condensed, true, name);
    assert.equal(result.lines.join(' '), name.toUpperCase());
  }
});
test('short spelling, digits and hyphen remain intact', () => {
  for (const name of ['Flema', 'Argies', 'Attaque 77', '2 Minutos', 'Fun People',
    'Loquero', 'Sin Ley', 'Bulldog', 'She-Devils', 'ENTRADA']) {
    assert.deepEqual(layoutBanner(name), { name, lines: [name.toUpperCase()], condensed: false });
  }
});
