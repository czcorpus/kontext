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

import { List } from 'cnc-tskit';
import { BoundWithProps, IActionDispatcher } from 'kombo';
import * as React from 'react';
import { ActionName, Actions, QueryFormType } from '../../models/query/actions';
import { QueryFormModel, QueryFormModelState } from '../../models/query/common';
import { Kontext } from '../../types/common';

export interface InputModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel<QueryFormModelState>;
}

export function init({dispatcher, he, queryModel}:InputModuleArgs) {

    const layoutViews = he.getLayoutViews();

    const StructureWidget:React.FC<{sourceId:string; formType:QueryFormType} & QueryFormModelState> = (props) => {

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
            return (
                <layoutViews.ModalOverlay onCloseKey={handleClose}>
                    <layoutViews.CloseableFrame onCloseClick={handleClose} label={he.translate('query__query_structure')}>
                        <div>
                            {List.map(
                                (v, i) => (
                                    <p key={i}>
                                        {`args${i}: `}[{List.map(u => `${u[0]}="${u[1]}"`, v.args).join(' & ')}]
                                    </p>
                                ),
                                queryObj.queryParsed
                            )}
                            <p>
                                <button type="button" onClick={handleReset}>{he.translate('global__reset')}</button>
                            </p>
                        </div>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );

        } else {
            return null;
        }
    };

    return BoundWithProps<{sourceId:string; formType:QueryFormType}, QueryFormModelState>(StructureWidget, queryModel);
}
