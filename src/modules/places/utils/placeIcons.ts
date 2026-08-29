import React from 'react';

import GasStationLight from '../../../../assets/images/contribute-place-gas-station-light.svg';
import GasStationDark from '../../../../assets/images/contribute-place-gas-station-dark.svg';
import TaxiLight from '../../../../assets/images/contribute-place-taxi-light.svg';
import TaxiDark from '../../../../assets/images/contribute-place-taxi-dark.svg';
import RestaurantLight from '../../../../assets/images/contribute-place-restaurant-light.svg';
import RestaurantDark from '../../../../assets/images/contribute-place-restaurant-dark.svg';
import CafeLight from '../../../../assets/images/contribute-place-cafe-light.svg';
import CafeDark from '../../../../assets/images/contribute-place-cafe-dark.svg';
import ParkingLight from '../../../../assets/images/contribute-place-parking-light.svg';
import ParkingDark from '../../../../assets/images/contribute-place-parking-dark.svg';
import HospitalLight from '../../../../assets/images/contribute-place-hospital-light.svg';
import HospitalDark from '../../../../assets/images/contribute-place-hospital-dark.svg';
import ClinicLight from '../../../../assets/images/contribute-place-clinic-light.svg';
import ClinicDark from '../../../../assets/images/contribute-place-clinic-dark.svg';
import PharmacyLight from '../../../../assets/images/contribute-place-pharmacy-light.svg';
import PharmacyDark from '../../../../assets/images/contribute-place-pharmacy-dark.svg';
import BankLight from '../../../../assets/images/contribute-place-bank-light.svg';
import BankDark from '../../../../assets/images/contribute-place-bank-dark.svg';
import AtmLight from '../../../../assets/images/contribute-place-atm-light.svg';
import AtmDark from '../../../../assets/images/contribute-place-atm-dark.svg';
import HotelLight from '../../../../assets/images/contribute-place-hotel-light.svg';
import HotelDark from '../../../../assets/images/contribute-place-hotel-dark.svg';
import SchoolLight from '../../../../assets/images/contribute-place-school-light.svg';
import SchoolDark from '../../../../assets/images/contribute-place-school-dark.svg';
import ParkLight from '../../../../assets/images/contribute-place-park-light.svg';
import ParkDark from '../../../../assets/images/contribute-place-park-dark.svg';
import BuildingLight from '../../../../assets/images/contribute-place-building-light.svg';
import BuildingDark from '../../../../assets/images/contribute-place-building-dark.svg';
import CompanyLight from '../../../../assets/images/contribute-place-company-light.svg';
import CompanyDark from '../../../../assets/images/contribute-place-company-dark.svg';
import GovernmentLight from '../../../../assets/images/contribute-place-government-light.svg';
import GovernmentDark from '../../../../assets/images/contribute-place-government-dark.svg';
import MallLight from '../../../../assets/images/contribute-place-mall-light.svg';
import MallDark from '../../../../assets/images/contribute-place-mall-dark.svg';
import ShopLight from '../../../../assets/images/contribute-place-shop-light.svg';
import ShopDark from '../../../../assets/images/contribute-place-shop-dark.svg';
import MoreLight from '../../../../assets/images/contribute-place-more-light.svg';
import MoreDark from '../../../../assets/images/contribute-place-more-dark.svg';

export type PlaceIcon = React.FC<{ width?: number; height?: number }>;

const PLACE_ICONS: Record<string, { light: PlaceIcon; dark: PlaceIcon }> = {
    gas_station: { light: GasStationLight, dark: GasStationDark },
    taxi_station: { light: TaxiLight, dark: TaxiDark },
    restaurant: { light: RestaurantLight, dark: RestaurantDark },
    cafe: { light: CafeLight, dark: CafeDark },
    parking: { light: ParkingLight, dark: ParkingDark },
    hospital: { light: HospitalLight, dark: HospitalDark },
    clinic: { light: ClinicLight, dark: ClinicDark },
    pharmacy: { light: PharmacyLight, dark: PharmacyDark },
    bank: { light: BankLight, dark: BankDark },
    atm: { light: AtmLight, dark: AtmDark },
    hotel: { light: HotelLight, dark: HotelDark },
    school: { light: SchoolLight, dark: SchoolDark },
    park: { light: ParkLight, dark: ParkDark },
    building: { light: BuildingLight, dark: BuildingDark },
    company: { light: CompanyLight, dark: CompanyDark },
    government: { light: GovernmentLight, dark: GovernmentDark },
    mall: { light: MallLight, dark: MallDark },
    shop: { light: ShopLight, dark: ShopDark },
    other: { light: MoreLight, dark: MoreDark },
};

export const getPlaceIcon = (type: string | undefined, isDark: boolean): PlaceIcon => {
    const entry = (type && PLACE_ICONS[type]) || PLACE_ICONS.other;
    return isDark ? entry.dark : entry.light;
};
