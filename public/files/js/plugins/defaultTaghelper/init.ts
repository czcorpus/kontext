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

import { Bound, BoundWithProps, StatelessModel } from 'kombo';
import { List, Dict, tuple, pipe } from 'cnc-tskit';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { TagHelperModel, PositionOptions } from './positional/models';
import { UDTagBuilderModel, UDTagBuilderModelState } from './keyval/models';
import { init as viewInit} from './views';
import { init as ppTagsetViewInit} from './positional/views';
import { init as udTagsetViewInit} from './keyval/views';
import { ActionName as QueryActionName } from '../../models/query/actions';
import { Actions, ActionName } from './actions';
import { TabFrameModel } from './models';
import { ISuspendable } from 'kombo/dist/model/common';

declare var require:any;
require('./style.less'); // webpack


type AnyComponent = React.FC<any>|React.ComponentClass<any>;



function isPresent(list:Array<[string, AnyComponent, StatelessModel<{}>]>, ident:string):boolean {
    return List.some(([d,]) => d === ident, list);
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

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    isActive():boolean {
        return true;
    }

    private addPosTagsetBuilder(
            deps:Array<[string, AnyComponent, StatelessModel<{}>]>,
            tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
            corpname:string
    ):void {
        const positions:Array<PositionOptions> = [];
        const view = ppTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers()
        );
        const model = new TagHelperModel(
            this.pluginApi.dispatcher(),
            this.pluginApi,
            {
                corpname,
                tagsetName: tagsetInfo.ident,
                data: [positions],
                positions,
                tagAttr: tagsetInfo.featAttr,
                presetPattern: '',
                srchPattern: '.*',
                rawPattern: '.*',
                generatedQuery: `${tagsetInfo.featAttr}=".*"`,
                isBusy: false,
                canUndo: false
            },
            tagsetInfo.ident
        );
        if (!isPresent(deps, tagsetInfo.ident)) {
            deps.push(tuple(
                tagsetInfo.ident,
                Bound(view, model),
                model
            ));
        }
    }

    private addKeyvalTagsetBuilder(
        deps:Array<[string, AnyComponent, StatelessModel<{}>]>,
        tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
        corpname:string
    ):void {
        const view = udTagsetViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers()
        );
        const model = new UDTagBuilderModel(
            this.pluginApi.dispatcher(),
            this.pluginApi,
            {
                corpname,
                tagsetName: tagsetInfo.ident,
                isBusy: false,
                insertRange: [0, 0],
                canUndo: false,
                generatedQuery: '',
                rawPattern: '', // not applicable for the current UI
                error: null,
                allFeatures: {},
                availableFeatures: {'': []},
                filterFeaturesHistory: [[]],
                showCategory: '',
                posField: tagsetInfo.posAttr,
                featureField: tagsetInfo.featAttr
            },
            tagsetInfo.ident
        );
        if (!isPresent(deps, tagsetInfo.ident)) {
            deps.push(tuple(
                tagsetInfo.ident,
                BoundWithProps<{sourceId:string}, UDTagBuilderModelState>(view, model),
                model
            ));
        }
    }

    private suspendModel(model:ISuspendable<{}>, ident:string, tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>):void {
        model.suspend({}, (action, syncObj) => {
            if (action.name === ActionName.SetActiveTag &&
                    (ident === (action as Actions.SetActiveTag).payload.value)) {
                return null;

            } else if (action.name === QueryActionName.SetActiveInputWidget &&
                    ident === tagsets[0].ident) {
                return null;
            }
            return syncObj;
        });
    }

    /**
     * The getWidgetView method initializes all the required tagset builders
     * including model-bound view components.
     * This is called once for a respective page & corpus initialization.
     */
    getWidgetView(
        corpname:string,
        tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>
    ):PluginInterfaces.TagHelper.View {

        const deps:Array<[string, AnyComponent, StatelessModel<{}>]> = [];
        List.forEach(
            tagsetInfo => {
                switch (tagsetInfo.type) {
                    case 'positional':
                        this.addPosTagsetBuilder(deps, tagsetInfo, corpname);
                    break;
                    case 'keyval':
                        this.addKeyvalTagsetBuilder(deps, tagsetInfo, corpname);
                    break;
                    case 'other': // 'other' means defined but unsupported
                    case null:  // null means no tagset defined for the corpus
                        return null;
                    default:
                        throw new Error(
                            `Cannot init taghelper widget - unknown tagset type ${tagsetInfo.type}`
                        );
                }
            },
            tagsets
        );

        List.forEach(
            ([ident,,model]) => {
                this.suspendModel(model, ident, tagsets);
            },
            deps
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
            pipe(
                deps,
                List.map(
                    ([ident, view, model]) => tuple(ident, tuple(view, model))
                ),
                Dict.fromEntries()
            )
        );
    }
}

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) => new TagHelperPlugin(pluginApi);

export default create;
