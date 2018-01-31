/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/// <reference path="./types/common.d.ts" />

import {parse as parseQuery, SyntaxError, TracerItem} from 'cqlParser/parser';
import { Stack } from 'vendor/immutable';


enum StackOpType {
    PUSH = 'push',
    POP = 'pop',
    POP_FAIL = 'pop-fail',
}

interface StackOp {
    type:StackOpType;
    rule:string;
    lastPos:number;
}

interface CharStyle {
    /**
     * Starting position in source query
     */
    from:number;

    /**
     * Ending position in source query
     */
    to:number;

    /**
     * Rule to apply
     */
    rule:string;
}

/**
 * RuleCharMap applies individual rules to character ranges within
 * the original query. It is perfectly safe to apply different rules
 * multiple times to the same range - in such case, the last application
 * is used.
 */
class RuleCharMap {

    private data:{[k:string]:CharStyle};

    private query:string;

    constructor(query:string) {
        this.query = query;
        this.data = {};
    }

    private mkKey(i:number, j:number):string {
        return `${i}__${j}`;
    }

    set(i:number, j:number, rule:string):void {
        this.data[this.mkKey(i, j)] = {
            from: i,
            to: j,
            rule: rule
        };
    }

    generate():string {
        const ans:Array<CharStyle> = [];
        for (let k in this.data) {
            if (this.data.hasOwnProperty(k)) {
                ans.push(this.data[k]);
            }
        }
        return ans
            .filter(v => v.to <= this.query.length)
            .sort((x1, x2) => x1.from - x2.from)
            .map(v => this.extractTerminal(v.rule, v.from, v.to)).join('');
    }

    private extractTerminal(rule:string, startIdx:number, endIdx:number):string {
        const CLASS_REGEXP = 'sh-regexp';
        const CLASS_ATTR = 'sh-attr';
        const CLASS_KEYWORD = 'sh-keyword';
        const CLASS_OPERATOR = 'sh-operator';
        const CLASS_BRACKETS = 'sh-bracket';
        const CLASS_ERROR = 'sh-error';

        switch (rule) {
            case '_':
                return this.query.substring(startIdx, endIdx)
            case 'RBRACKET':
                return `<span class="${CLASS_BRACKETS}">]</span>`;
            case 'LBRACKET':
                return `<span class="${CLASS_BRACKETS}">[</span>`;
            case 'LSTRUCT':
                return `<span class="${CLASS_BRACKETS}">&lt;</span>`;
            case 'RSTRUCT':
                return `<span class="${CLASS_BRACKETS}">&gt;</span>`;
            case 'RBRACE':
            case 'LBRACE':
            case 'LPAREN':
            case 'RPAREN':
                return `<span class="${CLASS_BRACKETS}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'LETTER':
            case 'LETTER_PHON':
            case 'QUOT':
                return `<span class="${CLASS_REGEXP}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'ATTR':
                return `<span class="${CLASS_ATTR}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'KW_MEET':
            case 'KW_UNION':
            case 'KW_WITHIN':
            case 'KW_CONTAINING':
            case 'KW_MU':
            case 'KW_FREQ':
            case 'KW_WS':
            case 'KW_TERM':
            case 'KW_SWAP':
            case 'KW_CCOLL':
                return `<span class="${CLASS_KEYWORD}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'STAR':
            case 'PLUS':
            case 'QUEST':
            case 'DOT':
            case 'COMMA':
            case 'COLON':
            case 'EQ':
            case 'EEQ':
            case 'TEQ':
            case 'NOT':
            case 'LEQ':
            case 'GEQ':
            case 'SLASH':
            case 'POSNUM':
                return `<span class="${CLASS_OPERATOR}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'BINOR':
            case 'BINAND':
            case 'NUMBER':
            case 'DASH':
            case 'RG_OP':
            case 'RG_ESCAPED':
                return `<span class="${CLASS_OPERATOR}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'SEMI':
            break;
            case 'ENDQ':
            break;
        }
    }
}

/**
 * ParserStack is used along with PEG parser to walk
 * through rules (enter, exit, fail) and build style
 * for input query.
 */
class ParserStack {

    private stack:Array<StackOp>;

    private rcMap:RuleCharMap;

    private lastPos:number;


    constructor(query:string) {
        this.stack = [];
        this.rcMap = new RuleCharMap(query);
        this.lastPos = 0;
    }

    push(rule:string, lastPos:number):void {
        this.stack.push({
            type: StackOpType.PUSH,
            rule: rule,
            lastPos: lastPos
        });
    }

    pop(lastPos:number):void {
        const v = this.stack.pop();
        if (this.isTerminal(v.rule)) {
            if (v.lastPos < lastPos) {
                this.rcMap.set(v.lastPos, lastPos, v.rule);
                this.lastPos = Math.max(this.lastPos, lastPos);
            }
        }
    }

    popFail(rule:string, lastPos:number):void {
        this.stack.pop();
    }

    private isTerminal(rule:string):boolean {
        return !!/^[A-Z_]+$/.exec(rule);
    }

    generate():[string, number] {
        return [this.rcMap.generate(), this.lastPos];
    }
}

function escapeString(v:string):string {
    return v.replace('<', '&lt;').replace('>', '&gt;');
}


export function _highlightSyntax(query:string, queryType:string, he:Kontext.ComponentHelpers, ignoreErrors:boolean):string {
    const BREAK_CHR = query.length > 70 && query.indexOf('\n') === -1 ? '\n' : ' ';

    const startRule = (() => {
        switch (queryType) {
            case 'phrase':
                return 'PhraseQuery';
            case 'word':
            case 'lemma':
                return 'RegExpRaw';
            case 'cql':
                return 'Query';
            default:
                throw new Error(`No parsing rule for type ${queryType}`);
        }
    })();

    const isNonTerminal = (v:string) => {
        return !/^[A-Z_]+$/.exec(v);
    };

    const stack = new ParserStack(query);

    try {
        parseQuery(query + ';', {
            startRule: startRule,
            tracer: {
                trace: (v) => {
                    switch (v.type) {
                        case 'rule.enter':
                            stack.push(v.rule, v.location.start.offset);
                        break;
                        case 'rule.fail':
                            stack.popFail(v.rule, v.location.end.offset);
                        break;
                        case 'rule.match':
                            stack.pop(v.location.end.offset);
                        break;
                    }
                }
            }
        });

    } catch (e) {
        if (!ignoreErrors) {
            throw e;
        }
    }
    const [ans, lastPos] = stack.generate();
    return ans + escapeString(query.substr(lastPos));
}

/**
 * highlightSyntax generates a syntax highlighting
 * for a query by embedding an HTML markup into
 * the resulting string.
 */
export function highlightSyntax(query:string, queryType:string, he:Kontext.ComponentHelpers):string {
    return _highlightSyntax(query, queryType, he, true);
}

export function highlightSyntaxStrict(query:string, queryType:string, he:Kontext.ComponentHelpers):string {
    return _highlightSyntax(query, queryType, he, false);
}