export const costGateTripped = ({
    dNew,
    dRef,
    floorM,
    ratio,
}: {
    dNew: number;
    dRef: number;
    floorM: number;
    ratio: number;
}): boolean => dNew > floorM && dNew > ratio * dRef;

export interface AwayState {
    streak: number;
    anchor: number | null;
}

export const nextAwayState = (
    state: AwayState,
    direct: number,
    previous: number | null
): AwayState => {
    if (previous === null) return { streak: 0, anchor: direct };
    if (direct >= previous) return { streak: state.streak + 1, anchor: state.anchor ?? direct };
    return { streak: 0, anchor: direct };
};

export const awayTripped = (
    state: AwayState,
    direct: number,
    fixCount: number,
    netGainM: number
): boolean => {
    if (state.streak < fixCount) return false;
    const netGain = direct - (state.anchor ?? direct);
    return netGain > netGainM;
};

export const segmentStartIndex = (pathLengths: number[], segmentIndex: number): number => {
    let offset = 0;
    for (let i = 0; i < segmentIndex && i < pathLengths.length; i++) {
        offset += pathLengths[i];
    }
    return offset;
};
