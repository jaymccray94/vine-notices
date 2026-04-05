import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertTriangle, Loader2, Leaf, Mail, ArrowLeft, CheckCircle } from "lucide-react";

type Step = "email" | "code";

export default function LoginPage() {
  const { requestMagicLink, verifyCode } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first code input when switching to code step
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestMagicLink(email);
      setCodeSent(true);
      setStep("code");
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(fullCode: string) {
    setError("");
    setLoading(true);
    try {
      await verifyCode(email, fullCode);
    } catch (err: any) {
      setError("Invalid or expired code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // digits only
    const newCode = [...code];
    
    // Handle paste of full code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || "";
      }
      setCode(newCode);
      const full = newCode.join("");
      if (full.length === 6) {
        handleVerifyCode(full);
      } else {
        inputRefs.current[digits.length]?.focus();
      }
      return;
    }

    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const full = newCode.join("");
    if (full.length === 6) {
      handleVerifyCode(full);
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleBack() {
    setStep("email");
    setCode(["", "", "", "", "", ""]);
    setError("");
    setCodeSent(false);
  }

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
          {step === "email" ? (
            <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" data-testid="text-login-error">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jay@vinemgt.com"
                  required
                  autoFocus
                  data-testid="input-email"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full mt-1" data-testid="button-send-code">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Login Code
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-1">
                We'll send a 6-digit code to your email
              </p>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Sent confirmation */}
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2.5 rounded-md">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Code sent to <span className="font-semibold">{email}</span></span>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" data-testid="text-code-error">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Code input */}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestCode as any}
                  disabled={loading}
                  className="text-xs text-muted-foreground"
                  data-testid="button-resend"
                >
                  Didn't get it? Resend code
                </Button>
                <button
                  onClick={handleBack}
                  className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
