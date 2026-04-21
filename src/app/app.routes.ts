import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'trivia',
    loadComponent: () => import('./trivia/trivia.component').then((m) => m.TriviaComponent),
  },
  {
    path: 'goals',
    loadComponent: () => import('./goals/goals.component').then((m) => m.GoalsComponent),
  },
  {
    path: 'summary',
    loadComponent: () => import('./summary/summary.page').then((m) => m.SummaryPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
