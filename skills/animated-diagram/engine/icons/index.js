// index.js — the bundled icon library. A project's own icons (diagram-icons/) override these by name.
import laptop from './laptop.js';
import globe from './globe.js';
import rack from './rack.js';
import cache from './cache.js';
import tower from './tower.js';
import stopwatch from './stopwatch.js';
import user from './user.js';
import phone from './phone.js';
import database from './database.js';
import queue from './queue.js';
import loadBalancer from './load-balancer.js';
import api from './api.js';
import cdnEdge from './cdn-edge.js';
import lock from './lock.js';
import key from './key.js';
import shield from './shield.js';
import doc from './document.js';
import llmChip from './llm-chip.js';
import container from './container.js';
import codeWindow from './code-window.js';

export const ICONS = Object.fromEntries([laptop, globe, rack, cache, tower, stopwatch, user, phone, database, queue, loadBalancer, api, cdnEdge, lock, key, shield, doc, llmChip, container, codeWindow].map(m => [m.name, m]));
