import { Component, inject, signal, OnInit, OnDestroy, HostListener, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { ExecutionService } from '../../core/services/execution.service';
import { ToastService } from '../../core/services/toast.service';
import { Flow, FlowBlock, FlowConnection, BLOCK_CATALOG, BLOCK_CATEGORIES, BlockDefinition, BlockCategory } from '../../core/models/flow.model';
import { BlockIconComponent } from '../../shared/components/block-icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-flow-editor',
  standalone: true,
  imports: [FormsModule, BlockIconComponent, TranslatePipe],
  templateUrl: './flow-editor.html',
  styleUrl: './flow-editor.scss',
})
export class FlowEditorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private data = inject(MockDataService);
  private executor = inject(ExecutionService);
  private toast = inject(ToastService);

  flow = signal<Flow | null>(null);
  selectedBlock = signal<FlowBlock | null>(null);
  connectingFrom = signal<string | null>(null);
  running = signal(false);
  runningBlockId = signal<string | null>(null);
  hasUnsavedChanges = signal(false);
  lastSaved = signal('');

  // Block picker
  showBlockPicker = signal(true);
  pickerSearch = signal('');
  pickerCategory = signal<BlockCategory | 'all'>('all');
  categories = BLOCK_CATEGORIES;

  // Canvas zoom & pan
  zoom = signal(1);
  panX = signal(0);
  panY = signal(0);

  filteredBlocks = computed(() => {
    const search = this.pickerSearch().toLowerCase();
    const cat = this.pickerCategory();
    return BLOCK_CATALOG.filter(b => {
      if (cat !== 'all' && b.category !== cat) return false;
      if (search && !b.name.toLowerCase().includes(search) && !b.description.toLowerCase().includes(search)) return false;
      return true;
    });
  });

  blockCount = computed(() => this.flow()?.blocks.length ?? 0);
  connectionCount = computed(() => this.flow()?.connections.length ?? 0);
  zoomPercent = computed(() => Math.round(this.zoom() * 100));

  private dragging: { block: FlowBlock; startX: number; startY: number; blockStartX: number; blockStartY: number } | null = null;
  panning = false;
  private panStart = { x: 0, y: 0, panStartX: 0, panStartY: 0 };
  private autoSaveTimer: any;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = this.data.getFlow(id);
      if (found) {
        this.flow.set(JSON.parse(JSON.stringify(found)));
      } else {
        this.toast.error('Flow not found');
        this.router.navigate(['/dashboard']);
        return;
      }
    }
    if (!this.flow()) {
      const newFlow: Flow = {
        id: `flow-${Date.now()}`,
        name: 'Untitled Flow',
        description: '',
        blocks: [],
        connections: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
      };
      this.flow.set(newFlow);
      this.data.saveFlow(newFlow);
    }
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.saveFlow();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.runFlow();
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedBlock()) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      this.deleteBlock(this.selectedBlock()!.id);
    }
    if (event.key === 'Escape') {
      this.selectedBlock.set(null);
      this.connectingFrom.set(null);
    }
  }

  // --- Block picker ---

  addBlockFromDef(def: BlockDefinition): void {
    const f = this.flow();
    if (!f) return;

    const pos = this.getSmartPosition(f);
    const block = this.data.createBlockFromDefinition(def, pos);
    const newBlocks = [...f.blocks, block];
    const newConnections = [...f.connections];

    // Auto-connect: if a block was selected, connect it to the new one
    const sel = this.selectedBlock();
    if (sel) {
      const alreadyConnected = f.connections.some(c => c.sourceId === sel.id && c.targetId === block.id);
      if (!alreadyConnected) {
        newConnections.push({ id: `conn-${Date.now()}`, sourceId: sel.id, targetId: block.id });
      }
    } else if (f.blocks.length > 0) {
      // Auto-connect to last block if nothing selected
      const lastBlock = f.blocks[f.blocks.length - 1];
      newConnections.push({ id: `conn-${Date.now()}`, sourceId: lastBlock.id, targetId: block.id });
    }

    this.flow.set({ ...f, blocks: newBlocks, connections: newConnections });
    this.markDirty();
    this.selectedBlock.set(block);

    // Scroll to the new block
    this.scrollToBlock(block);
  }

  private getSmartPosition(f: Flow): { x: number; y: number } {
    if (f.blocks.length === 0) {
      return { x: 300, y: 200 };
    }

    // Find the bottom-most block and place below it
    const sel = this.selectedBlock();
    const ref = sel || f.blocks[f.blocks.length - 1];

    // Check if position below ref is occupied
    let y = ref.position.y + 160;
    let x = ref.position.x;

    // Avoid overlapping with existing blocks
    const occupied = f.blocks.some(b => Math.abs(b.position.x - x) < 200 && Math.abs(b.position.y - y) < 120);
    if (occupied) {
      x += 280;
    }

    return { x, y };
  }

  private scrollToBlock(block: FlowBlock): void {
    const canvas = document.querySelector('.editor-canvas');
    if (!canvas) return;
    const z = this.zoom();
    const canvasRect = canvas.getBoundingClientRect();
    const blockScreenX = block.position.x * z + this.panX() * z;
    const blockScreenY = block.position.y * z + this.panY() * z;

    // If block is outside visible area, pan to it
    if (blockScreenX < 0 || blockScreenX > canvasRect.width - 240 * z ||
        blockScreenY < 0 || blockScreenY > canvasRect.height - 100 * z) {
      this.panX.set(-block.position.x + canvasRect.width / (2 * z));
      this.panY.set(-block.position.y + canvasRect.height / (2 * z));
    }
  }

  // --- Block management ---

  selectBlock(block: FlowBlock, event: MouseEvent): void {
    event.stopPropagation();
    if (this.connectingFrom()) {
      this.completeConnection(block.id);
      return;
    }
    this.selectedBlock.set(block);
  }

  deselectAll(): void {
    if (this.connectingFrom()) { this.connectingFrom.set(null); return; }
    this.selectedBlock.set(null);
  }

  deleteBlock(blockId: string): void {
    const f = this.flow();
    if (!f) return;
    this.flow.set({
      ...f,
      blocks: f.blocks.filter(b => b.id !== blockId),
      connections: f.connections.filter(c => c.sourceId !== blockId && c.targetId !== blockId),
    });
    if (this.selectedBlock()?.id === blockId) this.selectedBlock.set(null);
    this.markDirty();
  }

  duplicateBlock(block: FlowBlock): void {
    const f = this.flow();
    if (!f) return;
    const def = BLOCK_CATALOG.find(d => d.id === block.definitionId);
    if (!def) return;
    const dup = this.data.createBlockFromDefinition(def, { x: block.position.x + 40, y: block.position.y + 40 });
    dup.label = `${block.label} (copy)`;
    dup.properties = block.properties.map(p => ({ ...p }));
    this.flow.set({ ...f, blocks: [...f.blocks, dup] });
    this.selectedBlock.set(dup);
    this.markDirty();
  }

  // --- Drag blocks ---

  onBlockMouseDown(block: FlowBlock, event: MouseEvent): void {
    if (this.connectingFrom() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = { block, startX: event.clientX, startY: event.clientY, blockStartX: block.position.x, blockStartY: block.position.y };
    this.selectedBlock.set(block);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    // Panning (left-click on empty canvas or middle-click)
    if (this.panning) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      this.panX.set(this.panStart.panStartX + dx / this.zoom());
      this.panY.set(this.panStart.panStartY + dy / this.zoom());
      return;
    }

    // Dragging block
    if (!this.dragging) return;
    const f = this.flow();
    if (!f) return;
    const z = this.zoom();
    const dx = (event.clientX - this.dragging.startX) / z;
    const dy = (event.clientY - this.dragging.startY) / z;
    const x = Math.max(0, Math.round((this.dragging.blockStartX + dx) / 24) * 24);
    const y = Math.max(0, Math.round((this.dragging.blockStartY + dy) / 24) * 24);
    const blockId = this.dragging.block.id;
    this.flow.set({ ...f, blocks: f.blocks.map(b => b.id === blockId ? { ...b, position: { x, y } } : b) });
    this.dragging.block = { ...this.dragging.block, position: { x, y } };
    this.markDirty();
  }

  onCanvasMouseUp(): void {
    this.dragging = null;
    this.panning = false;
  }

  // --- Canvas panning (left-click on empty area, middle-click anywhere) ---

  onCanvasMouseDown(event: MouseEvent): void {
    // Left-click on empty canvas = pan
    if (event.button === 0 || event.button === 1) {
      event.preventDefault();
      this.panning = true;
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
        panStartX: this.panX(),
        panStartY: this.panY(),
      };
    }
  }

  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  // --- Zoom ---

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.min(2, Math.max(0.25, this.zoom() + delta));
    this.zoom.set(Math.round(newZoom * 100) / 100);
  }

  zoomIn(): void {
    this.zoom.set(Math.min(2, Math.round((this.zoom() + 0.15) * 100) / 100));
  }

  zoomOut(): void {
    this.zoom.set(Math.max(0.25, Math.round((this.zoom() - 0.15) * 100) / 100));
  }

  zoomReset(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  fitToView(): void {
    const f = this.flow();
    if (!f || f.blocks.length === 0) {
      this.zoomReset();
      return;
    }

    const canvas = document.querySelector('.editor-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const minX = Math.min(...f.blocks.map(b => b.position.x));
    const minY = Math.min(...f.blocks.map(b => b.position.y));
    const maxX = Math.max(...f.blocks.map(b => b.position.x + 240));
    const maxY = Math.max(...f.blocks.map(b => b.position.y + 88));

    const contentW = maxX - minX + 120;
    const contentH = maxY - minY + 120;

    const z = Math.min(rect.width / contentW, rect.height / contentH, 1.2);
    this.zoom.set(Math.round(z * 100) / 100);
    this.panX.set(-minX + 60 + (rect.width / z - contentW) / 2);
    this.panY.set(-minY + 60 + (rect.height / z - contentH) / 2);
  }

  // --- Connections ---

  startConnection(blockId: string, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.connectingFrom.set(blockId);
  }

  completeConnection(targetId: string): void {
    const sourceId = this.connectingFrom();
    const f = this.flow();
    if (!sourceId || !f || sourceId === targetId) { this.connectingFrom.set(null); return; }
    const exists = f.connections.some(c =>
      (c.sourceId === sourceId && c.targetId === targetId) ||
      (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (exists) { this.toast.error('Already connected'); this.connectingFrom.set(null); return; }
    const conn: FlowConnection = { id: `conn-${Date.now()}`, sourceId, targetId };
    this.flow.set({ ...f, connections: [...f.connections, conn] });
    this.connectingFrom.set(null);
    this.markDirty();
    this.toast.success('Connected');
  }

  removeConnection(connId: string, event: MouseEvent): void {
    event.stopPropagation();
    const f = this.flow();
    if (!f) return;
    this.flow.set({ ...f, connections: f.connections.filter(c => c.id !== connId) });
    this.markDirty();
  }

  getConnectionPath(conn: FlowConnection): string {
    const f = this.flow();
    if (!f) return '';
    const source = f.blocks.find(b => b.id === conn.sourceId);
    const target = f.blocks.find(b => b.id === conn.targetId);
    if (!source || !target) return '';
    const sx = source.position.x + 240;
    const sy = source.position.y + 44;
    const tx = target.position.x;
    const ty = target.position.y + 44;
    const cpx = Math.max(Math.abs(tx - sx) * 0.5, 80);
    return `M ${sx} ${sy} C ${sx + cpx} ${sy}, ${tx - cpx} ${ty}, ${tx} ${ty}`;
  }

  // --- Properties ---

  updateFlowName(name: string): void {
    const f = this.flow();
    if (!f) return;
    this.flow.set({ ...f, name });
    this.markDirty();
  }

  updateBlockLabel(label: string): void {
    const block = this.selectedBlock();
    const f = this.flow();
    if (!block || !f) return;
    this.flow.set({ ...f, blocks: f.blocks.map(b => b.id === block.id ? { ...b, label } : b) });
    this.selectedBlock.set({ ...block, label });
    this.markDirty();
  }

  updateBlockProperty(key: string, value: any): void {
    const block = this.selectedBlock();
    const f = this.flow();
    if (!block || !f) return;
    const newProps = block.properties.map(p => p.key === key ? { ...p, value } : p);
    this.flow.set({ ...f, blocks: f.blocks.map(b => b.id === block.id ? { ...b, properties: newProps } : b) });
    this.selectedBlock.set({ ...block, properties: newProps });
    this.markDirty();
  }

  // --- Save ---

  private markDirty(): void {
    this.hasUnsavedChanges.set(true);
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.saveFlow(), 3000);
  }

  saveFlow(): void {
    const f = this.flow();
    if (!f) return;
    this.data.saveFlow(f);
    this.hasUnsavedChanges.set(false);
    this.lastSaved.set(new Date().toLocaleTimeString());
    this.toast.success('Flow saved');
  }

  // --- Run ---

  async runFlow(): Promise<void> {
    const f = this.flow();
    if (!f || f.blocks.length === 0 || this.running()) return;

    const triggers = f.blocks.filter(b => b.category === 'trigger');
    if (triggers.length === 0) {
      this.toast.error('Add a Trigger block to run the flow');
      return;
    }

    this.saveFlow();
    this.running.set(true);

    try {
      const exec = await this.executor.executeFlow(
        f,
        (blockId) => this.runningBlockId.set(blockId),
        () => {},
      );
      this.runningBlockId.set(null);
      if (exec.status === 'success') {
        this.toast.success(`Flow completed in ${(exec.duration / 1000).toFixed(1)}s`);
      } else {
        this.toast.error(`Failed: ${exec.error}`);
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Execution failed');
    } finally {
      this.running.set(false);
      this.runningBlockId.set(null);
    }
  }

  goBack(): void {
    if (this.hasUnsavedChanges()) this.saveFlow();
    this.router.navigate(['/dashboard']);
  }

  getCategoryColor(cat: BlockCategory): string {
    return BLOCK_CATEGORIES.find(c => c.id === cat)?.color ?? '#6b7280';
  }
}
