/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { List, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { Actions as QueryActions, ActionName as QueryActionName,
        QueryFormType } from '../../models/query/actions';
import { Actions, ActionName } from './actions';
import { TabFrameModel, TabFrameModelState } from './models';
import { PosTagModelState, PosTagModel } from './positional/models';
import { UDTagBuilderModelState, UDTagBuilderModel } from './keyval/models';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    frameModel:TabFrameModel,
    deps:Array<[string, React.FC<{}>|React.ComponentClass<{}>, UDTagBuilderModel|PosTagModel]>
):PluginInterfaces.TagHelper.View {

    const layoutViews = he.getLayoutViews();

    // ------------------------------ <InsertButton /> ----------------------------

    const InsertButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void}> = (props) => {
        return (
            <button className="util-button" type="button"
                    value="insert" onClick={props.onClick}>
                {he.translate('taghelper__insert_btn')}
            </button>
        );
    }

    // ------------------------------ <UndoButton /> ----------------------------

    const UndoButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> =
    (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="util-button" value="undo"
                        onClick={props.onClick}>
                    {he.translate('taghelper__undo')}
                </button>
            );

        } else {
            return (
                <span className="util-button disabled">
                    {he.translate('taghelper__undo')}
                </span>
            );
        }
    };

    // ------------------------------ <ResetButton /> ----------------------------

    const ResetButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> =
    (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="util-button cancel"
                        value="reset" onClick={props.onClick}>
                    {he.translate('taghelper__reset')}
                </button>
            );

        } else {
            return (
                <span className="util-button disabled">
                    {he.translate('taghelper__reset')}
                </span>
            );
        }
    };


    // ------------------------------ <TagButtons /> ----------------------------

    const TagButtons:React.FC<{
                range:[number, number];
                formType:QueryFormType;
                sourceId:string;
                tagsetId:string;
                onInsert?:()=>void;
                canUndo:boolean;
                rawPattern:string;
                generatedQuery:string;
                isBusy:boolean;
            }> = (props) => {

        const buttonClick = (evt) => {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch<Actions.Reset>({
                    name: ActionName.Reset,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'undo') {
                dispatcher.dispatch<Actions.Undo>({
                    name: ActionName.Undo,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'insert') {
                const query = !Array.isArray(props.range) || props.range[0] === props.range[1] ?
                        `[${props.generatedQuery}]` :
                        `"${props.rawPattern}"` ;

                dispatcher.dispatch<QueryActions.QueryInputSetQuery>({
                    name: QueryActionName.QueryInputSetQuery,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        query,
                        insertRange: [props.range[0], props.range[1]],
                        rawAnchorIdx: null,
                        rawFocusIdx: null
                    }
                });
                dispatcher.dispatch<Actions.Reset>({
                    name: ActionName.Reset,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });
                if (typeof props.onInsert === 'function') {
                    props.onInsert();
                }
            }
        };

        return (
            <div className="buttons">
                {props.isBusy ?
                    <layoutViews.AjaxLoaderBarImage /> :
                    <>
                        <InsertButton onClick={buttonClick} />
                        <UndoButton onClick={buttonClick} enabled={props.canUndo} />
                        <ResetButton onClick={buttonClick} enabled={props.canUndo} />
                    </>
                }
            </div>
        );
    };

    // ------------------------------ <TagBuilder /> ----------------------------

    type ActiveTagBuilderProps = PluginInterfaces.TagHelper.ViewProps &
            {activeView:React.ComponentClass|React.FC};

    const UDTagBuilder:React.FC<ActiveTagBuilderProps & UDTagBuilderModelState> = (props) => {
        return (
            <div>
                <props.activeView {...props} />
                <div className="flex">
                    <TagButtons sourceId={props.sourceId}
                                tagsetId={props.tagsetInfo.ident}
                                onInsert={props.onInsert}
                                canUndo={props.data[props.sourceId].canUndo}
                                range={props.data[props.sourceId].queryRange}
                                formType={props.formType}
                                rawPattern={props.data[props.sourceId].rawPattern}
                                generatedQuery={props.data[props.sourceId].generatedQuery}
                                isBusy={props.isBusy} />
                    <div>
                        { props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : null }
                    </div>
                </div>
            </div>
        );
    };

    const PosTagBuilder:React.FC<ActiveTagBuilderProps & PosTagModelState> = (props) => {
        return (
            <div>
                <props.activeView {...props} />
                <div className="flex">
                    <TagButtons sourceId={props.sourceId}
                                tagsetId={props.tagsetInfo.ident}
                                onInsert={props.onInsert}
                                canUndo={props.data[props.sourceId].canUndo}
                                range={props.data[props.sourceId].queryRange}
                                formType={props.formType}
                                rawPattern={props.data[props.sourceId].rawPattern}
                                generatedQuery={props.data[props.sourceId].generatedQuery}
                                isBusy={props.isBusy} />
                    <div>
                        { props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : null }
                    </div>
                </div>
            </div>
        );
    };

    // -------------------------------------------

    const tagsetTabs = pipe(
        deps,
        List.map(
            ([tagset,,]) => ({
                id: tagset,
                label: tagset
            })
        )
    );

    // ---------------- <ActiveTagBuilder /> -----------------------------------

    const ActiveTagBuilder:React.FC<PluginInterfaces.TagHelper.ViewProps & TabFrameModelState> = (props) => {

        const handleTabSelection = (tagsetId:string) => {
            dispatcher.dispatch<Actions.SetActiveTag>({
                name: ActionName.SetActiveTag,
                payload: {
                    sourceId: props.sourceId,
                    tagsetId,
                    corpname: props.corpname
                }
            });
        };

        const initialTagsetId = List.head(deps)[0];

        React.useEffect(
            () => {
                dispatcher.dispatch<Actions.GetInitialData>({
                    name: ActionName.GetInitialData,
                    payload: {
                        tagsetId: initialTagsetId,
                        sourceId: props.sourceId,
                        corpname: props.corpname
                    }
                });
            },
            []
        );

        const children = pipe(
            deps,
            List.map(
                ([key, view, model]) => {
                    const BoundTagBuilder = model instanceof PosTagModel ?
                        BoundWithProps<ActiveTagBuilderProps, PosTagModelState>(PosTagBuilder, model) :
                        BoundWithProps<ActiveTagBuilderProps, UDTagBuilderModelState>(UDTagBuilder, model)
                    return <BoundTagBuilder
                                key={key}
                                activeView={view}
                                sourceId={props.sourceId}
                                corpname={props.corpname}
                                formType={props.formType}
                                onInsert={props.onInsert}
                                onEscKey={props.onEscKey} />;
                }
            )
        );

        return (
            <div>
                <h3>{he.translate('taghelper__create_tag_heading')}</h3>
                <layoutViews.TabView
                        className="TagsetFormSelector"
                        callback={handleTabSelection}
                        items={tagsetTabs}
                        defaultId={initialTagsetId} >
                    {children}
                </layoutViews.TabView>
            </div>
        );
    }

    return BoundWithProps(ActiveTagBuilder, frameModel);
}
