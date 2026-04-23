import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!this.email()) {
      this.error.set('Please enter your email');
      return;
    }
    if (!this.password()) {
      this.error.set('Please enter your password');
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Login failed');
    } finally {
      this.loading.set(false);
    }
  }
}
