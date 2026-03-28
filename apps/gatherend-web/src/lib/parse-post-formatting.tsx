"use client";

import React from "react";
import { adaptColorForTheme } from "@/lib/username-color";
import { parseUrls } from "@/lib/parse-text-formatting";

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

function tokenize(text: string): Token[] {
  const re = /\[color=(#[0-9a-fA-F]{3,8})\]|(\[\/color\])|([*_#])/g;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      tokens.push({ type: "color_open", color: match[1], raw: match[0] });
    } else if (match[2]) {
      tokens.push({ type: "color_close", raw: match[0] });
    } else {
      const ch = match[3]!;
      const kind: SymbolKind = ch === "*" ? "bold" : ch === "_" ? "underline" : "italic";
      tokens.push({ type: "marker", kind, raw: ch });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  return tokens;
}

function buildTree(tokens: Token[]): AstNode[] {
  const stack: Frame[] = [{ kind: "root", nodes: [] }];

  const top = () => stack[stack.length - 1];
  const pushText = (value: string) => {
    const t = top();
    const last = t.nodes[t.nodes.length - 1];
    if (last?.type === "text") last.value += value;
    else t.nodes.push({ type: "text", value });
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
        // [/color] sin apertura → texto literal
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
      // LIFO: el tope es la apertura → cerrar
      const frame = stack.pop()!;
      top().nodes.push({
        type: "format",
        bold: kind === "bold",
        underline: kind === "underline",
        italic: kind === "italic",
        children: frame.nodes,
      });
    } else {
      // cruce: LIFO estricto → emitir marcador de apertura como texto, reinsertar nodos
      const frame = stack.splice(openIdx, 1)[0];
      const parent = stack[openIdx] ?? top();
      parent.nodes.push({ type: "text", value: raw }, ...frame.nodes);
    }
  }

  // frames sin cerrar → emitir marcador como texto
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

function renderNodes(
  nodes: AstNode[],
  counter: { n: number },
  themeMode: "dark" | "light",
  inheritedColor?: string,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      result.push(...parseUrls(node.value));
    } else if (node.type === "color") {
      const adapted = adaptColorForTheme(node.color, themeMode);
      result.push(
        <span key={`c-${counter.n++}`} style={{ color: adapted }}>
          {renderNodes(node.children, counter, themeMode, adapted)}
        </span>,
      );
    } else {
      const cls = [
        node.bold ? "font-bold" : "",
        node.underline ? "underline" : "",
        node.italic ? "italic" : "",
      ].filter(Boolean).join(" ");
      const style = inheritedColor ? { color: inheritedColor } : undefined;
      result.push(
        <span key={`f-${counter.n++}`} className={cls} style={style}>
          {renderNodes(node.children, counter, themeMode, inheritedColor)}
        </span>,
      );
    }
  }
  return result;
}

// [color=#hex]...[/color], *bold*, _underline_, #italic# en cualquier orden y anidamiento
// LIFO estricto para marcadores cruzados; color adaptado al themeMode del viewer
export function parsePostContent(
  content: string,
  themeMode: "dark" | "light",
): React.ReactNode[] {
  return renderNodes(buildTree(tokenize(content)), { n: 0 }, themeMode);
}
