import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'flowlet-token';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  setToken(token: string | null): void {
    this.token.set(token);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = this.token();
    if (token) headers['authorization'] = `Bearer ${token}`;

    const cleanParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') cleanParams[k] = String(v);
      }
    }

    try {
      return await firstValueFrom(
        this.http.request<T>(method, url, {
          body,
          headers: new HttpHeaders(headers),
          params: cleanParams,
        }),
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        const msg = typeof err.error === 'object' && err.error?.error ? err.error.error : err.message;
        throw new Error(msg || `HTTP ${err.status}`);
      }
      throw err;
    }
  }
}
