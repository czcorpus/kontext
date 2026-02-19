/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
import { ComponentHelpers } from '../../types/kontext.js';
import { IActionDispatcher, useModel } from 'kombo';
import * as React from 'react';
import { Actions } from './actions.js';
import { SyntaxTreeModel, SyntaxTreeModelState } from './model.js';
import { createGenerator } from './treeView.js';





export function init(
    dispatcher:IActionDispatcher,
    he:ComponentHelpers,
    model:SyntaxTreeModel
):React.FC {

    const layoutViews = he.getLayoutViews();

    const corpusSelectHandler = (e) => {
        dispatcher.dispatch<typeof Actions.SwitchCorpus>({
            name: Actions.SwitchCorpus.name,
            payload: {
                corpusId: e.target.value
            }
        });
    };

    const extendGraphHandler = (e) => {
        dispatcher.dispatch<typeof Actions.ToggleExpanded>({
            name: Actions.ToggleExpanded.name,
            payload: {}
        });
    };

    function renderTree(state:SyntaxTreeModelState, target:HTMLElement):{fullWidth:boolean} {
        while (target.firstChild) {
            target.removeChild(target.firstChild);
        }
        const treexFrame = window.document.createElement('div');
        treexFrame.id = 'treex-frame';
        target.appendChild(treexFrame);

        return createGenerator(
            he,
            state.detailAttrOrders
        ).call(
            null,
            state.data,
            'cs',
            'default',
            treexFrame,
            state.expanded,
            {
                width: null, // = auto
                height: null, // = auto
                paddingTop: 20,
                paddingBottom: 50,
                paddingLeft: 20,
                paddingRight: 50,
                onOverflow: (width:number, height:number) => {
                    const viewBox = document.querySelector('.tooltip-box .syntax-tree-frame') as HTMLElement;
                    if (viewBox) {
                        const popupBox = viewBox.closest('.tooltip-box') as HTMLElement;
                        if (popupBox !== null) {
                            popupBox.style['position'] = 'relative';
                            popupBox.style['top'] = '0';
                            popupBox.style['left'] = '50%';
                            popupBox.style['transform'] = 'translate(-50%, 0%)';
                            return [width, height];
                        }
                    }
                    throw new Error('Failed to correct overflowing box - wrapping element not found');
                }
            }
        );
    }

    // -------------------- <SyntaxViewPane /> ---------------------

    const SyntaxViewPane:React.FC = (props) => {
        const renderElm = React.useRef(null);
        const [sizeBtnVisible, changeState] = React.useState(false);
        const state = useModel(model);

        React.useEffect(
            () => {
                if (state.data) {
                    const renderedInfo = renderTree(state, renderElm.current);
                    if (renderedInfo.fullWidth) {
                        if (sizeBtnVisible !== true) changeState(true);
                    } else {
                        if (sizeBtnVisible !== false) changeState(false);
                    }
                }
            }
        );

        const handleCorpChange = (corpusId:string) => {
            dispatcher.dispatch<typeof Actions.SwitchCorpus>({
                name: Actions.SwitchCorpus.name,
                payload: {
                    corpusId
                }
            });
        };

        const menuItems = List.map(
            (v, i) => ({
                id: v.corpus,
                label: v.corpus
            }),
            state.sentenceTokens
        );

        return (
            <div className="syntax-tree-frame">
                <layoutViews.TabView items={menuItems} callback={handleCorpChange}>
                    {List.map(v => <div key={`item:${v.corpus}`} />, state.sentenceTokens)}
                </layoutViews.TabView>
                <div ref={renderElm}>
                    {state.data ? null : <layoutViews.AjaxLoaderImage />}
                </div>
                {
                    sizeBtnVisible ?
                        <>
                            <hr/>
                            <button type="button" className="util-button" onClick={extendGraphHandler}>
                                {state.expanded ?
                                    he.translate('syntaxViewer2__fit_to_view_button') :
                                    he.translate('syntaxViewer2__expand_button')
                                }
                            </button>
                        </> :
                        null
                }
            </div>
        );
    }

    return SyntaxViewPane;
}