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
import { Keyboard } from 'cnc-tskit';
import * as S from './style';


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

    const QuickSubcorpWidget: React.FC<QuickSubcorpWidgetProps & QuickSubcorpModelState> = (props) => {
        
        const inputRef = React.createRef<HTMLInputElement>();
        React.useLayoutEffect(
            () => inputRef.current.focus(),
            [inputRef.current]
        );

        const changeName = (e) => {
            dispatcher.dispatch<typeof Actions.QuickSubcorpChangeName>({
                name: Actions.QuickSubcorpChangeName.name,
                payload: {
                    value: e.target.value
                }
            });
        };

        const submitAction = () => {
            if (props.subcname) {
                dispatcher.dispatch<typeof Actions.QuickSubcorpSubmit>({
                    name: Actions.QuickSubcorpSubmit.name,
                    payload: {}
                });
            }
        };

        const keyPressHandler = (e) => {
            if (e.key === Keyboard.Value.ENTER) {
                submitAction();
            }
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onClose}>
                <layoutViews.CloseableFrame onCloseClick={props.onClose}
                        label={he.translate('subc__quick_subcorpus_form_hd')} scrollable={true}>
                    {props.estimatedSubcSize ?
                        <p>{he.translate('global__size_in_tokens')}: <strong>{he.formatNumber(props.estimatedSubcSize)}</strong></p> :
                        null}
                    <S.QuickSubcLABEL>
                        {he.translate('subc__quick_subcorpus_name')}:
                        <input name="subcorpName" style={{ marginRight: '1em' }}
                            onChange={changeName} value={props.subcname}
                            onKeyPress={keyPressHandler}
                            ref={inputRef} />
                    </S.QuickSubcLABEL>
                    {props.isBusy ?
                        <layoutViews.AjaxLoaderBarImage /> :
                        <button type="button" className={"util-button" + (props.subcname ? "" : " disabled")} onClick={submitAction}>
                            {he.translate('subc__quick_subcorpus_create')}
                        </button>
                    }
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    return {
        Widget: BoundWithProps(QuickSubcorpWidget, quickSubcorpModel)
    }
}