/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as React from 'react';
import {IActionDispatcher, BoundWithProps} from 'kombo';
import * as Kontext from '../../types/kontext';
import { Actions } from '../../models/subcorp/actions';

import { QuickSubcorpModel, QuickSubcorpModelState } from '../../models/subcorp/quickSubcorp';


export interface QuickSubcorpWidgetArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    quickSubcorpModel:QuickSubcorpModel;
}

interface QuickSubcorpWidgetProps {
    onClose: () => void;
}

interface QuickSubcorpViews {
    Widget: React.ComponentClass<QuickSubcorpWidgetProps>
}

export function init({ dispatcher, he, quickSubcorpModel }: QuickSubcorpWidgetArgs): QuickSubcorpViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------------------------- <QuickSubcorpWidget /> ----------------------------

    const QuickSubcorpWidget:React.FC<QuickSubcorpWidgetProps & QuickSubcorpModelState> = (props) => {

        const changeName = (e) => {
            dispatcher.dispatch<typeof Actions.QuickSubcorpChangeName>({
                name: Actions.QuickSubcorpChangeName.name,
                payload: {
                    value: e.target.value
                }
            });
        };

        const submitAction = () => {
            props.onClose();
            dispatcher.dispatch<typeof Actions.QuickSubcorpSubmit>({
                name: Actions.QuickSubcorpSubmit.name,
                payload: {}
            });
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onClose}>
                <layoutViews.CloseableFrame onCloseClick={props.onClose} label={he.translate('subc__quick_subcorpus')} scrollable={true}>
                    <input name="subcorpName" style={{marginRight: '1em'}} placeholder={he.translate('subc__quick_subcorpus_name')} onChange={changeName} value={props.subcname}/>
                    <button type="button" className="default-button" onClick={submitAction}>{he.translate('subc__quick_subcorpus_create')}</button>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    return {
        Widget: BoundWithProps(QuickSubcorpWidget, quickSubcorpModel)
    }
}