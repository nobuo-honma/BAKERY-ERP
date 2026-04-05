"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // 画面を開いた時、前回ログインしたままかチェックする
  useEffect(() => {
    const saved = localStorage.getItem("app_logged_in");
    if (saved === "true") {
      setIsLoggedIn(true);
    }
  }, []);

  // ログイン成功時の処理
  const login = () => {
    setIsLoggedIn(true);
    localStorage.setItem("app_logged_in", "true");
  };

  // ログアウト時の処理
  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("app_logged_in");
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