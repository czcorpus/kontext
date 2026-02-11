/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher } from 'kombo';
import { List, pipe } from 'cnc-tskit';

import * as Kontext from '../../types/kontext.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import { Actions } from './actions.js';
import { TabFrameModel } from './models.js';
import { PosTagModel } from './positional/models.js';
import { UDTagBuilderModel } from './keyval/models.js';

import * as S from './style.js';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    frameModel:TabFrameModel,
    deps:Array<[string, React.FC<PluginInterfaces.TagHelper.ViewProps>, UDTagBuilderModel|PosTagModel, unknown]>
):PluginInterfaces.TagHelper.View {

    const layoutViews = he.getLayoutViews();


    // ---------------- <ActiveTagBuilder /> -----------------------------------

    const ActiveTagBuilder:React.FC<PluginInterfaces.TagHelper.ViewProps> = (props) => {

        const tagsetTabs = pipe(
            deps,
            List.map(
                ([tagset,,]) => ({
                    id: tagset,
                    label: tagset
                })
            )
        );

        const handleTabSelection = (tagsetId:string) => {
            dispatcher.dispatch<typeof Actions.SetActiveTag>({
                name: Actions.SetActiveTag.name,
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
                dispatcher.dispatch<typeof Actions.GetInitialData>({
                    name: Actions.GetInitialData.name,
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
                ([key, View, model]) => {
                    return <View
                                key={key}
                                sourceId={props.sourceId}
                                corpname={props.corpname}
                                formType={props.formType}
                                onInsert={props.onInsert}
                                onEscKey={props.onEscKey} />;
                }
            )
        );

        return (
            <S.ActiveTagBuilder>
                <h2>{he.translate('taghelper__create_tag_heading')}</h2>
                <layoutViews.TabView
                        className="TagsetFormSelector"
                        callback={handleTabSelection}
                        items={tagsetTabs}
                        defaultId={initialTagsetId}
                        noButtonSeparator={true} >
                    {children}
                </layoutViews.TabView>
            </S.ActiveTagBuilder>
        );
    }

    return ActiveTagBuilder;
}
