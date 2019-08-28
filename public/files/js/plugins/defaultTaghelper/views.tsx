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
import { IActionDispatcher, StatelessModel, BoundWithProps } from 'kombo';
import { Kontext, KeyCodes } from '../../types/common';
import { AppendQueryInputAction, SetQueryInputAction } from '../../models/query/common';
import { PluginInterfaces } from '../../types/plugins';
import { TagBuilderBaseState } from './common';
import * as Immutable from 'immutable';

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    models:Immutable.Map<string, StatelessModel<TagBuilderBaseState>>,
    views:Immutable.Map<string, any>) {

    const layoutViews = he.getLayoutViews();

    // ------------------------------ <InsertButton /> ----------------------------

    const InsertButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void}> = (props) => {
        return (
            <button className="util-button" type="button"
                    value="insert" onClick={props.onClick}>
                {he.translate('taghelper__insert_btn')}
            </button>
        );
    }

    // ------------------------------ <UndoButton /> ----------------------------

    const UndoButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> = (props) => {
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

    const ResetButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> = (props) => {
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

    const TagButtons:React.SFC<{
                range:[number, number];
                sourceId:string;
                onInsert?:()=>void;
                canUndo:boolean;
                rawPattern:string;
                generatedQuery:string;
                actionPrefix:string;
            }> = (props) => {

        const buttonClick = (evt) => {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch({
                    name: 'TAGHELPER_RESET',
                    payload: {}
                });

            } else if (evt.target.value === 'undo') {
                dispatcher.dispatch({
                    name: 'TAGHELPER_UNDO',
                    payload: {}
                });

            } else if (evt.target.value === 'insert') {
                if (Array.isArray(props.range) && props.range[0] && props.range[1]) {
                    const query = `"${props.rawPattern}"`;
                    dispatcher.dispatch<SetQueryInputAction>({
                        name: `${props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                        payload: {
                            sourceId: props.sourceId,
                            query: query,
                            insertRange: [props.range[0], props.range[1]],
                            rawAnchorIdx: null,
                            rawFocusIdx: null
                        }
                    });

                } else {
                    dispatcher.dispatch<AppendQueryInputAction>({
                        name: props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                        payload: {
                            sourceId: props.sourceId,
                            query: `[${props.generatedQuery}]`
                        }
                    });
                }
                dispatcher.dispatch({
                    name: 'TAGHELPER_RESET',
                    payload: {}
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


    // ------------------------------ <TagDisplay /> ----------------------------

    const TagDisplay:React.SFC<{
        onEscKey:()=>void;
        generatedQuery:string;
    }> = (props) => {


    const keyEventHandler = (evt:React.KeyboardEvent<{}>) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (typeof props.onEscKey === 'function' && evt.keyCode === KeyCodes.ESC) {
            props.onEscKey();
        }
    };

    return <input type="text" className="tag-display-box" value={props.generatedQuery}
                onKeyDown={keyEventHandler} readOnly
                ref={item => item ? item.focus() : null} />;
    }


    // ------------------------------ <TagBuilder /> ----------------------------

    type ActiveTagBuilderProps = PluginInterfaces.TagHelper.ViewProps & {activeView:React.ComponentClass|React.SFC};

    class TagBuilder extends React.Component<ActiveTagBuilderProps & TagBuilderBaseState> {

        constructor(props) {
            super(props);
        }

        componentDidMount() {
            dispatcher.dispatch({
                name: 'TAGHELPER_GET_INITIAL_DATA',
                payload: {}
            });
        }

        render() {

            return <div>
                <h3>{he.translate('taghelper__create_tag_heading')}</h3>
                {
                    this.props.isBusy ?
                    <img className="loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={he.translate('global__loading')}
                            alt={he.translate('global__loading')} /> :
                    null
                }
                <div className="tag-header">
                    <TagDisplay generatedQuery={this.props.generatedQuery} onEscKey={this.props.onEscKey} />
                    <TagButtons sourceId={this.props.sourceId}
                                onInsert={this.props.onInsert}
                                canUndo={this.props.canUndo}
                                range={this.props.range}
                                actionPrefix={this.props.actionPrefix}
                                rawPattern={this.props.rawPattern}
                                generatedQuery={this.props.generatedQuery} />
                </div>
                <this.props.activeView {...this.props} />
            </div>;
        }
    }

    const AvailableTagBuilderBound = models.map(model => BoundWithProps<ActiveTagBuilderProps, TagBuilderBaseState>(TagBuilder, model));

    const ActiveTagBuilder:React.SFC<PluginInterfaces.TagHelper.ViewProps> = (props) => {
        const [activeView, setActiveView] = React.useState(views.keySeq().first());
        const TagBuilderBound = AvailableTagBuilderBound.get(activeView);

        const handleTabSelection = (value:string) => () => {
            dispatcher.dispatch({
                name: 'TAGHELPER_SET_ACTIVE_TAG',
                payload: {value: value}
            });
            setActiveView(value);
        };

        // prepare view switch
        const tagsetSwitch = views.keySeq().map(value =>
                <li key={value}>
                    <layoutViews.TabButton onClick={handleTabSelection(value)}
                        label={value}
                        isActive={value === activeView} />
                </li>
            )

        return <div>
            {tagsetSwitch.size > 1 ? <ul className="TagsetFormSelector tabs">{tagsetSwitch}</ul> : null}
            <hr />
            <TagBuilderBound
                activeView={views.get(activeView)}
                sourceId={props.sourceId}
                actionPrefix={props.actionPrefix}
                range={props.range}
                onInsert={props.onInsert}
                onEscKey={props.onEscKey} />
        </div>
    }

    return ActiveTagBuilder;
}
