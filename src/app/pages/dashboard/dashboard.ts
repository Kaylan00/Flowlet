import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ToastService } from '../../core/services/toast.service';
import { Flow, FLOW_TEMPLATES, FlowTemplate } from '../../core/models/flow.model';
import { BlockIconComponent } from '../../shared/components/block-icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, BlockIconComponent, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private data = inject(MockDataService);
  private router = inject(Router);
  private toast = inject(ToastService);

  flows = this.data.flows;
  executions = this.data.executions;
  templates = FLOW_TEMPLATES;
  showTemplates = signal(false);
  showFlowMenu = signal<string | null>(null);

  stats = computed(() => {
    const flows = this.flows();
    const execs = this.executions();
    return {
      totalFlows: flows.length,
      activeFlows: flows.filter(f => f.status === 'active').length,
      totalExecutions: execs.length,
      successRate: execs.length
        ? Math.round((execs.filter(e => e.status === 'success').length / execs.length) * 100)
        : 0,
    };
  });

  recentExecutions = computed(() => this.executions().slice(0, 5));

  openFlow(id: string): void {
    this.router.navigate(['/editor', id]);
  }

  createFromTemplate(template: FlowTemplate): void {
    const flow = this.data.createFlowFromTemplate(template);
    this.toast.success(`"${flow.name}" created`);
    this.showTemplates.set(false);
    this.router.navigate(['/editor', flow.id]);
  }

  createBlankFlow(): void {
    this.createFromTemplate(FLOW_TEMPLATES.find(t => t.id === 'tpl-empty')!);
  }

  toggleFlowStatus(flow: Flow, event: MouseEvent): void {
    event.stopPropagation();
    this.data.toggleFlowStatus(flow.id);
    const next = flow.status === 'active' ? 'inactive' : 'active';
    this.toast.success(`"${flow.name}" is now ${next}`);
    this.showFlowMenu.set(null);
  }

  duplicateFlow(flow: Flow, event: MouseEvent): void {
    event.stopPropagation();
    const dup = this.data.duplicateFlow(flow.id);
    if (dup) this.toast.success(`"${dup.name}" created`);
    this.showFlowMenu.set(null);
  }

  deleteFlow(flow: Flow, event: MouseEvent): void {
    event.stopPropagation();
    this.data.deleteFlow(flow.id);
    this.toast.success(`"${flow.name}" deleted`);
    this.showFlowMenu.set(null);
  }

  toggleMenu(flowId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.showFlowMenu.set(this.showFlowMenu() === flowId ? null : flowId);
  }

  closeMenus(): void {
    this.showFlowMenu.set(null);
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
