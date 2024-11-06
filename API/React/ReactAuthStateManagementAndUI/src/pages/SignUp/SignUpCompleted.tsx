// src/pages/SubmitPassword.js
import React from "react";
import { Typography, Alert } from "@mui/material";
import { CustomCard } from "../../components/CustomCard";
import { Link as LinkTo } from "react-router-dom";

export const SignUpCompleted = () => {
  return (
    <>
      <CustomCard variant="outlined">
        {/* Back Arrow Button */}
        {/* <IconButton onClick={() => navigate(-1)} style={{ marginTop: "10px" }}>
              <ArrowBackIcon />
            </IconButton> */}

        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Sign up completed
        </Typography>

        <>
          <Alert severity="success" style={{ marginTop: "20px" }}>
            Sign up successful!
          </Alert>

          <Typography sx={{ textAlign: "center" }}>
            Continue to
            <span>
              <LinkTo to="/signin">Sign in</LinkTo>
            </span>
          </Typography>
        </>
      </CustomCard>
    </>
  );
};
