import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string };
}

const USER_KEY = 'flowlet-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  isAuthenticated = signal(false);
  currentUser = signal<AuthUser | null>(null);

  constructor() {
    const cached = localStorage.getItem(USER_KEY);
    if (cached && this.api.token()) {
      try {
        this.currentUser.set(JSON.parse(cached));
        this.isAuthenticated.set(true);
        void this.refreshProfile();
      } catch {
        this.clear();
      }
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.api.post<AuthResponse>('/auth/login', { email, password });
    this.applyAuth(res);
  }

  async register(email: string, password: string, name?: string): Promise<void> {
    const res = await this.api.post<AuthResponse>('/auth/register', { email, password, name });
    this.applyAuth(res);
  }

  logout(): void {
    this.clear();
    this.router.navigate(['/login']);
  }

  private async refreshProfile(): Promise<void> {
    try {
      const me = await this.api.get<{ id: string; email: string; name: string }>('/auth/me');
      this.setUser(me);
    } catch {
      this.clear();
      this.router.navigate(['/login']);
    }
  }

  private applyAuth(res: AuthResponse): void {
    this.api.setToken(res.token);
    this.setUser(res.user);
    this.isAuthenticated.set(true);
  }

  private setUser(user: { id: string; email: string; name: string }): void {
    const withAvatar: AuthUser = {
      ...user,
      avatar: (user.name?.[0] ?? user.email[0] ?? '?').toUpperCase(),
    };
    this.currentUser.set(withAvatar);
    localStorage.setItem(USER_KEY, JSON.stringify(withAvatar));
  }

  private clear(): void {
    this.api.setToken(null);
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    localStorage.removeItem(USER_KEY);
  }
}
