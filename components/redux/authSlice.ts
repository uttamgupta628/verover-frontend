import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AxiosError } from "axios";
import axiosInstance from "../../api/axios";
import { setProfileImage, setProfileName } from "./profileSlice"; // ⭐ ADD THIS IMPORT
import { AppDispatch, RootState } from "./store";

// ✅ Define Personal Information Interface
interface PersonalInfoData {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phoneNumber: string;
  country?: string;
  state?: string;
  zipCode?: string;
  userType: string;
  token?: string;
  stripeCustomerId?: string;
  profileImage?: string; // ⭐ ADD THIS
}

// ✅ Define Authentication State
interface AuthState {
  isAuthenticated: boolean;
  user: PersonalInfoData | null;
  loading: boolean;
  error: string | null;
  token: string | null | undefined;
}

// ✅ Initial Authentication State
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  token: null,
};

// ✅ Create Authentication Slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    registerStart(state, action: PayloadAction<PersonalInfoData>) {
      state.user = action.payload;
      state.loading = false;
      state.token = action.payload.token;
      state.isAuthenticated = false;
      state.error = null;
      saveAuthAtCache(state);
    },
    verifySuccess(state) {
      state.isAuthenticated = true;
      state.error = null;
      state.loading = false;
      saveAuthAtCache(state);
    },
    loginSuccess(state, action: PayloadAction<PersonalInfoData>) {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
      state.error = null;
      state.token = action.payload.token;
      saveAuthAtCache(state);
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      saveAuthAtCache(state);
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
      state.error = null;
      state.token = null;
      saveAuthAtCache(state);
    },
    resetFromState(state, action: PayloadAction<AuthState>) {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = action.payload.loading;
      state.error = action.payload.error;
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  registerStart,
  verifySuccess,
  resetFromState,
} = authSlice.actions;

// ✅ Simple Logout Thunk
export const logoutUser = () => {
  return async (dispatch: AppDispatch) => {
    try {
      await AsyncStorage.removeItem("loginKey");
      dispatch(logout());
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout Error:", error);
      dispatch(logout());
    }
  };
};

// ✅ Thunk for Login with Email/Password
export const loginWithEmailPassword = (
  email: string,
  password: string,
  userType: "user" | "merchant" | "driver"
) => {
  return async (dispatch: AppDispatch) => {
    dispatch(loginStart());
    try {
      console.log("Login with Email/Password");
      const response = await axiosInstance.post("/users/login", {
        email,
        password,
        userType,
      });

      console.log("Response:", response.data);

      const userData = {
        ...response.data.user,
        token: response.data.token,
      };

      dispatch(loginSuccess(userData));

      // ⭐ SYNC PROFILE DATA TO PROFILE SLICE
      if (userData.firstName || userData.lastName) {
        dispatch(
          setProfileName({
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
          })
        );
      }

      if (userData.profileImage) {
        dispatch(setProfileImage(userData.profileImage));
      }

      return response;
    } catch (error: unknown) {
      console.log("Login Error:", error);
      if (error instanceof AxiosError) {
        console.log(error.response?.data);
        dispatch(
          loginFailure(
            error.response?.data?.message ||
              error.response?.data ||
              "Login failed"
          )
        );
        throw error;
      } else if (error instanceof Error) {
        dispatch(loginFailure(error.message));
        throw error;
      } else {
        dispatch(loginFailure("An unknown error occurred."));
        throw new Error("An unknown error occurred.");
      }
    }
  };
};

// ✅ Thunk for User Registration
export const registerWithEmailPassword = (userData: PersonalInfoData) => {
  return async (dispatch: AppDispatch) => {
    console.log("Registering User");
    dispatch(loginStart());

    try {
      console.log("Sending Data to:", "/users/register");
      const response = await axiosInstance.post("/users/register", userData);

      console.log("Registration successful:", response.data);

      // Store the registration data in Redux
      dispatch(
        registerStart({
          _id: response.data.user?._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          country: userData.country,
          state: userData.state,
          zipCode: userData.zipCode,
          userType: userData.userType,
          token: response.data.token,
          stripeCustomerId: response.data.user?.stripeCustomerId,
        })
      );

      // ⭐ SYNC PROFILE DATA FOR REGISTRATION TOO
      dispatch(
        setProfileName({
          firstName: userData.firstName,
          lastName: userData.lastName,
        })
      );

      return response;
    } catch (error: unknown) {
      console.error("Registration Error:", error);

      if (error instanceof AxiosError) {
        console.log("Error Response:", error.response?.data);
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data ||
          "Registration failed";
        dispatch(loginFailure(errorMessage));
        throw error;
      } else if (error instanceof Error) {
        dispatch(loginFailure(error.message));
        throw error;
      } else {
        dispatch(loginFailure("An unknown error occurred."));
        throw new Error("An unknown error occurred.");
      }
    }
  };
};

// ✅ Verify OTP
export const verifyOTP = (otp: string, token: string) => {
  return async (dispatch: AppDispatch) => {
    try {
      console.log("Verifying OTP with token:", token);

      const response = await axiosInstance.post(
        "/users/verify-otp",
        { otp },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("OTP Verification Response:", response.data);

      // Mark user as verified
      dispatch(verifySuccess());

      return response;
    } catch (error) {
      console.error("OTP Verification Error:", error);

      if (error instanceof AxiosError) {
        console.log("Error Response:", error.response?.data);
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data ||
          "OTP verification failed";
        throw new Error(errorMessage);
      }
      throw error;
    }
  };
};

// ✅ Initialize Authentication from AsyncStorage
export const initAuthFromStorage = () => {
  return async (dispatch: AppDispatch) => {
    try {
      const authState = await getAuthFromAsyncStorage();

      if (authState.isAuthenticated && authState.token) {
        try {
          const response = await axiosInstance.get("/users/verify-token", {
            headers: {
              Authorization: `Bearer ${authState.token}`,
            },
          });

          if (response.data.valid) {
            dispatch(resetFromState(authState));

            // ⭐ SYNC PROFILE DATA FROM STORAGE
            if (authState.user?.firstName || authState.user?.lastName) {
              dispatch(
                setProfileName({
                  firstName: authState.user.firstName || "",
                  lastName: authState.user.lastName || "",
                })
              );
            }

            if (authState.user?.profileImage) {
              dispatch(setProfileImage(authState.user.profileImage));
            }
          } else {
            dispatch(logout());
          }
        } catch (tokenError) {
          console.log("Token verification failed:", tokenError);
          dispatch(logout());
        }
      } else {
        dispatch(logout());
      }
    } catch (error) {
      console.error("Error initializing auth from storage:", error);
      dispatch(logout());
    }
  };
};

// ✅ Check Auth Status
export const checkAuthStatus = () => {
  return async (dispatch: AppDispatch) => {
    const authState = await getAuthFromAsyncStorage();

    if (authState.isAuthenticated && authState.token && authState.user) {
      dispatch(resetFromState(authState));

      // ⭐ SYNC PROFILE DATA
      if (authState.user.firstName || authState.user.lastName) {
        dispatch(
          setProfileName({
            firstName: authState.user.firstName || "",
            lastName: authState.user.lastName || "",
          })
        );
      }

      if (authState.user.profileImage) {
        dispatch(setProfileImage(authState.user.profileImage));
      }
    } else {
      dispatch(logout());
    }
  };
};

// ✅ Refresh Token
export const refreshAuthToken = () => {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    try {
      const currentToken = getState().auth.token;

      if (!currentToken) {
        dispatch(logout());
        return;
      }

      const response = await axiosInstance.post(
        "/users/refresh-token",
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (response.data.token) {
        const currentUser = getState().auth.user;
        if (currentUser) {
          dispatch(
            loginSuccess({
              ...currentUser,
              token: response.data.token,
            })
          );
        }
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      dispatch(logout());
    }
  };
};

// ✅ AsyncStorage Helper Functions
const LOGIN_STATE_KEY = "loginKey";

export async function getAuthFromAsyncStorage(): Promise<AuthState> {
  try {
    const val = await AsyncStorage.getItem(LOGIN_STATE_KEY);
    if (val === null || val === "") {
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      };
    }

    const res = JSON.parse(val);
    return {
      isAuthenticated: res?.isAuthenticated || false,
      user: res.user || null,
      token: res.token || null,
      loading: false,
      error: null,
    };
  } catch (error) {
    console.error("Error reading auth from AsyncStorage:", error);
    return {
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
    };
  }
}

function saveAuthAtCache(state: Readonly<AuthState>) {
  AsyncStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(state))
    .then(() => {
      console.log("Auth state saved successfully");
    })
    .catch((err) => {
      console.error("Can't save auth state:", err);
    });
}

export default authSlice.reducer;
