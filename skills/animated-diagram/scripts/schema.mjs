// schema.mjs — the diagram format, v1: canvas presets and validateDiagram(). Plain JS (no Node or browser APIs).
//   validateDiagram(d, { icons: Set<string> }) -> { ok, errors }, each error "<json path>: <what is wrong>".

// maxGifBytes is the GIF upload cap of the platform each preset is made for, checked 2026-10-24:
//   LinkedIn (linkedin-portrait): 5 MB. LinkedIn publishes no GIF limit of its own; 5 MB is from
//     https://authoredup.com/blog/how-to-post-a-gif-to-linkedin (third party).
//   Instagram (square): no published GIF upload limit (Instagram turns uploads into video), so the 5_000_000 default.
//   X (landscape): 15 MB, at most 1280×1080 and 350 frames — https://docs.x.com/x-api/media/quickstart/best-practices
import { ZONE_NAMES } from './colour.mjs';

export const CANVAS = {
  'linkedin-portrait': { w: 1080, h: 1350, maxGifBytes: 5_000_000 },
  square: { w: 1080, h: 1080, maxGifBytes: 5_000_000 },
  landscape: { w: 1200, h: 675, maxGifBytes: 15_000_000 },
};
export const DEFAULTS = { canvas: 'linkedin-portrait', still: 45 };
export const TEMPLATES = ['flow-grid', 'comparison', 'stack'];
export const NODE_TYPES = ['icon', 'text', 'tray'];
export const KINDS = ['normal', 'hit', 'miss', 'retry', 'solid'];
const PANELS = { 'flow-grid': 1, comparison: 2, stack: 1 };
const FIELDS = {
  diagram: ['canvas', 'template', 'title', 'subtitle', 'footer', 'still', 'panels'],
  panel: ['title', 'grid', 'nodes', 'groups', 'steps'],
  grid: ['cols', 'rows'],
  node: ['id', 'type', 'icon', 'name', 'sub', 'cell', 'items', 'offset'],
  item: ['icon', 'caption'],
  group: ['label', 'nodes', 'color'],
  step: ['n', 'from', 'to', 'label', 'kind', 'reply'],
};
const RULEBOOK = 'reference/icon-rulebook.md';

