export type BoardViewTarget =
  | { kind: "forum" }
  | { kind: "rules" }
  | { kind: "wiki" }
  | { kind: "ranking" }
  | { kind: "channels:list" }
  | { kind: "channels:channel"; channelId: string };

export type SwitchBoardOptions = {
  history?: "push" | "replace";
  persist?: boolean;
};
