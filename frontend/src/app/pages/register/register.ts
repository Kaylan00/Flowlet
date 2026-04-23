import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['../login/login.scss'],
})
export class RegisterComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  loading = signal(false);
  error = signal('');

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!this.email()) return this.error.set('Please enter your email');
    if (this.password().length < 6) return this.error.set('Password must be at least 6 characters');
    if (this.password() !== this.confirmPassword()) return this.error.set('Passwords do not match');

    this.loading.set(true);
    try {
      await this.auth.register(this.email(), this.password(), this.name() || undefined);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Registration failed');
    } finally {
      this.loading.set(false);
    }
  }
}
