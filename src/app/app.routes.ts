import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent) },
      { path: 'editor', loadComponent: () => import('./pages/flow-editor/flow-editor').then(m => m.FlowEditorComponent) },
      { path: 'editor/:id', loadComponent: () => import('./pages/flow-editor/flow-editor').then(m => m.FlowEditorComponent) },
      { path: 'history', loadComponent: () => import('./pages/execution-history/execution-history').then(m => m.ExecutionHistoryComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
