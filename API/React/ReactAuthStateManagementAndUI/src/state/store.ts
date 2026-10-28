import { configureStore, combineReducers,  } from '@reduxjs/toolkit';
import { authReducer } from './authState';


const appReducer = combineReducers({
  authState: authReducer,
});

export const store = configureStore({
  reducer: appReducer
})

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch

