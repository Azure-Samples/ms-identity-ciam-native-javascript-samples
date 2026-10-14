import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  CustomAuthPublicClientApplication,
  ICustomAuthPublicClientApplicationV2,
  type CustomAuthAccountData,
} from '@azure/msal-browser/custom-auth';
import { customAuthConfig } from '../config/auth-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authClientPromise: Promise<ICustomAuthPublicClientApplicationV2>;
  private authClient: ICustomAuthPublicClientApplicationV2 | null = null;
  private currentAccountSubject = new BehaviorSubject<CustomAuthAccountData | undefined>(undefined);

  readonly currentAccount$ = this.currentAccountSubject.asObservable();

  constructor() {
    this.authClientPromise = this.init();
  }

  private async init(): Promise<ICustomAuthPublicClientApplicationV2> {
    this.authClient = await CustomAuthPublicClientApplication.create(customAuthConfig);
    return this.authClient;
  }

  getClient(): Promise<ICustomAuthPublicClientApplicationV2> {
    return this.authClientPromise;
  }

  setCurrentAccount(account: CustomAuthAccountData | undefined): void {
    this.currentAccountSubject.next(account);
  }

  getCurrentAccount(): CustomAuthAccountData | undefined {
    return this.currentAccountSubject.value;
  }
}
