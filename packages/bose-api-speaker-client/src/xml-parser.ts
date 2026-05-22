import { XmlParseError } from "./errors.ts";

export type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

export function parseXml(xml: string): XmlNode {
  const tagRegex =
    /<(\/?)([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_-]+="[^"]*")*)\s*(\/?)>/g;
  const valueRegex = /<[^>]*>/;
  const tokens: {
    type: "open" | "close" | "selfClose";
    name: string;
    attrs: Record<string, string>;
  }[] = [];

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const texts: string[] = [];

  while ((match = tagRegex.exec(xml)) !== null) {
    const beforeTag = xml.slice(lastIndex, match.index);
    texts.push(beforeTag);
    lastIndex = tagRegex.lastIndex;

    const [, closing, name, attrStr, selfClose] = match;
    const attrs: Record<string, string> = {};
    if (attrStr) {
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let am: RegExpExecArray | null;
      while ((am = attrRegex.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2];
      }
    }

    if (selfClose) {
      tokens.push({ type: "selfClose", name, attrs });
    } else if (closing) {
      tokens.push({ type: "close", name, attrs });
    } else {
      tokens.push({ type: "open", name, attrs });
    }
  }

  texts.push(xml.slice(lastIndex));

  let textIndex = 0;
  const stack: XmlNode[] = [];

  function getNextText(): string {
    return (texts[textIndex++] ?? "").trim();
  }

  function cleanText(text: string): string {
    return text
      .replace(/^<\?xml[^>]*\?>\s*/, "")
      .replace(valueRegex, "")
      .trim();
  }

  for (const token of tokens) {
    const text = getNextText();

    if (token.type === "open") {
      const node: XmlNode = {
        name: token.name,
        attributes: token.attrs,
        children: [],
        text: "",
      };
      stack.push(node);
    } else if (token.type === "selfClose") {
      const node: XmlNode = {
        name: token.name,
        attributes: token.attrs,
        children: [],
        text: "",
      };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        stack.push(node);
      }
    } else if (token.type === "close") {
      const node = stack.pop();
      if (!node) {
        throw new Error(`Unexpected closing tag </${token.name}>`);
      }
      if (node.name !== token.name) {
        throw new Error(`Mismatched tags: <${node.name}> and </${token.name}>`);
      }

      node.text = cleanText(text);

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        stack.push(node);
      }
    }
  }

  const root = stack[0];
  if (!root) {
    throw new XmlParseError({ message: "Empty XML document", rawXml: xml });
  }
  return root;
}

export function getChild(root: XmlNode, name: string): XmlNode | undefined {
  return root.children.find((child) => child.name === name);
}

export function getChildText(root: XmlNode, name: string): string | undefined {
  return getChild(root, name)?.text;
}

export function getChildren(root: XmlNode, name: string): XmlNode[] {
  return root.children.filter((child) => child.name === name);
}

export function parseBool(str: string): boolean {
  return str.toLowerCase() === "true";
}

export function parseIntSafe(str: string): number {
  return Number.parseInt(str, 10);
}
