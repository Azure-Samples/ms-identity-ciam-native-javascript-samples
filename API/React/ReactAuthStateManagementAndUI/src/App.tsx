import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import "./App.css";
import { AnimatedRoutes } from "AnimatedRoutes";
import { createTheme, CssBaseline, Stack, TextField } from "@mui/material";
import { Container, ContainerNoBackground } from "./components/Container";
import { CustomAppBar } from "./components/CustomAppBar";

function App() {
  const defaultTheme = createTheme({ palette: { mode: "light" } });
  const hideBackgroundImage = window.location && window.location.pathname === "/signinplain";

  return (
    <ThemeProvider theme={defaultTheme}>
      <main className="container content">
        <Router>
          <CssBaseline enableColorScheme />
          <CustomAppBar />
          {hideBackgroundImage ? (
            <ContainerNoBackground direction="column" justifyContent="space-between">
              <Stack
                sx={{
                  justifyContent: "center",
                  height: "100dvh",
                  p: 2,
                }}
              >
                <AnimatedRoutes />
              </Stack>
            </ContainerNoBackground>
          ) : (
            <Container direction="column" justifyContent="space-between">
              <Stack
                sx={{
                  justifyContent: "center",
                  height: "100dvh",
                  p: 2,
                }}
              >
                <AnimatedRoutes />
              </Stack>
            </Container>
          )}
        </Router>
      </main>
    </ThemeProvider>
  );
}
export default App;
