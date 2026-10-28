type Translate = (key: string, options?: Record<string, unknown>) => string;

// "Just now", "5 min ago", "3 h ago", "2 d ago", then the date
export const timeAgo = (iso: string, t: Translate, language: string, now = Date.now()): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const minutes = Math.floor((now - then) / 60000);
    if (minutes < 1) return t('time-just-now');
    if (minutes < 60) return t('time-minutes-ago', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('time-hours-ago', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('time-days-ago', { count: days });
    return new Date(then).toLocaleDateString(language.startsWith('am') ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric' });
};
