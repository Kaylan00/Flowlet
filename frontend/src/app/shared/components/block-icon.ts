import { Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Lucide-style stroke icons (24x24 viewBox, stroke-based)
const STROKE_ICONS: Record<string, string> = {
  // Triggers
  'cursor-click': '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',

  // Logic
  'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'timer': '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="12" y2="10"/><circle cx="12" cy="14" r="8"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'filter': '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
  'loop': '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',

  // Actions
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'shuffle': '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  'code': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',

  // Output
  'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',

  // Generic
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'webhook': '<path d="M18 16.98h1a2 2 0 0 0 1.74-2.99L14.87 3a2 2 0 0 0-3.5-.01L5.26 14a2 2 0 0 0 1.74 3h1"/>',
};

// Brand/filled icons (24x24 viewBox, fill-based)
const FILLED_ICONS: Record<string, string> = {
  'slack': '<path d="M14.5 2A1.5 1.5 0 0 0 13 3.5V8h1.5A1.5 1.5 0 1 0 14.5 2ZM1 14.5A1.5 1.5 0 0 0 2.5 16H7v-1.5A1.5 1.5 0 0 0 5.5 13H2.5A1.5 1.5 0 0 0 1 14.5ZM9.5 22a1.5 1.5 0 0 0 1.5-1.5V16H9.5a1.5 1.5 0 0 0 0 3h0a1.5 1.5 0 0 0 0-3ZM23 9.5A1.5 1.5 0 0 0 21.5 8H17v1.5a1.5 1.5 0 0 0 3 0 1.5 1.5 0 0 0-3 0ZM8 2a1.5 1.5 0 0 0 0 3H9.5V3.5A1.5 1.5 0 0 0 8 2ZM2 9.5A1.5 1.5 0 0 1 3.5 8H8v1.5A1.5 1.5 0 0 1 5.5 11H3.5A1.5 1.5 0 0 1 2 9.5ZM16 22a1.5 1.5 0 0 1 0-3H14.5v1.5A1.5 1.5 0 0 1 16 22ZM22 14.5a1.5 1.5 0 0 1-1.5 1.5H16v-1.5a1.5 1.5 0 0 1 3 0 1.5 1.5 0 0 1-3 0Z"/>',
  'discord': '<path d="M20.3 4.7a19.5 19.5 0 0 0-4.8-1.5c-.2.4-.4.8-.6 1.3a18 18 0 0 0-5.4 0c-.2-.5-.4-.9-.6-1.3A19.5 19.5 0 0 0 4 4.7 20 20 0 0 0 .6 18.6a19.6 19.6 0 0 0 6 3 14.5 14.5 0 0 0 1.3-2.1 12.5 12.5 0 0 1-2-.9l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 .9.4.7.8 1.4 1.3 2.1a19.5 19.5 0 0 0 6-3A20 20 0 0 0 20.3 4.7ZM8.3 15.7a2.3 2.3 0 0 1-2.1-2.3 2.3 2.3 0 0 1 2.1-2.3 2.3 2.3 0 0 1 2.1 2.3 2.3 2.3 0 0 1-2.1 2.3Zm7.7 0a2.3 2.3 0 0 1-2.1-2.3 2.3 2.3 0 0 1 2.1-2.3 2.3 2.3 0 0 1 2.1 2.3 2.3 2.3 0 0 1-2.1 2.3Z"/>',
  'telegram': '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/>',
  'openai': '<path d="M22.3 8.5a5.7 5.7 0 0 0-.5-4.7 5.8 5.8 0 0 0-6.2-2.8A5.7 5.7 0 0 0 11.3 0a5.8 5.8 0 0 0-5.5 4 5.7 5.7 0 0 0-3.8 2.8 5.8 5.8 0 0 0 .7 6.7 5.7 5.7 0 0 0 .5 4.7 5.8 5.8 0 0 0 6.2 2.8A5.7 5.7 0 0 0 13.7 24a5.8 5.8 0 0 0 5.5-4 5.7 5.7 0 0 0 3.8-2.8 5.8 5.8 0 0 0-.7-6.7Zm-8.6 13.4a4.3 4.3 0 0 1-2.8-1l.1-.1 4.6-2.7a.7.7 0 0 0 .4-.7V11l2 1.1v5.4a4.3 4.3 0 0 1-4.3 4.3ZM4.2 18a4.3 4.3 0 0 1-.5-2.9l.2.1 4.6 2.7a.8.8 0 0 0 .8 0l5.6-3.2v2.2l-4.6 2.7A4.3 4.3 0 0 1 4.2 18ZM3 7.9a4.3 4.3 0 0 1 2.2-1.9v5.5a.7.7 0 0 0 .4.6l5.6 3.2-2 1.1L4.7 14A4.3 4.3 0 0 1 3 8Zm15.8 3.7-5.6-3.2 2-1.2 4.6 2.7a4.3 4.3 0 0 1-.7 7.8v-5.5a.8.8 0 0 0-.3-.6Zm2-3a4.3 4.3 0 0 0-.2-.1l-4.6-2.7a.8.8 0 0 0-.8 0l-5.6 3.2V7.5L14.1 5a4.3 4.3 0 0 1 6.4 4.5l.2.1ZM8.3 12.9l-2-1.1V6.4a4.3 4.3 0 0 1 7-3.3l-.1.1-4.6 2.7a.7.7 0 0 0-.4.6v6.4Zm1-2.3L12 9l2.6 1.5V13L12 14.6 9.4 13Z"/>',
  'github': '<path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.7.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.8-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10Z"/>',
  'sheets': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  'ifttt': '<path d="M4 12h5v-2H6V6h3V4H4v8Zm0 8h2v-6H4v6Zm8-16h-2v8h5v-2h-3V4Zm5 0v2h3v4h-3v2h5V4h-5Z"/>',
  'json-bin': '<path d="M4 6h2v12H4ZM18 6h2v12h-2ZM8 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1 4v2h2V8Zm4 0v2h2V8Zm-4 4v2h2v-2Zm4 4v-2h-2v2Z"/>',
  'gemini': '<path d="M12 2C8.1 7.2 3 8.5 2 12c1 3.5 6.1 4.8 10 10 3.9-5.2 9-6.5 10-10-1-3.5-6.1-4.8-10-10Z"/>',
  'supabase': '<path d="M13.3 21.9c-.5.7-1.6.3-1.6-.6V13h8.7c1 0 1.5 1.2.8 1.9l-7.9 7Zm-2.6-19.8c.5-.7 1.6-.3 1.6.6V11H3.6c-1 0-1.5-1.2-.8-1.9l7.9-7Z"/>',
};

@Component({
  selector: 'block-icon',
  standalone: true,
  template: `<span [innerHTML]="safeIcon"></span>`,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    span { display: inline-flex; align-items: center; justify-content: center; }
  `],
})
export class BlockIconComponent implements OnChanges {
  @Input() name = '';
  @Input() size = 18;

  safeIcon: SafeHtml = '';
  private sanitizer = inject(DomSanitizer);

  ngOnChanges(): void {
    const isFilled = FILLED_ICONS[this.name];
    const paths = FILLED_ICONS[this.name] || STROKE_ICONS[this.name] || STROKE_ICONS['box'];

    const attrs = isFilled
      ? `fill="currentColor" stroke="none"`
      : `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

    const svg = `<svg width="${this.size}" height="${this.size}" viewBox="0 0 24 24" ${attrs}>${paths}</svg>`;
    this.safeIcon = this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
