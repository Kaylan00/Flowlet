import {
  Component, inject, computed, signal, HostListener, OnInit
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { ToastService } from '../../core/services/toast.service';
import { Flow, Execution, FLOW_TEMPLATES, FlowTemplate } from '../../core/models/flow.model';
import { BlockIconComponent } from '../../shared/components/block-icon';
import { ExecutionDetailComponent } from '../../shared/components/execution-detail/execution-detail';

type Tab = 'flows' | 'executions' | 'templates';
type SortOrder = 'updated' | 'name-asc' | 'name-desc' | 'created-asc' | 'created-desc';

interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
}

interface FolderStorage {
  folders: Folder[];
  assignments: Record<string, string>;
}

const FOLDER_KEY_PREFIX = 'flowlet-folders-';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, BlockIconComponent, NgTemplateOutlet, ExecutionDetailComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  private data = inject(MockDataService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  flows = this.data.flows;
  executions = this.data.executions;
  templates = FLOW_TEMPLATES;

  // --- Tabs ---
  activeTab = signal<Tab>('flows');

  // --- Flows tab ---
  searchQuery = signal('');
  sortOrder = signal<SortOrder>('updated');
  showFilterMenu = signal(false);
  showImportModal = signal(false);
  importJson = signal('');
  importError = signal('');
  importing = signal(false);
  showFlowMenu = signal<string | null>(null);

  // --- Folders ---
  folders = signal<Folder[]>([]);
  folderAssignments = signal<Record<string, string>>({});
  editingFolderId = signal<string | null>(null);
  editingFolderName = signal('');
  creatingFolder = signal(false);
  newFolderName = signal('');
  draggingFlowId = signal<string | null>(null);
  dragOverFolderId = signal<string | null>(null);
  dragOverUngrouped = signal(false);
  showFolderMenu = signal<string | null>(null);

  // --- Selected flow (for Ctrl+C copy) ---
  selectedFlowId = signal<string | null>(null);

  // --- Executions tab ---
  execSearch = signal('');
  execFlowFilter = signal<{ id: string; name: string } | null>(null);
  selectedExecution = signal<Execution | null>(null);

  // --- Stats ---
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

  // --- Filtered / sorted flows ---
  filteredFlows = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const order = this.sortOrder();
    let list = this.flows();
    if (q) list = list.filter(f =>
      f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      switch (order) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'created-asc': return +new Date(a.createdAt) - +new Date(b.createdAt);
        case 'created-desc': return +new Date(b.createdAt) - +new Date(a.createdAt);
        default: return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      }
    });
  });

  flowsByFolder = computed(() => {
    const assignments = this.folderAssignments();
    const map = new Map<string, Flow[]>();
    for (const flow of this.filteredFlows()) {
      const key = assignments[flow.id] || '__none__';
      const arr = map.get(key) ?? [];
      arr.push(flow);
      map.set(key, arr);
    }
    return map;
  });

  ungroupedFlows = computed(() => this.flowsByFolder().get('__none__') ?? []);

  getFlowsInFolder(folderId: string): Flow[] {
    return this.flowsByFolder().get(folderId) ?? [];
  }

  // --- Filtered executions ---
  filteredExecutions = computed(() => {
    const q = this.execSearch().toLowerCase();
    const flowFilter = this.execFlowFilter();
    return this.executions().filter(e => {
      if (flowFilter && e.flowId !== flowFilter.id) return false;
      if (q && !e.flowName.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  // --- Lifecycle ---
  ngOnInit(): void {
    this.loadFolders();
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && ['flows', 'executions', 'templates'].includes(tab)) {
      this.activeTab.set(tab);
    }
    const flowId = this.route.snapshot.queryParamMap.get('flowId');
    if (flowId) {
      const flow = this.flows().find(f => f.id === flowId);
      if (flow) {
        this.execFlowFilter.set({ id: flow.id, name: flow.name });
        this.activeTab.set('executions');
      }
    }
  }

  // --- Folder persistence ---
  private folderKey(): string {
    const user = this.data.flows; // use user-scoped key if available
    return FOLDER_KEY_PREFIX + (localStorage.getItem('flowlet-auth')
      ? JSON.parse(localStorage.getItem('flowlet-auth')!).id
      : 'default');
  }

  private loadFolders(): void {
    try {
      const raw = localStorage.getItem(this.folderKey());
      if (!raw) return;
      const stored: FolderStorage = JSON.parse(raw);
      this.folders.set(stored.folders ?? []);
      this.folderAssignments.set(stored.assignments ?? {});
    } catch {
      // ignore
    }
  }

  private saveFolders(): void {
    const data: FolderStorage = {
      folders: this.folders(),
      assignments: this.folderAssignments(),
    };
    localStorage.setItem(this.folderKey(), JSON.stringify(data));
  }

  // --- Folder operations ---
  startCreateFolder(): void {
    this.creatingFolder.set(true);
    this.newFolderName.set('Nova pasta');
    setTimeout(() => (document.querySelector('.new-folder-input') as HTMLInputElement)?.focus(), 50);
  }

  confirmCreateFolder(): void {
    const name = this.newFolderName().trim();
    if (!name) { this.creatingFolder.set(false); return; }
    const folder: Folder = { id: `folder-${Date.now()}`, name, collapsed: false };
    this.folders.update(f => [...f, folder]);
    this.saveFolders();
    this.creatingFolder.set(false);
    this.newFolderName.set('');
  }

  cancelCreateFolder(): void {
    this.creatingFolder.set(false);
    this.newFolderName.set('');
  }

  startRenameFolder(folder: Folder, event: MouseEvent): void {
    event.stopPropagation();
    this.showFolderMenu.set(null);
    this.editingFolderId.set(folder.id);
    this.editingFolderName.set(folder.name);
    setTimeout(() => (document.querySelector(`[data-folder-input="${folder.id}"]`) as HTMLInputElement)?.focus(), 50);
  }

  confirmRenameFolder(id: string): void {
    const name = this.editingFolderName().trim();
    if (!name) { this.editingFolderId.set(null); return; }
    this.folders.update(f => f.map(x => x.id === id ? { ...x, name } : x));
    this.saveFolders();
    this.editingFolderId.set(null);
  }

  deleteFolder(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.showFolderMenu.set(null);
    this.folders.update(f => f.filter(x => x.id !== id));
    this.folderAssignments.update(a => {
      const copy = { ...a };
      for (const key of Object.keys(copy)) {
        if (copy[key] === id) delete copy[key];
      }
      return copy;
    });
    this.saveFolders();
  }

  toggleFolderCollapse(id: string): void {
    this.folders.update(f => f.map(x => x.id === id ? { ...x, collapsed: !x.collapsed } : x));
    this.saveFolders();
  }

  toggleFolderMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.showFolderMenu.set(this.showFolderMenu() === id ? null : id);
    this.showFlowMenu.set(null);
  }

  // --- Drag & Drop ---
  onFlowDragStart(event: DragEvent, flowId: string): void {
    this.draggingFlowId.set(flowId);
    event.dataTransfer?.setData('text/plain', flowId);
  }

  onFlowDragEnd(): void {
    this.draggingFlowId.set(null);
    this.dragOverFolderId.set(null);
    this.dragOverUngrouped.set(false);
  }

  onFolderDragOver(event: DragEvent, folderId: string): void {
    event.preventDefault();
    this.dragOverFolderId.set(folderId);
    this.dragOverUngrouped.set(false);
  }

  onFolderDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as HTMLElement;
    if (!related || !(event.currentTarget as HTMLElement).contains(related)) {
      this.dragOverFolderId.set(null);
    }
  }

  onFolderDrop(event: DragEvent, folderId: string | null): void {
    event.preventDefault();
    const flowId = this.draggingFlowId();
    if (!flowId) return;
    this.folderAssignments.update(a => {
      const copy = { ...a };
      if (folderId) copy[flowId] = folderId;
      else delete copy[flowId];
      return copy;
    });
    this.saveFolders();
    this.draggingFlowId.set(null);
    this.dragOverFolderId.set(null);
    this.dragOverUngrouped.set(false);
  }

  onUngroupedDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOverUngrouped.set(true);
    this.dragOverFolderId.set(null);
  }

  onUngroupedDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as HTMLElement;
    if (!related || !(event.currentTarget as HTMLElement).contains(related)) {
      this.dragOverUngrouped.set(false);
    }
  }

  // --- Flow actions ---
  openFlow(id: string): void {
    this.router.navigate(['/editor', id]);
  }

  async createFromTemplate(template: FlowTemplate): Promise<void> {
    try {
      const flow = await this.data.createFlowFromTemplate(template);
      this.toast.success(`"${flow.name}" criado`);
      this.router.navigate(['/editor', flow.id]);
    } catch (err: any) {
      this.toast.error(err?.message || 'Falha ao criar fluxo');
    }
  }

  createBlankFlow(): void {
    const empty = FLOW_TEMPLATES.find(t => t.id === 'tpl-empty')!;
    void this.createFromTemplate(empty);
  }

  async toggleFlowStatus(flow: Flow, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showFlowMenu.set(null);
    try {
      await this.data.toggleFlowStatus(flow.id);
      const next = flow.status === 'active' ? 'inativo' : 'ativo';
      this.toast.success(`"${flow.name}" agora está ${next}`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Falha ao alterar status');
    }
  }

  async duplicateFlow(flow: Flow, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showFlowMenu.set(null);
    try {
      const dup = await this.data.duplicateFlow(flow.id);
      if (dup) this.toast.success(`"${dup.name}" criado`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Falha ao duplicar');
    }
  }

  async copyFlowJson(flow: Flow, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showFlowMenu.set(null);
    const exportable = {
      name: flow.name,
      description: flow.description,
      blocks: flow.blocks,
      connections: flow.connections,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportable, null, 2));
      this.toast.success(`JSON de "${flow.name}" copiado!`);
    } catch {
      this.toast.error('Não foi possível copiar — verifique permissões do navegador');
    }
  }

  async deleteFlow(flow: Flow, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showFlowMenu.set(null);
    try {
      await this.data.deleteFlow(flow.id);
      this.folderAssignments.update(a => {
        const copy = { ...a };
        delete copy[flow.id];
        return copy;
      });
      this.saveFolders();
      this.toast.success(`"${flow.name}" excluído`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Falha ao excluir');
    }
  }

  toggleMenu(flowId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.showFlowMenu.set(this.showFlowMenu() === flowId ? null : flowId);
    this.showFolderMenu.set(null);
  }

  selectFlow(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedFlowId.set(this.selectedFlowId() === id ? null : id);
    this.showFlowMenu.set(null);
  }

  closeMenus(): void {
    this.showFlowMenu.set(null);
    this.showFolderMenu.set(null);
    this.showFilterMenu.set(false);
  }

  // --- Import ---
  openImportModal(): void {
    this.importJson.set('');
    this.importError.set('');
    this.showImportModal.set(true);
  }

  async importFromJson(): Promise<void> {
    this.importError.set('');
    const raw = this.importJson().trim();
    if (!raw) return this.importError.set('Cole um JSON de fluxo primeiro');
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { return this.importError.set('JSON inválido — verifique a sintaxe'); }
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) return this.importError.set('O JSON precisa ter um array "blocks"');
    if (!parsed.connections || !Array.isArray(parsed.connections)) return this.importError.set('O JSON precisa ter um array "connections"');
    this.importing.set(true);
    try {
      const flow = await this.data.saveFlow({
        id: '',
        name: parsed.name || 'Fluxo Importado',
        description: parsed.description || '',
        blocks: parsed.blocks,
        connections: parsed.connections,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
      } as Flow);
      this.toast.success(`"${flow.name}" importado`);
      this.showImportModal.set(false);
      this.router.navigate(['/editor', flow.id]);
    } catch (err: any) {
      this.importError.set(err?.message || 'Falha ao importar');
    } finally { this.importing.set(false); }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase();
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (event.key === 'Escape') {
      this.selectedFlowId.set(null);
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === 'V') {
      if (inInput) return;
      if (this.showImportModal()) return;
      void this.pasteFromClipboard();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toUpperCase() === 'C') {
      if (inInput) return;
      const id = this.selectedFlowId();
      if (!id) return;
      const flow = this.flows().find(f => f.id === id);
      if (!flow) return;
      event.preventDefault();
      const exportable = { name: flow.name, description: flow.description, blocks: flow.blocks, connections: flow.connections };
      navigator.clipboard.writeText(JSON.stringify(exportable, null, 2))
        .then(() => this.toast.success(`JSON de "${flow.name}" copiado!`))
        .catch(() => this.toast.error('Não foi possível copiar — verifique permissões do navegador'));
    }
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text.trim());
      if (!parsed.blocks || !Array.isArray(parsed.blocks)) return;
      if (!parsed.connections || !Array.isArray(parsed.connections)) return;
      const flow = await this.data.saveFlow({
        id: '', name: parsed.name || 'Fluxo Colado', description: parsed.description || '',
        blocks: parsed.blocks, connections: parsed.connections, status: 'draft',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), executionCount: 0,
      } as Flow);
      this.toast.success(`"${flow.name}" importado!`);
      this.router.navigate(['/editor', flow.id]);
    } catch { /* silently ignore */ }
  }

  // --- Execution detail ---
  openExecution(exec: Execution): void {
    this.selectedExecution.set(exec);
  }

  closeExecution(): void {
    this.selectedExecution.set(null);
  }

  viewFlowExecutions(flow: Flow, event: MouseEvent): void {
    event.stopPropagation();
    this.execFlowFilter.set({ id: flow.id, name: flow.name });
    this.activeTab.set('executions');
  }

  clearExecFlowFilter(): void {
    this.execFlowFilter.set(null);
  }

  // --- Sort options ---
  readonly sortOptions: { value: SortOrder; label: string }[] = [
    { value: 'updated', label: 'Atualizado recentemente' },
    { value: 'created-desc', label: 'Criado por último' },
    { value: 'created-asc', label: 'Criado primeiro' },
    { value: 'name-asc', label: 'Nome A → Z' },
    { value: 'name-desc', label: 'Nome Z → A' },
  ];

  setSortOrder(order: SortOrder): void {
    this.sortOrder.set(order);
    this.showFilterMenu.set(false);
  }

  getCurrentSortLabel(): string {
    return this.sortOptions.find(o => o.value === this.sortOrder())?.label ?? '';
  }

  // --- Helpers ---
  getStatusClass(status: string): string { return `status-${status}`; }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
