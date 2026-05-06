import { useState } from "react";
import Input from "../components/Input";
import API from "../api";

const Signup = () => {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const email = form.email.trim();
      const res = await API.post("/users/register/", {
        username: email,
        email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
      });

      console.log(res.data); // ✅ FIXED

      const loginRes = await API.post("/users/login/", {
        username: email,
        password: form.password,
      });

      localStorage.setItem("token", loginRes.data.access);
      localStorage.setItem("refreshToken", loginRes.data.refresh);

      alert("Account created successfully");
      window.location.href = "/feed";

    } catch (err) {
      const details = err.response?.data;
      console.error(details || err);
      alert(`Signup failed${formatError(details)}`);
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
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-lg">

        <h1 className="text-2xl font-bold text-center mb-6">
          Sign up to create account
        </h1>

        <form onSubmit={handleSignup}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="first_name" onChange={handleChange} />
            <Input label="Last Name" name="last_name" onChange={handleChange} />
          </div>

          <Input label="Email" name="email" type="email" onChange={handleChange} />

          <Input label="Create Password" name="password" type="password" onChange={handleChange} />
          <Input label="Confirm Password" name="confirmPassword" type="password" onChange={handleChange} />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition mt-2"
          >
            Sign Up
          </button>
        </form>

        <p className="text-center text-sm mt-4">
          Already have an account?{" "}
          <a href="/" className="text-blue-600 font-semibold">
            Login
          </a>
        </p>

      </div>
    </div>
  );
};

export default Signup;
