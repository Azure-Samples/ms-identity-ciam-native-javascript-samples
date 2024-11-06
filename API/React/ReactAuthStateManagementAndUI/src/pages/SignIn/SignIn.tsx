import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { Link as LinkTo, useNavigate } from "react-router-dom";
import { GoogleIcon, FacebookIcon, SitemarkIcon } from "../../components/CustomIcons";
import { CustomCard } from "../../components/CustomCard";
import { AppDispatch, RootState } from "state/store";
import { signInChallengeAction, signInStartAction } from "state/authState";
import { Alert, LinearProgress } from "@mui/material";

export function SignIn(props: { disableCustomTheme?: boolean }) {
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.authState);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    dispatch(
      signInStartAction({
        username: data.get("email") as string,
      })
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        dispatch(signInChallengeAction({})).then((action) => {
          if (action.meta.requestStatus === "fulfilled") {
            const challengeType = action.payload.challenge_type;
            if (challengeType === "password") {
              navigate("/signin/password");
            } else if (challengeType === "oob") {
              navigate("/signin/otp");
            }
          }
        });
      }
    });
  };

  const validateInputs = () => {
    const email = document.getElementById("email") as HTMLInputElement;

    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage("Please enter a valid email address.");
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage("");
    }

    return isValid;
  };

  return (
    <>
      <CustomCard variant="outlined">
      {loading && <LinearProgress />}
        <SitemarkIcon />
        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Sign in
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
            <FormLabel htmlFor="email">Email</FormLabel>
            <TextField
              disabled={loading}
              error={emailError}
              helperText={emailErrorMessage}
              id="email"
              type="email"
              name="email"
              placeholder="your@email.com"
              autoComplete="email"
              autoFocus
              required
              fullWidth
              variant="outlined"
              color={emailError ? "error" : "primary"}
              sx={{ ariaLabel: "email" }}
            />
          </FormControl>
          <FormControlLabel control={<Checkbox value="remember" color="primary" />} label="Remember me" />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" onClick={validateInputs} disabled={loading}>
            Next
          </Button>
          <Typography sx={{ textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <span>
              <LinkTo to="/signup">Sign up</LinkTo>
            </span>
          </Typography>
        </Box>
        <Divider>or</Divider>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button type="submit" fullWidth variant="outlined" onClick={() => alert("Sign in with Google")} startIcon={<GoogleIcon />}>
            Sign in with Google
          </Button>
          <Button type="submit" fullWidth variant="outlined" onClick={() => alert("Sign in with Facebook")} startIcon={<FacebookIcon />}>
            Sign in with Facebook
          </Button>
        </Box>
      </CustomCard>
    </>
  );
}
