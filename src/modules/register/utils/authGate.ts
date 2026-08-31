import { getStoredUser } from './profileGate';

export const AUTH_ROUTE = '/telegram-login';

export async function isAuthenticated(): Promise<boolean> {
    const stored = await getStoredUser();
    return !!stored?.id;
}
