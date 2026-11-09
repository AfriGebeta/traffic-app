import {
    BankDetails,
    BusinessOffer,
    BusinessPayload,
    DAY_KEYS,
    DayKey,
    Hours,
    OfferTypeOption,
    PaymentDetails,
    PaymentMethod,
    PlaceCatalog,
    SpendLevel,
} from '../types/business.types';

export const STREET_LEVEL = '__street__';
export const ADD_BUILDING = '__add__';
export const CUSTOM_HOURS = 'different-hours';
export const MAX_DESCRIPTION = 240;
export const MAX_OFFERS = 3;
export const MAX_FLOORS = 20;

export interface DayHours {
    open: string;
    close: string;
    closed: boolean;
}

export interface WalletDraft {
    to: string;
    number: string;
    name: string;
}

export interface BusinessDraft {
    // building id, STREET_LEVEL, or null (not chosen)
    buildingChoice: string | null;
    buildingName: string;
    buildingFloorCount: string | null;
    floor: string | null;
    unit: string;
    landmark: string;
    campus: string | null;
    group: string | null;
    kind: string | null;
    phone2: string;
    hoursPreset: string | null;
    customHours: Record<DayKey, DayHours>;
    spend: SpendLevel | null;
    products: string[];
    payments: PaymentMethod[];
    telebirr: WalletDraft;
    mpesa: WalletDraft;
    cbeBirr: { number: string; name: string };
    banks: BankDetails[];
    features: string[];
    notes: string;
    offers: BusinessOffer[];
    pin: string;
}

const emptyDay = (): DayHours => ({ open: '', close: '', closed: false });

export const emptyBusinessDraft = (): BusinessDraft => ({
    buildingChoice: null,
    buildingName: '',
    buildingFloorCount: null,
    floor: null,
    unit: '',
    landmark: '',
    campus: null,
    group: null,
    kind: null,
    phone2: '',
    hoursPreset: null,
    customHours: Object.fromEntries(DAY_KEYS.map((day) => [day, emptyDay()])) as Record<DayKey, DayHours>,
    spend: null,
    products: [],
    payments: [],
    telebirr: { to: 'merchant', number: '', name: '' },
    mpesa: { to: 'till', number: '', name: '' },
    cbeBirr: { number: '', name: '' },
    banks: [{ bank: '', name: '', number: '' }],
    features: [],
    notes: '',
    offers: [],
    pin: '',
});

