import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const load = (name) => readFile(new URL(`./output/search-pool-audit/${name}`, import.meta.url), 'utf8').then(JSON.parse);
test('D1 reproduces exact walk-forward score 920', async () => assert.equal((await load('D_first22_top900.json')).exact_walk_forward.stats.score, 920));
for (const name of ['D_all33_top2500.json', 'D_all33_diverse2500.json']) test(`${name} keeps test winners outside training and pool at 2500`, async () => { const x = await load(name); assert.equal(x.pool_size, 2500); assert.ok(x.exact_walk_forward.all_leakage_checks); for (const split of x.exact_walk_forward.splits) { assert.equal(split.pool_size, 2500); assert.ok(split.train.every((i) => i < split.test[0])); for (const ticket of split.tickets) assert.equal(ticket.length, 6) && assert.equal(new Set(ticket).size, 6) && assert.ok(ticket.every((n) => n >= 1 && n <= 45)); } });
