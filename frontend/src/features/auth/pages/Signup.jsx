import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Input from "../../../components/ui/Input";
import { getRequestErrorMessage } from "../../../utils/apiError";
import { register } from "../services/authApi.js";

const firstError = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" ");
  }

  return typeof value === "string" ? value : "";
};

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSubmissionError("");
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    const email = form.email.trim();
    const password = form.password;
    const nextErrors = {};

    if (!email) {
      nextErrors.email = "Enter your email address.";
    }

    if (!password) {
      nextErrors.password = "Enter a password.";
    } else if (password.length < 8 || /^\d+$/.test(password)) {
      nextErrors.password =
        "Use at least 8 characters and do not use only numbers.";
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0 || isSubmitting) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmissionError("");

    try {
      await register({
        email,
        password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });

      navigate("/feed", { replace: true });
    } catch (err) {
      const details = err.response?.data;
      const fieldErrors = {
        email: firstError(details?.email || details?.username),
        password: firstError(details?.password),
      };
      const hasFieldError = Object.values(fieldErrors).some(Boolean);

      setErrors(fieldErrors);
      setSubmissionError(
        hasFieldError
          ? ""
          : getRequestErrorMessage(
              err,
              "Account creation failed. Please try again.",
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-app items-center border-x border-line bg-panel px-5 py-10 sm:px-10">
        <section
          aria-labelledby="signup-heading"
          className="mx-auto w-full max-w-lg"
        >
          <header className="mb-8 text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-xl font-black text-white shadow-card">
              M
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Media
            </p>
            <h1
              className="text-3xl font-black tracking-[-0.035em] sm:text-4xl"
              id="signup-heading"
            >
              Create your account
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Join the conversation and share what matters to you.
            </p>
          </header>

          <form
            className="rounded-card border border-line bg-white p-5 shadow-card sm:p-7"
            noValidate
            onSubmit={handleSignup}
          >
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Input
                autoComplete="given-name"
                label="First name"
                name="first_name"
                onChange={handleChange}
                value={form.first_name}
              />
              <Input
                autoComplete="family-name"
                label="Last name"
                name="last_name"
                onChange={handleChange}
                value={form.last_name}
              />
            </div>

            <Input
              autoComplete="email"
              error={errors.email}
              label="Email"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={form.email}
            />
            <Input
              autoComplete="new-password"
              error={errors.password}
              label="Create password"
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={form.password}
            />
            <Input
              autoComplete="new-password"
              error={errors.confirmPassword}
              label="Confirm password"
              name="confirmPassword"
              onChange={handleChange}
              required
              type="password"
              value={form.confirmPassword}
            />

            {submissionError && (
              <p
                className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {submissionError}
              </p>
            )}

            <button
              className="mt-1 h-12 w-full rounded-control bg-ink px-5 font-bold text-white transition hover:bg-charcoal focus:outline-none focus:ring-4 focus:ring-slate-950/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              className="font-bold text-ink underline decoration-slate-300 underline-offset-4 transition hover:decoration-ink"
              to="/"
            >
              Log in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Signup;
