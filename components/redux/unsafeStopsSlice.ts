import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UnsafeStop {
  id: number;
  title: string;
  description: string;
  time: string;
}

interface UnsafeStopsState {
  unsafeStops: UnsafeStop[];
}

const initialState: UnsafeStopsState = {
  unsafeStops: [
    {
      id: 1,
      title: "Joshua Terminal, NY",
      description:
        "Thieves & Goons\nConstruction Work in Progress\nInsufficient Cleaning",
      time: "30 mins in Bus",
    },
    {
      id: 2,
      title: "Joshua Terminal, NY",
      description:
        "Thieves & Goons\nConstruction Work in Progress\nInsufficient Cleaning",
      time: "30 mins in Bus",
    },
  ],
};

const unsafeStopsSlice = createSlice({
  name: "unsafeStops",
  initialState,
  reducers: {
    addUnsafeStop: (state, action: PayloadAction<UnsafeStop>) => {
      state.unsafeStops.push(action.payload);
    },
  },
});

export const { addUnsafeStop } = unsafeStopsSlice.actions;
export default unsafeStopsSlice.reducer;
