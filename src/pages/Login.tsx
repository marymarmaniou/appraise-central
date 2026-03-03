import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "judge">("judge");
  const [pin, setPin] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState("");
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (role === "admin" && pin !== "jury2048") { setError("Invalid admin PIN"); return; }
    login({ name: name.trim(), role, ...(role === "judge" ? { isInternal } : { isInternal: true }) });
    navigate(role === "admin" ? "/admin" : "/judge");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
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
              className="w-full h-12 px-3 border border-border rounded-lg bg-card text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
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
                  className={`flex-1 h-12 rounded-lg border text-sm font-medium font-body transition-all ${
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {r === "admin" ? "Admin" : "Judge"}
                </button>
              ))}
            </div>
          </div>

          {role === "judge" && (
            <div className="animate-fade-in">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={e => setIsInternal(e.target.checked)}
                  className="w-5 h-5 rounded border-border accent-primary"
                />
                <span className="text-sm font-body text-foreground">Internal Judge</span>
              </label>
              <p className="text-[10px] text-muted-foreground font-body mt-1 ml-7">
                Internal judges can view all scores and averages.
              </p>
            </div>
          )}

          {role === "admin" && (
            <div className="animate-fade-in">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-body">Admin PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(""); }}
                className="w-full h-12 px-3 border border-border rounded-lg bg-card text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter PIN"
              />
            </div>
          )}

          {error && <p className="text-destructive text-xs font-body">{error}</p>}

          <button
            type="submit"
            className="w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:bg-primary/90 transition-colors mt-2"
          >
            Enter Jurybox →
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
