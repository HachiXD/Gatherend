"use client";

import React from "react";

export const parseUrls = (content: string): React.ReactNode[] => {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = urlRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <a
        key={`url-${keyIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-theme-text-accent hover:text-theme-accent-light underline break-all"
      >
        {url}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
};

// --- tokenizer types ---

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

// tokenize: escanea izq-der emitiendo marcadores y texto
function tokenize(text: string, withColor: boolean): Token[] {
  // grupo 1=color_open hex, grupo 2=color_close, grupo 3=marker char
  const re = withColor
    ? /\[color=(#[0-9a-fA-F]{3,8})\]|(\[\/color\])|([*_#])/g
    : /([*_#])/g;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (withColor && match[1]) {
      tokens.push({ type: "color_open", color: match[1], raw: match[0] });
    } else if (withColor && match[2]) {
      tokens.push({ type: "color_close", raw: match[0] });
    } else {
      const ch = withColor ? match[3] : match[1];
      const kind: SymbolKind = ch === "*" ? "bold" : ch === "_" ? "underline" : "italic";
      tokens.push({ type: "marker", kind, raw: ch! });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

// stack frame: marcador abierto + nodos acumulados hasta ahora
type Frame =
  | { kind: "root" | SymbolKind; nodes: AstNode[] }
  | { kind: "color"; color: string; nodes: AstNode[] };

// buildTree: LIFO estricto
// si el cierre no coincide con el tope → el marcador de apertura se emite como texto
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
    if (token.type === "text") {
      pushText(token.value);
      continue;
    }

    if (token.type === "color_open") {
      stack.push({ kind: "color", color: token.color, nodes: [] });
      continue;
    }

    if (token.type === "color_close") {
      if (top().kind === "color") {
        const frame = stack.pop() as Extract<Frame, { kind: "color" }>;
        top().nodes.push({ type: "color", color: frame.color, children: frame.nodes });
      } else {
        // [/color] sin apertura correspondiente → texto literal
        pushText(token.raw);
      }
      continue;
    }

    // token es marker
    const { kind, raw } = token;
    const openIdx = stack.findLastIndex((f) => f.kind === kind);

    if (openIdx === -1) {
      // no hay apertura en el stack → abrir nuevo frame
      stack.push({ kind, nodes: [] });
      continue;
    }

    if (openIdx === stack.length - 1) {
      // LIFO: el tope es la apertura correspondiente → cerrar
      const frame = stack.pop()!;
      top().nodes.push({
        type: "format",
        bold: kind === "bold",
        underline: kind === "underline",
        italic: kind === "italic",
        children: frame.nodes,
      });
    } else {
      // cruce: el marcador de cierre no coincide con el tope del stack
      // LIFO estricto: emitir el marcador de la apertura como texto y descartar ese frame
      const frame = stack.splice(openIdx, 1)[0];
      // reinsertar los nodos acumulados en ese frame en el frame padre
      const parent = stack[openIdx - 1 < 0 ? 0 : openIdx] ?? top();
      parent.nodes.push({ type: "text", value: raw }, ...frame.nodes);
    }
  }

  // frames que nunca cerraron: emitir sus marcadores como texto
  while (stack.length > 1) {
    const frame = stack.pop()!;
    const raw = frame.kind === "color" ? `[color=${(frame as Extract<Frame, {kind:"color"}>).color}]` : (frame.kind === "bold" ? "*" : frame.kind === "underline" ? "_" : "#");
    top().nodes.push({ type: "text", value: raw }, ...frame.nodes);
  }

  return stack[0].nodes;
}

// renderNodes: AST → React
function renderNodes(nodes: AstNode[], counter: { n: number }, color?: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      result.push(node.value);
    } else if (node.type === "color") {
      const key = `c-${counter.n++}`;
      result.push(
        <span key={key} style={{ color: node.color }}>
          {renderNodes(node.children, counter, node.color)}
        </span>,
      );
    } else {
      const key = `f-${counter.n++}`;
      const cls = [
        node.bold ? "font-bold" : "",
        node.underline ? "underline" : "",
        node.italic ? "italic" : "",
      ].filter(Boolean).join(" ");
      const style = color ? { color } : undefined;
      result.push(
        <span key={key} className={cls} style={style}>
          {renderNodes(node.children, counter, color)}
        </span>,
      );
    }
  }
  return result;
}

// *texto* bold, _texto_ underline, #texto# italic
// cualquier permutación y anidamiento; LIFO estricto para marcadores cruzados
export const parseTextFormatting = (content: string): React.ReactNode[] => {
  const nodes = buildTree(tokenize(content, false));
  return renderNodes(nodes, { n: 0 });
};

// menciones → bold/underline/italic/URLs sobre nodos de texto plano
export const parseTextWithFormatting = (
  content: string,
  parseMentionsFn: (text: string) => React.ReactNode[],
): React.ReactNode[] => {
  const parts = parseMentionsFn(content);
  const result: React.ReactNode[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      for (const fPart of parseTextFormatting(part)) {
        if (typeof fPart === "string") {
          result.push(...parseUrls(fPart));
        } else {
          result.push(fPart);
        }
      }
    } else {
      result.push(part);
    }
  }

  return result;
};
