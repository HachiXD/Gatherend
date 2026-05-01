export type TurnstileBridgeMessage =
  | {
      type: "turnstile-success";
      token: string;
    }
  | {
      type: "turnstile-skip";
    }
  | {
      type: "turnstile-expired";
    }
  | {
      type: "turnstile-error";
      reason?: string;
    };
