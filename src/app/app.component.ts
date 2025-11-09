import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <img src="assets/logo.png" alt="Credit Carb" class="logo-img" />
        </div>
        <nav class="header-nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Formulário</a>
          <a *ngIf="!isAuthenticated" routerLink="/login" routerLinkActive="active">Administrador</a>
          <a *ngIf="isAuthenticated" routerLink="/admin" routerLinkActive="active">Administrador</a>
          <a *ngIf="isAuthenticated" (click)="logout()" style="cursor: pointer;">Sair</a>
        </nav>
      </div>
    </header>
    <div class="container">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'Credit Carb';
  isAuthenticated = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe((isAuth: boolean) => {
      this.isAuthenticated = isAuth;
    });
  }

  logout(): void {
    this.authService.logout();
  }
}

