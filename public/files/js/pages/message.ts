/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import {Kontext} from '../types/common';
import {PageModel} from '../app/page';
import issueReportingPlugin from 'plugins/issueReporting/init';
import {init as messageViewsInit, MessageViewProps} from '../views/message';
import { KontextPage } from '../app/main';


declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/message.less');

/**
 *
 */
class MessagePage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(
            () => {
                const plugin = this.layoutModel.pluginIsActive('issue_reporting') ?
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
                        widgetProps: this.layoutModel.getConf<Kontext.GeneralProps>('issueReportingAction') || null,
                        anonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
                        issueReportingView: plugin ? <React.SFC<{}>>plugin.getWidgetView() : null,
                        lastUsedCorpus: this.layoutModel.getConf<{corpname:string; human_corpname:string}>('LastUsedCorp')
                    },
                    () => this.layoutModel.dispatchServerMessages()
                );
            },
            false
        );
    }
}


export function init(conf:Kontext.Conf):void {
    new MessagePage(new KontextPage(conf)).init();
}