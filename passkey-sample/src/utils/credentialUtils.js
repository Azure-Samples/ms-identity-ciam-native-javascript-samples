const RETRY_DELAY_BASE = 500;
const FETCH_DELAY_BASE = 300;

export const createRetryDelay = (attempt, baseDelay = RETRY_DELAY_BASE) =>
    new Promise(resolve => setTimeout(resolve, baseDelay * attempt));

export const createFetchDelay = (attempt, baseDelay = FETCH_DELAY_BASE) =>
    new Promise(resolve => setTimeout(resolve, baseDelay * attempt));

export const createCredentialToastMessages = {
    errorLoading: () => ({
        title: 'Error loading credentials',
        message: 'Failed to load your credentials. Please try again.',
        variant: 'danger'
    })
};
