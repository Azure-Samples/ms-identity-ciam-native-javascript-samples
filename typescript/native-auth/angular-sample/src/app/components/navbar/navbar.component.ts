import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class NavbarComponent implements OnDestroy {
  logoutError = '';
  logoutLoading = false;
  private readonly accountSubscription: Subscription;

  constructor(private auth: AuthService, private router: Router) {
    this.accountSubscription = this.auth.currentAccount$.subscribe((account) => {
      if (account) {
        this.logoutError = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.accountSubscription.unsubscribe();
  }

  async logout(): Promise<void> {
    if (this.logoutLoading) {
      return;
    }

    this.logoutError = '';
    this.logoutLoading = true;
    try {
      let account = this.auth.getCurrentAccount();
      if (!account) {
        const client = await this.auth.getClient();
        const accountResult = client.getCurrentAccount();

        if (
          accountResult.isFailed() &&
          !accountResult.error?.isCurrentAccountNotFound()
        ) {
          this.logoutError =
            accountResult.error?.errorData.errorDescription ||
            'The current account could not be read.';
        }
        account = accountResult.data;
      }

      if (account) {
        await account.signOut();
      }

      if (this.logoutError) {
        return;
      }

      this.auth.setCurrentAccount(undefined);
      await this.router.navigateByUrl('/');
      window.location.reload();
    } catch (error) {
      this.logoutError =
        error instanceof Error ? error.message : 'An unexpected sign-out error occurred.';
    } finally {
      this.logoutLoading = false;
    }
  }
}
