export interface TrafficRuleType {
    id: string;
    name: string;
    description: string;
    img: string;
    createdAt: string;
    updatedAt: string;
}

export interface TrafficRuleReport {
    id: string;
    lat: number;
    lng: number;
    type: TrafficRuleType;
    punishment: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TrafficRuleReportRequest {
    lat: number;
    lng: number;
    typeId: string;
    punishment: string;
    userId?: string;
}
