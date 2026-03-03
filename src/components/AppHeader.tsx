import { useApp } from "@/contexts/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";

const AppHeader = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(user.role === "admin" ? "/admin" : "/judge")} className="font-display text-lg tracking-tight hover:opacity-70 transition-opacity text-primary">
          Jurybox
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs font-body text-muted-foreground hidden sm:inline">
          {user.name}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium font-body uppercase">{user.role}</span>
        {user.isInternal && <span className="text-[10px] px-1.5 py-0.5 bg-accent text-muted-foreground rounded font-medium font-body hidden sm:inline">Internal</span>}
        <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
