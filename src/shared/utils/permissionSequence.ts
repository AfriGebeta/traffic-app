let settled = false;
let resolveSettled: (() => void) | null = null;

export const locationPermissionSettled: Promise<void> = new Promise((resolve) => {
    resolveSettled = resolve;
});

export function markLocationPermissionSettled(): void {
    if (settled) return;
    settled = true;
    resolveSettled?.();
}
