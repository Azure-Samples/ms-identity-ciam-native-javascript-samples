import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signUpSubmitOTP } from "../../sdk/SignUpService";

export const SignUpChallenge: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { challenge_target_label, challenge_type, continuation_token, code_length } = state;

  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code) {
      setError("All fields are required");
      return;
    }

    setError("");
    try {
      const res = await signUpSubmitOTP({ continuation_token, oob: code });
      navigate("/signup/completed");
    } catch (err) {
      setError("An error occurred during sign up");
    }
  };

  return (
    <div className="sign-up-form">
      <form onSubmit={handleSubmit}>
        <h2>Insert your one time code received at {challenge_target_label}</h2>
        <div className="form-group">
          <label>Code:</label>
          <input maxLength={code_length} type="text" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>

        {error && <div className="error">{error}</div>}
        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
};