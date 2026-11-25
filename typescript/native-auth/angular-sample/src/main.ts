import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const params = `${window.location.hash}${window.location.search}`;
  if (/[#&?](code|error|ear_jwe)=/.test(params)) {
    await broadcastResponseToMainFrame();
    return;
  }

  await platformBrowserDynamic().bootstrapModule(AppModule);
}

bootstrap().catch(err => console.error(err));
