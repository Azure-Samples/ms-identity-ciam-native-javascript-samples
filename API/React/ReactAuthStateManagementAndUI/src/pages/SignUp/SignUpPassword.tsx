// src/pages/SubmitPassword.js
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Typography, TextField, Button, Alert, CircularProgress, LinearProgress } from "@mui/material";
import { AppDispatch, RootState } from "state/store";
import { CustomCard } from "../../components/CustomCard";
import { signUpSubmitPasswordAction } from "state/authState";

export const SignUpPassword = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, success, error } = useSelector((state: RootState) => state.authState);

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    dispatch(signUpSubmitPasswordAction({ password: data.get("password") })).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        navigate("/signup/success"); // Navigate to a success page after successful sign-up
      }
    });
  };

  return (
    <>
      <CustomCard variant="outlined">
        {loading && <LinearProgress />}

        {/* Back Arrow Button */}
        {/* <IconButton onClick={() => navigate(-1)} style={{ marginTop: "10px" }}>
              <ArrowBackIcon />
            </IconButton> */}

        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Sign in with password to complete the sign up
        </Typography>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "20px" }}>
            <CircularProgress />
            <Typography variant="h6" component="p" style={{ marginLeft: "10px" }}>
              Submitting Password...
            </Typography>
          </div>
        ) : (
          <>
            {success && (
              <Alert severity="success" style={{ marginTop: "20px" }}>
                Sign up successful!
              </Alert>
            )}
            {error && (
              <Alert severity="error" style={{ marginTop: "20px" }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <TextField
                label="Password"
                type="password"
                id="password"
                name="password"
                variant="outlined"
                fullWidth
                style={{ marginTop: "20px" }}
                required
              />
              <Button type="submit" variant="contained" color="primary" fullWidth style={{ marginTop: "20px" }} disabled={loading}>
                {loading ? "Submitting..." : "Submit Password"}
              </Button>
            </form>
          </>
        )}
      </CustomCard>
    </>
  );
};
