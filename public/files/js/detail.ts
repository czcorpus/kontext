/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../ts/declarations/jquery.d.ts" />
/// <reference path="./types/common.d.ts" />
/// <reference path="./types/views.d.ts" />

import $ = require('jquery');
import popupBox = require('./popupbox');
import {init as initDetailViews} from 'views/concordance/detail';



function enableAjaxLoadingNotification(jqAjaxLoader:JQuery):JQuery {
    return $('body').append(jqAjaxLoader);
}

function disableAjaxLoadingNotification(elm):void {
    $(elm).remove();
}

interface RefsColumn {
    name:string;
    val:string;
}

function createItemPairs<T>(data:Array<T>):Array<Array<T>> {
    let ans:Array<Array<T>> = [];
    for (let i = 0; i < data.length; i += 2) {
        ans.push([data[i], data[i+1]]);
    }
    return ans;
}


/**
 *
 */
export class ConcDetail {

    private pluginApi:Kontext.PluginApi;

    private currentDetail:popupBox.TooltipBox;

    private detailViews:any;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.detailViews = initDetailViews(pluginApi.dispatcher(), pluginApi.exportMixins());
    }

    private newDetailWindow(box:popupBox.TooltipBox):void {
        if (this.currentDetail) {
            this.currentDetail.close();
        }
        this.currentDetail = box;
    }

    private createAjaxLoader():HTMLElement {
        let ans = window.document.createElement('img');
        $(ans)
            .addClass('ajax-loader')
            .attr('src', this.pluginApi.createStaticUrl('img/ajax-loader.gif'));
        return ans;
    }

    /**
     * Display metadata information (structural attributes)
     */
    showRefDetail(url:string, params:string|{[k:string]:any}, succCallback:(box:popupBox.TooltipBox)=>void,
            closeCallback:()=>void, errorCallback:(err:any)=>void) {
        let self = this;
        let ajaxLoader = this.pluginApi.ajaxAnim();

        this.newDetailWindow(popupBox.open(
            self.createAjaxLoader(),
            null,
            {
                type : 'plain',
                domId : 'detail-frame',
                calculatePosition : false,
                closeIcon : true,
                timeout : null,
                onClose : function () {
                    if (typeof closeCallback === 'function' ) {
                        closeCallback();
                    }
                    self.currentDetail = null;
                },
                onShow : function () {
                    let leftPos = $(window).width() / 2 - this.getPosition().width / 2;
                    this.setCss('left', leftPos + 'px');
                }
            }
        ));

        this.pluginApi.ajax(
            'GET',
            url,
            params,
            {
                contentType : 'application/x-www-form-urlencoded',
                accept: 'application/json'
            }

        ).then(
            (data) => {
                if (data['Refs']) {
                    self.pluginApi.renderReactComponent(
                        self.detailViews.RefDetail,
                        self.currentDetail.getContentElement(),
                        {
                            data: createItemPairs<RefsColumn>(data['Refs']),
                            onReady: () => {
                                let leftPos = $(window).width() / 2 - self.currentDetail.getPosition().width / 2;
                                self.currentDetail.setCss('left', leftPos + 'px');
                                succCallback(self.currentDetail);
                            }
                        }
                    );

                } else {
                    throw new Error('Missing "Refs" key in response data');
                }
            },
            (err) => {
                if (self.currentDetail) {
                    self.currentDetail.close();
                }
                errorCallback(err);
            }
        );
    }


    private attachDisplayWholeDocumentTrigger(tooltipBox, triggerElm) {
        let url = this.pluginApi.createActionUrl($(triggerElm).data('action'));
        let args = $(triggerElm).data('params');

        let prom = this.pluginApi.ajax(
            'GET',
            url,
            args,
            {
                contentType : 'application/x-www-form-urlencoded',
                accept: 'text/html'
            }
        );

        $(tooltipBox.getContentElement())
            .empty()
            .append('<img src="' + this.pluginApi.createStaticUrl('img/ajax-loader.gif')
                    + '" class="ajax-loader" />');
        prom.then(
            (data:string) => {
                $(tooltipBox.getContentElement())
                    .addClass('whole-document')
                    .empty()
                    .html(data);
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    /**
     * Display an extended KWIC context.
     */
    showDetail(url:string, params:{[k:string]:any}, onSuccess:(box:popupBox.TooltipBox)=>void,
                onClose:()=>void, onError:any) {
        let self = this;
        this.pluginApi.ajax(
            'GET',
            url,
            params,
            {
                contentType : 'application/x-www-form-urlencoded',
                accept: 'text/html'
            }

        ).then(
            (html:string) => {
                let leftPos;

                self.newDetailWindow(popupBox.extended(self.pluginApi).open(
                    html,
                    null,
                    {
                        type : 'plain',
                        domId : 'detail-frame',
                        calculatePosition : false,
                        closeIcon : true,
                        timeout : null,
                        onClose : function () {
                            if (typeof onClose === 'function' ) {
                                onClose();
                            }
                            self.currentDetail = null;
                        },
                        onShow : function () {
                            let box = this;
                            $('#ctx-link').on('click', function (evt) {
                                self.attachDisplayWholeDocumentTrigger(box, evt.target);
                            });
                        }
                    }
                ));
                self.currentDetail.setCss('width', '700px');
                leftPos = $(window).width() / 2 - self.currentDetail.getPosition().width / 2;
                self.currentDetail.setCss('left', leftPos + 'px');

                if (typeof onSuccess === 'function') {
                    onSuccess(self.currentDetail);
                }
            },
            (err) => {
                console.error(err);
                if (typeof onError === 'function') {
                    onError(err);
                }
            }
        );
    }
}
