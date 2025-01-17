import type {
  JSONNode,
  JSONExpression,
  JSONNumberIdentifier,
  JSONIdentifier,
  JSONObjectExpression,
  JSONArrayExpression,
  JSONUnaryExpression,
  JSONNumberLiteral,
  JSONExpressionStatement,
  JSONProgram,
  JSONUndefinedIdentifier,
  JSONTemplateLiteral,
  JSONTemplateElement,
  JSONStringLiteral,
  JSONKeywordLiteral,
  JSONRegExpLiteral,
  JSONBigIntLiteral,
  JSONLiteral,
  JSONProperty,
  JSONBinaryExpression,
} from "../parser/ast";

/**
 * Checks if given node is JSONExpression
 */
export function isExpression<N extends JSONNode>(
  node: N,
): node is N & JSONExpression {
  if (node.type === "JSONIdentifier" || node.type === "JSONLiteral") {
    const parent = node.parent!;
    if (parent.type === "JSONProperty" && parent.key === node) {
      return false;
    }
    return true;
  }
  if (
    node.type === "JSONObjectExpression" ||
    node.type === "JSONArrayExpression" ||
    node.type === "JSONUnaryExpression" ||
    node.type === "JSONTemplateLiteral" ||
    node.type === "JSONBinaryExpression"
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if given node is JSONNumberIdentifier
 */
export function isNumberIdentifier(
  node: JSONIdentifier,
): node is JSONNumberIdentifier {
  return (
    isExpression(node) && (node.name === "Infinity" || node.name === "NaN")
  );
}

/**
 * Checks if given node is JSONUndefinedIdentifier
 */
export function isUndefinedIdentifier(
  node: JSONIdentifier,
): node is JSONUndefinedIdentifier {
  return isExpression(node) && node.name === "undefined";
}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JSONObjectValue
  | JSONValue[]
  | RegExp
  | bigint;
export type JSONObjectValue = { [key: string]: JSONValue };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any
const resolver: { [key in JSONNode["type"]]: (node: any) => JSONValue } = {
  Program(node: JSONProgram) {
    if (
      node.body.length !== 1 ||
      node.body[0].type !== "JSONExpressionStatement"
    ) {
      throw new Error("Illegal argument");
    }
    return getStaticJSONValue(node.body[0]);
  },
  JSONExpressionStatement(node: JSONExpressionStatement) {
    return getStaticJSONValue(node.expression);
  },
  JSONObjectExpression(node: JSONObjectExpression) {
    const object: JSONObjectValue = {};
    for (const prop of node.properties) {
      Object.assign(object, getStaticJSONValue(prop));
    }
    return object;
  },
  JSONProperty(node: JSONProperty) {
    const keyName =
      node.key.type === "JSONLiteral" ? `${node.key.value}` : node.key.name;
    return {
      [keyName]: getStaticJSONValue(node.value),
    };
  },
  JSONArrayExpression(node: JSONArrayExpression) {
    const array: JSONValue[] = [];
    for (let index = 0; index < node.elements.length; index++) {
      const element = node.elements[index];
      if (element) {
        array[index] = getStaticJSONValue(element);
      }
    }
    return array;
  },
  JSONLiteral(node: JSONLiteral) {
    if (node.regex) {
      try {
        return new RegExp(node.regex.pattern, node.regex.flags);
      } catch {
        return `/${node.regex.pattern}/${node.regex.flags}`;
      }
    }
    if (node.bigint != null) {
      try {
        return BigInt(node.bigint);
      } catch {
        return `${node.bigint}`;
      }
    }
    return node.value;
  },
  JSONUnaryExpression(node: JSONUnaryExpression) {
    const value = getStaticJSONValue(node.argument);
    return node.operator === "-" ? -value : value;
  },
  JSONBinaryExpression(node: JSONBinaryExpression) {
    const left = getStaticJSONValue(node.left);
    const right = getStaticJSONValue(node.right);
    return node.operator === "+"
      ? left + right
      : node.operator === "-"
      ? left - right
      : node.operator === "*"
      ? left * right
      : node.operator === "/"
      ? left / right
      : node.operator === "%"
      ? left % right
      : node.operator === "**"
      ? left ** right
      : (() => {
          throw new Error(`Unknown operator: ${node.operator}`);
        })();
  },
  JSONIdentifier(node: JSONIdentifier) {
    if (node.name === "Infinity") {
      return Infinity;
    }
    if (node.name === "NaN") {
      return NaN;
    }
    if (node.name === "undefined") {
      return undefined;
    }
    throw new Error("Illegal argument");
  },
  JSONTemplateLiteral(node: JSONTemplateLiteral) {
    return getStaticJSONValue(node.quasis[0]);
  },
  JSONTemplateElement(node: JSONTemplateElement) {
    return node.value.cooked;
  },
};

export function getStaticJSONValue(
  node:
    | JSONUnaryExpression
    | JSONNumberIdentifier
    | JSONNumberLiteral
    | JSONBinaryExpression,
): number;
export function getStaticJSONValue(node: JSONUndefinedIdentifier): undefined;
export function getStaticJSONValue(
  node: JSONTemplateLiteral | JSONTemplateElement | JSONStringLiteral,
): string;
export function getStaticJSONValue(node: JSONKeywordLiteral): boolean | null;
export function getStaticJSONValue(node: JSONRegExpLiteral): RegExp;
export function getStaticJSONValue(node: JSONBigIntLiteral): bigint;
export function getStaticJSONValue(
  node: JSONLiteral,
): string | number | boolean | RegExp | bigint | null;
export function getStaticJSONValue(
  node: Exclude<JSONExpression, JSONObjectExpression | JSONArrayExpression>,
): Exclude<JSONValue, JSONObjectValue | JSONValue[]>;

export function getStaticJSONValue(node: JSONObjectExpression): JSONObjectValue;
export function getStaticJSONValue(node: JSONArrayExpression): JSONValue[];
export function getStaticJSONValue(
  node: JSONExpression | JSONExpressionStatement | JSONProgram | JSONNode,
): JSONValue;

/**
 * Gets the static value for the given node.
 */
export function getStaticJSONValue(node: JSONNode): JSONValue {
  return resolver[node.type](node);
}
