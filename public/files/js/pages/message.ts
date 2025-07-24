/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Kontext from '../types/kontext.js';
import { PageModel } from '../app/page.js';
import { init as messageViewsInit, MessageViewProps } from '../views/message/index.js';
import { KontextPage } from '../app/main.js';
import issueReportingPlugin from '@plugins/issue-reporting';
import { PluginName } from '../app/plugin.js';
import { ConcServerArgs } from '../models/concordance/common.js';

/**
 *
 */
class MessagePage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        const concId = this.layoutModel.getConf<string>('concPersistenceOpId');

        this.layoutModel.init(false, [], () => {
            const plugin = this.layoutModel.pluginTypeIsActive(PluginName.ISSUE_REPORTING) ?
                    issueReportingPlugin(this.layoutModel.pluginApi()) : null;

            const views = messageViewsInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                this.layoutModel.getMessageModel()
            );
            this.layoutModel.renderReactComponent<MessageViewProps>(
                views.MessagePageHelp,
                document.getElementById('root-mount'),
                {
                    widgetProps: this.layoutModel.getConf<Kontext.GeneralProps>(
                        'issueReportingAction') || null,
                    anonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
                    issueReportingView: plugin ? plugin.getWidgetView() as React.FC<{}> : null,
                    lastUsedCorpus: this.layoutModel.getConf<
                        {corpname:string; human_corpname:string}>('LastUsedCorp'),
                    lastUsedConc: concId ?
                        {
                            id: concId,
                            args: this.layoutModel.getConf<ConcServerArgs>('currentArgs') || undefined
                        } :
                        undefined,
                    initCallback: () => this.layoutModel.dispatchServerMessages()
                }
            );
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new MessagePage(new KontextPage(conf)).init();
}