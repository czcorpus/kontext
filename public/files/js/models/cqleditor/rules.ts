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

import * as Kontext from '../../types/kontext';
import { IAttrHelper } from './attrs';
import { List, tuple, pipe, Dict } from 'cnc-tskit';
import { TokenSuggestions } from '../query/query';


/**
 * CharsRule represents a pointer to the original
 * CQL query specifying a single rule applied to a
 * specific substring of the query.
 */
 export interface CharsRule {
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
 * StyledChunk represents an already styled
 * piece of the query.
 */
interface StyledChunk {
    from:number;
    to:number;
    value:string; // orig value
    htmlValue:string;
}


export interface ParsedAttr {
    name:string;
    value:string;
    type:'posattr'|'struct'|'structattr';
    children:Array<ParsedAttr>;
    rangeVal:[number, number];
    rangeAttr:[number, number]|null; // if null then simplified form is expected (e.g. "foo")
    rangeAll:[number, number];
    suggestions:TokenSuggestions|null;
}

export interface ParsedPQItem {
    query:string;
    limit:number;
    type:Kontext.PqueryExpressionRoles;
}


/**
 * RuleCharMap applies individual rules to character ranges within
 * the original query. It is perfectly safe to apply different rules
 * multiple times to the same range - in such case, the last application
 * is used.
 */
 export class RuleCharMap {

    private data:{[k:string]:CharsRule};

    private nonTerminals:Array<CharsRule>;

    private readonly query:string;

    private readonly he:Kontext.Translator;

    private wrapLongQuery:boolean;

    private readonly attrHelper:IAttrHelper;

    private posCounter:number;

    private readonly wrapRange:(startIdx:number, endIdx:number)=>[string, string];

    constructor(
        query:string,
        he:Kontext.Translator,
        attrHelper:IAttrHelper,
        wrapLongQuery:boolean,
        wrapRange:(startIdx:number, endIdx:number)=>[string, string],
    ) {

        this.query = query;
        this.data = {};
        this.nonTerminals = [];
        this.he = he;
        this.attrHelper = attrHelper;
        this.wrapLongQuery = wrapLongQuery;
        this.wrapRange = wrapRange;
        this.posCounter = 0;
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

    private containsNonTerminal(from:number, to:number, rule:string):boolean {
        for (let i = 0; i < this.nonTerminals.length; i += 1) {
            if (this.nonTerminals[i].from === from &&
                    this.nonTerminals[i].to === to &&
                    this.nonTerminals[i].rule === rule) {
                return true;
            }
        }
        return false;
    }

    addNonTerminal(i:number, j:number, rule:string):void {
        if (!this.containsNonTerminal(i, j, rule)) {
            this.nonTerminals.push({
                from: i,
                to: j,
                rule: rule
            });
        }
    }

    /**
     * convertRange converts a range from original CQL query (i.e. [left char position,
     * right char position]) to the one within chunked (and styled) pieces of the query
     * ('chunks' arg).
     */
    private convertRange(i1:number, i2:number, chunks:Array<StyledChunk>):[number, number] {
        let ansLeft:number = -1;
        let ansRight:number = -1;

        for (let i = 0; i < chunks.length; i += 1) {
            if (chunks[i].from === i1 && ansLeft === -1) {
                ansLeft = i;
            }
            if (chunks[i].to === i2 && ansRight === -1) {
                ansRight = i;
            }
        }
        return [ansLeft, ansRight];
    }

    private findRuleInRange(rule:string, i1:number, i2:number):Array<CharsRule> {
        const ans:Array<CharsRule> = [];
        for (let i = 0; i < this.nonTerminals.length; i += 1) {
            if (this.nonTerminals[i].rule === rule &&
                    this.nonTerminals[i].from >= i1 &&
                    this.nonTerminals[i].to <= i2) {
                ans.push(this.nonTerminals[i]);
            }
        }
        return ans;
    }

    private findAnyRuleInRange(rules:Array<string>, i1:number, i2:number):Array<CharsRule> {
        const ans:Array<CharsRule> = [];
        for (let i = 0; i < this.nonTerminals.length; i += 1) {
            if (List.find(r => r === this.nonTerminals[i].rule, rules) &&
                    this.nonTerminals[i].from >= i1 &&
                    this.nonTerminals[i].to <= i2) {
                ans.push(this.nonTerminals[i]);
            }
        }
        return ans;
    }

    private findSubRuleSeqIn(ruleSeq:Array<string>, i1:number, i2:number):Array<CharsRule> {
        const tmp = List.foldl(
            (acc, nt) => nt.rule === ruleSeq[List.size(acc)] && nt.from >= i1 && nt.to <= i2 ?
                    List.push(nt, acc) : acc,
            [] as Array<CharsRule>,
            this.nonTerminals
        );
        return List.size(tmp) === List.size(ruleSeq) ? tmp : [];
    }

    private createClickableTag(type:string, args:Kontext.GeneralProps, title:string=null):string {
        const argsStr = Object.keys(args).map(k => `data-${k}="${args[k]}"`).join(' ');
        return `<a class="sh-value-clickable" data-type="${type}" ${argsStr} title="${title}">`;
    }

    private ruleToSubstring(r:CharsRule):string {
        return this.query.substring(r.from, r.to);
    }

    private stripFirstAndLast(s:string):string {
        return s.substring(1, s.length - 1);
    }

    private extractPQLimit(r:CharsRule):number {
        const rule = this.findRuleInRange('PQLimit', r.from, r.to);
        if (!List.empty(rule)) {
            return parseFloat(this.ruleToSubstring(List.head(rule)));
        }
        return 0;
    }

    private extractEntities():[Array<ParsedAttr>, Array<ParsedPQItem>] {
        const accInit:[Array<ParsedAttr>, Array<ParsedPQItem>] = [[], []];
        return pipe(
            this.nonTerminals,
            List.foldl(
                ([parsedAttrs, parsedPQItems], curr) => {
                    switch (curr.rule) {
                        case 'OnePosition':
                            return tuple(
                                pipe(
                                    this.findRuleInRange('AttVal', curr.from, curr.to),
                                    List.map(paRule => {
                                        const nameSrch = this.findRuleInRange('AttName', paRule.from, paRule.to);
                                        const valSrch = this.findAnyRuleInRange(['RegExpRaw', 'SimpleString'], paRule.from, paRule.to);
                                        if (List.size(nameSrch) === 1 && List.size(valSrch) === 1) {
                                            return tuple(List.head(nameSrch), List.head(valSrch));
                                        }
                                        return null;
                                    }),
                                    List.map<[CharsRule, CharsRule], ParsedAttr>(([nameRule, valueRule]) => ({
                                        name: this.ruleToSubstring(nameRule),
                                        value: this.ruleToSubstring(valueRule),
                                        type: 'posattr',
                                        children: [],
                                        rangeVal: tuple(valueRule.from, valueRule.to),
                                        rangeAttr: tuple(nameRule.from, nameRule.to),
                                        rangeAll: tuple(nameRule.from, valueRule.to),
                                        suggestions: null
                                    })),
                                    List.concatr(parsedAttrs)
                                ),
                                parsedPQItems
                            );
                        case 'Structure': {
                            const children = pipe(
                                this.findRuleInRange('AttVal', curr.from, curr.to),
                                List.map(
                                    saRule => {
                                        const nameSrch = this.findRuleInRange('AttName', saRule.from, saRule.to);
                                        const valSrch = this.findRuleInRange('RegExpRaw', saRule.from, saRule.to);
                                        if (List.size(nameSrch) === 1 && List.size(valSrch) === 1) {
                                            return tuple(List.head(nameSrch), List.head(valSrch));
                                        }
                                        return null;
                                    }
                                ),
                                List.filter(v => v !== null),
                                List.map<[CharsRule, CharsRule], ParsedAttr>(([nameRule, valueRule]) => ({
                                    name: this.ruleToSubstring(nameRule),
                                    value: this.ruleToSubstring(valueRule),
                                    type: 'structattr',
                                    children: [],
                                    rangeVal: tuple(valueRule.from, valueRule.to),
                                    rangeAttr: tuple(nameRule.from, nameRule.to),
                                    rangeAll: tuple(nameRule.from, valueRule.to),
                                    suggestions: null
                                }))
                            );
                            const nameSrch = this.findRuleInRange('AttName', curr.from, curr.to);
                            return tuple(
                                List.push(
                                    {
                                        name: this.ruleToSubstring(List.head(nameSrch)),
                                        value: null,
                                        type: 'struct',
                                        children,
                                        rangeVal: null,
                                        rangeAttr: tuple(curr.from, curr.to),
                                        rangeAll: tuple(curr.from, curr.to),
                                        suggestions: null
                                    },
                                    parsedAttrs
                                ),
                                parsedPQItems
                            );
                        }
                        case 'PQType':
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                tuple(
                                    parsedAttrs,
                                    List.push(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: undefined,
                                            type: 'specification'
                                        },
                                        parsedPQItems
                                    )
                                ) :
                                tuple(parsedAttrs, parsedPQItems);
                        case 'PQAlways': {
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                tuple(
                                    parsedAttrs,
                                    List.push<ParsedPQItem>(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: this.extractPQLimit(curr),
                                            type: 'superset'
                                        },
                                        parsedPQItems
                                    )
                                ) :
                                tuple(parsedAttrs, parsedPQItems);
                        }
                        case 'PQNever': {
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                tuple(
                                    parsedAttrs,
                                    List.push<ParsedPQItem>(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: this.extractPQLimit(curr),
                                            type: 'subset'
                                        },
                                        parsedPQItems
                                    )
                                ) :
                                tuple(parsedAttrs, parsedPQItems);
                        }
                        default:
                            return tuple(parsedAttrs, parsedPQItems);
                    }
                },
                accInit
            )
        );
    }

    private colorizeSyntax():string {
        const chunks = pipe(
            this.data,
            Dict.values(),
            List.filter(v => v.to <= this.query.length),
            List.sortedBy(v => v.from),
            // we must get rid of incorrectly detected "nested" terminals (this applies for incomplete expressions)
            List.foldl<CharsRule, [number, Array<CharsRule>]>(
                ([maxPos, acc], curr) => curr.to < maxPos ?
                        tuple(maxPos, acc) :
                        tuple(curr.to, List.push(curr, acc)),
                tuple(0, [])
            ),
            ([, acc]) => acc,
            List.map(v => ({
                value: this.ruleToSubstring(v),
                htmlValue: this.emitTerminal(v.rule, v.from, v.to),
                from: v.from,
                to: v.to
            }))
        );
        if (List.size(chunks) > 1 && List.last(chunks).to < List.last(List.init(chunks)).to) {

        }
        // 'inserts' contains values (= HTML tags) inserted
        // before matching 'result' items. I.e. 0th item
        // from 'inserts' is inserted before 0th item from 'result'
        // and n-th item from 'inserts' is inserted to the end
        const inserts:Array<Array<string>> = List.repeat(_ => [], chunks.length + 1);
        pipe(
            this.nonTerminals,
            List.reversed(),
            List.forEach(nonTerm => {
                switch (nonTerm.rule) {
                    case 'Position':
                        this.findRuleInRange('AttVal', nonTerm.from, nonTerm.to).forEach(attVal => {
                            this.findRuleInRange('AttName', attVal.from, attVal.to).forEach(pa => {
                                const range = this.convertRange(pa.from, pa.to, chunks);
                                const posAttrName = this.ruleToSubstring(pa);
                                if (this.attrHelper.attrExists(posAttrName)) {
                                    inserts[range[0]].push(`<span title="${this.he.translate('query__posattr')}">`);
                                    inserts[range[1]+1].push('</span>');
                                }

                                const posAttrValueRule = this.findSubRuleSeqIn(['AttName', 'RegExp'], attVal.from, attVal.to);
                                if (posAttrValueRule.length > 0) {
                                    if (this.attrHelper.isTagAttr(posAttrName)) {
                                        const range = this.convertRange(posAttrValueRule[1].from, posAttrValueRule[1].to, chunks);
                                        inserts[range[0]].push(this.createClickableTag(
                                            'tag',
                                            {
                                                leftIdx: posAttrValueRule[1].from,
                                                rightIdx: posAttrValueRule[1].to
                                            },
                                            this.he.translate('query__click_to_edit_tag')
                                        ));
                                        inserts[range[1]+1].push('</a>');

                                    } else if (this.wrapRange) {
                                        const range = this.convertRange(posAttrValueRule[1].from, posAttrValueRule[1].to, chunks);
                                        const [begTag, endTag] = this.wrapRange(posAttrValueRule[1].from + 1, posAttrValueRule[1].to - 1);
                                        if (begTag && endTag) {
                                            inserts[range[0]].push(begTag);
                                            inserts[range[1]+1].push(endTag);
                                        }
                                    }
                                }
                            });
                        });
                        if (this.wrapLongQuery && this.posCounter % 3 == 0) {
                            const range = this.convertRange(nonTerm.from, nonTerm.to, chunks);
                            if (Array.isArray(inserts[range[0]]) && List.size(inserts[range[0]]) > 0) {
                                inserts[range[0]].push('<br />');
                            }
                        }
                        this.posCounter += 1;
                    break;
                    case 'Structure':
                        const attrNamesInStruct = this.findRuleInRange('AttName', nonTerm.from, nonTerm.to);
                        const structTmp = attrNamesInStruct[attrNamesInStruct.length - 1];
                        const structRange = this.convertRange(structTmp.from, structTmp.to, chunks);
                        const structName = this.ruleToSubstring(structTmp);
                        if (this.attrHelper.structExists(structName)) {
                            inserts[structRange[0]].push(`<span title="${this.he.translate('query__structure')}">`);
                            inserts[structRange[1]+1].push('</span>');
                        }
                        attrNamesInStruct.reverse();
                        attrNamesInStruct.slice(1).forEach((sa, i, arr) => {
                            const range = this.convertRange(sa.from, sa.to, chunks);
                            const structAttrName = this.ruleToSubstring(sa);
                            if (this.attrHelper.structAttrExists(structName, structAttrName)) {
                                inserts[range[0]].push(`<span title="${this.he.translate('query__structattr')}">`);
                                inserts[range[1]+1].push('</span>');
                            }
                        });
                    break;
                    case 'WithinContainingPart':
                        if (this.wrapLongQuery) {
                            const range = this.convertRange(nonTerm.from, nonTerm.to, chunks);
                            inserts[range[0]].push('<br />');
                        }
                    break;
                    case 'RgLookOperator': {
                        const range = this.convertRange(nonTerm.from, nonTerm.to, chunks);
                        inserts[range[0]].push(`<span class="rg-look-operator">`);
                        inserts[range[1]+1].push('</span>');
                    }
                    break;
                }
            })
        );
        const ans:Array<string> = [];
        for (let i = 0; i < chunks.length; i += 1) {
            inserts[i].forEach(v => ans.push(v));
            ans.push(chunks[i].htmlValue);
        }
        inserts[inserts.length - 1].forEach(v => ans.push(v));
        return ans.join('');
    }

    generate():[string, Array<ParsedAttr>, Array<ParsedPQItem>] {
        return tuple(this.colorizeSyntax(), ...this.extractEntities());
    }

    private emitTerminal(rule:string, startIdx:number, endIdx:number):string {
        const CLASS_REGEXP = 'sh-regexp';
        const CLASS_ATTR = 'sh-attr';
        const CLASS_KEYWORD = 'sh-keyword';
        const CLASS_OPERATOR = 'sh-operator';
        const CLASS_BRACKETS = 'sh-bracket';
        const CLASS_ERROR = 'sh-error';

        switch (rule) {
            case '_':
                return this.query.substring(startIdx, endIdx);
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
            case 'RG_AMP':
                return `<span class="${CLASS_REGEXP}">&amp;</span>`;
            case 'LETTER':
            case 'LETTER_PHON':
            case 'RG_NON_LETTER':
            case 'RG_NON_SPEC':
            case 'QUOT':
                return `<span class="${CLASS_REGEXP}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'ASCII_LETTERS':
            case 'ATTR_CHARS':
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
            case 'NNUMBER':
            case 'DASH':
            case 'RG_OP':
            case 'RG_ESCAPED':
            case 'NO_RG_SPEC':
            case 'NO_RG_ESCAPED':
                return `<span class="${CLASS_OPERATOR}">${this.query.substring(startIdx, endIdx)}</span>`;
            case 'SEMI':
            break;
            case 'ENDQ':
            break;
        }
    }
}

