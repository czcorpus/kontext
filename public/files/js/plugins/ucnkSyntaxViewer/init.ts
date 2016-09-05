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

import $ = require('jquery');
import RSVP = require('vendor/rsvp');
import {openAt as openPopupBox, TooltipBox} from '../../popupbox';
import {createGenerator} from './ucnkTreeView';


class SyntaxTreeViewer {

    private pluginApi:Kontext.PluginApi;

    private popupBox

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
    }

    private createRenderFunction(tokenId:string, kwicLength:number):(box:TooltipBox, finalize:()=>void)=>void {
        return (box:TooltipBox, finalize:()=>void) => {
            let ajaxAnim = this.pluginApi.ajaxAnim();
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
                (data:any) => {
                    $(ajaxAnim).remove();
                    if (!data['contains_errors']) {
                        let treexFrame = window.document.createElement('div');
                        $(treexFrame).css('width', '90%');
                        $(box.getContentElement()).append(treexFrame);
                        finalize();
                        box.setCss('left', '50%');
                        box.setCss('top', '50%');
                        const generator = createGenerator(this.pluginApi.exportMixins()[0]);
                        generator(data, 'cs', 'default', treexFrame, {
                            width: null, // = auto
                            height: null, // = auto
                            paddingTop: 20,
                            paddingBottom: 50,
                            paddingLeft: 20,
                            paddingRight: 20
                        });

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
            })
            .on('click', () => {
                if (this.popupBox) {
                    this.popupBox.close();
                }
                const overlay = window.document.createElement('div');
                $(overlay).attr('id', 'modal-overlay');
                $('body').append(overlay);
                this.popupBox = openPopupBox(
                    overlay,
                    this.createRenderFunction(tokenId, kwicLength),
                    {left: 0, top: 0},
                    {
                        type: 'plain',
                        calculatePosition: false,
                        closeIcon: true,
                        timeout: null,
                        htmlClass: 'syntax-tree',
                        afterClose: () => {
                            $(overlay).remove();
                        }
                    }
                );
            });
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