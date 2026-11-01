"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";

// ロール（権限）の定義
type Role = "admin" | "viewer";

interface AuthContextType {
  role: Role;
  isLoggedIn: boolean;
  login: () => void;   // ★追加: ログイン処理
  logout: () => void;  // ★追加: ログアウト処理
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType>({
  role: "viewer",
  isLoggedIn: false,
  login: () => { },
  logout: () => { },
  canEdit: false
});

const AUTH_CHANGE_EVENT = "app-auth-change";

const subscribeToAuth = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
};

const getAuthSnapshot = () => localStorage.getItem("app_logged_in") === "true";
const getServerAuthSnapshot = () => false;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);

  const login = () => {
    localStorage.setItem("app_logged_in", "true");
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  };

  const logout = () => {
    localStorage.removeItem("app_logged_in");
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  };

  // ログインしていれば admin、していなければ viewer
  const currentRole: Role = isLoggedIn ? "admin" : "viewer";

  return (
    <AuthContext.Provider value={{
      role: currentRole,
      isLoggedIn,
      login,
      logout,
      canEdit: currentRole === "admin"
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);