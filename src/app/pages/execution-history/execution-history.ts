import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ToastService } from '../../core/services/toast.service';
import { Execution, BLOCK_CATEGORIES } from '../../core/models/flow.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-execution-history',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './execution-history.html',
  styleUrl: './execution-history.scss',
})
export class ExecutionHistoryComponent {
  private data = inject(MockDataService);
  private router = inject(Router);
  private toast = inject(ToastService);

  filter = signal<'all' | 'success' | 'failed'>('all');
  expandedId = signal<string | null>(null);

  executions = computed(() => {
    const f = this.filter();
    const all = this.data.executions();
    if (f === 'all') return all;
    return all.filter(e => e.status === f);
  });

  stats = computed(() => {
    const all = this.data.executions();
    return {
      total: all.length,
      success: all.filter(e => e.status === 'success').length,
      failed: all.filter(e => e.status === 'failed').length,
    };
  });

  setFilter(f: 'all' | 'success' | 'failed'): void {
    this.filter.set(f);
  }

  toggleExpand(exec: Execution): void {
    this.expandedId.set(this.expandedId() === exec.id ? null : exec.id);
  }

  retryExecution(exec: Execution, event: MouseEvent): void {
    event.stopPropagation();
    const flow = this.data.getFlow(exec.flowId);
    if (flow) {
      this.router.navigate(['/editor', flow.id]);
      this.toast.info(`Opening "${flow.name}" to re-run`);
    } else {
      this.toast.error('Flow not found');
    }
  }

  openFlow(flowId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/editor', flowId]);
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getProgressPercent(exec: Execution): number {
    return (exec.stepsCompleted / exec.totalSteps) * 100;
  }

  getBlockColor(category: string): string {
    return BLOCK_CATEGORIES.find(c => c.id === category)?.color ?? '#6b7280';
  }
}
