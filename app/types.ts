export type ParkingViewType =
  | 'main'
  | 'search'
  | 'wallet'
  | 'notifications'
  | 'findParking'
  | 'qrCode'
  | 'liveSession'
  | 'history';

// types.ts
export interface SessionDetails {
  parkingNumber: string;
  zone: string;
  startTime: string;
  duration: {
    days: number;
    hours: number;
    minutes: number;
  };
}

export interface PaymentDetails {
  startedAt: string;
  endAt: string;
  timeUsed: string;
  pricePerHour: number;
  totalPrice: number;
}

export interface ContactInfo {
  name: string;
  phone: string;
}
