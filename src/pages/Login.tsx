import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "judge">("judge");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (role === "admin" && pin !== "jury2048") { setError("Invalid admin PIN"); return; }
    login({ name: name.trim(), role });
    navigate(role === "admin" ? "/admin" : "/judge");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display tracking-tight">Jurybox</h1>
          <p className="text-muted-foreground mt-1 text-sm font-body">Application review, refined.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-body">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              className="w-full h-10 px-3 border border-border rounded-lg bg-card text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="Enter your name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-body">Role</label>
            <div className="flex gap-2">
              {(["judge", "admin"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setError(""); }}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium font-body transition-all ${
                    role === r
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {r === "admin" ? "Admin" : "Judge"}
                </button>
              ))}
            </div>
          </div>

          {role === "admin" && (
            <div className="animate-fade-in">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-body">Admin PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(""); }}
                className="w-full h-10 px-3 border border-border rounded-lg bg-card text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter PIN"
              />
            </div>
          )}

          {error && <p className="text-destructive text-xs font-body">{error}</p>}

          <button
            type="submit"
            className="w-full h-10 bg-foreground text-background rounded-lg text-sm font-medium font-body hover:bg-foreground/90 transition-colors mt-2"
          >
            Enter Jurybox →
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
