import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SignInComponent } from './components/v1/sign-in.component';
import { SignUpComponent } from './components/v1/sign-up.component';
import { ResetPasswordComponent } from './components/v1/reset-password.component';
import { AuthService } from './services/auth.service';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SignInV2Component } from './components/v2/sign-in-v2.component';
import { SignUpV2Component } from './components/v2/sign-up-v2.component';
import { ResetPasswordV2Component } from './components/v2/reset-password-v2.component';
import { UnifiedAuthComponent } from './components/unified-auth/unified-auth.component';

const routes: Routes = [
  { path: '', component: UnifiedAuthComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'v2/sign-in', component: SignInV2Component },
  { path: 'v2/sign-up', component: SignUpV2Component },
  { path: 'v2/reset-password', component: ResetPasswordV2Component }
];

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot(routes),
    NavbarComponent,
    SignInComponent,
    SignUpComponent,
    ResetPasswordComponent,
    SignInV2Component,
    SignUpV2Component,
    ResetPasswordV2Component,
    UnifiedAuthComponent
  ],
  providers: [AuthService],
  bootstrap: [AppComponent]
})
export class AppModule {}
