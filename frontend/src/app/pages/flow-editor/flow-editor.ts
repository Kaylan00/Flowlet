import { Component, inject, signal, OnInit, OnDestroy, HostListener, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { ExecutionService } from '../../core/services/execution.service';
import { ToastService } from '../../core/services/toast.service';
import { Flow, FlowBlock, FlowConnection, Execution, BLOCK_CATALOG, BLOCK_CATEGORIES, BlockDefinition, BlockCategory } from '../../core/models/flow.model';
import { BlockIconComponent } from '../../shared/components/block-icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ExecutionDetailComponent } from '../../shared/components/execution-detail/execution-detail';

@Component({
  selector: 'app-flow-editor',
  standalone: true,
  imports: [FormsModule, BlockIconComponent, TranslatePipe, ExecutionDetailComponent],
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
  selectedBlockIds = signal<Set<string>>(new Set());
  connectingFrom = signal<string | null>(null);
  mousePosOnCanvas = signal<{ x: number; y: number } | null>(null);
  private connectionJustStarted = false;
  pickerDragging = signal<{ def: BlockDefinition; x: number; y: number } | null>(null);
  running = signal(false);
  runningBlockId = signal<string | null>(null);
  hasUnsavedChanges = signal(false);
  lastSaved = signal('');

  // Rubber-band selection box (screen coords relative to canvas element)
  selectionBox = signal<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  spaceDown = signal(false);
  ctrlDown = signal(false);

  selectionRect = computed(() => {
    const b = this.selectionBox();
    if (!b) return null;
    return {
      left: Math.min(b.sx, b.ex),
      top: Math.min(b.sy, b.ey),
      width: Math.abs(b.ex - b.sx),
      height: Math.abs(b.ey - b.sy),
    };
  });

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

  // Executions panel
  showExecutionsPanel = signal(false);
  selectedExecution = signal<Execution | null>(null);
  flowExecutions = computed(() => {
    const id = this.flow()?.id;
    if (!id) return [];
    return this.data.executions().filter(e => e.flowId === id);
  });

  private dragging: { block: FlowBlock; startX: number; startY: number; blockStartX: number; blockStartY: number } | null = null;
  private multiDragStart: { mouseX: number; mouseY: number; blockStarts: { id: string; x: number; y: number }[] } | null = null;
  panning = false;
  private isSelecting = false;
  private panStart = { x: 0, y: 0, panStartX: 0, panStartY: 0 };
  private autoSaveTimer: any;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      try {
        const found = await this.data.fetchFlow(id);
        this.flow.set(JSON.parse(JSON.stringify(found)));
      } catch {
        this.toast.error('Flow not found');
        this.router.navigate(['/dashboard']);
      }
      return;
    }
    // No ID: create a local draft that only gets saved when user makes changes
    this.flow.set({
      id: '',
      name: 'Untitled Flow',
      description: '',
      blocks: [],
      connections: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
    } as Flow);
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  }

  viewExecutions(): void {
    this.showExecutionsPanel.set(!this.showExecutionsPanel());
    this.selectedExecution.set(null);
  }

  formatExecDate(dateStr: string): string {
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

  formatExecDuration(ms: number): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        event.preventDefault();
        this.spaceDown.set(true);
      }
    }
    if (event.key === 'Control' || event.key === 'Meta') {
      this.ctrlDown.set(true);
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      void this.pasteJsonOnCanvas();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.saveFlow();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.runFlow();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const ids = this.selectedBlockIds();
      if (ids.size > 0) {
        event.preventDefault();
        this.deleteSelectedBlocks();
      } else if (this.selectedBlock()) {
        event.preventDefault();
        this.deleteBlock(this.selectedBlock()!.id);
      }
    }
    if (event.key === 'Escape') {
      this.selectedBlock.set(null);
      this.selectedBlockIds.set(new Set());
      this.connectingFrom.set(null);
      this.mousePosOnCanvas.set(null);
      this.selectionBox.set(null);
    }
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      this.selectAll();
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spaceDown.set(false);
      this.panning = false;
    }
    if (event.key === 'Control' || event.key === 'Meta') {
      this.ctrlDown.set(false);
    }
  }

  selectAll(): void {
    const f = this.flow();
    if (!f) return;
    this.selectedBlockIds.set(new Set(f.blocks.map(b => b.id)));
    this.selectedBlock.set(null);
  }

  // --- Block picker ---

  addBlockFromDef(def: BlockDefinition): void {
    const f = this.flow();
    if (!f) return;

    const pos = this.getSmartPosition(f);
    const block = this.data.createBlockFromDefinition(def, pos);
    const newBlocks = [...f.blocks, block];
    const newConnections = [...f.connections];

    const sel = this.selectedBlock();
    if (sel) {
      const alreadyConnected = f.connections.some(c => c.sourceId === sel.id && c.targetId === block.id);
      if (!alreadyConnected) {
        newConnections.push({ id: `conn-${Date.now()}`, sourceId: sel.id, targetId: block.id });
      }
    } else if (f.blocks.length > 0) {
      const lastBlock = f.blocks[f.blocks.length - 1];
      newConnections.push({ id: `conn-${Date.now()}`, sourceId: lastBlock.id, targetId: block.id });
    }

    this.flow.set({ ...f, blocks: newBlocks, connections: newConnections });
    this.markDirty();
    this.selectedBlock.set(block);
    this.selectedBlockIds.set(new Set([block.id]));
    this.scrollToBlock(block);
  }

  startPickerDrag(def: BlockDefinition, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    let moved = false;
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (e: MouseEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      moved = true;
      this.pickerDragging.set({ def, x: e.clientX, y: e.clientY });
    };

    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!moved) {
        this.addBlockFromDef(def);
        return;
      }
      this.pickerDragging.set(null);
      const canvas = document.querySelector('.editor-canvas') as HTMLElement;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const z = this.zoom();
      const x = Math.max(0, Math.round(((e.clientX - rect.left) / z - this.panX()) / 24) * 24);
      const y = Math.max(0, Math.round(((e.clientY - rect.top) / z - this.panY()) / 24) * 24);
      const f = this.flow();
      if (!f) return;
      const block = this.data.createBlockFromDefinition(def, { x, y });
      this.flow.set({ ...f, blocks: [...f.blocks, block] });
      this.selectedBlock.set(block);
      this.selectedBlockIds.set(new Set([block.id]));
      this.markDirty();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private getSmartPosition(f: Flow): { x: number; y: number } {
    if (f.blocks.length === 0) return { x: 300, y: 200 };
    const sel = this.selectedBlock();
    const ref = sel || f.blocks[f.blocks.length - 1];
    let y = ref.position.y + 160;
    let x = ref.position.x;
    const occupied = f.blocks.some(b => Math.abs(b.position.x - x) < 200 && Math.abs(b.position.y - y) < 120);
    if (occupied) x += 280;
    return { x, y };
  }

  private scrollToBlock(block: FlowBlock): void {
    const canvas = document.querySelector('.editor-canvas');
    if (!canvas) return;
    const z = this.zoom();
    const canvasRect = canvas.getBoundingClientRect();
    const blockScreenX = block.position.x * z + this.panX() * z;
    const blockScreenY = block.position.y * z + this.panY() * z;
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
    this.selectedBlockIds.set(new Set([block.id]));
  }

  deselectAll(): void {
    if (this.connectingFrom()) { this.connectingFrom.set(null); return; }
    // In default (select) mode clicking empty canvas doesn't deselect while dragging
    this.selectedBlock.set(null);
    this.selectedBlockIds.set(new Set());
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
    this.selectedBlockIds.update(ids => { const n = new Set(ids); n.delete(blockId); return n; });
    this.markDirty();
  }

  deleteSelectedBlocks(): void {
    const ids = this.selectedBlockIds();
    if (ids.size === 0) return;
    const f = this.flow();
    if (!f) return;
    this.flow.set({
      ...f,
      blocks: f.blocks.filter(b => !ids.has(b.id)),
      connections: f.connections.filter(c => !ids.has(c.sourceId) && !ids.has(c.targetId)),
    });
    this.selectedBlock.set(null);
    this.selectedBlockIds.set(new Set());
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
    this.selectedBlockIds.set(new Set([dup.id]));
    this.markDirty();
  }

  isBlockSelected(blockId: string): boolean {
    return this.selectedBlockIds().has(blockId);
  }

  // --- Drag blocks ---

  onBlockMouseDown(block: FlowBlock, event: MouseEvent): void {
    if (this.connectingFrom() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const ids = this.selectedBlockIds();

    // Multi-block drag: if block is already in selection, drag all selected
    if (ids.size > 1 && ids.has(block.id)) {
      const f = this.flow();
      if (!f) return;
      this.multiDragStart = {
        mouseX: event.clientX,
        mouseY: event.clientY,
        blockStarts: f.blocks.filter(b => ids.has(b.id)).map(b => ({ id: b.id, x: b.position.x, y: b.position.y })),
      };
      this.selectedBlock.set(block);
      return;
    }

    // Single block drag
    this.dragging = { block, startX: event.clientX, startY: event.clientY, blockStartX: block.position.x, blockStartY: block.position.y };
    this.selectedBlock.set(block);
    this.selectedBlockIds.set(new Set([block.id]));
  }

  onCanvasMouseMove(event: MouseEvent): void {
    // Track cursor position for live connection wire
    if (this.connectingFrom()) {
      const canvas = document.querySelector('.editor-canvas') as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const z = this.zoom();
      this.mousePosOnCanvas.set({
        x: (event.clientX - rect.left) / z - this.panX(),
        y: (event.clientY - rect.top) / z - this.panY(),
      });
    }

    // Rubber-band selection
    if (this.isSelecting) {
      const canvas = document.querySelector('.editor-canvas') as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const prev = this.selectionBox()!;
      this.selectionBox.set({ sx: prev.sx, sy: prev.sy, ex: event.clientX - rect.left, ey: event.clientY - rect.top });
      return;
    }

    // Multi-block drag
    if (this.multiDragStart) {
      const f = this.flow();
      if (!f) return;
      const z = this.zoom();
      const dx = (event.clientX - this.multiDragStart.mouseX) / z;
      const dy = (event.clientY - this.multiDragStart.mouseY) / z;
      this.flow.set({
        ...f,
        blocks: f.blocks.map(b => {
          const start = this.multiDragStart!.blockStarts.find(s => s.id === b.id);
          if (!start) return b;
          return { ...b, position: { x: Math.max(0, Math.round((start.x + dx) / 24) * 24), y: Math.max(0, Math.round((start.y + dy) / 24) * 24) } };
        }),
      });
      this.markDirty();
      return;
    }

    // Pan
    if (this.panning) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      this.panX.set(this.panStart.panStartX + dx / this.zoom());
      this.panY.set(this.panStart.panStartY + dy / this.zoom());
      return;
    }

    // Single-block drag
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
    if (this.isSelecting) {
      const box = this.selectionBox();
      if (box) this.applyRubberBandSelection(box);
      this.isSelecting = false;
      this.selectionBox.set(null);
    }
    // Cancel connection if user released on empty canvas (not on a port-in)
    if (this.connectingFrom()) {
      if (this.connectionJustStarted) {
        // Port-out was just clicked — keep connection active for click-to-click mode
        this.connectionJustStarted = false;
      } else {
        // Released on empty canvas while dragging — cancel
        this.connectingFrom.set(null);
        this.mousePosOnCanvas.set(null);
      }
    }
    this.dragging = null;
    this.multiDragStart = null;
    this.panning = false;
  }

  private applyRubberBandSelection(box: { sx: number; sy: number; ex: number; ey: number }): void {
    const z = this.zoom();
    const px = this.panX();
    const py = this.panY();
    // Convert screen coords (relative to canvas) to canvas world coords
    const minX = Math.min(box.sx, box.ex) / z - px;
    const maxX = Math.max(box.sx, box.ex) / z - px;
    const minY = Math.min(box.sy, box.ey) / z - py;
    const maxY = Math.max(box.sy, box.ey) / z - py;

    const BLOCK_W = 240;
    const BLOCK_H = 88;
    const ids = new Set<string>();
    for (const block of this.flow()?.blocks ?? []) {
      if (block.position.x < maxX && block.position.x + BLOCK_W > minX &&
          block.position.y < maxY && block.position.y + BLOCK_H > minY) {
        ids.add(block.id);
      }
    }
    this.selectedBlockIds.set(ids);
    if (ids.size === 1) {
      const block = this.flow()!.blocks.find(b => ids.has(b.id));
      if (block) this.selectedBlock.set(block);
    } else {
      this.selectedBlock.set(null);
    }
    if (ids.size > 0) this.toast.info(`${ids.size} block${ids.size > 1 ? 's' : ''} selected`);
  }

  // --- Canvas mouse down ---

  onCanvasMouseDown(event: MouseEvent): void {
    // Middle mouse OR Space+left OR Ctrl+left = pan
    if (event.button === 1 || (event.button === 0 && (this.spaceDown() || this.ctrlDown()))) {
      event.preventDefault();
      this.panning = true;
      this.panStart = { x: event.clientX, y: event.clientY, panStartX: this.panX(), panStartY: this.panY() };
      return;
    }
    // Left click on empty canvas = rubber-band selection
    if (event.button === 0) {
      event.preventDefault();
      const canvas = document.querySelector('.editor-canvas') as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      this.isSelecting = true;
      this.selectionBox.set({ sx, sy, ex: sx, ey: sy });
      this.selectedBlock.set(null);
      this.selectedBlockIds.set(new Set());
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

  zoomIn(): void { this.zoom.set(Math.min(2, Math.round((this.zoom() + 0.15) * 100) / 100)); }
  zoomOut(): void { this.zoom.set(Math.max(0.25, Math.round((this.zoom() - 0.15) * 100) / 100)); }
  zoomReset(): void { this.zoom.set(1); this.panX.set(0); this.panY.set(0); }

  fitToView(): void {
    const f = this.flow();
    if (!f || f.blocks.length === 0) { this.zoomReset(); return; }
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
    this.connectionJustStarted = true;
  }

  onPortInMouseUp(blockId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.connectingFrom()) this.completeConnection(blockId);
  }

  completeConnection(targetId: string): void {
    const sourceId = this.connectingFrom();
    const f = this.flow();
    this.mousePosOnCanvas.set(null);
    if (!sourceId || !f || sourceId === targetId) { this.connectingFrom.set(null); return; }
    const exists = f.connections.some(c =>
      (c.sourceId === sourceId && c.targetId === targetId) ||
      (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (exists) { this.toast.error('Já conectado'); this.connectingFrom.set(null); return; }
    const conn: FlowConnection = { id: `conn-${Date.now()}`, sourceId, targetId };
    this.flow.set({ ...f, connections: [...f.connections, conn] });
    this.connectingFrom.set(null);
    this.markDirty();
    this.toast.success('Conectado');
  }

  getLiveConnectionPath(): string {
    const f = this.flow();
    const mouse = this.mousePosOnCanvas();
    if (!f || !mouse || !this.connectingFrom()) return '';
    const source = f.blocks.find(b => b.id === this.connectingFrom());
    if (!source) return '';
    const sx = source.position.x + 240;
    const sy = source.position.y + 44;
    const tx = mouse.x;
    const ty = mouse.y;
    const cpx = Math.max(Math.abs(tx - sx) * 0.5, 80);
    return `M ${sx} ${sy} C ${sx + cpx} ${sy}, ${tx - cpx} ${ty}, ${tx} ${ty}`;
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
    this.autoSaveTimer = setTimeout(() => void this.saveFlow(true), 3000);
  }

  async saveFlow(silent = false): Promise<void> {
    const f = this.flow();
    if (!f) return;
    try {
      const isNew = !f.id;
      const saved = await this.data.saveFlow(f);
      this.flow.set(saved);
      if (isNew) {
        this.router.navigate(['/editor', saved.id], { replaceUrl: true });
      }
      this.hasUnsavedChanges.set(false);
      this.lastSaved.set(new Date().toLocaleTimeString());
      if (!silent) this.toast.success('Flow salvo');
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to save');
    }
  }

  // --- Run ---

  async runFlow(): Promise<void> {
    const f = this.flow();
    if (!f || f.blocks.length === 0 || this.running()) return;
    const triggers = f.blocks.filter(b => b.category === 'trigger');
    if (triggers.length === 0) { this.toast.error('Add a Trigger block to run the flow'); return; }
    await this.saveFlow(true);
    this.running.set(true);
    try {
      const exec = await this.executor.executeFlow(
        this.flow()!,
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

  async pasteJsonOnCanvas(): Promise<void> {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      this.toast.error('Cannot read clipboard — allow clipboard access in browser settings');
      return;
    }

    if (!text?.trim()) return;

    let parsed: any;
    try { parsed = JSON.parse(text.trim()); } catch {
      if (text.trim().startsWith('{')) {
        this.toast.error('JSON inválido no clipboard — copie o JSON novamente');
      }
      return;
    }

    if (!parsed.blocks || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      this.toast.error('JSON must have a "blocks" array to paste on canvas');
      return;
    }

    const f = this.flow();
    if (!f) return;

    const suffix = `-p${Date.now()}`;
    const idMap = new Map<string, string>();
    const pastedBlocks: FlowBlock[] = parsed.blocks.map((b: FlowBlock) => {
      const newId = (b.id || `blk-${Math.random().toString(36).slice(2)}`) + suffix;
      idMap.set(b.id, newId);
      return { ...b, id: newId };
    });

    const pastedConnections: FlowConnection[] = (parsed.connections ?? [])
      .filter((c: FlowConnection) => idMap.has(c.sourceId) && idMap.has(c.targetId))
      .map((c: FlowConnection) => ({
        ...c,
        id: c.id + suffix,
        sourceId: idMap.get(c.sourceId)!,
        targetId: idMap.get(c.targetId)!,
      }));

    // Center paste group on visible canvas area
    const canvas = document.querySelector('.editor-canvas');
    const rect = canvas?.getBoundingClientRect();
    const z = this.zoom();
    const centerX = rect ? (rect.width / 2) / z - this.panX() : 400;
    const centerY = rect ? (rect.height / 2) / z - this.panY() : 300;
    const minBX = Math.min(...pastedBlocks.map(b => b.position?.x ?? 0));
    const minBY = Math.min(...pastedBlocks.map(b => b.position?.y ?? 0));
    const offsetX = centerX - minBX - 120;
    const offsetY = centerY - minBY - 44;

    const repositioned = pastedBlocks.map(b => ({
      ...b,
      position: {
        x: Math.max(0, Math.round(((b.position?.x ?? 0) + offsetX) / 24) * 24),
        y: Math.max(0, Math.round(((b.position?.y ?? 0) + offsetY) / 24) * 24),
      },
    }));

    this.flow.set({ ...f, blocks: [...f.blocks, ...repositioned], connections: [...f.connections, ...pastedConnections] });
    this.selectedBlockIds.set(new Set(repositioned.map(b => b.id)));
    this.selectedBlock.set(repositioned[0] ?? null);
    this.markDirty();
    this.toast.success(`Pasted ${repositioned.length} block${repositioned.length > 1 ? 's' : ''}`);
  }

  async exportJson(): Promise<void> {
    const f = this.flow();
    if (!f) return;
    const exportable = { name: f.name, description: f.description, blocks: f.blocks, connections: f.connections };
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportable, null, 2));
      this.toast.success('JSON copied to clipboard!');
    } catch {
      this.toast.error('Could not copy — check browser permissions');
    }
  }

  async goBack(): Promise<void> {
    const f = this.flow();
    // If flow was never saved (no id) and has no changes, just navigate back without creating anything
    if (f && !f.id) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (this.hasUnsavedChanges()) await this.saveFlow(true);
    this.router.navigate(['/dashboard']);
  }

  getCategoryColor(cat: BlockCategory): string {
    return BLOCK_CATEGORIES.find(c => c.id === cat)?.color ?? '#6b7280';
  }
}
