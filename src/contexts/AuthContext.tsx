"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

// ロール（権限）の定義
type Role = "admin" | "viewer"; 

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  canEdit: boolean; // 編集可能かどうか (adminならtrue)
}

const AuthContext = createContext<AuthContextType>({ 
  role: "admin", 
  setRole: () => {}, 
  canEdit: true 
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<Role>("admin"); // デフォルトは管理者

  // ブラウザを閉じても前回の権限を記憶しておく処理
  useEffect(() => {
    const saved = localStorage.getItem("app_role") as Role;
    if (saved) setRole(saved);
  },[]);

  const handleSetRole = (newRole: Role) => {
    setRole(newRole);
    localStorage.setItem("app_role", newRole);
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, canEdit: role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);