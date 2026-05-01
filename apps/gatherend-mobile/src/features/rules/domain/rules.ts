export interface ClientRuleItem {
  order: number;
  title: string;
  description: string | null;
}

export interface ClientBoardRulesImageAsset {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface ClientBoardRules {
  id: string;
  boardId: string;
  items: ClientRuleItem[];
  imageAsset: ClientBoardRulesImageAsset | null;
  createdAt: string;
  updatedAt: string;
}
