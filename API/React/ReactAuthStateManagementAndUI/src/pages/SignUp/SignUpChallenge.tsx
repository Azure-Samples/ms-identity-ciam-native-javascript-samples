// src/pages/SendOtp.js
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Typography, Button, Alert, Box, LinearProgress } from "@mui/material";
import TextField from "@mui/material/TextField";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import { signUpSubmitOtpAction } from "state/authState";
import { AppDispatch, RootState } from "state/store";
import { CustomCard } from "../../components/CustomCard";

export const SignUpChallenge = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [codeError, setCodeError] = React.useState(false);
  const [codeErrorMessage, setCodeErrorMessage] = React.useState("");
  const { loading, error, challenge_target_label } = useSelector((state: RootState) => state.authState);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    dispatch(signUpSubmitOtpAction({ oob: data.get("code") })).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        const challengeType = action.payload.challenge_type;
        if (challengeType === "password") {
          navigate("/signup/password");
        } else {
          navigate("/signup/completed");
        }
      }
    });
  };

  const validateInputs = () => {
    const code = document.getElementById("code") as HTMLInputElement;
    let isValid = true;
    if (!code.value || code.value.length < 1) {
      setCodeError(true);
      setCodeErrorMessage("One-time passcode is required.");
      isValid = false;
    } else {
      setCodeError(false);
      setCodeErrorMessage("");
    }
    return isValid;
  };

  return (
    <>
      {/* <IconButton onClick={() => navigate(-1)} style={{ marginTop: "10px" }}>
            <ArrowBackIcon />
          </IconButton> */}
      <CustomCard variant="outlined">
        {loading && <LinearProgress />}

        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Submit one-time code
        </Typography>
        <>
          <Alert severity="success" style={{ marginTop: "20px" }}>
            We sent a verification code to {challenge_target_label}. To verify the code please enter it below.
          </Alert>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl>
              <FormLabel htmlFor="name">One-time passcode</FormLabel>
              <TextField
                disabled={loading}
                autoComplete="code"
                name="code"
                required
                fullWidth
                id="code"
                placeholder="123456"
                error={codeError}
                helperText={codeErrorMessage}
                color={codeError ? "error" : "primary"}
              />
            </FormControl>
            {error && (
              <Alert severity="error" style={{ marginTop: "20px" }}>
                {" "}
                {error}{" "}
              </Alert>
            )}
            <Button type="submit" fullWidth variant="contained" onClick={validateInputs} disabled={loading}>
              Verify
            </Button>
          </Box>
        </>
      </CustomCard>
    </>
  );
};
