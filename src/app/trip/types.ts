export type ItineraryItem = {
  id: string;
  type: "poi" | "restaurant";
  name: string;
  address: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  rating?: number | null;
  priceLevel?: string | null;
};

export type DayPlan = {
  dayNumber: number;
  items: ItineraryItem[];
};

export type TripItinerary = {
  days: DayPlan[];
};
