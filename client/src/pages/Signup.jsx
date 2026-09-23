import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function Signup({ onSwitchToLogin, onSignupSuccess }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || data.message || "Signup failed");
        return;
      }

      alert("Signup successful");
      if (onSignupSuccess) {
        onSignupSuccess(form.email);
      }
    } catch {
      alert("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl text-on-surface">
      <h2 className="mb-2 text-center text-2xl font-bold text-primary">Create Account</h2>
      <p className="mb-5 text-center text-sm text-on-surface-variant">Join as a user, NGO, or volunteer.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          name="name"
          value={form.name}
          placeholder="Full Name"
          onChange={handleChange}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 outline-none transition focus:border-primary"
        />

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

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 outline-none transition focus:border-primary"
        >
          <option value="user">User</option>
          <option value="ngo">NGO</option>
          <option value="volunteer">Volunteer</option>
        </select>

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-primary p-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating account..." : "Signup"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-primary hover:opacity-80"
        >
          Login
        </button>
      </p>
    </div>
  );
}

export default Signup;
