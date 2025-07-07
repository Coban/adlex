import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

// ブラウザ環境用のMSWワーカー
export const worker = setupWorker(...handlers); 