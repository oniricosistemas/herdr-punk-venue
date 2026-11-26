// Pure layout policy. Exact source casing belongs in the accessibility label;
// uppercase stencil shapes are the owner-approved visible treatment.
const condensedNames = new Set([
  'Todos Tus Muertos', 'Cadena Perpetua', 'Eterna Inocencia',
  'Embajada Boliviana', 'Cultura Violenta', 'Sugar Tampaxxx', 'Boom Boom Kid',
]);
export function layoutBanner(name) {
  const caps = name.toUpperCase();
  const condensed = name.length > 16 || condensedNames.has(name);
  if (name.length <= 11 && !condensed) return { name, lines: [caps], condensed };
  const words = caps.split(' ');
  const candidates = [];
  for (let i = 1; i < words.length; i++) {
    candidates.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
  }
  // Minimize the longest line; retain the first word boundary on a tie.
  candidates.sort((a, b) => Math.max(...a.map(s => s.length)) - Math.max(...b.map(s => s.length)));
  const lines = candidates[0] ?? [caps.slice(0, Math.ceil(caps.length / 2)), caps.slice(Math.ceil(caps.length / 2))];
  return { name, lines, condensed };
}
