import { Injectable, inject } from '@angular/core';
import { Flow, Execution, ExecutionLog } from '../models/flow.model';
import { MockDataService } from './mock-data.service';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

interface ClientAction {
  _clientAction: 'notification' | 'alert' | 'save-to-storage';
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private data = inject(MockDataService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  async executeFlow(
    flow: Flow,
    onBlockStart?: (blockId: string) => void,
    onBlockEnd?: (blockId: string) => void,
  ): Promise<Execution> {
    // Fire request; meanwhile show running on the first trigger block for feedback
    const firstBlock = flow.blocks.find((b) => b.category === 'trigger') ?? flow.blocks[0];
    if (firstBlock) onBlockStart?.(firstBlock.id);

    const execution = await this.api.post<Execution>(`/flows/${flow.id}/run`, {});

    // Replay logs to animate block-by-block feedback
    for (const log of execution.logs) {
      onBlockStart?.(log.blockId);
      await this.handleClientAction(log);
      await sleep(120);
      onBlockEnd?.(log.blockId);
    }

    this.data.addExecution(execution);
    return execution;
  }

  private async handleClientAction(log: ExecutionLog): Promise<void> {
    const out = log.output as ClientAction | undefined;
    if (!out || typeof out !== 'object' || !('_clientAction' in out)) return;

    switch (out._clientAction) {
      case 'notification': {
        const title = String(out['title'] ?? 'Flowlet');
        const message = String(out['message'] ?? '');
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            try {
              await Notification.requestPermission();
            } catch {}
          }
          if (Notification.permission === 'granted') {
            new Notification(title, { body: message, icon: '/favicon.ico' });
          }
        }
        break;
      }
      case 'alert': {
        const message = String(out['message'] ?? '');
        const showData = out['showData'] !== false;
        let text = message;
        if (showData && out['data'] != null) {
          text += '\n\n' + JSON.stringify(out['data'], null, 2);
        }
        alert(text);
        break;
      }
      case 'save-to-storage': {
        const key = String(out['key'] ?? 'flowlet-output');
        try {
          localStorage.setItem(key, JSON.stringify(out['value'] ?? null));
        } catch {}
        break;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
