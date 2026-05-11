export type BoardViewTarget =
  | { kind: "rules" }
  | { kind: "ranking" }
  | { kind: "channels:list" }
  | { kind: "channels:channel"; channelId: string };

export type SwitchBoardOptions = {
  history?: "push" | "replace";
  persist?: boolean;
};
