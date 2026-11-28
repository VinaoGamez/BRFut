import assert from 'node:assert/strict';
import { nextStackIndex, MODAL_STACK_BASE, isModalOpen } from '../js/ui/modal-stack.js';

assert.equal(nextStackIndex([]), MODAL_STACK_BASE, 'primeiro pop-up usa a base');
assert.equal(nextStackIndex([MODAL_STACK_BASE]), MODAL_STACK_BASE + 1, 'segundo fica por cima');
assert.equal(nextStackIndex([2300, 2305, 2302]), 2306, 'sempre acima do maior aberto');
assert.equal(nextStackIndex([NaN]), MODAL_STACK_BASE, 'ignora valores inválidos');
assert.equal(isModalOpen({ hidden: false, classList: { contains: () => false } }), true);
assert.equal(isModalOpen({ hidden: false, classList: { contains: c => c === 'hidden' } }), false);
assert.equal(isModalOpen({ hidden: true, classList: { contains: () => false } }), false);
console.log('modal-stack: OK');
