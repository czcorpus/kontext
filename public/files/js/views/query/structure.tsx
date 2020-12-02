/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { BoundWithProps, IActionDispatcher } from 'kombo';
import * as React from 'react';
import { ActionName, Actions, QueryFormType } from '../../models/query/actions';
import { QueryFormModel, QueryFormModelState } from '../../models/query/common';
import { ParsedSimpleQueryToken } from '../../models/query/query';
import { Kontext } from '../../types/common';

export interface InputModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel<QueryFormModelState>;
}

interface QueryStructureWidgetProps {
    sourceId:string;
    formType:QueryFormType;
    defaultAttribute:Array<string>;
}

export function init({dispatcher, he, queryModel}:InputModuleArgs) {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <ParsedToken /> ----------------------------------

    const ParsedToken:React.FC<{
        value:ParsedSimpleQueryToken;
        matchCase:boolean;
        defaultAttrs:Array<string>;

    }> = (props) => {

        const mkExpr = (attr:string|undefined, val:string) => {
            const csFlag = props.matchCase ? '' : '(?i)';
            if (!attr) {
                return pipe(
                    props.defaultAttrs,
                    List.map((attr, i) => (
                        <div key={`item:${attr}:${i}`}>
                            <span className="attr">{attr}</span>=<span className="value">"{`${csFlag}${val}`}"</span>
                        </div>
                    )),
                    List.join((i) => (
                        <div key={`op:${i}`} className="operator">
                            <span>
                                {he.translate('global__logic_or')}
                            </span>
                        </div>
                    ))
                );
            }
            return <div key={`item:${attr}:0`}><span className="attr">{attr}</span>=<span className="value">"{`${csFlag}${val}`}"</span></div>;
        }

        return (
            <td>
                {pipe(
                    props.value.args,
                    List.map(u => mkExpr(u[0], u[1])),
                    List.join((i) => (
                        <div key={`op:${i}`}  className="operator">
                            <span>
                                {he.translate('global__logic_and')}
                            </span>
                        </div>
                    ))
                )}
            </td>
        )
    };

    // ------------------------ <QueryStructureWidget /> ----------------------------------

    const QueryStructureWidget:React.FC<QueryStructureWidgetProps & QueryFormModelState> = (props) => {

        const handleClose = () => {
            dispatcher.dispatch<Actions.HideQueryStructureWidget>({
                name: ActionName.HideQueryStructureWidget,
                payload: {
                    sourceId: props.sourceId,
                    formType: props.formType
                }
            });
        };

        const handleReset = () => {
            dispatcher.dispatch<Actions.QueryInputResetQueryExpansion>({
                name: ActionName.QueryInputResetQueryExpansion,
                payload: {
                    sourceId: props.sourceId,
                    formType: props.formType
                }
            })
        }

        const queryObj = props.queries[props.sourceId];

        if (queryObj.qtype === 'simple') {
            const hasExpandedTokens = List.some(t => t.isExtended, queryObj.queryParsed);
            return (
                <layoutViews.ModalOverlay onCloseKey={handleClose}>
                    <layoutViews.CloseableFrame onCloseClick={handleClose} label={he.translate('query__query_structure')}>
                        <div className="QueryStructureWidget">
                            {pipe(queryObj.queryParsed, List.filter(v => !!v.value), List.empty()) ?
                                <div className="empty">
                                    <layoutViews.StatusIcon status="info" inline={true} />
                                    {he.translate('query__query_is_empty')}
                                </div> :
                                <>
                                    <table className="positions">
                                        <tbody>
                                            <tr>
                                                <td colSpan={queryObj.queryParsed.length} className="text">
                                                    {he.translate('query__interpretation_entered_query')}:
                                                </td>
                                            </tr>
                                            <tr className="token">
                                                {List.map(
                                                    (token, i) => (
                                                        <td key={`${token.value}:${i}`}>
                                                            {token.value}
                                                        </td>
                                                    ),
                                                    queryObj.queryParsed,
                                                )}
                                            </tr>
                                            <tr>
                                                <td colSpan={queryObj.queryParsed.length} className="text">
                                                    {he.translate('query__interpretation_subhead')}:
                                                </td>
                                            </tr>
                                            <tr className="interpretation">
                                                {List.map(
                                                    (v, i) => <ParsedToken key={`${v.value}:${i}`} value={v}
                                                                    defaultAttrs={props.defaultAttribute}
                                                                    matchCase={queryObj.qmcase} />,
                                                    queryObj.queryParsed
                                                )}
                                            </tr>
                                        </tbody>
                                    </table>
                                    <p>{he.translate('query__interpretation_note')}</p>
                                    {hasExpandedTokens ?
                                        <p>{he.translate('query__interpretation_qs_note')}</p> : null}
                                    <p className="buttons">
                                        {hasExpandedTokens ?
                                            <button className="util-button" type="button" onClick={handleReset}>
                                                {he.translate('query__reset_token_expansions')}
                                            </button> :
                                            null
                                        }
                                        <button className="util-button" type="button" onClick={handleClose}>
                                        {he.translate('global__close')}
                                        </button>
                                    </p>
                                </>
                            }
                        </div>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );

        } else {
            return null;
        }
    };

    return BoundWithProps<QueryStructureWidgetProps, QueryFormModelState>(QueryStructureWidget, queryModel);
}
