import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { CredentialsService } from '../../core/services/credentials.service';
import { ToastService } from '../../core/services/toast.service';
import { Credential, APP_DEFINITIONS, AppDefinition } from '../../core/models/credential.model';

@Component({
  selector: 'app-credentials',
  standalone: true,
  imports: [FormsModule, KeyValuePipe],
  templateUrl: './credentials.html',
  styleUrl: './credentials.scss',
})
export class CredentialsComponent {
  private svc = inject(CredentialsService);
  private toast = inject(ToastService);

  credentials = this.svc.credentials;
  loading = this.svc.loading;
  apps = APP_DEFINITIONS;

  searchQuery = signal('');
  filterApp = signal('all');
  showModal = signal(false);
  editing = signal<Credential | null>(null);

  // Form state
  formName = signal('');
  formAppType = signal('');
  formFields = signal<Record<string, string>>({});
  saving = signal(false);
  formError = signal('');
  showValues = signal<Record<string, boolean>>({});

  selectedAppDef = computed(() => this.apps.find(a => a.id === this.formAppType()) ?? null);

  filteredCredentials = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const app = this.filterApp();
    return this.credentials().filter(c => {
      if (app !== 'all' && c.appType !== app) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  appCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const c of this.credentials()) {
      map[c.appType] = (map[c.appType] ?? 0) + 1;
    }
    return map;
  });

  getAppDef(appType: string): AppDefinition | undefined {
    return this.apps.find(a => a.id === appType);
  }

  openCreate(): void {
    this.editing.set(null);
    this.formName.set('');
    this.formAppType.set('');
    this.formFields.set({});
    this.formError.set('');
    this.showValues.set({});
    this.showModal.set(true);
  }

  openEdit(cred: Credential): void {
    this.editing.set(cred);
    this.formName.set(cred.name);
    this.formAppType.set(cred.appType);
    this.formFields.set({ ...cred.fields });
    this.formError.set('');
    this.showValues.set({});
    this.showModal.set(true);
  }

  selectApp(appId: string): void {
    this.formAppType.set(appId);
    const def = this.apps.find(a => a.id === appId);
    if (!def) return;
    const fields: Record<string, string> = {};
    def.fields.forEach(f => fields[f.key] = '');
    this.formFields.set(fields);
  }

  setField(key: string, value: string): void {
    this.formFields.update(f => ({ ...f, [key]: value }));
  }

  toggleShowValue(key: string): void {
    this.showValues.update(v => ({ ...v, [key]: !v[key] }));
  }

  closeModal(): void {
    if (this.saving()) return;
    this.showModal.set(false);
  }

  async save(): Promise<void> {
    this.formError.set('');
    const name = this.formName().trim();
    if (!name) return this.formError.set('Dê um nome para identificar essa credencial');
    if (!this.formAppType()) return this.formError.set('Selecione o aplicativo');
    const fields = this.formFields();
    const def = this.selectedAppDef();
    if (def) {
      for (const f of def.fields) {
        if (!fields[f.key]?.trim()) {
          return this.formError.set(`Preencha o campo "${f.label}"`);
        }
      }
    }
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.svc.update(editing.id, { name, fields });
        this.toast.success(`"${name}" atualizado`);
      } else {
        await this.svc.create({ name, appType: this.formAppType(), fields });
        this.toast.success(`"${name}" criado`);
      }
      this.showModal.set(false);
    } catch (err: any) {
      this.formError.set(err?.message || 'Falha ao salvar');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(cred: Credential, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Excluir a credencial "${cred.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await this.svc.remove(cred.id);
      this.toast.success(`"${cred.name}" excluída`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Falha ao excluir');
    }
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
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
}
