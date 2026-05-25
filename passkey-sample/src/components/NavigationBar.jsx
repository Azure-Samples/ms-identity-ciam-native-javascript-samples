import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { Navbar, Button } from 'react-bootstrap';
import { loginRequest } from '../authConfig';
import { clearAppTokenCache } from '../utils/tokenUtils';

export const NavigationBar = () => {
    const { instance } = useMsal();

    const handleLoginRedirect = async () => {
        try {
            await instance.loginRedirect({
                ...loginRequest,
                prompt: 'login',
            });
        } catch (error) {
            console.error('Login redirect failed:', error);
        }
    };

    const handleLogoutRedirect = async () => {
        try {
            const accounts = instance.getAllAccounts();
            clearAppTokenCache(instance);

            if (accounts.length === 0) {
                await instance.clearCache();
                window.location.href = '/';
                return;
            }
            
            await instance.logoutRedirect({
                account: accounts[0],
            });
        } catch (error) {
            console.error('Logout redirect failed:', error);
        }
    };

    /**
     * Most applications will need to conditionally render certain components based on whether a user is signed in or not.
     * msal-react provides 2 easy ways to do this. AuthenticatedTemplate and UnauthenticatedTemplate components will
     * only render their children if a user is authenticated or unauthenticated, respectively.
     */
    return (
        <>
            <Navbar bg="primary" variant="dark" className="navbarStyle">
                <a className="navbar-brand" href="/">
                    Microsoft identity platform
                </a>
                <AuthenticatedTemplate>
                    <div className="collapse navbar-collapse justify-content-end">
                        <Button variant="warning" onClick={handleLogoutRedirect}>
                            Sign out
                        </Button>
                    </div>
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                    <div className="collapse navbar-collapse justify-content-end">
                        <Button onClick={handleLoginRedirect}>Sign in</Button>
                    </div>
                </UnauthenticatedTemplate>
            </Navbar>
        </>
    );
};
