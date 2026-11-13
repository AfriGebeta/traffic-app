// business place type + Campus Collector (gebeta-business-api-mobile.md)

export type LocalizedLabel = { en?: string; am?: string };

export interface CatalogOption {
    key: string;
    label: LocalizedLabel;
    active?: boolean;
}

export interface BusinessKindOption extends CatalogOption {
    offers?: boolean;
}

export interface OfferSuggestion {
    type: string;
    label: string;
    [field: string]: unknown;
}

export interface BusinessGroup extends CatalogOption {
    offers?: boolean;
    kinds: BusinessKindOption[];
    products: CatalogOption[];
    features: CatalogOption[];
    descriptionExample?: string;
    suggestions?: OfferSuggestion[];
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export type Hours = Partial<Record<DayKey, string>>;

export interface HoursPreset {
    key: string;
    label: LocalizedLabel;
    // null: enter by day
    hours: Hours | null;
}

export interface TrialMonth {
    key: string;
    label: LocalizedLabel;
    from: string;
    to: string;
    startsOn: string;
    endsOn: string;
    note?: string;
}

export type OfferInput = 'select' | 'item' | 'number' | 'text';

export interface OfferField {
    key: string;
    label: LocalizedLabel;
    required: boolean;
    input: OfferInput;
    options?: { label: LocalizedLabel; value: string | number }[];
}

export type OfferCommonField = 'audience' | 'days' | 'time' | 'redeem' | 'limit' | 'season' | 'months' | 'startsOn' | 'endsOn' | 'endedOn' | 'title' | 'announcedOn' | (string & {});

export interface OfferTypeOption {
    key: string;
    label: LocalizedLabel;
    active?: boolean;
    badge: string;
    fields: OfferField[];
    common: OfferCommonField[];
}

export interface OfferOptions {
    types: OfferTypeOption[];
    audience: CatalogOption[];
    days: CatalogOption[];
    time: CatalogOption[];
    redeem: CatalogOption[];
    limit: CatalogOption[];
}

export interface PlaceCatalog {
    buildingKinds: CatalogOption[];
    businessGroups: BusinessGroup[];
    campusAreas: CatalogOption[];
    hoursPresets: HoursPreset[];
    photoTypes: { business: CatalogOption[]; building: CatalogOption[] };
    trialMonths: TrialMonth[];
    seasons: CatalogOption[];
    banks: string[];
    offerOptions: OfferOptions;
}

// one offer as sent/received; type-specific fields (pct, item, ...) sit next to the common ones
export interface BusinessOffer {
    id?: string;
    paused?: boolean;
    type: string;
    months?: string[];
    startsOn?: string;
    endsOn?: string;
    endedOn?: string | null;
    title?: string;
    audience?: string;
    days?: string;
    time?: string;
    redeem?: string;
    limit?: string;
    season?: string | null;
    text?: string;
    [field: string]: unknown;
}

export const PAYMENT_METHODS = ['cash', 'telebirr', 'mpesa', 'cbe-birr', 'bank-transfer', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SPEND_LEVELS = ['free', 'under-100', '100-300', '300-1000', 'over-1000'] as const;
export type SpendLevel = (typeof SPEND_LEVELS)[number];

export interface WalletDetails {
    to?: 'merchant' | 'till' | 'phone';
    number?: string;
    name?: string;
}

export interface BankDetails {
    bank: string;
    name?: string;
    number: string;
}

export interface PaymentDetails {
    telebirr?: WalletDetails;
    mpesa?: WalletDetails;
    'cbe-birr'?: { number?: string; name?: string };
    'bank-transfer'?: BankDetails[];
}

export interface BusinessPayload {
    buildingId: string | null;
    streetLevel?: boolean;
    floor?: string;
    unit?: string;
    landmark?: string;
    campus?: string;
    group: string;
    kind: string;
    phone2?: string;
    telegram?: string;
    hoursPreset?: string;
    hours?: Hours;
    // collector only
    spend?: SpendLevel;
    products?: string[];
    payments?: PaymentMethod[];
    paymentDetails?: PaymentDetails;
    features?: string[];
    notes?: string;
    offers?: BusinessOffer[];
    pin?: string;
}

export interface LabeledPhoto {
    key: string;
    type: string;
}

export interface NearbyBuilding {
    id: string;
    name: string | LocalizedLabel;
    lat: number;
    lng: number;
    floorCount: string | null;
    buildingKind: string | null;
    status: string;
    distanceM: number;
}

export type CollectionStatus = 'New' | 'Checked' | 'Live' | 'Rejected' | 'Closed';
export const COLLECTION_STATUSES: CollectionStatus[] = ['New', 'Checked', 'Live', 'Rejected', 'Closed'];

export interface CollectionBusiness {
    id: string;
    name: string | LocalizedLabel;
    status?: CollectionStatus;
    collectionStatus?: CollectionStatus;
    lat?: number;
    lng?: number;
    business?: (BusinessPayload & { offers?: BusinessOffer[] }) | null;
    offers?: BusinessOffer[];
    offerPin?: string | null;
    [field: string]: unknown;
}

export interface CollectionBuilding {
    id: string;
    name: string | LocalizedLabel;
    status?: CollectionStatus;
    collectionStatus?: CollectionStatus;
    floorCount?: string | null;
    // null on buildings added before collectors
    campus?: string | null;
    campusArea?: string | null;
    businesses: CollectionBusiness[];
    [field: string]: unknown;
}

export interface CollectionOverview {
    counts?: {
        businesses?: number;
        businessesTarget?: number;
        buildings?: number;
        withOffers?: number;
        withOffersTarget?: number;
        coverAllMonths?: number;
    };
    buildings: CollectionBuilding[];
    streetLevel: CollectionBusiness[];
    landmarks?: string[];
}

export interface CollectorData {
    paymentDetails?: PaymentDetails | null;
    notes?: string | null;
    offers?: BusinessOffer[];
    offerPin?: string | null;
    offerPinIssuedAt?: string | null;
}

export interface NearbyOfferPlace {
    id: string;
    name: string | LocalizedLabel;
    lat: number;
    lng: number;
    distanceM: number;
    badges: string[];
    offers: PublicOffer[];
}

export interface PublicOffer {
    id: string;
    type: string;
    text: string;
    badge: string;
    audience: string;
    days: string;
    time: string;
    redeem?: string | null;
    limit?: string | null;
    season?: string | null;
    months?: string[];
    startsOn?: string | null;
    endsOn?: string | null;
    studentsOnly?: boolean;
    availableNow: boolean;
    loyalty?: LoyaltyCard | null;
}

export interface LoyaltyCard {
    every: number;
    reward: string;
    stamps: number;
    nextIsReward: boolean;
}

export interface PlaceOffers {
    // kept for old builds; ignore
    month?: string | null;
    offers: PublicOffer[];
}

export interface PublicPlace {
    id: string;
    name: string | LocalizedLabel;
    type: string;
    lat: number;
    lng: number;
    description?: string | null;
    images?: string[];
    photoTypes?: LabeledPhoto[];
    phone?: string | null;
    website?: string | null;
    openingHours?: Hours | null;
    formattedAddress?: string | null;
    campusArea?: string | null;
    business?: (Partial<BusinessPayload> & { telegram?: string | null; phone2?: string | null; features?: string[] }) | null;
}

export interface OfferUse {
    code: string;
    usedAt: string;
    showUntil: string;
    place: { id: string; name: string | LocalizedLabel };
    offer: { id: string; text: string };
    loyalty?: LoyaltyVisit | null;
}

export interface LoyaltyVisit {
    visit: number;
    every: number;
    isReward: boolean;
    reward: string;
}

export interface SavedOffer {
    offerId: string;
    text: string;
    studentsOnly: boolean;
    status: string;
    startsOn?: string | null;
    endsOn?: string | null;
    savedAt: string;
    place: { id: string; name: string | LocalizedLabel; lat: number; lng: number; image?: string | null };
}

export type StudentCheckStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface StudentCheck {
    status: StudentCheckStatus;
    kind: 'student' | 'resident';
    areaKey: string;
    validUntil?: string | null;
    note?: string | null;
    createdAt: string;
}

export interface FollowedPlace {
    id: string;
    name: string | LocalizedLabel;
    lat: number;
    lng: number;
    image?: string | null;
    followedAt: string;
}

export interface OfferIdea {
    label: string;
    why: string;
    offer: BusinessOffer;
}
