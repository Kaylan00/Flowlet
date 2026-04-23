import {
  Component, input, output, signal, computed, inject, OnChanges, SimpleChanges
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Execution, ExecutionLog, Flow, BLOCK_CATEGORIES } from '../../../core/models/flow.model';
import { ApiService } from '../../../core/services/api.service';
import { MockDataService } from '../../../core/services/mock-data.service';
import { BlockIconComponent } from '../block-icon';

interface NodeStatus {
  blockId: string;
  label: string;
  icon: string;
  color: string;
  category: string;
  posX: number;
  posY: number;
  log: ExecutionLog | null;
  status: 'success' | 'failed' | 'skipped' | 'running' | 'pending';
}

@Component({
  selector: 'app-execution-detail',
  standalone: true,
  imports: [BlockIconComponent, NgTemplateOutlet],
  templateUrl: './execution-detail.html',
  styleUrl: './execution-detail.scss',
})
export class ExecutionDetailComponent implements OnChanges {
  private api = inject(ApiService);
  private data = inject(MockDataService);

  execution = input.required<Execution>();
  closed = output<void>();
  inline = input<boolean>(false);

  flow = signal<Flow | null>(null);
  fullExecution = signal<Execution | null>(null);
  loadingDetail = signal(true);
  selectedLog = signal<ExecutionLog | null>(null);
  selectedNodeId = signal<string | null>(null);

  // Canvas layout
  zoom = signal(0.75);
  panX = signal(40);
  panY = signal(40);

  nodeStatuses = computed<NodeStatus[]>(() => {
    const f = this.flow();
    const exec = this.fullExecution() ?? this.execution();
    if (!f) return [];
    const logs: ExecutionLog[] = Array.isArray(exec.logs) ? exec.logs : [];

    return f.blocks.map(block => {
      const log = logs.find(l => l.blockId === block.id) ?? null;
      let status: NodeStatus['status'] = 'pending';
      if (log) status = log.status as any;

      return {
        blockId: block.id,
        label: block.label,
        icon: block.icon,
        color: block.color,
        category: block.category,
        posX: block.position.x,
        posY: block.position.y,
        log,
        status,
      };
    });
  });

  connections = computed(() => this.flow()?.connections ?? []);

  canvasWidth = computed(() => {
    const nodes = this.nodeStatuses();
    if (!nodes.length) return 800;
    return Math.max(...nodes.map(n => n.posX + 260)) + 80;
  });

  canvasHeight = computed(() => {
    const nodes = this.nodeStatuses();
    if (!nodes.length) return 400;
    return Math.max(...nodes.map(n => n.posY + 100)) + 80;
  });

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['execution']) {
      this.loadingDetail.set(true);
      this.selectedLog.set(null);
      this.selectedNodeId.set(null);
      await this.loadDetail();
    }
  }

  private async loadDetail(): Promise<void> {
    const exec = this.execution();
    let execToUse = exec;

    try {
      const full = await this.api.get<Execution>(`/executions/${exec.id}`);
      execToUse = full;
    } catch {
      // fallback to the input execution (already has logs when coming from the list)
    }

    this.fullExecution.set({
      ...execToUse,
      logs: Array.isArray(execToUse.logs) ? execToUse.logs : [],
    });

    // Load flow for canvas — always attempt this regardless of API success
    const cached = this.data.flows().find(f => f.id === exec.flowId);
    if (cached) {
      this.flow.set(cached);
    } else {
      try {
        const fetched = await this.data.fetchFlow(exec.flowId);
        this.flow.set(fetched);
      } catch {
        this.flow.set(null);
      }
    }

    this.loadingDetail.set(false);
  }

  selectNode(node: NodeStatus): void {
    if (this.selectedNodeId() === node.blockId) {
      this.selectedNodeId.set(null);
      this.selectedLog.set(null);
    } else {
      this.selectedNodeId.set(node.blockId);
      this.selectedLog.set(node.log);
    }
  }

  getConnectionPath(sourceId: string, targetId: string): string {
    const nodes = this.nodeStatuses();
    const source = nodes.find(n => n.blockId === sourceId);
    const target = nodes.find(n => n.blockId === targetId);
    if (!source || !target) return '';
    const sx = source.posX + 240;
    const sy = source.posY + 44;
    const tx = target.posX;
    const ty = target.posY + 44;
    const cpx = Math.max(Math.abs(tx - sx) * 0.5, 80);
    return `M ${sx} ${sy} C ${sx + cpx} ${sy}, ${tx - cpx} ${ty}, ${tx} ${ty}`;
  }

  getConnStatus(sourceId: string, targetId: string): string {
    const nodes = this.nodeStatuses();
    const source = nodes.find(n => n.blockId === sourceId);
    if (!source || !source.log) return 'pending';
    if (source.status === 'success') return 'success';
    if (source.status === 'failed') return 'failed';
    return 'pending';
  }

  formatDuration(ms: number): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatOutput(output: any): string {
    if (!output) return '';
    try { return JSON.stringify(output, null, 2); }
    catch { return String(output); }
  }

  zoomIn(): void  { this.zoom.update(z => Math.min(z + 0.1, 1.5)); }
  zoomOut(): void { this.zoom.update(z => Math.max(z - 0.1, 0.3)); }
  zoomFit(): void { this.zoom.set(0.75); this.panX.set(40); this.panY.set(40); }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    this.zoom.update(z => Math.min(1.5, Math.max(0.3, z + delta)));
  }

  close(): void { this.closed.emit(); }
}
