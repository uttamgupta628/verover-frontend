export interface User {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phoneNumber: string;
  country?: string;
  state?: string;
  zipCode?: string;
  token?: string;
  _id?: string;
}
interface GeneralAvailable {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  is24Hours: boolean;
}
export interface ParkingLot {
  _id: string;
  name: string;
  gpsLocation?: {
    type: 'Point',
    coordinates: [number, number]
  };
  images: string[];
  owner: string | User;
  contactNumber: string;
  vehicleType: 'bike' | 'car' | 'both';
  parkingName: string;
  address: string;
  price: number;
  about: string;
  spacesList: { [key: string]: { price: number, count: number } };
  generalAvailable: GeneralAvailable[];
  is24x7: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface GarageMerchantDetails {
  _id: string;
  name: string;
  location?: {
    type: 'Point',
    coordinates: [number, number]
  };
  images: string[];
  owner: string | User;
  vehicleType: 'bike' | 'car' | 'both';
  contactNumber: string;
  garageName: string;
  address: string;
  price: number;
  about: string;
  spacesList: { [key: string]: { price: number, count: number } };
  generalAvailable: GeneralAvailable[];
  is24x7: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface Residence {
  _id: string;
  name: string;
  gpsLocation?: {
    type: 'Point',
    coordinates: [number, number]
  };
  images: string[];
  owner: string | User;
  vehicleType: 'bike' | 'car' | 'both';
  contactNumber: string;
  residenceName: string;
  address: string;
  price: number;
  about: string;
  generalAvailable: GeneralAvailable[];
  is24x7: boolean;
  isActive: boolean;
  parking_pass?: boolean;
  transportationAvailable?: boolean;
  transportationTypes?: string[];
  coveredDrivewayAvailable?: boolean;
  coveredDrivewayTypes?: string[];
  securityCamera?: boolean;
}

export type BookingData = {
  _id: string;
  bookedSlot: string,
  bookingPeriod: {
    from: string;
    to: string;
  };
  createdAt: string;
  customer: {
    _id: string;
    email: string;
    name: string;
    phone: string;
  };

  priceRate?: number;
  paymentDetails: {
    amountPaid: number;
    discount: number;
    status: string;
    platformCharge?: number;
    totalAmount: number;
    paidAt: string | null;
  };
} & ({
  type: 'G',
  garage: {
    _id: string;
    address: string;
    contactNumber: string;
    name: string;
    ownerName?: string;
  };
} | {
  parking: {
    _id: string;
    address: string;
    contactNumber: string;
    name: string;
    ownerName?: string;
  };
  type: 'L';
} | {
  type: "R";
  residence: {
    _id: string;
    address: string;
    contactNumber: string;
    name: string;
    ownerName?: string;
  }
}
  )

export interface AxiosResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Redux interfaces
export interface AuthState {
  token: string | null;
  user: any;
  isAuthenticated: boolean;
}

export interface RootState {
  auth: AuthState;
}

// Vehicle Info interfaces
export interface VehicleInfo {
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  noOfDoors: number;
  vehicleColor: string;
  noOfSeats: number;
  noOfBooster: number;
  vehicleNumber: string;
  registrationNumber: string;
  vehicleInspectionImage: string;
  vehicleInsuranceImage: string;
  localCertificate: string;
  insuranceProviderCompany: string;
  insuranceNumber: string;
}

export interface UploadedImages {
  inspection: string[];
  insurance: string[];
  certification: string[];
}

export interface DropdownOption {
  label: string;
  value: string;
}

export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

export interface HoursOfOperation {
    day: string;
    open: string;
    close: string;
}

export interface Service {
    name: string;
    category: string;
    strachLevel: number;
    washOnly: boolean;
    additionalservice: 'zipper' | 'button' | 'wash/fold';
    price: number;
}

export interface DryCleanFormData {
    shopname: string;
    address: Address;
    about: string;
    contactPerson: string;
    phoneNumber: string;
    hoursOfOperation: HoursOfOperation[];
    services: Service[];
}

export interface SelectedImage {
    uri: string;
    type: string;
    fileName?: string;
}

export interface Images {
    contactPersonImg: SelectedImage | null;
    shopImages: SelectedImage[];
}

export interface DryCleaner {
  _id: string;
  shopname: string;
  address?: Address;
  rating: number;
  about: string;
  contactPerson: string;
  phoneNumber: string;
  contactPersonImg: string;
  shopimage: string[];
  hoursOfOperation: HoursOfOperation[];
  services: Service[];
  owner: string;
  ownerId?: string;
}

export interface HoursOfOperation {
  day: string;
  open: string;
  close: string;
  _id: string;
}

export interface Service {
  name: string;
  category: string;
  strachLevel: number;
  washOnly: boolean;
  additionalservice?: string;
  price: number;
  _id: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface RootStackParamList {
  EditDryCleaner: { dryCleaner: DryCleaner };
  AddDryCleaner: undefined;
  Login: undefined;
}

// Modal Props
export interface ServiceEditModalProps {
  visible: boolean;
  service: Service | null;
  onClose: () => void;
  onSave: (serviceData: any) => void;
  loading: boolean;
}

export interface HoursEditModalProps {
  visible: boolean;
  hours: HoursOfOperation[];
  onClose: () => void;
  onSave: (hoursData: any[]) => void;
  loading: boolean;
}

export interface ProfileEditModalProps {
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (profileData: any) => void;
  loading: boolean;
}

export interface ShopImageEditModalProps {
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (imageData: any) => void;
  loading: boolean;
}

export interface AddressEditModalProps {
  visible: boolean;
  cleaner: DryCleaner | null;
  onClose: () => void;
  onSave: (addressData: any) => void;
  loading: boolean;
}

export interface CleanerDetailsModalProps {
  cleaner: DryCleaner | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (cleaner: DryCleaner) => void;
  onRefresh: () => void;
  currentUserId: string;
  onEditService: (service: any) => void;
  onEditHours: () => void;
  onEditProfile: () => void;
  onEditAddress: () => void;
  onEditShopImages: () => void;
}

export interface MerchantCleanerCardProps {
  cleaner: DryCleaner;
  onViewDetails: (cleaner: DryCleaner) => void;
  onEdit: (cleaner: DryCleaner) => void;
  onDelete: (cleaner: DryCleaner) => void;
  currentUserId: string;
}


