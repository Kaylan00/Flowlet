import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Credential } from '../models/credential.model';
import { effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CredentialsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  credentials = signal<Credential[]>([]);
  loading = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) void this.refresh();
      else this.credentials.set([]);
    });
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.get<Credential[]>('/credentials');
      this.credentials.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  async create(data: { name: string; appType: string; fields: Record<string, string> }): Promise<Credential> {
    const cred = await this.api.post<Credential>('/credentials', data);
    this.credentials.update(c => [cred, ...c]);
    return cred;
  }

  async update(id: string, data: { name?: string; fields?: Record<string, string> }): Promise<Credential> {
    const cred = await this.api.put<Credential>(`/credentials/${id}`, data);
    this.credentials.update(c => c.map(x => x.id === id ? cred : x));
    return cred;
  }

  async remove(id: string): Promise<void> {
    await this.api.delete<void>(`/credentials/${id}`);
    this.credentials.update(c => c.filter(x => x.id !== id));
  }
}
