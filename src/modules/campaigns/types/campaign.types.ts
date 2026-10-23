
export type LocalizedText = string | { en?: string; am?: string };

export type CampaignKind = 'place' | 'taxi_station' | 'traffic_rule' | 'incident';

export interface CampaignTrack {
    key: string;
    name: LocalizedText;
}

export interface CampaignPeriodInfo {
    kind?: CampaignPeriodKind;
    key: string;
    label?: string;
    start?: string;
    end?: string;
    status: CampaignPeriodStatus;
}

export type CampaignPeriodStatus = 'live' | 'auditing' | 'final';

export type CampaignPeriodKind = string;

export type CampaignPhase = 'live' | 'auditing' | 'final';

export interface CampaignPeriod {
    kind: CampaignPeriodKind;
    freezeHours?: number;
    current?: CampaignPeriodInfo;
}

export interface CampaignTheme {
    from: string;
    to: string;
    kinds: CampaignKind[];
    multiplier: number;
}

export interface CampaignPointsFormula {
    base: Partial<Record<CampaignKind, number>>;
    quality?: { required?: number; photo?: number; complete?: number };
    priorityMultiplier?: number;
    firstToMapBonus?: number;
    correctionShare?: number;
    confirmationsNeeded?: number;
    dailyItemCap?: number;
    themes?: CampaignTheme[];
}

export interface CampaignRequirements {
    contributorWithinM?: number;
    photoRequired?: boolean;
    photoWithinM?: number;
    photoMaxAgeHours?: number;
}

export interface GeoJsonBoundary {
    type: 'Polygon' | 'MultiPolygon';
    // GeoJSON order: [lng, lat]
    coordinates: number[][][] | number[][][][];
}

export interface Campaign {
    id?: string;
    slug: string;
    name: LocalizedText;
    description?: LocalizedText;
    status: string;
    requiresJoin: boolean;
    startsAt?: string;
    endsAt?: string;
    boundary?: GeoJsonBoundary | null;
    requirements?: CampaignRequirements;
    tracks: CampaignTrack[];
    periods: CampaignPeriod[];
    pointsFormula?: CampaignPointsFormula;
    priorityCells?: string[];
    // prize amount (ETB) by final rank, e.g. { "1": 5000, "2": 3000 }
    prizes?: Record<string, number>;
    // which events pay; the formula only applies to submissions when SUBMISSION_VERIFIED is here
    scoring?: CampaignScoringRule[];
    phase?: CampaignPhase;
    resultsFinalAt?: string;
}

export interface CampaignScoringRule {
    event: string;
    track?: string;
    points?: number | null;
    description?: string;
}

export interface CampaignStandingPeriod {
    period: { kind: CampaignPeriodKind; key: string; label?: string; status?: CampaignPeriodStatus } | string;
    rank: number | null;
    score: number;
    participants: number;
}

export interface CampaignMe {
    joined: boolean;
    enrollment?: {
        track: string;
        disqualified?: boolean;
        disqualifiedReason?: string | null;
    } | null;
    periods?: CampaignStandingPeriod[];
}

export interface CampaignLeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    campaignScore: number;
    eventCount: number;
}

export interface CampaignLeaderboard {
    active: boolean;
    track: string;
    period: {
        kind: CampaignPeriodKind;
        key: string;
        label?: string;
        status: CampaignPeriodStatus;
        hidden?: boolean;
        hiddenFrom?: string;
        freezeUntil?: string;
    };
    data: CampaignLeaderboardEntry[];
    // only present when ?page= is sent
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
}

export type SubmissionStatus = 'PENDING' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';

export interface SubmissionScoreDetail {
    base?: number;
    quality?: number;
    area?: number;
    bonus?: number;
    points?: number;
    // e.g. "outside_campaign": verified but earns no campaign points
    reason?: string;
}

export interface Submission {
    id: string;
    kind: CampaignKind;
    action: 'create' | 'correction' | string;
    status: SubmissionStatus;
    points: number;
    scoreDetail?: SubmissionScoreDetail | null;
    campaign?: { id: string; slug: string; name: LocalizedText } | null;
    photoUrls?: string[];
    fields?: Record<string, any>;
    // why it was rejected: duplicate, photo_reused, mock_location, high_risk, disputed…
    decisionNote?: string | null;
    createdAt: string;
}

export interface SubmissionKindStats {
    submitted: number;
    verified: number;
    pending: number;
    rejected: number;
    points: number;
}

export interface MySubmissions {
    data: Submission[];
    summary?: Partial<Record<SubmissionStatus, { count: number; points: number }>>;
    byKind?: Partial<Record<CampaignKind, SubmissionKindStats>>;
    totalPoints: number;
    total: number;
}
