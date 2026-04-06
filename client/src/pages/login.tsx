import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Loader2, Leaf, Mail, ArrowLeft, CheckCircle, Lock, Eye, EyeOff } from "lucide-react";

type MagicStep = "email" | "code";

export default function LoginPage() {
  const { requestMagicLink, verifyCode, loginWithGoogle, loginWithPassword, authConfig, restoring } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("magic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Magic link state
  const [magicStep, setMagicStep] = useState<MagicStep>("email");
  const [magicEmail, setMagicEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password state
  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Auto-select tab based on config
  useEffect(() => {
    if (authConfig?.ssoEnabled) {
      setActiveTab("google");
    } else if (authConfig?.allowPasswordAuth) {
      setActiveTab("password");
    }
  }, [authConfig]);

  // Focus first code input when switching to code step
  useEffect(() => {
    if (magicStep === "code") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [magicStep]);

  // Load Google Identity Services script
  useEffect(() => {
    if (!authConfig?.googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [authConfig?.googleClientId]);

  // Initialize Google button when tab is selected
  const googleBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeTab !== "google" || !authConfig?.googleClientId || !googleBtnRef.current) return;
    const timer = setTimeout(() => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: authConfig.googleClientId,
          callback: handleGoogleCallback,
        });
        g.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "signin_with",
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, authConfig?.googleClientId]);

  const handleGoogleCallback = useCallback(async (response: any) => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle(response.credential);
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithPassword(pwEmail, password);
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await requestMagicLink(magicEmail);
      if (result.demoCode) setDemoCode(result.demoCode);
      setMagicStep("code");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(fullCode: string) {
    setError("");
    setLoading(true);
    try {
      await verifyCode(magicEmail, fullCode);
    } catch {
      setError("Invalid or expired code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      for (let i = 0; i < 6; i++) newCode[i] = digits[i] || "";
      setCode(newCode);
      const full = newCode.join("");
      if (full.length === 6) handleVerifyCode(full);
      else inputRefs.current[digits.length]?.focus();
      return;
    }
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    const full = newCode.join("");
    if (full.length === 6) handleVerifyCode(full);
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B3E1E] via-[#1B293E] to-[#1B3E1E]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  const hasGoogle = !!authConfig?.googleClientId;
  const hasPassword = authConfig?.allowPasswordAuth !== false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B3E1E] via-[#1B293E] to-[#1B3E1E] px-4">
      <Card className="w-full max-w-sm border-0 shadow-2xl" data-testid="login-card">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-login-title">
            VineAdmin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            HOA Management Portal
          </p>
        </CardHeader>
        <CardContent className="pb-8">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-4" data-testid="text-login-error">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(""); }}>
            <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${[hasGoogle, hasPassword, true].filter(Boolean).length}, 1fr)` }}>
              {hasGoogle && <TabsTrigger value="google" className="text-xs">Google</TabsTrigger>}
              {hasPassword && <TabsTrigger value="password" className="text-xs">Password</TabsTrigger>}
              <TabsTrigger value="magic" className="text-xs">Magic Link</TabsTrigger>
            </TabsList>

            {/* Google Sign-In */}
            {hasGoogle && (
              <TabsContent value="google">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div ref={googleBtnRef} className="min-h-[44px]" />
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Sign in with your Google account
                  </p>
                </div>
              </TabsContent>
            )}

            {/* Password Login */}
            {hasPassword && (
              <TabsContent value="password">
                <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pw-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="pw-email"
                      type="email"
                      value={pwEmail}
                      onChange={(e) => setPwEmail(e.target.value)}
                      placeholder="jay@vinemgt.com"
                      required
                      autoFocus={activeTab === "password"}
                      data-testid="input-pw-email"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pw-password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="pw-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="pr-10"
                        data-testid="input-pw-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full mt-1" data-testid="button-pw-login">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" />Sign In</>}
                  </Button>
                </form>
              </TabsContent>
            )}

            {/* Magic Link */}
            <TabsContent value="magic">
              {magicStep === "email" ? (
                <form onSubmit={handleRequestCode} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="magic-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      placeholder="jay@vinemgt.com"
                      required
                      autoFocus={activeTab === "magic"}
                      data-testid="input-email"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full mt-1" data-testid="button-send-code">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" />Send Login Code</>}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    We'll send a 6-digit code to your email
                  </p>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2.5 rounded-md">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Code sent to <span className="font-semibold">{magicEmail}</span></span>
                  </div>

                  {demoCode && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2.5 text-center" data-testid="demo-code-display">
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-1">Demo Mode — Your code:</p>
                      <p className="text-2xl font-mono font-bold tracking-[0.3em] text-amber-700 dark:text-amber-300">{demoCode}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-center">Enter your 6-digit code</Label>
                    <div className="flex gap-2 justify-center mt-1">
                      {code.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { inputRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleCodeInput(i, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(i, e)}
                          onPaste={(e) => {
                            e.preventDefault();
                            const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                            if (paste) handleCodeInput(0, paste);
                          }}
                          className="w-11 h-12 text-center text-lg font-mono font-bold border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          data-testid={`input-code-${i}`}
                        />
                      ))}
                    </div>
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-1">
                    <Button variant="ghost" size="sm" onClick={() => handleRequestCode()} disabled={loading} className="text-xs text-muted-foreground">
                      Didn't get it? Resend code
                    </Button>
                    <button
                      onClick={() => { setMagicStep("email"); setCode(["", "", "", "", "", ""]); setError(""); setDemoCode(null); }}
                      className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Use a different email
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
