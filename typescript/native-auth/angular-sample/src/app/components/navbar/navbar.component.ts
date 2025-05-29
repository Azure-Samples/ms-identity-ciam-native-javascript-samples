import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class NavbarComponent {
  constructor(private auth: AuthService, private router: Router) {}

  async logout() {
    const client = await this.auth.getClient();
    const account = client.getCurrentAccount();
    if (account && account.data && account.data.signOut) {
      await account.data.signOut();
      this.router.navigate(['/sign-in']);
    }
  }
}