export const normalizeTime = (raw: string): string | null => {
    const digits = raw.replace(/[^\d:]/g, '');
    const match = digits.includes(':') ? digits.match(/^(\d{1,2}):(\d{1,2})$/) : digits.match(/^(\d{1,2})(\d{2})?$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const customHoursToPayload = (custom: Record<DayKey, DayHours>): Hours | null => {
    const hours: Hours = {};
    for (const day of DAY_KEYS) {
        const entry = custom[day];
        if (entry.closed) {
            hours[day] = 'closed';
            continue;
        }
        if (!entry.open.trim() && !entry.close.trim()) continue;
        const open = normalizeTime(entry.open);
        const close = normalizeTime(entry.close);
        if (!open || !close) return null;
        hours[day] = `${open}-${close}`;
    }
    return hours;
};

export const hoursOf = (draft: BusinessDraft, catalog: PlaceCatalog | null): Hours | null => {
    if (!draft.hoursPreset) return {};
    if (draft.hoursPreset === CUSTOM_HOURS) return customHoursToPayload(draft.customHours);
    return catalog?.hoursPresets.find((preset) => preset.key === draft.hoursPreset)?.hours ?? {};
};

// "Every day, 7:00 to 21:00" for a preset, "Mon 07:00-21:00, Sun closed" for custom; undefined when empty
export const hoursText = (draft: BusinessDraft, catalog: PlaceCatalog | null): string | undefined => {
    if (!draft.hoursPreset) return undefined;
    if (draft.hoursPreset !== CUSTOM_HOURS) {
        return catalog?.hoursPresets.find((preset) => preset.key === draft.hoursPreset)?.label.en || undefined;
    }
    const hours = customHoursToPayload(draft.customHours);
    if (!hours) return undefined;
    const parts = DAY_KEYS.filter((day) => hours[day]).map((day) => `${day[0].toUpperCase()}${day.slice(1)} ${hours[day]}`);
    return parts.length ? parts.join(', ') : undefined;
};

// Basement, Ground, 1 … floorCount (max 20)
export const floorValues = (floorCount: string | null): string[] => {
    const count = Math.min(MAX_FLOORS, Math.max(0, Number(floorCount) || MAX_FLOORS));
    return ['basement', 'ground', ...Array.from({ length: count }, (_, i) => String(i + 1))];
};

export const offersAllowed = (draft: BusinessDraft, catalog: PlaceCatalog | null): boolean => {
    const group = catalog?.businessGroups.find((g) => g.key === draft.group);
    const kind = group?.kinds.find((k) => k.key === draft.kind);
    return !!group?.offers && !!kind?.offers;
};

// announcements have nothing to redeem; every other type (bundle too) can use a code
export const offerUsesPin = (offers: BusinessOffer[]) => offers.some((offer) => offer.type !== 'announce' && offer.redeem === 'code-with-pin');

const digits = (value: string) => value.replace(/\s/g, '');

const paymentDetailsOf = (draft: BusinessDraft): PaymentDetails | undefined => {
    const details: PaymentDetails = {};
    const wallet = (w: WalletDraft) =>
        w.number.trim() || w.name.trim() ? { to: w.to as any, number: digits(w.number) || undefined, name: w.name.trim() || undefined } : undefined;
    if (draft.payments.includes('telebirr')) details.telebirr = wallet(draft.telebirr);
    if (draft.payments.includes('mpesa')) details.mpesa = wallet(draft.mpesa);
    if (draft.payments.includes('cbe-birr') && (draft.cbeBirr.number.trim() || draft.cbeBirr.name.trim())) {
        details['cbe-birr'] = { number: digits(draft.cbeBirr.number) || undefined, name: draft.cbeBirr.name.trim() || undefined };
    }
    if (draft.payments.includes('bank-transfer')) {
        const banks = draft.banks
            .filter((b) => b.bank && b.number.trim())
            .map((b) => ({ bank: b.bank, name: b.name?.trim() || undefined, number: b.number.replace(/[\s-]/g, '') }) as BankDetails);
        if (banks.length) details['bank-transfer'] = banks;
    }
    const cleaned = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined));
    return Object.keys(cleaned).length ? (cleaned as PaymentDetails) : undefined;
};

// drops empty fields and fields the offer type doesn't use
export const cleanOffer = (offer: BusinessOffer, type: OfferTypeOption | undefined): BusinessOffer => {
    const allowed = new Set<string>(['id', 'paused', 'type', ...(type?.fields.map((f) => f.key) ?? []), ...(type?.common ?? [])]);
    return Object.fromEntries(
        Object.entries(offer).filter(([key, value]) => allowed.has(key) && value !== '' && value !== null && value !== undefined)
    ) as BusinessOffer;
};

// missing required offer fields, as field keys
export const offerMissing = (offer: BusinessOffer, type: OfferTypeOption | undefined): string[] => {
    if (!type) return ['type'];
    const missing = type.fields.filter((f) => f.required && (offer[f.key] === undefined || offer[f.key] === '')).map((f) => f.key);
    if (type.key === 'announce' && !offer.what && !String(offer.headline ?? '').trim()) missing.push('headline');
    if (!offer.months?.length) missing.push('months');
    for (const common of ['audience', 'days', 'time', 'redeem', 'limit'] as const) {
        if (type.common.includes(common) && !offer[common]) missing.push(common);
    }
    return missing;
};

export interface BuiltBusiness {
    business: BusinessPayload;
    // translation keys of what still needs filling
    missing: string[];
}

