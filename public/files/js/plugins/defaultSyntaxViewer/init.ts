/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="./js-treex-view.d.ts" />
/// <amd-dependency path="./js-treex-view" />

import $ = require('jquery');
import RSVP = require('vendor/rsvp');
import popupbox = require('../../popupbox');
declare var treexView:JQuery;



function createAjaxLoader():JQuery {
    let loader = $(window.document.createElement('div'));
    loader
        .addClass('ajax-loading-msg')
        .css({
            'bottom' : '50px',
            'position' : 'fixed',
            'left' : ($(window).width() / 2 - 50) + 'px'
        })
        .append('<span>' + this.translate('global__loading') + '</span>');
    return loader;
}

/**
 *
 */
class SyntaxTreeViewer {

    private pluginApi:Kontext.PluginApi;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
    }

    private createRenderFunction(tokenId:string, kwicLength:number):(box:popupbox.TooltipBox, finalize:()=>void)=>void {
        return (box:popupbox.TooltipBox, finalize:()=>void) => {
            const ajaxAnim = createAjaxLoader();
            $('body').append(ajaxAnim);

            this.pluginApi.ajax(
                'GET',
                this.pluginApi.createActionUrl('get_syntax_data'),
                {
                    corpname: this.pluginApi.getConf('corpname'),
                    kwic_id: tokenId,
					kwic_len: kwicLength
                },
                {contentType : 'application/x-www-form-urlencoded'}

            ).then(
                (data) => {
                    $(ajaxAnim).remove();
                    if (!data['contains_errors']) {
                        let treexFrame = window.document.createElement('div');
                        $(box.getContentElement()).append(treexFrame);
                        finalize();
                        $(treexFrame).treexView(data); // this must be run after finalize

                    } else {
                        finalize();
                        box.close();
                        this.pluginApi.showMessage('error', data['error']);
                    }
                },
                (error) => {
                    $(ajaxAnim).remove();
                    finalize();
                    box.close();
                    this.pluginApi.showMessage('error', error);
                }
            );
        };
    }

    private createActionButton(tokenId:string, kwicLength:number):HTMLElement {
        const baseImg = this.pluginApi.createStaticUrl('js/plugins/defaultSyntaxViewer/syntax-tree-icon.svg');
        const overImg = this.pluginApi.createStaticUrl('js/plugins/defaultSyntaxViewer/syntax-tree-icon_s.svg');
        const button = window.document.createElement('img');
        $(button)
            .attr('src', baseImg)
            .attr('title', this.pluginApi.translate('syntaxViewer__click_to_see_the_tree'))
            .on('mouseover', () => {
                $(button).attr('src', overImg);
            })
            .on('mouseout', () => {
                $(button).attr('src', baseImg);
            });
        popupbox.bind(
            button,
            this.createRenderFunction(tokenId, kwicLength),
            {
                type: 'plain',
                closeIcon: true,
                movable: true,
                timeout: null
            }
        );
        return button;
    }

    init():void {
        let srch = $('#conclines').find('td.syntax-tree');
        srch
            .empty()
            .each((i, elm:HTMLElement) => {
                let trElm = $(elm).closest('tr');
                if (trElm.attr('data-toknum')) {
                    $(elm).append(this.createActionButton(trElm.attr('data-toknum'),
                            parseInt(trElm.attr('data-kwiclen')))).show();
                }
            });
    }
}

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise<Kontext.Plugin>((resolve:(val:Kontext.Plugin)=>void, reject:(e:any)=>void) => {
        let viewer = new SyntaxTreeViewer(pluginApi);
        viewer.init();
        resolve(viewer);
    });
}