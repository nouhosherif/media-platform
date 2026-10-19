import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Input from "../../../components/ui/Input";
import { getRequestErrorMessage } from "../../../utils/apiError";
import { login } from "../services/authApi.js";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    const username = email.trim();
    const nextErrors = {};

    if (!username) {
      nextErrors.username = "Enter your email or username.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    if (Object.keys(nextErrors).length > 0 || isSubmitting) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setAuthError("");

    try {
      await login({ username, password });
      navigate("/feed", { replace: true });
    } catch (err) {
      setAuthError(
        err.response?.status === 401
          ? "Incorrect email, username, or password."
          : getRequestErrorMessage(err, "Login failed. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-app items-center border-x border-line bg-panel px-5 py-10 sm:px-10">
        <section
          aria-labelledby="login-heading"
          className="mx-auto w-full max-w-md"
        >
          <header className="mb-9 text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-xl font-black text-white shadow-card">
              M
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Media
            </p>
            <h1
              className="text-3xl font-black tracking-[-0.035em] sm:text-4xl"
              id="login-heading"
            >
              Welcome back
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Sign in to continue to your account.
            </p>
          </header>

          <form
            className="rounded-card border border-line bg-white p-5 shadow-card sm:p-7"
            noValidate
            onSubmit={handleLogin}
          >
            <Input
              autoComplete="username"
              autoFocus
              error={errors.username}
              label="Email or username"
              name="username"
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, username: "" }));
                setAuthError("");
              }}
              type="text"
              value={email}
            />

            <Input
              autoComplete="current-password"
              error={errors.password}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
                setAuthError("");
              }}
              type="password"
              value={password}
            />

            {authError && (
              <p
                className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {authError}
              </p>
            )}

            <button
              className="mt-1 h-12 w-full rounded-control bg-ink px-5 font-bold text-white transition hover:bg-charcoal focus:outline-none focus:ring-4 focus:ring-slate-950/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Don’t have an account?{" "}
            <Link
              className="font-bold text-ink underline decoration-slate-300 underline-offset-4 transition hover:decoration-ink"
              to="/signup"
            >
              Sign up
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Login;
