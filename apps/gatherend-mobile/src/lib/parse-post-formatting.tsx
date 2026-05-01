import React from "react";
import { Linking } from "react-native";
import type { TextStyle } from "react-native";
import { Text } from "@/src/components/app-typography";

type SymbolKind = "bold" | "underline" | "italic";

type Token =
  | { type: "text"; value: string }
  | { type: "marker"; kind: SymbolKind; raw: string }
  | { type: "color_open"; color: string; raw: string }
  | { type: "color_close"; raw: string };

type AstNode =
  | { type: "text"; value: string }
  | { type: "format"; bold: boolean; underline: boolean; italic: boolean; children: AstNode[] }
  | { type: "color"; color: string; children: AstNode[] };

type Frame =
  | { kind: "root" | SymbolKind; nodes: AstNode[] }
  | { kind: "color"; color: string; nodes: AstNode[] };

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

function tokenize(text: string): Token[] {
  const re = /\[color=([^\]]{0,32})\]|(\[\/color\])|([*_#])/g;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      const rawColor = match[1];
      if (/^#[0-9a-fA-F]{3,8}$/.test(rawColor)) {
        tokens.push({ type: "color_open", color: rawColor, raw: match[0] });
      } else {
        tokens.push({ type: "text", value: match[0] });
      }
    } else if (match[2]) {
      tokens.push({ type: "color_close", raw: match[0] });
    } else {
      const ch = match[3]!;
      const kind: SymbolKind =
        ch === "*" ? "bold" : ch === "_" ? "underline" : "italic";
      tokens.push({ type: "marker", kind, raw: ch });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

function buildTree(tokens: Token[]): AstNode[] {
  const stack: Frame[] = [{ kind: "root", nodes: [] }];

  const top = () => stack[stack.length - 1];
  const pushText = (value: string) => {
    const t = top();
    const last = t.nodes[t.nodes.length - 1];
    if (last?.type === "text") {
      last.value += value;
    } else {
      t.nodes.push({ type: "text", value });
    }
  };

  for (const token of tokens) {
    if (token.type === "text") { pushText(token.value); continue; }

    if (token.type === "color_open") {
      stack.push({ kind: "color", color: token.color, nodes: [] });
      continue;
    }

    if (token.type === "color_close") {
      if (top().kind === "color") {
        const frame = stack.pop() as Extract<Frame, { kind: "color" }>;
        top().nodes.push({ type: "color", color: frame.color, children: frame.nodes });
      } else {
        pushText(token.raw);
      }
      continue;
    }

    const { kind, raw } = token;
    const openIdx = stack.findLastIndex((f) => f.kind === kind);

    if (openIdx === -1) {
      stack.push({ kind, nodes: [] });
      continue;
    }

    if (openIdx === stack.length - 1) {
      const frame = stack.pop()!;
      top().nodes.push({
        type: "format",
        bold: kind === "bold",
        underline: kind === "underline",
        italic: kind === "italic",
        children: frame.nodes,
      });
    } else {
      pushText(raw);
    }
  }

  while (stack.length > 1) {
    const frame = stack.pop()!;
    const raw =
      frame.kind === "color"
        ? `[color=${(frame as Extract<Frame, { kind: "color" }>).color}]`
        : frame.kind === "bold" ? "*" : frame.kind === "underline" ? "_" : "#";
    top().nodes.push({ type: "text", value: raw }, ...frame.nodes);
  }

  return stack[0].nodes;
}

function renderTextWithUrls(
  text: string,
  counter: { n: number },
  baseStyle: TextStyle | undefined,
  urlColor: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <Text
        key={`url-${counter.n++}`}
        style={[baseStyle, { color: urlColor, textDecorationLine: "underline" }]}
        onPress={() => void Linking.openURL(url)}
        suppressHighlighting
      >
        {url}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderNodes(
  nodes: AstNode[],
  counter: { n: number },
  urlColor: string,
  inheritedStyle?: TextStyle,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      result.push(...renderTextWithUrls(node.value, counter, inheritedStyle, urlColor));
    } else if (node.type === "color") {
      const colorStyle: TextStyle = { ...inheritedStyle, color: node.color };
      result.push(
        <Text key={`c-${counter.n++}`} style={{ color: node.color }}>
          {renderNodes(node.children, counter, urlColor, colorStyle)}
        </Text>,
      );
    } else {
      const formatStyle: TextStyle = {
        ...(node.bold ? { fontWeight: "bold" as const } : {}),
        ...(node.underline ? { textDecorationLine: "underline" as const } : {}),
        ...(node.italic ? { fontStyle: "italic" as const } : {}),
        ...(inheritedStyle?.color ? { color: inheritedStyle.color } : {}),
      };
      result.push(
        <Text key={`f-${counter.n++}`} style={formatStyle}>
          {renderNodes(node.children, counter, urlColor, { ...inheritedStyle, ...formatStyle })}
        </Text>,
      );
    }
  }

  return result;
}

export function parsePostContent(content: string, urlColor: string): React.ReactNode {
  const nodes = renderNodes(buildTree(tokenize(content)), { n: 0 }, urlColor);
  return <>{nodes}</>;
}
