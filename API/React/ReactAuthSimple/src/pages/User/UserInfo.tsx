// User.tsx
import React from "react";
import { useLocation } from "react-router-dom";
import { parseJwt } from "../../client/Utils";

export const UserInfo: React.FC = () => {
  const { state } = useLocation();
  const decodedToken = parseJwt(state.access_token);
  const { given_name, scp, family_name, email: email } = decodedToken;

  console.log(decodedToken);
  const familyName = family_name;
  const givenName = given_name;
  const tokenExpireTime = state.expires_in;
  const scopes = state.scope;

  return (
    <div className="user-info">
      <h2>User Information</h2>
      <div className="info-group">
        <label>Given Name:</label>
        <span>{givenName}</span>
      </div>
      <div className="info-group">
        <label>Family Name:</label>
        <span>{familyName}</span>
      </div>
      <div className="info-group">
        <label>Email:</label>
        <span>{email}</span>
      </div>
      <div className="info-group">
        <label>Token Expire Time:</label>
        <span>{tokenExpireTime}</span>
      </div>
      <div className="info-group">
        <label>Scopes:</label>
        <span>{scopes}</span>
      </div>
      <div className="info-group">
        <label>Token payload:</label>
        <span><pre>{JSON.stringify(decodedToken, null, 2)}</pre></span>
      </div>
    </div>
  );
};