// Everyday names for what a library icon shows, so "kafka" suggests queue rather than whatever is spelt alike.
const ALIASES = {
  queue: 'kafka rabbitmq sqs pubsub broker stream topic message messages mq kinesis nats eventbus',
  database: 'db postgres postgresql mysql sql mongo mongodb dynamodb storage store warehouse vector vectordb sqlite',
  cache: 'redis memcached memcache',
  laptop: 'browser client web desktop computer pc frontend',
  user: 'person people customer human account',
  phone: 'mobile app ios android smartphone',
  rack: 'server servers backend compute host vm instance',
  tower: 'origin datacenter mainframe',
  globe: 'dns internet world network',
  'cdn-edge': 'cdn edge pop',
  'load-balancer': 'lb balancer nginx haproxy proxy router',
  api: 'gateway rest graphql endpoint service microservice cloud',
  lock: 'auth authentication encryption tls ssl https',
  key: 'token jwt secret apikey credential credentials password',
  shield: 'firewall waf security protection ddos',
  document: 'file pdf doc docs page report text',
  'llm-chip': 'llm gpt model ai chip gpu ml claude agent',
  container: 'docker kubernetes k8s pod package',
  'code-window': 'code ide terminal editor script function lambda',
  stopwatch: 'timer ttl clock time latency timeout',
};
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Up to n library names closest to `name`: icons it is an everyday name for first, then by spelling.
export function closestIcons(name, icons, n = 3) {
  const q = norm(name), lib = [...icons];
  const byMeaning = lib.filter(i => (ALIASES[i] ?? '').split(' ').includes(q));
  const bySpelling = lib.filter(i => !byMeaning.includes(i)).sort((a, b) => editDistance(q, norm(a)) - editDistance(q, norm(b)) || a.localeCompare(b));
  return [...byMeaning, ...bySpelling].slice(0, n);
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = list => `is not one of ${list.join(', ')}`;

export function validateDiagram(d, { icons }) {
  const errors = [], err = (path, msg) => errors.push(`${path}: ${msg}`);
  if (!isObj(d)) return { ok: false, errors: ['diagram: must be a JSON object'] };
  const unknown = (obj, kind, at) => { for (const key of Object.keys(obj)) if (!FIELDS[kind].includes(key)) err(at(key), `unknown field — allowed: ${FIELDS[kind].join(', ')}`); };
  const iconName = (v, at) => {
    if (!isStr(v)) return err(at, 'required: a library icon name (run "cli.mjs icons" for the list)');
    if (!icons.has(v)) err(at, `unknown icon "${v}" — closest: ${closestIcons(v, icons).join(', ')}; to add one, see ${RULEBOOK}`);
  };

  unknown(d, 'diagram', k => k);
  if (d.canvas !== undefined && !CANVAS[d.canvas]) err('canvas', `"${d.canvas}" ${oneOf(Object.keys(CANVAS))}`);
  if (d.template === undefined) err('template', `required (one of ${TEMPLATES.join(', ')})`);
  else if (!TEMPLATES.includes(d.template)) err('template', `"${d.template}" ${oneOf(TEMPLATES)}`);
  const tpl = TEMPLATES.includes(d.template) ? d.template : null;
  if (d.title === undefined) { if (tpl && tpl !== 'comparison') err('title', `required for a ${tpl} diagram (the headline)`); }
  else if (!isStr(d.title)) err('title', 'must be a non-empty string');
  if (d.subtitle !== undefined && !isStr(d.subtitle)) err('subtitle', 'must be a non-empty string');
  if (d.footer !== undefined && typeof d.footer !== 'string') err('footer', 'must be a string');
  if (d.still !== undefined && !isInt(d.still, 0, 89)) err('still', 'must be an integer from 0 to 89 (the frame used for the PNG)');
  if (!Array.isArray(d.panels)) { err('panels', 'must be a list of panels'); return { ok: false, errors }; }
  if (tpl && d.panels.length !== PANELS[tpl]) err('panels', `a ${tpl} has exactly ${PANELS[tpl]} panel${PANELS[tpl] > 1 ? 's' : ''}, this one has ${d.panels.length}`);

  d.panels.forEach((p, pi) => {
    const P = `panels[${pi}]`;
    if (!isObj(p)) return err(P, 'must be an object with grid, nodes and steps');
    unknown(p, 'panel', k => `${P}.${k}`);
    if (p.title === undefined) { if (tpl === 'comparison') err(`${P}.title`, 'required in a comparison (the pill over the panel)'); }
    else if (!isStr(p.title)) err(`${P}.title`, 'must be a non-empty string');

    let cols = 0, rows = 0;
    if (!isObj(p.grid)) err(`${P}.grid`, 'required: { "cols": 1–4, "rows": 1–6 }');
    else {
      unknown(p.grid, 'grid', k => `${P}.grid.${k}`);
      if (!isInt(p.grid.cols, 1, 4)) err(`${P}.grid.cols`, 'must be an integer from 1 to 4'); else cols = p.grid.cols;
      if (!isInt(p.grid.rows, 1, 6)) err(`${P}.grid.rows`, 'must be an integer from 1 to 6'); else rows = p.grid.rows;
    }

    const ids = new Map(), cells = new Map();         // id -> node, "c,r" -> id
    if (!Array.isArray(p.nodes) || !p.nodes.length) err(`${P}.nodes`, 'must be a list of at least one node');
    else p.nodes.forEach((n, ni) => {
      const N = `${P}.nodes[${ni}]`;
      if (!isObj(n)) return err(N, 'must be an object');
      unknown(n, 'node', k => `${N}.${k}`);
      if (!isStr(n.id)) err(`${N}.id`, 'required: a short unique name the steps refer to');
      else if (ids.has(n.id)) err(`${N}.id`, `"${n.id}" is used twice in this panel`);
      else ids.set(n.id, n);
      const type = n.type ?? 'icon';
      if (!NODE_TYPES.includes(type)) err(`${N}.type`, `"${n.type}" ${oneOf(NODE_TYPES)}`);
      if (!isStr(n.name)) err(`${N}.name`, 'required: the text the node shows');
      if (n.sub !== undefined && typeof n.sub !== 'string') err(`${N}.sub`, 'must be a string');
      if (type === 'icon') { if (n.icon === undefined) err(`${N}.icon`, 'required for an icon node (run "cli.mjs icons" for the list)'); else iconName(n.icon, `${N}.icon`); }
      else if (n.icon !== undefined) err(`${N}.icon`, `only icon nodes take an icon; this node is a ${type}`);
      if (type === 'tray') {
        if (!Array.isArray(n.items)) err(`${N}.items`, 'required for a tray: a list of { "icon", "caption" }');
        else {
          if (n.items.length < 2 || n.items.length > 6) err(`${N}.items`, `a tray holds 2 to 6 items, this one has ${n.items.length}`);
          n.items.forEach((it, ii) => {
            const I = `${N}.items[${ii}]`;
            if (!isObj(it)) return err(I, 'must be { "icon", "caption" }');
            unknown(it, 'item', k => `${I}.${k}`);
            iconName(it.icon, `${I}.icon`);
            if (typeof it.caption !== 'string') err(`${I}.caption`, 'required: the text under the icon');
          });
        }
      } else if (n.items !== undefined) err(`${N}.items`, `only tray nodes take items; this node is a ${type}`);
      if (n.offset !== undefined && !(Array.isArray(n.offset) && n.offset.length === 2 && n.offset.every(Number.isFinite))) err(`${N}.offset`, 'must be [dx, dy] in px');
      if (!(Array.isArray(n.cell) && n.cell.length === 2 && n.cell.every(Number.isInteger))) err(`${N}.cell`, 'required: [col, row], counted from 0');
      else if (cols && rows) {
        const [c, r] = n.cell;
        if (c < 0 || c >= cols || r < 0 || r >= rows) err(`${N}.cell`, `[${c}, ${r}] is outside the ${cols}×${rows} grid (cols 0–${cols - 1}, rows 0–${rows - 1})`);
        else if (cells.has(`${c},${r}`)) err(`${N}.cell`, `[${c}, ${r}] is already taken by "${cells.get(`${c},${r}`)}"`);
        else cells.set(`${c},${r}`, n.id);
      }
    });
    const rowOf = id => { const c = ids.get(id)?.cell; return Array.isArray(c) && Number.isInteger(c[1]) ? c[1] : null; };

    if (p.groups !== undefined) {
      if (!Array.isArray(p.groups)) err(`${P}.groups`, 'must be a list of { "label", "nodes" }');
      else p.groups.forEach((g, gi) => {
        const G = `${P}.groups[${gi}]`;
        if (!isObj(g)) return err(G, 'must be { "label", "nodes" }');
        unknown(g, 'group', k => `${G}.${k}`);
        if (!isStr(g.label)) err(`${G}.label`, 'required: the group title');
        if (g.color !== undefined) {
          if (!ZONE_NAMES.includes(g.color)) err(`${G}.color`, `"${g.color}" ${oneOf(ZONE_NAMES)}`);
          else if (p.groups.slice(0, gi).some(o => o?.color === g.color)) err(`${G}.color`, `"${g.color}" is already used by another group`);
        }
        if (!Array.isArray(g.nodes) || !g.nodes.length) return err(`${G}.nodes`, 'must be a list of at least one node id');
        for (const id of g.nodes) if (!ids.has(id)) err(`${G}.nodes`, `no node "${id}" in this panel`);
        if (tpl === 'stack') {
          const rs = [...new Set(g.nodes.map(rowOf).filter(r => r !== null))].sort((a, b) => a - b);
          if (rs.length > 1) err(`${G}.nodes`, `a stack group is one row, this one spans rows ${rs.join(' and ')}`);
        }
      });
    }

    const numbers = new Set();
    if (!Array.isArray(p.steps)) err(`${P}.steps`, 'must be a list of steps (it may be empty)');
    else p.steps.forEach((s, si) => {
      const S = `${P}.steps[${si}]`;
      if (!isObj(s)) return err(S, 'must be an object with from, to and label');
      unknown(s, 'step', k => `${S}.${k}`);
      for (const end of ['from', 'to']) {
        if (!isStr(s[end])) err(`${S}.${end}`, 'required: a node id');
        else if (ids.size && !ids.has(s[end])) err(`${S}.${end}`, `no node "${s[end]}" in this panel`);
      }
      if (isStr(s.from) && s.from === s.to) err(S, 'from and to are the same node');
      if (typeof s.label !== 'string') err(`${S}.label`, 'required: the text beside the arrow');
      if (s.n !== undefined) {
        if (!isInt(s.n, 1, 99)) err(`${S}.n`, 'must be an integer from 1 to 99');
        else if (numbers.has(s.n)) err(`${S}.n`, `step ${s.n} is numbered twice`);
        else numbers.add(s.n);
      }
      if (s.kind !== undefined && !KINDS.includes(s.kind)) err(`${S}.kind`, `"${s.kind}" ${oneOf(KINDS)}`);
      if (s.reply !== undefined && typeof s.reply !== 'boolean') err(`${S}.reply`, 'must be true or false');
      if (tpl === 'stack') {
        const a = rowOf(s.from), b = rowOf(s.to);
        if (a !== null && b !== null && Math.abs(a - b) !== 1) err(S, `a stack step joins adjacent rows, this one joins rows ${Math.min(a, b)} and ${Math.max(a, b)}`);
      }
    });
  });
  return { ok: errors.length === 0, errors };
}
