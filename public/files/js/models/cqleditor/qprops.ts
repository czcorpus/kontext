/*
 * Copyright (c) 2025 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2025 Tomas Machalek <tomas.machalek@gmail.com>
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

import { List, pipe } from 'cnc-tskit';
import { highlightSyntaxStatic, ParsedQuery } from './parser.js';
import { ComponentHelpers } from '../../types/kontext.js';
import { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';


/**
 * QueryProps provides miscellaneous information about a parsed
 * CQL query.
 */
export class QueryProps {

    private readonly he:ComponentHelpers;

    private readonly query:string;

    private parsedQuery:ParsedQuery|undefined;

    constructor(query:string) {
        this.query = query.replace(/^([a-z]+,)?(.+)$/, '$2');
    }

    private process() {
        this.parsedQuery = highlightSyntaxStatic({
            query: this.query,
            querySuperType: 'conc',
            he: {
                translate(s:string, values?:any):string { return s; },
                translateRich(
                    msg: string,
                    values?: Record<string, PrimitiveType | React.ReactNode | FormatXMLElementFn<React.ReactNode>>
                ): string | React.ReactNode | Array<string | React.ReactNode> {
                    return msg;
                }
            },
            wrapLongQuery: false
        });
    }

    containsWithin():boolean {
        if (!this.parsedQuery) {
            this.process();
        }
        return List.some(
            x => x.containsWithin,
            this.parsedQuery.ast.withinOrContainingList || []
        );
    }

    containsAdhocSubcorp():boolean {
        if (!this.parsedQuery) {
            this.process();
        }
        return pipe(
            this.parsedQuery.ast.withinOrContainingList,
            List.flatMap(v => v.attrs),
            List.map(v => !List.empty(v.structure?.attList || [])),
            List.some(v => v)
        );
    }

}