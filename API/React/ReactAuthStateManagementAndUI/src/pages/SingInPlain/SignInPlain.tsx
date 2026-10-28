import * as React from "react";
import Box from "@mui/material/Box";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { Link as LinkTo, useNavigate } from "react-router-dom";
import { SitemarkIcon } from "../../components/CustomIcons";
import { CustomCard } from "../../components/CustomCard";
import { AppDispatch, RootState } from "state/store";
import { signInChallengeAction, signInStartAction, signInTokenAction } from "state/authState";
import { Alert, Button, LinearProgress } from "@mui/material";

export function SignInPlain(props: { disableCustomTheme?: boolean }) {
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
        password: data.get("password") as string,
      })
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        dispatch(signInChallengeAction({})).then((action) => {
          if (action.meta.requestStatus === "fulfilled") {
            const challengeType = action.payload.challenge_type;

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
      <CustomCard>
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
          <FormControl disabled={loading}>
            <FormLabel htmlFor="password">Password</FormLabel>
            <TextField
              disabled={loading}
              error={emailError}
              helperText={emailErrorMessage}
              id="password"
              type="password"
              name="password"
              autoFocus
              required
              fullWidth
              variant="outlined"
              color={emailError ? "error" : "primary"}
              sx={{ ariaLabel: "email" }}
            />
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" onClick={validateInputs} disabled={loading} variant="outlined">
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
