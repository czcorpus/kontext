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

import document = require('tpl/document');
import $ = require('jquery');

/**
 *
 */
export class CollPage {

    private pageModel:document.PageModel;

    private checkIntervalId:number;

    private numErrors:number;

    static MAX_NUM_ERRORS = 3;

    constructor(pageModel:document.PageModel) {
        this.pageModel = pageModel;
    }

    private checkStatus():void {
        let self = this;
        let args = {
            'corpname': this.pageModel.getConf('corpname'),
            'usesubcorp': this.pageModel.getConf('subcorpname'),
            'attrname': this.pageModel.getConf('attrname')
        };
        let prom:JQueryXHR = $.ajax(this.pageModel.createActionUrl('wordlist_process'), {
            data: args
        });

        prom.then(
            function (data) {
                let m = /(\d+)\s*%/.exec(data);

                if (m) {
                    $('#processbar').css('width', m[1] + '%');
                    if (parseInt(m[1]) === 100) {
                        self.stopWatching(); // just for sure
                        self.pageModel.reload();
                    }

                } else {
                    if (self.numErrors > CollPage.MAX_NUM_ERRORS) {
                        self.stopWatching();
                        self.pageModel.showMessage('error',
                                self.pageModel.translate('global__failed_to_watch_coll_calc'));

                    } else {
                        self.numErrors += 1;
                    }
                }
            },
            function (err) {
                self.stopWatching();
                self.pageModel.showMessage('error',
                    self.pageModel.translate('global__failed_to_watch_coll_calc'));
            }
        );
    }

    startWatching():void {
        this.numErrors = 0;
        this.checkIntervalId = setInterval(this.checkStatus.bind(this), 2000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }
}


export function init(conf:Kontext.Conf) {
    return new CollPage(new document.PageModel(conf));
}
