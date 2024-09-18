/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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
import { ComponentHelpers } from '../../types/kontext';
import { Bound, IActionDispatcher } from 'kombo';
import * as React from 'react';
import { Actions } from './actions';
import { SyntaxTreeModel, SyntaxTreeModelState } from './model';
import { createGenerator } from './treeView';





export function init(
    dispatcher:IActionDispatcher,
    he:ComponentHelpers,
    model:SyntaxTreeModel
):React.ComponentClass {

    const layoutViews = he.getLayoutViews();

    const corpusSelectHandler = (e) => {
        dispatcher.dispatch<typeof Actions.SwitchCorpus>({
            name: Actions.SwitchCorpus.name,
            payload: {
                corpusId: e.target.value
            }
        });
    };

    const fitHandler = (e) => {
        dispatcher.dispatch<typeof Actions.ToggleExpanded>({
            name: Actions.ToggleExpanded.name,
            payload: {}
        });
    };

    function renderTree(state:SyntaxTreeModelState, target:HTMLElement):void {
        while (target.firstChild) {
            target.removeChild(target.firstChild);
        }
        if (state.sentenceTokens.length > 1) {
            const corpusSwitch = window.document.createElement('select') as HTMLSelectElement;
            corpusSwitch.classList.add('corpus-switch');
            corpusSwitch.onchange = corpusSelectHandler;
            target.append(corpusSwitch);
            target.append(window.document.createElement('hr'));
            List.forEach(
                (sentenceToken, i) => {
                    const option = window.document.createElement('option');
                    option.value = sentenceToken.corpus;
                    option.label = sentenceToken.corpus;
                    option.selected = i === state.activeToken;
                    corpusSwitch.append(option);
                },
                state.sentenceTokens
            );
        }
        const treexFrame = window.document.createElement('div');
        treexFrame.id = 'treex-frame';
        target.appendChild(treexFrame);

        createGenerator(
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

    const SyntaxViewPane:React.FC<SyntaxTreeModelState> = (props) => {
        const renderElm = React.useRef(null);

        React.useEffect(
            () => {
                if (props.data) {
                    renderTree(props, renderElm.current)
                }
            }
        );

        return (
            <div className="syntax-tree-frame">
                <div ref={renderElm}>
                    {props.data ? null : <layoutViews.AjaxLoaderImage />}
                </div>
                <hr/>
                <button type='button' onClick={fitHandler}>{props.expanded ? 'Fit graph to window' : 'Expand graph'}</button>
            </div>
        );
    }

    return Bound(SyntaxViewPane, model);
}