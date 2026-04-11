import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.type" (click)="toastService.dismiss(toast.id)">
          <span class="toast-icon">
            @if (toast.type === 'success') { ✓ }
            @else if (toast.type === 'error') { ✕ }
            @else { ℹ }
          </span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      animation: toastIn 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      min-width: 260px;
      max-width: 420px;
    }
    .toast-success { background: #059669; color: white; }
    .toast-error { background: #dc2626; color: white; }
    .toast-info { background: var(--bg-primary, #fff); color: var(--text-primary, #111); border: 1px solid var(--border-color, #e5e7eb); }
    .toast-icon { font-weight: 700; font-size: 1rem; flex-shrink: 0; }
    .toast-message { flex: 1; }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
