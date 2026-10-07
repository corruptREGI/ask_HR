import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { HrChat } from "@/components/hr-chat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AskHR | Sign In" },
      {
        name: "description",
        content: "Secure access to your company HR assistant.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("hr-auth-token")));
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setMessage("Signing you in...");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Invalid email or password.");
        return;
      }

      localStorage.setItem("hr-auth-token", data.token);
      setIsLoggedIn(true);
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect to the server.");
    }
  }

  if (isLoggedIn) {
    return (
      <main className="surface-hero min-h-[100dvh]">
        <HrChat />
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="flex min-h-[100dvh] flex-col lg:flex-row">

        {/* LEFT — BRANDING */}
        <section className="flex min-h-[38vh] flex-1 items-center bg-[#eaf8f2] px-8 py-12 sm:px-14 lg:min-h-[100dvh] lg:px-20">
          <div className="mx-auto w-full max-w-xl">

            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#238b63] text-sm font-bold text-white">
                HR
              </div>

              <span className="text-lg font-semibold tracking-tight text-[#17352a]">
                AskHR
              </span>
            </div>

            <div className="max-w-lg">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#43866b]">
                Your digital HR assistant
              </p>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[#17352a] sm:text-5xl lg:text-6xl">
                HR answers,
                <br />
                made simple.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-[#5f7d70]">
                Ask questions about company policies, leave and HR
                processes — and get clear answers in seconds.
              </p>
            </div>

            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#527567]">
              <span>✓ Policy guidance</span>
              <span>✓ Instant answers</span>
              <span>✓ Secure access</span>
            </div>
          </div>
        </section>

        {/* RIGHT — LOGIN */}
        <section className="flex flex-1 items-center justify-center bg-white px-8 py-14 sm:px-14 lg:px-20">
          <div className="w-full max-w-md">

            <div className="mb-10">
              <h2 className="text-3xl font-semibold tracking-tight text-[#17352a]">
                Sign in
              </h2>

              <p className="mt-2 text-sm text-[#789087]">
                Sign in with your company account to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#29483c]"
                >
                  Work email
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-[#d6e5df] bg-white px-4 py-3.5 text-sm text-[#17352a] outline-none transition focus:border-[#55a982] focus:ring-2 focus:ring-[#d8f2e5]"
                  required
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#29483c]"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-[#d6e5df] bg-white px-4 py-3.5 text-sm text-[#17352a] outline-none transition focus:border-[#55a982] focus:ring-2 focus:ring-[#d8f2e5]"
                  required
                />
              </div>

              {/* MESSAGE */}
              {message && (
                <p className="text-sm text-red-600">
                  {message}
                </p>
              )}

              {/* BUTTON */}
              <button
                type="submit"
                className="w-full rounded-lg bg-[#238b63] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1d7955] active:scale-[0.99]"
              >
                Continue
                <span className="ml-2">→</span>
              </button>
            </form>

            <div className="mt-8 border-t border-[#edf2ef] pt-6">
              <p className="text-center text-xs text-[#8a9b94]">
                Your HR information stays protected.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}