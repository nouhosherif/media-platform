import { useState } from "react";
import Input from "../components/Input";
import API from "../api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const username = email.trim();
      const res = await API.post("/users/login/", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.access);
      localStorage.setItem("refreshToken", res.data.refresh);

      alert("Login successful");
      window.location.href = "/feed";

    } catch (err) {
      const details = err.response?.data;
      console.error(details || err);
      alert(`Login failed${formatError(details)}`);
    }
  };

  const formatError = (details) => {
    if (!details) {
      return "";
    }

    if (typeof details === "string") {
      return `: ${details}`;
    }

    const messages = Object.entries(details)
      .map(([field, value]) => {
        const message = Array.isArray(value) ? value.join(", ") : value;
        return `${field}: ${message}`;
      })
      .join("\n");

    return messages ? `:\n${messages}` : "";
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">

        <h1 className="text-2xl font-bold text-center mb-6">
          Welcome Back
        </h1>

        <form onSubmit={handleLogin}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>

        <p className="text-center text-sm mt-4">
          Don’t have an account?{" "}
          <a href="/signup" className="text-blue-600 font-semibold">
            Sign up
          </a>
        </p>

      </div>
    </div>
  );
};

export default Login;
