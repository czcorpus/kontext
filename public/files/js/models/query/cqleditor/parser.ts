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

import * as Kontext from '../../../types/kontext';
import { parse as parseQuery, SyntaxError } from 'cqlParser/parser';
import { IAttrHelper, NullAttrHelper } from './attrs';
import { List, tuple, pipe, Dict } from 'cnc-tskit';
import { TokenSuggestions } from '../query';

/**
 * CharsRule represents a pointer to the original
 * CQL query specifying a single rule applied to a
 * specific substring of the query.
 */
interface CharsRule {
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
class RuleCharMap {

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

    generate():[string, Array<ParsedAttr>, Array<ParsedPQItem>] {
        const chunks = pipe(
            this.data,
            Dict.values(),
            List.filter(v => v.to <= this.query.length),
            List.sortedBy(v => v.from),
            List.map(v => ({
                value: this.ruleToSubstring(v),
                htmlValue: this.emitTerminal(v.rule, v.from, v.to),
                from: v.from,
                to: v.to
            }))
        );
        // 'inserts' contains values (= HTML tags) inserted
        // before matching 'result' items. I.e. 0th item
        // from 'inserts' is inserted before 0th item from 'result'
        // and n-th item from 'inserts' is inserted to the end
        const inserts = List.repeat(_ => [], chunks.length + 1);
        const [codeTokens, parsedAttrs, pqItems] = this.applyNonTerminals(chunks, inserts);
        return tuple(codeTokens.join(''), parsedAttrs, pqItems);
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

    private findSubRuleSeqIn(ruleSeq:Array<string>, i1:number, i2:number):Array<CharsRule> {
        const ans:Array<CharsRule> = [];
        let ruleIdx = 0;
        for (let i = this.nonTerminals.length - 1; i >= 0; i -= 1) {
            if ((this.nonTerminals[i].rule === ruleSeq[ruleIdx]) &&
                    this.nonTerminals[i].from >= i1 &&
                    this.nonTerminals[i].to <= i2) {
                ans.push(this.nonTerminals[i]);
                ruleIdx += 1;
                if (ruleSeq.length === ruleIdx) {
                    break;
                }
            }
        }
        return ruleIdx === ruleSeq.length ? ans : [];
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

    private applyNonTerminals(
        chunks:Array<StyledChunk>,
        inserts:Array<Array<string>>
    ):[Array<string>, Array<ParsedAttr>, Array<ParsedPQItem>] {

        const accInit:{
            parsedAttrs:Array<ParsedAttr>;
            pqItems:Array<ParsedPQItem>;
        } = {parsedAttrs: [], pqItems: []};

        const {parsedAttrs, pqItems} = pipe(
            this.nonTerminals,
            List.foldl(
                (acc, curr) => {
                    switch (curr.rule) {
                        case 'OnePosition':
                            return {
                                ...acc,
                                parsedAttrs: pipe(
                                    this.findRuleInRange('AttVal', curr.from, curr.to),
                                    List.map(paRule => {
                                        const nameSrch = this.findRuleInRange('AttName', paRule.from, paRule.to);
                                        const valSrch = this.findRuleInRange('RegExpRaw', paRule.from, paRule.to);
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
                                    List.concatr(acc.parsedAttrs)
                                )
                            };
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
                            return {
                                ...acc,
                                parsedAttrs: List.push({
                                    name: this.ruleToSubstring(List.head(nameSrch)),
                                    value: null,
                                    type: 'struct',
                                    children,
                                    rangeVal: null,
                                    rangeAttr: tuple(curr.from, curr.to),
                                    rangeAll: tuple(curr.from, curr.to),
                                    suggestions: null
                                }, acc.parsedAttrs)
                            };
                        }
                        case 'PQType':
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                {
                                    ...acc,
                                    pqItems: List.push(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: undefined,
                                            type: 'specification'
                                        },
                                        acc.pqItems)
                                } :
                                acc;
                        case 'PQAlways': {
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                {
                                    ...acc,
                                    pqItems: List.push<ParsedPQItem>(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: this.extractPQLimit(curr),
                                            type: 'superset'
                                        },
                                        acc.pqItems)
                                } :
                                acc;
                        }
                        case 'PQNever': {
                            const q = this.findRuleInRange('Query', curr.from, curr.to);
                            return !List.empty(q) ?
                                {
                                    ...acc,
                                    pqItems: List.push<ParsedPQItem>(
                                        {
                                            query: this.ruleToSubstring(List.head(q)),
                                            limit: this.extractPQLimit(curr),
                                            type: 'subset'
                                        },
                                        acc.pqItems)
                                } :
                                acc;
                        }
                        default:
                            return acc;
                    }
                },
                accInit
            )
        );

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
        return tuple(ans, parsedAttrs, pqItems);
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
 * through rules (enter, exit, fail) and insert rule
 * marks to the query via RuleCharMap instance.
 */
class ParserStack {

    private stack:Array<{rule:string; lastPos:number}>;

    private rcMap:RuleCharMap;

    private lastPos:number;


    constructor(rcMap:RuleCharMap) {
        this.stack = [];
        this.rcMap = rcMap;
        this.lastPos = 0;
    }

    push(rule:string, lastPos:number):void {
        this.stack.push({
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

        } else {
            this.rcMap.addNonTerminal(v.lastPos, lastPos, v.rule);
        }
    }

    popFail(rule:string, lastPos:number):void {
        this.stack.pop();
    }

    private isTerminal(rule:string):boolean {
        return !!/^[A-Z_]+$/.exec(rule);
    }

    getLastPos():number {
        return this.lastPos;
    }
}


const escapeQuery = (v:string):string => {
    return v.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};


interface HSArgs {
    query:string;
    applyRules:Array<string>;
    he:Kontext.Translator;
    ignoreErrors:boolean;
    attrHelper:IAttrHelper;
    parserRecoverIdx:number;
    wrapLongQuery:boolean;
    wrapRange:(startIdx:number, endIdx:number)=>[string, string];
}


function _highlightSyntax({query, applyRules, he, ignoreErrors, attrHelper, parserRecoverIdx,
            wrapLongQuery, wrapRange}:HSArgs):[string, Array<ParsedAttr>, Array<ParsedPQItem>, string] {

    const rcMap = new RuleCharMap(query, he, attrHelper, wrapLongQuery, wrapRange);
    const stack = new ParserStack(rcMap);

    const wrapUnrecognizedPart = (v:string, numParserRecover:number, error:SyntaxError):[string, string|undefined] => {
        if (numParserRecover === 0 && error) {
            const title = he.translate(
                'query__unrecognized_input_{wrongChar}{position}',
                {
                    wrongChar: error.found,
                    position: error.location.start.column
                }
            );
            const style = 'text-decoration: underline dotted red';
            return tuple(
                `<span title="${escapeQuery(title)}" style="${style}">` + escapeQuery(v) + '</span>',
                title
            );

        }
        return tuple(escapeQuery(v), undefined);
    }

    let parseError:SyntaxError = null;
    try {
        parseQuery(query, {
            startRule: applyRules[0],
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
        parseError = e;
        if (!ignoreErrors) {
            throw e;
        }
    }

    const lastPos = stack.getLastPos();
    const [ans, parsedAttrs, pqItems] = rcMap.generate();

    if (query.length === 0) {
        return tuple('', [], [], undefined);

    } else if (lastPos < query.length && applyRules.length > 1) {
        // try to apply a partial rule to the rest of the query
        const srch = /^([^\s]+|)(\s+)(.+)$/.exec(query.substr(lastPos));
        if (srch !== null) {
            const [partial, parsedAttrs] = _highlightSyntax({
                query: srch[3],
                applyRules: srch[1].trim() !== '' ? applyRules.slice(1) : applyRules,
                he: he,
                ignoreErrors: true,
                attrHelper,
                wrapLongQuery: false,
                wrapRange,
                parserRecoverIdx: parserRecoverIdx + 1
            });

            const [subQueryHighlight, err] = wrapUnrecognizedPart(srch[1] + srch[2], parserRecoverIdx, parseError);
            return tuple(
                ans + subQueryHighlight + partial,
                parsedAttrs,
                pqItems,
                err
            );
        }
    }
    const [subQueryHighlight, err] = wrapUnrecognizedPart(query.substr(lastPos), parserRecoverIdx, parseError);
    return tuple(
        ans + (query.substr(lastPos).length > 0 ? subQueryHighlight : ''),
        parsedAttrs,
        pqItems,
        query.length > lastPos ? err : undefined
    );
}

export function getApplyRules(querySuperType:Kontext.QuerySupertype):Array<string> {
    switch (querySuperType) {
        case 'pquery':
            return ['PQuery', 'Query', 'WithinContainingPart', 'Sequence', 'RegExpRaw'];
        case 'conc':
            return ['Query', 'WithinContainingPart', 'Sequence', 'RegExpRaw'];
        case 'wlist':
            return ['RegExpRaw'];
    }
}

/**
 * highlightSyntax generates a syntax highlighting
 * for a query by embedding an HTML markup into
 * the resulting string.
 *
 * @return a 4-tuple (highlighted query, list of detected attributes, list of detected Paradigm. query blocks, syntax error)
 */
export function highlightSyntax(
    {
        query, querySuperType, he, attrHelper, wrapRange
    }:{
        query:string,
        querySuperType:Kontext.QuerySupertype,
        he:Kontext.ComponentHelpers,
        attrHelper:IAttrHelper,
        wrapRange:((startIdx:number, endIdx:number)=>[string, string])|undefined,
    }):[string, Array<ParsedAttr>, Array<ParsedPQItem>, string] {

    return _highlightSyntax({
        query: query,
        applyRules: getApplyRules(querySuperType),
        he: he,
        ignoreErrors: true,
        attrHelper: attrHelper ? attrHelper : new NullAttrHelper(),
        wrapLongQuery: false,
        wrapRange,
        parserRecoverIdx: 0
    });
}

/**
 *
 * @return a 4-tuple (highlighted query, list of detected attributes, list of detected Paradigm. query blocks, syntax error)
 */
export function highlightSyntaxStatic(
    {query, querySuperType, he}:{
        query:string,
        querySuperType:Kontext.QuerySupertype,
        he:Kontext.Translator
    }):[string, Array<ParsedAttr>, Array<ParsedPQItem>, string] {

    return _highlightSyntax({
        query: query,
        applyRules: getApplyRules(querySuperType),
        he: he,
        ignoreErrors: true,
        attrHelper: new NullAttrHelper(),
        wrapLongQuery: true,
        wrapRange: undefined,
        parserRecoverIdx: 0
    });
}