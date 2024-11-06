import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import background from "../assets/background.jpg";
export const Container = styled(Stack)(({ theme }) => ({
  height: "100%",
  padding: 0,
  backgroundImage: `url(${background})`,
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  ...theme.applyStyles("dark", {
    backgroundImage: "radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))",
  }),
}));

export const ContainerNoBackground = styled(Stack)(({ theme }) => ({
  height: "100%",
  padding: 0,
  backgroundImage: "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
  backgroundRepeat: "no-repeat",
  ...theme.applyStyles("dark", {
    backgroundImage: "radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))",
  }),
}));
