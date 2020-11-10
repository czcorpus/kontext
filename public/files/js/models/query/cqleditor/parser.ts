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

import { Kontext} from '../../../types/common';
import { parse as parseQuery, SyntaxError } from 'cqlParser/parser';
import { IAttrHelper, NullAttrHelper } from './attrs';
import { List, tuple, pipe } from 'cnc-tskit';
import { QueryType, TokenSuggestions } from '../query';

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
    rangeVal:[number, number];
    rangeAttr:[number, number]|null; // if null then simplified form is expected (e.g. "foo")
    rangeAll:[number, number];
    suggestions:TokenSuggestions|null;
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

    private readonly onHintChange:(message:string)=>void;

    private readonly wrapRange:(startIdx:number, endIdx:number)=>[string, string];

    constructor(
        query:string,
        he:Kontext.Translator,
        attrHelper:IAttrHelper,
        wrapLongQuery:boolean,
        wrapRange:(startIdx:number, endIdx:number)=>[string, string],
        onHintChange:(message:string)=>void
    ) {

        this.query = query;
        this.data = {};
        this.nonTerminals = [];
        this.he = he;
        this.attrHelper = attrHelper;
        this.wrapLongQuery = wrapLongQuery;
        this.wrapRange = wrapRange;
        this.onHintChange = onHintChange;
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

    generate():[string, Array<ParsedAttr>] {
        const rulePointers:Array<CharsRule> = [];
        for (let k in this.data) {
            if (this.data.hasOwnProperty(k)) {
                rulePointers.push(this.data[k]);
            }
        }
        const chunks = rulePointers
            .filter(v => v.to <= this.query.length)
            .sort((x1, x2) => x1.from - x2.from)
            .map(v => ({
                value: this.ruleToSubstring(v),
                htmlValue: this.emitTerminal(v.rule, v.from, v.to),
                from: v.from,
                to: v.to
            }));
        // 'inserts' contains values (= HTML tags) inserted
        // before matching 'result' items. I.e. 0th item
        // from 'inserts' is inserted before 0th item from 'result'
        // and n-th item from 'inserts' is inserted to the end
        const inserts = chunks.concat(null).map(_ => []);
        const [codeTokens, parsedAttrs] = this.applyNonTerminals(chunks, inserts);
        return tuple(codeTokens.join(''), parsedAttrs);
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

    private findSubRuleIn(rule:string, i1:number, i2:number):Array<CharsRule> {
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

    private applyNonTerminals(
        chunks:Array<StyledChunk>,
        inserts:Array<Array<string>>
    ):[Array<string>, Array<ParsedAttr>] {

        const accInit:{
            parsedAttrs:Array<ParsedAttr>;
            lastAttName:CharsRule|null;
        } = {parsedAttrs: [], lastAttName: null};
        const errors:Array<string> = [];

        const {parsedAttrs} = pipe(
            this.nonTerminals,
            List.foldl(
                (acc, curr) => {
                    switch (curr.rule) {
                        case 'AtomQuery':
                            const regexp = List.find(
                                v => this.ruleToSubstring(v) === this.ruleToSubstring(curr),
                                this.findSubRuleIn('RegExp', curr.from, curr.to)
                            );
                            return regexp ?
                                {
                                    ...acc,
                                    parsedAttrs: acc.parsedAttrs.concat([{
                                        name: null,
                                        value: this.stripFirstAndLast(this.ruleToSubstring(curr)),
                                        type: 'posattr',
                                        rangeVal: tuple(regexp.from + 1, regexp.to - 1), // +/- 1 <- quotes
                                        rangeAll: tuple(regexp.from + 1, regexp.to - 1), // +/- 1 <- quotes
                                        rangeAttr: null,
                                        suggestions: null
                                    }])
                                } :
                                {...acc};
                        case 'Structure':
                            return {...acc, lastAttName: null};
                        case 'Repetition':
                            return {...acc, lastAttName: null};
                        case 'AttName':
                            return {...acc, lastAttName: curr};
                        case 'RegExpRaw':
                            return acc.lastAttName ?
                                {
                                    ...acc,
                                    parsedAttrs: acc.parsedAttrs.concat([{
                                        name: this.ruleToSubstring(acc.lastAttName),
                                        value: this.ruleToSubstring(curr),
                                        type: 'posattr',
                                        rangeVal: tuple(curr.from, curr.to),
                                        rangeAttr: tuple(acc.lastAttName.from, acc.lastAttName.to),
                                        rangeAll: tuple(acc.lastAttName.from, curr.to),
                                        suggestions: null
                                    }])
                                } :
                                {...acc};
                        default:
                            return acc;
                    }
                },
                accInit
            )
        );

        this.nonTerminals.reverse().forEach(v => {
            switch (v.rule) {
                case 'Position':
                    this.findSubRuleIn('AttVal', v.from, v.to).forEach(attVal => {
                        this.findSubRuleIn('AttName', attVal.from, attVal.to).forEach(pa => {
                            const range = this.convertRange(pa.from, pa.to, chunks);
                            const posAttrName = this.ruleToSubstring(pa);
                            if (this.attrHelper.attrExists(posAttrName)) {
                                inserts[range[0]].push(`<span title="${this.he.translate('query__posattr')}">`);
                                inserts[range[1]+1].push('</span>');

                            } else {
                                errors.push(`${this.he.translate('query__attr_does_not_exist')}: <strong>${posAttrName}</strong>`);
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
                        const range = this.convertRange(v.from, v.to, chunks);
                        inserts[range[0]].push('<br />');
                    }
                    this.posCounter += 1;
                break;
                case 'Structure':
                    const attrNamesInStruct = this.findSubRuleIn('AttName', v.from, v.to);
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

                        } else {
                            errors.push(`${this.he.translate('query__structattr_does_not_exist')}: <strong>${structName}.${structAttrName}</strong>`);
                        }
                    });
                break;
                case 'WithinContainingPart':
                    if (this.wrapLongQuery) {
                        const range = this.convertRange(v.from, v.to, chunks);
                        inserts[range[0]].push('<br />');
                    }
                break;
                case 'OpenStructTag':
                case 'CloseStructTag': {
                    const attrNamesInStruct = this.findSubRuleIn('AttName', v.from, v.to);
                    const structTmp = attrNamesInStruct[attrNamesInStruct.length - 1];
                    const structName = this.ruleToSubstring(structTmp);
                    if (!this.attrHelper.structExists(structName)) {
                        errors.push(`${this.he.translate('query__struct_does_not_exist')}: <strong>${structName}</strong>`);
                    }
                }
                break;
            }
        });
        if (errors.length > 0) {
            this.onHintChange('<strong>\u26A0</strong>\u00a0' + errors.join('<br />'));

        } else {
            this.onHintChange(null);
        }
        const ans:Array<string> = [];
        for (let i = 0; i < chunks.length; i += 1) {
            inserts[i].forEach(v => ans.push(v));
            ans.push(chunks[i].htmlValue);
        }
        inserts[inserts.length - 1].forEach(v => ans.push(v));
        return tuple(ans, parsedAttrs);
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
    onHintChange:(message:string)=>void;
    wrapRange:(startIdx:number, endIdx:number)=>[string, string];
}


function _highlightSyntax({query, applyRules, he, ignoreErrors, attrHelper, parserRecoverIdx,
            wrapLongQuery, wrapRange, onHintChange}:HSArgs):[string, Array<ParsedAttr>] {

    const rcMap = new RuleCharMap(query, he, attrHelper, wrapLongQuery, wrapRange, onHintChange);
    const stack = new ParserStack(rcMap);

    const wrapUnrecognizedPart = (v:string, numParserRecover:number, error:SyntaxError):string => {
        if (numParserRecover === 0 && error) {
            const title = he.translate(
                'query__unrecognized_input_{wrongChar}{position}',
                {
                    wrongChar: error.found,
                    position: error.location.start.column
                }
            );
            const style = 'text-decoration: underline dotted red';
            return `<span title="${escapeQuery(title)}" style="${style}">` + escapeQuery(v) + '</span>';
        }
        return escapeQuery(v);
    }

    let parseError:SyntaxError = null;
    try {
        parseQuery(query + (applyRules[0] === 'Query' ? ';' : ''), {
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
    const [ans, parsedAttrs] = rcMap.generate();

    if (query.length === 0) {
        return tuple('', []);

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
                onHintChange,
                parserRecoverIdx: parserRecoverIdx + 1
            });

            return tuple(
                ans + wrapUnrecognizedPart(srch[1] + srch[2], parserRecoverIdx, parseError) + partial,
                parsedAttrs
            );
        }
    }
    return tuple(
        ans + (query.substr(lastPos).length > 0 ? wrapUnrecognizedPart(query.substr(lastPos), parserRecoverIdx, parseError) : ''),
        parsedAttrs
    );
}

function getApplyRules(queryType:QueryType):Array<string> {
    switch (queryType) {
        case 'advanced':
            return ['Query', 'WithinContainingPart', 'Sequence', 'RegExpRaw'];
        default:
            throw new Error(`No parsing rule for type ${queryType}`);
    }
}

/**
 * highlightSyntax generates a syntax highlighting
 * for a query by embedding an HTML markup into
 * the resulting string.
 */
export function highlightSyntax(
        query:string,
        queryType:QueryType,
        he:Kontext.ComponentHelpers,
        attrHelper:IAttrHelper,
        wrapRange:((startIdx:number, endIdx:number)=>[string, string])|undefined,
        onHintChange:(message:string)=>void):[string, Array<ParsedAttr>] {

    return _highlightSyntax({
        query: query,
        applyRules: getApplyRules(queryType),
        he: he,
        ignoreErrors: true,
        attrHelper: attrHelper ? attrHelper : new NullAttrHelper(),
        wrapLongQuery: false,
        wrapRange,
        onHintChange: onHintChange ? onHintChange : _ => undefined,
        parserRecoverIdx: 0
    });
}

export function highlightSyntaxStatic(
        query:string,
        queryType:QueryType,
        he:Kontext.Translator):[string, Array<ParsedAttr>] {
    return _highlightSyntax({
        query: query,
        applyRules: getApplyRules(queryType),
        he: he,
        ignoreErrors: true,
        attrHelper: new NullAttrHelper(),
        wrapLongQuery: true,
        wrapRange: undefined,
        onHintChange: _ => undefined,
        parserRecoverIdx: 0
    });
}