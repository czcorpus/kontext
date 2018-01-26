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

import {parse as parseQuery} from 'cqlParser/parser';

/**
 * highlightSyntax generates a syntax highlighting
 * for a query by embedding an HTML markup into
 * the resulting string.
 */
export function highlightSyntax(query:string, queryType:string):string {

    const chars:Array<string> = [];
    const CLASS_REGEXP = 'sh-regexp';
    const CLASS_ATTR = 'sh-attr';
    const CLASS_KEYWORD = 'sh-keyword';
    const CLASS_OPERATOR = 'sh-operator';
    const CLASS_BRACKETS = 'sh-bracket';

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

    parseQuery(query + ';', {
        startRule: startRule,
        tracer: {
            trace: (v) => {
                if (v.type === 'rule.match') {
                    switch (v.rule) {
                        case '_':
                            if (v.location.start.offset < v.location.end.offset) {
                                if (chars.length === 0 || !/\s+/.exec(chars[chars.length - 1])) {
                                    chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                                }
                            }
                        break;
                        case 'RBRACKET':
                            chars.push(`<span class="${CLASS_BRACKETS}">]</span>`);
                            chars.push(BREAK_CHR);
                        break;
                        case 'LBRACKET':
                            chars.push(`<span class="${CLASS_BRACKETS}">`);
                            chars.push('[');
                            chars.push('</span>');
                        break;
                        case 'LSTRUCT':
                        case 'RSTRUCT':
                        case 'RBRACE':
                        case 'LBRACE':
                        case 'LPAREN':
                        case 'RPAREN':
                            chars.push(`<span class="${CLASS_BRACKETS}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
                        case 'LETTER':
                        case 'QUOT':
                            chars.push(`<span class="${CLASS_REGEXP}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
                        case 'ATTR':
                            chars.push(`<span class="${CLASS_ATTR}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
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
                            chars.push(`<span class="${CLASS_KEYWORD}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
                        case 'STAR':
                        case 'PLUS':
                        case 'QUEST':
                        case 'DOT':
                        case 'COMMA':
                        case 'SEMI':
                        case 'COLON':
                        case 'EQ':
                        case 'EEQ':
                        case 'TEQ':
                        case 'NOT':
                        case 'LEQ':
                        case 'GEQ':
                        case 'SLASH':
                        case 'POSNUM':
                            chars.push(`<span class="${CLASS_OPERATOR}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
                        case 'BINOR':
                        case 'BINAND':
                        case 'NUMBER':
                        case 'DASH':
                        case 'RG_OP':
                        case 'RG_ESCAPED':
                            chars.push(`<span class="${CLASS_OPERATOR}">`);
                            chars.push(query.substring(v.location.start.offset, v.location.end.offset));
                            chars.push('</span>');
                        break;
                    }
                }
            }
        }
    });
    return chars.slice(0, chars.length - 1).join('');
}