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

import { List, tuple, pipe } from 'cnc-tskit';

import * as PluginInterfaces from '../../types/plugins/index.js';
import { DataInitSyncModel, PosTagModel } from './positional/models.js';
import { createEmptyPosTagsetStatus } from './positional/common.js';
import { createEmptyUDTagsetStatus, UDTagBuilderModel } from './keyval/models.js';
import { init as viewInit} from './views.js';
import { init as ppTagsetViewInit} from './positional/views.js';
import { init as udTagsetViewInit} from './keyval/views.js';
import { TabFrameModel } from './models.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { PluginName } from '../../app/plugin.js';
import { EmptyTagHelperPlugin } from '../empty/taghelper/init.js';
import { ViewProps } from '../../types/plugins/tagHelper.js';

declare var require:any;
require('./style.css'); // webpack


type AnyModel = PosTagModel|UDTagBuilderModel;

type TagBuilderView = React.FC<ViewProps>;



function isPresent(list:Array<[string, TagBuilderView, AnyModel, unknown]>, ident:string):boolean {
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

    private deps:Array<[string, TagBuilderView, AnyModel, unknown]>;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.deps = [];
    }

    isActive():boolean {
        return true;
    }

    private addPosTagsetBuilder(
            deps:Array<[string, TagBuilderView, AnyModel, unknown]>,
            tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
            corpname:string,
            sourceId:string
    ):void {
        if (isPresent(deps, tagsetInfo.ident)) {
            return;
        }
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
        const view = ppTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            model
        );


        const syncModel = new DataInitSyncModel(this.pluginApi.dispatcher());

        deps.push(tuple<string, TagBuilderView, AnyModel, unknown>(
            tagsetInfo.ident,
            view,
            model,
            syncModel
        ));
    }

    private addKeyvalTagsetBuilder(
        deps:Array<[string, TagBuilderView, AnyModel, unknown]>,
        tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
        corpname:string,
        sourceId:string
    ):void {
        if (isPresent(deps, tagsetInfo.ident)) {
            return;
        }

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

        const view = udTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            model
        );

        deps.push(tuple(
            tagsetInfo.ident,
            view,
            model,
            undefined
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

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) => {
    if (pluginApi.pluginTypeIsActive(PluginName.TAGHELPER)) {
        return new TagHelperPlugin(pluginApi);
    }
    return new EmptyTagHelperPlugin(pluginApi.dispatcher());
}

export default create;
