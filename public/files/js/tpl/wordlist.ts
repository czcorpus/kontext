/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/popupbox.d.ts" />

import document = require('tpl/document');
import $ = require('jquery');
import popupBox = require('popupbox');

/**
 *
 */
export class WordlistPage {

    private pageModel:document.PageModel;

    private checkIntervalId:number;

    private numErrors:number;

    private numNoChange:number;

    private lastStatus:number;

    static MAX_NUM_NO_CHANGE = 20;

    constructor(pageModel:document.PageModel) {
        this.pageModel = pageModel;
    }

    private stopWithError():void {
        this.stopWatching();
        this.pageModel.showMessage(
                'error',
                this.pageModel.translate('global__bg_calculation_failed'),
                () => {window.history.back();});
    }

    private checkStatus():void {
        let self = this;
        let args = {
            'corpname': this.pageModel.getConf('corpname'),
            'usesubcorp': this.pageModel.getConf('subcorpname'),
            'attrname': this.pageModel.getConf('attrname'),
            'worker_tasks': this.pageModel.getConf('workerTasks')
        };
        let prom:JQueryXHR = $.ajax(this.pageModel.createActionUrl('wordlist_process'), {
            data: args,
            dataType: 'json',
            traditional: true
        });

        prom.then(
            function (data) {
                if (data.contains_errors) {
                    self.stopWithError();

                } else {
                    $('#processbar').css('width', data.status + '%');
                    if (data.status === 100) {
                        self.stopWatching(); // just for sure
                        window.location.href = self.pageModel.getConf('reloadUrl');

                    } else if (self.numNoChange >= WordlistPage.MAX_NUM_NO_CHANGE) {
                        self.stopWithError();

                    } else if (data.status === self.lastStatus) {
                        self.numNoChange += 1;
                    }
                    self.lastStatus = data.status;
                }
            },
            function (err) {
                self.stopWithError();
            }
        );
    }

    startWatching():void {
        this.numNoChange = 0;
        this.checkIntervalId = setInterval(this.checkStatus.bind(this), 2000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }

    setupContextHelp(message):void {
        popupBox.bind($('#progress_message a.context-help'), message, {width: 'nice'});
    }

    init():void {
        this.setupContextHelp(this.pageModel.translate('global__wl_calc_info'));
    }
}


export function init(conf:Kontext.Conf):WordlistPage {
    let layoutModel:document.PageModel = new document.PageModel(conf);
    layoutModel.init();
    let page:WordlistPage = new WordlistPage(layoutModel);
    page.init();
    return page;
}