export const buildBusiness = (draft: BusinessDraft, isCollector: boolean, catalog: PlaceCatalog | null): BuiltBusiness => {
    const missing: string[] = [];
    const streetLevel = draft.buildingChoice === STREET_LEVEL;
    if (!draft.buildingChoice) missing.push('business-building');
    if (draft.buildingChoice && !streetLevel && !draft.floor) missing.push('business-floor');
    if (!draft.group) missing.push('business-group');
    if (!draft.kind) missing.push('business-kind');
    if (isCollector && streetLevel && !draft.campus) missing.push('campus-area');

    const hours = hoursOf(draft, catalog);
    if (hours === null) missing.push('business-hours-invalid');
    else if (isCollector && Object.keys(hours).length === 0) missing.push('business-hours');

    const offerTypes = catalog?.offerOptions.types ?? [];
    const offers = isCollector && offersAllowed(draft, catalog) ? draft.offers : [];
    offers.forEach((offer) => {
        if (offerMissing(offer, offerTypes.find((t) => t.key === offer.type)).length) missing.push('offer-incomplete');
    });

    const business: BusinessPayload = {
        buildingId: streetLevel ? null : draft.buildingChoice,
        ...(streetLevel ? { streetLevel: true } : { floor: draft.floor ?? undefined }),
        ...(!streetLevel && draft.unit.trim() && { unit: draft.unit.trim() }),
        ...(streetLevel && draft.landmark.trim() && { landmark: draft.landmark.trim() }),
        ...(streetLevel && draft.campus && { campus: draft.campus }),
        group: draft.group ?? '',
        kind: draft.kind ?? '',
        ...(draft.phone2.trim() && { phone2: draft.phone2.trim() }),
        ...(draft.hoursPreset && { hoursPreset: draft.hoursPreset }),
        ...(hours && Object.keys(hours).length > 0 && { hours }),
    };

    if (isCollector) {
        const paymentDetails = paymentDetailsOf(draft);
        Object.assign(business, {
            ...(draft.spend && { spend: draft.spend }),
            ...(draft.products.length && { products: draft.products }),
            ...(draft.payments.length && { payments: draft.payments }),
            ...(paymentDetails && { paymentDetails }),
            ...(draft.features.length && { features: draft.features }),
            ...(draft.notes.trim() && { notes: draft.notes.trim() }),
            offers: offers.map((offer) => cleanOffer(offer, offerTypes.find((t) => t.key === offer.type))),
            ...(offerUsesPin(offers) && /^\d{4}$/.test(draft.pin) && { pin: draft.pin }),
        });
    }

    return { business, missing: Array.from(new Set(missing)) };
};

// same wording the backend saves as `text` (API guide, "Preview text")
export const offerPreview = (offer: BusinessOffer, fallback = ''): string => {
    const s = (key: string) => String(offer[key] ?? '').trim();
    const lower = (key: string) => s(key).toLowerCase();
    switch (offer.type) {
        case 'percent':
            return offer.pct ? `${offer.pct}% off ${lower('applies') || 'everything'}` : fallback;
        case 'price':
            return s('item') && s('offerPrice')
                ? `${s('item')} for ${s('offerPrice')} birr${s('normalPrice') ? ` instead of ${s('normalPrice')}` : ''}`
                : fallback;
        case 'bundle':
            return s('items') && s('price') ? `${s('items')} for ${s('price')} birr${s('normalPrice') ? ` instead of ${s('normalPrice')}` : ''}` : fallback;
        case 'extra':
            return s('free') && s('withItem') ? `Free ${lower('free')} with any ${lower('withItem')}` : fallback;
        case 'bxgy':
            return offer.buy && s('item') && offer.getFree ? `Buy ${offer.buy} ${lower('item')}, get ${offer.getFree} free` : fallback;
        case 'first':
            return s('gift') ? `First visit: ${lower('gift')}` : fallback;
        case 'loyalty':
            return offer.every && s('reward') ? `Every ${offer.every}th visit: ${lower('reward')}` : fallback;
        case 'announce':
            return s('headline') || s('what') || fallback;
        default:
            return fallback;
    }
};

// "Write a draft from the form": what it is, exact location, one reason to visit
export const draftDescription = (args: { kindLabel: string; products: string[]; where: string; feature?: string }): string => {
    const what = args.products.length ? `${args.kindLabel} with ${args.products.slice(0, 3).join(', ').toLowerCase()}.` : `${args.kindLabel}.`;
    const where = args.where ? ` ${args.where}.` : '';
    const why = args.feature ? ` ${args.feature}.` : '';
    return `${what}${where}${why}`.slice(0, MAX_DESCRIPTION);
};

export const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));
