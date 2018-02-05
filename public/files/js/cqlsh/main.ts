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

/// <reference path="../types/common.d.ts" />
/// <reference path="../vendor.d.ts/immutable.d.ts" />

import {parse as parseQuery, SyntaxError, TracerItem} from 'cqlParser/parser';
import * as Immutable from 'vendor/immutable';
import {IAttrHelper, AttrHelper, NullAttrHelper} from './attrs';

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

/**
 * RuleCharMap applies individual rules to character ranges within
 * the original query. It is perfectly safe to apply different rules
 * multiple times to the same range - in such case, the last application
 * is used.
 */
class RuleCharMap {

    private data:{[k:string]:CharsRule};

    private nonTerminals:Array<CharsRule>;

    private query:string;

    private he:Kontext.ComponentHelpers;

    private attrHelper:IAttrHelper;

    private onHintChange:(message:string)=>void;

    constructor(query:string, he:Kontext.ComponentHelpers, attrHelper:IAttrHelper, onHintChange:(message:string)=>void) {
        this.query = query;
        this.data = {};
        this.nonTerminals = [];
        this.he = he;
        this.attrHelper = attrHelper;
        this.onHintChange = onHintChange;
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

    generate():string {
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
                value: this.query.substring(v.from, v.to),
                htmlValue: this.emitTerminal(v.rule, v.from, v.to),
                from: v.from,
                to: v.to
            }));
        // 'inserts' contains values (= HTML tags) inserted
        // before matching 'result' items. I.e. 0th item
        // from 'inserts' is inserted before 0th item from 'result'
        // and n-th item from 'inserts' is inserted to the end
        const inserts = chunks.concat(null).map(_ => []);
        const result = this.applyNonTerminals(chunks, inserts);
        return result.join('');
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

    private applyNonTerminals(chunks:Array<StyledChunk>, inserts:Array<Array<string>>):Array<string> {
        const errors:Array<string> = [];
        this.nonTerminals.reverse().forEach(v => {
            switch (v.rule) {
                case 'Position':
                    this.findSubRuleIn('AttName', v.from, v.to).forEach(pa => {
                        const range = this.convertRange(pa.from, pa.to, chunks);
                        const posAttrName = this.query.substring(pa.from, pa.to);
                        if (this.attrHelper.attrExists(posAttrName)) {
                            inserts[range[0]].push(`<span title="${this.he.translate('query__posattr')}">`);
                            inserts[range[1]+1].push('</span>');

                        } else {
                            errors.push(`${this.he.translate('query__attr_does_not_exist')}: <strong>${posAttrName}</strong>`);
                        }
                    });
                break;
                case 'Structure':
                    const attrNamesInStruct = this.findSubRuleIn('AttName', v.from, v.to);
                    const structTmp = attrNamesInStruct[attrNamesInStruct.length - 1];
                    const structRange = this.convertRange(structTmp.from, structTmp.to, chunks);
                    const structName = this.query.substring(structTmp.from, structTmp.to);
                    if (this.attrHelper.structExists(structName)) {
                        inserts[structRange[0]].push(`<span title="${this.he.translate('query__structure')}">`);
                        inserts[structRange[1]+1].push('</span>');

                    } else {
                        errors.push(`${this.he.translate('query__struct_does_not_exist')}: <strong>${structName}</strong>`);
                    }

                    attrNamesInStruct.reverse();
                    attrNamesInStruct.slice(1).forEach((sa, i, arr) => {
                        const range = this.convertRange(sa.from, sa.to, chunks);
                        const structAttrName = this.query.substring(sa.from, sa.to);
                        if (this.attrHelper.structAttrExists(structName, structAttrName)) {
                            inserts[range[0]].push(`<span title="${this.he.translate('query__structattr')}">`);
                            inserts[range[1]+1].push('</span>');

                        } else {
                            errors.push(`${this.he.translate('query__structattr_does_not_exist')}: <strong>${structName}.${structAttrName}</strong>`);
                        }
                    });
                break;
            }
        });
        if (errors.length > 0) {
            this.onHintChange(errors.join('<br />')); // TODO

        } else {
            this.onHintChange(null);
        }
        const ans:Array<string> = [];
        for (let i = 0; i < chunks.length; i += 1) {
            inserts[i].forEach(v => ans.push(v));
            ans.push(chunks[i].htmlValue);
        }
        inserts[inserts.length - 1].forEach(v => ans.push(v));
        return ans;
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


    constructor(query:string, rcMap:RuleCharMap) {
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

function escapeString(v:string):string {
    return v.replace('<', '&lt;').replace('>', '&gt;');
}


export function _highlightSyntax(query:string, startRule:string, he:Kontext.ComponentHelpers, ignoreErrors:boolean,
        attrHelper:IAttrHelper, onHintChange:(message:string)=>void):string {

    const rcMap = new RuleCharMap(query, he, attrHelper, onHintChange);
    const stack = new ParserStack(query, rcMap);

    try {
        parseQuery(query + (startRule === 'Query' ? ';' : ''), {
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

    const lastPos = stack.getLastPos();
    const ans = rcMap.generate();

    if (lastPos === 0) {
        return query;

    } else if (lastPos < query.length) {
        // try to apply a partial rule to the rest of the query
        const srch = /^(\s*[^\s]*\s+|)(.+)$/.exec(query.substr(lastPos));
        if (srch !== null) {
            const subRules = ['WithinContainingPart', 'Sequence', 'RegExpRaw'];
            let partial = escapeString(srch[2]);
            for (let i = 0; i < subRules.length; i += 1) {
                try {
                    partial = _highlightSyntax(srch[2], subRules[i], he, false, attrHelper, onHintChange);

                } catch (e) {
                    continue;
                }
                break;
            }
            return ans + escapeString(srch[1]) + partial;
        }
    }
    return ans + escapeString(query.substr(lastPos));
}

function getStartRule(queryType:string):string {
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
}

/**
 * highlightSyntax generates a syntax highlighting
 * for a query by embedding an HTML markup into
 * the resulting string.
 */
export function highlightSyntax(
        query:string,
        queryType:string,
        he:Kontext.ComponentHelpers,
        attrHelper:IAttrHelper,
        onHintChange:(message:string)=>void):string {
    return _highlightSyntax(
        query,
        getStartRule(queryType),
        he,
        true,
        attrHelper ? attrHelper : new NullAttrHelper(),
        onHintChange ? onHintChange : _ => undefined
    );
}

export function highlightSyntaxStrict(query:string, queryType:string, he:Kontext.ComponentHelpers):string {
    return _highlightSyntax(query, getStartRule(queryType), he, false, new NullAttrHelper(), _ => undefined);
}