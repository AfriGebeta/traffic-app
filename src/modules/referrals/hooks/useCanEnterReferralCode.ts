import { useEffect, useState } from 'react';
import { getPendingCode, isClaimDone } from '../services/referral.service';

export function useCanEnterReferralCode(): boolean {
    const [canEnter, setCanEnter] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getPendingCode(), isClaimDone()]).then(([pending, done]) => {
            if (cancelled) return;
            const show = !pending && !done;
            console.log(
                `referral field ${show ? 'shown' : 'hidden'}:`,
                pending ? `pending code ${pending}` : done ? 'already claimed' : 'no code captured'
            );
            setCanEnter(show);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return canEnter;
}
