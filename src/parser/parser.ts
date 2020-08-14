import type { ExpressionStatement, CallExpression } from "estree"
import type { AST } from "eslint"
import { getEspree } from "./espree"
import {
    ParseError,
    throwEmptyError,
    throwUnexpectedTokenError,
    throwErrorAsAdjustingOutsideOfCode,
    throwUnexpectedCommentError,
} from "./errors"
import { KEYS } from "./visitor-keys"
import {
    convertNode,
    convertToken,
    fixLocation,
    fixErrorLocation,
    JSONSyntaxContext,
} from "./convert"
import type { ParserOptions } from "../types"
import { TokenStore, isComma } from "./token-store"

/**
 * Parse source code
 */
export function parseForESLint(code: string, options?: any) {
    try {
        const ast = parseJS(`0(${code}\n)`, options)

        const tokens = ast.tokens || []
        const tokenStore = new TokenStore(tokens)
        const statement = ast.body[0] as ExpressionStatement
        const callExpression = statement.expression as CallExpression
        const expression = callExpression.arguments[0]

        if (!expression) {
            return throwEmptyError("an expression")
        }
        if (expression && expression.type === "SpreadElement") {
            return throwUnexpectedTokenError("...", expression)
        }
        if (callExpression.arguments[1]) {
            const node = callExpression.arguments[1]
            return throwUnexpectedTokenError(
                ",",
                tokenStore.getTokenBefore(node, isComma)!,
            )
        }

        // Remove parens.
        tokens.shift()
        tokens.shift()
        tokens.pop()
        const last = tokens[tokens.length - 1]

        if (last && isComma(last)) {
            return throwUnexpectedTokenError(",", last)
        }

        ast.range[1] = statement.range![1] = last.range[1]
        ast.loc.end.line = statement.loc!.end.line = last.loc.end.line
        ast.loc.end.column = statement.loc!.end.column = last.loc.end.column
        ast.body = [statement]
        statement.expression = expression

        return {
            ast: postprocess(ast, tokenStore, options),
            visitorKeys: KEYS,
            services: {
                isJSON: true,
            },
        }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code)
    }
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param options The parser options.
 * @returns The result of parsing.
 */
function parseJS(code: string, options: any): AST.Program {
    const espree = getEspree()
    try {
        return espree.parse(code, options)
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            fixErrorLocation(perr)
            throw perr
        }
        throw err
    }
}

/**
 * Do post-process of parsing an expression.
 *
 * 1. Convert node type.
 * 2. Fix `node.range` and `node.loc` for JSON entities.
 *
 * @param result The parsing result to modify.
 */
function postprocess(
    ast: AST.Program,
    tokenStore: TokenStore,
    options?: ParserOptions,
) {
    const ctx: JSONSyntaxContext = getJSONSyntaxContext(options?.jsonSyntax)
    const jsonAst = convertNode(ast, tokenStore, ctx)

    const tokens = []
    for (const token of ast.tokens || []) {
        tokens.push(convertToken(token))
    }
    const comments = ast.comments || []
    if (!ctx.comments && comments.length > 0) {
        return throwUnexpectedCommentError(comments[0])
    }
    for (const comment of comments) {
        fixLocation(comment)
    }
    jsonAst.tokens = tokens
    jsonAst.comments = comments
    return jsonAst
}

/**
 * Normalize json syntax option
 */
function getJSONSyntaxContext(str?: string | null): JSONSyntaxContext {
    const upperCase = str?.toUpperCase()
    if (upperCase === "JSON") {
        return {
            trailingCommas: false,
            comments: false,
            plusSigns: false,
            spacedSigns: false,
            leadingOrTrailingDecimalPoints: false,
            infinities: false,
            nans: false,
            invalidJsonNumbers: false,
            multilineStrings: false,
            unquoteProperties: false,
            singleQuotes: false,
            numberProperties: false,
            undefinedKeywords: false,
            sparseArrays: false,
            regExpLiterals: false,
            templateLiterals: false,
            bigintLiterals: false,
        }
    }
    if (upperCase === "JSONC") {
        return {
            trailingCommas: true,
            comments: true,
            plusSigns: false,
            spacedSigns: false,
            leadingOrTrailingDecimalPoints: false,
            infinities: false,
            nans: false,
            invalidJsonNumbers: false,
            multilineStrings: false,
            unquoteProperties: false,
            singleQuotes: false,
            numberProperties: false,
            undefinedKeywords: false,
            sparseArrays: false,
            regExpLiterals: false,
            templateLiterals: false,
            bigintLiterals: false,
        }
    }
    if (upperCase === "JSON5") {
        return {
            trailingCommas: true,
            comments: true,
            plusSigns: true,
            spacedSigns: true,
            leadingOrTrailingDecimalPoints: true,
            infinities: true,
            nans: true,
            invalidJsonNumbers: true,
            multilineStrings: true,
            unquoteProperties: true,
            singleQuotes: true,
            numberProperties: false,
            undefinedKeywords: false,
            sparseArrays: false,
            regExpLiterals: false,
            templateLiterals: false,
            bigintLiterals: false,
        }
    }
    return {
        trailingCommas: true,
        comments: true,
        plusSigns: true,
        spacedSigns: true,
        leadingOrTrailingDecimalPoints: true,
        infinities: true,
        nans: true,
        invalidJsonNumbers: true,
        multilineStrings: true,
        unquoteProperties: true,
        singleQuotes: true,
        numberProperties: true,
        undefinedKeywords: true,
        sparseArrays: true,
        regExpLiterals: true,
        templateLiterals: true,
        bigintLiterals: true,
    }
}