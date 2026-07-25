"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthMode } from "@/types/auth";
import { IntroSlides } from "@/components/auth/IntroSlides";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { AuthForm } from "@/components/auth/AuthForm";

// Steps:
//  "slides" — intro slides (unauthenticated, first visit)
//  "auth"   — sign-up / sign-in form

type Step = "slides" | "auth";

function SignUpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("slides");
  const [authMode, setAuthMode] = useState<AuthMode>(
    params.get("mode") === "signin" ? "signin" : "signup",
  );

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Already signed in (e.g. OAuth callback) — go straight to the app,
      // unless the email still needs verifying.
      router.replace(user.email_confirmed_at ? "/dashboard" : "/auth/verify");
    };

    checkAuth();
  }, [router]);

  const handleAuth = (redirect?: string) => {
    router.push(redirect ?? "/auth/verify");
  };

  if (loading) return null;

  // Intro slides — full-screen, no modal wrapper
  if (step === "slides") {
    return (
      <IntroSlides
        onGetStarted={() => { setAuthMode("signup"); setStep("auth"); }}
        onSignIn={() => { setAuthMode("signin"); setStep("auth"); }}
      />
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card auth-card-auth">
        <div className="auth-brand-panel">
          <BrandPanel />
        </div>

        <div className="auth-form-scroll">
          <AuthForm mode={authMode} setMode={setAuthMode} onAuth={handleAuth} />
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
