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
      //Redirect comes back as 200 so it has to be parsed here
      if (res1.challenge_type == "redirect") {
        const errorData = {
          error: "redirect",
          error_description: "Additional challenge types required - https://learn.microsoft.com/en-us/entra/external-id/customers/concept-native-authentication-web-fallback",
          codes: [],
          timestamp: "",
          trace_id: "",
          correlation_id: "",
        };
        throw errorData
      }
      const res2 = await signInChallenge({ continuation_token: res1.continuation_token });
      if (res2.challenge_type == "password") {
        const errorData = {
          error: "redirect",
          error_description: "You tried to signIn with a user that has registered with a password. This application only accepts username and code users",
          codes: [],
          timestamp: "",
          trace_id: "",
          correlation_id: "",
        };
        throw errorData
      }
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
