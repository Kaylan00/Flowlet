import { Injectable, inject, signal, effect } from '@angular/core';
import {
  Flow,
  Execution,
  FlowBlock,
  BlockDefinition,
  FlowTemplate,
} from '../models/flow.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/**
 * Flowlet data service — API-backed.
 * Keeps signal-based interface expected by components; fetches from backend.
 */
@Injectable({ providedIn: 'root' })
export class MockDataService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private nextLocalId = Date.now();

  flows = signal<Flow[]>([]);
  executions = signal<Execution[]>([]);
  loading = signal(false);
  ready = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.refreshAll();
      } else {
        this.flows.set([]);
        this.executions.set([]);
        this.ready.set(false);
      }
    });
  }

  async refreshAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [flows, execs] = await Promise.all([
        this.api.get<Flow[]>('/flows'),
        this.api.get<Execution[]>('/executions', { limit: 100 }),
      ]);
      this.flows.set(flows);
      this.executions.set(execs);
      this.ready.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  // --- Flow reads ---

  getFlow(id: string): Flow | undefined {
    return this.flows().find((f) => f.id === id);
  }

  async fetchFlow(id: string): Promise<Flow> {
    const flow = await this.api.get<Flow>(`/flows/${id}`);
    this.flows.update((flows) => {
      const idx = flows.findIndex((f) => f.id === id);
      if (idx === -1) return [flow, ...flows];
      const next = [...flows];
      next[idx] = flow;
      return next;
    });
    return flow;
  }

  // --- Flow writes ---

  async saveFlow(flow: Flow): Promise<Flow> {
    const nameTaken = this.flows().find(
      (f) => f.name.trim().toLowerCase() === flow.name.trim().toLowerCase() && f.id !== flow.id
    );
    if (nameTaken) throw new Error(`Já existe um fluxo chamado "${flow.name}"`);

    const existing = this.flows().some((f) => f.id === flow.id && f.id !== '');
    const payload = {
      name: flow.name,
      description: flow.description,
      blocks: flow.blocks,
      connections: flow.connections,
      status: flow.status,
    };
    let saved: Flow;
    if (existing) {
      saved = await this.api.put<Flow>(`/flows/${flow.id}`, payload);
    } else {
      saved = await this.api.post<Flow>('/flows', payload);
    }
    this.flows.update((flows) => {
      const idx = flows.findIndex((f) => f.id === saved.id);
      if (idx === -1) return [saved, ...flows];
      const next = [...flows];
      next[idx] = saved;
      return next;
    });
    return saved;
  }

  async createFlowFromTemplate(template: FlowTemplate): Promise<Flow> {
    const nameTaken = this.flows().find(
      (f) => f.name.trim().toLowerCase() === template.name.trim().toLowerCase()
    );
    if (nameTaken) throw new Error(`Já existe um fluxo chamado "${template.name}"`);

    const blocks = template.blocks.map((b) => ({ ...b, id: `block-${++this.nextLocalId}` }));
    const idMap = new Map(template.blocks.map((ob, i) => [ob.id, blocks[i]!.id]));
    const connections = template.connections.map((c) => ({
      id: `conn-${++this.nextLocalId}`,
      sourceId: idMap.get(c.sourceId) ?? c.sourceId,
      targetId: idMap.get(c.targetId) ?? c.targetId,
    }));
    const flow = await this.api.post<Flow>('/flows', {
      name: template.name,
      description: template.description,
      blocks,
      connections,
      status: 'draft',
    });
    this.flows.update((flows) => [flow, ...flows]);
    return flow;
  }

  async deleteFlow(id: string): Promise<void> {
    await this.api.delete<void>(`/flows/${id}`);
    this.flows.update((flows) => flows.filter((f) => f.id !== id));
    this.executions.update((execs) => execs.filter((e) => e.flowId !== id));
  }

  async toggleFlowStatus(id: string): Promise<void> {
    const updated = await this.api.post<Flow>(`/flows/${id}/toggle`, {});
    this.flows.update((flows) => flows.map((f) => (f.id === id ? updated : f)));
  }

  async duplicateFlow(id: string): Promise<Flow | undefined> {
    try {
      const dup = await this.api.post<Flow>(`/flows/${id}/duplicate`, {});
      this.flows.update((flows) => [dup, ...flows]);
      return dup;
    } catch {
      return undefined;
    }
  }

  // --- Execution ---

  addExecution(exec: Execution): void {
    // Called by the ExecutionService after a remote run
    this.executions.update((execs) => [exec, ...execs]);
    this.flows.update((flows) =>
      flows.map((f) => (f.id === exec.flowId ? { ...f, executionCount: f.executionCount + 1 } : f)),
    );
  }

  async refreshExecutions(): Promise<void> {
    const execs = await this.api.get<Execution[]>('/executions', { limit: 100 });
    this.executions.set(execs);
  }

  // --- Block factory (local, server doesn't care about this) ---

  createBlockFromDefinition(def: BlockDefinition, position: { x: number; y: number }): FlowBlock {
    return {
      id: `block-${++this.nextLocalId}`,
      definitionId: def.id,
      category: def.category,
      label: def.name,
      icon: def.icon,
      color: def.color,
      position,
      properties: def.properties.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.type,
        value: p.default,
        options: p.options,
        placeholder: p.placeholder,
      })),
    };
  }
}
