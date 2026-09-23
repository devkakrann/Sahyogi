import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function Login({ onSwitchToSignup, onLoginSuccess, initialEmail = "" }) {
  const [form, setForm] = useState({
    email: initialEmail,
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, email: initialEmail }));
  }, [initialEmail]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.user) {
        alert(data.error || data.message || "Login failed");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      alert("Login successful");

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch {
      alert("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl text-on-surface">
      <h2 className="mb-2 text-center text-2xl font-bold text-primary">Login</h2>
      <p className="mb-5 text-center text-sm text-on-surface-variant">Sign in to access your role-based panel.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          name="email"
          value={form.email}
          placeholder="Email"
          onChange={handleChange}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 outline-none transition focus:border-primary"
        />

        <input
          type="password"
          name="password"
          value={form.password}
          placeholder="Password"
          onChange={handleChange}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 outline-none transition focus:border-primary"
        />

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-primary p-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-semibold text-primary hover:opacity-80"
        >
          Signup
        </button>
      </p>
    </div>
  );
}

export default Login;
