import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signInTokenRequest } from "../../client/SignInService";
import { ErrorResponseType } from "../../client/ResponseTypes";

export const SingInChallenge: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { challenge_target_label, challenge_type, continuation_token, code_length } = state;

  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsloading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code) {
      setError("All fields are required");
      return;
    }

    setIsloading(true);
    setError("");
    try {
      const res3 = await signInTokenRequest({
        continuation_token,
        grant_type: "oob",
        oob: code,
      });
      navigate("/user", { state: res3 });
    } catch (err) {
      setError("An error occurred during sign up " + (err as ErrorResponseType).error_description);
    } finally {
      setIsloading(false);
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
        {isLoading && <div className="warning">Sending request...</div>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
};
