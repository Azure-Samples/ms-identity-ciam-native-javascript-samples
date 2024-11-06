import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { Link as LinkTo, useNavigate } from "react-router-dom";
import ForgotPassword from "../../components/ForgotPassword";
import { SitemarkIcon } from "../../components/CustomIcons";
import { CustomCard } from "../../components/CustomCard";
import { AppDispatch, RootState } from "state/store";
import {  signInTokenAction } from "state/authState";
import { Alert, LinearProgress } from "@mui/material";

export function SignInPassword(props: { disableCustomTheme?: boolean }) {
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.authState);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    dispatch(
      signInTokenAction({
        password: data.get("password") as string,
        grant_type: "password",
        oob: "",
      })
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        navigate("/user");
      }
    });
  };

  const validateInputs = () => {
    const password = document.getElementById("password") as HTMLInputElement;
    let isValid = true;

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage("Password must be at least 6 characters long.");
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage("");
    }

    return isValid;
  };

  return (
    <>
      <CustomCard variant="outlined">
      {loading && <LinearProgress />}
        <SitemarkIcon />
        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Enter password
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            gap: 2,
          }}
        >
          <FormControl disabled={loading}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <FormLabel htmlFor="password">Password</FormLabel>
              <Link component="button" type="button" onClick={handleClickOpen} variant="body2" sx={{ alignSelf: "baseline" }}>
                Forgot your password?
              </Link>
            </Box>
            <TextField
              disabled={loading}
              error={passwordError}
              helperText={passwordErrorMessage}
              name="password"
              placeholder="••••••"
              type="password"
              id="password"
              autoComplete="current-password"
              autoFocus
              required
              fullWidth
              variant="outlined"
              color={passwordError ? "error" : "primary"}
            />
          </FormControl>
          <FormControlLabel control={<Checkbox value="remember" color="primary" />} label="Remember me" />
          <ForgotPassword open={open} handleClose={handleClose} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" onClick={validateInputs} disabled={loading}>
            Sign in
          </Button>
          <Typography sx={{ textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <span>
              <LinkTo to="/signup">Sign up</LinkTo>
            </span>
          </Typography>
        </Box>
      </CustomCard>
    </>
  );
}
