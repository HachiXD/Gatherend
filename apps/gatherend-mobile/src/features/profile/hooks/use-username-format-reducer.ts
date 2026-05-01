import { useReducer, useMemo } from "react";
import {
  parseUsernameFormat,
  type UsernameFormatConfig,
} from "@/src/features/profile/lib/username-format";

export interface UsernameFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

type UsernameFormatAction =
  | { type: "TOGGLE_BOLD" }
  | { type: "TOGGLE_ITALIC" }
  | { type: "TOGGLE_UNDERLINE" }
  | { type: "SET_BOLD"; payload: boolean }
  | { type: "SET_ITALIC"; payload: boolean }
  | { type: "SET_UNDERLINE"; payload: boolean };

function usernameFormatReducer(
  state: UsernameFormatState,
  action: UsernameFormatAction,
): UsernameFormatState {
  switch (action.type) {
    case "TOGGLE_BOLD":
      return { ...state, bold: !state.bold };
    case "TOGGLE_ITALIC":
      return { ...state, italic: !state.italic };
    case "TOGGLE_UNDERLINE":
      return { ...state, underline: !state.underline };
    case "SET_BOLD":
      return { ...state, bold: action.payload };
    case "SET_ITALIC":
      return { ...state, italic: action.payload };
    case "SET_UNDERLINE":
      return { ...state, underline: action.payload };
    default:
      return state;
  }
}

export function useUsernameFormatReducer(initialFormat: unknown) {
  const initialState = useMemo((): UsernameFormatState => {
    const parsed = parseUsernameFormat(initialFormat);
    return {
      bold: parsed.bold || false,
      italic: parsed.italic || false,
      underline: parsed.underline || false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, dispatch] = useReducer(usernameFormatReducer, initialState);

  const actions = useMemo(
    () => ({
      toggleBold: () => dispatch({ type: "TOGGLE_BOLD" }),
      toggleItalic: () => dispatch({ type: "TOGGLE_ITALIC" }),
      toggleUnderline: () => dispatch({ type: "TOGGLE_UNDERLINE" }),
      setBold: (value: boolean) => dispatch({ type: "SET_BOLD", payload: value }),
      setItalic: (value: boolean) =>
        dispatch({ type: "SET_ITALIC", payload: value }),
      setUnderline: (value: boolean) =>
        dispatch({ type: "SET_UNDERLINE", payload: value }),
    }),
    [],
  );

  const buildFormat = (): UsernameFormatConfig => ({
    bold: state.bold || undefined,
    italic: state.italic || undefined,
    underline: state.underline || undefined,
  });

  return { state, actions, buildFormat };
}
