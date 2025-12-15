import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import authReducer from "../components/redux/authSlice";
import profileReducer from "../components/redux/profileSlice";
import unsafeStopsReducer from "../components/redux/unsafeStopsSlice";
import userReducer from "../components/redux/userSlice";

const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
  console.log("🔴 Redux Action:", action.type);

  if (action.type.includes("user/")) {
    console.log("📊 Payload:", JSON.stringify(action.payload, null, 2));
    const orderBefore = store.getState().user?.order;
    console.log(
      "📦 Order BEFORE:",
      orderBefore
        ? {
            items: orderBefore.items?.length || 0,
            total: orderBefore.totalAmount,
          }
        : "null"
    );
  }

  const result = next(action);

  if (action.type.includes("user/")) {
    const orderAfter = store.getState().user?.order;
    console.log(
      "📦 Order AFTER:",
      orderAfter
        ? {
            items: orderAfter.items?.length || 0,
            total: orderAfter.totalAmount,
          }
        : "null"
    );
    console.log("---");
  }

  return result;
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    user: userReducer,
    unsafeStops: unsafeStopsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(loggerMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
