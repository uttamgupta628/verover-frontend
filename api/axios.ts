import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
// 'http://192.168.29.162:5000/api'
const axiosInstance = axios.create({
  baseURL: "http://192.168.29.162:5000/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const authState = await AsyncStorage.getItem("loginKey");
      if (authState) {
        const { token } = JSON.parse(authState);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error("Error reading token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("loginKey");
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
