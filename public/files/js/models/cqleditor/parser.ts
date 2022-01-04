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
import { parse as parseQuery, SyntaxError } from 'cqlParser/parser';
import { IAttrHelper, NullAttrHelper } from './attrs';
import { tuple } from 'cnc-tskit';
import { ParsedAttr, ParsedPQItem, RuleCharMap } from './rules';

export type { ParsedAttr, ParsedPQItem } from './rules';


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

function _highlightSyntax({
    query,
    applyRules,
    he,
    ignoreErrors,
    attrHelper,
    parserRecoverIdx,
    wrapLongQuery,
    wrapRange
}:HSArgs):[string, Array<ParsedAttr>, Array<ParsedPQItem>, string] {

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
 * the resulting string. It also provides a list
 * of detected attributes and structures and paradigmatic
 * query sub-queries.
 *
 * @return a 4-tuple (
 *   highlighted query,
 *   list of detected attributes,
 *   list of detected paradigm. query sub-queries
 *   syntax error
 * )
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