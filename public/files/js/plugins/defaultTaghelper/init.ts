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
import * as Immutable from 'immutable';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {TagHelperModel, PositionOptions, TagHelperModelState} from './positional/models';
import {UDTagBuilderModel, FilterRecord, FeatureSelectProps} from './keyval/models';
import {init as viewInit} from './views';
import {init as ppTagsetViewInit} from './positional/views';
import {init as udTagsetViewInit} from './keyval/views';

import { StatelessModel, Action, SEDispatcher } from 'kombo';
import { TagBuilderBaseState } from './common';

declare var require:any;
require('./style.less'); // webpack



export class TagHelperPlugin implements PluginInterfaces.TagHelper.IPlugin {

    private pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    getWidgetView(corpname:string, tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>):PluginInterfaces.TagHelper.View {
        let views:Immutable.OrderedMap<string, any> = Immutable.Map();
        let models:Immutable.OrderedMap<string, StatelessModel<TagBuilderBaseState>> = Immutable.Map();
        for (const tagsetInfo of tagsets) {

            switch (tagsetInfo.type) {
                case 'positional':
                    const positions = Immutable.List<PositionOptions>();
                    models = models.set(tagsetInfo.ident, new TagHelperModel(
                        this.pluginApi.dispatcher(),
                        this.pluginApi,
                        {
                            corpname: corpname,
                            tagsetName: tagsetInfo.ident,
                            data: Immutable.List<Immutable.List<PositionOptions>>().push(positions),
                            positions: positions,
                            tagAttr: tagsetInfo.featAttr,
                            presetPattern: '',
                            srchPattern: '.*',
                            rawPattern: '.*',
                            generatedQuery: `${tagsetInfo.featAttr}=".*"`,
                            isBusy: false,
                            canUndo: false,
                            stateId: ''
                        },
                        tagsetInfo.ident
                    ));
                    views = views.set(tagsetInfo.ident, ppTagsetViewInit(
                        this.pluginApi.dispatcher(),
                        this.pluginApi.getComponentHelpers()
                    ));
                break;
                case 'keyval':
                        models = models.set(tagsetInfo.ident, new UDTagBuilderModel(
                            this.pluginApi.dispatcher(),
                            this.pluginApi,
                            {
                                corpname:corpname,
                                tagsetName: tagsetInfo.ident,
                                isBusy: false,
                                insertRange: [0, 0],
                                canUndo: false,
                                generatedQuery: '',
                                rawPattern: '', // not applicable for the current UI
                                error: null,
                                allFeatures: Immutable.Map(),
                                availableFeatures: Immutable.Map({}),
                                filterFeaturesHistory: Immutable.List<Immutable.List<FilterRecord>>().push(Immutable.List()),
                                showCategory: '',
                                posField: tagsetInfo.posAttr,
                                featureField: tagsetInfo.featAttr
                            },
                            tagsetInfo.ident
                        ));
                    views = views.set(tagsetInfo.ident, udTagsetViewInit(
                        this.pluginApi.dispatcher(),
                        this.pluginApi.getComponentHelpers()
                    ));
                break;
                case 'other': // 'other' means defined but unsupported
                case null:  // null means no tagset defined for the corpus
                    return null;
                default:
                    throw new Error(`Cannot init taghelper widget - unknown tagset type ${tagsetInfo.type}`);
            }
        }

        models.forEach(
            (model, key) => {
                model.suspend({}, (action, syncObj) => {
                    if (action.name === 'TAGHELPER_SET_ACTIVE_TAG' && key === action.payload['value']) {
                        return null;

                    } else if (action.name === 'QUERY_INPUT_SET_ACTIVE_WIDGET' && key === tagsets[0].ident) {
                        return null;
                    }
                    return syncObj;
                });
            }
        );

        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            models,
            views,
        );
    }
}

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) => new TagHelperPlugin(pluginApi);

export default create;
