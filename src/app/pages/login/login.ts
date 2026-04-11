import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
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

  onSubmit(): void {
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
    setTimeout(() => {
      this.auth.login(this.email(), this.password());
      this.loading.set(false);
      this.router.navigate(['/dashboard']);
    }, 600);
  }
}
