import { Injectable } from '@angular/core';
import { CustomAuthPublicClientApplication, ICustomAuthPublicClientApplication } from '@azure/msal-browser/custom-auth';
import { customAuthConfig } from '../config/auth-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authClientPromise: Promise<ICustomAuthPublicClientApplication>;
  private authClient: ICustomAuthPublicClientApplication | null = null;

  constructor() {
    this.authClientPromise = this.init();
  }

  private async init(): Promise<ICustomAuthPublicClientApplication> {
    this.authClient = await CustomAuthPublicClientApplication.create(customAuthConfig);
    return this.authClient;
  }

  getClient(): Promise<ICustomAuthPublicClientApplication> {
    return this.authClientPromise;
  }
}
