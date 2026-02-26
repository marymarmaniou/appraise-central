import { useApp } from "@/contexts/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";

const AppHeader = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <button onClick={() => navigate(user.role === "admin" ? "/admin" : "/judge")} className="font-display text-lg tracking-tight hover:opacity-70 transition-opacity">
          Jurybox
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-body text-muted-foreground">
          {user.name}
          <span className="ml-1.5 px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium uppercase">{user.role}</span>
        </span>
        <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
