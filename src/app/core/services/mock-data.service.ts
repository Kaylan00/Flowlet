import { Injectable, signal, effect } from '@angular/core';
import { Flow, Execution, FlowBlock, BlockCategory, BLOCK_CATALOG, BlockDefinition, FlowTemplate, FLOW_TEMPLATES } from '../models/flow.model';

const STORAGE_FLOWS = 'flowlet-flows';
const STORAGE_EXECS = 'flowlet-executions';
const STORAGE_VERSION = 'flowlet-version';
const CURRENT_VERSION = '2';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private nextId = Date.now();

  flows: ReturnType<typeof signal<Flow[]>>;
  executions: ReturnType<typeof signal<Execution[]>>;

  constructor() {
    // Clear old data if model version changed
    if (localStorage.getItem(STORAGE_VERSION) !== CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_FLOWS);
      localStorage.removeItem(STORAGE_EXECS);
      localStorage.setItem(STORAGE_VERSION, CURRENT_VERSION);
    }
    this.flows = signal<Flow[]>(this.loadFlows());
    this.executions = signal<Execution[]>(this.loadExecutions());
    effect(() => { localStorage.setItem(STORAGE_FLOWS, JSON.stringify(this.flows())); });
    effect(() => { localStorage.setItem(STORAGE_EXECS, JSON.stringify(this.executions())); });
  }

  private loadFlows(): Flow[] {
    const saved = localStorage.getItem(STORAGE_FLOWS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return this.seedFlows();
  }

  private loadExecutions(): Execution[] {
    const saved = localStorage.getItem(STORAGE_EXECS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  }

  private seedFlows(): Flow[] {
    // Create flows from templates
    return FLOW_TEMPLATES.filter(t => t.id !== 'tpl-empty').map((tpl, i) => {
      const id = `flow-${i + 1}`;
      const blocks = tpl.blocks.map(b => ({ ...b, id: `b${++this.nextId}` }));
      const idMap = new Map(tpl.blocks.map((ob, j) => [ob.id, blocks[j].id]));
      const connections = tpl.connections.map(c => ({
        id: `c${++this.nextId}`,
        sourceId: idMap.get(c.sourceId) || c.sourceId,
        targetId: idMap.get(c.targetId) || c.targetId,
      }));
      return {
        id, name: tpl.name, description: tpl.description,
        blocks, connections,
        status: i === 0 ? 'active' as const : 'draft' as const,
        createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
      };
    });
  }

  // --- Flow CRUD ---
  getFlow(id: string): Flow | undefined {
    return this.flows().find(f => f.id === id);
  }

  saveFlow(flow: Flow): void {
    flow.updatedAt = new Date().toISOString();
    const exists = this.flows().some(f => f.id === flow.id);
    if (exists) {
      this.flows.update(flows => flows.map(f => f.id === flow.id ? { ...flow } : f));
    } else {
      this.flows.update(flows => [{ ...flow }, ...flows]);
    }
  }

  createFlowFromTemplate(template: FlowTemplate): Flow {
    const id = `flow-${++this.nextId}`;
    const now = new Date().toISOString();
    const blocks = template.blocks.map(b => ({ ...b, id: `block-${++this.nextId}` }));
    const idMap = new Map(template.blocks.map((ob, i) => [ob.id, blocks[i].id]));
    const connections = template.connections.map(c => ({
      id: `conn-${++this.nextId}`,
      sourceId: idMap.get(c.sourceId) || c.sourceId,
      targetId: idMap.get(c.targetId) || c.targetId,
    }));
    const flow: Flow = {
      id, name: template.name, description: template.description,
      blocks, connections, status: 'draft',
      createdAt: now, updatedAt: now, executionCount: 0,
    };
    this.flows.update(flows => [flow, ...flows]);
    return flow;
  }

  deleteFlow(id: string): void {
    this.flows.update(flows => flows.filter(f => f.id !== id));
    this.executions.update(execs => execs.filter(e => e.flowId !== id));
  }

  toggleFlowStatus(id: string): void {
    this.flows.update(flows => flows.map(f => {
      if (f.id !== id) return f;
      const next = f.status === 'active' ? 'inactive' : 'active';
      return { ...f, status: next, updatedAt: new Date().toISOString() };
    }));
  }

  duplicateFlow(id: string): Flow | undefined {
    const src = this.getFlow(id);
    if (!src) return;
    const newId = `flow-${++this.nextId}`;
    const now = new Date().toISOString();
    const blocks = src.blocks.map(b => ({ ...b, id: `block-${++this.nextId}` }));
    const idMap = new Map(src.blocks.map((ob, i) => [ob.id, blocks[i].id]));
    const connections = src.connections.map(c => ({
      id: `conn-${++this.nextId}`,
      sourceId: idMap.get(c.sourceId) || c.sourceId,
      targetId: idMap.get(c.targetId) || c.targetId,
    }));
    const flow: Flow = { ...src, id: newId, name: `${src.name} (copy)`, blocks, connections, status: 'draft', createdAt: now, updatedAt: now, executionCount: 0 };
    this.flows.update(flows => [flow, ...flows]);
    return flow;
  }

  // --- Execution ---
  addExecution(exec: Execution): void {
    this.executions.update(execs => [exec, ...execs]);
    this.flows.update(flows => flows.map(f =>
      f.id === exec.flowId ? { ...f, executionCount: f.executionCount + 1 } : f
    ));
  }

  // --- Block factory ---
  createBlockFromDefinition(def: BlockDefinition, position: { x: number; y: number }): FlowBlock {
    return {
      id: `block-${++this.nextId}`,
      definitionId: def.id,
      category: def.category,
      label: def.name,
      icon: def.icon,
      color: def.color,
      position,
      properties: def.properties.map(p => ({
        key: p.key,
        label: p.label,
        type: p.type,
        value: p.default,
        options: p.options,
        placeholder: p.placeholder,
      })),
    };
  }

  // --- Reset ---
  resetData(): void {
    localStorage.removeItem(STORAGE_FLOWS);
    localStorage.removeItem(STORAGE_EXECS);
    this.nextId = Date.now();
    this.flows.set(this.seedFlows());
    this.executions.set([]);
  }
}
