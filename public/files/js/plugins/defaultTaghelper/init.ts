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

import { StatelessModel } from 'kombo';
import { TagBuilderBaseState } from './common';
import { List, Dict, tuple, pipe } from 'cnc-tskit';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { TagHelperModel, PositionOptions } from './positional/models';
import { UDTagBuilderModel } from './keyval/models';
import { init as viewInit} from './views';
import { init as ppTagsetViewInit} from './positional/views';
import { init as udTagsetViewInit} from './keyval/views';
import { ActionName as QueryActionName } from '../../models/query/actions';

declare var require:any;
require('./style.less'); // webpack


function addPairIfNotPresent<T, U>(list:Array<[string, T, U]>, ident:string, model:T, view:U):void {
    const srchIdx = List.findIndex(([d,]) => d === ident, list);
    if (srchIdx === -1) {
        list.push([ident, model, view]);
    }
}

export class TagHelperPlugin implements PluginInterfaces.TagHelper.IPlugin {

    private pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    private addPosTagsetBuilder(
            deps:Array<[string, StatelessModel<TagBuilderBaseState>, React.SFC<{}>|React.ComponentClass<{}>]>,
            tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
            corpname:string
    ):void {
        const positions:Array<PositionOptions> = [];
        addPairIfNotPresent(
            deps,
            tagsetInfo.ident,
            new TagHelperModel(
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
            ),
            ppTagsetViewInit(
                this.pluginApi.dispatcher(),
                this.pluginApi.getComponentHelpers()
            )
        );
    }

    private addKeyvalTagsetBuilder(
        deps:Array<[string, StatelessModel<TagBuilderBaseState>, React.SFC<{}>|React.ComponentClass<{}>]>,
        tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
        corpname:string
    ):void {
        addPairIfNotPresent(
            deps,
            tagsetInfo.ident,
            new UDTagBuilderModel(
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
                    availableFeatures: {},
                    filterFeaturesHistory: [[]],
                    showCategory: '',
                    posField: tagsetInfo.posAttr,
                    featureField: tagsetInfo.featAttr
                },
                tagsetInfo.ident
            ),
            udTagsetViewInit(
                this.pluginApi.dispatcher(),
                this.pluginApi.getComponentHelpers()
            )
        );
    }

    getWidgetView(corpname:string,
            tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>):PluginInterfaces.TagHelper.View {
        const deps:Array<[string, StatelessModel<TagBuilderBaseState>, React.SFC<{}>|React.ComponentClass<{}>]> = [];
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
            ([key, model,]) => {
                model.suspend({}, (action, syncObj) => {
                    if (action.name === 'TAGHELPER_SET_ACTIVE_TAG' &&
                            key === action.payload['value']) {
                        return null;

                    } else if (action.name === QueryActionName.SetActiveInputWidget &&
                            key === tagsets[0].ident) {
                        return null;
                    }
                    return syncObj;
                });
            },
            deps
        );

        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            pipe(
                deps,
                List.map(
                    ([ident, model, view]) => tuple(
                        ident,
                        tuple(model, view)
                    )
                ),
                Dict.fromEntries(),
            )
        );
    }
}

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) => new TagHelperPlugin(pluginApi);

export default create;
