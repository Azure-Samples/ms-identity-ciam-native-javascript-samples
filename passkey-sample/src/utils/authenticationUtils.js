export const requiresFullReauthentication = (error) =>
    error?.status === 401 || error?.message?.includes('AADSTS7006105') === true;

export const createAuthenticationToastMessages = {
    sessionExpired: () => ({
        title: 'Session expired',
        message: 'Your session has expired. Redirecting to sign in...',
        variant: 'warning'
    }),

    sessionExpiredWithAction: (onSignIn, onDismiss) => ({
        title: `Let's keep your account secure`,
        message: 'You will need to complete multi-factor authentication to perform this action. You will be redirected to verify your identity securely.',
        variant: 'warning',
        autoHide: false,
        type: 'sessionExpiredWithAction',
        onDismiss,
        action: {
            label: 'Next',
            variant: 'primary',
            onClick: onSignIn
        }
    }),

    authError: () => ({
        title: 'Authentication error',
        message: 'Failed to re-authenticate. Please try again.',
        variant: 'danger'
    })
};
