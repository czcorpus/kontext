/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import { BoundWithProps } from 'kombo';
import { List, tuple, pipe } from 'cnc-tskit';

import * as PluginInterfaces from '../../types/plugins';
import { PosTagModel, PosTagModelState, createEmptyPosTagsetStatus } from './positional/models';
import { createEmptyUDTagsetStatus, UDTagBuilderModel, UDTagBuilderModelState } from './keyval/models';
import { init as viewInit} from './views';
import { init as ppTagsetViewInit} from './positional/views';
import { init as udTagsetViewInit} from './keyval/views';
import { TabFrameModel } from './models';
import { IPluginApi } from '../../types/plugins/common';

declare var require:any;
require('./style.css'); // webpack


type AnyComponent = React.FC<any>|React.ComponentClass<any>;

type AnyModel = PosTagModel|UDTagBuilderModel;



function isPresent(list:Array<[string, AnyComponent, AnyModel]>, ident:string):boolean {
    return List.some(([d,,]) => d === ident, list);
}

/**
 * TagHelperPlugin provides a list of interactive widgets for adding PoS tags
 * to queries. It is able to handle multiple tagsets per corpus. Currently,
 * there are to main supported tagset types
 * - positional - each string position encodes a specific property (e.g. part of speech,
 *   noun gender etc.)
 * - key-value - properties are encodes as key1=value1,key2=value2,....
 */
export class TagHelperPlugin implements PluginInterfaces.TagHelper.IPlugin {

    private pluginApi:IPluginApi;

    private deps:Array<[string, AnyComponent, AnyModel]>;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.deps = [];
    }

    isActive():boolean {
        return true;
    }

    private addPosTagsetBuilder(
            deps:Array<[string, AnyComponent, AnyModel]>,
            tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
            corpname:string,
            sourceId:string
    ):void {
        if (isPresent(deps, tagsetInfo.ident)) {
            return;
        }
        const view = ppTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers()
        );
        const model = new PosTagModel(
            this.pluginApi.dispatcher(),
            this.pluginApi,
            {
                tagsetInfo,
                isBusy: false,
                data: {
                    [sourceId]: createEmptyPosTagsetStatus(tagsetInfo, corpname)
                }
            },
            tagsetInfo.ident
        );

        deps.push(tuple<string, AnyComponent, AnyModel>(
            tagsetInfo.ident,
            BoundWithProps<{sourceId:string}, PosTagModelState>(view, model),
            model
        ));
    }

    private addKeyvalTagsetBuilder(
        deps:Array<[string, AnyComponent, AnyModel]>,
        tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
        corpname:string,
        sourceId:string
    ):void {
        if (isPresent(deps, tagsetInfo.ident)) {
            return;
        }
        const view = udTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers()
        );
        const model = new UDTagBuilderModel(
            this.pluginApi.dispatcher(),
            this.pluginApi,
            {
                tagsetInfo,
                isBusy: false,
                data: {
                    [sourceId]: createEmptyUDTagsetStatus(tagsetInfo, corpname)
                }
            },
            tagsetInfo.ident
        );

        deps.push(tuple(
            tagsetInfo.ident,
            BoundWithProps<{sourceId:string}, UDTagBuilderModelState>(view, model),
            model
        ));
    }

    /**
     * The getWidgetView method initializes all the required tagset builders
     * including model-bound view components.
     * This is called once for a respective page & corpus initialization.
     */
    getWidgetView(
        corpname:string,
        sourceId:string,
        tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>
    ):PluginInterfaces.TagHelper.View {
        this.deps = pipe(
            tagsets,
            List.foldl(
                (acc, tagsetInfo) => {
                    switch (tagsetInfo.type) {
                        case 'positional':
                            this.addPosTagsetBuilder(acc, tagsetInfo, corpname, sourceId);
                        break;
                        case 'keyval':
                            this.addKeyvalTagsetBuilder(acc, tagsetInfo, corpname, sourceId);
                        break;
                        case 'other': // 'other' means defined but unsupported
                        case null:  // null means no tagset defined for the corpus
                            return acc;
                        default:
                            throw new Error(
                                `Cannot init taghelper widget - unknown tagset type ${tagsetInfo.type}`
                            );
                    }
                    return acc;
                },
               this.deps
            )
        );

        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            new TabFrameModel(
                this.pluginApi.dispatcher(),
                {
                    activeTabs: {}
                }
            ),
            this.deps
        );
    }
}

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) => new TagHelperPlugin(pluginApi);

export default create;
