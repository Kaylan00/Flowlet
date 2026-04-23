import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { TranslateService } from '../../../core/services/translate.service';
import { LayoutService } from '../../../core/services/layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  i18n = inject(TranslateService);
  layout = inject(LayoutService);
  private router = inject(Router);

  showHelp = signal(false);
  showProfile = signal(false);

  readonly faqs = [
    { q: 'Como criar um fluxo?', a: 'Clique em "Novo Fluxo" no dashboard, escolha um template ou comece do zero.' },
    { q: 'Como conectar blocos?', a: 'No editor, clique na porta de saída (→) de um bloco e depois na porta de entrada do próximo.' },
    { q: 'O que são Triggers?', a: 'São blocos que iniciam a execução: Manual Trigger, Webhook ou Schedule (agendamento).' },
    { q: 'Como agendar uma execução?', a: 'Use o bloco "Schedule" como trigger e configure o intervalo desejado.' },
    { q: 'Como importar ou exportar fluxos?', a: 'No editor: Export JSON copia para o clipboard; Ctrl+V importa. No dashboard: botão Import JSON.' },
    { q: 'O que é status "Draft"?', a: 'O fluxo foi criado mas ainda não está ativo. Ative pelo toggle na lista de fluxos.' },
    { q: 'Como agrupar fluxos em pastas?', a: 'Na aba Fluxos, clique em "+ Nova Pasta" e arraste os fluxos desejados para dentro dela.' },
    { q: 'Como executar um fluxo manualmente?', a: 'No editor pressione Ctrl+Enter ou use o botão Run. O bloco "Manual Trigger" também permite execução direta.' },
    { q: 'O que fazer quando um fluxo falha?', a: 'Veja o log na aba Execuções para identificar qual bloco falhou e o motivo. Corrija as propriedades do bloco e tente novamente.' },
  ];

  goToTemplates(): void {
    this.router.navigate(['/dashboard'], { queryParams: { tab: 'templates' } });
  }
}
