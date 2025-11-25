import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the state structure for the profile
interface ProfileState {
  profileImage: string | null;
  firstName: string | null; // <-- Add firstName
  lastName: string | null;  // <-- Add lastName
}

// Define the initial state
const initialState: ProfileState = {
  profileImage: null,
  firstName: null,
  lastName: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    /**
     * Sets the user's profile image URL in the state.
     */
    setProfileImage(state, action: PayloadAction<string | null>) {
      state.profileImage = action.payload;
    },
    /**
     * Sets the user's first and last name in the state.
     */
    setProfileName(state, action: PayloadAction<{ firstName: string; lastName: string }>) {
      state.firstName = action.payload.firstName;
      state.lastName = action.payload.lastName;
    },
    /**
     * Clears all profile data from the state (e.g., on logout).
     */
    clearProfile(state) {
      state.profileImage = null;
      state.firstName = null;
      state.lastName = null;
    },
  },
});

// Export the new action along with the existing ones
export const { setProfileImage, setProfileName, clearProfile } = profileSlice.actions;

export default profileSlice.reducer;
