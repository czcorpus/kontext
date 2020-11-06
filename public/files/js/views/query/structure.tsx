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

import { List } from "cnc-tskit";
import { BoundWithProps, IActionDispatcher } from "kombo";
import * as React from "react";
import { ActionName, Actions } from "../../models/query/actions";
import { QueryStructureModel, QueryStructureState } from "../../models/query/structure";
import { Kontext } from "../../types/common";

export interface InputModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryStructureModel:QueryStructureModel;
}

export function init({dispatcher, he, queryStructureModel}:InputModuleArgs) {

    const layoutViews = he.getLayoutViews();

    const StructureWidget:React.FC<QueryStructureState> = (props) => {

        const handleClose = () => {
            dispatcher.dispatch<Actions.ToggleQueryStructureWidget>({
                name: ActionName.ToggleQueryStructureWidget,
                payload: {
                    query: null
                }
            });
        };

        if (props.query) {
            return <layoutViews.ModalOverlay onCloseKey={handleClose}>
                <layoutViews.CloseableFrame onCloseClick={handleClose} label={he.translate('query__query_structure')}>
                    {List.map((v, i) => <p key={i}>{`args${i}: `}[{List.map(u => `${u[0]}="${u[1]}"`, v.args).join(' & ')}]</p>, props.query.queryParsed)}
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        } else {
            return null;
        }
    };

    return BoundWithProps<{}, QueryStructureState>(StructureWidget, queryStructureModel);
}
