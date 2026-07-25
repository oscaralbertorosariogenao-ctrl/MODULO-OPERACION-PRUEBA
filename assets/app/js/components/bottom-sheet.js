import { openModal } from './modal.js';
export function openBottomSheet(options){ return openModal({ ...options, size:'bottom-sheet' }); }
