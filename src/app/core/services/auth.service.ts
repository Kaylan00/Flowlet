import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isAuthenticated = signal(false);
  currentUser = signal<{ name: string; email: string; avatar: string } | null>(null);

  constructor(private router: Router) {
    const saved = localStorage.getItem('flowlet-auth');
    if (saved) {
      this.isAuthenticated.set(true);
      this.currentUser.set(JSON.parse(saved));
    }
  }

  login(email: string, _password: string): boolean {
    const user = {
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      email,
      avatar: email.charAt(0).toUpperCase(),
    };
    this.isAuthenticated.set(true);
    this.currentUser.set(user);
    localStorage.setItem('flowlet-auth', JSON.stringify(user));
    return true;
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    localStorage.removeItem('flowlet-auth');
    this.router.navigate(['/login']);
  }
}
