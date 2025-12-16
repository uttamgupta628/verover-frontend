// types/index.ts
export interface BookingData {
  _id?: string;
  bookingId: string;
  type: 'G' | 'L' | 'R';
  garageName: string;
  slot: string;
  vehicleNumber?: string;
  
  // Booking period
  bookingPeriod: {
    from: string;
    to: string;
  };
  
  // Payment details
  paymentDetails: {
    status: 'PENDING' | 'SUCCESS' | 'CANCELLED' | 'FAILED' | 'REFUNDED';
    amount?: number; // This might be 0 or missing
    method: 'CASH' | 'CARD' | 'CREDIT' | 'UPI' | 'WALLET' | string;
    transactionId?: string;
    paidAt?: string;
    paymentGateway?: 'STRIPE' | 'CASH' | string;
  };
  
  // Amount fields (based on your previous logs)
  amountToPaid?: number;        // Final amount customer pays
  totalAmount?: number;         // Base amount before platform charges
  platformCharge?: number;      // Platform fee
  discount?: number;           // Any discount applied
  priceRate?: number;          // Rate per hour
  
  // Pricing breakdown
  pricing?: {
    priceRate?: number;
    basePrice: number;
    discount: number;
    platformCharge: number;
    couponApplied: boolean;
    couponDetails: any;
    totalAmount: number;
  };
  
  // Location info
  placeInfo?: {
    name: string;
    phoneNo: string;
    owner: string;
    address: string;
    location: any;
  };
  
  // Stripe details for card payments
  stripeDetails?: {
    paymentIntent: string | null;
    ephemeralKey?: string;
    customerId: string;
    paymentIntentId: string;
  };
  
  createdAt?: string;
  updatedAt?: string;
}