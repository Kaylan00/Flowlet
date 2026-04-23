import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  sidebarExpanded = signal(false);
  toggle(): void { this.sidebarExpanded.update(v => !v); }
}
