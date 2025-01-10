// LoginForm.tsx
import React, { useState } from "react";
import { Link as LinkTo, useNavigate } from "react-router-dom";
import { signInStart, signInChallenge } from "../../client/SignInService";
import { ErrorResponseType } from "../../client/ResponseTypes";

export const SignIn: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsloading] = useState<boolean>(false);

  const navigate = useNavigate();
  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError("Invalid email format");
      return;
    }
    setError("");
    setIsloading(true);
    try {
      const res1 = await signInStart({
        username: email,
      });
      const res2 = await signInChallenge({ continuation_token: res1.continuation_token });
      navigate("/signin/challenge", { state: res2 });
    } catch (err) {
      setError("An error occurred " + (err as ErrorResponseType).error_description);
    } finally {
      setIsloading(false);
    }
  };

  return (
    <div className="login-form">
      <form onSubmit={handleSubmit}>
        <h2>Login</h2>
        <div className="form-group">
          <label>Email:</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <div className="error">{error}</div>}
        {isLoading && <div className="warning">Sending request...</div>}
        <button type="submit" disabled={isLoading}>Next</button>
      </form>
    </div>
  );
};
