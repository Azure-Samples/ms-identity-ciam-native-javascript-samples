import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SignUpForm } from "interfaces/SignUpInterfaces";
import { TokenInterface } from "interfaces/TokenInterface";
import { signInChallenge, signInStart, signInTokenRequest } from "services/LoginService";
import { signupChallenge, signupStart, signUpSubmitOTP, signUpSubmitPassword } from "services/SignUpService";

interface AuthStateInterface {
  isAuth: boolean;
  id_token: string;
  access_token: string;
  challenge_target_label: string;
  refresh_token: string;
  token_type: string;
  expires_in: string;
  scope: string;
  loading: boolean;
  success: boolean;
  error: any;
  continuation_token?: string;
  username: string | null;
}

const initialState: AuthStateInterface = {
  isAuth: false,
  id_token: "",
  access_token: "",
  refresh_token: "",
  challenge_target_label: "",
  token_type: "",
  expires_in: "",
  scope: "",
  loading: false,
  success: false,
  error: null,
  continuation_token: "",
  username: null,
};

// =========================== SIGN-IN ACTIONS ===========================
// Step 1: Start Sign-in
export const signInStartAction = createAsyncThunk("authState/signInStart", async ({ username }: any, { rejectWithValue }) => {
  try {
    const response = await signInStart({ username });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data.error_description) {
      return rejectWithValue(error.response.data.error_description);
    } else {
      return rejectWithValue(error.message);
    }
  }
});

// Step 2: Select authentication method (send OTP)
export const signInChallengeAction = createAsyncThunk("authState/signInChallenge", async (_: any, { getState, rejectWithValue }: any) => {
  try {
    const { continuation_token } = getState().authState;
    const response = await signInChallenge({ continuation_token });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data.error_description) {
      return rejectWithValue(error.response.data.error_description);
    } else {
      return rejectWithValue(error.message);
    }
  }
});

// Step 3: Request for security tokens
export const signInTokenAction = createAsyncThunk(
  "authState/signInToken",
  async ({ password, oob, grant_type }: any, { getState, rejectWithValue }: any) => {
    try {
      const { continuation_token } = getState().authState;
      const response = await signInTokenRequest({ continuation_token, password, oob, grant_type });
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data.error_description) {
        return rejectWithValue(error.response.data.error_description);
      } else {
        return rejectWithValue(error.message);
      }
    }
  }
);

// =========================== SIGN-UP ACTIONS ===========================
// Step 1: Start Sign-Up
export const signUpStart = createAsyncThunk(
  "authState/signUpStart",
  async ({ name, surname, email, password }: SignUpForm, { rejectWithValue }) => {
    try {
      const response = await signupStart({ name, surname, email, password });
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data.error_description) {
        return rejectWithValue(error.response.data.error_description);
      } else {
        return rejectWithValue(error.message);
      }
    }
  }
);

// Step 2: Select authentication method (send OTP)
export const signUpChallengeAction = createAsyncThunk("authState/signUpChallenge", async (_: any, { getState, rejectWithValue }: any) => {
  try {
    const { continuation_token } = getState().authState;
    const response = await signupChallenge({ continuation_token });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data.error_description) {
      return rejectWithValue(error.response.data.error_description);
    } else {
      return rejectWithValue(error.message);
    }
  }
});

// Step 3: Submit OTP
export const signUpSubmitOtpAction = createAsyncThunk("authState/submitOtp", async ({ oob }: any, thunkAPI: any) => {
  try {
    const { continuation_token } = thunkAPI.getState().authState;
    const response = await signUpSubmitOTP({ continuation_token, oob });
    return response.data;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.response.data.error_description);
  }
});

// Step 4: Submit password to complete sign-up
export const signUpSubmitPasswordAction = createAsyncThunk("authState/submitPassword", async ({ password }: any, thunkAPI: any) => {
  try {
    const { continuation_token } = thunkAPI.getState().authState;
    const response = await signUpSubmitPassword({ continuation_token, password });
    return response.data;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.response.data.error_description);
  }
});

const authSlice = createSlice({
  name: "authState",
  initialState,
  reducers: {
    tokenRequest: (state, action: PayloadAction<TokenInterface>) => {},
  },
  extraReducers: (builder) => {
    // Handle the startSignIn call
    builder
      .addCase(signInStartAction.pending, (state, action) => {
        state.username = action.meta.arg.username;
        state.loading = true;
        state.error = null;
      })
      .addCase(signInStartAction.fulfilled, (state, action) => {
        state.loading = false;
        state.continuation_token = action.payload.continuation_token;
      })
      .addCase(signInStartAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Handle the startSignInChallenge call
    builder
      .addCase(signInChallengeAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInChallengeAction.fulfilled, (state, action) => {
        state.loading = false;
        state.continuation_token = action.payload.continuation_token;
      })
      .addCase(signInChallengeAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    builder
      .addCase(signInTokenAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInTokenAction.fulfilled, (state, action) => {
        state.loading = false;
        state.access_token = action.payload.access_token;
        state.id_token = action.payload.id_token;
        state.refresh_token = action.payload.refresh_token;
        state.scope = action.payload.scope;
        state.token_type = action.payload.token_type;
        state.expires_in = action.payload.expires_in;
        state.isAuth = true;
      })
      .addCase(signInTokenAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Handle the startSignUp call
    builder
      .addCase(signUpStart.pending, (state, action) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpStart.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.continuation_token = action.payload.continuation_token;
      })
      .addCase(signUpStart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Handle the sendOtp call
    builder
      .addCase(signUpChallengeAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpChallengeAction.fulfilled, (state, action) => {
        state.loading = false;
        state.continuation_token = action.payload.continuation_token;
        state.challenge_target_label = action.payload.challenge_target_label;
      })
      .addCase(signUpChallengeAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Handle the submitOtp call
    builder
      .addCase(signUpSubmitOtpAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpSubmitOtpAction.fulfilled, (state, action) => {
        state.loading = false;
        state.continuation_token = action.payload.continuation_token;
      })
      .addCase(signUpSubmitOtpAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Handle the submitPassword call
    builder
      .addCase(signUpSubmitPasswordAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpSubmitPasswordAction.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(signUpSubmitPasswordAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});
// const {} = authSlice.actions;
const authReducer = authSlice.reducer;

export { authReducer };
