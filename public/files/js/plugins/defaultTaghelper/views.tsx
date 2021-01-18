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
import { IActionDispatcher, BoundWithProps, StatelessModel, Bound } from 'kombo';
import { Dict, List, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { TagBuilderBaseState } from './common';
import { Actions as QueryActions, ActionName as QueryActionName,
        QueryFormType } from '../../models/query/actions';
import { Actions, ActionName } from './actions';
import { TabFrameModel, TabFrameModelState } from './models';



export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    frameModel:TabFrameModel,
    deps:{[key:string]:[React.FC<{}>|React.ComponentClass<{}>, StatelessModel<{}>]}
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
                onInsert?:()=>void;
                canUndo:boolean;
                rawPattern:string;
                generatedQuery:string;
            }> = (props) => {

        const buttonClick = (evt) => {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch<Actions.Reset>({
                    name: ActionName.Reset,
                    payload: {
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'undo') {
                dispatcher.dispatch<Actions.Undo>({
                    name: ActionName.Undo,
                    payload: {
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'insert') {
                if (Array.isArray(props.range) && props.range[0] && props.range[1]) {
                    const query = `"${props.rawPattern}"`;
                    dispatcher.dispatch<QueryActions.QueryInputSetQuery>({
                        name: QueryActionName.QueryInputSetQuery,
                        payload: {
                            formType: props.formType,
                            sourceId: props.sourceId,
                            query: query,
                            insertRange: [props.range[0], props.range[1]],
                            rawAnchorIdx: null,
                            rawFocusIdx: null
                        }
                    });

                } else {
                    dispatcher.dispatch<QueryActions.QueryInputSetQuery>({
                        name: QueryActionName.QueryInputSetQuery,
                        payload: {
                            formType: props.formType,
                            sourceId: props.sourceId,
                            query: `[${props.generatedQuery}]`,
                            insertRange: [props.range[0], props.range[1]],
                            rawAnchorIdx: null,
                            rawFocusIdx: null
                        }
                    });
                }
                dispatcher.dispatch<Actions.Reset>({
                    name: ActionName.Reset,
                    payload: {
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
                <InsertButton onClick={buttonClick} />
                <UndoButton onClick={buttonClick} enabled={props.canUndo} />
                <ResetButton onClick={buttonClick} enabled={props.canUndo} />
            </div>
        );
    };

    // ------------------------------ <TagBuilder /> ----------------------------

    type ActiveTagBuilderProps = PluginInterfaces.TagHelper.ViewProps &
            {activeView:React.ComponentClass|React.FC};

    class TagBuilder extends React.PureComponent<ActiveTagBuilderProps & TagBuilderBaseState> {

        constructor(props) {
            super(props);
        }

        componentDidMount() {
            dispatcher.dispatch<Actions.GetInitialData>({
                name: ActionName.GetInitialData,
                payload: {
                    sourceId: this.props.sourceId
                }
            });
        }

        render() {
            return (
                <div>
                    <this.props.activeView {...this.props} />
                    <div className="flex">
                        <TagButtons sourceId={this.props.sourceId}
                                    onInsert={this.props.onInsert}
                                    canUndo={this.props.canUndo}
                                    range={this.props.range}
                                    formType={this.props.formType}
                                    rawPattern={this.props.rawPattern}
                                    generatedQuery={this.props.generatedQuery} />
                        <div>
                            { this.props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : null }
                        </div>
                    </div>
                </div>
            );
        }
    }

    // -------------------------------------------

    const tagsetTabs = pipe(
        deps,
        Dict.keys(),
        List.map(
            tagset => ({
                id: tagset,
                label: tagset
            })
        )
    );

    // ---------------- <ActiveTagBuilder /> -----------------------------------

    const ActiveTagBuilder:React.FC<PluginInterfaces.TagHelper.ViewProps & TabFrameModelState> = (props) => {

        const handleTabSelection = (value:string) => {
            dispatcher.dispatch<Actions.SetActiveTag>({
                name: ActionName.SetActiveTag,
                payload: {
                    sourceId: props.sourceId,
                    value: value
                }
            });
        };

        const children = pipe(
            deps,
            Dict.map(
                ([view, model], key) => {
                    const BoundTagBuilder = BoundWithProps<ActiveTagBuilderProps, {}>(TagBuilder, model);
                    return <BoundTagBuilder
                                key={key}
                                activeView={view}
                                sourceId={props.sourceId}
                                formType={props.formType}
                                range={props.range}
                                onInsert={props.onInsert}
                                onEscKey={props.onEscKey} />;
                }
            ),
            Dict.values()
        );

        return (
            <div>
                <h3>{he.translate('taghelper__create_tag_heading')}</h3>
                <layoutViews.TabView
                        className="TagsetFormSelector"
                        callback={handleTabSelection}
                        items={tagsetTabs}
                        defaultId={props.activeTabs[props.sourceId]} >
                    {children}
                </layoutViews.TabView>
            </div>
        );
    }

    return BoundWithProps(ActiveTagBuilder, frameModel);
}
