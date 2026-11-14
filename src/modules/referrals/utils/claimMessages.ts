import type { TFunction } from 'i18next';
import type { ClaimResult } from '../services/referral.service';

export const claimResultMessage = (t: TFunction, result: ClaimResult): string => {
    switch (result) {
        case 'claimed':
            return t('referral-claimed');
        case 'not_found':
            return t('referral-not-found');
        case 'not_allowed':
            return t('referral-not-allowed');
        case 'already_used':
            return t('referral-already-used');
        default:
            return t('referral-failed');
    }
};
